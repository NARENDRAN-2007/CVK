from fastapi import APIRouter, Depends, status
from ..schemas import InviteMemberRequest, InviteMemberResponse
from ..db import create_workspace_invite
from ..core.deps import get_current_user

router = APIRouter(prefix="/workspace", tags=["Workspace"])


@router.post("/invite", response_model=InviteMemberResponse, status_code=status.HTTP_200_OK)
@router.post("/invites", response_model=InviteMemberResponse, status_code=status.HTTP_200_OK)
def invite_member(
    request: InviteMemberRequest = InviteMemberRequest(),
    current_user: dict = Depends(get_current_user)
) -> InviteMemberResponse:
    workspace_id = current_user.get("workspace_id", "ws-northstar-001")
    record = create_workspace_invite(workspace_id=workspace_id, role=request.role or "Analyst")
    return InviteMemberResponse(
        invite_code=record["invite_code"],
        workspace_id=record["workspace_id"],
        role=record["role"],
        created_at=record["created_at"]
    )
