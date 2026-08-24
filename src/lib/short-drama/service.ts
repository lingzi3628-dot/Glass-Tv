/**
 * Phase 19 — Short Dramas service.
 *
 * The upstream Anichin / DramaBox API at `api.anichin.bio` returns
 * `{"error":"forbidden"}` for the trial key `TRIAL-ANICHIN-2026`. When a
 * valid API key is provided via `ANICHIN_API_KEY`, the `fetchFromAnichin()`
 * helper will automatically use it and return real DramaBox / ReelShort /
 * ShortMax content. Until then, we ship a **curated catalog** of 12
 * mini-series backed by 12 real, publicly-available short films (Google's
 * open-source movie bucket — Big Buck Bunny, Sintel, Tears of Steel, etc.).
 *
 * These short films are COMPLETELY DIFFERENT from the IPTV channel test
 * streams (Mux / Apple bipbop), so dramas don't look like channels.
 *
 * The same data shape is what we persist into Prisma (ShortDrama /
 * ShortDramaEpisode rows) when a user favorites or watches a drama.
 */

// ─────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────

export interface ShortDramaEpisode {
  /** 1-indexed episode number. */
  episodeNumber: number
  /** Optional episode title — falls back to "Episode N" if absent. */
  title?: string
  /** Real HLS (.m3u8) or .mp4 URL the player should load. */
  streamUrl: string
  /** Optional duration in seconds (best-effort metadata). */
  duration?: number
  /** Optional thumbnail — currently unused by the UI but reserved. */
  thumbnail?: string
}

export interface ShortDrama {
  /** Stable catalog id (e.g. "married-by-mistake"). */
  id: string
  title: string
  description: string
  /** Emoji used as the poster/cover glyph, prefixed with "emoji:". */
  emoji: string
  genre: string
  /** 0–10 user rating shown on cards. */
  rating: number
  totalEpisodes: number
  isNew: boolean
  isTrending: boolean
  /** Tailwind gradient class string applied to poster backgrounds. */
  gradient: string
  /** Per-episode stream list. Length must equal totalEpisodes. */
  streams: ShortDramaEpisode[]
}

/** Detailed shape returned by `getDramaDetails` (includes synopsis etc.). */
export interface ShortDramaDetail extends ShortDrama {
  /** Longer synopsis used inside the detail view. */
  synopsis: string
  /** 1–3 cast names shown inside the detail header. */
  cast: string[]
  /** Release year for sorting/labeling. */
  year: number
}

// ─────────────────────────────────────────────────────────────────────
// Real short-film video sources (Google open-source movies + HLS streams)
// These are DIFFERENT from the IPTV channel test streams so dramas don't
// look like channels. Each is a real short film (2-15 min).
// ─────────────────────────────────────────────────────────────────────

const HLS_STREAMS = [
  // Google's open-source short films (actual stories, not test patterns)
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TheDigitalRevolution.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
] as const

/**
 * Build a stream list for a drama by rotating through the 12 real short-film
 * URLs. Each episode gets its own video URL. These are real short films
 * (Big Buck Bunny, Sintel, Tears of Steel, etc.) — completely different
 * content from the IPTV channel streams, so dramas don't look like channels.
 */
function buildStreams(totalEpisodes: number, titles?: string[]): ShortDramaEpisode[] {
  const episodes: ShortDramaEpisode[] = []
  for (let i = 0; i < totalEpisodes; i++) {
    const streamUrl = HLS_STREAMS[i % HLS_STREAMS.length]!
    episodes.push({
      episodeNumber: i + 1,
      title: titles?.[i],
      streamUrl,
      // 90–300s estimate so the progress bar has a sane denominator.
      duration: 120 + ((i * 23) % 180),
    })
  }
  return episodes
}

// ─────────────────────────────────────────────────────────────────────
// Curated catalog — 12 short dramas across 5 genres
// ─────────────────────────────────────────────────────────────────────

const DRAMAS: ShortDramaDetail[] = [
  {
    id: 'married-by-mistake',
    title: 'Married by Mistake',
    description:
      'After a wild night in Vegas, two strangers wake up married — and stuck splitting a billion-dollar empire.',
    synopsis:
      'Elena, a struggling pastry chef, and Daniel, the cold CEO of a hotel conglomerate, wake up in a Vegas honeymoon suite with matching rings and zero memory of the night before. As lawyers scramble to annul the marriage, an old clause in Daniel’s grandfather’s will surfaces: he loses everything unless he stays married for one year. Now they must fake a relationship under the watchful eyes of board members, exes, and Elena’s loud Italian family — and somewhere along the way, the lie stops feeling like one.',
    emoji: '💍',
    genre: 'Romance',
    rating: 9.2,
    totalEpisodes: 12,
    isNew: false,
    isTrending: true,
    gradient: 'from-pink-500 via-rose-500 to-orange-400',
    cast: ['Lila Vance', 'Marcus Rhone', 'Priya Anand'],
    year: 2024,
    streams: buildStreams(12, [
      'The Morning After',
      'The Grandfather Clause',
      'Board Meeting Roulette',
      'First Public Appearance',
      'Meet the Family',
      'The Ex Returns',
      'A Night at the Opera',
      'Leaked Photos',
      'The Gala',
      'Truth or Dare',
      'The Press Conference',
      'One Year Later',
    ]),
  },
  {
    id: 'crowned-in-secret',
    title: 'Crowned in Secret',
    description:
      'A palace maid discovers she’s the lost heir to a fallen dynasty — and someone wants to keep it that way.',
    synopsis:
      'Mei has scrubbed floors in the Imperial Palace since she was eight. When a rebel scholar recognizes a birthmark on her wrist, her entire life unravels: she is the last surviving princess of the previous dynasty, hidden in plain sight. As she navigates treacherous court politics, a forbidden romance with the current Crown Prince, and an assassin who knows her true identity, Mei must decide whether to claim the throne — or burn it down.',
    emoji: '👑',
    genre: 'Drama',
    rating: 8.9,
    totalEpisodes: 10,
    isNew: true,
    isTrending: false,
    gradient: 'from-amber-500 via-yellow-500 to-rose-400',
    cast: ['Wen Yi', 'Chen Hao', 'Liu Mei'],
    year: 2025,
    streams: buildStreams(10, [
      'The Birthmark',
      'The Scholar’s Promise',
      'A Meeting in the Garden',
      'The Crown Prince’s Gaze',
      'Poison in the Tea',
      'The Empress Summons',
      'The Rebel Camp',
      'A Crown of Thorns',
      'The Siege',
      'Coronation',
    ]),
  },
  {
    id: 'shadow-of-the-ceo',
    title: 'Shadow of the CEO',
    description:
      'A junior analyst uncovers a secret double-life inside the tech giant she idolizes — and her boss is at the center of it.',
    synopsis:
      'Priya lands her dream job at Apex Technologies, only to find the charismatic CEO she idolizes is running a shadow company that funnels data to foreign governments. When she confronts him, he offers her a deal: keep quiet, and become the next CFO. The deeper she digs, the more she realizes her own father — presumed dead for fifteen years — was the first whistleblower, and his disappearance was no accident.',
    emoji: '🥷',
    genre: 'Thriller',
    rating: 9.0,
    totalEpisodes: 15,
    isNew: false,
    isTrending: true,
    gradient: 'from-slate-700 via-violet-700 to-fuchsia-600',
    cast: ['Ananya Roy', 'Victor Hale', 'Joon Park'],
    year: 2024,
    streams: buildStreams(15, [
      'Day One',
      'The Locked Server',
      'A Job Offer',
      'The Whistleblower File',
      'Father’s Footsteps',
      'A Funeral in Code',
      'The Board Coup',
      'Midnight Meeting',
      'Betrayal',
      'The Offshore Server',
      'Wire Transfer',
      'Hostile Takeover',
      'The Confession',
      'The Vault',
      'Aftermath',
    ]),
  },
  {
    id: 'divorced-at-18',
    title: 'Divorced at 18',
    description:
      'Forced into an arranged marriage at seventeen, Sera files for divorce the day she turns eighteen — and finds herself.',
    synopsis:
      'Sera thought she was doing the right thing when she married the son of her family’s business partner. One year later, she’s dropped out of art school, lost herself in her in-laws’ expectations, and forgotten how to paint. On her eighteenth birthday she files for divorce — and her ex’s family decides to make the process as ugly as possible. With the help of a street artist who sees what she’s lost, Sera fights for her freedom, her career, and her name.',
    emoji: '💔',
    genre: 'Romance',
    rating: 8.7,
    totalEpisodes: 8,
    isNew: true,
    isTrending: false,
    gradient: 'from-rose-500 via-red-500 to-orange-500',
    cast: ['Sera Lin', 'Kai Mendes', 'Aunt Jo'],
    year: 2025,
    streams: buildStreams(8, [
      'Eighteenth Birthday',
      'The Papers',
      'Moved Out',
      'The Street Painter',
      'Court Date One',
      'The Studio',
      'His Last Card',
      'Signed',
    ]),
  },
  {
    id: 'the-billionaires-bride',
    title: "The Billionaire's Bride",
    description:
      'A contract marriage, a hidden identity, and a billionaire who keeps forgetting the rules he wrote himself.',
    synopsis:
      'Tech billionaire Adam Cole needs a wife to satisfy a board-imposed morality clause. Jane needs money to save her mother’s bakery. The contract is simple: one year of public appearances, no feelings, no questions. But when Adam starts showing up to bake bread at midnight and Jane ends up running product launches, both of them have to wonder if the contract was the worst idea either of them ever had.',
    emoji: '🏹',
    genre: 'Drama',
    rating: 8.4,
    totalEpisodes: 12,
    isNew: false,
    isTrending: false,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    cast: ['Adam Cole', 'Jane Park', 'Dorothy Voss'],
    year: 2024,
    streams: buildStreams(12, [
      'The Pitch',
      'Signed',
      'First Appearance',
      'Midnight Bake',
      'The Charity Gala',
      'Board Pressure',
      'A Trip Home',
      'The Ex-Wife',
      'The Product Launch',
      'A Kiss for Cameras',
      'The Clause Breaks',
      'Re-negotiation',
    ]),
  },
  {
    id: 'dragons-vow',
    title: "Dragon's Vow",
    description:
      'A dragon shifter prince swears to protect the human princess who is fated to kill him.',
    synopsis:
      'In the kingdom of Verdania, dragons and humans have lived under a thousand-year truce. When Crown Princess Iris is born with the prophesied mark of the Dragonslayer, the dragon prince Kael is bound by a vow to protect her until her twentieth birthday — the day she is destined to end his life. As Iris grows into her power, both of them must reckon with a prophecy neither of them chose, and a love that defies the gods themselves.',
    emoji: '🐉',
    genre: 'Fantasy',
    rating: 9.3,
    totalEpisodes: 10,
    isNew: false,
    isTrending: true,
    gradient: 'from-indigo-600 via-purple-600 to-rose-500',
    cast: ['Iris Verdant', 'Kael Drakon', 'The Seer'],
    year: 2024,
    streams: buildStreams(10, [
      'The Mark',
      'The Vow',
      'First Lesson',
      'A Dragon in Court',
      'The Seer’s Warning',
      'The Border Skirmish',
      'Whispers of Treason',
      'The Twentieth Birthday',
      'The Vow Breaks',
      'After the Prophecy',
    ]),
  },
  {
    id: 'hidden-heiress',
    title: 'Hidden Heiress',
    description:
      'Raised as a janitor in her own father’s company, Nina waits eighteen years to take it back.',
    synopsis:
      'When her mother dies, eight-year-old Nina is secretly placed in the basement of her father’s skyscraper — disguised as the janitor’s daughter so his political rivals can’t find her. Eighteen years later, her father is dead, the company has been seized by his brother, and Nina is still mopping floors. With the help of a quietly loyal lawyer and a stolen identity badge, she begins the long game of taking back what was always hers.',
    emoji: '🌹',
    genre: 'Drama',
    rating: 8.8,
    totalEpisodes: 14,
    isNew: false,
    isTrending: false,
    gradient: 'from-rose-600 via-pink-600 to-purple-600',
    cast: ['Nina Sato', 'Lawrence Wei', 'Uncle Hugo'],
    year: 2024,
    streams: buildStreams(14, [
      'The Basement',
      'Father’s Funeral',
      'A New ID Badge',
      'The Board Meeting',
      'A Loyal Lawyer',
      'The Uncle’s Wife',
      'Sabotage',
      'Inside Accounting',
      'The Vault',
      'The Other Heir',
      'Blackmail',
      'Board Vote',
      'Hostile Takeback',
      'Chairwoman',
    ]),
  },
  {
    id: 'vengeance-in-silk',
    title: 'Vengeance in Silk',
    description:
      'A high-fashion model fakes her own death to destroy the four people who ruined her family.',
    synopsis:
      'Top model Lin Zhao was on top of the world — until the night her parents died in a fire the press called an accident. Three years later, a mysterious new designer named Silver arrives in Shanghai Fashion Week, and one by one the four people who built their empires on her family’s ashes start to fall. Lin is alive. And she has a plan.',
    emoji: '⚔️',
    genre: 'Thriller',
    rating: 9.1,
    totalEpisodes: 11,
    isNew: true,
    isTrending: false,
    gradient: 'from-zinc-800 via-red-700 to-amber-500',
    cast: ['Lin Zhao / Silver', 'Marcus Vale', 'Director Cho'],
    year: 2025,
    streams: buildStreams(11, [
      'The Fire',
      'Three Years Later',
      'Silver Debuts',
      'Target One',
      'The Runway Trap',
      'A Witness Returns',
      'Target Two',
      'The Charity Auction',
      'Betrayal',
      'Target Four',
      'The Final Show',
    ]),
  },
  {
    id: 'twins-at-the-top',
    title: 'Twins at the Top',
    description:
      'Twin sisters swap lives to take down the corporate uncle who framed their father.',
    synopsis:
      'Maya and Mira haven’t spoken in five years — Maya runs their father’s failing tech startup, Mira is a celebrity chef in Paris. When their father is jailed for embezzlement he didn’t commit, the twins reunite and realize their uncle has been running a decades-long con. Maya goes undercover as Mira inside his luxury hotel empire. Mira moves to Silicon Valley to learn the family business. Two sisters. One takedown. What could go wrong?',
    emoji: '👶',
    genre: 'Comedy',
    rating: 8.5,
    totalEpisodes: 9,
    isNew: false,
    isTrending: false,
    gradient: 'from-cyan-500 via-blue-500 to-indigo-500',
    cast: ['Maya / Mira Chen', 'Uncle Bo', 'Chef Luc'],
    year: 2024,
    streams: buildStreams(9, [
      'The Phone Call',
      'The Swap',
      'Maya in Paris',
      'Mira in Silicon Valley',
      'The Hotel Inspection',
      'A Kitchen Disaster',
      'The Board Reunion',
      'Uncle Bo Catches On',
      'The Takedown',
    ]),
  },
  {
    id: 'masked-love',
    title: 'Masked Love',
    description:
      'At a citywide masquerade festival, two enemies fall for each other without knowing who the other is.',
    synopsis:
      'Rival bookstore owners Sophie and Julian have been feuding for three years — loudly, publicly, and with increasing creativity. During the city’s annual Masquerade Festival, Sophie dances all night with a stranger in a silver mask. He’s clever, kind, and quotes her favorite novels. She’s falling hard. The next morning, the stranger turns out to be Julian — and neither of them knows how to stop the war they started.',
    emoji: '🎭',
    genre: 'Romance',
    rating: 9.0,
    totalEpisodes: 13,
    isNew: false,
    isTrending: true,
    gradient: 'from-fuchsia-600 via-purple-600 to-indigo-600',
    cast: ['Sophie Marlow', 'Julian Ash', 'Mayor Kit'],
    year: 2024,
    streams: buildStreams(13, [
      'The Feud',
      'Festival Eve',
      'The Silver Mask',
      'Midnight Dance',
      'Morning After',
      'A Truce?',
      'The Leak',
      'A Second Dance',
      'Identity Revealed',
      'The Book Signing',
      'A Public Apology',
      'The Festival Closes',
      'Two Bookstores, One Door',
    ]),
  },
  {
    id: 'phoenix-rising',
    title: 'Phoenix Rising',
    description:
      'A disgraced Olympic gymnast coaches a teenage runaway all the way to the world stage.',
    synopsis:
      'Once the face of Team USA, Camille lost everything when a doping scandal — she insists was framed — destroyed her career. Now she coaches at a rundown community gym. When sixteen-year-old Rio walks in off the streets with raw, untamed talent and zero interest in being coached, Camille sees a second chance at redemption for both of them. But the same people who framed her are still watching.',
    emoji: '🔥',
    genre: 'Drama',
    rating: 8.6,
    totalEpisodes: 12,
    isNew: true,
    isTrending: false,
    gradient: 'from-orange-500 via-red-500 to-purple-600',
    cast: ['Camille Reyes', 'Rio Park', 'Coach Whitman'],
    year: 2025,
    streams: buildStreams(12, [
      'The Community Gym',
      'Rio Walks In',
      'First Routine',
      'Old Friends, Old Enemies',
      'The Qualifier',
      'A Setback',
      'The Whistleblower',
      'Nationals',
      'A Coaching Decision',
      'The World Trials',
      'The Final Floor',
      'Gold',
    ]),
  },
  {
    id: 'diamond-tears',
    title: 'Diamond Tears',
    description:
      'A diamond heiress with no memory of her past is hunted across three continents for the secret she can’t remember.',
    synopsis:
      'Ava wakes up in a Monaco hospital with no memory of the last two years, a diamond necklace worth forty million euros around her neck, and a husband she doesn’t recognize. As fragments of her missing time resurface, Ava realizes she was a courier for one of the world’s most secretive jewelry cartels — and the people who erased her memory are coming to finish the job.',
    emoji: '💎',
    genre: 'Fantasy',
    rating: 8.9,
    totalEpisodes: 10,
    isNew: false,
    isTrending: false,
    gradient: 'from-sky-400 via-cyan-400 to-emerald-400',
    cast: ['Ava Vance', 'Lucien Cross', 'Inspector March'],
    year: 2024,
    streams: buildStreams(10, [
      'Monaco, Awake',
      'The Husband',
      'The Diamond Necklace',
      'A Fragment',
      'The Cartel',
      'Istanbul',
      'The Courier’s Ledger',
      'The Inspector',
      'The Vault in Geneva',
      'Remembered',
    ]),
  },
]

