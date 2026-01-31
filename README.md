# Whoofy

Instagram reel verification and analysis: data scraping, frame analysis (YOLO/OCR/CLIP/Google Vision), sentiment & niche detection (Gemini), engagement authenticity (comment analysis, view spike detection), and view-tracking snapshots at configurable intervals.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [API keys](#api-keys)
- [Database setup (Supabase / PostgreSQL)](#database-setup-supabase--postgresql)
- [Redis setup](#redis-setup)
- [How to run everything](#how-to-run-everything)
- [View tracking (scheduler)](#view-tracking-scheduler)
- [Python / YOLO / Tesseract / CLIP](#python--yolo--tesseract--clip)
- [Architecture & external services](#architecture--external-services)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** (or Supabase)
- **Python 3** (for YOLO, OCR, CLIP in local frame analysis)
- **Redis** (optional; for BullMQ queue stats; view tracking is DB-driven and does not require Redis to run)

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in values (see Environment variables)
cp .env.example .env   # or create .env manually

# 3. Database: create DB, run migrations (see Database setup)
npm run db:generate
# Then run SQL migrations in order (Supabase SQL Editor or psql) — see Database setup

# 4. Start the app
npm run dev
```

Open **http://localhost:3000**. Use the tabs: Data Scraping, Data Analysis, Frame Analysis, Engagement Analysis.

---

## Environment variables

Create a `.env` file in the project root.

### Required

```env
NODE_ENV=development

# Database (PostgreSQL or Supabase connection string)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Gemini (sentiment, niche, language/region analysis)
GEMINI_API_KEY=your_gemini_api_key_here

# Apify (Instagram profile & reel scraping — primary data source)
APIFY_API_TOKEN=your_apify_token
```

### Optional but recommended

```env
# Google Cloud Vision (Frame Analysis tab — Google Vision)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_VISION_API_KEY=your-google-vision-api-key

# Shazam (music recognition in reels)
SHAZAM_API_KEY=your_shazam_api_key
SHAZAM_API_HOST=shazam.p.rapidapi.com

# Redis (optional — for queue stats; view tracking works without Redis)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Storage & app
STORAGE_TYPE=local
PORT=3000
API_BASE_URL=http://localhost:3000
```

---

## API keys

### Gemini (required for Data Analysis)

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey).
2. Create an API key and set `GEMINI_API_KEY` in `.env`.

### Google Cloud Vision (Frame Analysis tab)

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select project.
2. Enable **Cloud Vision API** (APIs & Services → Library).
3. Create an API key under Credentials, restrict to Cloud Vision if desired.
4. Set `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_CLOUD_VISION_API_KEY` in `.env`.

### Apify (required for Instagram data)

1. Sign up at [Apify Console](https://console.apify.com/).
2. Copy your API token and set `APIFY_API_TOKEN` in `.env`.  
   Instagram profile and reel data (including view tracking) come from Apify only.

### Shazam (optional)

Get an API key from [RapidAPI](https://rapidapi.com/) for Shazam and set `SHAZAM_API_KEY` and `SHAZAM_API_HOST` in `.env`.

---

## Database setup (Supabase / PostgreSQL)

The app uses PostgreSQL. You can use a local PostgreSQL instance or **Supabase** (recommended).

### 1. Get database URL

- **Supabase**: Dashboard → Settings → Database → Connection string (URI). Replace `[YOUR-PASSWORD]` with your DB password.
- **Local**: `postgresql://postgres:password@localhost:5432/your_db`

Set `DATABASE_URL` in `.env`.

### 2. Create `aimodule` schema (Supabase)

If using Supabase, create the schema and permissions:

```bash
npm run db:setup-supabase
```

Or run the SQL from `scripts/setup-supabase.ts` / create schema `aimodule` manually.

### 3. Run migrations (in order)

Run these SQL files in your DB client (Supabase SQL Editor or `psql`) in this order:

1. `prisma/migrations/create_aimodule_schema.sql` — create schema if not exists  
2. `prisma/migrations/create_aimodule_tables.sql` — core aimodule tables  
3. `prisma/migrations/add_view_tracking_snapshots.sql` — view tracking snapshots  
4. `prisma/migrations/update_view_tracking_snapshots.sql` — add reelUrl, engagement fields  
5. `prisma/migrations/add_view_tracking_jobs_reel_url.sql` — view_tracking_jobs  
6. `prisma/migrations/add_view_tracking_jobs_interval_next_run.sql` — interval & nextRunAt for scheduler  
7. `prisma/migrations/add_niche_engagement_tables.sql` — niche/engagement tables if needed  

Optional: `prisma/migrations/clear_view_tracking_tables.sql` — truncate view tracking tables (dev only).

### 4. Prisma client

After schema/migrations:

```bash
npm run db:generate
```

Optional: `npm run db:push` to sync Prisma schema to DB, or use `npx prisma migrate deploy` for migrations.

### 5. Verify

- Supabase: Table Editor → switch schema to `aimodule` and confirm tables exist.  
- Or run: `npm run db:studio` to open Prisma Studio.

---

## Redis setup

Redis is **optional**. View tracking is DB-driven and does not require Redis. Redis is used for BullMQ queue stats (e.g. `/api/view-tracking/stats`).

### Windows

- **WSL**: `sudo apt-get install redis-server` then `sudo service redis-server start`.  
- **Docker**: `docker run -d -p 6379:6379 --name redis redis`.  
- **Memurai**: [memurai.com](https://www.memurai.com/) — Redis-compatible Windows service.  
- **Cloud**: e.g. Upstash/Redis Cloud; set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` in `.env`.

### macOS / Linux

```bash
# macOS
brew install redis && brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server && sudo service redis-server start
```

Verify: `redis-cli ping` → `PONG`.

---

## How to run everything

| What you want              | Command / step |
|----------------------------|----------------|
| **Web app (UI)**           | `npm run dev` → http://localhost:3000 |
| **View tracking snapshots**| Run **scheduler** (see [View tracking](#view-tracking-scheduler)) so snapshots run at your chosen interval. No need for dev server or worker. |
| **Queue stats**            | Redis running + optional `npm run worker:view-tracking`. App and stats still work without worker. |

### Commands

```bash
# Development server (UI + API)
npm run dev

# View tracking scheduler — run in a separate terminal and leave running (snapshots run every minute for due jobs)
npm run scheduler:view-tracking

# Optional: BullMQ worker (for queue stats; not required for view tracking)
npm run worker:view-tracking
```

Build for production:

```bash
npm run build
npm run start
```

---

## View tracking (scheduler)

View spike tracking uses the **database** for scheduling. You choose an interval (minutes or hours); the UI starts/stops tracking and shows snapshots. A **scheduler** process (or cron) runs the actual snapshot jobs.

### How it works

1. **Start Tracking** (UI): Saves reel URL and interval to `aimodule.view_tracking_jobs` (`nextRunAt` = now).  
2. **Scheduler**: Every minute, finds jobs where `nextRunAt <= now`, runs one snapshot per job (fetch views/likes/comments, save snapshot, spike detection), then sets `nextRunAt = now + interval`.  
3. **Stop Tracking** (UI): Sets job status to STOPPED so the scheduler skips it.  
4. **Fetch Snapshots** (UI): Reads from DB; no dependency on dev server or worker.

Intervals: **Minutes** (1–1440) or **Hours** (0.5–24).

### Run the scheduler

**Option A — Standalone script (recommended)**

In a separate terminal (or PM2/systemd):

```bash
npm run scheduler:view-tracking
```

Or: `npx tsx scripts/run-view-tracking-scheduler.ts`

No Next.js or Redis required. Keep this process running so snapshots are taken on schedule.

**Option B — Cron calling API**

If the app is always running (e.g. in production), call the process-due API every minute:

```bash
* * * * * curl -s -X POST https://your-app.com/api/view-tracking/process-due
```

GET or POST both work.

### View tracking migrations

Ensure these are applied (see [Database setup](#database-setup-supabase--postgresql)):

- `add_view_tracking_snapshots.sql`
- `add_view_tracking_jobs_reel_url.sql`
- `add_view_tracking_jobs_interval_next_run.sql` (adds `intervalHours`, `nextRunAt`)

Then: `npx prisma generate` (optional).

---

## Python / YOLO / Tesseract / CLIP

Used for **local** frame analysis (object detection, OCR, CLIP similarity). Google Vision frame analysis does not need these.

### Python

- Create a venv, activate it, then:

```bash
pip install -r yolo/requirements.txt
# For CLIP: pip install -r yolo/requirements_clip.txt
```

### Tesseract (OCR)

- **Auto**: `npm run install:tesseract`  
- **Windows**: `choco install tesseract` and add to PATH.  
- **macOS**: `brew install tesseract`  
- **Linux**: `sudo apt-get install tesseract-ocr` or `sudo dnf install tesseract`

Verify: `tesseract --version`

### YOLO

- Weights download on first use (~6MB).  
- Face/age-gender models (if used) download to `yolo/models/` (~40MB).

### CLIP

- Install deps from `yolo/requirements_clip.txt` for CLIP-based visual similarity in frame analysis.

---

## Architecture & external services

- **Frontend**: Next.js (React), single page with tabs: Data Scraping, Data Analysis, Frame Analysis (Local / Google Vision), Engagement Analysis.  
- **API routes**: `/api/profile` (scrape profile/reel via Apify), `/api/verify`, `/api/analyze`, `/api/sentiment/gemini`, `/api/verify/engagement`, `/api/view-tracking`, `/api/view-tracking/process-due`, etc.  
- **External**:  
  - **Apify**: Instagram profile + reel metadata (likes, comments, views when available). Primary and only Instagram data source.  
  - **Google Gemini**: Sentiment, niche, language/region.  
  - **Google Cloud Vision**: Frame analysis (optional).  
  - **Shazam**: Music recognition (optional).  
- **Database**: PostgreSQL (Supabase); `public` + `aimodule` schemas.  
- **View tracking**: DB-driven; scheduler or cron calls process-due; no Redis required for snapshots.

---

## Troubleshooting

### "Schema 'aimodule' does not exist"

- Run `npm run db:setup-supabase` (or create `aimodule` schema manually).  
- Run migrations in order (see [Database setup](#database-setup-supabase--postgresql)).

### "Table … does not exist"

- Run the corresponding migration from `prisma/migrations/` in your DB client.  
- Then `npm run db:generate`.

### View tracking: "ensureWorkerInitialized is not defined" / 500

- Ensure you’re on the latest code: view tracking no longer uses that call; POST `/api/view-tracking` only writes to the DB.  
- Restart dev server after pulling.

### Views show 0, likes show correctly

- Data is from Apify (not mock). Some reels or actors don’t return view count; we map multiple field names (`viewsCount`, `viewCount`, `playCount`, etc.).  
- Check server logs for “no view count found”; they include raw view-related fields from each scraper for debugging.

### Redis connection errors

- View tracking does **not** require Redis. For queue stats, start Redis and set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` in `.env`.  
- Test: `redis-cli ping` → `PONG`.

### Prisma client out of date

```bash
npm run db:generate
```

Then restart the dev server.

### Port 3000 in use

- Change `PORT` in `.env` or run: `npm run dev -- -p 3001`

---

## Scripts reference

| Script | Purpose |
|--------|--------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push Prisma schema to DB |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:setup-supabase` | Create aimodule schema (Supabase) |
| `npm run scheduler:view-tracking` | Run view-tracking scheduler (keep running) |
| `npm run worker:view-tracking` | Run BullMQ worker (optional) |
| `npm run install:tesseract` | Try to install Tesseract OCR |
