import logging
from fastapi import APIRouter, status, HTTPException, Depends
from ..schemas import ClaimInput, PredictionResponse
from ..model.predict import predict_claim
from ..db import insert_claim_log, insert_notification
from ..core.deps import get_current_user

logger = logging.getLogger("denialguard.predict")
router = APIRouter(tags=["Prediction"])


@router.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK
)
def predict_claim_endpoint(
    claim_input: ClaimInput,
    current_user: dict = Depends(get_current_user)
) -> PredictionResponse:
    try:
        result = predict_claim(claim_input)
        api_response = result["api_response"]
        full_record = result["full_record"]

        workspace_id = current_user.get("workspace_id") or "ws-northstar-001"
        full_record["workspace_id"] = workspace_id

        insert_claim_log(full_record)

        if api_response.get("risk_score", 0) >= 60.0:
            carc = api_response.get("predicted_carc_code", "CO-16")
            insert_notification({
                "workspace_id": workspace_id,
                "title": f"High Denial Risk: {api_response['claim_id']}",
                "message": f"Pre-submission risk evaluated at {api_response['risk_score']:.1f}% ({carc}). Action required.",
                "type": "high_risk",
                "link": f"/claims/{api_response['claim_id']}"
            })

        return PredictionResponse(**api_response)
    except Exception as e:
        logger.error(f"Inference error during /predict: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing prediction engine: {str(e)}"
        )
