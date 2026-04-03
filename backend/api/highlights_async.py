"""
API Endpoints for Cricket Highlight Generation with Cloud Tasks
Handles async video processing via background workers
"""

import os
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel

from services.gcs_storage_service import GCSStorageManager
from services.cloud_tasks_service import enqueue_video_processing
from database.config import SessionLocal
from database.models import ProcessingJob

logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/api/highlights", tags=["Highlights"])

# Environment variables
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "cricket-videos-bucket")
PROJECT_ID = os.getenv("GCP_PROJECT_ID")
WORKER_SERVICE_URL = os.getenv("WORKER_SERVICE_URL")


class ProcessingJobResponse(BaseModel):
    """Response model for processing job."""
    job_id: str
    video_id: str
    status: str
    message: str
    created_at: str


class JobStatusResponse(BaseModel):
    """Response model for job status check."""
    job_id: str
    video_id: str
    status: str
    events_count: Optional[int] = None
    clips_count: Optional[int] = None
    supercut_url: Optional[str] = None
    processing_time: Optional[float] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


@router.post("/upload", response_model=ProcessingJobResponse)
async def upload_and_process_video(
    video: UploadFile = File(...),
    use_parallel: bool = Form(True),
    use_preprocessing: bool = Form(True),
    priority: bool = Form(False)
):
    """
    Upload video and enqueue for background processing.
    
    This endpoint:
    1. Uploads video to GCS
    2. Creates processing job in database
    3. Enqueues job to Cloud Tasks
    4. Returns immediately with job_id
    
    Frontend can poll /status/{job_id} to check progress.
    """
    video_id = str(uuid.uuid4())
    
    logger.info(f"Received video upload request: {video.filename} → {video_id}")
    
    try:
        # Step 1: Save video to temporary location
        import tempfile
        temp_path = os.path.join(tempfile.gettempdir(), f"{video_id}.mp4")
        
        with open(temp_path, 'wb') as f:
            content = await video.read()
            f.write(content)
        
        logger.info(f"Saved temporary file: {temp_path}")
        
        # Step 2: Upload to GCS
        gcs_manager = GCSStorageManager(GCS_BUCKET_NAME, PROJECT_ID)
        gcs_uri = gcs_manager.upload_video(temp_path, video_id, folder="raw")
        
        logger.info(f"Uploaded to GCS: {gcs_uri}")
        
        # Step 3: Create processing job in database
        db = SessionLocal()
        try:
            job = ProcessingJob(
                video_id=video_id,
                status="QUEUED",
                original_filename=video.filename,
                gcs_uri=gcs_uri,
                config={
                    'use_parallel': use_parallel,
                    'use_preprocessing': use_preprocessing,
                    'priority': priority
                }
            )
            db.add(job)
            db.commit()
            db.refresh(job)
            
            job_id = str(job.id)
            
            logger.info(f"Created processing job: {job_id}")
            
        finally:
            db.close()
        
        # Step 4: Enqueue to Cloud Tasks
        if WORKER_SERVICE_URL:
            task_id = enqueue_video_processing(
                video_id=video_id,
                project_id=PROJECT_ID,
                worker_url=WORKER_SERVICE_URL,
                config={
                    'use_parallel': use_parallel,
                    'use_preprocessing': use_preprocessing
                },
                priority=priority
            )
            
            logger.info(f"Enqueued to Cloud Tasks: {task_id}")
        else:
            logger.warning("WORKER_SERVICE_URL not set, job will not be processed")
        
        # Step 5: Cleanup temp file
        os.remove(temp_path)
        
        return ProcessingJobResponse(
            job_id=job_id,
            video_id=video_id,
            status="QUEUED",
            message="Video uploaded successfully. Processing will begin shortly.",
            created_at=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Upload failed for video {video_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Get processing job status.
    
    Status flow:
    - QUEUED: Waiting in Cloud Tasks queue
    - PROCESSING: Worker is processing the video
    - COMPLETED: Processing finished successfully
    - FAILED: Processing failed (check error_message)
    """
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return JobStatusResponse(
            job_id=str(job.id),
            video_id=job.video_id,
            status=job.status,
            events_count=job.events_count,
            clips_count=job.clips_count,
            supercut_url=job.supercut_url,
            processing_time=job.processing_time,
            error_message=job.error_message,
            created_at=job.created_at.isoformat() if job.created_at else None,
            updated_at=job.updated_at.isoformat() if job.updated_at else None
        )
        
    finally:
        db.close()


@router.post("/process-url")
async def process_video_from_url(
    video_url: str = Form(...),
    use_parallel: bool = Form(True),
    use_preprocessing: bool = Form(True),
    priority: bool = Form(False)
):
    """
    Process video from URL (e.g., YouTube, GCS signed URL).
    
    Similar to /upload, but downloads video first.
    """
    video_id = str(uuid.uuid4())
    
    logger.info(f"Received URL processing request: {video_url} → {video_id}")
    
    try:
        # Step 1: Download video from URL
        import requests
        import tempfile
        
        temp_path = os.path.join(tempfile.gettempdir(), f"{video_id}.mp4")
        
        response = requests.get(video_url, stream=True, timeout=300)
        response.raise_for_status()
        
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        logger.info(f"Downloaded video: {temp_path}")
        
        # Step 2: Upload to GCS
        gcs_manager = GCSStorageManager(GCS_BUCKET_NAME, PROJECT_ID)
        gcs_uri = gcs_manager.upload_video(temp_path, video_id, folder="raw")
        
        # Step 3: Create job and enqueue (same as /upload)
        db = SessionLocal()
        try:
            job = ProcessingJob(
                video_id=video_id,
                status="QUEUED",
                original_filename=video_url,
                gcs_uri=gcs_uri,
                config={
                    'use_parallel': use_parallel,
                    'use_preprocessing': use_preprocessing,
                    'priority': priority
                }
            )
            db.add(job)
            db.commit()
            db.refresh(job)
            
            job_id = str(job.id)
            
        finally:
            db.close()
        
        # Step 4: Enqueue
        if WORKER_SERVICE_URL:
            enqueue_video_processing(
                video_id=video_id,
                project_id=PROJECT_ID,
                worker_url=WORKER_SERVICE_URL,
                config={
                    'use_parallel': use_parallel,
                    'use_preprocessing': use_preprocessing
                },
                priority=priority
            )
        
        # Step 5: Cleanup
        os.remove(temp_path)
        
        return ProcessingJobResponse(
            job_id=job_id,
            video_id=video_id,
            status="QUEUED",
            message="Video queued for processing",
            created_at=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"URL processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
