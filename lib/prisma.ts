// Singleton Prisma Client — cached on globalThis to survive hot-reloads in dev
// AND to prevent new connections being opened on every serverless invocation in prod.
// Without this, each Vercel function call opens a fresh PrismaClient which exhausts
// Supabase's connection pool under real traffic.
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Cache in all environments — critical for serverless production deployments.
globalForPrisma.prisma = prisma;
