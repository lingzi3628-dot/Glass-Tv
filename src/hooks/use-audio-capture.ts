'use client'

import * as React from 'react'

/**
 * useAudioCapture
 *
 * Captures audio chunks from a `<video>` element using the Web Audio API.
 * Each chunk is ~`chunkDuration` seconds of 16kHz (default) mono WAV,
 * base64-encoded so it can be POSTed straight to `/api/captions` for
 * transcription.
 *
 * Audio graph:
 *   MediaElementSource → GainNode → ScriptProcessor → AudioContext.destination
 *
 * - The GainNode follows the video element's `volume` / `muted` so the
 *   existing Player volume UI keeps working once the audio is rerouted
 *   through the AudioContext (otherwise `video.volume` would have no effect).
 * - The ScriptProcessorNode is deprecated but still works in every browser
 *   and is by far the simplest way to tap raw PCM samples.
 * - On cross-origin videos without CORS headers, `createMediaElementSource`
 *   yields all-zero samples. We detect 3 consecutive silent chunks, fire
 *   `onError` with a friendly message, and stop capturing so the
 *   CaptionsController can fall back to demo mode.
 */

export interface AudioChunk {
  /** base64-encoded 16-bit PCM mono WAV */
  data: string
  /** duration in seconds */
  duration: number
  /** seconds into the stream (video.currentTime at the moment of emission) */
  timestamp: number
}

interface UseAudioCaptureOptions {
  /** Target sample rate. Default 16000 (Whisper-friendly). */
  sampleRate?: number
  /** Chunk duration in seconds. Default 5. */
  chunkDuration?: number
  /** Whether to actually emit chunks. Default true. */
  enabled?: boolean
  /** Called for every captured audio chunk. */
  onChunk?: (chunk: AudioChunk) => void
  /** Called when capture fails (CORS, unsupported, already-connected, ...). */
  onError?: (error: Error) => void
}

interface UseAudioCaptureResult {
  isCapturing: boolean
  isSupported: boolean
  startCapture: (videoElement: HTMLVideoElement) => void
  stopCapture: () => void
  error: Error | null
}

/* ------------------------------------------------------------------ */
/* WAV helpers                                                         */
/* ------------------------------------------------------------------ */

function concatFloat32Arrays(arrays: Float32Array[]): Float32Array {
  let total = 0
  for (const a of arrays) total += a.length
  const out = new Float32Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

/**
 * Encodes a Float32Array of PCM samples into a 16-bit PCM mono WAV file,
 * returned as a base64 string (no `data:` prefix).
 */
function float32ToWavBase64(samples: Float32Array, sampleRate: number): string {
  const numChannels = 1
  const bytesPerSample = 2 // 16-bit
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  // fmt chunk
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // audio format = PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  // data chunk
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM samples (clamp + convert to int16)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  // Base64-encode in chunks (avoids call-stack overflow on big arrays).
  const bytes = new Uint8Array(buffer)
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length))
    // String.fromCharCode.apply needs a normal array (not Uint8Array) in
    // some older engines, so spread it.
    binary += String.fromCharCode.apply(null, Array.from(slice))
  }
  return btoa(binary)
}

/** Returns true if every sample is effectively zero (silent). */
function isSilent(samples: Float32Array, threshold = 1e-4): boolean {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > threshold) return false
  }
  return true
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

interface CaptureHandles {
  audioContext: AudioContext
  source: MediaElementAudioSourceNode
  gain: GainNode
  processor: ScriptProcessorNode
  volumeChangeHandler: () => void
  videoElement: HTMLVideoElement
}

