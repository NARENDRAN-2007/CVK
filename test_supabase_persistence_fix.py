"""
Verification Suite for Supabase claims_log Persistence Fix & Warning Handling
"""

import os
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import get_supabase, is_live_supabase_mode, insert_claim_log
from backend.app.schemas import ClaimInput

client = TestClient(app)

def test_supabase_persistence_live():
    print("\n--- [TEST 1] Testing /predict with Live Supabase Persistence ---")
    
    # Authenticate
    login_res = client.post("/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    assert login_res.status_code == 200, "Login failed"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    claim_id = "CLM-VERIFY-SUPABASE-001"
    payload = {
        "claim_id": claim_id,
        "claim_type": "Professional",
        "payer": "UnitedHealthcare",
        "plan_type": "Commercial",
        "eligibility_status": "Active",
        "provider_specialty": "Orthopedics",
        "network_status": "In-Network",
        "icd10_code": "M17.11",
        "cpt_code": "27447",
        "modifiers": "None",
        "pos_code": "11",
        "units_billed": 1,
        "charge_amount": 4500.00,
        "pa_status": "Denied",
        "referral_status": "Not Required",
        "documentation_flag": True,
        "dos": "2026-08-15",
        "submission_date": "2026-08-20",
        "days_to_filing_deadline": 45,
        "cob_flag": False
    }
    
    pred_res = client.post("/predict", json=payload, headers=headers)
    assert pred_res.status_code == 200, f"Prediction failed with status {pred_res.status_code}"
    data = pred_res.json()
    
    print(f"Prediction Response: claim_id={data['claim_id']}, risk_score={data['risk_score']}%, carc={data['predicted_carc_code']}, persisted={data.get('persisted')}")
    assert data["claim_id"] == claim_id
    assert "persisted" in data, "persisted field missing from PredictionResponse!"
    assert data["persisted"] is True, "Expected persisted=True for live Supabase write!"
    
    # Direct DB verification against Supabase
    sb = get_supabase()
    if is_live_supabase_mode() and sb is not None:
        db_res = sb.table("claims_log").select("*").eq("claim_id", claim_id).execute()
        assert len(db_res.data) > 0, f"Direct DB check failed: {claim_id} not found in Supabase claims_log table!"
        row = db_res.data[0]
        print(f"Direct DB Check SUCCESS: Found row in Supabase table claims_log -> {row['claim_id']}, charge_amount={row['charge_amount']}, predicted_carc={row['predicted_carc_code']}")
        assert row["claim_id"] == claim_id
        assert float(row["charge_amount"]) == 4500.00
        assert row["predicted_carc_code"] == "CO-197"
    else:
        print("Note: Running in offline in-memory fallback mode.")


def test_failure_handling_persisted_false():
    print("\n--- [TEST 2] Testing Graceful Handling when DB Write Fails (persisted=False) ---")
    
    # Test with a mock failure in insert_claim_log
    from unittest.mock import patch
    
    login_res = client.post("/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    claim_id = "CLM-TEST-FAILURE-002"
    payload = {
        "claim_id": claim_id,
        "claim_type": "Professional",
        "payer": "Medicare",
        "plan_type": "Commercial",
        "eligibility_status": "Active",
        "provider_specialty": "Cardiology",
        "network_status": "In-Network",
        "icd10_code": "I10",
        "cpt_code": "99213",
        "charge_amount": 150.00,
        "documentation_flag": True
    }
    
    with patch("backend.app.routers.predict.insert_claim_log", return_value=False):
        res = client.post("/predict", json=payload, headers=headers)
        assert res.status_code == 200, "Expected non-blocking 200 OK even when DB persistence fails"
        res_data = res.json()
        print(f"Fallback Response: persisted={res_data.get('persisted')}, risk_score={res_data.get('risk_score')}%")
        assert res_data.get("persisted") is False, "Expected persisted=False when insert_claim_log returns False"


if __name__ == "__main__":
    test_supabase_persistence_live()
    test_failure_handling_persisted_false()
    print("\n=======================================================")
    print(">>> SUPABASE PERSISTENCE FIX VERIFIED & PASSING! <<<")
    print("=======================================================")
