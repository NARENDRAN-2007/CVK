import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from ..schemas import DocumentUploadResponse, ClaimDocumentItem, PredictionResponse, ClaimInput
from ..db import insert_claim_document, get_claim_documents, get_claim_by_id, upsert_claim_log
from ..model.predict import predict_claim
from ..core.deps import get_current_user

router = APIRouter(prefix="/claims", tags=["Documents"])


@router.post("/{claim_id}/documents", response_model=DocumentUploadResponse, status_code=status.HTTP_200_OK)
async def upload_document(
    claim_id: str,
    file: UploadFile = File(...),
    document_type: str = Form("clinical_chart_note"),
    current_user: dict = Depends(get_current_user)
) -> DocumentUploadResponse:
    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    storage_path = f"s3://denialguard-claims/{claim_id}/{file.filename}"
    now_iso = datetime.now(timezone.utc).isoformat()

    doc_record = {
        "id": doc_id,
        "claim_id": claim_id,
        "document_type": document_type,
        "document_title": file.filename,
        "storage_path": storage_path,
        "uploaded_at": now_iso
    }

    insert_claim_document(doc_record)

    existing_claim = get_claim_by_id(claim_id)
    new_prediction_obj: Optional[PredictionResponse] = None

    if existing_claim:
        claim_input = ClaimInput(
            claim_id=claim_id,
            claim_type=existing_claim.get("claim_type") or "Professional",
            payer=existing_claim.get("payer") or "UnitedHealthcare",
            plan_type=existing_claim.get("plan_type") or "Commercial",
            eligibility_status=existing_claim.get("eligibility_status") or "Active",
            provider_specialty=existing_claim.get("provider_specialty") or "Orthopedics",
            network_status=existing_claim.get("network_status") or "In-Network",
            icd10_code=existing_claim.get("icd10_code") or "M17.11",
            cpt_code=existing_claim.get("cpt_code") or "27447",
            modifiers=existing_claim.get("modifiers") or "None",
            pos_code=existing_claim.get("pos_code") or "11",
            units_billed=int(existing_claim.get("units_billed") or 1),
            charge_amount=Decimal(str(existing_claim.get("charge_amount") or "18450")),
            pa_status=existing_claim.get("pa_status") or "Approved",
            referral_status=existing_claim.get("referral_status") or "Not Required",
            documentation_flag=True,
            dos=date.fromisoformat(str(existing_claim.get("dos") or "2026-08-15")),
            submission_date=date.fromisoformat(str(existing_claim.get("submission_date") or "2026-08-20")),
            days_to_filing_deadline=int(existing_claim.get("days_to_filing_deadline") or 45),
            cob_flag=bool(existing_claim.get("cob_flag") or False)
        )

        res = predict_claim(claim_input)
        api_res = res["api_response"]
        full_rec = res["full_record"]

        new_prediction_obj = PredictionResponse(**api_res)

        existing_claim.update(full_rec)
        upsert_claim_log(existing_claim)

    return DocumentUploadResponse(
        status="success",
        document=ClaimDocumentItem(
            id=doc_id,
            claim_id=claim_id,
            document_type=document_type,
            document_title=file.filename,
            storage_path=storage_path,
            uploaded_at=now_iso
        ),
        repredicted=bool(new_prediction_obj is not None),
        new_prediction=new_prediction_obj
    )


@router.get("/{claim_id}/documents", response_model=List[ClaimDocumentItem], status_code=status.HTTP_200_OK)
def list_documents(
    claim_id: str,
    current_user: dict = Depends(get_current_user)
) -> List[ClaimDocumentItem]:
    docs = get_claim_documents(claim_id)
    return [
        ClaimDocumentItem(
            id=d["id"],
            claim_id=d["claim_id"],
            document_type=d["document_type"],
            document_title=d["document_title"],
            storage_path=d["storage_path"],
            uploaded_at=d["uploaded_at"]
        )
        for d in docs
    ]
