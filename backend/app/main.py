"""
DenialGuard AI - FastAPI Application Entrypoint
Predicts US healthcare claim denial risk, explains root causes with SHAP, and suggests pre-submission fixes.
"""

import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .routers.predict import router as predict_router
from .routers.submit_outcome import router as submit_outcome_router
from .routers.claims_log import router as claims_log_router
from .routers.auth import router as auth_router

load_dotenv()

# Configurable Frontend CORS Origin
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
ALLOWED_ORIGINS = [
    FRONTEND_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app = FastAPI(
    title="DenialGuard AI Backend API",
    description=(
        "Production-grade AI backend with JWT User Authentication, "
        "predicts US healthcare claim denial risk before submission, "
        "explains root causes using SHAP TreeExplainer, and suggests targeted corrective actions."
    ),
    version="1.1.0",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Endpoints
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(auth_router, tags=["Authentication (Root Alias)"])  # Provides /login & /me aliases
app.include_router(predict_router)
app.include_router(submit_outcome_router)
app.include_router(claims_log_router)


@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    metrics_path = os.path.join(os.path.dirname(__file__), "model", "metrics.json")
    model_metrics = {}
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r") as f:
                model_metrics = json.load(f)
        except Exception:
            pass

    return {
        "status": "healthy",
        "service": "DenialGuard AI Backend",
        "version": "1.0.0",
        "model_engine": "XGBoost + SHAP TreeExplainer",
        "metrics": model_metrics,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
