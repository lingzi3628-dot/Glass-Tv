import { PrismaClient } from '@prisma/client'
import { FALLBACK_DATABASE_URL } from '@/lib/config'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['query'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL || FALLBACK_DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
