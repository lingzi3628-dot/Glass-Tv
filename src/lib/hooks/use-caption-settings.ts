'use client'

import * as React from 'react'

/**
 * useCaptionSettings
 *
 * Loads the user's AI-caption preferences from `/api/caption-settings` on
 * mount and exposes an optimistic `updateSettings(partial)` that POSTs the
 * patch to the server. The server is the single source of truth - nothing
 * is persisted in localStorage.
 *
 * API contract (Task 4-B):
 *   GET  /api/caption-settings  → { data: CaptionSettings | null }
 *   POST /api/caption-settings  body { ...partial }  → { success: true }
 *
 * If the server returns `null` (no settings row yet), the hook falls back
 * to DEFAULT_CAPTION_SETTINGS.
 */

export interface CaptionSettings {
  enabled: boolean
  language: string
  fontSize: number
  fontColor: string
  backgroundColor: string
  position: 'top' | 'middle' | 'bottom'
}

export interface UseCaptionSettingsResult {
  settings: CaptionSettings
  loading: boolean
  /** Optimistic update; returns false if the server rejected the patch. */
  updateSettings: (partial: Partial<CaptionSettings>) => Promise<boolean>
  /** Re-fetch from the server. */
  refresh: () => void
}

export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  enabled: true,
  language: 'en',
  fontSize: 18,
  fontColor: '#FFFFFF',
  backgroundColor: 'rgba(0,0,0,0.75)',
  position: 'bottom',
}

interface CaptionSettingsResponse {
  data?: CaptionSettings | null
  error?: string
}

interface CaptionSettingsPostResponse {
  success?: boolean
  error?: string
}

export function useCaptionSettings(): UseCaptionSettingsResult {
  const [settings, setSettings] = React.useState<CaptionSettings>(
    DEFAULT_CAPTION_SETTINGS,
  )
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/caption-settings', { method: 'GET' })
      const data = (await res.json()) as CaptionSettingsResponse
      if (res.ok && data.data) {
        setSettings({ ...DEFAULT_CAPTION_SETTINGS, ...data.data })
      } else {
        // null (no row yet) or error → use defaults.
        setSettings(DEFAULT_CAPTION_SETTINGS)
      }
    } catch {
      setSettings(DEFAULT_CAPTION_SETTINGS)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const updateSettings = React.useCallback(
    async (partial: Partial<CaptionSettings>): Promise<boolean> => {
      // Snapshot for revert.
      const previous = settings
      const next: CaptionSettings = { ...previous, ...partial }
      setSettings(next)

      try {
        const res = await fetch('/api/caption-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        })
        const data = (await res.json()) as CaptionSettingsPostResponse
        if (!res.ok || !data.success) {
          setSettings(previous)
          return false
        }
        return true
      } catch {
        setSettings(previous)
        return false
      }
    },
    [settings],
  )

  return { settings, loading, updateSettings, refresh }
}
