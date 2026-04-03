from database.config import SessionLocal
from database.models.submission import VideoSubmission
import sys

submission_id = sys.argv[1] if len(sys.argv) > 1 else None
if not submission_id:
    print("Usage: python check_status.py <submission_id>")
    sys.exit(1)

db = SessionLocal()
try:
    sub = db.query(VideoSubmission).filter(VideoSubmission.id == submission_id).first()
    if sub:
        print(f"Submission ID: {sub.id}")
        print(f"Status: {sub.status.value}")
        print(f"Video URL: {sub.video_url}")
        print(f"Player ID: {sub.player_id}")
    else:
        print("NOT FOUND")
finally:
    db.close()
