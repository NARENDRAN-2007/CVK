"""
Shared Synthetic Field Generators & Distribution Sampling for DenialGuard AI
Provides domain-grounded sampling logic for all 20 raw claim features.
Used by both the full synthetic generator and the missing-field imputer.
"""

import random
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import numpy as np

# Standard Reference Vocabularies
PAYERS = ["Medicare", "Medicaid", "UnitedHealthcare", "BlueCross", "Aetna", "Cigna", "Humana"]
PLAN_TYPES = ["HMO", "PPO", "EPO", "POS", "Medicare Advantage", "Commercial"]
CLAIM_TYPES = ["Professional", "Institutional", "Dental", "Vision"]
ELIGIBILITY_STATUSES = ["Active", "Inactive", "Pending", "Terminated"]
PROVIDER_SPECIALTIES = [
    "Cardiology", "Orthopedics", "General Practice", "Dermatology", 
    "Oncology", "Radiology", "Neurology", "Internal Medicine", "Emergency Medicine"
]
NETWORK_STATUSES = ["In-Network", "Out-of-Network"]

ICD10_CODES = [
    "I10", "E11.9", "M54.5", "J45.909", "K21.9", "Z00.00", "R07.9", "M25.50", "N39.0", "S93.401A", "G89.29", "K57.30"
]

CPT_DEFINITIONS = {
    "99213": {"base_charge": 140.0, "requires_pa": False, "desc": "Office outpatient visit 20-29 min"},
    "99214": {"base_charge": 210.0, "requires_pa": False, "desc": "Office outpatient visit 30-39 min"},
    "99215": {"base_charge": 310.0, "requires_pa": False, "desc": "Office outpatient visit 40-54 min"},
    "71045": {"base_charge": 175.0, "requires_pa": False, "desc": "Chest X-ray, single view"},
    "93000": {"base_charge": 95.0,  "requires_pa": False, "desc": "Electrocardiogram, complete"},
    "80053": {"base_charge": 65.0,  "requires_pa": False, "desc": "Comprehensive metabolic panel"},
    "36415": {"base_charge": 35.0,  "requires_pa": False, "desc": "Routine venipuncture"},
    "99203": {"base_charge": 180.0, "requires_pa": False, "desc": "Office new patient 30-44 min"},
    "27447": {"base_charge": 4500.0, "requires_pa": True,  "desc": "Total knee arthroplasty (surgery)"},
    "99284": {"base_charge": 520.0, "requires_pa": False, "desc": "Emergency department visit, high severity"},
    "99283": {"base_charge": 400.0, "requires_pa": False, "desc": "Emergency department visit, moderate severity"}
}

CPT_CODES = list(CPT_DEFINITIONS.keys())
MODIFIERS = ["None", "25", "59", "LT", "RT", "76", "51", "GT", "79", "GQ"]
POS_CODES = ["11", "21", "22", "23", "02", "2", "12", "31", "49"]
PA_STATUSES = ["Approved", "Denied", "Missing", "Pending", "Not Required"]
REFERRAL_STATUSES = ["Active", "Missing", "Not Required", "Expired"]



def sample_claim_type(row: Optional[Dict[str, Any]] = None) -> str:
    return random.choices(CLAIM_TYPES, weights=[0.70, 0.20, 0.05, 0.05])[0]


def sample_payer(row: Optional[Dict[str, Any]] = None) -> str:
    return random.choices(
        ["Medicare", "Medicaid", "UnitedHealthcare", "BlueCross", "Aetna", "Cigna", "Humana"],
        weights=[0.25, 0.15, 0.20, 0.18, 0.10, 0.07, 0.05]
    )[0]


def sample_plan_type(row: Optional[Dict[str, Any]] = None) -> str:
    if row and row.get("payer") == "Medicare":
        return random.choices(["Medicare Advantage", "PPO", "HMO"], weights=[0.60, 0.25, 0.15])[0]
    return random.choices(PLAN_TYPES, weights=[0.30, 0.40, 0.10, 0.10, 0.10])[0]


def sample_eligibility_status(row: Optional[Dict[str, Any]] = None) -> str:
    return random.choices(ELIGIBILITY_STATUSES, weights=[0.90, 0.05, 0.03, 0.02])[0]


def sample_provider_specialty(row: Optional[Dict[str, Any]] = None) -> str:
    return random.choice(PROVIDER_SPECIALTIES)


def sample_network_status(row: Optional[Dict[str, Any]] = None) -> str:
    return random.choices(["In-Network", "Out-of-Network"], weights=[0.82, 0.18])[0]


def sample_icd10_code(row: Optional[Dict[str, Any]] = None) -> str:
    return random.choice(ICD10_CODES)


