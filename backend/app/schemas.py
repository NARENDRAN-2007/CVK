from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Literal, Any, Dict
from pydantic import BaseModel, Field


class ClaimInput(BaseModel):
    claim_id: Optional[str] = Field(default=None)
    claim_type: str = Field(...)
    payer: str = Field(...)
    plan_type: str = Field(...)
    eligibility_status: str = Field(...)
    provider_specialty: str = Field(...)
    network_status: str = Field(...)
    icd10_code: str = Field(...)
    cpt_code: str = Field(...)
    modifiers: str = Field(default="None")
    pos_code: str = Field(...)
    units_billed: int = Field(default=1, ge=1)
    charge_amount: Decimal = Field(..., gt=0)
    pa_status: str = Field(...)
    referral_status: str = Field(default="Not Required")
    documentation_flag: bool = Field(...)
    dos: date = Field(...)
    submission_date: date = Field(...)
    days_to_filing_deadline: int = Field(...)
    cob_flag: bool = Field(default=False)


class ContributingFactor(BaseModel):
    feature: str = Field(...)
    impact: float = Field(...)
    direction: Literal["increases_risk", "decreases_risk"] = Field(...)


class PredictionResponse(BaseModel):
    claim_id: str
    risk_score: float = Field(..., ge=0, le=100)
    predicted_carc_code: str = Field(...)
    top_contributing_factors: List[ContributingFactor] = Field(...)
    suggested_corrective_action: str = Field(...)


class SubmitOutcomeRequest(BaseModel):
    claim_id: str
    actual_outcome: Literal["paid", "denied"] = Field(...)
    denial_flag: bool = Field(...)


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
    email: str
    name: str
    role: str
    workspace_id: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class InviteMemberRequest(BaseModel):
    role: str = Field(default="Analyst")


class InviteMemberResponse(BaseModel):
    invite_code: str
    workspace_id: str
    role: str
    created_at: str
    expires_at: Optional[str] = None


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


class CreateAppealRequest(BaseModel):
    claim_id: str
    appeal_level: Literal["Level 1", "Level 2"] = "Level 1"
    attached_document_ids: List[str] = Field(default_factory=list)
    notes: Optional[str] = ""


class AppealResponse(BaseModel):
    id: str
    claim_id: str
    appeal_level: str
    status: Literal["drafting", "submitted", "payer_review", "resolved"]
    payer: str
    billed_amount: Decimal
    deadline: str
    attached_document_ids: List[str]
    notes: str
    created_at: str
    updated_at: str


class UpdateAppealStatusRequest(BaseModel):
    status: Literal["drafting", "submitted", "payer_review", "resolved"]


class NotificationItem(BaseModel):
    id: str
    workspace_id: str
    title: str
    message: str
    type: Literal["high_risk", "document", "invite", "appeal", "system"]
    is_read: bool
    created_at: str
    link: Optional[str] = None


class WorkspaceSettingsRequest(BaseModel):
    auto_assign: Optional[bool] = None
    default_appeal_deadline_days: Optional[int] = None
    high_risk_threshold: Optional[float] = None
    email_notifications: Optional[bool] = None
    deadline_alerts: Optional[bool] = None
    weekly_digest: Optional[bool] = None


class WorkspaceSettingsResponse(BaseModel):
    workspace_id: str
    auto_assign: bool = True
    default_appeal_deadline_days: int = 30
    high_risk_threshold: float = 60.0
    email_notifications: bool = True
    deadline_alerts: bool = True
    weekly_digest: bool = False
    updated_at: str


class SecuritySettingsRequest(BaseModel):
    session_timeout_minutes: Optional[int] = None
    audit_log_retention_days: Optional[int] = None
    enforce_ip_allowlist: Optional[bool] = None


class SecuritySettingsResponse(BaseModel):
    workspace_id: str
    session_timeout_minutes: int = 60
    audit_log_retention_days: int = 2555
    enforce_ip_allowlist: bool = False
    updated_at: str
