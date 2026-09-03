import os
import time
import requests
from playwright.sync_api import sync_playwright

BASE_API = "http://127.0.0.1:8000"
BASE_UI = "http://127.0.0.1:3000"

def test_claim_detail_bugs():
    print("=== STARTING VERIFICATION FOR ALL CARC & RARC PAIRINGS ===")
    
    # 1. Login to backend
    res_login = requests.post(f"{BASE_API}/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    assert res_login.status_code == 200, "Login failed"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Predict & Persist claims
    print("\n--- Submitting test claims to backend ---")

    # Claim 1: CO-197 (45 days)
    c1 = requests.post(f"{BASE_API}/predict", json={
        "claim_id": "CLM-VERIFY-CO197",
        "payer": "UnitedHealthcare",
        "plan_type": "Commercial",
        "eligibility_status": "Active",
        "provider_specialty": "Orthopedics",
        "network_status": "In-Network",
        "icd10_code": "M17.11",
        "cpt_code": "27447",
        "charge_amount": "4500.00",
        "pa_status": "Denied",
        "documentation_flag": True,
        "days_to_filing_deadline": 45
    }, headers=headers).json()
    print(f"Created CLM-VERIFY-CO197: CARC={c1['predicted_carc_code']}, deadline=45d")

    # Claim 2: CO-16 (5 days)
    c2 = requests.post(f"{BASE_API}/predict", json={
        "claim_id": "CLM-VERIFY-CO16",
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
        "days_to_filing_deadline": 5
    }, headers=headers).json()
    print(f"Created CLM-VERIFY-CO16: CARC={c2['predicted_carc_code']}, deadline=5d")

    # Claim 3: CLEAN (175 days)
    c3 = requests.post(f"{BASE_API}/predict", json={
        "claim_id": "CLM-VERIFY-CLEAN",
        "payer": "Medicare",
        "plan_type": "Commercial",
        "eligibility_status": "Active",
        "provider_specialty": "Cardiology",
        "network_status": "In-Network",
        "icd10_code": "I25.10",
        "cpt_code": "93000",
        "charge_amount": "250.00",
        "pa_status": "Approved",
        "documentation_flag": True,
        "days_to_filing_deadline": 175
    }, headers=headers).json()
    print(f"Created CLM-VERIFY-CLEAN: CARC={c3['predicted_carc_code']}, deadline=175d")

    # Claim 4: CO-45 (Fee Schedule Variance, e.g. $45,000 for 27447 with Missing PA)
    c4 = requests.post(f"{BASE_API}/predict", json={
        "claim_id": "CLM-VERIFY-CO45",
        "payer": "UnitedHealthcare",
        "plan_type": "Commercial",
        "eligibility_status": "Active",
        "provider_specialty": "Orthopedics",
        "network_status": "In-Network",
        "icd10_code": "M17.11",
        "cpt_code": "27447",
        "charge_amount": "45000.00",
        "pa_status": "Missing",
        "documentation_flag": True,
        "days_to_filing_deadline": 25
    }, headers=headers).json()
    print(f"Created CLM-VERIFY-CO45: CARC={c4['predicted_carc_code']}, deadline=25d")

    # 3. Launch browser and verify UI
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        # Login in UI
        page.goto(f"{BASE_UI}/sign-in", wait_until="networkidle")
        page.locator("input[type='email']").fill("admin@denialguard.com")
        page.locator("input[type='password']").fill("password123")
        page.locator("button[type='submit']").click()
        page.wait_for_load_state("networkidle")
        time.sleep(1.0)

        # ----------------------------------------------------
        # TEST 1: CO-197 Claim (CLM-VERIFY-CO197, 45d deadline)
        # ----------------------------------------------------
        print("\n>>> [TEST 1] Inspecting CO-197 Claim (CLM-VERIFY-CO197)...")
        page.goto(f"{BASE_UI}/claims/CLM-VERIFY-CO197", wait_until="networkidle")
        time.sleep(1.0)

        p1 = page.locator(".owner-line:has-text('Priority') strong").inner_text()
        print(f"  [Priority] Got: '{p1}' (Expected: 'Low · 45d to deadline')")
        assert p1 == "Low · 45d to deadline"

        nba_title1 = page.locator(".next-action strong").first.inner_text()
        nba_desc1 = page.locator(".next-action p").first.inner_text()
        print(f"  [Next Best Action] Title: '{nba_title1}', Desc: '{nba_desc1[:60]}...'")
        assert nba_title1 == "Obtain prior authorization"
        assert "Prior authorization" in nba_desc1 or "prior authorization" in nba_desc1

        callout1 = page.locator(".code-callout").inner_text()
        print(f"  [RARC Callout] Text: '{callout1.replace(chr(10), ' ')}'")
        assert "CO-197" in callout1
        assert "RARC N54" in callout1
        print("  --> CO-197 Claim Fully Verified!")

        # ----------------------------------------------------
        # TEST 2: CO-16 Claim (CLM-VERIFY-CO16, 5d deadline)
        # ----------------------------------------------------
        print("\n>>> [TEST 2] Inspecting CO-16 Claim (CLM-VERIFY-CO16)...")
        page.goto(f"{BASE_UI}/claims/CLM-VERIFY-CO16", wait_until="networkidle")
        time.sleep(1.0)

        p2 = page.locator(".owner-line:has-text('Priority') strong").inner_text()
        print(f"  [Priority] Got: '{p2}' (Expected: 'High · 5d to deadline')")
        assert p2 == "High · 5d to deadline"

        nba_title2 = page.locator(".next-action strong").first.inner_text()
        nba_desc2 = page.locator(".next-action p").first.inner_text()
        print(f"  [Next Best Action] Title: '{nba_title2}', Desc: '{nba_desc2[:60]}...'")
        assert nba_title2 == "Secure clinical documentation"
        assert "clinical documentation" in nba_desc2 or "medical records" in nba_desc2

        callout2 = page.locator(".code-callout").inner_text()
        print(f"  [RARC Callout] Text: '{callout2.replace(chr(10), ' ')}'")
        assert "CO-16" in callout2
        assert "RARC N290" in callout2
        print("  --> CO-16 Claim Fully Verified!")

        # ----------------------------------------------------
        # TEST 3: CLEAN Claim (CLM-VERIFY-CLEAN, 175d deadline)
        # ----------------------------------------------------
        print("\n>>> [TEST 3] Inspecting CLEAN Claim (CLM-VERIFY-CLEAN)...")
        page.goto(f"{BASE_UI}/claims/CLM-VERIFY-CLEAN", wait_until="networkidle")
        time.sleep(1.0)

        p3 = page.locator(".owner-line:has-text('Priority') strong").inner_text()
        print(f"  [Priority] Got: '{p3}' (Expected: 'Low · 175d to deadline')")
        assert p3 == "Low · 175d to deadline"

        nba_title3 = page.locator(".next-action strong").first.inner_text()
        nba_desc3 = page.locator(".next-action p").first.inner_text()
        print(f"  [Next Best Action] Title: '{nba_title3}', Desc: '{nba_desc3}'")
        assert "Claim is clean" in nba_title3 or "No action needed" in nba_title3
        assert "Upload the operative note" not in nba_desc3
        assert "protect $" not in nba_desc3

        callout3 = page.locator(".code-callout").inner_text()
        print(f"  [RARC Callout] Text: '{callout3.replace(chr(10), ' ')}'")
        assert "CLEAN" in callout3
        assert "RARC" not in callout3
        print("  --> CLEAN Claim Fully Verified!")

        # ----------------------------------------------------
        # TEST 4: CO-45 Claim (CLM-VERIFY-CO45, 25d deadline)
        # ----------------------------------------------------
        print("\n>>> [TEST 4] Inspecting CO-45 Claim (CLM-VERIFY-CO45)...")
        page.goto(f"{BASE_UI}/claims/CLM-VERIFY-CO45", wait_until="networkidle")
        time.sleep(1.0)

        p4 = page.locator(".owner-line:has-text('Priority') strong").inner_text()
        print(f"  [Priority] Got: '{p4}' (Expected: 'Medium · 25d to deadline')")
        assert p4 == "Medium · 25d to deadline"

        nba_title4 = page.locator(".next-action strong").first.inner_text()
        nba_desc4 = page.locator(".next-action p").first.inner_text()
        print(f"  [Next Best Action] Title: '{nba_title4}', Desc: '{nba_desc4[:60]}...'")
        assert "corrective action" in nba_title4.lower() or "fee schedule" in nba_desc4.lower()
        assert "Charge amount exceeds expected fee schedule variance" in nba_desc4

        callout4 = page.locator(".code-callout").inner_text()
        print(f"  [RARC Callout] Text: '{callout4.replace(chr(10), ' ')}'")
        assert "CO-45" in callout4
        assert "RARC N14" in callout4
        print("  --> CO-45 Claim Fully Verified!")

        browser.close()

    # 4. Clean up test records
    sb = requests.post(f"{BASE_API}/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    from backend.app.db import get_supabase
    client_sb = get_supabase()
    if client_sb:
        client_sb.table("claims_log").delete().in_("claim_id", ["CLM-VERIFY-CO197", "CLM-VERIFY-CO16", "CLM-VERIFY-CLEAN", "CLM-VERIFY-CO45"]).execute()

    print("\n" + "=" * 65)
    print(">>> ALL CLAIM DETAILS & RARC PAIRINGS VERIFIED & PASSING <<<")
    print("=" * 65)

if __name__ == "__main__":
    test_claim_detail_bugs()
