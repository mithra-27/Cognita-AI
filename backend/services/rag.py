"""
RAG service for Cognita AI.

Responsibilities:
- Load the Sentence Transformer embedding model.
- Connect to the existing persistent ChromaDB.
- Retrieve semantically relevant context.
- Retrieve unique assessment questions.
- Retrieve individual questions by ID.
- Provide RAG status information.

IMPORTANT:
This module NEVER ingests or modifies ChromaDB during FastAPI startup.

Dataset ingestion is handled explicitly by ingest.py.
"""

from __future__ import annotations

import json
import random
import re
import unicodedata
from typing import Any

import chromadb
from sentence_transformers import SentenceTransformer

from config import settings


# ============================================================
# GLOBAL OBJECTS
# ============================================================

_embedding_model: SentenceTransformer | None = None
_chroma_client = None
_collection = None


# ============================================================
# SKILL NORMALIZATION
# ============================================================

def normalize_skill(skill: str | None) -> str:
    """
    Normalize Mīmāṃsā skill names.

    Examples:
        Upamāna / Upamana / upamana -> upamana
        Pratyakṣa / Pratyaksha -> pratyaksha
        Śabda / Sabda -> shabda
        Anumāna / Anumana -> anumana
        Arthāpatti / Arthapatti -> arthapatti
        Anupalabdhi -> anupalabdhi
    """

    if not skill:
        return ""

    value = str(skill).strip().lower()

    # Normalize Unicode accents/diacritics.
    value = unicodedata.normalize("NFKD", value)

    value = "".join(
        char
        for char in value
        if not unicodedata.combining(char)
    )

    # Normalize special characters.
    value = (
        value
        .replace("ṣ", "s")
        .replace("ś", "s")
        .replace("ā", "a")
        .replace("ī", "i")
        .replace("ū", "u")
        .replace("-", "")
        .replace("_", "")
        .replace(" ", "")
    )

    aliases = {
        "anumana": "anumana",
        "anumāna": "anumana",
        "arthapatti": "arthapatti",
        "arthāpatti": "arthapatti",
        "upamana": "upamana",
        "upamāna": "upamana",
        "pratyaksha": "pratyaksha",
        "pratyaksa": "pratyaksha",
        "pratyakṣa": "pratyaksha",
        "sabda": "shabda",
        "shabda": "shabda",
        "śabda": "shabda",
        "anupalabdhi": "anupalabdhi",
    }

    return aliases.get(value, value)


# ============================================================
# INITIALIZE RAG
# ============================================================

def initialize_rag() -> None:
    """
    Initialize Sentence Transformer and connect to ChromaDB.

    IMPORTANT:
    No ingestion is performed here.
    The existing ChromaDB is opened in read/use mode only.
    """

    global _embedding_model
    global _chroma_client
    global _collection

    if _embedding_model is not None and _collection is not None:
        return

    print("[RAG] Initializing RAG service...")

    # --------------------------------------------------------
    # Sentence Transformer
    # --------------------------------------------------------

    try:
        print(
            "[RAG] Loading embedding model: "
            "sentence-transformers/all-MiniLM-L6-v2"
        )

        _embedding_model = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L6-v2"
        )

        print("[RAG] Embedding model loaded successfully.")

    except Exception as exc:
        print(f"[RAG] Failed to load embedding model: {exc}")
        _embedding_model = None

    # --------------------------------------------------------
    # ChromaDB
    # --------------------------------------------------------

    try:
        chroma_path = settings.CHROMA_PATH

        print(f"[RAG] Opening ChromaDB: {chroma_path}")

        _chroma_client = chromadb.PersistentClient(
            path=chroma_path
        )

        _collection = _chroma_client.get_collection(
            name="reasoning_knowledge"
        )

        count = _collection.count()

        print(
            "[RAG] Connected to ChromaDB collection "
            f"'reasoning_knowledge' ({count} records)"
        )

    except Exception as exc:
        print(f"[RAG] Failed to connect to ChromaDB: {exc}")

        _chroma_client = None
        _collection = None


# ============================================================
# ENSURE INITIALIZED
# ============================================================

def _ensure_initialized() -> None:
    """Initialize RAG lazily when first used."""

    if _collection is None:
        initialize_rag()


# ============================================================
# RAG AVAILABILITY
# ============================================================

def is_rag_available() -> bool:
    """Return True when the ChromaDB collection is available."""

    _ensure_initialized()

    return _collection is not None


