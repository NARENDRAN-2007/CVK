"""
GET /claims-log router
Provides recent claims logs ordered by creation timestamp for dashboard reads and audits.
"""

from typing import List, Any, Dict
from fastapi import APIRouter, Query, status, Depends, HTTPException
from ..db import fetch_claims_log, delete_claim_log
from ..core.deps import get_current_user

router = APIRouter(tags=["Claims Audit Log"])


@router.get(
    "/claims-log",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Retrieve Recent Claims Audit Log",
    description="Returns most recent claim predictions, risk scores, and adjudications ordered by created_at desc."
)
def get_claims_log(
    limit: int = Query(default=50, ge=1, le=500, description="Max number of records to return"),
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    records = fetch_claims_log(limit=limit)
    return records


@router.delete(
    "/claims-log/{claim_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Claim Record",
    description="Deletes a claim record from the audit log and cloud persistence."
)
def delete_claim(
    claim_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    success = delete_claim_log(claim_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found or could not be deleted")
    return {"message": "Claim deleted successfully", "claim_id": claim_id}

