from typing import List
from fastapi import APIRouter, Depends, status
from ..schemas import NotificationItem
from ..db import get_notifications, mark_notification_read, mark_all_notifications_read
from ..core.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationItem], status_code=status.HTTP_200_OK)
def list_notifications(current_user: dict = Depends(get_current_user)) -> List[NotificationItem]:
    workspace_id = current_user.get("workspace_id")
    records = get_notifications(workspace_id)
    return [
        NotificationItem(
            id=r["id"],
            workspace_id=r.get("workspace_id", workspace_id or "ws-northstar-001"),
            title=r["title"],
            message=r["message"],
            type=r.get("type", "system"),
            is_read=bool(r.get("is_read", False)),
            created_at=r["created_at"],
            link=r.get("link")
        )
        for r in records
    ]


@router.post("/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    mark_notification_read(notification_id)
    return {"status": "success", "id": notification_id}


@router.post("/read-all", status_code=status.HTTP_200_OK)
def mark_all_read(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    mark_all_notifications_read(workspace_id)
    return {"status": "success"}
