export type ClaimInput = {
  claimId?: string;
  claimType?: string;
  payer: string;
  planType?: string;
  eligibilityStatus?: string;
  providerSpecialty?: string;
  networkStatus?: string;
  icd10?: string;
  cpt?: string;
  modifiers?: string;
  posCode?: string;
  unitsBilled?: number;
  chargeAmount?: number;
  paStatus?: string;
  referralStatus?: string;
  documentationFlag?: boolean | string;
  daysToDeadline?: number;
  cobFlag?: boolean;
};

export type Factor = {
  label: string;
  impact: number;
  direction: "positive" | "negative" | "increases_risk" | "decreases_risk";
};

export type PredictionResponse = {
  claimId?: string;
  denialRiskScore: number;
  riskScore?: number;
  predictedCarcCode: string;
  topContributingFactors: Factor[];
  suggestedCorrectiveAction: string;
  modelVersion?: string;
  source?: "api" | "demo";
};

export type ClaimLogItem = {
  id: string;
  payer: string;
  provider: string;
  amount: number;
  risk: number;
  status: "Paid" | "Denied" | "Pending" | "Appealed";
  date: string;
  carc: string;
};

export type UserProfile = {
  id?: string;
  email: string;
  name: string;
  role: string;
  workspace_id?: string;
};

export type AppealItem = {
  id: string;
  claim_id: string;
  appeal_level: string;
  status: "drafting" | "submitted" | "payer_review" | "resolved";
  payer: string;
  billed_amount: number;
  deadline: string;
  attached_document_ids: string[];
  notes: string;
  created_at: string;
  updated_at: string;
};

export type NotificationItem = {
  id: string;
  workspace_id: string;
  title: string;
  message: string;
  type: "high_risk" | "document" | "invite" | "appeal" | "system";
  is_read: boolean;
  created_at: string;
  link?: string;
};

export type WorkspaceSettings = {
  workspace_id: string;
  auto_assign: boolean;
  default_appeal_deadline_days: number;
  high_risk_threshold: number;
  email_notifications: boolean;
  deadline_alerts: boolean;
  weekly_digest: boolean;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  work_email: string;
  name: string;
  role: string;
  workspace_id: string;
  created_at?: string;
};

export type SecuritySettings = {
  workspace_id: string;
  session_timeout_minutes: number;
  audit_log_retention_days: number;
  enforce_ip_allowlist: boolean;
  updated_at: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");


function getAuthHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loginUser(workEmail: string, password: string): Promise<{ access_token: string; token_type: string; user: UserProfile }> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ work_email: workEmail, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Invalid work email or password");
  }

  const data = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user_profile", JSON.stringify(data.user));
  }
  return data;
}

export async function registerUser(payload: {
  work_email: string;
  password: string;
  full_name: string;
  role: "Admin" | "Denial Analyst" | "Biller";
  invite_code?: string;
  workspace_name?: string;
}): Promise<{ access_token: string; token_type: string; user: UserProfile }> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Registration failed (${res.status})`);
  }

  const data = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user_profile", JSON.stringify(data.user));
  }
  return data;
}

export function getCurrentUser(): UserProfile {
  if (typeof window === "undefined") return { email: "admin@denialguard.com", name: "Alice Admin", role: "Admin", workspace_id: "ws-northstar-001" };
  const raw = localStorage.getItem("user_profile");
  if (!raw) return { email: "admin@denialguard.com", name: "Alice Admin", role: "Admin", workspace_id: "ws-northstar-001" };
  try {
    return JSON.parse(raw);
  } catch {
    return { email: "admin@denialguard.com", name: "Alice Admin", role: "Admin", workspace_id: "ws-northstar-001" };
  }
}

export function logoutUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_profile");
    window.location.href = "/sign-in";
  }
}

export async function predictClaim(claim: ClaimInput): Promise<PredictionResponse> {
  const payload = {
    claim_id: claim.claimId || undefined,
    claim_type: claim.claimType || "Professional",
    payer: claim.payer || "UnitedHealthcare",
    plan_type: claim.planType || "Commercial",
    eligibility_status: claim.eligibilityStatus || "Active",
    provider_specialty: claim.providerSpecialty || "Orthopedics",
    network_status: claim.networkStatus || "In-Network",
    icd10_code: claim.icd10 || "M17.11",
    cpt_code: claim.cpt || "27447",
    modifiers: claim.modifiers || "None",
    pos_code: claim.posCode || "11",
    units_billed: Number(claim.unitsBilled) || 1,
    charge_amount: Number(claim.chargeAmount) || 18450,
    pa_status: claim.paStatus || "Missing",
    referral_status: claim.referralStatus || "Not Required",
    documentation_flag: typeof claim.documentationFlag === "boolean" ? claim.documentationFlag : claim.documentationFlag !== "false" && claim.documentationFlag !== "0",
    dos: "2026-08-15",
    submission_date: "2026-08-20",
    days_to_filing_deadline: Number(claim.daysToDeadline) || 45,
    cob_flag: Boolean(claim.cobFlag),
  };

  const res = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Inference error (${res.status})`);
  }

  const data = await res.json();
  return {
    claimId: data.claim_id,
    denialRiskScore: data.risk_score,
    riskScore: data.risk_score,
    predictedCarcCode: data.predicted_carc_code,
    topContributingFactors: (data.top_contributing_factors || []).map((f: any) => ({
      label: f.feature,
      impact: f.impact,
      direction: f.direction === "increases_risk" ? "positive" : "negative",
    })),
    suggestedCorrectiveAction: data.suggested_corrective_action,
    modelVersion: "XGBoost + SHAP TreeExplainer (v1.3.0)",
    source: "api",
  };
}