export function useAudioCapture(
  options: UseAudioCaptureOptions = {},
): UseAudioCaptureResult {
  const {
    sampleRate = 16000,
    chunkDuration = 5,
    enabled = true,
    onChunk,
    onError,
  } = options

  const [isCapturing, setIsCapturing] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  // Refs so the onaudioprocess callback can read fresh values without being
  // re-attached on every render.
  const enabledRef = React.useRef(enabled)
  const onChunkRef = React.useRef(onChunk)
  const onErrorRef = React.useRef(onError)

  React.useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])
  React.useEffect(() => {
    onChunkRef.current = onChunk
  }, [onChunk])
  React.useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const handlesRef = React.useRef<CaptureHandles | null>(null)
  const accumulatedRef = React.useRef<Float32Array[]>([])
  const silentStreakRef = React.useRef(0)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const isSupported = React.useMemo(
    () =>
      typeof window !== 'undefined' &&
      (typeof window.AudioContext === 'function' ||
        typeof (
          window as unknown as { webkitAudioContext?: unknown }
        ).webkitAudioContext === 'function'),
    [],
  )

  const stopCapture = React.useCallback(() => {
    const handles = handlesRef.current
    handlesRef.current = null
    accumulatedRef.current = []
    silentStreakRef.current = 0

    if (!handles) return

    try {
      handles.processor.onaudioprocess = null
    } catch {
      /* ignore */
    }
    try {
      handles.processor.disconnect()
    } catch {
      /* ignore */
    }
    try {
      handles.gain.disconnect()
    } catch {
      /* ignore */
    }
    try {
      handles.source.disconnect()
    } catch {
      /* ignore */
    }
    try {
      handles.videoElement.removeEventListener(
        'volumechange',
        handles.volumeChangeHandler,
      )
    } catch {
      /* ignore */
    }
    try {
      // close() is async but we don't need to await it.
      void handles.audioContext.close()
    } catch {
      /* ignore */
    }

    setIsCapturing(false)
  }, [])

  const startCapture = React.useCallback(
    (videoElement: HTMLVideoElement) => {
      if (!isSupported) {
        const err = new Error(
          'Audio capture is not supported in this browser.',
        )
        setError(err)
        onErrorRef.current?.(err)
        return
      }

      // Already capturing the same element - no-op.
      if (
        handlesRef.current &&
        handlesRef.current.videoElement === videoElement
      ) {
        return
      }

      // If we were capturing a different element, tear down first.
      if (handlesRef.current) {
        stopCapture()
      }

      videoRef.current = videoElement
      setError(null)

      const AudioContextCtor: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext

      if (!AudioContextCtor) {
        const err = new Error(
          'Audio capture is not supported in this browser.',
        )
        setError(err)
        onErrorRef.current?.(err)
        return
      }

      let audioContext: AudioContext
      try {
        audioContext = new AudioContextCtor({ sampleRate })
      } catch {
        // Some browsers refuse a non-default sampleRate - retry with default.
        try {
          audioContext = new AudioContextCtor()
        } catch (e) {
          const err =
            e instanceof Error ? e : new Error('Failed to create AudioContext')
          setError(err)
          onErrorRef.current?.(err)
          return
        }
      }

      // AudioContext starts suspended until a user gesture resumes it. The
      // Player has already started playback (user clicked Play), so resuming
      // should succeed; we fire-and-forget.
      try {
        void audioContext.resume()
      } catch {
        /* ignore - not fatal */
      }

      // Use the AudioContext's actual sample rate for WAV encoding (the
      // requested rate may not have been honoured).
      const effectiveSampleRate = audioContext.sampleRate

      let source: MediaElementAudioSourceNode
      try {
        source = audioContext.createMediaElementSource(videoElement)
      } catch (e) {
        const err =
          e instanceof Error
            ? e
            : new Error('Failed to attach audio source to the video element.')
        // Most common cause: createMediaElementSource was already called on
        // this element by a previous capture session.
        setError(err)
        onErrorRef.current?.(err)
        try {
          void audioContext.close()
        } catch {
          /* ignore */
        }
        return
      }

      // Gain node so the Player's volume/mute UI still works after the
      // audio is rerouted through the AudioContext.
      const gain = audioContext.createGain()
      gain.gain.value = videoElement.muted ? 0 : videoElement.volume

      const volumeChangeHandler = () => {
        if (!handlesRef.current) return
        try {
          gain.gain.value = videoElement.muted ? 0 : videoElement.volume
        } catch {
          /* ignore */
        }
      }
      videoElement.addEventListener('volumechange', volumeChangeHandler)

      // ScriptProcessorNode (deprecated but universally supported).
      const BUFFER_SIZE = 4096
      let processor: ScriptProcessorNode
      try {
        processor = audioContext.createScriptProcessor(
          BUFFER_SIZE,
          1,
          1,
        )
      } catch (e) {
        const err =
          e instanceof Error
            ? e
            : new Error('Failed to create ScriptProcessorNode.')
        setError(err)
        onErrorRef.current?.(err)
        try {
          source.disconnect()
          gain.disconnect()
          videoElement.removeEventListener('volumechange', volumeChangeHandler)
          void audioContext.close()
        } catch {
          /* ignore */
        }
        return
      }

      const targetSamples = Math.max(
        1,
        Math.floor(chunkDuration * effectiveSampleRate),
      )

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        // Pass audio through to destination so the user still hears it.
        const input = event.inputBuffer.getChannelData(0)
        const output = event.outputBuffer.getChannelData(0)
        output.set(input)

        // Tap a COPY into the accumulation buffer (the underlying buffer is
        // reused by the browser, so we can't keep a reference).
        accumulatedRef.current.push(new Float32Array(input))

        let totalSamples = 0
        for (const a of accumulatedRef.current) totalSamples += a.length
        if (totalSamples < targetSamples) return

        const merged = concatFloat32Arrays(accumulatedRef.current)
        accumulatedRef.current = []

        // CORS-silence detection.
        if (isSilent(merged)) {
          silentStreakRef.current += 1
          if (silentStreakRef.current >= 3) {
            const err = new Error(
              'Audio capture unavailable for this stream (CORS). Showing demo captions instead.',
            )
            setError(err)
            onErrorRef.current?.(err)
            // Tear down synchronously - stopCapture reads handlesRef.
            stopCapture()
            return
          }
        } else {
          silentStreakRef.current = 0
        }

        if (!enabledRef.current) return

        const base64 = float32ToWavBase64(merged, effectiveSampleRate)
        const chunk: AudioChunk = {
          data: base64,
          duration: merged.length / effectiveSampleRate,
          timestamp: Math.floor(videoElement.currentTime || 0),
        }
        try {
          onChunkRef.current?.(chunk)
        } catch {
          /* swallow consumer errors so they don't break the audio thread */
        }
      }

      // Wire the graph: source → gain → processor → destination.
      try {
        source.connect(gain)
        gain.connect(processor)
        processor.connect(audioContext.destination)
      } catch (e) {
        const err =
          e instanceof Error ? e : new Error('Failed to wire audio graph.')
        setError(err)
        onErrorRef.current?.(err)
        try {
          source.disconnect()
          gain.disconnect()
          processor.disconnect()
          videoElement.removeEventListener('volumechange', volumeChangeHandler)
          void audioContext.close()
        } catch {
          /* ignore */
        }
        return
      }

      handlesRef.current = {
        audioContext,
        source,
        gain,
        processor,
        volumeChangeHandler,
        videoElement,
      }
      setIsCapturing(true)
    },
    [isSupported, sampleRate, chunkDuration, stopCapture],
  )

  // Tear down on unmount.
  React.useEffect(() => {
    return () => {
      stopCapture()
    }
  }, [stopCapture])

  return { isCapturing, isSupported, startCapture, stopCapture, error }
}