def sample_cpt_code(row: Optional[Dict[str, Any]] = None) -> str:
    return random.choice(CPT_CODES)


def sample_modifiers(row: Optional[Dict[str, Any]] = None) -> str:
    cpt = str(row.get("cpt_code", "")) if row else ""
    if cpt in ["99214", "99215"] and random.random() < 0.35:
        return "25"
    if cpt in ["27447"] and random.random() < 0.25:
        return random.choice(["LT", "RT", "59"])
    return random.choices(MODIFIERS, weights=[0.60, 0.12, 0.08, 0.06, 0.06, 0.03, 0.02, 0.01, 0.01, 0.01])[0]


def sample_pos_code(row: Optional[Dict[str, Any]] = None) -> str:
    cpt = str(row.get("cpt_code", "")) if row else ""
    if cpt in ["99284", "99283"]:
        return "23"
    if cpt == "27447":
        return random.choice(["21", "22"])
    return random.choices(["11", "21", "22", "23", "02"], weights=[0.65, 0.05, 0.15, 0.05, 0.10])[0]


def sample_units_billed(row: Optional[Dict[str, Any]] = None) -> int:
    cpt = str(row.get("cpt_code", "")) if row else ""
    if cpt in ["36415", "80053"]:
        return random.choices([1, 2, 3], weights=[0.8, 0.15, 0.05])[0]
    return 1


def sample_charge_amount(row: Optional[Dict[str, Any]] = None) -> float:
    cpt = str(row.get("cpt_code", "99213")) if row else "99213"
    units = int(row.get("units_billed", 1)) if row else 1
    base_info = CPT_DEFINITIONS.get(cpt, {"base_charge": 150.0})
    base_charge = base_info["base_charge"] * max(1, units)
    variance = float(np.random.normal(1.0, 0.15))
    if random.random() < 0.04:
        variance = random.uniform(2.2, 3.5)
    return round(max(20.0, float(base_charge * variance)), 2)


def sample_pa_status(row: Optional[Dict[str, Any]] = None) -> str:
    cpt = str(row.get("cpt_code", "")) if row else ""
    cpt_info = CPT_DEFINITIONS.get(cpt, {"requires_pa": False})
    if cpt_info.get("requires_pa", False):
        return random.choices(["Approved", "Missing", "Denied", "Pending"], weights=[0.65, 0.20, 0.10, 0.05])[0]
    return random.choices(["Not Required", "Approved", "Missing"], weights=[0.80, 0.15, 0.05])[0]


def sample_referral_status(row: Optional[Dict[str, Any]] = None) -> str:
    plan = str(row.get("plan_type", "")) if row else ""
    net = str(row.get("network_status", "")) if row else ""
    if plan in ["HMO", "POS"] and "Out" in net:
        return random.choices(["Active", "Missing", "Expired"], weights=[0.40, 0.45, 0.15])[0]
    return random.choices(["Not Required", "Active", "Missing"], weights=[0.65, 0.30, 0.05])[0]


def sample_documentation_flag(row: Optional[Dict[str, Any]] = None) -> bool:
    return random.choices([True, False], weights=[0.88, 0.12])[0]


def sample_dos(row: Optional[Dict[str, Any]] = None) -> str:
    base_date = datetime.now().date() - timedelta(days=180)
    offset = random.randint(0, 150)
    return (base_date + timedelta(days=offset)).isoformat()


def sample_submission_date(row: Optional[Dict[str, Any]] = None) -> str:
    dos_str = row.get("dos") if row else None
    if dos_str:
        try:
            dos_date = datetime.fromisoformat(str(dos_str)).date()
            delay = random.randint(1, 90)
            return (dos_date + timedelta(days=delay)).isoformat()
        except Exception:
            pass
    base_date = datetime.now().date() - timedelta(days=30)
    return base_date.isoformat()


def sample_days_to_filing_deadline(row: Optional[Dict[str, Any]] = None) -> int:
    payer = str(row.get("payer", "")) if row else ""
    total_window = 90 if payer in ["Medicaid", "UnitedHealthcare"] else 180
    delay = random.randint(5, 100)
    return total_window - delay


def sample_cob_flag(row: Optional[Dict[str, Any]] = None) -> bool:
    return random.choices([True, False], weights=[0.15, 0.85])[0]


GENERATOR_MAPPING = {
    "claim_type": sample_claim_type,
    "payer": sample_payer,
    "plan_type": sample_plan_type,
    "eligibility_status": sample_eligibility_status,
    "provider_specialty": sample_provider_specialty,
    "network_status": sample_network_status,
    "icd10_code": sample_icd10_code,
    "cpt_code": sample_cpt_code,
    "modifiers": sample_modifiers,
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