export async function submitClaimOutcome(claimId: string, outcome: "paid" | "denied"): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/submit-outcome`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        claim_id: claimId,
        actual_outcome: outcome,
        denial_flag: outcome === "denied",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchClaimsLog(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/claims-log?limit=100`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function uploadClaimDocument(
  claimId: string,
  file: File,
  documentType: string = "clinical_chart_note"
): Promise<{ status: string; document: any; repredicted: boolean; new_prediction?: any; updated_claim?: any }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);

  const res = await fetch(`${API_BASE_URL}/claims/${claimId}/documents`, {
    method: "POST",
    headers: getAuthHeader(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Document upload failed with status ${res.status}`);
  }
  return await res.json();
}

export async function fetchClaimDocuments(claimId: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/claims/${claimId}/documents`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchAppeals(): Promise<AppealItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/appeals`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createAppeal(payload: {
  claim_id: string;
  appeal_level?: "Level 1" | "Level 2";
  attached_document_ids?: string[];
  notes?: string;
}): Promise<AppealItem> {
  const res = await fetch(`${API_BASE_URL}/appeals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      claim_id: payload.claim_id,
      appeal_level: payload.appeal_level || "Level 1",
      attached_document_ids: payload.attached_document_ids || [],
      notes: payload.notes || "",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Appeal creation failed (${res.status})`);
  }
  return await res.json();
}

export async function updateAppealStatus(
  appealId: string,
  status: "drafting" | "submitted" | "payer_review" | "resolved"
): Promise<AppealItem> {
  const res = await fetch(`${API_BASE_URL}/appeals/${appealId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update appeal status (${res.status})`);
  }
  return await res.json();
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: "POST",
      headers: getAuthHeader(),
    });
  } catch {}
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: "POST",
      headers: getAuthHeader(),
    });
  } catch {}
}

export async function fetchWorkspaceMembers(): Promise<WorkspaceMember[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/workspace/members`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function generateWorkspaceInvite(role: string = "Analyst"): Promise<{ invite_code: string; workspace_id: string; role: string }> {
  const res = await fetch(`${API_BASE_URL}/workspace/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Invite generation failed (${res.status})`);
  }
  return await res.json();
}


export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  try {
    const res = await fetch(`${API_BASE_URL}/workspace/settings`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return {
      workspace_id: "ws-northstar-001",
      auto_assign: true,
      default_appeal_deadline_days: 30,
      high_risk_threshold: 60,
      email_notifications: true,
      deadline_alerts: true,
      weekly_digest: false,
      updated_at: new Date().toISOString(),
    };
  }
}

export async function saveWorkspaceSettings(settings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
  const res = await fetch(`${API_BASE_URL}/workspace/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save workflow settings");
  }
  return await res.json();
}

export async function fetchSecuritySettings(): Promise<SecuritySettings> {
  try {
    const res = await fetch(`${API_BASE_URL}/workspace/security`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return {
      workspace_id: "ws-northstar-001",
      session_timeout_minutes: 60,
      audit_log_retention_days: 2555,
      enforce_ip_allowlist: false,
      updated_at: new Date().toISOString(),
    };
  }
}

export async function saveSecuritySettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
  const res = await fetch(`${API_BASE_URL}/workspace/security`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save security settings");
  }
  return await res.json();
}

export function getRiskLabel(score: number) {
  if (score >= 60 || (score <= 1 && score >= 0.6)) return "High risk";
  if (score >= 35 || (score <= 1 && score >= 0.35)) return "Review recommended";
  return "Low risk";
}
