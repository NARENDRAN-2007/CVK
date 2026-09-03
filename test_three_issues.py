import os
import time
import uuid
import requests
from playwright.sync_api import sync_playwright

BASE_API = "http://127.0.0.1:8000"
BASE_UI = "http://127.0.0.1:3000"

def test_all_three_issues():
    print("=================================================================")
    print(">>> VERIFYING ALL 3 FIXES: DOCS COUNT, DUPLICATE GUARD, TIMELINE")
    print("=================================================================")

    # 1. Login to API
    res_login = requests.post(f"{BASE_API}/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    assert res_login.status_code == 200, "Login failed"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Clean up test claim if exists
    test_claim_id = f"CLM-TEST-{uuid.uuid4().hex[:6].upper()}"
    from backend.app.db import get_supabase
    sb = get_supabase()
    if sb:
        try:
            sb.table("appeals").delete().eq("claim_id", test_claim_id).execute()
        except Exception:
            pass
        try:
            sb.table("claim_documents").delete().eq("claim_id", test_claim_id).execute()
        except Exception:
            pass
        try:
            sb.table("claims_log").delete().eq("claim_id", test_claim_id).execute()
        except Exception:
            pass

    # Create Claim
    print(f"\n[Step 1] Creating test claim {test_claim_id}...")
    c_res = requests.post(f"{BASE_API}/predict", json={
        "claim_id": test_claim_id,
        "payer": "UnitedHealthcare",
        "plan_type": "Commercial",
        "eligibility_status": "Active",
        "provider_specialty": "Orthopedics",
        "network_status": "In-Network",
        "icd10_code": "M17.11",
        "cpt_code": "27447",
        "charge_amount": "18450.00",
        "pa_status": "Approved",
        "documentation_flag": False,
        "days_to_filing_deadline": 12
    }, headers=headers).json()
    assert c_res["predicted_carc_code"] == "CO-16"
    print(f"Created {test_claim_id}: CARC=CO-16")

    # ----------------------------------------------------
    # ISSUE 2 VERIFICATION (BACKEND 409 GUARD)
    # ----------------------------------------------------
    print("\n--- [ISSUE 2] Testing Duplicate Appeal Backend Guard ---")
    # First appeal creation should succeed (201 Created)
    apl_res1 = requests.post(f"{BASE_API}/appeals", json={
        "claim_id": test_claim_id,
        "appeal_level": "Level 1",
        "notes": "Initial appeal submission"
    }, headers=headers)
    assert apl_res1.status_code == 201, f"First appeal failed: {apl_res1.text}"
    apl1 = apl_res1.json()
    print(f"  [Pass] First appeal created: {apl1['id']} (status: {apl1['status']})")

    # Second appeal creation for same claim MUST fail with 409 Conflict
    apl_res2 = requests.post(f"{BASE_API}/appeals", json={
        "claim_id": test_claim_id,
        "appeal_level": "Level 1",
        "notes": "Duplicate appeal submission attempt"
    }, headers=headers)
    print(f"  [Pass] Second appeal attempt returned status: {apl_res2.status_code} (Expected: 409)")
    assert apl_res2.status_code == 409, f"Expected 409 Conflict, got {apl_res2.status_code}: {apl_res2.text}"
    print(f"  [Pass] Duplicate guard message: {apl_res2.json().get('detail')}")

    # ----------------------------------------------------
    # ISSUE 1 VERIFICATION (LIVE DOCS COUNT ON APPEALS)
    # ----------------------------------------------------
    print("\n--- [ISSUE 1] Testing Live Docs Attached Count on Appeals ---")
    # Check appeal docs count before upload
    appeals_before = requests.get(f"{BASE_API}/appeals", headers=headers).json()
    target_apl = next(a for a in appeals_before if a["claim_id"] == test_claim_id)
    print(f"  Docs attached before upload: {len(target_apl.get('attached_document_ids', []))}")
    assert len(target_apl.get("attached_document_ids", [])) == 0

    # Upload 2 documents to this claim
    doc1 = requests.post(f"{BASE_API}/claims/{test_claim_id}/documents", data={"document_type": "operative_report"}, files={"file": ("operative_note_1.pdf", b"PDF operative note content", "application/pdf")}, headers=headers)
    assert doc1.status_code == 200
    doc2 = requests.post(f"{BASE_API}/claims/{test_claim_id}/documents", data={"document_type": "chart_notes"}, files={"file": ("chart_notes_2.pdf", b"PDF chart notes content", "application/pdf")}, headers=headers)
    assert doc2.status_code == 200
    print("  Uploaded 2 documents to claim.")

    # Check appeal docs count after upload via GET /appeals
    appeals_after = requests.get(f"{BASE_API}/appeals", headers=headers).json()
    target_apl_after = next(a for a in appeals_after if a["claim_id"] == test_claim_id)
    doc_count = len(target_apl_after.get("attached_document_ids", []))
    print(f"  Docs attached after upload: {doc_count} (Expected: 2)")
    assert doc_count == 2, f"Expected 2 docs attached, got {doc_count}"

    # ----------------------------------------------------
    # ISSUE 3 & UI VERIFICATION (PLAYWRIGHT BROWSER E2E)
    # ----------------------------------------------------
    print("\n--- [ISSUE 1, 2, 3] Running Full Browser Automation ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        # Login in UI
        page.goto(f"{BASE_UI}/sign-in", wait_until="domcontentloaded")
        page.locator("input[type='email']").fill("admin@denialguard.com")
        page.locator("input[type='password']").fill("password123")
        page.locator("button[type='submit']").click()
        time.sleep(2.0)

        # 1. Verify Appeals Pipeline Kanban Card Docs Count
        print("\n>>> Inspecting Appeals Pipeline Kanban...", flush=True)
        page.goto(f"{BASE_UI}/appeals", wait_until="domcontentloaded")
        time.sleep(2.0)
        card = page.locator(f".appeal-card:has-text('{test_claim_id}')").first
        card_text = card.inner_text()
        print(f"  Kanban Card Text: '{card_text.replace(chr(10), ' ').encode('ascii', 'replace').decode('ascii')}'", flush=True)
        assert "2 docs attached" in card_text, f"Expected '2 docs attached' on Kanban card, got: {card_text}"
        print("  --> [ISSUE 1 VERIFIED IN UI] Appeals card live-displays '2 docs attached'!", flush=True)

        # 2. Verify Claim Detail Timeline & Duplicate Guard
        print(f"\n>>> Inspecting Claim Detail for {test_claim_id}...", flush=True)
        page.goto(f"{BASE_UI}/claims/{test_claim_id}", wait_until="domcontentloaded")
        time.sleep(2.0)

        # Check Action button: should show "View appeal" instead of duplicate "Start appeal"
        page.wait_for_selector(f".detail-actions:has-text('View appeal')", timeout=10000)
        actions = page.locator(".detail-actions").inner_text()
        print(f"  Detail Actions Text: '{actions.replace(chr(10), ' ').encode('ascii', 'replace').decode('ascii')}'", flush=True)
        assert f"View appeal ({apl1['id']})" in actions, f"Expected 'View appeal ({apl1['id']})', got: {actions}"
        print("  --> [ISSUE 2 VERIFIED IN UI] Start appeal button replaced with active appeal tracker!", flush=True)

        # Check Claim Timeline:
        timeline_text = page.locator(".timeline").inner_text()
        print(f"  Timeline Items:\n{timeline_text.encode('ascii', 'replace').decode('ascii')}")
        
        # Verify no hardcoded "Aug 22, 2026 · 09:14 AM"
        assert "Aug 22, 2026 · 09:14 AM" not in timeline_text, "Hardcoded Aug 22 date string still present!"
        
        # Verify dynamic lifecycle events exist
        assert "Submitted" in timeline_text
        assert "Evaluated" in timeline_text
        assert "Document attached · operative_note_1.pdf" in timeline_text
        assert "Document attached · chart_notes_2.pdf" in timeline_text
        assert f"Appeal {apl1['id']} · Level 1" in timeline_text
        print("  --> [ISSUE 3 VERIFIED IN UI] Claim timeline reflects real events with dynamic local timestamps!")

        browser.close()

    # Clean up
    if sb:
        try:
            sb.table("appeals").delete().eq("claim_id", test_claim_id).execute()
        except Exception:
            pass
        try:
            sb.table("claim_documents").delete().eq("claim_id", test_claim_id).execute()
        except Exception:
            pass
        try:
            sb.table("claims_log").delete().eq("claim_id", test_claim_id).execute()
        except Exception:
            pass

    print("\n" + "=" * 65)
    print(">>> ALL 3 ISSUES ARE FULLY RESOLVED AND VERIFIED! <<<")
    print("=" * 65)

if __name__ == "__main__":
    test_all_three_issues()
