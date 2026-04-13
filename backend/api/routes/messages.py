from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from pydantic import BaseModel
from typing import List, Optional
from database.config import get_db
from database.models.user import User
from database.models.message import Message
from database.models.submission import VideoSubmission
from utils.auth import get_current_user

router = APIRouter(prefix="/messages", tags=["messages"])


class SendMessageRequest(BaseModel):
    player_id: str
    content: str


class MessageOut(BaseModel):
    id: str
    coach_id: str
    player_id: str
    sender_id: str
    content: str
    is_read: bool
    created_at: Optional[str]


class PlayerConversation(BaseModel):
    player_id: str
    player_name: str
    player_email: str
    last_message: Optional[str]
    last_message_at: Optional[str]
    unread_count: int


def _require_coach(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("COACH", "ADMIN"):
        raise HTTPException(status_code=403, detail="Coach access required")
    return current_user


@router.get("/players", response_model=List[PlayerConversation])
def list_players_with_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_coach),
):
    """Return all players who have submitted to this coach, with last message info."""
    # Get distinct player IDs from submissions
    submission_player_ids = (
        db.query(VideoSubmission.player_id)
        .filter(VideoSubmission.coach_id == current_user.id)
        .distinct()
        .all()
    )
    player_ids = [row[0] for row in submission_player_ids]

    # Also include players who have messaged this coach even without submissions
    messaged_player_ids = (
        db.query(Message.player_id)
        .filter(Message.coach_id == current_user.id)
        .distinct()
        .all()
    )
    for row in messaged_player_ids:
        if row[0] not in player_ids:
            player_ids.append(row[0])

    if not player_ids:
        return []

    players = db.query(User).filter(User.id.in_(player_ids)).all()

    result = []
    for player in players:
        # Last message in this conversation
        last_msg = (
            db.query(Message)
            .filter(
                Message.coach_id == current_user.id,
                Message.player_id == player.id,
            )
            .order_by(Message.created_at.desc())
            .first()
        )
        # Unread count (messages sent by player, not yet read)
        unread = (
            db.query(Message)
            .filter(
                Message.coach_id == current_user.id,
                Message.player_id == player.id,
                Message.sender_id == player.id,
                Message.is_read == False,
            )
            .count()
        )
        result.append(
            PlayerConversation(
                player_id=player.id,
                player_name=player.name,
                player_email=player.email,
                last_message=last_msg.content if last_msg else None,
                last_message_at=last_msg.created_at.isoformat() if last_msg and last_msg.created_at else None,
                unread_count=unread,
            )
        )

    # Sort by last message time descending
    result.sort(key=lambda x: x.last_message_at or "", reverse=True)
    return result


@router.get("/conversation/{player_id}", response_model=List[MessageOut])
def get_conversation(
    player_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_coach),
):
    """Fetch all messages in a coach-player conversation."""
    player = db.query(User).filter(User.id == player_id, User.role == "PLAYER").first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    messages = (
        db.query(Message)
        .filter(
            Message.coach_id == current_user.id,
            Message.player_id == player_id,
        )
        .order_by(Message.created_at.asc())
        .all()
    )

    # Mark player's messages as read
    db.query(Message).filter(
        Message.coach_id == current_user.id,
        Message.player_id == player_id,
        Message.sender_id == player_id,
        Message.is_read == False,
    ).update({"is_read": True})
    db.commit()

    return [MessageOut(**m.to_dict()) for m in messages]


@router.post("/send", response_model=MessageOut)
def send_message(
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_coach),
):
    """Coach sends a message to a player."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    player = db.query(User).filter(User.id == body.player_id, User.role == "PLAYER").first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    msg = Message(
        coach_id=current_user.id,
        player_id=body.player_id,
        sender_id=current_user.id,
        content=body.content.strip(),
        is_read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return MessageOut(**msg.to_dict())


# ── Player-side endpoints ──────────────────────────────────────────────────────

@router.get("/player/coaches", response_model=List[PlayerConversation])
def player_list_coaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Player: list coaches they have conversations with."""
    if current_user.role != "PLAYER":
        raise HTTPException(status_code=403, detail="Player access required")

    coach_ids_from_submissions = (
        db.query(VideoSubmission.coach_id)
        .filter(VideoSubmission.player_id == current_user.id)
        .distinct()
        .all()
    )
    coach_ids = [row[0] for row in coach_ids_from_submissions]

    messaged_coach_ids = (
        db.query(Message.coach_id)
        .filter(Message.player_id == current_user.id)
        .distinct()
        .all()
    )
    for row in messaged_coach_ids:
        if row[0] not in coach_ids:
            coach_ids.append(row[0])

    if not coach_ids:
        return []

    coaches = db.query(User).filter(User.id.in_(coach_ids)).all()
    result = []
    for coach in coaches:
        last_msg = (
            db.query(Message)
            .filter(Message.coach_id == coach.id, Message.player_id == current_user.id)
            .order_by(Message.created_at.desc())
            .first()
        )
        unread = (
            db.query(Message)
            .filter(
                Message.coach_id == coach.id,
                Message.player_id == current_user.id,
                Message.sender_id == coach.id,
                Message.is_read == False,
            )
            .count()
        )
        result.append(
            PlayerConversation(
                player_id=coach.id,
                player_name=coach.name,
                player_email=coach.email,
                last_message=last_msg.content if last_msg else None,
                last_message_at=last_msg.created_at.isoformat() if last_msg and last_msg.created_at else None,
                unread_count=unread,
            )
        )
    result.sort(key=lambda x: x.last_message_at or "", reverse=True)
    return result


@router.get("/player/conversation/{coach_id}", response_model=List[MessageOut])
def player_get_conversation(
    coach_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Player: fetch conversation with a coach."""
    if current_user.role != "PLAYER":
        raise HTTPException(status_code=403, detail="Player access required")

    messages = (
        db.query(Message)
        .filter(Message.coach_id == coach_id, Message.player_id == current_user.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    db.query(Message).filter(
        Message.coach_id == coach_id,
        Message.player_id == current_user.id,
        Message.sender_id == coach_id,
        Message.is_read == False,
    ).update({"is_read": True})
    db.commit()

    return [MessageOut(**m.to_dict()) for m in messages]


@router.post("/player/send", response_model=MessageOut)
def player_send_message(
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Player sends a message to their coach (player_id field = coach_id here)."""
    if current_user.role != "PLAYER":
        raise HTTPException(status_code=403, detail="Player access required")

    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    coach = db.query(User).filter(User.id == body.player_id, User.role.in_(["COACH", "ADMIN"])).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    msg = Message(
        coach_id=coach.id,
        player_id=current_user.id,
        sender_id=current_user.id,
        content=body.content.strip(),
        is_read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return MessageOut(**msg.to_dict())
