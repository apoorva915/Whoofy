-- Fix aimodule.view_tracking_jobs: ensure exact schema (no extra NOT NULL columns)
-- Run in your DB client (Supabase SQL editor, psql, etc.)
-- WARNING: This drops and recreates the table. Existing view_tracking_jobs rows are cleared.
-- Status for "is this reel being tracked?" will reset; users can Start Tracking again.

DROP TABLE IF EXISTS aimodule.view_tracking_jobs;

CREATE TABLE aimodule.view_tracking_jobs (
    id uuid NOT NULL,
    "reelUrl" text NOT NULL DEFAULT '',
    status text NOT NULL,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "view_tracking_jobs_pkey" PRIMARY KEY (id)
);

-- Optional: index for status lookups
CREATE INDEX IF NOT EXISTS view_tracking_jobs_status_idx ON aimodule.view_tracking_jobs(status);
CREATE INDEX IF NOT EXISTS view_tracking_jobs_reel_url_idx ON aimodule.view_tracking_jobs("reelUrl");