# ============================================================
# SEMANTIC CONTEXT RETRIEVAL
# ============================================================

def retrieve_context(
    query: str,
    skill: str | None = None,
    n_results: int = 5,
) -> list[dict[str, Any]]:
    """
    Retrieve semantically relevant documents from ChromaDB.
    """

    _ensure_initialized()

    if _collection is None:
        return []

    if not query or not str(query).strip():
        return []

    try:
        query_text = str(query).strip()

        # ----------------------------------------------------
        # Generate embedding
        # ----------------------------------------------------

        if _embedding_model is not None:
            embedding = _embedding_model.encode(
                query_text,
                normalize_embeddings=True,
            ).tolist()
        else:
            embedding = None

        # ----------------------------------------------------
        # Optional skill filter
        # ----------------------------------------------------

        where = None

        if skill:
            normalized_skill = normalize_skill(skill)

            if normalized_skill:
                where = {
                    "skill": normalized_skill
                }

        # ----------------------------------------------------
        # Query ChromaDB
        # ----------------------------------------------------

        if embedding is not None:

            if where:
                results = _collection.query(
                    query_embeddings=[embedding],
                    n_results=n_results,
                    where=where,
                    include=[
                        "documents",
                        "metadatas",
                        "distances",
                    ],
                )
            else:
                results = _collection.query(
                    query_embeddings=[embedding],
                    n_results=n_results,
                    include=[
                        "documents",
                        "metadatas",
                        "distances",
                    ],
                )

        else:

            if where:
                results = _collection.query(
                    query_texts=[query_text],
                    n_results=n_results,
                    where=where,
                    include=[
                        "documents",
                        "metadatas",
                        "distances",
                    ],
                )
            else:
                results = _collection.query(
                    query_texts=[query_text],
                    n_results=n_results,
                    include=[
                        "documents",
                        "metadatas",
                        "distances",
                    ],
                )

        documents = (
            results.get("documents", [[]])[0]
            if results.get("documents")
            else []
        )

        metadatas = (
            results.get("metadatas", [[]])[0]
            if results.get("metadatas")
            else []
        )

        distances = (
            results.get("distances", [[]])[0]
            if results.get("distances")
            else []
        )

        retrieved = []

        for index, document in enumerate(documents):

            metadata = (
                metadatas[index]
                if index < len(metadatas)
                else {}
            )

            distance = (
                distances[index]
                if index < len(distances)
                else None
            )

            retrieved.append(
                {
                    "document": document,
                    "metadata": metadata,
                    "distance": distance,
                }
            )

        return retrieved

    except Exception as exc:

        print(
            f"[RAG] Context retrieval failed: {exc}"
        )

        return []


# ============================================================
# HELPER — PARSE DOCUMENT
# ============================================================

def _parse_document(document: Any) -> dict[str, Any]:
    """
    Convert a ChromaDB document into a dictionary when possible.
    """

    if isinstance(document, dict):
        return document

    if isinstance(document, str):

        text = document.strip()

        if not text:
            return {}

        try:
            parsed = json.loads(text)

            if isinstance(parsed, dict):
                return parsed

        except Exception:
            pass

        # Plain text document.
        return {
            "question": text
        }

    return {
        "question": str(document)
    }


# ============================================================
# HELPER — EXTRACT PRATYAKSHA IMAGE
# ============================================================

