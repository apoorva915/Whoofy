-- Update view_tracking_snapshots table to add reelUrl and engagementRatio fields
-- Run this migration to add the new fields

-- Add reelUrl column
ALTER TABLE aimodule.view_tracking_snapshots 
    ADD COLUMN IF NOT EXISTS "reelUrl" TEXT;

-- Add engagementRatio column
ALTER TABLE aimodule.view_tracking_snapshots 
    ADD COLUMN IF NOT EXISTS "engagementRatio" DOUBLE PRECISION;

-- Add engagementLabel column
ALTER TABLE aimodule.view_tracking_snapshots 
    ADD COLUMN IF NOT EXISTS "engagementLabel" TEXT;

-- Create index on reelUrl
CREATE INDEX IF NOT EXISTS "view_tracking_snapshots_reelUrl_idx" 
    ON aimodule.view_tracking_snapshots("reelUrl");

-- Create index on isSpikeDetected for faster queries
CREATE INDEX IF NOT EXISTS "view_tracking_snapshots_isSpikeDetected_idx" 
    ON aimodule.view_tracking_snapshots("isSpikeDetected");

-- Update existing records: populate reelUrl from reel_submissions table
UPDATE aimodule.view_tracking_snapshots vts
SET "reelUrl" = rs."reelUrl"
FROM public.reel_submissions rs
WHERE vts."reelSubmissionId" = rs.id
AND vts."reelUrl" IS NULL;

-- Note: engagementRatio and engagementLabel will be populated automatically
-- by the worker for new snapshots going forward
