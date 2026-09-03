"""
Supabase Database Integration for DenialGuard AI
Provides resilient client operations for claims_log table.
"""

import os
import logging
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
        from supabase import create_client, Client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Successfully initialized Supabase client.")
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None

# Local in-memory fallback store for demo reliability when DB is disconnected
_in_memory_claims_log: List[Dict[str, Any]] = []

def insert_claim_log(row_data: Dict[str, Any]) -> bool:
    """
    Inserts a full claim log row into Supabase.
    Non-blocking: Falls back to memory cache if DB is unreachable.
    """
    # Always maintain latest local memory cache for resilience
    _in_memory_claims_log.insert(0, row_data)
    if len(_in_memory_claims_log) > 200:
        _in_memory_claims_log.pop()

    client = get_supabase()
    if not client:
        logger.warning("Supabase client unavailable. Saved to local in-memory store.")
        return False

    try:
        response = client.table("claims_log").insert(row_data).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to insert row into Supabase claims_log: {e}")
        return False

def update_claim_outcome(claim_id: str, actual_outcome: str, denial_flag: bool) -> Optional[Dict[str, Any]]:
    """
    Updates actual_outcome and denial_flag for a given claim_id.
    """
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
    """
    Fetches recent claim logs ordered by created_at desc.
    """
    client = get_supabase()
    if client:
        try:
            response = client.table("claims_log").select("*").order("created_at", desc=True).limit(limit).execute()
            if response.data is not None:
                return response.data
        except Exception as e:
            logger.error(f"Failed to fetch claims log from Supabase: {e}")

    # Fallback to local memory cache
    return _in_memory_claims_log[:limit]


# ----------------------------------------------------------------------
# User Store (Supabase + Resilient Local Fallback)
# ----------------------------------------------------------------------

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
        "created_at": "2026-08-01T00:00:00Z"
    },
    "malvarez@northstar.health": {
        "id": "usr-002",
        "work_email": "malvarez@northstar.health",
        "password_hash": _DEFAULT_HASH,
        "name": "Maya Alvarez",
        "role": "Analyst",
        "created_at": "2026-08-01T00:00:00Z"
    },
    "jlee@northstar.health": {
        "id": "usr-003",
        "work_email": "jlee@northstar.health",
        "password_hash": _DEFAULT_HASH,
        "name": "Jordan Lee",
        "role": "Biller",
        "created_at": "2026-08-01T00:00:00Z"
    },
    "biller@denialguard.com": {
        "id": "usr-004",
        "work_email": "biller@denialguard.com",
        "password_hash": _DEFAULT_HASH,
        "name": "Bob Biller",
        "role": "Biller",
        "created_at": "2026-08-01T00:00:00Z"
    }
}


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Fetches user record from Supabase 'users' table by work_email.
    Falls back to local resilient user store if Supabase is offline or unconfigured.
    """
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

    # Fallback to local memory dictionary
    return _in_memory_users.get(normalized_email)


def insert_user(user_data: Dict[str, Any]) -> bool:
    """
    Inserts a new user record into Supabase (and local store).
    """
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
