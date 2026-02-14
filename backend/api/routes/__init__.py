"""
API Routes Package

Routes:
- auth: Authentication (register, login, logout)
- videos: Video upload, listing, events
- jobs: OCR processing job management
- requests: Match request voting system
- bowling: Bowling biomechanics analysis (optional, requires MediaPipe)
"""
from . import auth, videos, jobs, requests

# Try to import bowling feature (optional - requires MediaPipe)
try:
    from . import bowling
    BOWLING_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Bowling analysis feature disabled due to import error: {e}")
    bowling = None
    BOWLING_AVAILABLE = False

__all__ = ["auth", "videos", "jobs", "requests", "bowling", "BOWLING_AVAILABLE"]

