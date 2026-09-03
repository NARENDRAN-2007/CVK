from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Literal, Any, Dict
from pydantic import BaseModel, Field


class ClaimInput(BaseModel):
    claim_id: Optional[str] = Field(
        default=None, 
        description="Unique claim identifier. If omitted, a unique ID will be auto-generated."
    )
    claim_type: str = Field(..., description="e.g. Professional, Institutional, Dental, Vision")
    payer: str = Field(..., description="e.g. Medicare, Medicaid, UnitedHealthcare, BlueCross, Aetna, Cigna, Humana")
    plan_type: str = Field(..., description="e.g. HMO, PPO, EPO, POS, Medicare Advantage")
    eligibility_status: str = Field(..., description="e.g. Active, Inactive, Pending, Terminated")
    provider_specialty: str = Field(..., description="e.g. Cardiology, Orthopedics, General Practice, Dermatology")
    network_status: str = Field(..., description="e.g. In-Network, Out-of-Network")
    icd10_code: str = Field(..., description="ICD-10 diagnosis code, e.g. I10, E11.9, M54.5")
    cpt_code: str = Field(..., description="CPT procedure code, e.g. 99213, 99214, 27447")
    modifiers: str = Field(default="None", description="CPT modifier(s), e.g. 25, 59, LT, RT, None")
    pos_code: str = Field(..., description="Place of Service code, e.g. 11 (Office), 21 (Inpatient), 22 (Outpatient), 23 (ER), 02 (Telehealth)")
    units_billed: int = Field(default=1, ge=1, description="Number of units billed")
    charge_amount: Decimal = Field(..., gt=0, description="Total billed charge amount in USD")
    pa_status: str = Field(..., description="Prior Authorization status, e.g. Approved, Missing, Denied, Not Required, Pending")
    referral_status: str = Field(default="Not Required", description="Referral status, e.g. Active, Missing, Not Required, Expired")
    documentation_flag: bool = Field(..., description="True if required clinical documentation/notes are attached")
    dos: date = Field(..., description="Date of Service (YYYY-MM-DD)")
    submission_date: date = Field(..., description="Claim Submission Date (YYYY-MM-DD)")
    days_to_filing_deadline: int = Field(..., description="Days remaining before payer timely filing deadline")
    cob_flag: bool = Field(default=False, description="Coordination of Benefits flag (True if secondary/tertiary payer involved)")


class ContributingFactor(BaseModel):
    feature: str = Field(..., description="Feature name or description")
    impact: float = Field(..., description="SHAP feature importance magnitude")
    direction: Literal["increases_risk", "decreases_risk"] = Field(
        ..., description="Direction of risk impact"
    )


class PredictionResponse(BaseModel):
    claim_id: str
    risk_score: float = Field(..., ge=0, le=100, description="Predicted Denial Risk Score (0-100)")
    predicted_carc_code: str = Field(..., description="Predicted Claim Adjustment Reason Code (e.g. CO-197, CO-16, CO-27, CLEAN)")
    top_contributing_factors: List[ContributingFactor] = Field(
        ..., description="Top SHAP contributing features ranked by absolute impact"
    )
    suggested_corrective_action: str = Field(
        ..., description="Targeted actionable resolution before claim submission"
    )


class SubmitOutcomeRequest(BaseModel):
    claim_id: str
    actual_outcome: Literal["paid", "denied"] = Field(
        ..., description="Final claim outcome: 'paid' or 'denied'"
    )
    denial_flag: bool = Field(
        ..., description="True if claim was denied, False if paid"
    )


class SubmitOutcomeResponse(BaseModel):
    status: str
    claim_id: str
    actual_outcome: str
    denial_flag: bool
    updated_at: str


class ClaimLogRow(BaseModel):
    id: Optional[str] = None
    claim_id: str
    claim_type: Optional[str] = None
    payer: Optional[str] = None
    plan_type: Optional[str] = None
    eligibility_status: Optional[str] = None
    provider_specialty: Optional[str] = None
    network_status: Optional[str] = None
    icd10_code: Optional[str] = None
    cpt_code: Optional[str] = None
    modifiers: Optional[str] = None
    pos_code: Optional[str] = None
    units_billed: Optional[int] = None
    charge_amount: Optional[Decimal] = None
    pa_status: Optional[str] = None
    referral_status: Optional[str] = None
    documentation_flag: Optional[bool] = None
    dos: Optional[str] = None
    submission_date: Optional[str] = None
    days_to_filing_deadline: Optional[int] = None
    cob_flag: Optional[bool] = None
    hist_denial_rate_cpt_payer: Optional[float] = None
    hist_denial_rate_provider_payer: Optional[float] = None
    claim_amount_deviation: Optional[float] = None
    predicted_risk_score: Optional[float] = None
    predicted_carc_code: Optional[str] = None
    top_contributing_factors: Optional[Any] = None
    suggested_corrective_action: Optional[str] = None
    actual_outcome: Optional[str] = None
    denial_flag: Optional[bool] = None
    created_at: Optional[str] = None


UserRole = Literal["Biller", "Analyst", "Admin", "Read-only"]


class LoginRequest(BaseModel):
    work_email: str
    password: str


class CreateAccountRequest(BaseModel):
    work_email: str
    password: str
    full_name: str
    invite_code: Optional[str] = None
    workspace_name: Optional[str] = None


class UserResponse(BaseModel):
    email: str = Field(..., description="User email address")
    name: str = Field(..., description="User full display name")
    role: str = Field(..., description="User role: 'Biller', 'Analyst', 'Admin', 'Read-only'")
    workspace_id: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str = Field(..., description="JWT bearer access token")
    token_type: str = Field(default="bearer", description="Token type, e.g. bearer")
    user: UserResponse = Field(..., description="User profile information")


class InviteMemberRequest(BaseModel):
    role: Optional[str] = Field(default="Analyst", description="Role to grant: Admin, Analyst, or Biller")


class InviteMemberResponse(BaseModel):
    invite_code: str
    workspace_id: str
    role: str
    created_at: str


class ClaimDocumentItem(BaseModel):
    id: str
    claim_id: str
    document_type: str
    document_title: str
    storage_path: str
    uploaded_at: str


class DocumentUploadResponse(BaseModel):
    status: str
    document: ClaimDocumentItem
    repredicted: bool
    new_prediction: Optional[PredictionResponse] = None
