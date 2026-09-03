"""
Missing Field Imputer for DenialGuard AI
Loads cleaned dataset, maps column aliases to canonical schema, imputes null/blank values
at the field-level using domain-grounded generators, and exports training_dataset_final.csv
along with a traceable imputation_report.json.
"""

import json
import os
import numpy as np
import pandas as pd
from typing import Dict, Any

from .synthetic_field_generators import (
    sample_claim_type,
    sample_payer,
    sample_plan_type,
    sample_eligibility_status,
    sample_provider_specialty,
    sample_network_status,
    sample_icd10_code,
    sample_cpt_code,
    sample_modifiers,
    sample_pos_code,
    sample_units_billed,
    sample_charge_amount,
    sample_pa_status,
    sample_referral_status,
    sample_documentation_flag,
    sample_dos,
    sample_submission_date,
    sample_days_to_filing_deadline,
    sample_cob_flag,
)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(CURRENT_DIR, "cleaned_claims_final.csv")
OUTPUT_FILE = os.path.join(CURRENT_DIR, "training_dataset_final.csv")
REPORT_FILE = os.path.join(CURRENT_DIR, "imputation_report.json")

# Standard column mapping from cleaned raw exports to canonical 20 fields
COLUMN_MAP = {
    "claim_id": "claim_id",
    "claim_type": "claim_type",
    "payer_name": "payer",
    "patient_plan_type": "plan_type",
    "eligibility_status": "eligibility_status",
    "provider_specialty": "provider_specialty",
    "network_status": "network_status",
    "primary_icd10_dx": "icd10_code",
    "cpt_code": "cpt_code",
    "modifier": "modifiers",
    "place_of_service_code": "pos_code",
    "units_billed": "units_billed",
    "claim_amount_usd": "charge_amount",
    "prior_auth_status": "pa_status",
    "referral_status": "referral_status",
    "documentation_attached_flag": "documentation_flag",
    "date_of_service": "dos",
    "claim_submission_date": "submission_date",
    "days_to_filing_deadline_remaining": "days_to_filing_deadline",
    "cob_flag": "cob_flag",
    "denial_flag": "denial_flag"
}

LOCKED_20_RAW_FIELDS = [
    "claim_id", "claim_type", "payer", "plan_type", "eligibility_status",
    "provider_specialty", "network_status", "icd10_code", "cpt_code",
    "modifiers", "pos_code", "units_billed", "charge_amount", "pa_status",
    "referral_status", "documentation_flag", "dos", "submission_date",
    "days_to_filing_deadline", "cob_flag"
]

def is_missing(val: Any) -> bool:
    if val is None:
        return True
    if pd.isna(val):
        return True
    if isinstance(val, str) and val.strip() == "":
        return True
    return False

def normalize_bool(val: Any, default_sample_fn) -> bool:
    if is_missing(val):
        return default_sample_fn()
    if isinstance(val, bool):
        return val
    str_val = str(val).strip().lower()
    if str_val in ["yes", "true", "1", "t", "y"]:
        return True
    if str_val in ["no", "false", "0", "f", "n"]:
        return False
    return default_sample_fn()

