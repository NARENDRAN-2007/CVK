"""
Comprehensive Verification Suite for DenialGuard AI Fixes (Priorities 1 - 7)
"""

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.model.predict import predict_claim, determine_carc_and_action, compute_engineered_features, CLEAN_RISK_THRESHOLD, HIGH_RISK_ALERT_THRESHOLD
from backend.app.schemas import ClaimInput
from backend.app.db import get_appeals, _in_memory_appeals

client = TestClient(app)

def test_priority_1_and_2_carc_recommendation_and_pa_status():
    print("\n--- Testing Priority 1 & 2: CARC recommendation based on SHAP driver & PA Status ---")
    
    # Claim 1: Denied PA ($4500 for knee arthroplasty), Missing/Denied PA is the #1 risk-increasing driver
    claim_pa = ClaimInput(
        claim_type="Professional",
        payer="UnitedHealthcare",
        plan_type="Commercial",
        eligibility_status="Active",
        provider_specialty="Orthopedics",
        network_status="In-Network",
        icd10_code="M17.11",
        cpt_code="27447",
        modifiers="None",
        pos_code="11",
        units_billed=1,
        charge_amount=4500.00,
        pa_status="Denied",
        referral_status="Not Required",
        documentation_flag=True,
        days_to_filing_deadline=45,
        cob_flag=False
    )
    
    res_pa = predict_claim(claim_pa)
    api_pa = res_pa["api_response"]
    
    print(f"Claim 1 Top Factors: {api_pa['top_contributing_factors']}")
    print(f"Claim 1 Predicted CARC: {api_pa['predicted_carc_code']}")
    assert api_pa["predicted_carc_code"] == "CO-197", f"Expected CO-197 for Denied PA, got {api_pa['predicted_carc_code']}"

    # Claim 2: Missing clinical documentation
    claim_doc = ClaimInput(
        claim_type="Professional",
        payer="UnitedHealthcare",
        plan_type="Commercial",
        eligibility_status="Active",
        provider_specialty="Orthopedics",
        network_status="In-Network",
        icd10_code="M17.11",
        cpt_code="27447",
        modifiers="None",
        pos_code="11",
        units_billed=1,
        charge_amount=4500.00,
        pa_status="Approved",
        referral_status="Not Required",
        documentation_flag=False,
        days_to_filing_deadline=45,
        cob_flag=False
    )
    res_doc = predict_claim(claim_doc)
    api_doc = res_doc["api_response"]
    print(f"Claim 2 Top Factors: {api_doc['top_contributing_factors']}")
    print(f"Claim 2 Predicted CARC: {api_doc['predicted_carc_code']}")
    assert api_doc["predicted_carc_code"] == "CO-16", f"Expected CO-16 for Missing Documentation, got {api_doc['predicted_carc_code']}"


