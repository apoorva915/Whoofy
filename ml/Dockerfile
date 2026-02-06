FROM python:3.11-slim-bookworm

WORKDIR /app

# System deps:
# - tesseract-ocr: OCR engine
# - libgl1, libglib2.0-0: common OpenCV runtime deps
# - git: needed for CLIP pip install from git+https
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    git \
  && rm -rf /var/lib/apt/lists/*

# Keep python output unbuffered for logs
ENV PYTHONUNBUFFERED=1

# Install Python deps
COPY ml/requirements.txt /app/ml/requirements.txt
RUN pip install --no-cache-dir -r /app/ml/requirements.txt

# Copy repo (we import yolo/* directly)
COPY yolo /app/yolo
COPY ml /app/ml

EXPOSE 8000

# Uvicorn production settings (single process; can be scaled via replicas in orchestrator)
CMD ["uvicorn", "ml.app:app", "--host", "0.0.0.0", "--port", "8000"]

