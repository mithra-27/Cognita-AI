"""
Configuration — loads settings from environment variables.
"""

import os
from dotenv import load_dotenv


# Load variables from backend/.env
load_dotenv()


class Settings:

    # ============================================================
    # DATABASE
    # ============================================================

    MONGODB_URI: str = os.getenv(
        "MONGODB_URI",
        ""
    )

    DB_NAME: str = "cognita_ai"


    # ============================================================
    # GEMINI AI
    # ============================================================

    GEMINI_API_KEY: str = os.getenv(
        "GEMINI_API_KEY",
        ""
    )


    # ============================================================
    # AUTHENTICATION
    # ============================================================

    JWT_SECRET: str = os.getenv(
        "JWT_SECRET",
        ""
    )

    JWT_ALGORITHM: str = "HS256"

    JWT_EXPIRE_HOURS: int = 24


    # ============================================================
    # FRONTEND
    # ============================================================

    FRONTEND_URL: str = os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173"
    )


    # ============================================================
    # SMTP / PASSWORD RESET
    # ============================================================

    SMTP_HOST: str = os.getenv(
        "SMTP_HOST",
        ""
    )

    SMTP_PORT: int = int(
        os.getenv(
            "SMTP_PORT",
            "587"
        )
    )

    SMTP_USERNAME: str = os.getenv(
        "SMTP_USERNAME",
        ""
    )

    SMTP_PASSWORD: str = os.getenv(
        "SMTP_PASSWORD",
        ""
    )

    SMTP_FROM_EMAIL: str = os.getenv(
        "SMTP_FROM_EMAIL",
        ""
    )


    # ============================================================
    # CHROMADB
    # ============================================================

    CHROMA_PATH: str = "./chroma_db"


    # ============================================================
    # CONFIGURATION CHECKS
    # ============================================================

    @property
    def is_gemini_configured(self) -> bool:
        return bool(
            self.GEMINI_API_KEY
            and self.GEMINI_API_KEY.strip()
        )


    @property
    def is_mongodb_configured(self) -> bool:
        return bool(
            self.MONGODB_URI
            and self.MONGODB_URI.strip()
        )


    @property
    def is_smtp_configured(self) -> bool:
        return bool(
            self.SMTP_HOST
            and self.SMTP_USERNAME
            and self.SMTP_PASSWORD
            and self.SMTP_FROM_EMAIL
        )


# Global settings instance
settings = Settings()


def ensure_jwt_secret() -> None:
    """
    Fail clearly if JWT_SECRET is missing.
    """

    if not settings.JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET is not configured. "
            "Add JWT_SECRET to the backend .env file."
        )