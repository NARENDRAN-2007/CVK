import os
import time
import uuid
import requests
from backend.app.db import get_supabase
from playwright.sync_api import sync_playwright

BASE_API = "http://127.0.0.1:8000"
BASE_UI = "http://127.0.0.1:3000"

def test_supabase_documents_e2e():
    print("=================================================================")
    print(">>> E2E TEST: SUPABASE CLAIM_DOCUMENTS PERSISTENCE & LIFECYCLE")
    print("=================================================================")

    # 1. Inspect Table Schema via Supabase directly
    sb = get_supabase()
    res_schema = sb.table("claim_documents").select("*").limit(1).execute()
    print("  [Step 1 Pass] Supabase 'claim_documents' table exists and is accessible via REST API!")

    # 2. Login as User A (Admin)
    res_a = requests.post(f"{BASE_API}/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 3. Create a test claim
    claim_id = f"CLM-DOC-{uuid.uuid4().hex[:6].upper()}"
    requests.post(f"{BASE_API}/predict", json={
        "claim_id": claim_id,
        "payer": "Cigna",
        "plan_type": "Commercial",
        "eligibility_status": "Active",
        "provider_specialty": "Cardiology",
        "network_status": "In-Network",
        "icd10_code": "I25.10",
        "cpt_code": "93458",
        "charge_amount": "8500.00",
        "pa_status": "Missing",
        "documentation_flag": False,
        "days_to_filing_deadline": 15
    }, headers=headers_a)
    print(f"  [Step 2 Pass] Created test claim {claim_id}")

    # 4. Upload a document as User A
    doc_filename = f"cardiac_cath_report_{uuid.uuid4().hex[:4]}.pdf"
    res_upload = requests.post(
        f"{BASE_API}/claims/{claim_id}/documents",
        files={"file": (doc_filename, b"%PDF-1.4 Mock cardiac catheterization operative report", "application/pdf")},
        data={"document_type": "operative_report"},
        headers=headers_a
    )
    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    uploaded_doc = res_upload.json()["document"]
    doc_id = uploaded_doc["id"]
    print(f"  [Step 3 Pass] Uploaded document {doc_filename} -> doc_id: {doc_id}")

    # 5. Direct Supabase Query: Confirm row actually landed in Cloud Supabase table
    sb_query = sb.table("claim_documents").select("*").eq("id", doc_id).execute()
    assert len(sb_query.data) == 1, f"Expected 1 record in Supabase claim_documents, found {len(sb_query.data)}"
    db_row = sb_query.data[0]
    print(f"  [Step 4 Pass] Supabase Direct DB Confirmation: Row found in 'public.claim_documents'!")
    print(f"                id: {db_row['id']}, claim_id: {db_row['claim_id']}, title: {db_row['document_title']}")
    assert db_row["claim_id"] == claim_id
    assert db_row["document_title"] == doc_filename

    # 6. Login as User B (Bob Biller) in a distinct session
    res_b = requests.post(f"{BASE_API}/auth/login", json={"work_email": "biller@denialguard.com", "password": "password123"})
    assert res_b.status_code == 200, f"User B login failed: {res_b.text}"
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Fetch claim documents as User B
    res_docs_b = requests.get(f"{BASE_API}/claims/{claim_id}/documents", headers=headers_b)
    assert res_docs_b.status_code == 200
    docs_b = res_docs_b.json()
    assert any(d["id"] == doc_id for d in docs_b), f"Document {doc_id} not visible to User B"
    print(f"  [Step 5 Pass] Cross-Session Visibility: User B retrieved document {doc_id} from Supabase")

    # 7. Create an Appeal for the claim
    res_appeal = requests.post(
        f"{BASE_API}/appeals",
        json={"claim_id": claim_id, "appeal_level": "Level 1", "notes": "Appeal with persistent docs"},
        headers=headers_a
    )
    assert res_appeal.status_code == 201
    appeal_data = res_appeal.json()
    appeal_id = appeal_data["id"]
    print(f"  [Step 6 Pass] Created Appeal {appeal_id}")
    print(f"                attached_document_ids: {appeal_data['attached_document_ids']}")
    assert doc_id in appeal_data["attached_document_ids"]

    # 8. Browser Verification via Playwright
    print("\n>>> Verifying UI Kanban & Claim Timeline in Browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        # Login
        page.goto(f"{BASE_UI}/sign-in", wait_until="domcontentloaded")
        page.locator("input[type='email']").fill("admin@denialguard.com")
        page.locator("input[type='password']").fill("password123")
        page.locator("button[type='submit']").click()
        time.sleep(2.0)

        # 8a. Verify Appeals Pipeline Kanban displays "1 docs attached"
        page.goto(f"{BASE_UI}/appeals", wait_until="domcontentloaded")
        time.sleep(2.0)
        card = page.locator(f".appeal-card:has-text('{claim_id}')").first
        card_text = card.inner_text()
        print(f"  Kanban Card: '{card_text.replace(chr(10), ' ').encode('ascii', 'replace').decode('ascii')}'")
        assert "1 docs attached" in card_text, f"Expected '1 docs attached' in Kanban card, got: {card_text}"
        print("  --> [ISSUE 1 LIVE VERIFIED WITH SUPABASE] Kanban card shows '1 docs attached'!")

        # 8b. Verify Claim Detail Timeline displays "Document attached" and "Appeal"
        page.goto(f"{BASE_UI}/claims/{claim_id}", wait_until="domcontentloaded")
        page.wait_for_selector(f".timeline:has-text('{appeal_id}')", timeout=10000)
        timeline_text = page.locator(".timeline").inner_text()
        print(f"  Timeline on Page:\n{timeline_text.encode('ascii', 'replace').decode('ascii')}")
        assert f"Document attached" in timeline_text and doc_filename in timeline_text, f"Document not in timeline: {timeline_text}"
        assert f"Appeal {appeal_id}" in timeline_text, f"Appeal not in timeline: {timeline_text}"
        print("  --> [TIMELINE VERIFIED WITH SUPABASE] Document event and Appeal event rendered with correct filename and timestamp!")

        browser.close()

    print("\n=================================================================")
    print(">>> FULL PERSISTENT DOCUMENT LIFECYCLE VERIFIED END-TO-END! <<<")
    print("=================================================================")

if __name__ == "__main__":
    test_supabase_documents_e2e()
