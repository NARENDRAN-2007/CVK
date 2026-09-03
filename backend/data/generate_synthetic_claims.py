"""
Synthetic Claims Generator for DenialGuard AI
Refactored to use shared sampling functions from synthetic_field_generators.py.
"""

import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

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
    CPT_DEFINITIONS,
)

# Set deterministic seed for reproducibility
np.random.seed(42)
random.seed(42)

NUM_ROWS = 8000
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "archive", "synthetic_claims_baseline.csv")

def generate_dataset():
    records = []
    base_date = datetime.now().date() - timedelta(days=180)

    for i in range(1, NUM_ROWS + 1):
        claim_id = f"CLM-{100000 + i}"
        claim_type = sample_claim_type()
        payer = sample_payer()
        plan_type = sample_plan_type({"payer": payer})
        eligibility_status = sample_eligibility_status()
        provider_specialty = sample_provider_specialty()
        network_status = sample_network_status()
        icd10_code = sample_icd10_code()
        cpt_code = sample_cpt_code()
        cpt_info = CPT_DEFINITIONS.get(cpt_code, {"base_charge": 150.0, "requires_pa": False})

        modifiers = sample_modifiers({"cpt_code": cpt_code})
        pos_code = sample_pos_code({"cpt_code": cpt_code})
        units_billed = sample_units_billed({"cpt_code": cpt_code})
        charge_amount = sample_charge_amount({"cpt_code": cpt_code, "units_billed": units_billed})
        pa_status = sample_pa_status({"cpt_code": cpt_code})
        referral_status = sample_referral_status({"plan_type": plan_type, "network_status": network_status})
        documentation_flag = sample_documentation_flag()
        dos = sample_dos()
        submission_date = sample_submission_date({"dos": dos})
        days_to_filing_deadline = sample_days_to_filing_deadline({"payer": payer})
        cob_flag = sample_cob_flag()

        # Denial probability calculation
        denial_logit = -2.4
        if eligibility_status in ["Inactive", "Terminated"]:
            denial_logit += 4.0
        elif eligibility_status == "Pending":
            denial_logit += 1.8

        if pa_status == "Denied":
            denial_logit += 5.0
        elif pa_status == "Missing" and cpt_info.get("requires_pa"):
            denial_logit += 3.8
        elif pa_status == "Missing":
            denial_logit += 1.2

        if not documentation_flag:
            denial_logit += 2.0

        if days_to_filing_deadline <= 0:
            denial_logit += 4.5
        elif days_to_filing_deadline < 10:
            denial_logit += 1.3

        if network_status == "Out-of-Network":
            if referral_status in ["Missing", "Expired"] and plan_type in ["HMO", "POS"]:
                denial_logit += 2.8
            else:
                denial_logit += 0.8

        if payer == "Medicaid" and not documentation_flag:
            denial_logit += 1.2

        prob_denial = 1.0 / (1.0 + np.exp(-denial_logit))
        prob_denial = np.clip(prob_denial, 0.01, 0.99)
        denial_flag = bool(random.random() < prob_denial)

        records.append({
            "claim_id": claim_id,
            "claim_type": claim_type,
            "payer": payer,
            "plan_type": plan_type,
            "eligibility_status": eligibility_status,
            "provider_specialty": provider_specialty,
            "network_status": network_status,
            "icd10_code": icd10_code,
            "cpt_code": cpt_code,
            "modifiers": modifiers,
            "pos_code": pos_code,
            "units_billed": units_billed,
            "charge_amount": charge_amount,
            "pa_status": pa_status,
            "referral_status": referral_status,
            "documentation_flag": documentation_flag,
            "dos": dos,
            "submission_date": submission_date,
            "days_to_filing_deadline": days_to_filing_deadline,
            "cob_flag": cob_flag,
            "denial_flag": denial_flag
        })

    df = pd.DataFrame(records)
    return df

if __name__ == "__main__":
    df = generate_dataset()
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"[SUCCESS] Generated {len(df)} synthetic claims using shared generators.")
