"""
Security utilities for DenialGuard AI.
Handles JWT creation, decoding, password hashing, and token verification.
"""

import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import jwt

try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    HAS_PASSLIB = True
except ImportError:
    HAS_PASSLIB = False

load_dotenv()

logger = logging.getLogger("denialguard.security")

# Secret key resolution
_ENV_SECRET = os.getenv("SECRET_KEY", "").strip()
if not _ENV_SECRET:
    SECRET_KEY = secrets.token_urlsafe(32)
    logger.warning(
        "WARNING: SECRET_KEY not configured in environment. "
        "Generated random ephemeral key for demo session."
    )
else:
    SECRET_KEY = _ENV_SECRET

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against a bcrypt hashed password.
    """
    if not plain_password or not hashed_password:
        return False

    # Try passlib first if available
    if HAS_PASSLIB:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            pass

    # Direct bcrypt verification
    if HAS_BCRYPT:
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8")
            )
        except Exception as e:
            logger.error(f"bcrypt check error: {e}")
            return False

    # Basic fallback check
    return plain_password == hashed_password


def get_password_hash(password: str) -> str:
    """
    Generates a bcrypt hash for a plaintext password.
    """
    if HAS_PASSLIB:
        try:
            return pwd_context.hash(password)
        except Exception:
            pass

    if HAS_BCRYPT:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    # Fallback if no crypto lib available
    return password


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a signed JWT with expiration.
    Claims typically include: 'sub' (work_email), 'name', 'role'.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT token using SECRET_KEY and ALGORITHM.
    Raises jwt.PyJWTError on failure.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload
