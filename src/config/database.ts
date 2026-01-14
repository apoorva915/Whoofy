import { PrismaClient } from '@prisma/client';
import logger from '@/utils/logger';

/**
 * Prisma Client Singleton
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error({ error }, '❌ Database connection failed');
    throw error;
  }
}/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('✅ Database disconnected');
  } catch (error) {
    logger.error({ error }, '❌ Database disconnection failed');
    throw error;
  }
}/**
 * Health check for database
 */
export async function checkDatabaseHealth(): Promise<'up' | 'down'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'up';
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return 'down';
  }
}export default prisma;
