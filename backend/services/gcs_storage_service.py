"""
GCS Storage Manager for Cricket Highlight Generator
Handles all GCS upload/download operations with proper lifecycle management
"""

import os
import logging
import tempfile
from typing import Optional, List
from pathlib import Path

from google.cloud import storage
from google.cloud.exceptions import NotFound

logger = logging.getLogger(__name__)


class GCSStorageManager:
    """Manages GCS operations for video processing pipeline."""
    
    def __init__(self, bucket_name: str, project_id: Optional[str] = None):
        """
        Initialize GCS client.
        
        Args:
            bucket_name: GCS bucket name
            project_id: GCP project ID (optional)
        """
        self.client = storage.Client(project=project_id)
        self.bucket_name = bucket_name
        self.bucket = self.client.bucket(bucket_name)
        
        logger.info(f"GCSStorageManager initialized: gs://{bucket_name}")
    
    def upload_video(
        self,
        local_path: str,
        video_id: str,
        folder: str = "raw"
    ) -> str:
        """
        Upload video to GCS.
        
        Args:
            local_path: Path to local video file
            video_id: Video identifier
            folder: GCS folder (raw/preprocessed/highlights)
            
        Returns:
            GCS URI (gs://bucket/folder/video_id.mp4)
        """
        ext = Path(local_path).suffix
        blob_name = f"{folder}/{video_id}{ext}"
        blob = self.bucket.blob(blob_name)
        
        logger.info(f"Uploading {local_path} → gs://{self.bucket_name}/{blob_name}")
        
        # Upload with resumable upload for large files
        blob.upload_from_filename(local_path, timeout=600)
        
        gcs_uri = f"gs://{self.bucket_name}/{blob_name}"
        logger.info(f"Upload complete: {gcs_uri}")
        
        return gcs_uri
    
    def download_video(
        self,
        video_id: str,
        folder: str = "raw",
        local_dir: Optional[str] = None
    ) -> str:
        """
        Download video from GCS to local temp directory.
        
        Args:
            video_id: Video identifier
            folder: GCS folder
            local_dir: Local directory (defaults to temp dir)
            
        Returns:
            Local file path
        """
        # Find blob (try .mp4, .mkv, .avi extensions)
        blob = None
        blob_name = None
        
        for ext in ['.mp4', '.mkv', '.avi']:
            try:
                test_blob_name = f"{folder}/{video_id}{ext}"
                test_blob = self.bucket.blob(test_blob_name)
                if test_blob.exists():
                    blob = test_blob
                    blob_name = test_blob_name
                    break
            except:
                continue
        
        if not blob:
            raise FileNotFoundError(f"Video {video_id} not found in gs://{self.bucket_name}/{folder}/")
        
        # Create local path
        if local_dir is None:
            local_dir = tempfile.gettempdir()
        
        ext = Path(blob_name).suffix
        local_path = os.path.join(local_dir, f"{video_id}{ext}")
        
        logger.info(f"Downloading gs://{self.bucket_name}/{blob_name} → {local_path}")
        
        # Download
        blob.download_to_filename(local_path, timeout=600)
        
        logger.info(f"Download complete: {local_path} ({os.path.getsize(local_path) / 1e9:.2f} GB)")
        
        return local_path
    
    def upload_clips(
        self,
        local_clips: List[str],
        video_id: str
    ) -> List[str]:
        """
        Upload multiple clips to GCS.
        
        Args:
            local_clips: List of local clip paths
            video_id: Video identifier
            
        Returns:
            List of GCS URIs
        """
        gcs_uris = []
        
        for clip_path in local_clips:
            clip_name = Path(clip_path).name
            blob_name = f"clips/{video_id}/{clip_name}"
            blob = self.bucket.blob(blob_name)
            
            blob.upload_from_filename(clip_path, timeout=300)
            gcs_uri = f"gs://{self.bucket_name}/{blob_name}"
            gcs_uris.append(gcs_uri)
        
        logger.info(f"Uploaded {len(gcs_uris)} clips for video {video_id}")
        
        return gcs_uris
    
    def upload_highlight(
        self,
        local_path: str,
        video_id: str
    ) -> str:
        """
        Upload final highlight supercut to GCS.
        
        Args:
            local_path: Path to local highlight video
            video_id: Video identifier
            
        Returns:
            GCS URI
        """
        blob_name = f"highlights/{video_id}.mp4"
        blob = self.bucket.blob(blob_name)
        
        # Set content type
        blob.content_type = "video/mp4"
        
        # Make publicly readable (optional)
        # blob.make_public()
        
        blob.upload_from_filename(local_path, timeout=600)
        
        gcs_uri = f"gs://{self.bucket_name}/{blob_name}"
        logger.info(f"Uploaded highlight: {gcs_uri}")
        
        return gcs_uri
    
    def delete_temp_files(self, video_id: str):
        """
        Delete temporary files for a video.
        
        Args:
            video_id: Video identifier
        """
        prefixes = [
            f"temp/{video_id}/",
            f"preprocessed/{video_id}"
        ]
        
        deleted_count = 0
        
        for prefix in prefixes:
            blobs = self.bucket.list_blobs(prefix=prefix)
            for blob in blobs:
                blob.delete()
                deleted_count += 1
        
        logger.info(f"Deleted {deleted_count} temp files for video {video_id}")
    
    def get_signed_url(
        self,
        blob_name: str,
        expiration_minutes: int = 60
    ) -> str:
        """
        Generate signed URL for private file access.
        
        Args:
            blob_name: Blob path in bucket
            expiration_minutes: URL validity duration
            
        Returns:
            Signed URL
        """
        blob = self.bucket.blob(blob_name)
        
        url = blob.generate_signed_url(
            version="v4",
            expiration=expiration_minutes * 60,
            method="GET"
        )
        
        return url
    
    def list_videos(self, folder: str = "highlights") -> List[str]:
        """
        List all videos in a folder.
        
        Args:
            folder: GCS folder
            
        Returns:
            List of video IDs
        """
        blobs = self.bucket.list_blobs(prefix=f"{folder}/")
        
        video_ids = []
        for blob in blobs:
            # Extract video_id from path
            name = Path(blob.name).stem
            video_ids.append(name)
        
        return video_ids
    
    def file_exists(self, blob_name: str) -> bool:
        """Check if file exists in GCS."""
        blob = self.bucket.blob(blob_name)
        return blob.exists()


# Convenience functions
def upload_to_gcs(
    local_path: str,
    bucket_name: str,
    blob_name: str
) -> str:
    """
    Quick upload to GCS.
    
    Args:
        local_path: Local file path
        bucket_name: GCS bucket
        blob_name: Target blob name
        
    Returns:
        GCS URI
    """
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    
    blob.upload_from_filename(local_path)
    
    return f"gs://{bucket_name}/{blob_name}"


def download_from_gcs(
    gcs_uri: str,
    local_path: str
):
    """
    Quick download from GCS.
    
    Args:
        gcs_uri: GCS URI (gs://bucket/path)
        local_path: Local destination path
    """
    # Parse GCS URI
    if not gcs_uri.startswith("gs://"):
        raise ValueError("Invalid GCS URI")
    
    parts = gcs_uri[5:].split("/", 1)
    bucket_name = parts[0]
    blob_name = parts[1]
    
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    
    blob.download_to_filename(local_path)
