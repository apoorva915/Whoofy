# Whoofy

Instagram reel verification and analysis: data scraping, frame analysis (YOLO/OCR/CLIP/Google Vision), sentiment & niche detection (Gemini), engagement authenticity (comment analysis, view spike detection), and view-tracking snapshots at configurable intervals.

---

## Table of contents

- [Part 1: Docker-based setup](#part-1-docker-based-setup) *(recommended for external users)*
- [Part 2: Local setup](#part-2-local-setup)
- [Architecture & external services](#architecture--external-services)
- [Troubleshooting](#troubleshooting)
- [Scripts reference](#scripts-reference)

---

# Part 1: Docker-based setup

Use this if you want to run Whoofy without installing Node, Python, FFmpeg, or Tesseract on your machine. Docker runs the web app, ML service (YOLO/OCR/CLIP), Redis, and optionally PostgreSQL in containers.

### Prerequisites

- **Docker** and **Docker Compose** installed ([Get Docker](https://docs.docker.com/get-docker/))
- A **PostgreSQL** database (use [Supabase](https://supabase.com) or the optional `db` service in compose)
- API keys: **Apify**, **Gemini** (see [API keys](#api-keys) below for how to get them)

### 1. Clone and prepare environment

```bash
git clone <repo-url>
cd Whoofy

# Copy Docker env template and edit with your values
cp .env.docker.example .env
```

Edit `.env` and set at least:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase or local). If using compose Postgres: `postgresql://postgres:postgres@db:5432/postgres` |
| `APIFY_API_TOKEN` | Your [Apify](https://console.apify.com/) API token (Instagram scraping fallback) |
| `GEMINI_API_KEY_NEW` | Your [Google AI Studio](https://makersuite.google.com/app/apikey) Gemini API key *(Docker maps this to `GEMINI_API_KEY` inside the container)* |

**Note:** `ML_SERVICE_URL` is set automatically to `http://ml:8000` in Docker. The ML service includes **Instaloader** (primary Instagram scraper) and **YOLO/OCR/CLIP** (frame analysis). Apify is used as fallback when Instaloader cannot fetch data.

Optional: `INSTALOADER_USERNAME`, `INSTALOADER_PASSWORD` (for private profiles), `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_VISION_API_KEY` (Frame Analysis – Google Vision), `SHAZAM_API_KEY`, `SHAZAM_API_HOST`, `API_BASE_URL`, `FRAME_ANALYSIS_CONCURRENCY`.

If you use the built-in **Postgres** service (`db`), set:

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres
POSTGRES_PASSWORD=postgres
```

You still need to run the SQL migrations once (see step 3).

### 2. Start the stack

From the project root:

```bash
docker-compose up --build
# or: npm run docker:up
```

This starts:

| Service | Purpose | Access |
|---------|---------|--------|
| **web** | Next.js app (UI + API) | http://localhost:3000 |
| **ml** | Python ML service: Instaloader (Instagram), YOLO/OCR/CLIP (Frame Analysis – Local) | internal:8000 |
| **redis** | Redis for BullMQ queue stats | localhost:6379 |
| **db** | PostgreSQL (optional; omit if using Supabase) | localhost:5432 |

Open **http://localhost:3000** and use the tabs: Data Scraping, Data Analysis, Frame Analysis, Engagement Analysis. All recent features (target sentiment/language, demographic match, Instaloader scraping) work in Docker.

### 3. Database migrations (one-time)

The app uses an `aimodule` schema and several tables. You must run the SQL migrations once.

**If using Supabase:**

- Create schema: `npm run db:setup-supabase` (run on host with Node, or run the SQL from `scripts/setup-supabase.ts` in Supabase SQL Editor).
- Run migration files in order in Supabase SQL Editor (see [Database migrations list](#database-migrations-in-order) below).

**If using the `db` container:**

- After `docker-compose up`, connect to Postgres (e.g. `psql` from host or another container) and run the same migrations in order.

**Database migrations (in order):**

1. `prisma/migrations/create_aimodule_schema.sql`
2. `prisma/migrations/create_aimodule_tables.sql`
3. `prisma/migrations/add_view_tracking_snapshots.sql`
4. `prisma/migrations/update_view_tracking_snapshots.sql`
5. `prisma/migrations/add_view_tracking_jobs_reel_url.sql`
6. `prisma/migrations/add_view_tracking_jobs_interval_next_run.sql`
7. `prisma/migrations/add_niche_engagement_tables.sql` (if needed)

Optional: `prisma/migrations/clear_view_tracking_tables.sql` (dev only, truncates view tracking tables).

### 4. View-tracking scheduler (optional)

View-tracking snapshots and spike detection are **DB-driven**. To have snapshots run on a schedule, run the scheduler **on your host** (or a separate container) in a separate terminal:

```bash
cd /path/to/Whoofy
npm install
npm run scheduler:view-tracking
```

Keep this process running while you want view tracking active. It uses the same `.env` and `DATABASE_URL`. In production you can run it under PM2, systemd, or a cron that calls `POST /api/view-tracking/process-due` every minute.

### 5. Stopping the stack

```bash
docker-compose down
```

Use `docker-compose down -v` to remove volumes (data in Postgres/Redis will be lost).

---

# Part 2: Local setup

Use this if you prefer to run the app and services directly on your machine (Node, Python, Redis, Postgres, etc.).

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** (or Supabase)
- **Python 3** (for YOLO, OCR, CLIP in local frame analysis)
- **Redis** (optional; for BullMQ queue stats; view tracking is DB-driven and does not require Redis)

### Quick start

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

### Environment variables

Create a `.env` file in the project root.

**Required:**

```env
NODE_ENV=production

# Database (PostgreSQL or Supabase connection string)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Gemini (sentiment, niche, language/region analysis)
GEMINI_API_KEY=your_gemini_api_key_here

# Apify (Instagram profile & reel scraping — primary data source)
APIFY_API_TOKEN=your_apify_token
```

**Optional but recommended:**

```env
# Google Cloud Vision (Frame Analysis tab — Google Vision)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_VISION_API_KEY=your-google-vision-api-key

# Shazam (music recognition in reels)
SHAZAM_API_KEY=your_shazam_api_key
SHAZAM_API_HOST=shazam.p.rapidapi.com

# Redis (optional — for queue stats; view tracking works without Redis)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Storage & app
STORAGE_TYPE=local
PORT=3000
API_BASE_URL=http://localhost:3000
```

### API keys

- **Gemini (required for Data Analysis):** [Google AI Studio](https://makersuite.google.com/app/apikey) → create API key → set `GEMINI_API_KEY` in `.env`.
- **Google Cloud Vision (Frame Analysis tab):** [Google Cloud Console](https://console.cloud.google.com/) → enable Cloud Vision API → create API key → set `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_CLOUD_VISION_API_KEY`.
- **Apify (required for Instagram data):** [Apify Console](https://console.apify.com/) → copy API token → set `APIFY_API_TOKEN` in `.env`.
- **Shazam (optional):** [RapidAPI](https://rapidapi.com/) Shazam API → set `SHAZAM_API_KEY` and `SHAZAM_API_HOST` in `.env`.

### Database setup (Supabase / PostgreSQL)

1. **Get database URL:** Supabase → Settings → Database → Connection string (URI). Or local: `postgresql://postgres:password@localhost:5432/your_db`. Set `DATABASE_URL` in `.env`.
2. **Create `aimodule` schema (Supabase):** `npm run db:setup-supabase` or run SQL from `scripts/setup-supabase.ts`.
3. **Run migrations in order:** In Supabase SQL Editor or `psql`, run the files listed in [Database migrations (in order)](#database-migrations-in-order) above.
4. **Prisma client:** `npm run db:generate`. Optional: `npm run db:push` or `npx prisma migrate deploy`.
5. **Verify:** Supabase Table Editor → schema `aimodule`, or `npm run db:studio`.

### Redis setup (optional)

View tracking does **not** require Redis. Redis is used for BullMQ queue stats.

- **Windows:** WSL `sudo apt-get install redis-server` + `sudo service redis-server start`; or Docker `docker run -d -p 6379:6379 --name redis redis`; or [Memurai](https://www.memurai.com/).
- **macOS:** `brew install redis && brew services start redis`
- **Linux:** `sudo apt-get install redis-server && sudo service redis-server start`

Verify: `redis-cli ping` → `PONG`.

### How to run everything (local)

| What you want | Command / step |
|---------------|----------------|
| **Web app (UI)** | `npm run dev` → http://localhost:3000 |
| **View tracking snapshots** | Run the [scheduler](#view-tracking-scheduler) in a separate terminal so snapshots run on schedule. |
| **Queue stats** | Redis running + optional `npm run worker:view-tracking`. |

```bash
# Development server (UI + API)
npm run dev

# View tracking scheduler — run in a separate terminal and leave running
npm run scheduler:view-tracking

# Optional: BullMQ worker (for queue stats; not required for view tracking)
npm run worker:view-tracking
```

Production build:

```bash
npm run build
npm run start
```

### View tracking (scheduler)

View spike tracking is **database-driven**. You set an interval in the UI; a **scheduler** process (or cron) runs snapshot jobs.

- **Start/Stop tracking:** UI writes to `aimodule.view_tracking_jobs`.
- **Scheduler:** Every minute, finds jobs where `nextRunAt <= now`, runs one snapshot per job, then sets `nextRunAt = now + interval`.
- **Run scheduler:** `npm run scheduler:view-tracking` in a separate terminal (or `npx tsx scripts/run-view-tracking-scheduler.ts`). No Next.js or Redis required.
- **Cron alternative:** `* * * * * curl -s -X POST https://your-app.com/api/view-tracking/process-due`

Intervals: **Minutes** (1–1440) or **Hours** (0.5–24). Ensure migrations for view tracking are applied (see [Database migrations](#database-migrations-in-order) above).

### Python / YOLO / Tesseract / CLIP (local frame analysis)

Used for **local** frame analysis (object detection, OCR, CLIP). Google Vision frame analysis does not need these.

- **Python:** Create a venv, then `pip install -r yolo/requirements.txt`; for CLIP: `pip install -r yolo/requirements_clip.txt`.
- **Tesseract (OCR):** `npm run install:tesseract`; or Windows `choco install tesseract`, macOS `brew install tesseract`, Linux `sudo apt-get install tesseract-ocr`. Verify: `tesseract --version`.
- **YOLO:** Weights download on first use (~6MB); face/age-gender models to `yolo/models/` (~40MB) if used.
- **CLIP:** Install from `yolo/requirements_clip.txt` for CLIP-based similarity in frame analysis.

---

## Architecture & external services

- **Frontend:** Next.js (React), single page with tabs: Data Scraping, Data Analysis, Frame Analysis (Local / Google Vision), Engagement Analysis.
- **API routes:** `/api/profile`, `/api/verify`, `/api/analyze`, `/api/sentiment/gemini`, `/api/verify/engagement`, `/api/view-tracking`, `/api/view-tracking/process-due`, etc.
- **External:** **Instaloader** (ML service, primary Instagram scraper); **Apify** (fallback); **Google Gemini** (sentiment, niche, language/region); **Google Cloud Vision** (frame analysis, optional); **Shazam** (optional).
- **Database:** PostgreSQL (Supabase or local); `public` + `aimodule` schemas.
- **View tracking:** DB-driven; scheduler or cron calls process-due; Redis not required for snapshots.

---

## Troubleshooting

- **"Schema 'aimodule' does not exist"** — Run `npm run db:setup-supabase` (or create `aimodule` manually) and run migrations in order.
- **"Table … does not exist"** — Run the corresponding migration from `prisma/migrations/`, then `npm run db:generate`.
- **View tracking 500 / ensureWorkerInitialized** — Update to latest code (view tracking no longer uses that); restart dev server.
- **Views show 0, likes correct** — Data is from Apify; some reels don’t return view count; check server logs for "no view count found".
- **Redis connection errors** — View tracking does not require Redis; for queue stats, start Redis and set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` in `.env`. Test: `redis-cli ping` → `PONG`.
- **Prisma client out of date** — `npm run db:generate`, then restart the dev server.
- **Port 3000 in use** — Set `PORT` in `.env` or run `npm run dev -- -p 3001`.
- **Docker: ML service unreachable** — Ensure `ML_SERVICE_URL` is not overridden in `.env` when using Docker (compose sets it to `http://ml:8000`). Run `docker-compose up --build` and wait for the ML healthcheck to pass before the web container starts.

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
