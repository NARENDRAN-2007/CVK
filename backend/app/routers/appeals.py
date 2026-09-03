from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from ..schemas import CreateAppealRequest, AppealResponse, UpdateAppealStatusRequest
from ..db import insert_appeal, get_appeals, update_appeal_status, get_claim_by_id, insert_notification
from ..core.deps import get_current_user

router = APIRouter(prefix="/appeals", tags=["Appeals"])


@router.get("", response_model=List[AppealResponse], status_code=status.HTTP_200_OK)
def list_appeals(current_user: dict = Depends(get_current_user)) -> List[AppealResponse]:
    workspace_id = current_user.get("workspace_id")
    records = get_appeals(workspace_id)
    return [
        AppealResponse(
            id=r["id"],
            claim_id=r["claim_id"],
            appeal_level=r.get("appeal_level", "Level 1"),
            status=r.get("status", "drafting"),
            payer=r.get("payer", "Unknown Payer"),
            billed_amount=Decimal(str(r.get("billed_amount", "0.00"))),
            deadline=r.get("deadline", "30 days"),
            attached_document_ids=r.get("attached_document_ids", []),
            notes=r.get("notes", ""),
            created_at=r.get("created_at", datetime.now(timezone.utc).isoformat()),
            updated_at=r.get("updated_at", datetime.now(timezone.utc).isoformat())
        )
        for r in records
    ]


@router.post("", response_model=AppealResponse, status_code=status.HTTP_201_CREATED)
def create_appeal(
    request: CreateAppealRequest,
    current_user: dict = Depends(get_current_user)
) -> AppealResponse:
    workspace_id = current_user.get("workspace_id") or "ws-northstar-001"
    claim = get_claim_by_id(request.claim_id)

    payer = claim.get("payer") if claim else "Commercial Payer"
    charge = claim.get("charge_amount") if claim else Decimal("0.00")
    deadline_date = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%b %d, %Y")

    appeal_data = {
        "workspace_id": workspace_id,
        "claim_id": request.claim_id,
        "appeal_level": request.appeal_level,
        "status": "drafting",
        "payer": payer,
        "billed_amount": str(charge),
        "deadline": deadline_date,
        "attached_document_ids": request.attached_document_ids,
        "notes": request.notes or "",
        "created_by": current_user.get("sub", "")
    }

    created = insert_appeal(appeal_data)

    insert_notification({
        "workspace_id": workspace_id,
        "title": f"Appeal Drafted: {request.claim_id}",
        "message": f"{request.appeal_level} appeal draft initiated for {payer} ({created['id']}).",
        "type": "appeal",
        "link": f"/appeals"
    })

    return AppealResponse(
        id=created["id"],
        claim_id=created["claim_id"],
        appeal_level=created["appeal_level"],
        status=created["status"],
        payer=created["payer"],
        billed_amount=Decimal(str(created["billed_amount"])),
        deadline=created["deadline"],
        attached_document_ids=created["attached_document_ids"],
        notes=created["notes"],
        created_at=created["created_at"],
        updated_at=created["updated_at"]
    )


@router.patch("/{appeal_id}/status", response_model=AppealResponse, status_code=status.HTTP_200_OK)
def patch_appeal_status(
    appeal_id: str,
    request: UpdateAppealStatusRequest,
    current_user: dict = Depends(get_current_user)
) -> AppealResponse:
    updated = update_appeal_status(appeal_id, request.status)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Appeal with ID '{appeal_id}' not found")

    insert_notification({
        "workspace_id": updated.get("workspace_id") or "ws-northstar-001",
        "title": f"Appeal Status Updated: {appeal_id}",
        "message": f"Appeal moved to '{request.status}' stage for claim {updated.get('claim_id')}.",
        "type": "appeal",
        "link": f"/appeals"
    })

    return AppealResponse(
        id=updated["id"],
        claim_id=updated["claim_id"],
        appeal_level=updated.get("appeal_level", "Level 1"),
        status=updated["status"],
        payer=updated.get("payer", "Commercial Payer"),
        billed_amount=Decimal(str(updated.get("billed_amount", "0.00"))),
        deadline=updated.get("deadline", "30 days"),
        attached_document_ids=updated.get("attached_document_ids", []),
        notes=updated.get("notes", ""),
        created_at=updated.get("created_at", datetime.now(timezone.utc).isoformat()),
        updated_at=updated.get("updated_at", datetime.now(timezone.utc).isoformat())
    )
