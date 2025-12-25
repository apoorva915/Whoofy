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

## Local Whisper Transcription

1. Install Python dependencies from the included Whisper repo:
   ```bash
   python -m venv .venv
   .venv/Scripts/python -m pip install -r whisper/requirements.txt
   ```
2. The code automatically calls `python -m whisper.transcribe` against audio extracted to `storage/temp`.
3. Transcription results are dumped as JSON under `storage/temp/transcriptions` and surfaced in the UI.
4. Override defaults via `.env`:
   ```bash
   # Point to your Python executable if it is not on PATH
   LOCAL_WHISPER_PYTHON=python
   LOCAL_WHISPER_MODEL=tiny
   LOCAL_WHISPER_DEVICE=cpu
   LOCAL_WHISPER_TASK=transcribe
   ```

## YOLO Object Detection & OCR

1. Install YOLO and OCR dependencies (uses same Python venv as Whisper):
   ```bash
   .venv/Scripts/python -m pip install -r yolo/requirements.txt
   ```

2. **Install Tesseract OCR engine** (required for text detection):
   - **Windows**: Download and install from [GitHub releases](https://github.com/UB-Mannheim/tesseract/wiki) or use chocolatey: `choco install tesseract`
   - **macOS**: `brew install tesseract`
   - **Linux**: `sudo apt-get install tesseract-ocr` (Ubuntu/Debian) or `sudo yum install tesseract` (RHEL/CentOS)

3. The system automatically uses:
   - **YOLO** for object detection in video frames
   - **OCR (pytesseract)** for text reading from frames
   
4. If YOLO/OCR is not available, the system will skip that detection but continue processing.
5. YOLO will automatically download the `yolov8n.pt` model on first use (lightweight, ~6MB).

## Documentation

- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md) - Complete project roadmap
- [Phase 1 Setup Guide](./docs/PHASE1_SETUP.md) - Foundation setup instructions
- [Architecture](./docs/ARCHITECTURE.md) - System architecture overview
- [API Documentation](./docs/API.md) - API endpoints (coming soon)

