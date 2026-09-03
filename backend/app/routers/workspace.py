from typing import List
from fastapi import APIRouter, Depends, status
from ..schemas import (
    InviteMemberRequest,
    InviteMemberResponse,
    WorkspaceSettingsRequest,
    WorkspaceSettingsResponse,
    SecuritySettingsRequest,
    SecuritySettingsResponse,
    WorkspaceMemberItem
)
from ..db import (
    create_workspace_invite,
    get_workspace_settings,
    save_workspace_settings,
    get_security_settings,
    save_security_settings,
    get_workspace_members
)
from ..core.deps import get_current_user

router = APIRouter(prefix="/workspace", tags=["Workspace"])


@router.get("/members", response_model=List[WorkspaceMemberItem], status_code=status.HTTP_200_OK)
def list_workspace_members(current_user: dict = Depends(get_current_user)) -> List[WorkspaceMemberItem]:
    workspace_id = current_user.get("workspace_id") or "ws-northstar-001"
    members = get_workspace_members(workspace_id)
    return [WorkspaceMemberItem(**m) for m in members]


@router.post("/invite", response_model=InviteMemberResponse, status_code=status.HTTP_200_OK)
def create_invite(
    request: InviteMemberRequest,
    current_user: dict = Depends(get_current_user)
) -> InviteMemberResponse:
    workspace_id = current_user.get("workspace_id") or "ws-northstar-001"
    invite = create_workspace_invite(workspace_id=workspace_id, role=request.role)

    return InviteMemberResponse(
        invite_code=invite["invite_code"],
        workspace_id=invite["workspace_id"],
        role=invite["role"],
        created_at=invite["created_at"],
        expires_at=invite.get("expires_at")
    )


@router.get("/settings", response_model=WorkspaceSettingsResponse, status_code=status.HTTP_200_OK)
def read_settings(current_user: dict = Depends(get_current_user)) -> WorkspaceSettingsResponse:
    workspace_id = current_user.get("workspace_id") or "ws-northstar-001"
    settings = get_workspace_settings(workspace_id)
    return WorkspaceSettingsResponse(**settings)


@router.post("/settings", response_model=WorkspaceSettingsResponse, status_code=status.HTTP_200_OK)
def update_settings(
    request: WorkspaceSettingsRequest,
    current_user: dict = Depends(get_current_user)
) -> WorkspaceSettingsResponse:
    workspace_id = current_user.get("workspace_id") or "ws-northstar-001"
    payload = request.model_dump(exclude_unset=True)
    success, saved = save_workspace_settings(workspace_id, payload)
    if not success:
        import logging
        logging.getLogger("denialguard.workspace").warning(
            f"[Workspace] Workspace settings for {workspace_id} updated in-memory but failed to persist to Supabase."
        )
    return WorkspaceSettingsResponse(**saved)


@router.get("/security", response_model=SecuritySettingsResponse, status_code=status.HTTP_200_OK)
def read_security_settings(current_user: dict = Depends(get_current_user)) -> SecuritySettingsResponse:
    workspace_id = current_user.get("workspace_id") or "ws-northstar-001"
    settings = get_security_settings(workspace_id)
    return SecuritySettingsResponse(**settings)


@router.post("/security", response_model=SecuritySettingsResponse, status_code=status.HTTP_200_OK)
def update_security_settings(
    request: SecuritySettingsRequest,
    current_user: dict = Depends(get_current_user)
) -> SecuritySettingsResponse:
    workspace_id = current_user.get("workspace_id") or "ws-northstar-001"
    payload = request.model_dump(exclude_unset=True)
    success, saved = save_security_settings(workspace_id, payload)
    if not success:
        import logging
        logging.getLogger("denialguard.workspace").warning(
            f"[Workspace] Security settings for {workspace_id} updated in-memory but failed to persist to Supabase."
        )
    return SecuritySettingsResponse(**saved)

