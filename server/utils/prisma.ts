import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = global as unknown as { prisma: PrismaClient; pool: pg.Pool }

if (!globalForPrisma.pool) {
  globalForPrisma.pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8, // Conservative for Supabase free tier
    idleTimeoutMillis: 45000, // 45s - increased from 30s to reduce connection churn
    connectionTimeoutMillis: 25000, // 25s - increased from 10s for Railway container latency
    allowExitOnIdle: false, // Prevent premature pool exit
  })
}

const adapter = new PrismaPg(globalForPrisma.pool)

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma
export default prisma
