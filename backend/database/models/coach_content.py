import uuid
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func
from database.config import Base


class CoachContent(Base):
    __tablename__ = "coach_content"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    coach_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Content type: image | video | article
    content_type = Column(String(20), nullable=False)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # For image / video uploads
    file_url = Column(String(512), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)   # bytes
    mime_type = Column(String(100), nullable=True)

    # For articles
    article_body = Column(Text, nullable=True)

    # Thumbnail (auto-set for images, optional for video/article)
    thumbnail_url = Column(String(512), nullable=True)

    is_public = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "coach_id": self.coach_id,
            "content_type": self.content_type,
            "title": self.title,
            "description": self.description,
            "file_url": self.file_url,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "article_body": self.article_body,
            "thumbnail_url": self.thumbnail_url,
            "is_public": self.is_public,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
