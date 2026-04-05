from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.config import get_db
from database.models.subscription import Subscription
from database.models.plan import Plan
from database.models.user import User
from utils.auth import get_current_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/subscriptions")


@router.post("/subscribe")
def subscribe(
    user_id: str,
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Users can only subscribe themselves (admins can subscribe anyone)
    if current_user.role != "ADMIN" and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot subscribe on behalf of another user")

    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    start = datetime.utcnow()
    end = start + timedelta(days=30)

    # Upsert — update existing subscription if one exists
    existing = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if existing:
        existing.plan_id = plan_id
        existing.start_date = start
        existing.end_date = end
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "user_id": existing.user_id, "plan_id": existing.plan_id,
                "start_date": existing.start_date, "end_date": existing.end_date}

    sub = Subscription(user_id=user_id, plan_id=plan_id, start_date=start, end_date=end)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "user_id": sub.user_id, "plan_id": sub.plan_id,
            "start_date": sub.start_date, "end_date": sub.end_date}


@router.get("/user/{user_id}")
def get_user_subscription(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN" and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if not sub:
        return None
    return {"id": sub.id, "user_id": sub.user_id, "plan_id": sub.plan_id,
            "start_date": sub.start_date, "end_date": sub.end_date}
