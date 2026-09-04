import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .routers.predict import router as predict_router
from .routers.submit_outcome import router as submit_outcome_router
from .routers.claims_log import router as claims_log_router
from .routers.auth import router as auth_router
from .routers.workspace import router as workspace_router
from .routers.documents import router as documents_router
from .routers.appeals import router as appeals_router
from .routers.notifications import router as notifications_router
from .routers.chat import router as chat_router

load_dotenv()

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
ALLOWED_ORIGINS = [
    FRONTEND_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app = FastAPI(
    title="DenialGuard AI Backend API",
    description="Production-grade AI backend with JWT User Authentication, claim denial prediction, SHAP explainability, appeals pipeline, and document ingestion.",
    version="1.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(auth_router, tags=["Authentication (Root Alias)"])
app.include_router(workspace_router)
app.include_router(documents_router)
app.include_router(appeals_router)
app.include_router(notifications_router)
app.include_router(predict_router)
app.include_router(submit_outcome_router)
app.include_router(claims_log_router)
app.include_router(chat_router)


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
        "service": "DenialGuard AI Inference Engine & Platform API",
        "model_version": "v1.3.0",
        "metrics": model_metrics
    }
