# Use official Python 3.11 image (for MediaPipe compatibility)
FROM python:3.11-slim

# Install system dependencies required by MediaPipe and OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the entire backend application
COPY . .

# Create storage directories
RUN mkdir -p storage/raw storage/highlights storage/reports storage/bowling_videos

# Expose the port FastAPI uses
EXPOSE 8000

# Environment variable for production
ENV PYTHONUNBUFFERED=1

# Command to run the app with gunicorn
CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:8000", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "--timeout", "120"]
