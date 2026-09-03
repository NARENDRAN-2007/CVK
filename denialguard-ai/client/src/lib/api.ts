// Quiet Clinical Precision: keep external system wiring invisible to the visual layer; this adapter makes /predict independent from outcome logging.

export type ClaimInput = {
  claimId: string;
  claimType: string;
  payer: string;
  planType: string;
  eligibilityStatus: string;
  providerSpecialty: string;
  networkStatus: string;
  icd10: string;
  cpt: string;
  modifiers: string;
  posCode: string;
  unitsBilled: number;
  chargeAmount: number;
  paStatus: string;
  referralStatus: string;
  documentationFlag: string;
  daysToDeadline: number;
  cobFlag: boolean;
};

export type PredictionResponse = {
  denialRiskScore: number;
  predictedCarcCode: string;
  topContributingFactors: Array<{
    label: string;
    impact: number;
    direction: "positive" | "negative";
  }>;
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
  status: "Paid" | "Denied" | "Pending";
  date: string;
  carc: string;
};

const DEMO_PREDICTION: PredictionResponse = {
  denialRiskScore: 0.68,
  predictedCarcCode: "CO-197",
  topContributingFactors: [
    { label: "Prior authorization", impact: 0.31, direction: "positive" },
    { label: "Documentation flag", impact: 0.22, direction: "positive" },
    { label: "Days to filing deadline", impact: 0.12, direction: "positive" },
    { label: "Eligibility status", impact: -0.09, direction: "negative" },
  ],
  suggestedCorrectiveAction: "Attach the authorization reference and complete the operative note before submitting.",
  modelVersion: "xgb-rcm-0.9.4",
  source: "demo",
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function predictClaim(claim: ClaimInput): Promise<PredictionResponse> {
  if (!API_BASE_URL) {
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    return DEMO_PREDICTION;
  }

  const response = await postJson<PredictionResponse>("/predict", claim);
  return { ...response, source: "api" };
}

export async function submitOutcome(payload: ClaimInput & { outcome: "paid" | "denied" }): Promise<void> {
  if (!API_BASE_URL) {
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    return;
  }

  await postJson("/submit-outcome", payload);
}

export const demoClaims: ClaimLogItem[] = [
  { id: "CLM-240918", payer: "Aetna Commercial", provider: "Cardiology / Westside", amount: 1840, risk: 12, status: "Paid", date: "Sep 02, 2026", carc: "—" },
  { id: "CLM-240917", payer: "UHC Choice Plus", provider: "Orthopedics / Northline", amount: 4620, risk: 68, status: "Pending", date: "Sep 02, 2026", carc: "CO-197" },
  { id: "CLM-240916", payer: "Cigna PPO", provider: "General Surgery / Lakeside", amount: 2910, risk: 37, status: "Paid", date: "Sep 01, 2026", carc: "—" },
  { id: "CLM-240915", payer: "Humana Medicare", provider: "Neurology / Westside", amount: 7380, risk: 82, status: "Denied", date: "Sep 01, 2026", carc: "CO-16" },
  { id: "CLM-240914", payer: "BCBS TX", provider: "Radiology / Northline", amount: 960, risk: 24, status: "Paid", date: "Aug 31, 2026", carc: "—" },
];

export function getRiskLabel(score: number) {
  if (score >= 0.7) return "High risk";
  if (score >= 0.4) return "Review recommended";
  return "Low risk";
}
