"""
Authentication routes for Cognita AI.

Routes:
    POST /api/auth/register
    POST /api/auth/login
    GET  /api/auth/me

    POST /api/auth/forgot-password
    POST /api/auth/verify-reset-otp
    POST /api/auth/reset-password
"""

from datetime import datetime, timezone, timedelta
from typing import Annotated

import hashlib
import os
import secrets
import smtplib

from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from auth import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
)

from database import collections
from models import RegisterRequest, LoginRequest


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)


# =========================================================
# RESPONSE MODELS
# =========================================================

class TokenResponse(BaseModel):
    token: str
    user: dict


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    password: str


# =========================================================
# HELPERS
# =========================================================

def _success(data) -> dict:
    return {
        "success": True,
        "data": data,
    }


def _hash_value(value: str) -> str:
    """
    SHA-256 hash for temporary OTP/reset values.
    """
    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


def _generate_otp() -> str:
    """
    Generate a cryptographically secure
    six-digit OTP.
    """
    return f"{secrets.randbelow(1_000_000):06d}"


def _send_otp_email(
    email: str,
    otp: str,
) -> None:
    """
    Send password-reset OTP through SMTP.

    Required environment variables:

        SMTP_HOST
        SMTP_PORT
        SMTP_USERNAME
        SMTP_PASSWORD
        SMTP_FROM_EMAIL
    """

    smtp_host = os.getenv(
        "SMTP_HOST",
        "",
    ).strip()

    smtp_port = int(
        os.getenv(
            "SMTP_PORT",
            "587",
        )
    )

    smtp_username = os.getenv(
        "SMTP_USERNAME",
        "",
    ).strip()

    smtp_password = os.getenv(
        "SMTP_PASSWORD",
        "",
    ).strip()

    smtp_from_email = os.getenv(
        "SMTP_FROM_EMAIL",
        smtp_username,
    ).strip()


    # -----------------------------------------------------
    # SMTP configuration check
    # -----------------------------------------------------

    if not all(
        [
            smtp_host,
            smtp_username,
            smtp_password,
            smtp_from_email,
        ]
    ):
        raise RuntimeError(
            "SMTP email configuration is missing."
        )


    # -----------------------------------------------------
    # Create email
    # -----------------------------------------------------

    message = EmailMessage()

    message["Subject"] = (
        "Your Cognita AI Password Reset OTP"
    )

    message["From"] = smtp_from_email
    message["To"] = email

    message.set_content(
        f"""
Hello,

We received a request to reset your Cognita AI password.

Your password reset OTP is:

{otp}

This OTP will expire in 5 minutes.

If you did not request a password reset,
you can safely ignore this email.

Regards,
Cognita AI
"""
    )


    # -----------------------------------------------------
    # Send email
    # -----------------------------------------------------

    with smtplib.SMTP(
        smtp_host,
        smtp_port,
        timeout=20,
    ) as server:

        server.starttls()

        server.login(
            smtp_username,
            smtp_password,
        )

        server.send_message(
            message
        )


# =========================================================
# REGISTER
# =========================================================

