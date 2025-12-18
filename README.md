# Whoofy - AI Reel Verification System

AI-powered system for verifying user-generated content (UGC) reels submitted to brand campaigns.

## Overview

This system automatically verifies user-generated content created for brands by analyzing video content, detecting objects and brands, checking campaign requirements, and detecting fraudulent or low-quality submissions.

## Status

✅ **Phase 1 Complete**: Foundation & Infrastructure Setup
- Type definitions, database schema, models, utilities, and configuration are ready
- See [docs/PHASE1_SETUP.md](./docs/PHASE1_SETUP.md) for setup instructions

✅ **Phase 2 Complete**: External API Integrations
- Instagram API, Apify Scraper, Shazam API, NoteGPT API all implemented
- Mock/fallback support for development without API keys
- See [docs/PHASE2_COMPLETE.md](./docs/PHASE2_COMPLETE.md) for details

✅ **Phase 3 Complete**: Video Processing Pipeline
- Video download, frame extraction, transcription, audio recognition
- **Fully wired to UI** - Input reel URL and see results!
- Local storage only (no cloud services)
- See [docs/PHASE3_COMPLETE.md](./docs/PHASE3_COMPLETE.md) for details

🚧 **Next**: Phase 4 - AI Model Integration

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**:
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## Documentation

- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md) - Complete project roadmap
- [Phase 1 Setup Guide](./docs/PHASE1_SETUP.md) - Foundation setup instructions
- [Architecture](./docs/ARCHITECTURE.md) - System architecture overview
- [API Documentation](./docs/API.md) - API endpoints (coming soon)

