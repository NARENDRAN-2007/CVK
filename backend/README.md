# DenialGuard AI Backend

Production-grade AI/ML backend built with **FastAPI**, **XGBoost**, **SHAP**, and **Supabase** for healthcare claim denial risk prediction, root cause attribution, and pre-submission remediation.

For full architectural deep-dive, schema definitions, and API specifications, please see:
👉 **[BACKEND_DOCUMENTATION.md](file:///c:/Users/kayel/my-hackathon-project/backend/BACKEND_DOCUMENTATION.md)**

---

## Quick Reference

### Starting the Server
```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Swagger UI: `http://localhost:8000/docs`

### Running the Test Suite
```powershell
python -u test_backend.py
```

### Key Endpoints
| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public | Authenticate user & get 24h JWT Bearer token |
| `GET` | `/auth/me` | Bearer Token | Retrieve authenticated user profile |
| `POST` | `/predict` | Bearer Token | Predict claim denial risk (0–100%) & SHAP drivers |
| `POST` | `/submit-outcome`| Bearer Token | Record actual claim adjudication (`paid`/`denied`) |
| `GET` | `/claims-log` | Bearer Token | Fetch recent claim audit logs |
| `GET` | `/health` | Public | System status & model validation metrics |

### Default Test Accounts
- `admin@denialguard.com` (password: `password123`, Role: `Admin`)
- `malvarez@northstar.health` (password: `password123`, Role: `Analyst`)
- `jlee@northstar.health` (password: `password123`, Role: `Biller`)