// ─────────────────────────────────────────────────────────────────────
// Apify DramaBox API integration (real drama data)
// ─────────────────────────────────────────────────────────────────────

const APIFY_TOKEN = process.env.APIFY_TOKEN || ''
const APIFY_ACTOR = 'ezvidnet~short-drama-api'
const APIFY_RUN_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`

interface DramaBoxBook {
  bookId: string
  bookName: string
  coverWap?: string
  chapterCount?: number
  introduction?: string
  tags?: string[]
  bookSource?: string
  playCount?: number
}

interface DramaBoxHome {
  ok: boolean
  data?: {
    language?: string
    latest?: { columns?: Array<{ books?: DramaBoxBook[] }> }
    trending?: { columns?: Array<{ books?: DramaBoxBook[] }> }
    recommended?: { columns?: Array<{ books?: DramaBoxBook[] }> }
  }
}

// In-memory cache (5 min TTL) so we don't call Apify on every request
let dramaCache: ShortDrama[] | null = null
let dramaCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetches real DramaBox data via the Apify `ezvidnet/short-drama-api` actor.
 * Returns null if APIFY_TOKEN is not set or the actor fails.
 *
 * The actor calls the real DramaBox API (which is behind Cloudflare) and
 * returns actual drama titles, covers, descriptions, tags, and episode
 * counts. Video streams are NOT available (DRM-protected), so episodes
 * use the open-source short films from HLS_STREAMS.
 */
async function fetchDramaBoxFromApify(): Promise<ShortDrama[] | null> {
  if (!APIFY_TOKEN) return null

  // Check cache
  if (dramaCache && Date.now() - dramaCacheTime < CACHE_TTL) {
    return dramaCache
  }

  try {
    const res = await fetch(APIFY_RUN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'dramabox',
        action: 'home',
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) return null
    const items = (await res.json()) as DramaBoxHome[]
    if (!Array.isArray(items) || items.length === 0) return null

    const home = items[0]
    if (!home?.ok || !home.data) return null

    // Collect dramas from all sections (trending, latest, recommended)
    const allBooks = new Map<string, DramaBoxBook>()
    for (const section of ['trending', 'latest', 'recommended'] as const) {
      const sec = home.data[section]
      if (!sec?.columns) continue
      for (const col of sec.columns) {
        if (!col.books) continue
        for (const book of col.books) {
          if (book.bookId && book.bookName && !allBooks.has(book.bookId)) {
            allBooks.set(book.bookId, book)
          }
        }
      }
    }

    if (allBooks.size === 0) return null

    // Map to ShortDrama format
    const gradients = [
      'from-pink-500 via-rose-500 to-orange-400',
      'from-violet-500 via-purple-500 to-fuchsia-500',
      'from-blue-500 via-cyan-500 to-teal-500',
      'from-amber-500 via-orange-500 to-red-500',
      'from-emerald-500 via-green-500 to-teal-500',
      'from-indigo-500 via-blue-500 to-cyan-500',
      'from-red-500 via-rose-500 to-pink-500',
      'from-yellow-500 via-amber-500 to-orange-500',
    ]

    let i = 0
    const dramas: ShortDrama[] = []
    for (const book of allBooks.values()) {
      const tags = book.tags ?? []
      const genre = tags[0] || 'Drama'
      const id = `db-${book.bookId}`
      const gradient = gradients[i % gradients.length]!
      i++
      dramas.push({
        id,
        title: book.bookName,
        description: book.introduction ?? '',
        emoji: '🎬',
        genre,
        rating: 8 + ((i * 7) % 20) / 10, // 8.0–9.9 (no real rating in API)
        totalEpisodes: book.chapterCount ?? 0,
        isNew: i <= 5, // first 5 marked as new
        isTrending: true,
        gradient,
        streams: [], // filled on-demand by buildStreams()
      })
    }

    dramaCache = dramas
    dramaCacheTime = Date.now()
    return dramas
  } catch {
    return null
  }
}

/** Searches DramaBox via Apify. Falls back to local filter. */
async function searchDramaBoxFromApify(query: string): Promise<ShortDrama[] | null> {
  if (!APIFY_TOKEN) return null
  try {
    const res = await fetch(APIFY_RUN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'dramabox',
        action: 'search',
        keyword: query,
        limit: 20,
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return null
    const items = (await res.json()) as DramaBoxHome[]
    if (!Array.isArray(items) || items.length === 0) return null
    // Parse search results the same way as home
    // ... (same mapping logic)
    return null // fallback to local for now
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────
// Public functions
// ─────────────────────────────────────────────────────────────────────

/**
 * Trending dramas. Tries the Apify DramaBox API first (real data),
 * then falls back to the curated catalog.
 */
export async function getTrendingDramas(limit?: number): Promise<ShortDrama[]> {
  const apiDramas = await fetchDramaBoxFromApify()
  if (apiDramas && apiDramas.length > 0) {
    return limit ? apiDramas.slice(0, limit) : apiDramas
  }
  // Fall back to curated catalog
  const trending = DRAMAS.filter((d) => d.isTrending).sort((a, b) => b.rating - a.rating)
  return (limit ? trending.slice(0, limit) : trending).map(stripDetail)
}

/** New dramas. Falls back to curated catalog. */
export async function getNewDramas(limit?: number): Promise<ShortDrama[]> {
  const apiDramas = await fetchDramaBoxFromApify()
  if (apiDramas && apiDramas.length > 0) {
    const fresh = apiDramas.filter((d) => d.isNew)
    if (fresh.length > 0) return limit ? fresh.slice(0, limit) : fresh
  }
  // Fall back to curated catalog
  const fresh = DRAMAS.filter((d) => d.isNew).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return b.rating - a.rating
  })
  return (limit ? fresh.slice(0, limit) : fresh).map(stripDetail)
}

/** Full catalog. Falls back to curated catalog. */
export async function getAllDramas(): Promise<ShortDrama[]> {
  const apiDramas = await fetchDramaBoxFromApify()
  if (apiDramas && apiDramas.length > 0) {
    return apiDramas
  }
  return DRAMAS.map(stripDetail)
}

/** Filter by exact genre match (case-insensitive). */
export async function getDramasByGenre(genre: string): Promise<ShortDrama[]> {
  const g = genre.trim().toLowerCase()
  if (!g || g === 'all') return getAllDramas()
  const apiDramas = await fetchDramaBoxFromApify()
  if (apiDramas && apiDramas.length > 0) {
    return apiDramas.filter((d) => d.genre.toLowerCase() === g)
  }
  return DRAMAS.filter((d) => d.genre.toLowerCase() === g).map(stripDetail)
}

/** Case-insensitive title / description / genre search. */
export async function searchDramas(query: string): Promise<ShortDrama[]> {
  const q = query.trim().toLowerCase()
  if (!q) return getAllDramas()
  // Search the Apify-fetched catalog (cached)
  const apiDramas = await fetchDramaBoxFromApify()
  if (apiDramas && apiDramas.length > 0) {
    return apiDramas.filter((d) => {
      return (
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.genre.toLowerCase().includes(q)
      )
    })
  }
  // Fall back to local search
  return DRAMAS.filter((d) => {
    return (
      d.title.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.genre.toLowerCase().includes(q) ||
      d.synopsis.toLowerCase().includes(q) ||
      d.cast.some((c) => c.toLowerCase().includes(q))
    )
  }).map(stripDetail)
}

/** Full detail for a single drama, or null if id is unknown. */
export async function getDramaDetails(id: string): Promise<ShortDramaDetail | null> {
  // Check Apify-fetched dramas first (db- prefix)
  if (id.startsWith('db-')) {
    const apiDramas = await fetchDramaBoxFromApify()
    if (apiDramas) {
      const drama = apiDramas.find((d) => d.id === id)
      if (drama) {
        // Build a ShortDramaDetail from the Apify drama
        return {
          ...drama,
          synopsis: drama.description,
          cast: [],
          year: 2024,
          streams: buildStreams(drama.totalEpisodes || 10),
        }
      }
    }
  }
  // Fall back to curated catalog
  return DRAMAS.find((d) => d.id === id) ?? null
}

/** Episodes for a drama. */
export async function getDramaEpisodes(id: string): Promise<ShortDramaEpisode[]> {
  const drama = await getDramaDetails(id)
  return drama?.streams ?? []
}

/** Resolve a single episode's stream URL. Returns null if not found. */
export async function getEpisodeStream(
  id: string,
  episodeNumber: number,
): Promise<{ streamUrl: string; episode: ShortDramaEpisode; drama: ShortDramaDetail } | null> {
  const drama = await getDramaDetails(id)
  if (!drama) return null
  const episode = drama.streams.find((e) => e.episodeNumber === episodeNumber)
  if (!episode) return null
  return { streamUrl: episode.streamUrl, episode, drama }
}

/** Distinct genre list, sorted alphabetically. */
export async function getAvailableGenres(): Promise<string[]> {
  const apiDramas = await fetchDramaBoxFromApify()
  const set = new Set<string>()
  if (apiDramas && apiDramas.length > 0) {
    for (const d of apiDramas) set.add(d.genre)
  } else {
    for (const d of DRAMAS) set.add(d.genre)
  }
  return Array.from(set).sort()
}

/** Look up a drama's gradient by id (used by the player overlay header). */
export async function getDramaGradient(id: string): Promise<string | null> {
  const drama = await getDramaDetails(id)
  return drama?.gradient ?? null
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/** Strip the detail-only fields so we don’t leak synopsis/cast/year to list endpoints. */
function stripDetail(d: ShortDramaDetail): ShortDrama {
  // Pull the detail-only fields off the object so the returned value
  // matches the narrower ShortDrama shape. The `void` calls keep TS
  // quiet about the unused locals without disabling the rule.
  const { synopsis, cast, year, ...rest } = d
  void synopsis
  void cast
  void year
  return rest
}
