/**
 * Seed the GlassTV database with a curated set of sample channels.
 * Run with: `bun run scripts/seed.ts` (also wired as `bun run db:seed`).
 *
 * Channels cover every genre surfaced in the onboarding flow so the
 * AI recommendation engine always has something to match against.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

interface SeedChannel {
  id: string
  name: string
  category: string
  language: string
  country: string
  isVerified: boolean
  logoEmoji: string
  description: string
  // Optional real HLS stream URL. When set, the channel can actually play in the
  // preview popup / player overlay. Uses well-known public test streams.
  streamUrl?: string
}

// Public HLS test streams that actually play video in a browser.
// (Big Buck Bunny, Sintel, Tears of Steel, Mux test patterns, etc.)
const HLS_TEST_STREAMS = {
  bigBuckBunny: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  tearsOfSteel: 'https://test-streams.mux.dev/test_001/stream.m3u8',
  sintel: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
  muxPattern: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
}

const CHANNELS: SeedChannel[] = [
  // Sports
  { id: 'ch-sports-1', name: 'Global Sports Network', category: 'sports', language: 'en', country: 'US', isVerified: true, logoEmoji: '🏆', description: 'Live matches, highlights & analysis from around the world.', streamUrl: HLS_TEST_STREAMS.bigBuckBunny },
  { id: 'ch-sports-2', name: 'Premier Football HD', category: 'sports', language: 'en', country: 'UK', isVerified: true, logoEmoji: '⚽', description: 'Top-tier football coverage 24/7.' },
  { id: 'ch-sports-3', name: 'Court & Field', category: 'sports', language: 'en', country: 'AU', isVerified: false, logoEmoji: '🎾', description: 'Tennis, basketball & athletics.' },
  { id: 'ch-sports-4', name: 'Extreme Sports TV', category: 'sports', language: 'es', country: 'BR', isVerified: true, logoEmoji: '🛹', description: 'Surf, skate, snow & everything radical.' },

  // News
  { id: 'ch-news-1', name: 'World News 24', category: 'news', language: 'en', country: 'US', isVerified: true, logoEmoji: '🌍', description: 'Breaking news from every continent.', streamUrl: HLS_TEST_STREAMS.tearsOfSteel },
  { id: 'ch-news-2', name: 'Business Daily', category: 'news', language: 'en', country: 'US', isVerified: true, logoEmoji: '📈', description: 'Markets, finance & economy.' },
  { id: 'ch-news-3', name: 'Noticias Latina', category: 'news', language: 'es', country: 'MX', isVerified: true, logoEmoji: '🌎', description: 'Latin America news in Spanish.' },
  { id: 'ch-news-4', name: 'Le Monde Info', category: 'news', language: 'fr', country: 'FR', isVerified: false, logoEmoji: '📰', description: 'Actualités françaises et européennes.' },

  // Movies
  { id: 'ch-movies-1', name: 'Cinema Classics', category: 'movies', language: 'en', country: 'US', isVerified: true, logoEmoji: '🎬', description: 'Golden-age Hollywood, restored.', streamUrl: HLS_TEST_STREAMS.sintel },
  { id: 'ch-movies-2', name: 'Action Movie Hub', category: 'movies', language: 'en', country: 'US', isVerified: true, logoEmoji: '💥', description: 'Blockbusters, all day.' },
  { id: 'ch-movies-3', name: 'Bollywood Stars', category: 'movies', language: 'hi', country: 'IN', isVerified: true, logoEmoji: '🌟', description: 'The biggest Hindi cinema hits.' },
  { id: 'ch-movies-4', name: 'Europa Cinema', category: 'movies', language: 'fr', country: 'FR', isVerified: false, logoEmoji: '🎞️', description: 'European arthouse & festival picks.' },

  // Documentaries
  { id: 'ch-doc-1', name: 'Nature Wild', category: 'documentaries', language: 'en', country: 'US', isVerified: true, logoEmoji: '🦁', description: 'Wildlife from every biome.', streamUrl: HLS_TEST_STREAMS.tearsOfSteel },
  { id: 'ch-doc-2', name: 'Deep Space Docs', category: 'documentaries', language: 'en', country: 'US', isVerified: true, logoEmoji: '🪐', description: 'Cosmos, missions & astrophysics.' },
  { id: 'ch-doc-3', name: 'History Uncovered', category: 'documentaries', language: 'en', country: 'UK', isVerified: true, logoEmoji: '🏺', description: 'From ancient empires to modern times.' },
  { id: 'ch-doc-4', name: 'Planeta Verde', category: 'documentaries', language: 'es', country: 'ES', isVerified: false, logoEmoji: '🌱', description: 'Sustainability & our planet.' },

  // Kids
  { id: 'ch-kids-1', name: 'Kids Cartoon Plus', category: 'kids', language: 'en', country: 'US', isVerified: true, logoEmoji: '🧸', description: 'Safe, fun cartoons for little ones.', streamUrl: HLS_TEST_STREAMS.bigBuckBunny },
  { id: 'ch-kids-2', name: 'Educational Junior', category: 'kids', language: 'en', country: 'US', isVerified: true, logoEmoji: '📚', description: 'Learning through play, ages 4-10.' },
  { id: 'ch-kids-3', name: 'Anime Kids', category: 'kids', language: 'en', country: 'JP', isVerified: true, logoEmoji: '🎴', description: 'Family-friendly anime & manga.' },
  { id: 'ch-kids-4', name: 'Petit Explorer', category: 'kids', language: 'fr', country: 'FR', isVerified: false, logoEmoji: '🚂', description: 'Aventures pour les petits.' },

  // Music
  { id: 'ch-music-1', name: 'MTV-style Hits', category: 'music', language: 'en', country: 'US', isVerified: true, logoEmoji: '🎵', description: "Today's biggest pop hits.", streamUrl: HLS_TEST_STREAMS.muxPattern },
  { id: 'ch-music-2', name: 'Classical FM TV', category: 'music', language: 'en', country: 'DE', isVerified: true, logoEmoji: '🎻', description: 'Symphonies & chamber music.' },
  { id: 'ch-music-3', name: 'Latin Beats', category: 'music', language: 'es', country: 'CO', isVerified: true, logoEmoji: '🎶', description: 'Reggaeton, salsa & bachata.' },
  { id: 'ch-music-4', name: 'Indie Lounge', category: 'music', language: 'en', country: 'US', isVerified: false, logoEmoji: '🎸', description: 'Indie, alternative & lo-fi.' },

  // Lifestyle
  { id: 'ch-life-1', name: 'Food Network Plus', category: 'lifestyle', language: 'en', country: 'US', isVerified: true, logoEmoji: '🍳', description: 'Recipes, chefs & culinary travel.' },
  { id: 'ch-life-2', name: 'Home & Garden TV', category: 'lifestyle', language: 'en', country: 'US', isVerified: true, logoEmoji: '🪴', description: 'Renovation, decor & gardening.' },
  { id: 'ch-life-3', name: 'Travel Escapes', category: 'lifestyle', language: 'en', country: 'UK', isVerified: true, logoEmoji: '✈️', description: 'Destinations & travel guides.' },
  { id: 'ch-life-4', name: 'Wellness Daily', category: 'lifestyle', language: 'en', country: 'US', isVerified: false, logoEmoji: '🧘', description: 'Yoga, mindfulness & health.' },

  // International
  { id: 'ch-intl-1', name: 'Africa Today', category: 'international', language: 'en', country: 'KE', isVerified: true, logoEmoji: '🌍', description: 'Pan-African news & culture.' },
  { id: 'ch-intl-2', name: 'Asia Pulse', category: 'international', language: 'en', country: 'SG', isVerified: true, logoEmoji: '🌏', description: 'Business & culture across Asia.' },
  { id: 'ch-intl-3', name: 'Deutsche Welle', category: 'international', language: 'de', country: 'DE', isVerified: true, logoEmoji: '🇩🇪', description: 'German international broadcaster.' },
  { id: 'ch-intl-4', name: 'TV5 Monde', category: 'international', language: 'fr', country: 'FR', isVerified: true, logoEmoji: '🇫🇷', description: 'French-language global channel.' },
  { id: 'ch-intl-5', name: 'NHK World', category: 'international', language: 'en', country: 'JP', isVerified: true, logoEmoji: '🇯🇵', description: "Japan's national broadcaster, in English." },
  { id: 'ch-intl-6', name: 'Al Jazeera Eng', category: 'international', language: 'en', country: 'QA', isVerified: true, logoEmoji: '🌐', description: 'Global news from a Middle-East perspective.' },
]

async function main() {
  console.log('🌱 Seeding GlassTV channels...')

  for (const c of CHANNELS) {
    const streamUrl = c.streamUrl || `https://stream.glasstv.example/${c.id}/playlist.m3u8`
    await db.channel.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        category: c.category,
        language: c.language,
        country: c.country,
        isVerified: c.isVerified,
        logoUrl: `emoji:${c.logoEmoji}`,
        streamUrl,
      },
      update: {
        name: c.name,
        category: c.category,
        language: c.language,
        country: c.country,
        isVerified: c.isVerified,
        logoUrl: `emoji:${c.logoEmoji}`,
        streamUrl,
      },
    })
  }

  console.log(`✅ Seeded ${CHANNELS.length} channels.`)
  const count = await db.channel.count()
  console.log(`📊 Total channels in DB: ${count}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
