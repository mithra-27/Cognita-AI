"""MongoDB connection management — one application-level MongoClient."""

import logging
from pymongo import MongoClient
from config import settings

logger = logging.getLogger("cognita.database")

_client: MongoClient | None = None
_db = None


def connect() -> None:
    """Initialize the shared MongoClient and database handle."""
    global _client, _db
    if _client is not None:
        return
    if not settings.is_mongodb_configured:
        logger.warning("MONGODB_URI not configured — database unavailable.")
        return
    try:
        _client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
        _client.admin.command("ping")
        _db = _client[settings.DB_NAME]
        _ensure_indexes()
        logger.info("Connected to MongoDB Atlas (database: %s).", settings.DB_NAME)
    except Exception as exc:  # noqa: BLE001
        logger.error("MongoDB connection failed: %s", exc)
        _client = None
        _db = None
        raise


def disconnect() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None


def get_db():
    """Return the database handle (may be None if not connected)."""
    if _db is None:
        connect()
    return _db


def is_connected() -> bool:
    if _db is None:
        return False
    try:
        _client.admin.command("ping")
        return True
    except Exception:  # noqa: BLE001
        return False


def _ensure_indexes() -> None:
    """Create unique email index on users collection."""
    if _db is None:
        return
    _db.users.create_index("email", unique=True)


def collections():
    """Return the four application collections as a dict."""
    db = get_db()
    if db is None:
        return {}
    return {
        "users": db.users,
        "assessments": db.assessments,
        "cognitive_profiles": db.cognitive_profiles,
        "training_progress": db.training_progress,
    }
