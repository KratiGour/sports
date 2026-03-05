"""
Generates V4 Signed URLs so the React frontend uploads heavy video files
straight to Google Cloud Storage, completely bypassing FastAPI's RAM.

Flow:
  1. Frontend calls  GET /api/v1/storage/upload-url?filename=x&content_type=y
  2. Backend returns  { signed_url, blob_name, submission_id }
  3. Frontend PUTs the file to signed_url (direct GCS upload)
  4. Frontend calls  POST /api/v1/storage/confirm-upload with submission_id to flip the status from UPLOADING → PENDING.

Environment Variables Required:
  GCS_BUCKET_NAME                — Target bucket (e.g. "cricket-videos-prod")
  GOOGLE_APPLICATION_CREDENTIALS — Path to service-account JSON key file (OR use Workload Identity on Cloud Run)
"""

import logging
import os
import uuid
from datetime import timedelta

import google.auth
import google.auth.transport.requests
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.user import User
from database.models.submission import VideoSubmission, SubmissionStatus
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# GCS client (singleton — initialised once at import time)
GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "")

_storage_client = None
_bucket = None

try:
    from google.cloud import storage as gcs

    if GCS_BUCKET_NAME:
        _storage_client = gcs.Client()
        _bucket = _storage_client.bucket(GCS_BUCKET_NAME)
        logger.info("GCS storage client initialised for bucket '%s'", GCS_BUCKET_NAME)
    else:
        logger.warning("GCS_BUCKET_NAME not set — signed-URL endpoint will return 503")
except ImportError:
    logger.warning("google-cloud-storage not installed — signed-URL endpoint disabled")
except Exception as exc:
    logger.error("Failed to initialise GCS client: %s", exc)

GCS_AVAILABLE: bool = _bucket is not None

# Allowed MIME types for video uploads
_ALLOWED_CONTENT_TYPES = frozenset(
    {
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/webm",
    }
)

# Signed URL validity
_SIGNED_URL_EXPIRY = timedelta(minutes=15)


# Response schemas (kept local — tiny & endpoint-specific)
class SignedUrlResponse(BaseModel):
    signed_url: str
    blob_name: str
    submission_id: str


class ConfirmUploadResponse(BaseModel):
    submission_id: str
    status: str
    blob_name: str


# GET /upload-url
@router.get("/upload-url", response_model=SignedUrlResponse)
def generate_upload_url(
    filename: str = Query(..., min_length=1, description="Original file name"),
    content_type: str = Query(..., description="MIME type, e.g. video/mp4"),
    analysis_type: str = Query("BATTING", description="BATTING or BOWLING"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SignedUrlResponse:
    """
    Return a V4 Signed URL that lets the frontend PUT a video file
    directly into GCS.  Also creates a ``video_submissions`` row in
    UPLOADING state so we can track the upload lifecycle.
    """
    # guard 
    if not GCS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Cloud storage is not configured on this server.",
        )

    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type '{content_type}'. "
            f"Allowed: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}",
        )

    analysis_type = analysis_type.upper()
    if analysis_type not in ("BATTING", "BOWLING"):
        raise HTTPException(status_code=400, detail="analysis_type must be BATTING or BOWLING")

    # unique blob path
    unique_id = uuid.uuid4().hex[:12]
    safe_name = filename.replace(" ", "_")
    blob_name = f"raw_videos/{unique_id}_{safe_name}"

    # generate V4 signed URL (Cloud Run-safe: uses ADC token, no JSON key needed) 
    blob = _bucket.blob(blob_name)  # type: ignore[union-attr]
    try:
        _auth_request = google.auth.transport.requests.Request()
        _credentials, _ = google.auth.default()
        _credentials.refresh(_auth_request)
        signed_url: str = blob.generate_signed_url(
            version="v4",
            expiration=_SIGNED_URL_EXPIRY,
            method="PUT",
            content_type=content_type,
            service_account_email=_credentials.service_account_email,
            access_token=_credentials.token,
        )
    except Exception as exc:
        logger.error("Failed to generate signed URL: %s", exc)
        raise HTTPException(status_code=500, detail="Could not generate upload URL.") from exc

    # database record (UPLOADING) 
    submission = VideoSubmission(
        player_id=current_user.id,
        coach_id=current_user.id,           # placeholder — reassigned later
        original_filename=filename,
        video_url=blob_name,                 # GCS object path (not a local path)
        analysis_type=analysis_type,
        status=SubmissionStatus.PENDING,     # closest valid state
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    logger.info(
        "Signed URL generated — user=%s blob=%s submission=%s",
        current_user.id,
        blob_name,
        submission.id,
    )

    return SignedUrlResponse(
        signed_url=signed_url,
        blob_name=blob_name,
        submission_id=submission.id,
    )


# POST /confirm-upload  (optional — frontend calls after PUT succeeds)
@router.post("/confirm-upload", response_model=ConfirmUploadResponse)
def confirm_upload(
    submission_id: str = Query(..., description="Submission ID returned by /upload-url"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConfirmUploadResponse:
    """
    Mark a submission's upload as complete.  The frontend calls this after
    the direct GCS PUT returns 200.
    """
    sub: VideoSubmission | None = (
        db.query(VideoSubmission)
        .filter(
            VideoSubmission.id == submission_id,
            VideoSubmission.player_id == current_user.id,
        )
        .first()
    )

    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    if sub.status != SubmissionStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"Submission is already in '{sub.status.value}' state.",
        )

    # Verify the blob actually exists in GCS
    if GCS_AVAILABLE:
        blob = _bucket.blob(sub.video_url)  # type: ignore[union-attr]
        if not blob.exists():
            raise HTTPException(
                status_code=400,
                detail="Upload not found in cloud storage. Please retry the upload.",
            )

    db.commit()
    db.refresh(sub)

    logger.info("Upload confirmed — submission=%s blob=%s", sub.id, sub.video_url)

    return ConfirmUploadResponse(
        submission_id=sub.id,
        status=sub.status.value,
        blob_name=sub.video_url,
    )
