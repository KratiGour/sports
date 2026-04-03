"""
Cloud Tasks Integration for Background Job Processing
Handles async video processing jobs using Google Cloud Tasks
"""

import logging
import json
from typing import Dict, Optional
from datetime import datetime, timedelta

from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2

logger = logging.getLogger(__name__)


class CloudTasksManager:
    """Manages Cloud Tasks for background video processing."""
    
    def __init__(self, project_id: str, location: str, queue_name: str):
        """
        Initialize Cloud Tasks client.
        
        Args:
            project_id: GCP project ID
            location: GCP region (e.g., 'us-central1')
            queue_name: Cloud Tasks queue name
        """
        self.client = tasks_v2.CloudTasksClient()
        self.project_id = project_id
        self.location = location
        self.queue_name = queue_name
        
        # Queue path
        self.queue_path = self.client.queue_path(
            project_id, location, queue_name
        )
        
        logger.info(f"CloudTasksManager initialized: {self.queue_path}")
    
    def create_processing_task(
        self,
        video_id: str,
        worker_url: str,
        config: Optional[Dict] = None,
        priority: int = 0,
        delay_seconds: int = 0
    ) -> str:
        """
        Create a Cloud Task for video processing.
        
        Args:
            video_id: Video identifier
            worker_url: Worker service URL (Cloud Run)
            config: Processing configuration
            priority: Task priority (0=normal, 1=high)
            delay_seconds: Delay before execution
            
        Returns:
            Task name/ID
        """
        # Prepare task payload
        payload = {
            'video_id': video_id,
            'config': config or {},
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Convert dict to JSON bytes
        payload_bytes = json.dumps(payload).encode()
        
        # Construct the request
        task = {
            'http_request': {
                'http_method': tasks_v2.HttpMethod.POST,
                'url': f"{worker_url}/process",
                'headers': {
                    'Content-Type': 'application/json',
                },
                'body': payload_bytes,
            }
        }
        
        # Add delay if specified
        if delay_seconds > 0:
            d = datetime.utcnow() + timedelta(seconds=delay_seconds)
            timestamp = timestamp_pb2.Timestamp()
            timestamp.FromDatetime(d)
            task['schedule_time'] = timestamp
        
        # Create the task
        try:
            response = self.client.create_task(
                request={
                    "parent": self.queue_path,
                    "task": task
                }
            )
            
            task_name = response.name
            logger.info(f"Created task for video {video_id}: {task_name}")
            return task_name
            
        except Exception as e:
            logger.error(f"Failed to create task for video {video_id}: {e}")
            raise
    
    def get_queue_stats(self) -> Dict:
        """Get current queue statistics."""
        try:
            queue = self.client.get_queue(name=self.queue_path)
            
            stats = {
                'state': queue.state.name,
                'max_concurrent_dispatches': queue.rate_limits.max_concurrent_dispatches,
                'max_dispatches_per_second': queue.rate_limits.max_dispatches_per_second,
                'max_attempts': queue.retry_config.max_attempts,
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get queue stats: {e}")
            return {}
    
    def purge_queue(self):
        """Delete all tasks in the queue (for testing/cleanup)."""
        try:
            self.client.purge_queue(name=self.queue_path)
            logger.info(f"Purged queue: {self.queue_name}")
        except Exception as e:
            logger.error(f"Failed to purge queue: {e}")


# Convenience functions
def enqueue_video_processing(
    video_id: str,
    project_id: str,
    worker_url: str,
    config: Optional[Dict] = None,
    priority: bool = False
) -> str:
    """
    Enqueue a video for processing.
    
    Args:
        video_id: Video identifier
        project_id: GCP project ID
        worker_url: Worker service URL
        config: Processing configuration
        priority: Use priority queue
        
    Returns:
        Task ID
    """
    queue_name = "cricket-processing-priority" if priority else "cricket-processing-queue"
    location = "us-central1"
    
    manager = CloudTasksManager(project_id, location, queue_name)
    task_id = manager.create_processing_task(
        video_id=video_id,
        worker_url=worker_url,
        config=config
    )
    
    return task_id
