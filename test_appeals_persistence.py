"""
Verification Test for Supabase Appeals Table Persistence and Live Updates
"""

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import get_supabase, is_live_supabase_mode

client = TestClient(app)

def test_appeals_persistence():
    print("\n--- [TEST] Testing /appeals Persistence against Live Supabase ---")
    
    # 1. Login
    login_res = client.post("/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    assert login_res.status_code == 200, "Login failed"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Create Appeal via POST /appeals
    claim_id = "CLM-TEST-001"
    create_payload = {
        "claim_id": claim_id,
        "appeal_level": "Level 1",
        "attached_document_ids": ["doc-001", "doc-002"],
        "notes": "Medical necessity justification with attached clinical chart notes."
    }
    
    res = client.post("/appeals", json=create_payload, headers=headers)
    assert res.status_code == 201, f"Failed to create appeal: {res.text}"
    appeal = res.json()
    appeal_id = appeal["id"]
    print(f"API Appeal Created: id={appeal_id}, claim_id={appeal['claim_id']}, status={appeal['status']}, level={appeal['appeal_level']}")
    
    # 3. Direct DB check in Supabase
    sb = get_supabase()
    assert is_live_supabase_mode(), "Expected Live Supabase Mode to be active"
    
    db_res = sb.table("appeals").select("*").eq("id", appeal_id).execute()
    assert len(db_res.data) > 0, f"Direct DB check failed: {appeal_id} not found in Supabase appeals table!"
    row = db_res.data[0]
    print(f"Direct DB Check SUCCESS: Found row in Supabase appeals table -> {row}")
    assert row["id"] == appeal_id
    assert row["claim_id"] == claim_id
    assert row["level"] == "Level 1"
    assert row["status"] == "drafting"
    assert row["docs_attached"] == 2
    assert "Medical necessity" in row["notes"]
    
    # 4. Update status via PATCH /appeals/{id}/status
    patch_res = client.patch(f"/appeals/{appeal_id}/status", json={"status": "submitted"}, headers=headers)
    assert patch_res.status_code == 200, f"Failed to patch status: {patch_res.text}"
    
    # 5. Direct DB check on updated status
    db_res2 = sb.table("appeals").select("*").eq("id", appeal_id).execute()
    row2 = db_res2.data[0]
    print(f"Direct DB Check After Status Update: status={row2['status']}")
    assert row2["status"] == "submitted"
    
    # 6. Cleanup test row
    sb.table("appeals").delete().eq("id", appeal_id).execute()
    print("Cleaned up test row from Supabase appeals table.")
    
    print("\n=======================================================")
    print(">>> APPEALS SUPABASE PERSISTENCE VERIFIED & PASSING! <<<")
    print("=======================================================")

if __name__ == "__main__":
    test_appeals_persistence()
