"""
Verification Test Script for DenialGuard AI Backend (with Authentication)
Tests all endpoints: /auth/login, /auth/me, /predict, /submit-outcome, /claims-log, /health
Validates JWT auth flow, response latency, schema adherence, SHAP outputs, and route protection.
"""

import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Global test token
AUTH_TOKEN = ""
AUTH_HEADERS = {}


def test_health_endpoint():
    print("\n[TEST 1] Testing GET /health...")
    response = client.get("/health")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data["status"] == "healthy"
    assert "metrics" in data
    assert "f1_score" in data["metrics"]
    print(f"Health check OK: Model F1={data['metrics'].get('f1_score')}, Accuracy={data['metrics'].get('accuracy')}")


def test_auth_login_success():
    global AUTH_TOKEN, AUTH_HEADERS
    print("\n[TEST 2] Testing POST /auth/login with valid credentials...")
    payload = {
        "work_email": "admin@denialguard.com",
        "password": "password123"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["email"] == "admin@denialguard.com"
    assert data["user"]["name"] == "Alice Admin"
    assert data["user"]["role"] == "Admin"

    AUTH_TOKEN = data["access_token"]
    AUTH_HEADERS = {"Authorization": f"Bearer {AUTH_TOKEN}"}
    print(f"Login OK: Received valid JWT token for {data['user']['name']} ({data['user']['role']})")


def test_auth_login_invalid_credentials():
    print("\n[TEST 3] Testing POST /auth/login with invalid password...")
    payload = {
        "work_email": "admin@denialguard.com",
        "password": "wrongpassword"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print("Correctly rejected invalid credentials with 401 Unauthorized.")


def test_auth_me_endpoint():
    print("\n[TEST 4] Testing GET /auth/me with Bearer token...")
    response = client.get("/auth/me", headers=AUTH_HEADERS)
    assert response.status_code == 200, f"Error {response.status_code}: {response.text}"
    data = response.json()
    assert data["email"] == "admin@denialguard.com"
    assert data["name"] == "Alice Admin"
    assert data["role"] == "Admin"
    print(f"GET /auth/me OK: Session restored for {data['email']}")


def test_unauthorized_access_protection():
    print("\n[TEST 5] Testing route protection without token...")
    resp_predict = client.post("/predict", json={})
    assert resp_predict.status_code == 401, f"Expected 401 for unauthenticated /predict, got {resp_predict.status_code}"

    resp_logs = client.get("/claims-log")
    assert resp_logs.status_code == 401, f"Expected 401 for unauthenticated /claims-log, got {resp_logs.status_code}"
    print("Correctly blocked unauthenticated requests with 401 Unauthorized.")


def test_predict_high_risk_claim():
    print("\n[TEST 6] Testing POST /predict with High-Risk Claim (Authenticated)...")
    payload = {
        "claim_id": "CLM-TEST-001",
        "claim_type": "Institutional",
        "payer": "UnitedHealthcare",
        "plan_type": "HMO",
        "eligibility_status": "Inactive",
        "provider_specialty": "Orthopedics",
        "network_status": "Out-of-Network",
        "icd10_code": "M25.50",
        "cpt_code": "27447",
        "modifiers": "None",
        "pos_code": "21",
        "units_billed": 1,
        "charge_amount": 5200.00,
        "pa_status": "Missing",
        "referral_status": "Missing",
        "documentation_flag": False,
        "dos": "2026-06-01",
        "submission_date": "2026-08-25",
        "days_to_filing_deadline": 5,
        "cob_flag": False
    }

    start_time = time.time()
    response = client.post("/predict", json=payload, headers=AUTH_HEADERS)
    elapsed = time.time() - start_time

    assert response.status_code == 200, f"Error {response.status_code}: {response.text}"
    data = response.json()

    print(f"Inference latency: {elapsed * 1000:.1f}ms (under 2s requirement)")
    print(f"Claim ID: {data['claim_id']}")
    print(f"Predicted Risk Score: {data['risk_score']}%")
    print(f"Predicted CARC Code: {data['predicted_carc_code']}")
    print(f"Suggested Corrective Action: {data['suggested_corrective_action']}")
    print(f"Top Contributing SHAP Factors: {data['top_contributing_factors']}")

    assert data["risk_score"] > 60.0, f"Expected high risk score, got {data['risk_score']}"
    assert len(data["top_contributing_factors"]) >= 3
    assert elapsed < 2.0, f"Prediction took too long: {elapsed}s"
    return data["claim_id"]


def test_predict_clean_claim():
    print("\n[TEST 7] Testing POST /predict with Clean/Low-Risk Claim (Authenticated)...")
    payload = {
        "claim_type": "Professional",
        "payer": "Medicare",
        "plan_type": "PPO",
        "eligibility_status": "Active",
        "provider_specialty": "General Practice",
        "network_status": "In-Network",
        "icd10_code": "I10",
        "cpt_code": "99213",
        "modifiers": "None",
        "pos_code": "11",
        "units_billed": 1,
        "charge_amount": 140.00,
        "pa_status": "Not Required",
        "referral_status": "Not Required",
        "documentation_flag": True,
        "dos": "2026-08-01",
        "submission_date": "2026-08-05",
        "days_to_filing_deadline": 175,
        "cob_flag": False
    }

    start_time = time.time()
    response = client.post("/predict", json=payload, headers=AUTH_HEADERS)
    elapsed = time.time() - start_time

    assert response.status_code == 200, f"Error {response.status_code}: {response.text}"
    data = response.json()

    print(f"Clean claim latency: {elapsed * 1000:.1f}ms")
    print(f"Claim ID (auto-generated): {data['claim_id']}")
    print(f"Predicted Risk Score: {data['risk_score']}%")
    print(f"Predicted CARC Code: {data['predicted_carc_code']}")
    print(f"Suggested Corrective Action: {data['suggested_corrective_action']}")

    assert data["risk_score"] < 40.0, f"Expected low risk score, got {data['risk_score']}"
    assert data["claim_id"].startswith("CLM-")
    return data["claim_id"]


def test_submit_outcome(claim_id: str):
    print(f"\n[TEST 8] Testing POST /submit-outcome for claim {claim_id} (Authenticated)...")
    payload = {
        "claim_id": claim_id,
        "actual_outcome": "denied",
        "denial_flag": True
    }
    response = client.post("/submit-outcome", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    assert data["status"] == "success"
    assert data["claim_id"] == claim_id
    assert data["actual_outcome"] == "denied"
    assert data["denial_flag"] is True
    print(f"Submit Outcome OK: {data}")


def test_submit_outcome_not_found():
    print("\n[TEST 9] Testing POST /submit-outcome for non-existent claim...")
    payload = {
        "claim_id": "CLM-DOES-NOT-EXIST-9999",
        "actual_outcome": "paid",
        "denial_flag": False
    }
    response = client.post("/submit-outcome", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    print("Correctly received 404 for unknown claim ID.")


def test_claims_log_endpoint():
    print("\n[TEST 10] Testing GET /claims-log (Authenticated)...")
    response = client.get("/claims-log?limit=10", headers=AUTH_HEADERS)
    assert response.status_code == 200, f"Error: {response.text}"
    logs = response.json()
    assert isinstance(logs, list)
    assert len(logs) >= 2, f"Expected at least 2 logged claims, got {len(logs)}"
    print(f"Claims log returned {len(logs)} records successfully.")
    print(f"Sample log entry: claim_id={logs[0].get('claim_id')}, risk_score={logs[0].get('predicted_risk_score')}")


def test_chat_endpoint_evaluates_denial_risk():
    print("\n[TEST 11] Testing POST /api/chat with evaluated denial risk context...")
    payload = {
        "messages": [
            {"role": "user", "content": "Explain why this claim was flagged and how to fix it."}
        ],
        "claimContext": {
            "form": {
                "payer": "UnitedHealthcare",
                "providerSpecialty": "Orthopedics",
                "cpt": "27447",
                "icd10": "M17.11",
                "paStatus": "Missing",
                "chargeAmount": 18450,
                "daysToDeadline": 45
            },
            "result": {
                "denialRiskScore": 0.885,
                "predictedCarcCode": "CO-197",
                "suggestedCorrectiveAction": "Verify prior authorization approval number before electronic clearinghouse submission.",
                "topContributingFactors": [
                    {"label": "Prior Authorization Missing", "impact": 0.45},
                    {"label": "Out-of-Network Provider", "impact": 0.25}
                ]
            }
        }
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "response" in data
    text = data["response"]
    print("Chat AI Response received successfully.")
    assert "88.5%" in text or "89%" in text or "Denial Risk" in text or "denial" in text.lower()
    assert "CO-197" in text or "Prior Authorization" in text or "authorization" in text.lower()
    print("Chat AI response correctly incorporates evaluated denial risk data.")


if __name__ == "__main__":
    print("=== DENIALGUARD AI BACKEND VERIFICATION SUITE (AUTH + ML + CHAT) ===")
    test_health_endpoint()
    test_auth_login_success()
    test_auth_login_invalid_credentials()
    test_auth_me_endpoint()
    test_unauthorized_access_protection()
    high_risk_id = test_predict_high_risk_claim()
    clean_id = test_predict_clean_claim()
    test_submit_outcome(high_risk_id)
    test_submit_outcome_not_found()
    test_claims_log_endpoint()
    test_chat_endpoint_evaluates_denial_risk()
    print("\n>>> ALL 11 TESTS PASSED SUCCESSFULLY! <<<")

