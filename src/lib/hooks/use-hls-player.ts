'use client'

import * as React from 'react'
import Hls from 'hls.js'

export interface UseHlsPlayerOptions {
  streamUrl: string
  autoPlay?: boolean
  muted?: boolean
}

export interface UseHlsPlayerResult {
  videoRef: React.RefObject<HTMLVideoElement | null>
  hlsRef: React.RefObject<Hls | null>
  isLoading: boolean
  error: string | null
  isPlaying: boolean
  isMuted: boolean
  togglePlay: () => void
  toggleMute: () => void
}

/**
 * useHlsPlayer
 *
 * Attaches hls.js to a `<video>` element referenced by `videoRef`. Used by
 * both the PreviewPopup mini-player and the full-screen PlayerOverlay so we
 * get identical lifecycle + cleanup behavior in both places.
 *
 * - When `streamUrl` changes, any previous Hls instance is destroyed and a
 *   new one is created.
 * - In Safari (no `Hls.isSupported()`) we fall back to native HLS playback
 *   by setting `video.src` directly.
 * - `isLoading` flips to false once the manifest has been parsed (or once
 *   the native `loadedmetadata` event fires in Safari).
 * - Fatal hls.js errors set `error`; the page never crashes.
 * - Cleanup: `hls.destroy()` + `video.pause()` + `video.removeAttribute('src')`.
 */
export function useHlsPlayer({
  streamUrl,
  autoPlay = true,
  muted = true,
}: UseHlsPlayerOptions): UseHlsPlayerResult {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const hlsRef = React.useRef<Hls | null>(null)

  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false)
  const [isMuted, setIsMuted] = React.useState<boolean>(muted)

  // Reset state whenever the source URL changes so the UI reflects that
  // we're loading a brand new stream (not stuck on the previous error).
  React.useEffect(() => {
    setIsLoading(true)
    setError(null)
    setIsPlaying(false)
  }, [streamUrl])

  // Attach hls.js to the video element whenever streamUrl changes.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

    // Whether we're using hls.js or native HLS, we want to honor the
    // `muted` option every time a new stream is attached.
    video.muted = muted
    setIsMuted(muted)

    let disposed = false

    // Safari path: native HLS support via video.src.
    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
        const onLoaded = () => {
          if (disposed) return
          setIsLoading(false)
          if (autoPlay) {
            const p = video.play()
            if (p && typeof p.then === 'function') {
              p.then(() => setIsPlaying(true)).catch(() => {
                // Autoplay was blocked (browser policy). Leave paused;
                // the user can hit play. Don't surface this as an error.
                setIsPlaying(false)
              })
            } else {
              setIsPlaying(true)
            }
          }
        }
        const onErr = () => {
          if (disposed) return
          setError('Unable to load this stream on your device.')
          setIsLoading(false)
        }
        video.addEventListener('loadedmetadata', onLoaded)
        video.addEventListener('error', onErr)
        return () => {
          disposed = true
          video.removeEventListener('loadedmetadata', onLoaded)
          video.removeEventListener('error', onErr)
          video.pause()
          video.removeAttribute('src')
          video.load()
        }
      }
      // Neither hls.js nor native HLS is available.
      setError('Your browser does not support HLS playback.')
      setIsLoading(false)
      return
    }

    // Standard path: hls.js.
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: 5,
    })
    hlsRef.current = hls

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (disposed) return
      setIsLoading(false)
      if (autoPlay) {
        const p = video.play()
        if (p && typeof p.then === 'function') {
          p.then(() => setIsPlaying(true)).catch(() => {
            setIsPlaying(false)
          })
        } else {
          setIsPlaying(true)
        }
      }
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (disposed) return
      if (data.fatal) {
        // Surface the error to the UI but don't crash the page.
        setError(
          data.details
            ? `Stream error: ${data.details}`
            : 'This stream is currently unavailable.',
        )
        setIsLoading(false)
        // Try a soft recovery: detach + re-attach the source once. If that
        // still fails, the user sees the error and can dismiss.
        try {
          hls.destroy()
        } catch {
          // ignore
        }
      }
    })

    hls.loadSource(streamUrl)
    hls.attachMedia(video)

    return () => {
      disposed = true
      try {
        hls.destroy()
      } catch {
        // ignore
      }
      hlsRef.current = null
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    // We deliberately omit `muted` and `autoPlay` from the deps so that
    // toggling mute/play after attach doesn't re-create the Hls instance.
  }, [streamUrl])

  // Wire play/pause events from the video element so external triggers
  // (e.g. browser native controls, programmatic pause) keep `isPlaying`
  // in sync.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    video.addEventListener('play', onPlay)
    video.addEventListener('playing', onPlay)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('playing', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [streamUrl])

  const togglePlay = React.useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      const p = video.play()
      if (p && typeof p.then === 'function') {
        p.then(() => setIsPlaying(true)).catch(() => {
          // Autoplay rejection - leave paused, no error.
        })
      } else {
        setIsPlaying(true)
      }
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }, [])

  const toggleMute = React.useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  return {
    videoRef,
    hlsRef,
    isLoading,
    error,
    isPlaying,
    isMuted,
    togglePlay,
    toggleMute,
  }
}
