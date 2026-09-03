"""
POST /predict router
Accepts 20 raw input fields, performs ML inference + SHAP explanation,
logs row to Supabase asynchronously/resiliently, and returns PredictionResponse.
"""

from fastapi import APIRouter, status, HTTPException, Depends
from ..schemas import ClaimInput, PredictionResponse
from ..model.predict import predict_claim
from ..db import insert_claim_log
from ..core.deps import get_current_user
import logging

logger = logging.getLogger("denialguard.predict")
router = APIRouter(tags=["Prediction"])


@router.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict Healthcare Claim Denial Risk and Explain Drivers",
    description="Calculates pre-submission denial probability (0-100), SHAP feature importance, predicted CARC reason code, and actionable fixes."
)
def predict_claim_endpoint(
    claim_input: ClaimInput,
    current_user: dict = Depends(get_current_user)
) -> PredictionResponse:
    try:
        # Run ML inference + SHAP explanation + feature lookups
        result = predict_claim(claim_input)
        api_response = result["api_response"]
        full_record = result["full_record"]

        # Resilient logging to Supabase (does not fail request if Supabase is offline)
        try:
            insert_claim_log(full_record)
        except Exception as db_err:
            logger.warning(f"Non-fatal error logging claim {full_record.get('claim_id')} to Supabase: {db_err}")

        return PredictionResponse(**api_response)
    except Exception as e:
        logger.error(f"Inference error during /predict: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing prediction engine: {str(e)}"
        )
