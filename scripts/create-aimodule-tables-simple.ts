#!/usr/bin/env tsx
/**
 * Create aimodule tables script - Simple version
 * Executes SQL statements one by one with proper error handling
 */

import { PrismaClient } from '@prisma/client';
import logger from '../src/utils/logger';

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type PgTableRow = {
  tablename: string;
};

/* ------------------------------------------------------------------ */
/* Script */
/* ------------------------------------------------------------------ */

async function createAimoduleTables() {
  try {
    logger.info('Creating aimodule schema tables...');

    /* -------------------- TABLES -------------------- */
    const statements: string[] = [
      `CREATE TABLE IF NOT EXISTS aimodule.video_analyses (
        id TEXT PRIMARY KEY,
        "reelUrl" TEXT NOT NULL,
        "reelId" TEXT,
        "videoId" TEXT,
        duration DOUBLE PRECISION,
        "frameCount" INTEGER NOT NULL DEFAULT 0,
        "analysisType" TEXT NOT NULL DEFAULT 'local',
        status TEXT NOT NULL DEFAULT 'processing',
        "errorMessage" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS aimodule.frame_analyses (
        id TEXT PRIMARY KEY,
        "videoAnalysisId" TEXT NOT NULL,
        timestamp DOUBLE PRECISION NOT NULL,
        "framePath" TEXT,
        objects JSONB NOT NULL DEFAULT '[]',
        labels JSONB NOT NULL DEFAULT '[]',
        text TEXT,
        "textDetections" JSONB NOT NULL DEFAULT '[]',
        logos JSONB NOT NULL DEFAULT '[]',
        brands JSONB NOT NULL DEFAULT '[]',
        people JSONB NOT NULL DEFAULT '[]',
        "visualSimilarity" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT frame_analyses_videoAnalysisId_fkey
          FOREIGN KEY ("videoAnalysisId")
          REFERENCES aimodule.video_analyses(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS aimodule.video_analysis_summaries (
        id TEXT PRIMARY KEY,
        "videoAnalysisId" TEXT NOT NULL UNIQUE,
        "uniqueObjects" JSONB NOT NULL DEFAULT '[]',
        "brandsDetected" JSONB NOT NULL DEFAULT '[]',
        "targetBrandConfirmation" JSONB NOT NULL,
        "visualSentiment" JSONB NOT NULL,
        "visualSimilaritySummary" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT video_analysis_summaries_videoAnalysisId_fkey
          FOREIGN KEY ("videoAnalysisId")
          REFERENCES aimodule.video_analyses(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS aimodule.sentiment_analyses (
        id TEXT PRIMARY KEY,
        "reelUrl" TEXT NOT NULL,
        "reelId" TEXT,
        "captionSentiment" JSONB NOT NULL,
        "transcriptSentiment" JSONB NOT NULL,
        "isPositivePublicity" BOOLEAN NOT NULL,
        "overallReasoning" TEXT NOT NULL,
        "processingTimeMs" INTEGER NOT NULL,
        "analysisProvider" TEXT NOT NULL DEFAULT 'gemini',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS aimodule.language_region_analyses (
        id TEXT PRIMARY KEY,
        "reelUrl" TEXT NOT NULL,
        "reelId" TEXT,
        languages JSONB NOT NULL DEFAULT '[]',
        "primaryLanguage" TEXT,
        regions JSONB NOT NULL DEFAULT '[]',
        "primaryRegion" TEXT,
        "analysisProvider" TEXT NOT NULL DEFAULT 'gemini',
        "processingTimeMs" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS aimodule.comment_analyses (
        id TEXT PRIMARY KEY,
        "reelUrl" TEXT NOT NULL,
        "reelId" TEXT,
        "totalComments" INTEGER NOT NULL DEFAULT 0,
        comments JSONB NOT NULL DEFAULT '[]',
        "engagementRate" DOUBLE PRECISION,
        "averageLikes" DOUBLE PRECISION,
        "averageReplies" DOUBLE PRECISION,
        "positiveComments" INTEGER NOT NULL DEFAULT 0,
        "negativeComments" INTEGER NOT NULL DEFAULT 0,
        "neutralComments" INTEGER NOT NULL DEFAULT 0,
        "brandMentions" JSONB NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    /* -------------------- INDEXES -------------------- */
    const indexes: string[] = [
      `CREATE INDEX IF NOT EXISTS video_analyses_reelUrl_idx ON aimodule.video_analyses("reelUrl")`,
      `CREATE INDEX IF NOT EXISTS video_analyses_reelId_idx ON aimodule.video_analyses("reelId")`,
      `CREATE INDEX IF NOT EXISTS video_analyses_status_idx ON aimodule.video_analyses(status)`,
      `CREATE INDEX IF NOT EXISTS video_analyses_createdAt_idx ON aimodule.video_analyses("createdAt")`,
      `CREATE INDEX IF NOT EXISTS frame_analyses_videoAnalysisId_idx ON aimodule.frame_analyses("videoAnalysisId")`,
      `CREATE INDEX IF NOT EXISTS frame_analyses_timestamp_idx ON aimodule.frame_analyses(timestamp)`,
      `CREATE INDEX IF NOT EXISTS sentiment_analyses_reelUrl_idx ON aimodule.sentiment_analyses("reelUrl")`,
      `CREATE INDEX IF NOT EXISTS sentiment_analyses_reelId_idx ON aimodule.sentiment_analyses("reelId")`,
      `CREATE INDEX IF NOT EXISTS sentiment_analyses_createdAt_idx ON aimodule.sentiment_analyses("createdAt")`,
      `CREATE INDEX IF NOT EXISTS language_region_analyses_reelUrl_idx ON aimodule.language_region_analyses("reelUrl")`,
      `CREATE INDEX IF NOT EXISTS language_region_analyses_reelId_idx ON aimodule.language_region_analyses("reelId")`,
      `CREATE INDEX IF NOT EXISTS language_region_analyses_primaryLanguage_idx ON aimodule.language_region_analyses("primaryLanguage")`,
      `CREATE INDEX IF NOT EXISTS language_region_analyses_primaryRegion_idx ON aimodule.language_region_analyses("primaryRegion")`,
      `CREATE INDEX IF NOT EXISTS comment_analyses_reelUrl_idx ON aimodule.comment_analyses("reelUrl")`,
      `CREATE INDEX IF NOT EXISTS comment_analyses_reelId_idx ON aimodule.comment_analyses("reelId")`,
      `CREATE INDEX IF NOT EXISTS comment_analyses_createdAt_idx ON aimodule.comment_analyses("createdAt")`,
    ];

    /* -------------------- GRANTS -------------------- */
    const grants: string[] = [
      `GRANT ALL ON ALL TABLES IN SCHEMA aimodule TO postgres, service_role`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aimodule TO authenticated`,
      `GRANT SELECT ON ALL TABLES IN SCHEMA aimodule TO anon`,
    ];

    logger.info(
      `Executing ${statements.length} tables, ${indexes.length} indexes, ${grants.length} grants`
    );

    /* -------------------- EXECUTION -------------------- */
    for (const sql of statements) {
      await prisma.$executeRawUnsafe(sql);
    }

    for (const sql of indexes) {
      await prisma.$executeRawUnsafe(sql);
    }

    for (const sql of grants) {
      await prisma.$executeRawUnsafe(sql);
    }

    /* -------------------- VERIFY -------------------- */
    const tables = await prisma.$queryRaw<PgTableRow[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'aimodule'
      ORDER BY tablename
    `;

    logger.info(
      `Created tables: ${tables.map((t: PgTableRow) => t.tablename).join(', ')}`
    );

    logger.info('✅ aimodule tables created successfully');
  } catch (error: any) {
    logger.error(
      {
        message: error.message,
        code: error.code,
        meta: error.meta,
      },
      'Failed to create aimodule tables'
    );
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Entry */
/* ------------------------------------------------------------------ */

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
