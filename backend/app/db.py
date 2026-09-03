import os
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("denialguard.db")
logging.basicConfig(level=logging.INFO)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

_supabase_client = None
_is_live_mode = False


def init_db():
    global _supabase_client, _is_live_mode
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            from supabase import create_client
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            _is_live_mode = True
            logger.info("=" * 60)
            logger.info("[DenialGuard AI] MODE: Live Supabase Mode (Connected to Cloud PostgreSQL)")
            logger.info("=" * 60)
            return _supabase_client
        except Exception as e:
            logger.error(f"[DenialGuard AI] Supabase initialization failed: {e}")
            _supabase_client = None
            _is_live_mode = False

    _is_live_mode = False
    logger.info("=" * 60)
    logger.info("[DenialGuard AI] MODE: Offline Fallback Mode (Thread-Safe In-Memory Store)")
    logger.info("=" * 60)
    return None


def get_supabase():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    return init_db()


def is_live_supabase_mode() -> bool:
    return _is_live_mode


_in_memory_claims_log: List[Dict[str, Any]] = []
_in_memory_claim_documents: List[Dict[str, Any]] = []
_in_memory_workspace_invites: Dict[str, Dict[str, Any]] = {}
_in_memory_appeals: List[Dict[str, Any]] = []
_in_memory_notifications: List[Dict[str, Any]] = []
_in_memory_workspace_settings: Dict[str, Dict[str, Any]] = {}
_in_memory_security_settings: Dict[str, Dict[str, Any]] = {}

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
    if client and _is_live_mode:
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
            return None
        except Exception as e:
            logger.error(f"Live Supabase error fetching user '{normalized_email}': {e}")
            return None

    return _in_memory_users.get(normalized_email)


def insert_user(user_data: Dict[str, Any]) -> bool:
    normalized_email = user_data.get("work_email", "").strip().lower()
    _in_memory_users[normalized_email] = user_data

    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("users").insert(user_data).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to insert user into Supabase: {e}")
            return False

    return True


def insert_claim_log(row_data: Dict[str, Any]) -> bool:
    _in_memory_claims_log.insert(0, row_data)
    if len(_in_memory_claims_log) > 500:
        _in_memory_claims_log.pop()

    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("claims_log").upsert(row_data, on_conflict="claim_id").execute()
            return True
        except Exception as e:
            logger.error(f"Failed to upsert row into Supabase claims_log: {e}")
            return False
    return True


def upsert_claim_log(claim_data: Dict[str, Any]) -> bool:
    claim_id = claim_data.get("claim_id")
    for i, row in enumerate(_in_memory_claims_log):
        if row.get("claim_id") == claim_id:
            _in_memory_claims_log[i].update(claim_data)
            break
    else:
        _in_memory_claims_log.insert(0, claim_data)

    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("claims_log").upsert(claim_data, on_conflict="claim_id").execute()
            return True
        except Exception as e:
            logger.error(f"Supabase upsert error on claims_log: {e}")
            return False
    return True


