-- Create view_tracking_snapshots table in aimodule schema
CREATE TABLE IF NOT EXISTS aimodule.view_tracking_snapshots (
    id TEXT NOT NULL,
    "reelSubmissionId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER DEFAULT 0,
    "commentCount" INTEGER DEFAULT 0,
    "shareCount" INTEGER DEFAULT 0,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSpikeDetected" BOOLEAN NOT NULL DEFAULT false,
    "spikeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "view_tracking_snapshots_pkey" PRIMARY KEY (id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "view_tracking_snapshots_reelSubmissionId_snapshotAt_idx" 
    ON aimodule.view_tracking_snapshots("reelSubmissionId", "snapshotAt");
CREATE INDEX IF NOT EXISTS "view_tracking_snapshots_snapshotAt_idx" 
    ON aimodule.view_tracking_snapshots("snapshotAt");

-- Add foreign key constraint (cross-schema reference to public.reel_submissions)
ALTER TABLE aimodule.view_tracking_snapshots 
    ADD CONSTRAINT "view_tracking_snapshots_reelSubmissionId_fkey" 
    FOREIGN KEY ("reelSubmissionId") 
    REFERENCES public.reel_submissions(id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA aimodule TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aimodule TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA aimodule TO anon;