@router.post("/register")
def register(
    req: RegisterRequest,
):
    """
    Create a new Cognita AI account.
    """

    cols = collections()

    if not cols:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )

    email = (
        req.email
        .strip()
        .lower()
    )

    existing = cols["users"].find_one(
        {
            "email": email,
        }
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                "An account with this email "
                "already exists."
            ),
        )

    doc = {
        "name": req.name.strip(),

        "email": email,

        "password_hash": hash_password(
            req.password
        ),

        "created_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }

    result = cols["users"].insert_one(
        doc
    )

    user_id = str(
        result.inserted_id
    )

    token = create_token(
        user_id,
        email,
    )

    return _success(
        {
            "token": token,

            "user": {
                "id": user_id,
                "name": doc["name"],
                "email": email,
            },
        }
    )


# =========================================================
# LOGIN
# =========================================================

@router.post("/login")
def login(
    req: LoginRequest,
):
    """
    Authenticate an existing user.
    """

    cols = collections()

    if not cols:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )

    email = (
        req.email
        .strip()
        .lower()
    )

    user = cols["users"].find_one(
        {
            "email": email,
        }
    )

    if (
        not user
        or not verify_password(
            req.password,
            user["password_hash"],
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    user_id = str(
        user["_id"]
    )

    token = create_token(
        user_id,
        user["email"],
    )

    return _success(
        {
            "token": token,

            "user": {
                "id": user_id,
                "name": user["name"],
                "email": user["email"],
            },
        }
    )


# =========================================================
# CURRENT USER
# =========================================================

@router.get("/me")
def me(
    current_user: Annotated[
        dict,
        Depends(get_current_user),
    ],
):
    """
    Return currently authenticated user.
    """

    return _success(
        {
            "id": current_user["_id"],
            "name": current_user["name"],
            "email": current_user["email"],
        }
    )


# =========================================================
# FORGOT PASSWORD — SEND OTP
# =========================================================

@router.post("/forgot-password")
def forgot_password(
    req: ForgotPasswordRequest,
):
    """
    Generate and send a six-digit OTP.

    The response is intentionally generic so that
    users cannot discover which email addresses
    are registered.
    """

    cols = collections()

    if not cols:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )

    email = (
        str(req.email)
        .strip()
        .lower()
    )


    # -----------------------------------------------------
    # Find user
    # -----------------------------------------------------

    user = cols["users"].find_one(
        {
            "email": email,
        }
    )


    # -----------------------------------------------------
    # Generic response
    # -----------------------------------------------------

    generic_message = (
        "If an account exists for this email, "
        "a verification OTP has been sent."
    )


    # -----------------------------------------------------
    # Do not reveal whether account exists
    # -----------------------------------------------------

    if not user:
        return _success(
            {
                "message": generic_message,
            }
        )


    # -----------------------------------------------------
    # Generate OTP
    # -----------------------------------------------------

    otp = _generate_otp()

    otp_hash = _hash_value(
        otp
    )

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=5)
    )


    # -----------------------------------------------------
    # Store hashed OTP
    # -----------------------------------------------------

    cols["users"].update_one(
        {
            "_id": user["_id"],
        },
        {
            "$set": {
                "password_reset_otp_hash":
                    otp_hash,

                "password_reset_otp_expires_at":
                    expires_at,

                "password_reset_otp_attempts":
                    0,
            },

            "$unset": {
                "password_reset_token_hash":
                    "",

                "password_reset_expires_at":
                    "",
            },
        },
    )


    # -----------------------------------------------------
    # Send OTP
    # -----------------------------------------------------

    try:

        _send_otp_email(
            email=email,
            otp=otp,
        )

    except Exception as exc:

        # Remove OTP if email sending fails
        cols["users"].update_one(
            {
                "_id": user["_id"],
            },
            {
                "$unset": {
                    "password_reset_otp_hash":
                        "",

                    "password_reset_otp_expires_at":
                        "",

                    "password_reset_otp_attempts":
                        "",
                },
            },
        )

        print(
            "Password reset OTP email error:",
            exc,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "We could not send the verification "
                "OTP. Please try again later."
            ),
        )


    return _success(
        {
            "message": generic_message,
        }
    )


# =========================================================
# VERIFY RESET OTP
# =========================================================

@router.post("/verify-reset-otp")
def verify_reset_otp(
    req: VerifyOTPRequest,
):
    """
    Verify the six-digit password-reset OTP.

    If successful, a temporary reset token is
    returned to the frontend.

    The reset token can only be used to create
    the new password.
    """

    cols = collections()

    if not cols:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )

    email = (
        str(req.email)
        .strip()
        .lower()
    )

    otp = req.otp.strip()


    # -----------------------------------------------------
    # Validate OTP format
    # -----------------------------------------------------

    if (
        len(otp) != 6
        or not otp.isdigit()
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please enter a valid 6-digit OTP."
            ),
        )


    # -----------------------------------------------------
    # Find user
    # -----------------------------------------------------

    user = cols["users"].find_one(
        {
            "email": email,
        }
    )

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OTP.",
        )


    # -----------------------------------------------------
    # Get stored OTP information
    # -----------------------------------------------------

    otp_hash = user.get(
        "password_reset_otp_hash"
    )

    expires_at = user.get(
        "password_reset_otp_expires_at"
    )

    attempts = user.get(
        "password_reset_otp_attempts",
        0,
    )


    if not otp_hash or not expires_at:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OTP.",
        )


    # -----------------------------------------------------
    # Maximum OTP attempts
    # -----------------------------------------------------

    if attempts >= 5:

        cols["users"].update_one(
            {
                "_id": user["_id"],
            },
            {
                "$unset": {
                    "password_reset_otp_hash":
                        "",

                    "password_reset_otp_expires_at":
                        "",

                    "password_reset_otp_attempts":
                        "",
                },
            },
        )

        raise HTTPException(
            status_code=429,
            detail=(
                "Too many incorrect OTP attempts. "
                "Please request a new OTP."
            ),
        )


    # -----------------------------------------------------
    # Check OTP expiration
    # -----------------------------------------------------

    if isinstance(
        expires_at,
        str,
    ):
        try:
            expires_at = datetime.fromisoformat(
                expires_at
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired OTP.",
            )


    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )


    if (
        datetime.now(timezone.utc)
        > expires_at
    ):

        cols["users"].update_one(
            {
                "_id": user["_id"],
            },
            {
                "$unset": {
                    "password_reset_otp_hash":
                        "",

                    "password_reset_otp_expires_at":
                        "",

                    "password_reset_otp_attempts":
                        "",
                },
            },
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "This OTP has expired. "
                "Please request a new OTP."
            ),
        )


    # -----------------------------------------------------
    # Compare OTP securely
    # -----------------------------------------------------

    supplied_hash = _hash_value(
        otp
    )

    if not secrets.compare_digest(
        supplied_hash,
        otp_hash,
    ):

        cols["users"].update_one(
            {
                "_id": user["_id"],
            },
            {
                "$inc": {
                    "password_reset_otp_attempts":
                        1,
                },
            },
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Incorrect OTP. Please try again."
            ),
        )


    # -----------------------------------------------------
    # OTP verified
    # -----------------------------------------------------

    reset_token = secrets.token_urlsafe(
        48
    )

    reset_token_hash = _hash_value(
        reset_token
    )

    reset_expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=10)
    )


    # -----------------------------------------------------
    # Store temporary reset session
    # -----------------------------------------------------

    cols["users"].update_one(
        {
            "_id": user["_id"],
        },
        {
            "$set": {
                "password_reset_token_hash":
                    reset_token_hash,

                "password_reset_expires_at":
                    reset_expires_at,
            },

            "$unset": {
                "password_reset_otp_hash":
                    "",

                "password_reset_otp_expires_at":
                    "",

                "password_reset_otp_attempts":
                    "",
            },
        },
    )


    return _success(
        {
            "message":
                "OTP verified successfully.",

            "reset_token":
                reset_token,
        }
    )