def get_claim_by_id(claim_id: str) -> Optional[Dict[str, Any]]:
    client = get_supabase()
    if client and _is_live_mode:
        try:
            res = client.table("claims_log").select("*").eq("claim_id", claim_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
            return None
        except Exception as e:
            logger.warning(f"Failed to fetch claim {claim_id} from Supabase: {e}")

    for row in _in_memory_claims_log:
        if row.get("claim_id") == claim_id:
            return row
    return None


def update_claim_outcome(claim_id: str, actual_outcome: str, denial_flag: bool) -> Optional[Dict[str, Any]]:
    client = get_supabase()
    if client and _is_live_mode:
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


def fetch_claims_log(limit: int = 100) -> List[Dict[str, Any]]:
    client = get_supabase()
    if client and _is_live_mode:
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
    if client and _is_live_mode:
        try:
            client.table("claim_documents").insert(doc_data).execute()
        except Exception as e:
            logger.warning(f"Failed to insert claim_document into Supabase: {e}")

    return doc_data


def get_claim_documents(claim_id: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    client = get_supabase()
    if client and _is_live_mode:
        try:
            res = client.table("claim_documents").select("*").eq("claim_id", claim_id).order("uploaded_at", desc=True).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warning(f"Failed to fetch claim_documents from Supabase: {e}")

    return [d for d in _in_memory_claim_documents if d.get("claim_id") == claim_id]


def get_workspace_members(workspace_id: str) -> List[Dict[str, Any]]:
    client = get_supabase()
    if client and _is_live_mode:
        try:
            res = client.table("users").select("id, work_email, name, full_name, role, workspace_id, created_at").eq("workspace_id", workspace_id).order("created_at", desc=False).execute()
            if res.data is not None and len(res.data) > 0:
                return [
                    {
                        "id": u.get("id") or f"usr-{u.get('work_email')}",
                        "work_email": u.get("work_email") or u.get("email", ""),
                        "name": u.get("name") or u.get("full_name") or u.get("work_email", ""),
                        "role": u.get("role") or "Analyst",
                        "workspace_id": u.get("workspace_id") or workspace_id,
                        "created_at": u.get("created_at") or ""
                    }
                    for u in res.data
                ]
        except Exception as e:
            logger.warning(f"Failed to fetch workspace members from Supabase: {e}")

    members = []
    for email, u in _in_memory_users.items():
        user_ws = u.get("workspace_id")
        if user_ws == workspace_id or (workspace_id == "ws-northstar-001" and user_ws in ["ws-northstar-001", None, ""]):
            members.append({
                "id": u.get("id") or f"usr-{email}",
                "work_email": u.get("work_email") or email,
                "name": u.get("name") or u.get("full_name") or email,
                "role": u.get("role") or "Analyst",
                "workspace_id": u.get("workspace_id") or workspace_id,
                "created_at": u.get("created_at") or ""
            })
    return members


def create_workspace_invite(workspace_id: str, role: str = "Analyst", expires_in_days: int = 7) -> Dict[str, Any]:
    code = f"NORTHSTAR-{secrets.token_hex(4).upper()}"
    now_utc = datetime.now(timezone.utc)
    expires_utc = now_utc + timedelta(days=expires_in_days)

    invite_record = {
        "invite_code": code,
        "workspace_id": workspace_id or "ws-northstar-001",
        "role": role,
        "created_at": now_utc.isoformat(),
        "expires_at": expires_utc.isoformat(),
        "is_used": False
    }
    _in_memory_workspace_invites[code] = invite_record

    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("workspace_invites").insert(invite_record).execute()
        except Exception as e:
            logger.warning(f"Could not persist workspace invite to Supabase: {e}")

    return invite_record


def validate_workspace_invite(invite_code: str) -> Tuple[str, Optional[Dict[str, Any]]]:
    clean_code = (invite_code or "").strip().upper()
    if not clean_code:
        return "not_found", None

    record = None
    client = get_supabase()
    if client and _is_live_mode:
        try:
            res = client.table("workspace_invites").select("*").eq("invite_code", clean_code).limit(1).execute()
            if res.data and len(res.data) > 0:
                record = res.data[0]
        except Exception as e:
            logger.warning(f"Could not check workspace_invites in Supabase: {e}")

    if not record:
        record = _in_memory_workspace_invites.get(clean_code)

    if not record:
        return "not_found", None

    if record.get("is_used"):
        return "already_used", record

    expires_at_str = record.get("expires_at")
    if expires_at_str:
        try:
            if expires_at_str.endswith("Z"):
                expires_at_str = expires_at_str[:-1] + "+00:00"
            expires_at = datetime.fromisoformat(expires_at_str)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires_at:
                return "expired", record
        except Exception:
            pass

    return "valid", record


def mark_workspace_invite_used(invite_code: str):
    clean_code = (invite_code or "").strip().upper()
    if clean_code in _in_memory_workspace_invites:
        _in_memory_workspace_invites[clean_code]["is_used"] = True

    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("workspace_invites").update({"is_used": True}).eq("invite_code", clean_code).execute()
        except Exception as e:
            logger.warning(f"Could not mark workspace invite as used in Supabase: {e}")


def insert_appeal(appeal_data: Dict[str, Any]) -> Dict[str, Any]:
    if not appeal_data.get("id"):
        appeal_data["id"] = f"APL-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()
    appeal_data["created_at"] = now_iso
    appeal_data["updated_at"] = now_iso

    _in_memory_appeals.insert(0, appeal_data)

    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("appeals").insert(appeal_data).execute()
        except Exception as e:
            logger.warning(f"Could not insert appeal into Supabase: {e}")

    return appeal_data


def get_appeals(workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    client = get_supabase()
    if client and _is_live_mode:
        try:
            query = client.table("appeals").select("*").order("created_at", desc=True)
            if workspace_id:
                query = query.eq("workspace_id", workspace_id)
            res = query.execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warning(f"Could not fetch appeals from Supabase: {e}")

    if workspace_id:
        return [a for a in _in_memory_appeals if a.get("workspace_id") == workspace_id]
    return _in_memory_appeals


def update_appeal_status(appeal_id: str, new_status: str) -> Optional[Dict[str, Any]]:
    now_iso = datetime.now(timezone.utc).isoformat()

    client = get_supabase()
    if client and _is_live_mode:
        try:
            res = client.table("appeals").update({
                "status": new_status,
                "updated_at": now_iso
            }).eq("id", appeal_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Could not update appeal in Supabase: {e}")

    for a in _in_memory_appeals:
        if a.get("id") == appeal_id:
            a["status"] = new_status
            a["updated_at"] = now_iso
            return a

    return None


def insert_notification(notif_data: Dict[str, Any]) -> Dict[str, Any]:
    if not notif_data.get("id"):
        notif_data["id"] = f"notif-{uuid.uuid4().hex[:8]}"
    if not notif_data.get("created_at"):
        notif_data["created_at"] = datetime.now(timezone.utc).isoformat()
    if "is_read" not in notif_data:
        notif_data["is_read"] = False

    _in_memory_notifications.insert(0, notif_data)
    if len(_in_memory_notifications) > 200:
        _in_memory_notifications.pop()

    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("notifications").insert(notif_data).execute()
        except Exception as e:
            logger.warning(f"Could not insert notification into Supabase: {e}")

    return notif_data


def get_notifications(workspace_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    client = get_supabase()
    if client and _is_live_mode:
        try:
            query = client.table("notifications").select("*").order("created_at", desc=True).limit(limit)
            if workspace_id:
                query = query.eq("workspace_id", workspace_id)
            res = query.execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warning(f"Could not fetch notifications from Supabase: {e}")

    if workspace_id:
        return [n for n in _in_memory_notifications if n.get("workspace_id") == workspace_id][:limit]
    return _in_memory_notifications[:limit]


def mark_notification_read(notif_id: str) -> bool:
    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("notifications").update({"is_read": True}).eq("id", notif_id).execute()
        except Exception as e:
            logger.warning(f"Could not mark notification read in Supabase: {e}")

    for n in _in_memory_notifications:
        if n.get("id") == notif_id:
            n["is_read"] = True
            return True
    return False


def mark_all_notifications_read(workspace_id: Optional[str] = None) -> bool:
    client = get_supabase()
    if client and _is_live_mode:
        try:
            query = client.table("notifications").update({"is_read": True})
            if workspace_id:
                query = query.eq("workspace_id", workspace_id)
            query.execute()
        except Exception as e:
            logger.warning(f"Could not mark all notifications read in Supabase: {e}")

    for n in _in_memory_notifications:
        if not workspace_id or n.get("workspace_id") == workspace_id:
            n["is_read"] = True
    return True


def get_workspace_settings(workspace_id: str) -> Dict[str, Any]:
    ws_id = workspace_id or "ws-northstar-001"
    default_settings = {
        "workspace_id": ws_id,
        "auto_assign": True,
        "default_appeal_deadline_days": 30,
        "high_risk_threshold": 60.0,
        "email_notifications": True,
        "deadline_alerts": True,
        "weekly_digest": False,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    client = get_supabase()
    if client and _is_live_mode:
        try:
            res = client.table("workspace_settings").select("*").eq("workspace_id", ws_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Could not fetch workspace_settings from Supabase: {e}")

    return _in_memory_workspace_settings.get(ws_id, default_settings)


def save_workspace_settings(workspace_id: str, settings_data: Dict[str, Any]) -> Dict[str, Any]:
    ws_id = workspace_id or "ws-northstar-001"
    current = get_workspace_settings(ws_id)
    current.update({k: v for k, v in settings_data.items() if v is not None})
    current["workspace_id"] = ws_id
    current["updated_at"] = datetime.now(timezone.utc).isoformat()

    _in_memory_workspace_settings[ws_id] = current

    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("workspace_settings").upsert(current, on_conflict="workspace_id").execute()
        except Exception as e:
            logger.warning(f"Could not save workspace_settings to Supabase: {e}")

    return current


def get_security_settings(workspace_id: str) -> Dict[str, Any]:
    ws_id = workspace_id or "ws-northstar-001"
    default_sec = {
        "workspace_id": ws_id,
        "session_timeout_minutes": 60,
        "audit_log_retention_days": 2555,
        "enforce_ip_allowlist": False,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    client = get_supabase()
    if client and _is_live_mode:
        try:
            res = client.table("workspace_security_settings").select("*").eq("workspace_id", ws_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Could not fetch workspace_security_settings from Supabase: {e}")

    return _in_memory_security_settings.get(ws_id, default_sec)


def save_security_settings(workspace_id: str, settings_data: Dict[str, Any]) -> Dict[str, Any]:
    ws_id = workspace_id or "ws-northstar-001"
    current = get_security_settings(ws_id)
    current.update({k: v for k, v in settings_data.items() if v is not None})
    current["workspace_id"] = ws_id
    current["updated_at"] = datetime.now(timezone.utc).isoformat()

    _in_memory_security_settings[ws_id] = current

    client = get_supabase()
    if client and _is_live_mode:
        try:
            client.table("workspace_security_settings").upsert(current, on_conflict="workspace_id").execute()
        except Exception as e:
            logger.warning(f"Could not save workspace_security_settings to Supabase: {e}")

    return current


init_db()
