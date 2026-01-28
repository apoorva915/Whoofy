#!/usr/bin/env tsx
/**
 * Setup script for Supabase integration
 * Creates the aimodule schema and sets up necessary permissions
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../src/utils/logger';

const prisma = new PrismaClient();

async function setupAimoduleSchema() {
  try {
    logger.info('Setting up aimodule schema...');

    // Define SQL statements to execute (one at a time)
    const statements = [
      'CREATE SCHEMA IF NOT EXISTS aimodule',
      'GRANT USAGE ON SCHEMA aimodule TO postgres, anon, authenticated, service_role',
      'GRANT ALL ON ALL TABLES IN SCHEMA aimodule TO postgres, service_role',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aimodule TO authenticated',
      'GRANT SELECT ON ALL TABLES IN SCHEMA aimodule TO anon',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA aimodule GRANT ALL ON TABLES TO postgres, service_role',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA aimodule GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA aimodule GRANT SELECT ON TABLES TO anon',
    ];

    logger.info(`Executing ${statements.length} SQL statements...`);

    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await prisma.$executeRawUnsafe(statement);
        logger.debug(`✅ Executed statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
      } catch (error: any) {
        // Ignore "already exists" or "does not exist" errors for some statements
        const errorMessage = error.message || '';
        const errorCode = error.code || '';
        
        if (
          errorMessage.includes('already exists') ||
          errorCode === '42P07' ||
          errorMessage.includes('does not exist') ||
          errorCode === '42P01'
        ) {
          logger.debug(`ℹ️  Statement ${i + 1} skipped (already applied or not applicable)`);
          continue;
        }
        
        // For permission errors, log but continue (might be expected in some setups)
        if (errorCode === '42501' || errorMessage.includes('permission denied')) {
          logger.warn(`⚠️  Permission warning for statement ${i + 1}: ${errorMessage}`);
          continue;
        }
        
        throw error;
      }
    }

    logger.info('✅ aimodule schema setup completed successfully');
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      code: error.code,
      meta: error.meta 
    }, 'Failed to create aimodule schema');
    throw error;
  }
}

async function main() {
  try {
    await prisma.$connect();
    logger.info('Connected to database');

    await setupAimoduleSchema();

    logger.info('✅ Supabase setup completed successfully');
  } catch (error) {
    logger.error({ error }, 'Setup failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
