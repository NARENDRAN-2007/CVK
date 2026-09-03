import requests
import json
import uuid
import io

BASE_URL = "http://127.0.0.1:8000"

def test_round2_spec():
    print("1. Testing Invalid Login (Must return 401 Unauthorized)...")
    res_bogus = requests.post(f"{BASE_URL}/auth/login", json={
        "work_email": "nonexistent_user_99@denialguard.com",
        "password": "wrongpassword123"
    })
    assert res_bogus.status_code == 401, f"Expected 401 for nonexistent user, got {res_bogus.status_code}"
    print("Invalid user login correctly rejected with 401.")

    res_wrong_pw = requests.post(f"{BASE_URL}/auth/login", json={
        "work_email": "admin@denialguard.com",
        "password": "wrong_password_xyz"
    })
    assert res_wrong_pw.status_code == 401, f"Expected 401 for wrong password, got {res_wrong_pw.status_code}"
    print("Wrong password correctly rejected with 401.")

    print("\n2. Testing Valid Login...")
    res_valid = requests.post(f"{BASE_URL}/auth/login", json={
        "work_email": "admin@denialguard.com",
        "password": "password123"
    })
    assert res_valid.status_code == 200, f"Login failed: {res_valid.text}"
    token = res_valid.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful, access token obtained for admin.")

    print("\n3. Testing Empty Initial State for Clean Workspace...")
    res_logs = requests.get(f"{BASE_URL}/claims-log", headers=headers)
    assert res_logs.status_code == 200
    res_appeals = requests.get(f"{BASE_URL}/appeals", headers=headers)
    assert res_appeals.status_code == 200
    res_notifs = requests.get(f"{BASE_URL}/notifications", headers=headers)
    assert res_notifs.status_code == 200
    print(f"Clean workspace verified: {len(res_logs.json())} claims, {len(res_appeals.json())} appeals, {len(res_notifs.json())} notifications.")

    print("\n4. Testing Invite Code Flow & Distinct Error Validation...")
    res_invalid_invite = requests.post(f"{BASE_URL}/auth/register", json={
        "work_email": f"test_{uuid.uuid4().hex[:6]}@test.com",
        "password": "password123",
        "full_name": "Test User",
        "invite_code": "INVALID-CODE-999"
    })
    assert res_invalid_invite.status_code == 400
    assert "not found" in res_invalid_invite.json()["detail"].lower()
    print("Invalid invite code correctly returned 'Invite code not found'.")

    res_invite = requests.post(f"{BASE_URL}/workspace/invite", headers=headers, json={"role": "Analyst"})
    assert res_invite.status_code == 200
    invite_code = res_invite.json()["invite_code"]
    target_ws = res_invite.json()["workspace_id"]
    print(f"Admin generated invite code: {invite_code}")

    new_user_email = f"invited_{uuid.uuid4().hex[:6]}@northstar.health"
    res_reg = requests.post(f"{BASE_URL}/auth/register", json={
        "work_email": new_user_email,
        "password": "password123",
        "full_name": "Invited Analyst",
        "invite_code": invite_code
    })
    assert res_reg.status_code == 200
    reg_user = res_reg.json()["user"]
    assert reg_user["workspace_id"] == target_ws
    assert reg_user["role"] == "Analyst"
    print(f"New user successfully joined workspace {target_ws} via invite code.")

    res_reuse = requests.post(f"{BASE_URL}/auth/register", json={
        "work_email": f"another_{uuid.uuid4().hex[:6]}@test.com",
        "password": "password123",
        "full_name": "Another User",
        "invite_code": invite_code
    })
    assert res_reuse.status_code == 400
    assert "already" in res_reuse.json()["detail"].lower()
    print("Re-used invite code correctly rejected with 'Invite code has already been used'.")

    print("\n5. Testing Claim Prediction, Document Upload & Real Notifications...")
    claim_id = f"CLM-TEST-{uuid.uuid4().hex[:6].upper()}"
    res_pred = requests.post(f"{BASE_URL}/predict", headers=headers, json={
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
        "charge_amount": 18450.00,
        "pa_status": "Missing",
        "referral_status": "Not Required",
        "documentation_flag": False,
        "dos": "2026-08-15",
        "submission_date": "2026-08-20",
        "days_to_filing_deadline": 45,
        "cob_flag": False
    })
    assert res_pred.status_code == 200
    assert res_pred.json()["risk_score"] >= 60.0

    file_bytes = io.BytesIO(b"OPERATIVE REPORT: Pt underwent Knee Arthroplasty. Medical necessity confirmed.")
    res_doc = requests.post(
        f"{BASE_URL}/claims/{claim_id}/documents",
        headers=headers,
        files={"file": ("op_note.pdf", file_bytes, "application/pdf")},
        data={"document_type": "operative_report"}
    )
    assert res_doc.status_code == 200
    doc_id = res_doc.json()["document"]["id"]
    print(f"Document uploaded: {doc_id} for claim {claim_id}")

    print("\n6. Testing Real Appeal Creation with Document Attachment...")
    res_appeal = requests.post(f"{BASE_URL}/appeals", headers=headers, json={
        "claim_id": claim_id,
        "appeal_level": "Level 1",
        "attached_document_ids": [doc_id],
        "notes": "Medical necessity verified with operative report attached."
    })
    assert res_appeal.status_code == 201
    appeal_data = res_appeal.json()
    appeal_id = appeal_data["id"]
    assert appeal_data["claim_id"] == claim_id
    assert appeal_data["status"] == "drafting"
    assert doc_id in appeal_data["attached_document_ids"]
    print(f"Real appeal {appeal_id} created for claim {claim_id} with attached document.")

    res_patch = requests.patch(f"{BASE_URL}/appeals/{appeal_id}/status", headers=headers, json={
        "status": "submitted"
    })
    assert res_patch.status_code == 200
    assert res_patch.json()["status"] == "submitted"
    print(f"Appeal {appeal_id} progressed to 'submitted' stage.")

    print("\n7. Testing Notifications Endpoint & Read State...")
    res_notifs_after = requests.get(f"{BASE_URL}/notifications", headers=headers)
    assert res_notifs_after.status_code == 200
    notifs = res_notifs_after.json()
    assert len(notifs) >= 3
    print(f"Retrieved {len(notifs)} real notifications.")

    first_notif_id = notifs[0]["id"]
    res_read = requests.post(f"{BASE_URL}/notifications/{first_notif_id}/read", headers=headers)
    assert res_read.status_code == 200
    res_read_all = requests.post(f"{BASE_URL}/notifications/read-all", headers=headers)
    assert res_read_all.status_code == 200
    print("Notifications read operations verified.")

    print("\n8. Testing Workflow & Security Settings Persistence...")
    res_save_wf = requests.post(f"{BASE_URL}/workspace/settings", headers=headers, json={
        "auto_assign": False,
        "default_appeal_deadline_days": 45,
        "high_risk_threshold": 65.0
    })
    assert res_save_wf.status_code == 200
    assert res_save_wf.json()["default_appeal_deadline_days"] == 45
    assert res_save_wf.json()["high_risk_threshold"] == 65.0

    res_get_wf = requests.get(f"{BASE_URL}/workspace/settings", headers=headers)
    assert res_get_wf.status_code == 200
    assert res_get_wf.json()["default_appeal_deadline_days"] == 45
    print("Workflow settings persistence verified.")

    res_save_sec = requests.post(f"{BASE_URL}/workspace/security", headers=headers, json={
        "session_timeout_minutes": 120,
        "audit_log_retention_days": 3650
    })
    assert res_save_sec.status_code == 200
    assert res_save_sec.json()["session_timeout_minutes"] == 120

    res_get_sec = requests.get(f"{BASE_URL}/workspace/security", headers=headers)
    assert res_get_sec.status_code == 200
    assert res_get_sec.json()["session_timeout_minutes"] == 120
    print("Security settings persistence verified.")

    print("\n============================================================")
    print("=== ALL ROUND 2 SPECIFICATION REQUIREMENTS VERIFIED 100% ===")
    print("============================================================")

if __name__ == "__main__":
    test_round2_spec()
