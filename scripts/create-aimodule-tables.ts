#!/usr/bin/env tsx
/**
 * Create aimodule tables script
 * Creates only the aimodule schema tables without affecting existing tables
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../src/utils/logger';

const prisma = new PrismaClient();

async function createAimoduleTables() {
  try {
    logger.info('Creating aimodule schema tables...');

    // Read the SQL file
    const sqlPath = join(__dirname, '../prisma/migrations/create_aimodule_tables.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Split SQL into individual statements, handling multi-line statements
    // Remove comments first
    const cleanedSql = sql
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        return commentIndex >= 0 ? line.substring(0, commentIndex).trim() : line.trim();
      })
      .filter(line => line.length > 0)
      .join('\n');
    
    // Split by semicolon, but keep statements that span multiple lines
    const statements = cleanedSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.toLowerCase().startsWith('--'));

    logger.info(`Executing ${statements.length} SQL statements...`);

    // Execute each statement separately
    // Group statements: CREATE TABLE first, then CREATE INDEX, then GRANT
    const createTableStatements: string[] = [];
    const createIndexStatements: string[] = [];
    const grantStatements: string[] = [];
    
    statements.forEach(stmt => {
      const upperStmt = stmt.toUpperCase();
      if (upperStmt.startsWith('CREATE TABLE')) {
        createTableStatements.push(stmt);
      } else if (upperStmt.startsWith('CREATE INDEX')) {
        createIndexStatements.push(stmt);
      } else if (upperStmt.startsWith('GRANT')) {
        grantStatements.push(stmt);
      } else {
        // Other statements (like ALTER TABLE, etc.)
        createTableStatements.push(stmt);
      }
    });
    
    // Execute in order: tables first, then indexes, then grants
    const orderedStatements = [...createTableStatements, ...createIndexStatements, ...grantStatements];
    
    logger.info(`Executing ${orderedStatements.length} SQL statements (${createTableStatements.length} tables, ${createIndexStatements.length} indexes, ${grantStatements.length} grants)...`);
    
    for (let i = 0; i < orderedStatements.length; i++) {
      const statement = orderedStatements[i];
      try {
        // Ensure statement ends with semicolon for proper execution
        const sqlStatement = statement.trim();
        if (!sqlStatement.endsWith(';')) {
          await prisma.$executeRawUnsafe(sqlStatement + ';');
        } else {
          await prisma.$executeRawUnsafe(sqlStatement);
        }
        
        if ((i + 1) % 3 === 0 || i === orderedStatements.length - 1) {
          const stmtType = i < createTableStatements.length ? 'table' : 
                          i < createTableStatements.length + createIndexStatements.length ? 'index' : 'grant';
          logger.debug(`Progress: ${i + 1}/${orderedStatements.length} statements executed (${stmtType})`);
        }
      } catch (error: any) {
        // Ignore "already exists" errors
        const errorMsg = error.message || '';
        const errorCode = error.code || '';
        
        if (
          errorMsg.includes('already exists') ||
          errorCode === '42P07' ||
          errorMsg.includes('duplicate') ||
          (errorMsg.includes('relation') && errorMsg.includes('already exists'))
        ) {
          logger.debug(`Statement ${i + 1} already applied, skipping...`);
          continue;
        }
        // Log the statement that failed for debugging
        logger.error({ 
          statement: statement.substring(0, 150).replace(/\s+/g, ' '),
          error: errorMsg,
          code: errorCode 
        }, `Failed to execute statement ${i + 1}`);
        throw error;
      }
    }

    logger.info('✅ aimodule tables created successfully');
    
    // Verify tables were created
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'aimodule'
      ORDER BY tablename
    `;
    
    logger.info(`Created tables: ${tables.map(t => t.tablename).join(', ')}`);
    
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      code: error.code,
      meta: error.meta 
    }, 'Failed to create aimodule tables');
    throw error;
  }
}

async function main() {
  try {
    await prisma.$connect();
    logger.info('Connected to database');

    await createAimoduleTables();

    logger.info('✅ Aimodule tables setup completed successfully');
  } catch (error) {
    logger.error({ error }, 'Setup failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
