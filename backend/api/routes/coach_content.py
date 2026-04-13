import os
import secrets
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.config import get_db
from database.models.coach_content import CoachContent
from utils.auth import get_current_user
from database.models.user import User

router = APIRouter(prefix="/coach/content", tags=["coach-content"])

STORAGE_DIR = Path("storage/coach_content")
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_VIDEO = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
MAX_IMAGE_SIZE = 20 * 1024 * 1024   # 20 MB
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500 MB


def _require_coach(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("COACH", "ADMIN"):
        raise HTTPException(status_code=403, detail="Coach access required")
    return current_user


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/")
def list_content(
    content_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_coach),
):
    q = db.query(CoachContent).filter(CoachContent.coach_id == current_user.id)
    if content_type:
        q = q.filter(CoachContent.content_type == content_type)
    items = q.order_by(CoachContent.created_at.desc()).all()
    return {"content": [i.to_dict() for i in items], "total": len(items)}


# ── Upload image or video ─────────────────────────────────────────────────────

@router.post("/upload")
async def upload_content(
    title: str = Form(...),
    content_type: str = Form(...),   # "image" | "video"
    description: str = Form(""),
    is_public: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_coach),
):
    if content_type not in ("image", "video"):
        raise HTTPException(status_code=400, detail="content_type must be 'image' or 'video'")

    ext = os.path.splitext(file.filename or "")[1].lower()

    if content_type == "image" and ext not in ALLOWED_IMAGE:
        raise HTTPException(status_code=400, detail=f"Allowed image types: {', '.join(ALLOWED_IMAGE)}")
    if content_type == "video" and ext not in ALLOWED_VIDEO:
        raise HTTPException(status_code=400, detail=f"Allowed video types: {', '.join(ALLOWED_VIDEO)}")

    data = await file.read()
    max_size = MAX_IMAGE_SIZE if content_type == "image" else MAX_VIDEO_SIZE
    if len(data) > max_size:
        raise HTTPException(status_code=413, detail=f"File too large. Max: {max_size // (1024*1024)} MB")

    unique_name = f"{secrets.token_urlsafe(16)}{ext}"
    save_path = STORAGE_DIR / unique_name
    with open(save_path, "wb") as f:
        f.write(data)

    file_url = f"/static/coach_content/{unique_name}"
    thumbnail_url = file_url if content_type == "image" else None

    item = CoachContent(
        coach_id=current_user.id,
        content_type=content_type,
        title=title.strip(),
        description=description.strip() or None,
        file_url=file_url,
        file_name=file.filename,
        file_size=len(data),
        mime_type=file.content_type,
        thumbnail_url=thumbnail_url,
        is_public=is_public,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item.to_dict()


# ── Create article ────────────────────────────────────────────────────────────

class ArticleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    article_body: str
    is_public: bool = True


@router.post("/article")
def create_article(
    body: ArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_coach),
):
    if not body.title.strip() or not body.article_body.strip():
        raise HTTPException(status_code=400, detail="Title and body are required")

    item = CoachContent(
        coach_id=current_user.id,
        content_type="article",
        title=body.title.strip(),
        description=body.description,
        article_body=body.article_body.strip(),
        is_public=body.is_public,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item.to_dict()


# ── Update ────────────────────────────────────────────────────────────────────

class ContentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    article_body: Optional[str] = None
    is_public: Optional[bool] = None


@router.put("/{content_id}")
def update_content(
    content_id: str,
    body: ContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_coach),
):
    item = db.query(CoachContent).filter(
        CoachContent.id == content_id,
        CoachContent.coach_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item.to_dict()


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{content_id}")
def delete_content(
    content_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_coach),
):
    item = db.query(CoachContent).filter(
        CoachContent.id == content_id,
        CoachContent.coach_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    # Remove file from disk
    if item.file_url:
        file_name = item.file_url.split("/")[-1]
        file_path = STORAGE_DIR / file_name
        if file_path.exists():
            file_path.unlink()

    db.delete(item)
    db.commit()
    return {"detail": "Deleted"}


# ── Toggle visibility ─────────────────────────────────────────────────────────

@router.patch("/{content_id}/visibility")
def toggle_visibility(
    content_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_coach),
):
    item = db.query(CoachContent).filter(
        CoachContent.id == content_id,
        CoachContent.coach_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    item.is_public = not item.is_public
    db.commit()
    db.refresh(item)
    return {"id": item.id, "is_public": item.is_public}