# =========================================================
# RESET PASSWORD
# =========================================================

@router.post("/reset-password")
def reset_password(
    req: ResetPasswordRequest,
):
    """
    Create a new password after successful
    OTP verification.
    """

    cols = collections()

    if not cols:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )


    # -----------------------------------------------------
    # Validate password
    # -----------------------------------------------------

    if len(req.password) < 6:
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must contain at least "
                "6 characters."
            ),
        )


    # -----------------------------------------------------
    # Validate reset token
    # -----------------------------------------------------

    reset_token = req.reset_token.strip()

    if not reset_token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or missing reset token.",
        )


    reset_token_hash = _hash_value(
        reset_token
    )


    # -----------------------------------------------------
    # Find user using hashed reset token
    # -----------------------------------------------------

    user = cols["users"].find_one(
        {
            "password_reset_token_hash":
                reset_token_hash,
        }
    )

    if not user:
        raise HTTPException(
            status_code=400,
            detail=(
                "This password reset session "
                "is invalid or has expired."
            ),
        )


    # -----------------------------------------------------
    # Check reset-session expiration
    # -----------------------------------------------------

    expires_at = user.get(
        "password_reset_expires_at"
    )

    if not expires_at:
        raise HTTPException(
            status_code=400,
            detail=(
                "This password reset session "
                "is invalid or has expired."
            ),
        )


    if isinstance(
        expires_at,
        str,
    ):
        try:
            expires_at = datetime.fromisoformat(
                expires_at
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=(
                    "This password reset session "
                    "is invalid or has expired."
                ),
            )


    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )


    if (
        datetime.now(timezone.utc)
        > expires_at
    ):

        cols["users"].update_one(
            {
                "_id": user["_id"],
            },
            {
                "$unset": {
                    "password_reset_token_hash":
                        "",

                    "password_reset_expires_at":
                        "",
                },
            },
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "This password reset session "
                "has expired. Please start again."
            ),
        )


    # -----------------------------------------------------
    # Hash new password
    # -----------------------------------------------------

    new_password_hash = hash_password(
        req.password
    )


    # -----------------------------------------------------
    # Update password
    # -----------------------------------------------------

    cols["users"].update_one(
        {
            "_id": user["_id"],
        },
        {
            "$set": {
                "password_hash":
                    new_password_hash,

                "password_updated_at":
                    datetime.now(
                        timezone.utc
                    ).isoformat(),
            },

            "$unset": {
                "password_reset_token_hash":
                    "",

                "password_reset_expires_at":
                    "",
            },
        },
    )


    # -----------------------------------------------------
    # Success
    # -----------------------------------------------------

    return _success(
        {
            "message":
                "Password reset successfully. "
                "You can now log in with your new password."
        }
    )