"""
DenialGuard AI - Real-time Prediction and Explainability Engine
Loads trained XGBoost pipeline, SHAP TreeExplainer, and historical lookup tables at import time.
Exposes predict_claim() for sub-millisecond inference and actionable explanations.
"""

import os
import uuid
import joblib
import numpy as np
import pandas as pd
import shap
from typing import Dict, Any, List
from ..schemas import ClaimInput

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(CURRENT_DIR, "model.pkl")
LOOKUPS_PATH = os.path.join(CURRENT_DIR, "feature_lookups.pkl")

# Check if model files exist
if not os.path.exists(MODEL_PATH) or not os.path.exists(LOOKUPS_PATH):
    raise FileNotFoundError(
        f"Model artifacts not found at {MODEL_PATH} or {LOOKUPS_PATH}. "
        "Please run 'python app/model/train.py' before launching the server."
    )

print("[DenialGuard AI] Loading model artifacts into memory...")
artifact = joblib.load(MODEL_PATH)
xgb_model = artifact["model"]
preprocessor = artifact["preprocessor"]
feature_names = artifact["feature_names"]
categorical_features = artifact["categorical_features"]
numerical_features = artifact["numerical_features"]

feature_lookups = joblib.load(LOOKUPS_PATH)
global_denial_rate = feature_lookups.get("global_denial_rate", 0.30)
global_mean_charge = feature_lookups.get("global_mean_charge", 250.0)
cpt_payer_rates = feature_lookups.get("cpt_payer_denial_rates", {})
provider_payer_rates = feature_lookups.get("provider_payer_denial_rates", {})
cpt_mean_charges = feature_lookups.get("cpt_mean_charges", {})

# Initialize SHAP TreeExplainer once at startup
print("[DenialGuard AI] Initializing SHAP TreeExplainer...")
explainer = shap.TreeExplainer(xgb_model)
print("[DenialGuard AI] Model & SHAP Explainer ready.")


def compute_engineered_features(input_data: Dict[str, Any]) -> Dict[str, float]:
    """
    Computes the 3 required engineered features using stored historical lookups.
    """
    cpt = str(input_data.get("cpt_code", ""))
    payer = str(input_data.get("payer", ""))
    specialty = str(input_data.get("provider_specialty", ""))
    charge = float(input_data.get("charge_amount", 0.0))

    # 1. Historical Denial Rate (CPT + Payer)
    cpt_payer_key = f"{cpt}::{payer}"
    hist_cpt_payer = float(cpt_payer_rates.get(cpt_payer_key, global_denial_rate))

    # 2. Historical Denial Rate (Provider + Payer)
    prov_payer_key = f"{specialty}::{payer}"
    hist_prov_payer = float(provider_payer_rates.get(prov_payer_key, global_denial_rate))

    # 3. Claim Amount Deviation
    mean_charge_for_cpt = float(cpt_mean_charges.get(cpt, global_mean_charge))
    claim_dev = round(charge - mean_charge_for_cpt, 2)

    return {
        "hist_denial_rate_cpt_payer": round(hist_cpt_payer, 4),
        "hist_denial_rate_provider_payer": round(hist_prov_payer, 4),
        "claim_amount_deviation": claim_dev,
    }


CLEAN_RISK_THRESHOLD = float(os.getenv("RISK_THRESHOLD", "35.0"))

def determine_carc_and_action(
    risk_score: float, 
    input_data: Dict[str, Any], 
    top_factors: List[Dict[str, Any]]
) -> tuple[str, str]:
    if risk_score < CLEAN_RISK_THRESHOLD:
        return (
            "CLEAN",
            "Claim validation passed with low denial risk. Ready for clean EDI submission."
        )

    pa_status = input_data.get("pa_status", "")
    eligibility = input_data.get("eligibility_status", "")
    doc_flag = input_data.get("documentation_flag", True)
    days_deadline = input_data.get("days_to_filing_deadline", 90)
    net_status = input_data.get("network_status", "")
    referral = input_data.get("referral_status", "")
    modifiers = input_data.get("modifiers", "None")
    cpt = input_data.get("cpt_code", "")

    # Check top negative drivers
    if eligibility in ["Inactive", "Terminated", "Pending"]:
        return (
            "CO-27",
            "Expenses incurred after coverage terminated or patient eligibility inactive. Re-verify active subscriber policy with payer before submitting."
        )

    if pa_status in ["Denied", "Missing"]:
        return (
            "CO-197",
            "Pre-certification / Prior authorization absent or denied. Obtain prior authorization approval number from payer and append to Box 23/24."
        )

    if not doc_flag:
        return (
            "CO-16",
            "Claim lacks required clinical documentation. Attach medical records, operative notes, or lab reports supporting medical necessity."
        )

    if days_deadline <= 0:
        return (
            "CO-29",
            "Timely filing limit expired. Attach proof of timely filing / prior submission confirmation with the appeal packet."
        )

    if days_deadline < 10:
        return (
            "CO-29",
            f"Submission is within {days_deadline} days of timely filing deadline. Expedite batch processing immediately to avoid time-limit denial."
        )

    if net_status == "Out-of-Network" and referral in ["Missing", "Expired"]:
        return (
            "CO-50",
            "Out-of-network service missing valid PCP referral. Obtain and document formal referral authorization prior to billing."
        )

    if cpt in ["99214", "99215", "27447"] and modifiers in ["None", ""]:
        return (
            "CO-4",
            "Procedure code may require modifier for distinct procedural service. Review bundling edits and consider appending Modifier 25 or 59."
        )

    # General high risk fallback
    return (
        "CO-97",
        "Elevated historical denial pattern for this CPT/Payer combination. Conduct secondary audit on charge amounts and diagnostic coding alignment."
    )


