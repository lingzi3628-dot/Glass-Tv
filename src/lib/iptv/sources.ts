/**
 * GlassTV IPTV source catalog.
 *
 * Each source points at a publicly-hosted M3U / M3U8 playlist. The sync API
 * (POST /api/channels/sync) iterates these, fetches + parses each playlist,
 * and upserts the resulting channels into the `Channel` table.
 *
 * Sources are intentionally simple: the parser is self-contained (no
 * `@iptv/playlist` dependency) so adding a new source is just a config entry.
 */
export interface IPTVSource {
  id: string
  name: string
  url: string
  type: 'm3u' | 'm3u8'
  country?: string
  language?: string
  enabled: boolean
}

export const IPTV_SOURCES: IPTVSource[] = [
  {
    id: 'iptv-org-global',
    name: 'IPTV-org Global',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    type: 'm3u',
    enabled: true,
  },
  {
    id: 'iptv-org-english',
    name: 'IPTV-org English',
    url: 'https://iptv-org.github.io/iptv/languages/eng.m3u',
    type: 'm3u',
    language: 'en',
    enabled: true,
  },
  {
    id: 'free-tv-global',
    name: 'Free-TV Global',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    type: 'm3u8',
    enabled: true,
  },
  {
    id: 'world-iptv',
    name: 'World IPTV',
    url: 'https://romaxa55.github.io/world_ip_tv/output/index.m3u',
    type: 'm3u',
    enabled: true,
  },
]

/** URLs of all enabled sources, used as the default for the sync API. */
export const DEFAULT_SOURCES: string[] = IPTV_SOURCES.filter(
  (s) => s.enabled,
).map((s) => s.url)
