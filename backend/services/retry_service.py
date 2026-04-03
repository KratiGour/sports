"""
Retry Service with Exponential Backoff
Handles retries for transient failures in OCR processing
"""

import time
import logging
import random
from typing import Callable, Any, Optional
from functools import wraps

logger = logging.getLogger(__name__)


class RetryConfig:
    """Retry configuration."""
    
    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True
    ):
        """
        Initialize retry configuration.
        
        Args:
            max_attempts: Maximum number of retry attempts
            initial_delay: Initial delay in seconds
            max_delay: Maximum delay in seconds
            exponential_base: Base for exponential backoff (2.0 = double each time)
            jitter: Add random jitter to prevent thundering herd
        """
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
    
    def get_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt number."""
        # Exponential backoff: delay = initial * (base ^ attempt)
        delay = self.initial_delay * (self.exponential_base ** (attempt - 1))
        
        # Cap at max_delay
        delay = min(delay, self.max_delay)
        
        # Add jitter (random ±25%)
        if self.jitter:
            jitter_range = delay * 0.25
            delay = delay + random.uniform(-jitter_range, jitter_range)
        
        return max(0, delay)


def with_retry(
    func: Callable,
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    operation_name: Optional[str] = None,
    exceptions: tuple = (Exception,)
) -> Any:
    """
    Execute function with retry logic.
    
    Args:
        func: Function to execute
        max_attempts: Maximum retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        operation_name: Name for logging
        exceptions: Tuple of exceptions to retry on
        
    Returns:
        Function result
        
    Raises:
        Last exception if all retries fail
    """
    config = RetryConfig(
        max_attempts=max_attempts,
        initial_delay=initial_delay,
        max_delay=max_delay
    )
    
    op_name = operation_name or func.__name__
    last_exception = None
    
    for attempt in range(1, max_attempts + 1):
        try:
            logger.info(f"[{op_name}] Attempt {attempt}/{max_attempts}")
            result = func()
            
            if attempt > 1:
                logger.info(f"[{op_name}] Succeeded on attempt {attempt}")
            
            return result
            
        except exceptions as e:
            last_exception = e
            
            if attempt == max_attempts:
                logger.error(f"[{op_name}] Failed after {max_attempts} attempts: {e}")
                raise
            
            delay = config.get_delay(attempt)
            logger.warning(
                f"[{op_name}] Attempt {attempt} failed: {e}. "
                f"Retrying in {delay:.1f}s..."
            )
            time.sleep(delay)
    
    # Should never reach here, but just in case
    raise last_exception


def retry_decorator(
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: tuple = (Exception,)
):
    """
    Decorator for automatic retry on function.
    
    Usage:
        @retry_decorator(max_attempts=3)
        def my_function():
            # code that might fail
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return with_retry(
                lambda: func(*args, **kwargs),
                max_attempts=max_attempts,
                initial_delay=initial_delay,
                max_delay=max_delay,
                operation_name=func.__name__,
                exceptions=exceptions
            )
        return wrapper
    return decorator


# Predefined retry configurations
NETWORK_RETRY_CONFIG = RetryConfig(
    max_attempts=3,
    initial_delay=2.0,
    max_delay=30.0,
    exponential_base=2.0
)

OCR_RETRY_CONFIG = RetryConfig(
    max_attempts=2,
    initial_delay=5.0,
    max_delay=60.0,
    exponential_base=2.0
)

STORAGE_RETRY_CONFIG = RetryConfig(
    max_attempts=3,
    initial_delay=1.0,
    max_delay=30.0,
    exponential_base=2.0
)


# Example usage functions
@retry_decorator(max_attempts=3, initial_delay=1.0)
def download_with_retry(url: str, destination: str):
    """Download file with automatic retry."""
    import requests
    
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    
    with open(destination, 'wb') as f:
        f.write(response.content)


@retry_decorator(max_attempts=2, initial_delay=5.0)
def process_chunk_with_retry(chunk_path: str, config: dict):
    """Process video chunk with automatic retry."""
    from scripts.ocr_engine import process_chunk_worker
    
    return process_chunk_worker(chunk_path, config)
