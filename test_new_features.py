import requests
import json
import io
import uuid

BASE_URL = "http://127.0.0.1:8000"

def test_all():
    print("Testing /health...")
    h = requests.get(f"{BASE_URL}/health")
    assert h.status_code == 200, f"Health failed: {h.text}"
    print(f"Health OK: {h.json()['status']}")

    print("Testing /auth/login...")
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "work_email": "admin@denialguard.com",
        "password": "password123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login OK, token received.")

    print("Testing POST /workspace/invite...")
    invite_res = requests.post(f"{BASE_URL}/workspace/invite", headers=headers, json={"role": "Analyst"})
    assert invite_res.status_code == 200, f"Invite failed: {invite_res.text}"
    invite_data = invite_res.json()
    invite_code = invite_data["invite_code"]
    print(f"Generated invite code: {invite_code} for role {invite_data['role']}")

    print("Testing POST /auth/register with invite code...")
    new_email = f"analyst_{uuid.uuid4().hex[:6]}@northstar.health"
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "work_email": new_email,
        "password": "password123",
        "full_name": "New Team Analyst",
        "invite_code": invite_code
    })
    assert reg_res.status_code == 200, f"Register failed: {reg_res.text}"
    reg_data = reg_res.json()
    assert reg_data["user"]["role"] == "Analyst"
    assert reg_data["user"]["workspace_id"] == invite_data["workspace_id"]
    print(f"Registered new user {new_email} under shared workspace {reg_data['user']['workspace_id']}.")

    print("Testing initial high risk prediction without documentation...")
    test_claim_id = f"CLM-TEST-{uuid.uuid4().hex[:6].upper()}"
    pred_res = requests.post(f"{BASE_URL}/predict", headers=headers, json={
        "claim_id": test_claim_id,
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
        "charge_amount": 18450.00,
        "pa_status": "Approved",
        "referral_status": "Not Required",
        "documentation_flag": False,
        "dos": "2026-08-15",
        "submission_date": "2026-08-20",
        "days_to_filing_deadline": 45,
        "cob_flag": False
    })
    assert pred_res.status_code == 200
    pred_data = pred_res.json()
    print(f"Initial prediction: {pred_data['risk_score']}% risk, CARC: {pred_data['predicted_carc_code']}")

    print("Testing POST /claims/{claim_id}/documents with file upload and auto-reprediction...")
    file_bytes = io.BytesIO(b"OPERATIVE REPORT\nPatient: PT-7724\nProcedure: Total Knee Arthroplasty (CPT 27447)\nIndication: Severe Osteoarthritis\nSurgeon: Dr. Elena Rodriguez\nMedical necessity verified.")
    files = {"file": ("operative_report_pt7724.pdf", file_bytes, "application/pdf")}
    data = {"document_type": "operative_report"}

    upload_res = requests.post(f"{BASE_URL}/claims/{test_claim_id}/documents", headers=headers, files=files, data=data)
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    up_data = upload_res.json()
    assert up_data["status"] == "success"
    assert up_data["repredicted"] is True
    new_pred = up_data["new_prediction"]
    assert new_pred is not None
    print(f"Document uploaded: {up_data['document']['document_title']}")
    print(f"Re-predicted risk after doc upload: {new_pred['risk_score']}% risk, CARC: {new_pred['predicted_carc_code']}")

    print("Testing GET /claims/{claim_id}/documents...")
    list_docs = requests.get(f"{BASE_URL}/claims/{test_claim_id}/documents", headers=headers)
    assert list_docs.status_code == 200
    docs = list_docs.json()
    assert len(docs) >= 1
    print(f"Retrieved {len(docs)} documents for claim {test_claim_id}.")

    print("\n=== ALL NEW SPECIFICATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_all()