def test_priority_3_schema_validation_literal_constraints():
    print("\n--- Testing Priority 3: Categorical Field Schema Validation ---")
    
    # Test invalid payer (e.g. "Medicare Part B")
    invalid_payer_payload = {
        "payer": "Medicare Part B",
        "provider_specialty": "Orthopedics",
        "icd10_code": "M17.11",
        "cpt_code": "27447",
        "charge_amount": 18450.00,
        "documentation_flag": True
    }
    
    # Login first
    login_res = client.post("/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    res = client.post("/predict", json=invalid_payer_payload, headers=headers)
    assert res.status_code == 422, f"Expected 422 for invalid payer 'Medicare Part B', got {res.status_code}"
    print("Invalid payer 'Medicare Part B' correctly failed with 422 Unprocessable Entity.")

    # Test invalid specialty
    invalid_spec_payload = {
        "payer": "UnitedHealthcare",
        "provider_specialty": "Invalid Specialty 123",
        "icd10_code": "M17.11",
        "cpt_code": "27447",
        "charge_amount": 18450.00,
        "documentation_flag": True
    }
    res_spec = client.post("/predict", json=invalid_spec_payload, headers=headers)
    assert res_spec.status_code == 422, f"Expected 422 for invalid specialty, got {res_spec.status_code}"
    print("Invalid specialty correctly failed with 422.")


def test_priority_4_eligibility_status():
    print("\n--- Testing Priority 4: Eligibility Status handling & CO-27 CARC ---")
    
    claim = ClaimInput(
        claim_type="Professional",
        payer="Medicare",
        plan_type="Commercial",
        eligibility_status="Inactive",
        provider_specialty="Internal Medicine",
        network_status="In-Network",
        icd10_code="I10",
        cpt_code="99213",
        modifiers="None",
        pos_code="11",
        units_billed=1,
        charge_amount=140.00,
        pa_status="Approved",
        referral_status="Not Required",
        documentation_flag=True,
        days_to_filing_deadline=45,
        cob_flag=False
    )
    
    res = predict_claim(claim)
    api_res = res["api_response"]
    print(f"Predicted CARC for Inactive Eligibility: {api_res['predicted_carc_code']}")
    print(f"Top factors: {api_res['top_contributing_factors']}")
    assert api_res["predicted_carc_code"] in ["CO-27", "CO-97"], f"Expected CO-27 or CO-97, got {api_res['predicted_carc_code']}"


def test_priority_5_claim_amount_deviation_cpt_payer_percentage():
    print("\n--- Testing Priority 5: CPT+Payer Keyed Normalized Percentage Deviation ---")
    
    # 27447 mean charge is ~23801.58.
    # Charge of 35000 is higher than mean (+47.05%), charge of 10000 is lower than mean (-57.99%)
    features_high = compute_engineered_features({
        "cpt_code": "27447",
        "payer": "UnitedHealthcare",
        "provider_specialty": "Orthopedics",
        "charge_amount": 35000.00
    })
    features_low = compute_engineered_features({
        "cpt_code": "27447",
        "payer": "UnitedHealthcare",
        "provider_specialty": "Orthopedics",
        "charge_amount": 10000.00
    })
    
    print(f"Engineered features for 27447 / UHC ($35000): {features_high}")
    print(f"Engineered features for 27447 / UHC ($10000): {features_low}")
    assert features_high["claim_amount_deviation"] > 0, "Expected positive percentage deviation for $35k"
    assert features_low["claim_amount_deviation"] < 0, "Expected negative percentage deviation for $10k"
    assert isinstance(features_high["claim_amount_deviation"], float)
    print(f"Normalized claim amount deviations: +{features_high['claim_amount_deviation']}% and {features_low['claim_amount_deviation']}%")


def test_priority_6_thresholds_reconciliation():
    print("\n--- Testing Priority 6: Reconciled Risk Threshold Configurations ---")
    assert CLEAN_RISK_THRESHOLD == 35.0
    assert HIGH_RISK_ALERT_THRESHOLD == 60.0
    print(f"Thresholds verified: Clean < {CLEAN_RISK_THRESHOLD}%, High Risk Alert >= {HIGH_RISK_ALERT_THRESHOLD}%")


def test_priority_7_start_appeal_creates_pipeline_entry():
    print("\n--- Testing Priority 7: Start Appeal DB Creation & Pipeline Persistence ---")
    
    login_res = client.post("/auth/login", json={"work_email": "admin@denialguard.com", "password": "password123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 1: Predict and log a claim
    claim_id = "CLM-TEST-APPEAL-001"
    pred_res = client.post("/predict", headers=headers, json={
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
    assert pred_res.status_code == 200
    
    # Step 2: Call create appeal (the action invoked by clicking Start Appeal in Claim Details / Log)
    appeal_res = client.post("/appeals", headers=headers, json={
        "claim_id": claim_id,
        "appeal_level": "Level 1",
        "notes": "Initiated appeal from Claims Log for UnitedHealthcare."
    })
    assert appeal_res.status_code == 201
    appeal_data = appeal_res.json()
    appeal_id = appeal_data["id"]
    print(f"Created appeal via API: {appeal_id} for claim {claim_id}")
    
    # Step 3: Verify direct DB read
    appeals_in_db = get_appeals()
    matched = [a for a in appeals_in_db if a.get("id") == appeal_id or a.get("claim_id") == claim_id]
    assert len(matched) > 0, "Appeal record was not found in DB appeals table!"
    assert matched[0]["status"] == "drafting"
    assert matched[0]["claim_id"] == claim_id
    print(f"Confirmed in DB: Appeal {matched[0]['id']} exists with status '{matched[0]['status']}'.")
    
    # Step 4: Verify Appeals pipeline GET /appeals endpoint returns this card
    list_res = client.get("/appeals", headers=headers)
    assert list_res.status_code == 200
    pipeline_appeals = list_res.json()
    pipeline_match = [a for a in pipeline_appeals if a["id"] == appeal_id]
    assert len(pipeline_match) == 1
    assert pipeline_match[0]["status"] == "drafting"
    print(f"Appeals pipeline successfully displays appeal {appeal_id} in Drafting column.")

if __name__ == "__main__":
    test_priority_1_and_2_carc_recommendation_and_pa_status()
    test_priority_3_schema_validation_literal_constraints()
    test_priority_4_eligibility_status()
    test_priority_5_claim_amount_deviation_cpt_payer_percentage()
    test_priority_6_thresholds_reconciliation()
    test_priority_7_start_appeal_creates_pipeline_entry()
    print("\n=======================================================")
    print(">>> ALL 7 PRIORITIES VERIFIED AND FULLY PASSING! <<<")
    print("=======================================================")
