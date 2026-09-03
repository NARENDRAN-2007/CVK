"""
POST /submit-outcome router
Updates actual claim outcome (paid vs denied) in Supabase claims_log for closed-loop learning.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, status, HTTPException, Depends
from ..schemas import SubmitOutcomeRequest, SubmitOutcomeResponse
from ..db import update_claim_outcome
from ..core.deps import get_current_user
import logging

logger = logging.getLogger("denialguard.outcome")
router = APIRouter(tags=["Outcome Tracking"])


@router.post(
    "/submit-outcome",
    response_model=SubmitOutcomeResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit Final Adjudication Outcome for a Claim",
    description="Updates actual outcome (paid/denied) in claims_log for downstream reporting and model retraining feedback."
)
def submit_outcome_endpoint(
    payload: SubmitOutcomeRequest,
    current_user: dict = Depends(get_current_user)
) -> SubmitOutcomeResponse:
    updated_row = update_claim_outcome(
        claim_id=payload.claim_id,
        actual_outcome=payload.actual_outcome,
        denial_flag=payload.denial_flag
    )

    if not updated_row:
        raise HTTPException(
            status_code=404,
            detail="Claim ID not found"
        )

    return SubmitOutcomeResponse(
        status="success",
        claim_id=payload.claim_id,
        actual_outcome=payload.actual_outcome,
        denial_flag=payload.denial_flag,
        updated_at=datetime.now(timezone.utc).isoformat()
    )
