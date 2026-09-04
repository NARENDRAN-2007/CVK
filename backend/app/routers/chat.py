import os
import json
import urllib.request
import urllib.error
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["AI Chatbot"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    claimContext: Optional[Dict[str, Any]] = None
    userPrompt: Optional[str] = None

@router.post("/chat")
async def chat_endpoint(request: ChatRequest, req: Request):
    # Check for API key from env or Authorization header
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    auth_header = req.headers.get("Authorization", "")
    if auth_header and auth_header.startswith("Bearer gsk_"):
        groq_api_key = auth_header.replace("Bearer ", "").strip()
    
    if not groq_api_key or not groq_api_key.startswith("gsk_"):
        groq_api_key = os.getenv("GROQ_API_KEY", "")

    context = request.claimContext or {}
    form = context.get("form", {})
    result = context.get("result", {})

    # Build detailed RCM & SHAP system context
    system_prompt = (
        "You are DenialGuard AI, an expert Healthcare Revenue Cycle Management (RCM) and ML Explainability Assistant. "
        "Your primary directive is to answer user queries strictly based on the evaluated denial risk predictions, "
        "XGBoost SHAP feature attributions, CARC reason codes, and prescriptive clinical/billing fixes.\n\n"
    )

    if form:
        system_prompt += (
            f"**Current Claim Input Parameters:**\n"
            f"- Payer: {form.get('payer', 'N/A')}\n"
            f"- Provider Specialty: {form.get('providerSpecialty', 'N/A')}\n"
            f"- CPT Code: {form.get('cpt', 'N/A')} | ICD-10 Diagnosis: {form.get('icd10', 'N/A')}\n"
            f"- Prior Auth Status: {form.get('paStatus', 'N/A')}\n"
            f"- Eligibility Status: {form.get('eligibilityStatus', 'Active')}\n"
            f"- Network Status: {form.get('networkStatus', 'In-Network')}\n"
            f"- Documentation Attached: {form.get('documentationFlag', 'false')}\n"
            f"- Billed Amount: ${form.get('chargeAmount', '0')}\n"
            f"- Days to Filing Deadline: {form.get('daysToDeadline', '45')}\n\n"
        )

    if result:
        risk = result.get('denialRiskScore', 0)
        risk_pct = round(risk if risk > 1 else risk * 100, 1)
        system_prompt += (
            f"**Evaluated Denial Risk Results:**\n"
            f"- Predicted Denial Risk Score: {risk_pct}%\n"
            f"- Predicted CARC Reason Code: {result.get('predictedCarcCode', 'CO-197')}\n"
            f"- Suggested Corrective Action: {result.get('suggestedCorrectiveAction', 'N/A')}\n"
        )
        factors = result.get('topContributingFactors', [])
        if factors:
            system_prompt += "- Top SHAP Contributing Factors:\n"
            for f in factors:
                label = f.get('label') or f.get('feature', 'Factor')
                impact = f.get('impact', 0)
                impact_pct = round(impact * 100 if impact <= 1 else impact, 1)
                system_prompt += f"  * {label}: +{impact_pct}% risk contribution\n"
        system_prompt += "\n"
    else:
        system_prompt += (
            "Note: Denial risk scoring has not been evaluated yet for this claim context. "
            "Advise the user to click 'Evaluate Denial Risk' to run the machine learning prediction model.\n\n"
        )

    system_prompt += (
        "CRITICAL INSTRUCTION: You MUST strictly base your answer on the evaluated denial risk score, "
        "predicted CARC code, SHAP feature drivers, and suggested corrective actions listed above whenever available. "
        "Explicitly quote and ground all explanations in these evaluated denial risk metrics."
    )

    messages_payload = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        if msg.role != "system":
            messages_payload.append({"role": msg.role, "content": msg.content})

    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json",
        "User-Agent": "DenialGuard-AI-Backend/1.3.0"
    }

    # Try fast lightweight Groq models to avoid rate limit spikes
    candidate_models = ["groq/compound-mini", "openai/gpt-oss-20b", "canopylabs/orpheus-v1-english", "groq/compound"]
    
    last_error = None
    for model_name in candidate_models:
        payload = json.dumps({
            "model": model_name,
            "messages": messages_payload,
            "max_tokens": 1000,
            "temperature": 0.3
        }).encode("utf-8")

        try:
            req_obj = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=payload,
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req_obj, timeout=15) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                content = resp_data["choices"][0]["message"]["content"]
                return {"response": content, "source": "groq", "model": model_name}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            last_error = f"Groq API Error ({e.code}): {err_body}"
            if "rate_limit" in err_body.lower():
                continue
            break
        except Exception as e:
            last_error = str(e)
            break

    # Fallback to local RCM engine grounded in evaluated denial risk
    risk_val = result.get('denialRiskScore', 0) if result else 0
    risk_pct = round(risk_val if risk_val > 1 else risk_val * 100, 1)
    carc_code = result.get('predictedCarcCode', 'CO-197') if result else 'N/A'
    action = result.get('suggestedCorrectiveAction', 'Verify prior authorization and clinical documentation before EDI transmission.') if result else 'Click Evaluate Denial Risk to generate prediction.'
    
    factors_md = ""
    if result and result.get('topContributingFactors'):
        factors_md = "\n**Key SHAP Risk Attribution Drivers:**\n" + "\n".join(
            [f"- **{f.get('label') or f.get('feature')}:** +{round((f.get('impact', 0) * 100 if f.get('impact', 0) <= 1 else f.get('impact', 0)), 1)}% risk contribution" for f in result.get('topContributingFactors', [])]
        )

    return {
        "response": (
            f"### 📊 Evaluated Denial Risk Analysis & Attribution\n\n"
            f"**Evaluated Denial Risk Score:** **{risk_pct}%**\n"
            f"- **Payer & Specialty:** {form.get('payer', 'UnitedHealthcare')} ({form.get('providerSpecialty', 'Orthopedics')})\n"
            f"- **Procedure Code:** CPT `{form.get('cpt', '27447')}` | ICD-10 `{form.get('icd10', 'M17.11')}`\n"
            f"- **Predicted CARC Code:** `{carc_code}`\n"
            f"{factors_md}\n\n"
            f"**Recommended Action Plan:**\n> {action}\n"
        ),
        "source": "fallback",
        "error": last_error
    }
