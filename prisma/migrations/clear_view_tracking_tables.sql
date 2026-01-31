-- Clear all view tracking data and start fresh (removes older rows with null reelUrl, etc.)
-- Run in your DB client (Supabase SQL editor, psql, etc.)
-- WARNING: This deletes ALL rows in these tables. Tracking status and snapshots will be lost.

TRUNCATE TABLE aimodule.view_tracking_snapshots;
TRUNCATE TABLE aimodule.view_tracking_jobs;