def predict_claim(claim_input: ClaimInput) -> Dict[str, Any]:
    """
    End-to-end inference pipeline:
    1. Prepares 20 raw input features + auto-generates claim_id if missing
    2. Computes 3 engineered features
    3. Transforms row using preprocessor
    4. Predicts probability via XGBoost
    5. Computes SHAP values via TreeExplainer
    6. Formats top 3-5 contributing factors, CARC code, and suggested action
    """
    raw_dict = claim_input.model_dump()
    
    # Ensure claim_id exists
    claim_id = raw_dict.get("claim_id")
    if not claim_id:
        claim_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"
        raw_dict["claim_id"] = claim_id

    # Compute 3 engineered features
    engineered = compute_engineered_features(raw_dict)
    
    # Merge for model row
    model_row = {**raw_dict, **engineered}
    model_row["documentation_flag"] = int(model_row["documentation_flag"])
    model_row["cob_flag"] = int(model_row["cob_flag"])

    # Create DataFrame for transform
    df_row = pd.DataFrame([model_row])
    
    # Transform using preprocessor
    X_encoded = preprocessor.transform(df_row)

    # Predict probability of denial (class 1)
    proba = float(xgb_model.predict_proba(X_encoded)[0, 1])
    risk_score = round(proba * 100.0, 1)

    # Compute SHAP explanation
    shap_values = explainer.shap_values(X_encoded)
    
    # Handle single sample shape
    if isinstance(shap_values, list):
        # Multi-class output format
        sample_shap = shap_values[1][0]
    elif len(shap_values.shape) == 2:
        sample_shap = shap_values[0]
    else:
        sample_shap = shap_values

    # Map one-hot encoded features back to aggregated raw feature names
    raw_feature_impacts: Dict[str, float] = {}
    
    for fname, shap_val in zip(feature_names, sample_shap):
        # Extract base feature name
        base_name = fname
        for cat in categorical_features:
            if fname.startswith(f"{cat}_"):
                base_name = cat
                break
        
        raw_feature_impacts[base_name] = raw_feature_impacts.get(base_name, 0.0) + float(shap_val)

    # Sort features by absolute SHAP impact
    sorted_factors = sorted(
        raw_feature_impacts.items(),
        key=lambda item: abs(item[1]),
        reverse=True
    )

    # Format top 4 contributing factors
    top_contributing = []
    display_names = {
        "pa_status": "Prior Authorization Status",
        "eligibility_status": "Patient Eligibility Status",
        "documentation_flag": "Clinical Documentation Attached",
        "days_to_filing_deadline": "Days to Filing Deadline",
        "hist_denial_rate_cpt_payer": "Historical CPT-Payer Denial Rate",
        "hist_denial_rate_provider_payer": "Provider Historical Denial Rate",
        "claim_amount_deviation": "Charge Amount Variance",
        "network_status": "Provider Network Status",
        "modifiers": "CPT Modifiers",
        "referral_status": "Referral Status",
        "cpt_code": "CPT Procedure Code",
        "payer": "Payer Guidelines",
        "charge_amount": "Total Charge Amount",
    }

    for feat, impact in sorted_factors[:4]:
        direction = "increases_risk" if impact > 0 else "decreases_risk"
        friendly_name = display_names.get(feat, feat.replace("_", " ").title())
        top_contributing.append({
            "feature": friendly_name,
            "impact": round(float(abs(impact)), 4),
            "direction": direction
        })

    # Derive CARC code and action
    carc_code, action = determine_carc_and_action(risk_score, raw_dict, top_contributing)

    # Convert dates to ISO strings for DB/JSON serialization
    dos_str = str(raw_dict["dos"])
    sub_date_str = str(raw_dict["submission_date"])

    # Full record payload matching Supabase claims_log table
    full_record = {
        "claim_id": claim_id,
        "claim_type": raw_dict.get("claim_type"),
        "payer": raw_dict.get("payer"),
        "plan_type": raw_dict.get("plan_type"),
        "eligibility_status": raw_dict.get("eligibility_status"),
        "provider_specialty": raw_dict.get("provider_specialty"),
        "network_status": raw_dict.get("network_status"),
        "icd10_code": raw_dict.get("icd10_code"),
        "cpt_code": raw_dict.get("cpt_code"),
        "modifiers": raw_dict.get("modifiers"),
        "pos_code": raw_dict.get("pos_code"),
        "units_billed": raw_dict.get("units_billed"),
        "charge_amount": raw_dict.get("charge_amount"),
        "pa_status": raw_dict.get("pa_status"),
        "referral_status": raw_dict.get("referral_status"),
        "documentation_flag": bool(raw_dict.get("documentation_flag")),
        "dos": dos_str,
        "submission_date": sub_date_str,
        "days_to_filing_deadline": raw_dict.get("days_to_filing_deadline"),
        "cob_flag": bool(raw_dict.get("cob_flag")),
        "hist_denial_rate_cpt_payer": engineered["hist_denial_rate_cpt_payer"],
        "hist_denial_rate_provider_payer": engineered["hist_denial_rate_provider_payer"],
        "claim_amount_deviation": engineered["claim_amount_deviation"],
        "predicted_risk_score": risk_score,
        "predicted_carc_code": carc_code,
        "top_contributing_factors": top_contributing,
        "suggested_corrective_action": action,
        "actual_outcome": None,
        "denial_flag": None,
    }

    # API response subset
    api_response = {
        "claim_id": claim_id,
        "risk_score": risk_score,
        "predicted_carc_code": carc_code,
        "top_contributing_factors": top_contributing,
        "suggested_corrective_action": action,
    }

    return {
        "api_response": api_response,
        "full_record": full_record
    }
