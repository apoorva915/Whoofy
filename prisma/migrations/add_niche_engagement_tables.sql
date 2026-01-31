-- Add missing tables for niche_analyses and engagement_analyses
-- Run this migration after running create_aimodule_tables.sql

-- Niche Analysis Table
CREATE TABLE IF NOT EXISTS aimodule.niche_analyses (
    id TEXT PRIMARY KEY,
    "reelUrl" TEXT,
    "reelId" TEXT,
    "creatorUsername" TEXT,
    niches JSONB NOT NULL DEFAULT '[]',
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    reasoning TEXT NOT NULL,
    "processingTimeMs" INTEGER NOT NULL,
    "analysisProvider" TEXT NOT NULL DEFAULT 'gemini',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS niche_analyses_reelUrl_idx ON aimodule.niche_analyses("reelUrl");
CREATE INDEX IF NOT EXISTS niche_analyses_reelId_idx ON aimodule.niche_analyses("reelId");
CREATE INDEX IF NOT EXISTS niche_analyses_creatorUsername_idx ON aimodule.niche_analyses("creatorUsername");
CREATE INDEX IF NOT EXISTS niche_analyses_createdAt_idx ON aimodule.niche_analyses("createdAt");

-- Engagement Analysis Table
CREATE TABLE IF NOT EXISTS aimodule.engagement_analyses (
    id TEXT PRIMARY KEY,
    "reelUrl" TEXT NOT NULL,
    "reelId" TEXT,
    "overallAuthentic" BOOLEAN NOT NULL DEFAULT true,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "overallIssues" JSONB NOT NULL DEFAULT '[]',
    "commentAnalysis" JSONB NOT NULL DEFAULT '{}',
    "engagementAnalysis" JSONB NOT NULL DEFAULT '{}',
    "promotionTimestamp" TIMESTAMP(3),
    "processingTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS engagement_analyses_reelUrl_idx ON aimodule.engagement_analyses("reelUrl");
CREATE INDEX IF NOT EXISTS engagement_analyses_reelId_idx ON aimodule.engagement_analyses("reelId");
CREATE INDEX IF NOT EXISTS engagement_analyses_overallAuthentic_idx ON aimodule.engagement_analyses("overallAuthentic");
CREATE INDEX IF NOT EXISTS engagement_analyses_createdAt_idx ON aimodule.engagement_analyses("createdAt");

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA aimodule TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aimodule TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA aimodule TO anon;