def _extract_pratyaksha_image(
    document: Any,
    parsed: dict[str, Any],
    metadata: dict[str, Any],
) -> str:
    """
    Extract the VisReason image filename.

    VisReason records can store the image in different places.

    Examples:

        parsed["image"] = "2361481.jpg"

    or:

        metadata["image"] = "2361481.jpg"

    or inside the raw ChromaDB document:

        Image: 2361481.jpg

    This function does NOT modify ChromaDB.
    It only extracts the filename for the API response.
    """

    # --------------------------------------------------------
    # 1. Structured parsed fields
    # --------------------------------------------------------

    image = (
        parsed.get("image")
        or parsed.get("image_url")
        or parsed.get("imageUrl")
        or parsed.get("image_path")
        or parsed.get("imagePath")
        or ""
    )

    # --------------------------------------------------------
    # 2. Chroma metadata
    # --------------------------------------------------------

    if not image:
        image = (
            metadata.get("image")
            or metadata.get("image_url")
            or metadata.get("imageUrl")
            or metadata.get("image_path")
            or metadata.get("imagePath")
            or ""
        )

    # --------------------------------------------------------
    # 3. Extract from document text
    #
    # Example:
    #
    # Image: 2361481.jpg
    # --------------------------------------------------------

    if not image:

        document_text = str(document)

        image_match = re.search(
            r"(?:^|\n)\s*Image\s*:\s*([^\s]+)",
            document_text,
            flags=re.IGNORECASE,
        )

        if image_match:
            image = image_match.group(1).strip()

    # --------------------------------------------------------
    # 4. Extract from any text-like parsed field
    #
    # This handles records where the image filename is stored
    # inside "document", "text", or "content".
    # --------------------------------------------------------

    if not image:

        possible_text_fields = [
            parsed.get("document"),
            parsed.get("text"),
            parsed.get("content"),
        ]

        for text_value in possible_text_fields:

            if not text_value:
                continue

            image_match = re.search(
                r"(?:^|\n)\s*Image\s*:\s*([^\s]+)",
                str(text_value),
                flags=re.IGNORECASE,
            )

            if image_match:
                image = image_match.group(1).strip()
                break

    # --------------------------------------------------------
    # 5. Keep only filename
    # --------------------------------------------------------

    if image:

        image = str(image).strip()

        image = re.split(
            r"[\\/]",
            image,
        )[-1].strip()

    return image


# ============================================================
# HELPER — CLEAN STUDENT-FACING QUESTION
# ============================================================

def _clean_student_question(
    text: Any,
    skill: str,
) -> str:
    """
    Clean dataset-specific metadata from the question shown
    to the student.

    IMPORTANT:
    - This only changes the displayed question.
    - It does NOT modify ChromaDB.
    - It does NOT change the correct answer.
    """

    if text is None:
        return ""

    value = str(text).strip()

    if not value:
        return ""

    normalized_skill = normalize_skill(skill)

    # --------------------------------------------------------
    # ANUPALABDHI / SNLI
    # --------------------------------------------------------

    if normalized_skill == "anupalabdhi":

        premise_match = re.search(
            r"Evidence\s*\(?Premise\)?\s*:\s*"
            r"(.*?)(?=\s*Claim\s*\(?Hypothesis\)?\s*:)",
            value,
            flags=re.IGNORECASE | re.DOTALL,
        )

        hypothesis_match = re.search(
            r"Claim\s*\(?Hypothesis\)?\s*:\s*"
            r"(.*?)(?=\s*Relationship\s*:|"
            r"\s*Reasoning\s*Skill\s*:|$)",
            value,
            flags=re.IGNORECASE | re.DOTALL,
        )

        premise = (
            premise_match.group(1).strip()
            if premise_match
            else ""
        )

        hypothesis = (
            hypothesis_match.group(1).strip()
            if hypothesis_match
            else ""
        )

        if premise and hypothesis:

            return (
                f"Evidence: {premise}\n\n"
                f"Claim: {hypothesis}\n\n"
                "What is the relationship between the "
                "evidence and the claim?"
            )

        # ----------------------------------------------------
        # Fallback cleaning
        # ----------------------------------------------------

        value = re.sub(
            r"\s*Relationship\s*:\s*.*?"
            r"(?=\s*Reasoning\s*Skill\s*:|$)",
            "",
            value,
            flags=re.IGNORECASE | re.DOTALL,
        )

        value = re.sub(
            r"\s*Reasoning\s*Skill\s*:.*$",
            "",
            value,
            flags=re.IGNORECASE | re.DOTALL,
        )

    return value.strip()


# ============================================================
# HELPER — NORMALIZE QUESTION TEXT
# ============================================================

def _normalize_question_text(text: Any) -> str:
    """
    Normalize question text for duplicate detection.
    """

    if text is None:
        return ""

    value = str(text).strip().lower()

    value = unicodedata.normalize(
        "NFKD",
        value,
    )

    value = "".join(
        char
        for char in value
        if not unicodedata.combining(char)
    )

    value = " ".join(value.split())

    return value


# ============================================================
# HELPER — OPTIONS
# ============================================================

