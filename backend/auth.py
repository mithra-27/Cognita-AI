"""
Authentication utilities for Cognita AI.

Handles:
- Password hashing and verification
- JWT token creation
- JWT token verification
- Resolving the currently authenticated user
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings, ensure_jwt_secret


# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------

# Make sure JWT_SECRET is available before authentication is used.
ensure_jwt_secret()

# HTTP Bearer authentication:
# Authorization: Bearer <token>
_bearer = HTTPBearer(auto_error=True)


# -------------------------------------------------------------------
# Password handling
# -------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a user's password securely using bcrypt."""
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except Exception:
        # Never expose password/hash errors to the client.
        return False


# -------------------------------------------------------------------
# JWT token handling
# -------------------------------------------------------------------

def create_token(user_id: str, email: str) -> str:
    """Create a JWT token for an authenticated user."""

    now = datetime.now(timezone.utc)

    payload = {
        "user_id": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(
            hours=settings.JWT_EXPIRE_HOURS
        ),
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""

    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please log in again.",
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )


# -------------------------------------------------------------------
# Current authenticated user
# -------------------------------------------------------------------

def get_current_user(
    creds: Annotated[
        HTTPAuthorizationCredentials,
        Depends(_bearer),
    ],
) -> dict:
    """
    FastAPI dependency that resolves the authenticated
    user from MongoDB.
    """

    from database import collections

    # ---------------------------------------------------------------
    # 1. Decode JWT
    # ---------------------------------------------------------------

    payload = decode_token(creds.credentials)

    user_id = payload.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    # ---------------------------------------------------------------
    # 2. Validate MongoDB ObjectId
    # ---------------------------------------------------------------

    try:
        object_id = ObjectId(user_id)

    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    # ---------------------------------------------------------------
    # 3. Get database collections
    # ---------------------------------------------------------------

    cols = collections()

    if not cols:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable.",
        )

    # ---------------------------------------------------------------
    # 4. Find user
    # ---------------------------------------------------------------

    user = cols["users"].find_one(
        {"_id": object_id}
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
        )

    # ---------------------------------------------------------------
    # 5. Convert ObjectId to string
    # ---------------------------------------------------------------

    user["_id"] = str(user["_id"])

    return user