def impute_dataset():
    print(f"Loading cleaned dataset from {INPUT_FILE}...")
    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(f"Input file not found at {INPUT_FILE}")

    df_raw = pd.read_csv(INPUT_FILE)
    total_original_rows = len(df_raw)
    print(f"Original row count: {total_original_rows}")

    # 1. Map columns to canonical schema
    df = pd.DataFrame()
    for src_col, target_col in COLUMN_MAP.items():
        if src_col in df_raw.columns:
            df[target_col] = df_raw[src_col]
        elif target_col in df_raw.columns:
            df[target_col] = df_raw[target_col]
        else:
            df[target_col] = np.nan

    # 2. Check and drop missing label rows (denial_flag)
    initial_rows = len(df)
    df = df.dropna(subset=["denial_flag"]).copy()
    rows_dropped_missing_label = initial_rows - len(df)
    print(f"Rows dropped due to missing label (denial_flag): {rows_dropped_missing_label}")

    # 3. Track imputation stats
    imputation_report = {
        "dataset_source": "cleaned_claims_final.csv",
        "original_rows": total_original_rows,
        "rows_dropped_missing_label": rows_dropped_missing_label,
        "final_training_rows": len(df),
        "per_field_stats": {}
    }

    # Helper functions map
    field_samplers = {
        "claim_id": lambda row: f"CLM-{np.random.randint(100000, 999999)}",
        "claim_type": sample_claim_type,
        "payer": sample_payer,
        "plan_type": sample_plan_type,
        "eligibility_status": sample_eligibility_status,
        "provider_specialty": sample_provider_specialty,
        "network_status": sample_network_status,
        "icd10_code": sample_icd10_code,
        "cpt_code": sample_cpt_code,
        "modifiers": lambda row: "None" if is_missing(row.get("modifiers")) else str(row.get("modifiers")),
        "pos_code": sample_pos_code,
        "units_billed": sample_units_billed,
        "charge_amount": sample_charge_amount,
        "pa_status": sample_pa_status,
        "referral_status": sample_referral_status,
        "documentation_flag": sample_documentation_flag,
        "dos": sample_dos,
        "submission_date": sample_submission_date,
        "days_to_filing_deadline": sample_days_to_filing_deadline,
        "cob_flag": sample_cob_flag,
    }

    conditioned_fields = ["plan_type", "modifiers", "pos_code", "units_billed", "charge_amount", "pa_status", "referral_status", "submission_date", "days_to_filing_deadline"]

    # Impute row by row for strict fidelity
    records = df.to_dict(orient="records")
    imputed_records = []

    # Count missing values per field
    field_missing_counts = {f: 0 for f in LOCKED_20_RAW_FIELDS}

    for row in records:
        clean_row = {}
        # First pass: copy existing valid values
        for f in LOCKED_20_RAW_FIELDS:
            val = row.get(f)
            if f == "modifiers" and (is_missing(val) or str(val).lower() == "nan"):
                # Missing modifier in medical billing is explicitly "None"
                clean_row[f] = "None"
            elif is_missing(val):
                field_missing_counts[f] += 1
                clean_row[f] = None
            else:
                clean_row[f] = val

        # Second pass: synthesize missing fields conditioned on available fields
        for f in LOCKED_20_RAW_FIELDS:
            if clean_row[f] is None:
                sampler = field_samplers.get(f, lambda r: "Unknown")
                clean_row[f] = sampler(clean_row)

        # Standardize boolean fields
        clean_row["documentation_flag"] = normalize_bool(clean_row["documentation_flag"], sample_documentation_flag)
        clean_row["cob_flag"] = normalize_bool(clean_row["cob_flag"], sample_cob_flag)

        # Ensure correct string / numeric types
        clean_row["claim_id"] = str(clean_row["claim_id"])
        clean_row["claim_type"] = str(clean_row["claim_type"])
        clean_row["payer"] = str(clean_row["payer"])
        clean_row["plan_type"] = str(clean_row["plan_type"])
        clean_row["eligibility_status"] = str(clean_row["eligibility_status"])
        clean_row["provider_specialty"] = str(clean_row["provider_specialty"]).replace("_", " ")
        clean_row["network_status"] = "In-Network" if "in" in str(clean_row["network_status"]).lower() and "out" not in str(clean_row["network_status"]).lower() else "Out-of-Network"
        clean_row["icd10_code"] = str(clean_row["icd10_code"])
        clean_row["cpt_code"] = str(clean_row["cpt_code"])
        clean_row["modifiers"] = str(clean_row["modifiers"])
        clean_row["pos_code"] = str(clean_row["pos_code"])
        clean_row["units_billed"] = int(clean_row["units_billed"])
        clean_row["charge_amount"] = round(float(clean_row["charge_amount"]), 2)
        
        # Standardize PA status
        pa_val = str(clean_row["pa_status"]).strip().title()
        if "Not Obtained" in pa_val or "Missing" in pa_val:
            clean_row["pa_status"] = "Missing"
        elif "Obtained" in pa_val or "Approved" in pa_val:
            clean_row["pa_status"] = "Approved"
        elif "Pending" in pa_val:
            clean_row["pa_status"] = "Pending"
        else:
            clean_row["pa_status"] = pa_val

        # Standardize Referral status
        ref_val = str(clean_row["referral_status"]).strip().title()
        if "Present" in ref_val or "Active" in ref_val:
            clean_row["referral_status"] = "Active"
        elif "Missing" in ref_val:
            clean_row["referral_status"] = "Missing"
        else:
            clean_row["referral_status"] = ref_val

        clean_row["dos"] = str(clean_row["dos"])
        clean_row["submission_date"] = str(clean_row["submission_date"])
        clean_row["days_to_filing_deadline"] = int(clean_row["days_to_filing_deadline"])
        clean_row["denial_flag"] = int(row["denial_flag"])

        imputed_records.append(clean_row)

    df_imputed = pd.DataFrame(imputed_records)

    # Populate imputation report stats
    for f in LOCKED_20_RAW_FIELDS:
        missing_cnt = field_missing_counts[f]
        missing_pct = round((missing_cnt / len(df_imputed)) * 100, 2)
        method = "conditioned_sampling" if f in conditioned_fields else "marginal_sampling"
        imputation_report["per_field_stats"][f] = {
            "missing_count": missing_cnt,
            "missing_percentage": missing_pct,
            "imputation_method": method if missing_cnt > 0 else "none (100% real)"
        }

    # Save outputs
    df_imputed.to_csv(OUTPUT_FILE, index=False)
    print(f"Saved imputed training dataset with {len(df_imputed)} rows to {OUTPUT_FILE}")

    with open(REPORT_FILE, "w") as f:
        json.dump(imputation_report, f, indent=2)
    print(f"Saved imputation report to {REPORT_FILE}")

    return imputation_report

if __name__ == "__main__":
    impute_dataset()