def _parse_options(
    options: Any,
) -> list[str]:
    """
    Safely convert options into a list of strings.
    """

    if options is None:
        return []

    if isinstance(options, list):

        return [
            str(option).strip()
            for option in options
            if str(option).strip()
        ]

    if isinstance(options, tuple):

        return [
            str(option).strip()
            for option in options
            if str(option).strip()
        ]

    if isinstance(options, str):

        value = options.strip()

        if not value:
            return []

        # Try JSON.
        try:

            parsed = json.loads(value)

            if isinstance(parsed, list):

                return [
                    str(option).strip()
                    for option in parsed
                    if str(option).strip()
                ]

        except Exception:
            pass

        # Try pipe-separated options.
        if "|" in value:

            return [
                item.strip()
                for item in value.split("|")
                if item.strip()
            ]

        # Try newline-separated options.
        if "\n" in value:

            return [
                item.strip()
                for item in value.splitlines()
                if item.strip()
            ]

        return [value]

    return [str(options).strip()]


# ============================================================
# RETRIEVE UNIQUE QUESTIONS
# ============================================================

def retrieve_questions(
    skill: str,
    n_results: int = 5,
    difficulty: str | None = None,
) -> list[dict[str, Any]]:
    """
    Retrieve UNIQUE assessment questions for a cognitive skill.

    This function:
    1. Retrieves all records belonging to the requested skill.
    2. Parses each record.
    3. Removes duplicate question IDs.
    4. Removes duplicate question text.
    5. Optionally filters by difficulty.
    6. Randomizes the remaining unique questions.
    7. Returns exactly n_results when enough unique questions exist.

    IMPORTANT:
    This function ONLY READS from ChromaDB.
    It does NOT modify or ingest anything.
    """

    _ensure_initialized()

    if _collection is None:

        print("[RAG] ChromaDB collection unavailable.")

        return []

    normalized_skill = normalize_skill(skill)

    if not normalized_skill:

        print("[RAG] Empty skill supplied.")

        return []

    if n_results <= 0:
        return []

    try:

        # ----------------------------------------------------
        # Retrieve ALL records for this skill.
        # ----------------------------------------------------

        results = _collection.get(
            where={
                "skill": normalized_skill
            },
            include=[
                "documents",
                "metadatas",
            ],
        )

        documents = results.get("documents") or []
        metadatas = results.get("metadatas") or []
        ids = results.get("ids") or []

        candidates: list[dict[str, Any]] = []

        seen_ids: set[str] = set()
        seen_questions: set[str] = set()

        # ----------------------------------------------------
        # Process every ChromaDB record
        # ----------------------------------------------------

        for index, document in enumerate(documents):

            metadata = (
                metadatas[index]
                if index < len(metadatas)
                and metadatas[index]
                else {}
            )

            question_id = (
                ids[index]
                if index < len(ids)
                else metadata.get("question_id")
            )

            if question_id is not None:
                question_id = str(question_id).strip()

            # ------------------------------------------------
            # Parse document
            # ------------------------------------------------

            parsed = _parse_document(document)

            # ------------------------------------------------
            # Question text
            # ------------------------------------------------

            question_text = (
                parsed.get("question")
                or parsed.get("question_text")
                or parsed.get("text")
                or metadata.get("question")
                or metadata.get("question_text")
                or ""
            )

            # ------------------------------------------------
            # Clean student-facing question
            # ------------------------------------------------

            question_text = _clean_student_question(
                question_text,
                normalized_skill,
            )

            if not question_text:
                continue

            # ------------------------------------------------
            # Remove duplicate question IDs
            # ------------------------------------------------

            if question_id and question_id in seen_ids:
                continue

            # ------------------------------------------------
            # Remove duplicate question text
            # ------------------------------------------------

            question_key = _normalize_question_text(
                question_text
            )

            if not question_key:
                continue

            if question_key in seen_questions:
                continue

            # ------------------------------------------------
            # Difficulty
            # ------------------------------------------------

            record_difficulty = (
                parsed.get("difficulty")
                or metadata.get("difficulty")
                or "medium"
            )

            record_difficulty = str(
                record_difficulty
            ).strip().lower()

            # ------------------------------------------------
            # Difficulty filter
            # ------------------------------------------------

            if difficulty:

                requested_difficulty = str(
                    difficulty
                ).strip().lower()

                if record_difficulty != requested_difficulty:
                    continue

            # ------------------------------------------------
            # Options
            # ------------------------------------------------

            options = _parse_options(
                parsed.get("options")
                or metadata.get("options")
                or []
            )

            # ------------------------------------------------
            # Correct answer
            # ------------------------------------------------

            correct_answer = (
                parsed.get("correct_answer")
                or parsed.get("correctAnswer")
                or parsed.get("answer")
                or parsed.get("label")
                or parsed.get("correct_option")
                or metadata.get("correct_answer")
                or metadata.get("correctAnswer")
                or metadata.get("answer")
                or metadata.get("label")
                or metadata.get("correct_option")
                or ""
            )

            if correct_answer is not None:

                correct_answer = str(
                    correct_answer
                ).strip()

            # ------------------------------------------------
            # ANUPALABDHI FALLBACK
            # ------------------------------------------------

            if (
                normalized_skill == "anupalabdhi"
                and not correct_answer
            ):

                relationship_match = re.search(
                    r"Relationship\s*:\s*"
                    r"(entailment|neutral|contradiction)",
                    str(document),
                    flags=re.IGNORECASE,
                )

                if relationship_match:

                    correct_answer = (
                        relationship_match.group(1)
                        .strip()
                        .lower()
                    )

            # ------------------------------------------------
            # Reasoning category
            # ------------------------------------------------

            reasoning_category = (
                parsed.get("reasoning_category")
                or parsed.get("reasoningCategory")
                or metadata.get("reasoning_category")
                or metadata.get("reasoningCategory")
                or normalized_skill
            )

            # ------------------------------------------------
            # Dataset
            # ------------------------------------------------

            dataset = (
                parsed.get("dataset")
                or metadata.get("dataset")
                or normalized_skill
            )

            # ------------------------------------------------
            # Source
            # ------------------------------------------------

            source = (
                parsed.get("source")
                or metadata.get("source")
                or ""
            )

            # ------------------------------------------------
            # IMAGE
            #
            # This now handles all known VisReason formats.
            # ------------------------------------------------

            image = _extract_pratyaksha_image(
                document=document,
                parsed=parsed,
                metadata=metadata,
            )

            # ------------------------------------------------
            # Question type
            # ------------------------------------------------

            question_type = (
                parsed.get("question_type")
                or parsed.get("questionType")
                or metadata.get("question_type")
                or metadata.get("questionType")
                or ""
            )

            # Pratyakṣa questions without MCQ options are
            # visual open-ended questions.

            if normalized_skill == "pratyaksha":

                if not options or all(
                    not str(option).strip()
                    for option in options
                ):

                    question_type = "visual_open_ended"

            elif not question_type:

                if len(options) >= 2:
                    question_type = "mcq"
                else:
                    question_type = "open_ended"

            # ------------------------------------------------
            # Build standardized record
            # ------------------------------------------------

            record = {
                "question_id": question_id,
                "question": question_text,
                "options": options,
                "correct_answer": correct_answer,
                "reasoning_category": str(
                    reasoning_category
                ),
                "difficulty": record_difficulty,
                "dataset": str(dataset),
                "source": str(source),
                "image": image,
                "question_type": str(question_type),
                "skill": normalized_skill,
            }

            candidates.append(record)

            # ------------------------------------------------
            # Track duplicates
            # ------------------------------------------------

            if question_id:
                seen_ids.add(question_id)

            seen_questions.add(question_key)

        # ----------------------------------------------------
        # Randomize ALL unique candidates
        # ----------------------------------------------------

        random.shuffle(candidates)

        # ----------------------------------------------------
        # Select requested number
        # ----------------------------------------------------

        selected = candidates[:n_results]

        print(
            f"[RAG] {normalized_skill}: "
            f"retrieved {len(selected)} unique questions "
            f"from {len(candidates)} unique candidates"
        )

        # ----------------------------------------------------
        # Debug question IDs/text/images
        # ----------------------------------------------------

        for index, question in enumerate(
            selected,
            start=1,
        ):

            print(
                f"[RAG] {normalized_skill} "
                f"Question {index}: "
                f"{question.get('question_id')} - "
                f"{question.get('question', '')[:100]}"
            )

            if normalized_skill == "pratyaksha":

                print(
                    f"[RAG] Pratyakṣa image: "
                    f"{question.get('image', '')}"
                )

        return selected

    except Exception as exc:

        print(
            f"[RAG] Failed to retrieve questions for "
            f"{normalized_skill}: {exc}"
        )

        return []


