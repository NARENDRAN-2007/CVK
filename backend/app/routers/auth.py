import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, status, HTTPException, Depends
from ..schemas import LoginRequest, LoginResponse, UserResponse, CreateAccountRequest
from ..db import (
    get_user_by_email,
    insert_user,
    validate_workspace_invite,
    mark_workspace_invite_used,
    insert_notification,
    get_supabase
)
from ..core.security import verify_password, get_password_hash, create_access_token
from ..core.deps import get_current_user

logger = logging.getLogger("denialguard.auth")
router = APIRouter(tags=["Authentication"])


class _SupabaseWrapper:
    def __getattr__(self, name):
        client = get_supabase()
        if client is None:
            raise RuntimeError("Supabase not configured")
        return getattr(client, name)


supabase = _SupabaseWrapper()


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user_record = get_user_by_email(request.work_email)

    if not user_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid work email or password")

    is_valid = False
    if "password_hash" in user_record and user_record["password_hash"]:
        is_valid = verify_password(request.password, user_record["password_hash"])
    elif "password" in user_record and user_record["password"]:
        is_valid = (request.password == user_record["password"])

    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid work email or password")

    token = create_access_token({
        "sub": request.work_email.strip().lower(),
        "name": user_record.get("name") or user_record.get("full_name", ""),
        "role": user_record.get("role", "Analyst"),
        "workspace_id": user_record.get("workspace_id", "ws-northstar-001")
    })

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            email=request.work_email.strip().lower(),
            name=user_record.get("name") or user_record.get("full_name", ""),
            role=user_record.get("role", "Analyst"),
            workspace_id=user_record.get("workspace_id", "ws-northstar-001")
        )
    )


@router.post("/register", response_model=LoginResponse)
@router.post("/create-account", response_model=LoginResponse)
async def register(request: CreateAccountRequest):
    normalized_email = request.work_email.strip().lower()
    existing = get_user_by_email(normalized_email)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this work email already exists")

    target_workspace_id = None
    target_role = "Admin"

    if request.invite_code:
        status_code, invite = validate_workspace_invite(request.invite_code)
        if status_code == "not_found":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite code not found")
        elif status_code == "expired":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite code has expired")
        elif status_code == "already_used":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite code has already been used")

        target_workspace_id = invite.get("workspace_id")
        target_role = invite.get("role", "Analyst")
        mark_workspace_invite_used(request.invite_code)
    else:
        target_workspace_id = f"ws-{uuid.uuid4().hex[:8]}"
        target_role = "Admin"

    pw_hash = get_password_hash(request.password)
    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    new_user_data = {
        "id": user_id,
        "work_email": normalized_email,
        "password_hash": pw_hash,
        "name": request.full_name.strip(),
        "full_name": request.full_name.strip(),
        "role": target_role,
        "workspace_id": target_workspace_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    insert_user(new_user_data)

    if request.invite_code:
        insert_notification({
            "workspace_id": target_workspace_id,
            "title": "New Team Member Joined",
            "message": f"{request.full_name.strip()} joined the workspace as {target_role}.",
            "type": "invite"
        })

    token = create_access_token({
        "sub": normalized_email,
        "name": new_user_data["name"],
        "role": target_role,
        "workspace_id": target_workspace_id
    })

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            email=normalized_email,
            name=new_user_data["name"],
            role=target_role,
            workspace_id=target_workspace_id
        )
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    user_record = get_user_by_email(current_user.get("sub", ""))
    return UserResponse(
        email=current_user.get("sub", ""),
        name=current_user.get("name") or (user_record.get("name") if user_record else "User"),
        role=current_user.get("role", "Analyst"),
        workspace_id=current_user.get("workspace_id", "ws-northstar-001")
    )
