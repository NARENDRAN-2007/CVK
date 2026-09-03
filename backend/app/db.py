import os
import uuid
import secrets
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("denialguard.db")
logging.basicConfig(level=logging.INFO)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

_supabase_client = None

def get_supabase():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.warning(
            "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in environment. "
            "DB operations will run in mock/fallback mode."
        )
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Successfully initialized Supabase client.")
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None

_in_memory_claims_log: List[Dict[str, Any]] = []
_in_memory_claim_documents: List[Dict[str, Any]] = []
_in_memory_workspace_invites: Dict[str, Dict[str, Any]] = {
    "NORTHSTAR-RCM-2026": {
        "invite_code": "NORTHSTAR-RCM-2026",
        "workspace_id": "ws-northstar-001",
        "role": "Analyst",
        "created_at": "2026-08-01T00:00:00Z"
    },
    "UHC-DENIAL-99": {
        "invite_code": "UHC-DENIAL-99",
        "workspace_id": "ws-northstar-001",
        "role": "Biller",
        "created_at": "2026-08-01T00:00:00Z"
    }
}

def clean_demo_data_if_connected():
    client = get_supabase()
    if client:
        try:
            client.table("claims_log").delete().neq("claim_id", "__none__").execute()
            client.table("claim_documents").delete().neq("id", "__none__").execute()
            logger.info("Cleared existing claims_log and claim_documents in Supabase.")
        except Exception as e:
            logger.warning(f"Could not clear demo rows in Supabase: {e}")

def insert_claim_log(row_data: Dict[str, Any]) -> bool:
    _in_memory_claims_log.insert(0, row_data)
    if len(_in_memory_claims_log) > 200:
        _in_memory_claims_log.pop()

    client = get_supabase()
    if not client:
        return False

    try:
        client.table("claims_log").upsert(row_data, on_conflict="claim_id").execute()
        return True
    except Exception as e:
        logger.error(f"Failed to upsert row into Supabase claims_log: {e}")
        return False

def upsert_claim_log(claim_data: Dict[str, Any]) -> bool:
    claim_id = claim_data.get("claim_id")
    for i, row in enumerate(_in_memory_claims_log):
        if row.get("claim_id") == claim_id:
            _in_memory_claims_log[i].update(claim_data)
            break
    else:
        _in_memory_claims_log.insert(0, claim_data)

    client = get_supabase()
    if client:
        try:
            client.table("claims_log").upsert(claim_data, on_conflict="claim_id").execute()
            return True
        except Exception as e:
            logger.error(f"Supabase upsert error on claims_log: {e}")
            return False
    return True

