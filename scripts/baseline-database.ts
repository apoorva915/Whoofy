#!/usr/bin/env tsx
/**
 * Baseline database script
 * Creates a migration that represents the current state without resetting
 */

import { PrismaClient } from '@prisma/client';
import logger from '../src/utils/logger';

const prisma = new PrismaClient();

async function createBaselineMigration() {
  try {
    logger.info('Creating baseline migration...');
    logger.info('This will create a migration that represents the current database state');
    logger.info('without resetting or dropping any existing tables.');
    
    // The user should run: npx prisma migrate dev --create-only --name baseline
    // Then manually edit the migration to only include aimodule schema creation
    
    logger.info('');
    logger.info('📋 Next steps:');
    logger.info('1. Run: npx prisma migrate dev --create-only --name baseline');
    logger.info('2. Edit the generated migration file to ONLY include aimodule schema tables');
    logger.info('3. Mark existing migrations as applied: npx prisma migrate resolve --applied <migration-name>');
    logger.info('4. Or use: npx prisma migrate resolve --applied 20250722141600_add_all_models (and others)');
    
  } catch (error: any) {
    logger.error({ error }, 'Failed to create baseline');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createBaselineMigration();
