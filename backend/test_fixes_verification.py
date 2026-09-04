"""
Verification test for:
1. Registration role validation (Pydantic Literal, missing/invalid rejected, valid roles accepted).
2. Worklist document upload, in-place re-scoring, documentation_flag update, and response structure.
"""
import sys
import os
import uuid

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

def test_auth_role_validation():
    print("\n--- Testing Auth Role Validation ---")
    
    # 1. Missing role
    res = client.post("/auth/register", json={
        "work_email": f"test_norole_{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!",
        "full_name": "No Role User"
    })
    print(f"Missing role status: {res.status_code}")
    assert res.status_code == 422, f"Expected 422, got {res.status_code}: {res.text}"
    print("[PASS] Missing role correctly rejected with 422.")

    # 2. Invalid role
    res = client.post("/auth/register", json={
        "work_email": f"test_badrole_{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!",
        "full_name": "Bad Role User",
        "role": "SuperAdmin"
    })
    print(f"Invalid role status: {res.status_code}")
    assert res.status_code == 422, f"Expected 422, got {res.status_code}: {res.text}"
    print("[PASS] Invalid role correctly rejected with 422.")

    # 3. Valid roles
    for test_role, expected_db_role in [
        ("Admin", "Admin"),
        ("Analyst", "Analyst"),
        ("Denial Analyst", "Analyst"),
        ("Biller", "Biller")
    ]:
        email = f"user_{uuid.uuid4().hex[:6]}@example.com"
        res = client.post("/auth/register", json={
            "work_email": email,
            "password": "Password123!",
            "full_name": f"Test {test_role}",
            "role": test_role
        })
        print(f"Registering role '{test_role}' -> status: {res.status_code}")
        assert res.status_code == 200, f"Expected 200 for {test_role}, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["user"]["role"] == expected_db_role, f"Expected {expected_db_role}, got {data['user']['role']}"
        assert "access_token" in data
        print(f"[PASS] Successfully registered and verified role '{test_role}' (stored as '{expected_db_role}').")

def test_document_upload_and_rescore():
    print("\n--- Testing Document Upload & Re-scoring ---")
    
    # 1. Create a claim to attach documents to
    token = create_access_token({"sub": "admin@denialguard.ai", "email": "admin@denialguard.ai", "role": "Admin"})
    headers = {"Authorization": f"Bearer {token}"}

    claim_payload = {
        "cpt_code": "99214",
        "icd10_code": "I10",
        "payer": "BlueCross",
        "charge_amount": 1500.0,
        "provider_specialty": "Internal Medicine",
        "pa_status": "Not Required",
        "documentation_flag": False
    }
    
    pred_res = client.post("/predict", json=claim_payload, headers=headers)
    assert pred_res.status_code == 200, f"Failed /predict: {pred_res.text}"
    claim_id = pred_res.json()["claim_id"]
    initial_score = pred_res.json()["risk_score"]
    print(f"Created claim {claim_id} with initial score: {initial_score}%, doc_flag=False")

    # 2. Upload document to /claims/{id}/documents
    file_content = b"%PDF-1.4 Mock Clinical Operative Report and Lab Results"
    files = {"file": ("clinical_notes.pdf", file_content, "application/pdf")}
    data = {
        "document_type": "Operative Report",
        "notes": "Attached comprehensive physician op notes and charts."
    }
    
    upload_res = client.post(f"/claims/{claim_id}/documents", files=files, data=data, headers=headers)
    print(f"Upload document status: {upload_res.status_code}")
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    
    upload_data = upload_res.json()
    assert upload_data["status"] == "success"
    assert "updated_claim" in upload_data
    assert upload_data["updated_claim"] is not None
    assert upload_data["updated_claim"]["documentation_flag"] is True
    print(f"Updated Claim doc_flag: {upload_data['updated_claim']['documentation_flag']}")
    print(f"New risk score in updated_claim: {upload_data['updated_claim']['predicted_risk_score']}%")
    assert "new_prediction" in upload_data
    assert upload_data["new_prediction"]["risk_score"] == upload_data["updated_claim"]["predicted_risk_score"]
    print(f"New risk score in new_prediction: {upload_data['new_prediction']['risk_score']}%")

    # 3. Verify GET /claims-log contains updated claim in place
    log_res = client.get("/claims-log?limit=20", headers=headers)
    assert log_res.status_code == 200
    claims_list = log_res.json()
    matching_claim = next((c for c in claims_list if c["claim_id"] == claim_id), None)
    assert matching_claim is not None, f"Claim {claim_id} not found in claims-log"
    assert matching_claim["documentation_flag"] is True, "claims_log was not updated with documentation_flag=True"
    print(f"[PASS] Successfully verified in-place update in claims_log for {claim_id}.")

if __name__ == "__main__":
    test_auth_role_validation()
    test_document_upload_and_rescore()
    print("\n>>> ALL FIXES VERIFICATION TESTS PASSED SUCCESSFULLY! <<<\n")
