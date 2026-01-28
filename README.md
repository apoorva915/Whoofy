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
2. Install Tesseract OCR engine (see instructions below)
3. YOLO Model automatically downloads on first use (~6MB)

### Age & Gender Detection

The face detection script uses OpenCV DNN with pre-trained Caffe models for age and gender estimation. The models will be automatically downloaded on first use (~40MB total) to the `yolo/models/` directory:
- `gender_net.caffemodel` - Gender classification model
- `age_net.caffemodel` - Age estimation model
- Corresponding `.prototxt` files for model configuration

If model download fails, the system will fall back to basic face detection without age/gender estimation.

#### Tesseract OCR Installation

Tesseract is required for the optional local OCR functionality. If you're using Google Cloud Vision API for OCR, Tesseract is not required.

**Automatic Installation (Recommended):**

Run the automated installation script:
```bash
npm run install:tesseract
```

This script will:
- Detect your operating system (Windows/macOS/Linux)
- Check for available package managers (Chocolatey/Homebrew/apt/dnf)
- Automatically install Tesseract
- Verify the installation

**Manual Installation:**

If automatic installation doesn't work, follow the manual instructions below:

**Windows:**
1. Download the installer from [GitHub Releases](https://github.com/UB-Mannheim/tesseract/wiki) or use [chocolatey](https://chocolatey.org/):
   ```powershell
   choco install tesseract
   ```
2. Add Tesseract to your PATH (usually installed to `C:\Program Files\Tesseract-OCR`)
3. Verify installation:
   ```powershell
   tesseract --version
   ```

**macOS:**
```bash
brew install tesseract
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install tesseract
```

**Verify Installation:**
After installation, verify Tesseract is accessible:
```bash
tesseract --version
```

**Note:** If Tesseract is not in your PATH, you may need to configure `pytesseract` to point to the Tesseract executable location. The Python `pytesseract` package (installed via `requirements.txt`) is a wrapper that requires the Tesseract binary to be installed separately.

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

# AI Services - Google Cloud Vision (for Frame Analysis tab)
GOOGLE_CLOUD_PROJECT_ID=your-google-cloud-project-id
GOOGLE_CLOUD_VISION_API_KEY=your-google-cloud-vision-api-key
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

### Google Cloud Vision API Key (For Frame Analysis)

To use the **Frame Analysis using Google Vision** tab, you need to set up Google Cloud Vision API:

1. **Create a Google Cloud Project** (if you don't have one):
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Note your **Project ID** (you'll need this)

2. **Enable Cloud Vision API**:
   - In the Google Cloud Console, go to **APIs & Services** > **Library**
   - Search for "Cloud Vision API"
   - Click on it and click **Enable**

3. **Create an API Key**:
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **API Key**
   - Copy the API key (it will look like: `AIzaSy...`)
   - (Optional but recommended) Click **Restrict Key** and restrict it to "Cloud Vision API" only

4. **Add to `.env` file**:
   ```env
   # Google Cloud Vision API (for Frame Analysis tab)
   GOOGLE_CLOUD_PROJECT_ID=your-project-id-here
   GOOGLE_CLOUD_VISION_API_KEY=your-api-key-here
   ```

**Note**: The Google Cloud Vision API has usage limits and may incur costs. Check [Google Cloud Vision API Pricing](https://cloud.google.com/vision/pricing) for details.

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
