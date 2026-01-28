#!/usr/bin/env tsx
/**
 * Test database connection script
 * Helps diagnose connection issues
 */

import { PrismaClient } from '@prisma/client';
import logger from '../src/utils/logger';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function testConnection() {
  try {
    logger.info('Testing database connection...');
    logger.info(`DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);

    // Try to connect
    await prisma.$connect();
    logger.info('✅ Successfully connected to database');

    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    logger.info('✅ Database query successful', { result });

    // Check if schemas exist
    const schemas = await prisma.$queryRaw<Array<{ schema_name: string }>>`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('public', 'aimodule')
    `;
    logger.info('Available schemas:', { schemas: schemas.map(s => s.schema_name) });

    if (!schemas.find(s => s.schema_name === 'aimodule')) {
      logger.warn('⚠️  aimodule schema not found. Run: npm run db:setup-supabase');
    }

    logger.info('✅ Database connection test passed');
  } catch (error: any) {
    logger.error({ error: error.message, code: error.code }, '❌ Database connection failed');

    if (error.code === 'P1000') {
      logger.error('Authentication failed. Check your DATABASE_URL password.');
      logger.info('To get your Supabase password:');
      logger.info('1. Go to Supabase Dashboard → Settings → Database');
      logger.info('2. Find "Database password" section');
      logger.info('3. Copy the password and update DATABASE_URL in .env');
    } else if (error.code === 'P1001') {
      logger.error('Cannot reach database server. Check:');
      logger.info('1. Is the DATABASE_URL correct?');
      logger.info('2. Is your internet connection working?');
      logger.info('3. Are there any firewall restrictions?');
    } else if (error.code === 'P1003') {
      logger.error('Database does not exist. Check the database name in DATABASE_URL');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
