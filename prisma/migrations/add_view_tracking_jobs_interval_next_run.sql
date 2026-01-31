-- Add interval_hours and next_run_at to view_tracking_jobs for DB-driven scheduling.
-- Jobs run at next_run_at; scheduler (cron or standalone script) processes due jobs and sets next_run_at += interval_hours.

ALTER TABLE aimodule.view_tracking_jobs
  ADD COLUMN IF NOT EXISTS "intervalHours" double precision NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "nextRunAt" timestamp(3) with time zone;

-- First run due immediately for existing ACTIVE jobs that don't have next_run_at
UPDATE aimodule.view_tracking_jobs
SET "nextRunAt" = NOW()
WHERE status = 'ACTIVE' AND "nextRunAt" IS NULL;

CREATE INDEX IF NOT EXISTS view_tracking_jobs_next_run_at_idx
  ON aimodule.view_tracking_jobs("nextRunAt") WHERE status = 'ACTIVE';
