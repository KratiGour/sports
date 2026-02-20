"""
Bowling Analysis Schemas for Request/Response validation.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime


# Response Schemas for Bowling Analysis
class BiometricsResponse(BaseModel):
    """Core biomechanics measurements."""
    avg_elbow_angle: float = Field(0.0, description="Average right elbow angle in degrees")
    release_consistency: float = Field(0.0, description="Wrist Y standard deviation (lower = more consistent)")


class FeedbackResponse(BaseModel):
    """AI coaching feedback."""
    summary: str
    full_text: str


class BowlingAnalysisResponse(BaseModel):
    """Full response from a bowling analysis."""
    id: str
    player_id: str
    original_filename: Optional[str] = None
    biometrics: BiometricsResponse
    feedback: FeedbackResponse
    annotated_video_url: Optional[str] = Field(None, description="URL to video with pose skeleton overlay")
    report_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BowlingAnalysisSummary(BaseModel):
    """Lightweight summary for list views."""
    id: str
    original_filename: Optional[str] = None
    avg_elbow_angle: Optional[float] = None
    release_consistency: Optional[float] = None
    report_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BowlingAnalysisListResponse(BaseModel):
    """Paginated list of analyses."""
    analyses: list[BowlingAnalysisSummary]
    total: int