def get_claim_by_id(claim_id: str) -> Optional[Dict[str, Any]]:
    client = get_supabase()
    if client:
        try:
            res = client.table("claims_log").select("*").eq("claim_id", claim_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Failed to fetch claim {claim_id} from Supabase: {e}")

    for row in _in_memory_claims_log:
        if row.get("claim_id") == claim_id:
            return row
    return None

def update_claim_outcome(claim_id: str, actual_outcome: str, denial_flag: bool) -> Optional[Dict[str, Any]]:
    client = get_supabase()
    if client:
        try:
            response = client.table("claims_log").update({
                "actual_outcome": actual_outcome,
                "denial_flag": denial_flag
            }).eq("claim_id", claim_id).execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Supabase update error for claim {claim_id}: {e}")
            return None

    for row in _in_memory_claims_log:
        if row.get("claim_id") == claim_id:
            row["actual_outcome"] = actual_outcome
            row["denial_flag"] = denial_flag
            return row

    return None

def fetch_claims_log(limit: int = 50) -> List[Dict[str, Any]]:
    client = get_supabase()
    if client:
        try:
            response = client.table("claims_log").select("*").order("created_at", desc=True).limit(limit).execute()
            if response.data is not None:
                return response.data
        except Exception as e:
            logger.error(f"Failed to fetch claims log from Supabase: {e}")

    return _in_memory_claims_log[:limit]

def insert_claim_document(doc_data: Dict[str, Any]) -> Dict[str, Any]:
    if not doc_data.get("id"):
        doc_data["id"] = f"doc-{uuid.uuid4().hex[:8]}"
    if not doc_data.get("uploaded_at"):
        doc_data["uploaded_at"] = datetime.now(timezone.utc).isoformat()

    _in_memory_claim_documents.insert(0, doc_data)

    client = get_supabase()
    if client:
        try:
            client.table("claim_documents").insert(doc_data).execute()
        except Exception as e:
            logger.warning(f"Failed to insert claim_document into Supabase: {e}")

    return doc_data

def get_claim_documents(claim_id: str) -> List[Dict[str, Any]]:
    client = get_supabase()
    if client:
        try:
            res = client.table("claim_documents").select("*").eq("claim_id", claim_id).order("uploaded_at", desc=True).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warning(f"Failed to fetch claim_documents from Supabase: {e}")

    return [d for d in _in_memory_claim_documents if d.get("claim_id") == claim_id]

def create_workspace_invite(workspace_id: str, role: str = "Analyst") -> Dict[str, Any]:
    code = f"NORTHSTAR-{secrets.token_hex(4).upper()}"
    invite_record = {
        "invite_code": code,
        "workspace_id": workspace_id or "ws-northstar-001",
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    _in_memory_workspace_invites[code] = invite_record

    client = get_supabase()
    if client:
        try:
            client.table("workspace_invites").insert(invite_record).execute()
        except Exception as e:
            logger.warning(f"Could not persist workspace invite to Supabase: {e}")

    return invite_record

def get_workspace_invite(invite_code: str) -> Optional[Dict[str, Any]]:
    clean_code = (invite_code or "").strip().upper()
    if not clean_code:
        return None

    client = get_supabase()
    if client:
        try:
            res = client.table("workspace_invites").select("*").eq("invite_code", clean_code).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Could not check workspace_invites in Supabase: {e}")

    return _in_memory_workspace_invites.get(clean_code)

try:
    from .core.security import get_password_hash
    _DEFAULT_HASH = get_password_hash("password123")
except Exception:
    _DEFAULT_HASH = "$2b$12$Fke5UpZupsggVv2va.A7p.q0UUbDElD.450bg4PfSRWpfUuJV34qa"

_in_memory_users: Dict[str, Dict[str, Any]] = {
    "admin@denialguard.com": {
        "id": "usr-001",
        "work_email": "admin@denialguard.com",
        "password_hash": _DEFAULT_HASH,
        "name": "Alice Admin",
        "role": "Admin",
        "workspace_id": "ws-northstar-001",
        "created_at": "2026-08-01T00:00:00Z"
    },
    "malvarez@northstar.health": {
        "id": "usr-002",
        "work_email": "malvarez@northstar.health",
        "password_hash": _DEFAULT_HASH,
        "name": "Maya Alvarez",
        "role": "Analyst",
        "workspace_id": "ws-northstar-001",
        "created_at": "2026-08-01T00:00:00Z"
    },
    "jlee@northstar.health": {
        "id": "usr-003",
        "work_email": "jlee@northstar.health",
        "password_hash": _DEFAULT_HASH,
        "name": "Jordan Lee",
        "role": "Biller",
        "workspace_id": "ws-northstar-001",
        "created_at": "2026-08-01T00:00:00Z"
    },
    "biller@denialguard.com": {
        "id": "usr-004",
        "work_email": "biller@denialguard.com",
        "password_hash": _DEFAULT_HASH,
        "name": "Bob Biller",
        "role": "Biller",
        "workspace_id": "ws-northstar-001",
        "created_at": "2026-08-01T00:00:00Z"
    }
}

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    normalized_email = (email or "").strip().lower()
    if not normalized_email:
        return None

    client = get_supabase()
    if client:
        try:
            response = (
                client.table("users")
                .select("*")
                .ilike("work_email", normalized_email)
                .limit(1)
                .execute()
            )
            if response.data and len(response.data) > 0:
                return response.data[0]
        except Exception as e:
            logger.warning(
                f"Failed to fetch user '{normalized_email}' from Supabase: {e}. "
                "Checking local store fallback."
            )

    return _in_memory_users.get(normalized_email)

def insert_user(user_data: Dict[str, Any]) -> bool:
    normalized_email = user_data.get("work_email", "").strip().lower()
    _in_memory_users[normalized_email] = user_data

    client = get_supabase()
    if client:
        try:
            client.table("users").insert(user_data).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to insert user into Supabase: {e}")
            return False

    return True
