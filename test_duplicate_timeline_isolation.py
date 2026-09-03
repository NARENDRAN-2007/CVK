import os
import time
import uuid
import requests
from playwright.sync_api import sync_playwright

BASE_API = "http://127.0.0.1:8000"
BASE_UI = "http://127.0.0.1:3000"

def test_duplicate_timeline_isolation():
    print("=================================================================")
    print(">>> VERIFYING NO PHANTOM TIMELINE ENTRY ON 409 DUPLICATE APPEAL")
    print("=================================================================")

    # 1. Login
    res_login = requests.post(f"{BASE_API}/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    assert res_login.status_code == 200, "Login failed"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create test claim
    claim_id = f"CLM-ISO-{uuid.uuid4().hex[:6].upper()}"
    requests.post(f"{BASE_API}/predict", json={
        "claim_id": claim_id,
        "payer": "UnitedHealthcare",
        "plan_type": "Commercial",
        "eligibility_status": "Active",
        "provider_specialty": "Orthopedics",
        "network_status": "In-Network",
        "icd10_code": "M17.11",
        "cpt_code": "27447",
        "charge_amount": "14500.00",
        "pa_status": "Missing",
        "documentation_flag": False,
        "days_to_filing_deadline": 25
    }, headers=headers)
    print(f"Created claim: {claim_id}")

    # 3. Step 1: Start valid Appeal (Should return 201)
    res1 = requests.post(f"{BASE_API}/appeals", json={
        "claim_id": claim_id,
        "appeal_level": "Level 1",
        "notes": "Initial appeal submission"
    }, headers=headers)
    assert res1.status_code == 201, f"Appeal 1 creation failed: {res1.text}"
    apl1_id = res1.json()["id"]
    print(f"  [Step 1 Pass] Valid Appeal Created: {apl1_id} (Status: 201)")

    # 4. Step 2: Attempt Duplicate Appeal (Must return 409 Conflict)
    res2 = requests.post(f"{BASE_API}/appeals", json={
        "claim_id": claim_id,
        "appeal_level": "Level 1",
        "notes": "Duplicate appeal attempt"
    }, headers=headers)
    print(f"  [Step 2 Pass] Duplicate Appeal Attempt Status: {res2.status_code} (Expected 409)")
    assert res2.status_code == 409, f"Expected 409, got {res2.status_code}: {res2.text}"

    # 5. Check DB records: exactly 1 appeal exists
    all_appeals = requests.get(f"{BASE_API}/appeals", headers=headers).json()
    claim_appeals = [a for a in all_appeals if a["claim_id"] == claim_id]
    print(f"  [DB Check Pass] Total appeals for claim {claim_id}: {len(claim_appeals)} (Expected 1)")
    assert len(claim_appeals) == 1, f"Expected 1 appeal in DB, got {len(claim_appeals)}"
    assert claim_appeals[0]["id"] == apl1_id

    # 6. Step 3: Check UI Claim Timeline in Browser
    print("\n>>> Checking UI Claim Timeline in Browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        page.goto(f"{BASE_UI}/sign-in", wait_until="domcontentloaded")
        page.locator("input[type='email']").fill("admin@denialguard.com")
        page.locator("input[type='password']").fill("password123")
        page.locator("button[type='submit']").click()
        time.sleep(2.0)

        page.goto(f"{BASE_UI}/claims/{claim_id}", wait_until="domcontentloaded")
        page.wait_for_selector(".detail-actions:has-text('View appeal')", timeout=10000)

        timeline_text = page.locator(".timeline").inner_text()
        print(f"  Timeline on Page:\n{timeline_text}")

        # Count how many times 'Appeal' appears in timeline
        appeal_count = timeline_text.count("Appeal")
        print(f"\n  Timeline 'Appeal' entry count: {appeal_count} (Expected: 1)")
        assert appeal_count == 1, f"Expected exactly 1 Appeal entry, found {appeal_count}"
        assert f"Appeal {apl1_id}" in timeline_text, f"Expected 'Appeal {apl1_id}' in timeline"

        browser.close()

    print("\n=================================================================")
    print(">>> SUCCESS: 409 Rejected Duplicate Appeal Produced ZERO Phantom Entries!")
    print("=================================================================")

if __name__ == "__main__":
    test_duplicate_timeline_isolation()
