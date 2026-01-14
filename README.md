# Whoofy

## Quick Start

1. Install dependencies
2. Set up environment variables (create `.env` file)
3. Set up database
4. Start development server:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Installation Guide

### Python Environment Setup

1. Create virtual environment
2. Activate virtual environment
3. Install Python dependencies for YOLO and CLIP

### YOLO Object Detection & OCR

1. Install Python dependencies from `yolo/requirements.txt`
2. Install Tesseract OCR engine (system package manager)
3. YOLO Model automatically downloads on first use (~6MB)

### CLIP Visual Similarity

Install CLIP dependencies from `yolo/requirements_clip.txt`.

## Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

### Required

```env
# Node Environment
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/database_name

# AI Services - Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here
```

# Apify
APIFY_API_TOKEN=your_apify_token

# Shazam
SHAZAM_API_KEY=your_shazam_api_key
SHAZAM_API_HOST=shazam.p.rapidapi.com

# Logo API (local service)
LOGO_API_URL=http://127.0.0.1:8001


# Redis (for BullMQ queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Storage
STORAGE_TYPE=local

# Application
PORT=3000
API_BASE_URL=http://localhost:3000
```

## API Key Setup

### Gemini API Key (Required)

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key (should be ~39 characters, starts with "AIza...")
5. Add to `.env` file: `GEMINI_API_KEY=your_api_key_here`

### Other API Keys

- **Apify**: Get token from [Apify Console](https://console.apify.com/)
- **Shazam**: Get API key from [RapidAPI](https://rapidapi.com/)

## Database Setup

1. Install PostgreSQL
2. Create a database
3. Update `DATABASE_URL` in `.env` with your PostgreSQL connection string
4. Run database migrations

## Redis Setup (Optional)

If using BullMQ queue:
1. Install Redis
2. Update `REDIS_HOST` and `REDIS_PORT` in `.env` if different from defaults
3. Set `REDIS_PASSWORD` if required
