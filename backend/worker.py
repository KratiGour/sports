"""
Worker Service for Background Video Processing
Runs OCR processing jobs in the background via Cloud Tasks
"""

import os
import logging
import traceback
from typing import Dict, Optional
from datetime import datetime

from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel

# Import processing functions
from scripts.ocr_engine import process_video_optimized
from services.gcs_storage_service import GCSStorageManager
from services.retry_service import with_retry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Cricket Highlight Worker")

# Environment variables
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "cricket-videos-bucket")
PROJECT_ID = os.getenv("GCP_PROJECT_ID")
PARALLEL_WORKERS = int(os.getenv("PARALLEL_WORKERS", "6"))


class ProcessingRequest(BaseModel):
    """Processing job request payload."""
    video_id: str
    config: Optional[Dict] = None
    created_at: Optional[str] = None


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "cricket-worker",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/process")
async def process_video_task(request: ProcessingRequest):
    """
    Process video task (called by Cloud Tasks).
    
    This endpoint:
    1. Downloads video from GCS
    2. Runs optimized OCR pipeline
    3. Uploads results to GCS
    4. Updates job status
    5. Cleans up temp files
    """
    video_id = request.video_id
    config = request.config or {}
    
    logger.info(f"=== Starting processing for video: {video_id} ===")
    
    # Initialize GCS manager
    gcs_manager = GCSStorageManager(GCS_BUCKET_NAME, PROJECT_ID)
    
    local_video_path = None
    local_clips = []
    local_supercut = None
    
    try:
        # Step 1: Download video from GCS
        logger.info(f"[1/5] Downloading video {video_id} from GCS...")
        local_video_path = with_retry(
            lambda: gcs_manager.download_video(video_id, folder="raw"),
            max_attempts=3,
            operation_name=f"download_{video_id}"
        )
        
        # Step 2: Run OCR processing with optimizations
        logger.info(f"[2/5] Processing video with OCR pipeline...")
        
        processing_config = {
            'use_preprocessing': config.get('use_preprocessing', True),
            'use_parallel': config.get('use_parallel', True),
            'use_frame_change': config.get('use_frame_change', True),
            'use_audio_detection': config.get('use_audio_detection', False),
            'use_motion_detection': config.get('use_motion_detection', True),
            'parallel_workers': PARALLEL_WORKERS,
            'parallel_clips': config.get('parallel_clips', True),
        }
        
        result = with_retry(
            lambda: process_video_optimized(
                video_path=local_video_path,
                video_id=video_id,
                config=processing_config
            ),
            max_attempts=2,
            operation_name=f"process_{video_id}"
        )
        
        events = result['events']
        local_clips = result.get('clips', [])
        local_supercut = result.get('supercut')
        
        logger.info(f"Processing complete: {len(events)} events detected")
        
        # Step 3: Upload clips to GCS
        if local_clips:
            logger.info(f"[3/5] Uploading {len(local_clips)} clips to GCS...")
            gcs_clips = with_retry(
                lambda: gcs_manager.upload_clips(local_clips, video_id),
                max_attempts=3,
                operation_name=f"upload_clips_{video_id}"
            )
            logger.info(f"Uploaded {len(gcs_clips)} clips")
        else:
            gcs_clips = []
        
        # Step 4: Upload supercut to GCS
        gcs_supercut = None
        if local_supercut and os.path.exists(local_supercut):
            logger.info(f"[4/5] Uploading highlight supercut to GCS...")
            gcs_supercut = with_retry(
                lambda: gcs_manager.upload_highlight(local_supercut, video_id),
                max_attempts=3,
                operation_name=f"upload_highlight_{video_id}"
            )
            logger.info(f"Uploaded highlight: {gcs_supercut}")
        
        # Step 5: Cleanup
        logger.info(f"[5/5] Cleaning up temporary files...")
        
        # Delete local temp files
        cleanup_local_files(local_video_path, local_clips, local_supercut)
        
        # Delete GCS temp files (preprocessed, chunks)
        gcs_manager.delete_temp_files(video_id)
        
        logger.info(f"=== Processing complete for video: {video_id} ===")
        
        # Return success response
        return {
            "status": "success",
            "video_id": video_id,
            "events_count": len(events),
            "clips_count": len(gcs_clips),
            "supercut_url": gcs_supercut,
            "processing_time": result.get('processing_time', 0),
            "events": events[:10]  # Return first 10 events
        }
        
    except Exception as e:
        logger.error(f"Processing failed for video {video_id}: {e}")
        logger.error(traceback.format_exc())
        
        # Cleanup on failure
        try:
            cleanup_local_files(local_video_path, local_clips, local_supercut)
        except:
            pass
        
        # Re-raise to trigger Cloud Tasks retry
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {str(e)}"
        )


def cleanup_local_files(video_path, clips, supercut):
    """Delete local temporary files."""
    import shutil
    
    files_to_delete = [video_path, supercut]
    files_to_delete.extend(clips or [])
    
    for file_path in files_to_delete:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.debug(f"Deleted: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete {file_path}: {e}")
    
    # Also try to delete preprocessed directory
    if video_path:
        video_dir = os.path.dirname(video_path)
        preprocessed_dir = os.path.join(video_dir, "preprocessed")
        if os.path.exists(preprocessed_dir):
            try:
                shutil.rmtree(preprocessed_dir)
                logger.debug(f"Deleted preprocessed dir: {preprocessed_dir}")
            except Exception as e:
                logger.warning(f"Failed to delete {preprocessed_dir}: {e}")


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8080"))
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