# ============================================================
# GET QUESTION BY ID
# ============================================================

def get_question_by_id_from_rag(
    question_id: str,
) -> dict[str, Any] | None:
    """
    Retrieve one exact question from ChromaDB by ID.
    """

    _ensure_initialized()

    if _collection is None:
        return None

    if not question_id:
        return None

    try:

        result = _collection.get(
            ids=[str(question_id)],
            include=[
                "documents",
                "metadatas",
            ],
        )

        ids = result.get("ids") or []
        documents = result.get("documents") or []
        metadatas = result.get("metadatas") or []

        if not ids:
            return None

        document = (
            documents[0]
            if documents
            else ""
        )

        metadata = (
            metadatas[0]
            if metadatas
            else {}
        )

        parsed = _parse_document(document)

        skill = normalize_skill(
            parsed.get("skill")
            or metadata.get("skill")
            or ""
        )

        # ----------------------------------------------------
        # Question text
        # ----------------------------------------------------

        question_text = (
            parsed.get("question")
            or parsed.get("question_text")
            or metadata.get("question")
            or ""
        )

        # ----------------------------------------------------
        # Clean student-facing question
        # ----------------------------------------------------

        question_text = _clean_student_question(
            question_text,
            skill,
        )

        # ----------------------------------------------------
        # Options
        # ----------------------------------------------------

        options = _parse_options(
            parsed.get("options")
            or metadata.get("options")
            or []
        )

        # ----------------------------------------------------
        # Correct answer
        # ----------------------------------------------------

        correct_answer = (
            parsed.get("correct_answer")
            or parsed.get("correctAnswer")
            or parsed.get("answer")
            or parsed.get("label")
            or metadata.get("correct_answer")
            or metadata.get("correctAnswer")
            or metadata.get("answer")
            or metadata.get("label")
            or ""
        )

        # ----------------------------------------------------
        # ANUPALABDHI FALLBACK
        # ----------------------------------------------------

        if (
            skill == "anupalabdhi"
            and not correct_answer
        ):

            relationship_match = re.search(
                r"Relationship\s*:\s*"
                r"(entailment|neutral|contradiction)",
                str(document),
                flags=re.IGNORECASE,
            )

            if relationship_match:

                correct_answer = (
                    relationship_match.group(1)
                    .strip()
                    .lower()
                )

        # ----------------------------------------------------
        # PRATYAKṢA IMAGE
        # ----------------------------------------------------

        image = _extract_pratyaksha_image(
            document=document,
            parsed=parsed,
            metadata=metadata,
        )

        # ----------------------------------------------------
        # Question type
        # ----------------------------------------------------

        question_type = (
            parsed.get("question_type")
            or parsed.get("questionType")
            or metadata.get("question_type")
            or metadata.get("questionType")
            or ""
        )

        if skill == "pratyaksha" and not options:

            question_type = "visual_open_ended"

        elif not question_type:

            question_type = (
                "mcq"
                if len(options) >= 2
                else "open_ended"
            )

        return {
            "question_id": ids[0],
            "question": str(
                question_text
            ).strip(),
            "options": options,
            "correct_answer": str(
                correct_answer
            ).strip(),
            "reasoning_category": (
                parsed.get("reasoning_category")
                or parsed.get("reasoningCategory")
                or metadata.get("reasoning_category")
                or metadata.get("reasoningCategory")
                or skill
            ),
            "difficulty": (
                parsed.get("difficulty")
                or metadata.get("difficulty")
                or "medium"
            ),
            "dataset": (
                parsed.get("dataset")
                or metadata.get("dataset")
                or skill
            ),
            "source": (
                parsed.get("source")
                or metadata.get("source")
                or ""
            ),
            "image": image,
            "question_type": question_type,
            "skill": skill,
        }

    except Exception as exc:

        print(
            f"[RAG] Failed to retrieve question "
            f"{question_id}: {exc}"
        )

        return None


# ============================================================
# LLAMAINDEX PLACEHOLDER
# ============================================================

def query_llamaindex(
    query: str,
    skill: str | None = None,
    n_results: int = 5,
) -> list[dict[str, Any]]:
    """
    LlamaIndex integration placeholder.

    The current assessment pipeline uses ChromaDB directly.
    """

    return retrieve_context(
        query=query,
        skill=skill,
        n_results=n_results,
    )


# ============================================================
# RAG STATUS
# ============================================================

def get_rag_status() -> dict[str, Any]:
    """
    Return current RAG service status.
    """

    _ensure_initialized()

    status = {
        "available": _collection is not None,
        "embedding_model_loaded": (
            _embedding_model is not None
        ),
        "chroma_connected": (
            _collection is not None
        ),
        "collection_name": (
            "reasoning_knowledge"
            if _collection is not None
            else None
        ),
        "document_count": 0,
    }

    if _collection is not None:

        try:

            status["document_count"] = (
                _collection.count()
            )

        except Exception:

            status["document_count"] = 0

    return status