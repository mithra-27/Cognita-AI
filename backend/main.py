"""
Cognita AI — FastAPI application entry point.

Run:
    uvicorn main:app --reload

Docs:
    http://localhost:8000/docs
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings, ensure_jwt_secret
from database import connect, disconnect, is_connected


# =========================================================
# LOGGING
# =========================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(name)s: %(message)s",
)

logger = logging.getLogger("cognita")


# =========================================================
# SECURITY CONFIGURATION
# =========================================================

# Fail fast if JWT_SECRET is missing.
ensure_jwt_secret()


# =========================================================
# APPLICATION LIFESPAN
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup:
        - Connect to MongoDB
        - Initialize read-only RAG resources

    Shutdown:
        - Close MongoDB connection
    """

    logger.info("Starting Cognita AI backend…")

    # -----------------------------------------------------
    # MongoDB
    # -----------------------------------------------------

    try:
        connect()

    except Exception as exc:  # noqa: BLE001
        logger.error(
            "MongoDB connection failed on startup: %s",
            exc,
        )

    # -----------------------------------------------------
    # RAG
    # -----------------------------------------------------

    try:
        from services.rag import initialize_rag

        initialize_rag()

    except Exception as exc:  # noqa: BLE001
        logger.info(
            "RAG initialization skipped: %s",
            exc,
        )

    # -----------------------------------------------------
    # Application running
    # -----------------------------------------------------

    yield

    # -----------------------------------------------------
    # Shutdown
    # -----------------------------------------------------

    logger.info(
        "Shutting down Cognita AI backend…"
    )

    disconnect()


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="Cognita AI",

    description=(
        "AI-powered cognitive assessment and adaptive "
        "learning system inspired by six Mīmāṃsā reasoning "
        "principles."
    ),

    version="1.0.0",

    lifespan=lifespan,
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        settings.FRONTEND_URL
    ],

    allow_credentials=True,

    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],

    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Client-Info",
        "Apikey",
    ],
)


# =========================================================
# ROUTERS
# =========================================================

from routes.auth import router as auth_router
from routes.assessment import router as assessment_router
from routes.training import router as training_router
from routes.progress import router as progress_router

# ---------------------------------------------------------
# AI TUTOR ROUTER
# ---------------------------------------------------------

from routes.tutor import router as tutor_router

# ---------------------------------------------------------
# KNOWLEDGE BASE ROUTER
# ---------------------------------------------------------

from routes.knowledge import router as knowledge_router


# =========================================================
# REGISTER ROUTERS
# =========================================================

app.include_router(
    auth_router
)

app.include_router(
    assessment_router
)

app.include_router(
    training_router
)

app.include_router(
    progress_router
)

app.include_router(
    tutor_router
)

# ---------------------------------------------------------
# KNOWLEDGE BASE
# ---------------------------------------------------------

app.include_router(
    knowledge_router
)


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health():
    return {
        "success": True,

        "data": {
            "api": "ok",

            "mongodb": (
                "connected"
                if is_connected()
                else "disconnected"
            ),
        },
    }


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "success": True,

        "data": {
            "name": "Cognita AI",

            "tagline": (
                "Understand Your Thinking. "
                "Improve Your Reasoning."
            ),

            "docs": "/docs",
        },
    }