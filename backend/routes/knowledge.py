"""
Cognita AI — Knowledge Base routes.

Read-only, student-safe access to the existing RAG knowledge layer.
No ML prediction, no ChromaDB modification, no answer/solution exposure.
"""

from typing import Any
import ast
import re

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from services.rag import retrieve_context, normalize_skill


router = APIRouter(prefix="/api/knowledge", tags=["Knowledge Base"])


SKILL_INFO = {
    "anumana": {
        "name": "Anumāna",
        "description": "Logical and inferential reasoning",
        "resource_title": "Logical Reasoning Example",
    },
    "arthapatti": {
        "name": "Arthāpatti",
        "description": "Abductive reasoning and problem solving",
        "resource_title": "Abductive Reasoning Example",
    },
    "upamana": {
        "name": "Upamāna",
        "description": "Analogical reasoning",
        "resource_title": "Analogical Reasoning Example",
    },
    "pratyaksha": {
        "name": "Pratyakṣa",
        "description": "Observation and visual reasoning",
        "resource_title": "Visual Reasoning Example",
    },
    "shabda": {
        "name": "Śabda",
        "description": "Reading comprehension and interpretation",
        "resource_title": "Reading Comprehension Example",
    },
    "anupalabdhi": {
        "name": "Anupalabdhi",
        "description": "Absence, contradiction and elimination reasoning",
        "resource_title": "Elimination Reasoning Example",
    },
}

# Common spellings and deliberate typo tolerance for dimension searches.
SKILL_ALIASES = {
    "anumana": "anumana",
    "anumāna": "anumana",
    "logical reasoning": "anumana",
    "inferential reasoning": "anumana",
    "inference": "anumana",
    "logic": "anumana",

    "arthapatti": "arthapatti",
    "arthāpatti": "arthapatti",
    "abductive reasoning": "arthapatti",
    "abduction": "arthapatti",
    "problem solving": "arthapatti",

    "upamana": "upamana",
    "upamāna": "upamana",
    "analogical reasoning": "upamana",
    "analogy": "upamana",

    "pratyaksha": "pratyaksha",
    "pratyakṣa": "pratyaksha",
    "visual reasoning": "pratyaksha",
    "visual": "pratyaksha",
    "observation": "pratyaksha",

    "shabda": "shabda",
    "śabda": "shabda",
    "sabda": "shabda",
    "sabdha": "shabda",
    "shabdha": "shabda",
    "reading comprehension": "shabda",
    "comprehension": "shabda",
    "interpretation": "shabda",

    "anupalabdhi": "anupalabdhi",
    "absence reasoning": "anupalabdhi",
    "contradiction": "anupalabdhi",
    "elimination reasoning": "anupalabdhi",
    "elimination": "anupalabdhi",
}


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip() if text else ""


def _normalize_search_term(value: str | None) -> str:
    if not value:
        return ""
    text = str(value).lower().strip()
    replacements = {
        "ā": "a", "ī": "i", "ū": "u", "ṛ": "r", "ṝ": "r",
        "ṣ": "s", "ś": "s", "ñ": "n",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _normalize_skill_safe(skill: str | None) -> str | None:
    """Return one of Cognita's six canonical skill IDs.

    Important: diacritic removal turns ``Śabda`` into ``sabda``.
    That is linguistically useful for search, but ``sabda`` is not
    the internal skill ID.  Always pass the normalized value through
    SKILL_ALIASES so display names and common misspellings resolve to
    the canonical ID ``shabda``.
    """
    if not skill:
        return None

    try:
        normalized = normalize_skill(skill)
    except Exception:
        normalized = str(skill).lower().strip()

    normalized = _normalize_search_term(normalized)
    if not normalized:
        return None

    # Exact canonical ID.
    if normalized in SKILL_INFO:
        return normalized

    # Normalized aliases, including ``sabda`` / ``sabdha``.
    alias_map = {
        _normalize_search_term(alias): canonical
        for alias, canonical in SKILL_ALIASES.items()
    }

    return alias_map.get(normalized, normalized)


def _skill_name(skill: str | None) -> str:
    normalized = _normalize_skill_safe(skill)
    return SKILL_INFO.get(normalized, {"name": normalized.title() if normalized else ""})["name"]


def _skill_description(skill: str | None) -> str:
    normalized = _normalize_skill_safe(skill)
    return SKILL_INFO.get(normalized, {"description": ""})["description"]


def _skill_resource_title(skill: str | None) -> str:
    normalized = _normalize_skill_safe(skill)
    return SKILL_INFO.get(
        normalized,
        {"resource_title": "Reasoning Example"},
    ).get("resource_title", "Reasoning Example")


def _detect_skill_from_query(query: str) -> str | None:
    normalized_query = _normalize_search_term(query)
    if not normalized_query:
        return None

    alias_map = {
        _normalize_search_term(alias): skill
        for alias, skill in SKILL_ALIASES.items()
    }

    if normalized_query in alias_map:
        return alias_map[normalized_query]

    for alias, skill in sorted(alias_map.items(), key=lambda item: len(item[0]), reverse=True):
        if alias and re.search(rf"\b{re.escape(alias)}\b", normalized_query):
            return skill

    # Conservative typo tolerance for a bare Sanskrit dimension name.
    import difflib
    dimension_terms = {
        "anumana": "anumana",
        "arthapatti": "arthapatti",
        "upamana": "upamana",
        "pratyaksha": "pratyaksha",
        "shabda": "shabda",
        "anupalabdhi": "anupalabdhi",
    }
    closest = difflib.get_close_matches(
        normalized_query,
        dimension_terms.keys(),
        n=1,
        cutoff=0.72,
    )
    return dimension_terms[closest[0]] if closest else None


def _extract_result_text(result: Any) -> str:
    if isinstance(result, str):
        return result.strip()
    if isinstance(result, dict):
        for key in ("document", "text", "content", "context", "question"):
            value = result.get(key)
            if value:
                return _safe_text(value)
    return _safe_text(result)


def _extract_metadata(result: Any) -> dict:
    if not isinstance(result, dict):
        return {}
    metadata = result.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    return {
        key: result.get(key)
        for key in (
            "skill", "skill_name", "difficulty", "dataset", "source",
            "question_type", "image", "id", "question_id", "title", "type",
        )
        if result.get(key) is not None
    }


def _result_skill(result: Any) -> str | None:
    metadata = _extract_metadata(result)
    raw = (
        result.get("skill") if isinstance(result, dict) else None
    ) or metadata.get("skill") or metadata.get("skill_name")
    return _normalize_skill_safe(raw)


def _remove_coordinate_annotations(text: str) -> str:
    if not text:
        return ""
    coordinate_pattern = (
        r"\[\s*-?\d+(?:\.\d+)?\s*,\s*"
        r"-?\d+(?:\.\d+)?\s*,\s*"
        r"-?\d+(?:\.\d+)?\s*,\s*"
        r"-?\d+(?:\.\d+)?\s*\]"
    )
    cleaned = re.sub(coordinate_pattern, "", text)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;:?!])", r"\1", cleaned)
    return cleaned.strip()


def _remove_sensitive_sections(text: str) -> str:
    if not text:
        return ""

    cleaned = text
    sensitive_markers = (
        r"Correct\s+Answer\s*:",
        r"Expected\s+Answer\s*:",
        r"Correct\s+Option\s*:",
        r"Answer\s+Key\s*:",
        r"Answer\s+Explanation\s*:",
        r"Solution\s*:",
        r"Reasoning\s*:",
    )
    boundary = (
        r"(?=\s+(?:Question|Options|Reasoning\s+Skill|Reasoning\s+Category|"
        r"Difficulty|Dataset|Source|Image|Visible\s+Objects)\s*:|$)"
    )

    for marker in sensitive_markers:
        cleaned = re.sub(
            marker + r".*?" + boundary,
            " ",
            cleaned,
            flags=re.IGNORECASE | re.DOTALL,
        )

    cleaned = re.sub(
        r"(?:Reasoning\s+Skill|Reasoning\s+Category)\s*:\s*.*?"
        r"(?=\s+[A-Z][A-Za-z\s]+:|$)",
        " ",
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )

    return _normalize_whitespace(_remove_coordinate_annotations(cleaned))


def _extract_image(text: str, metadata: dict) -> str | None:
    image = metadata.get("image")
    if image:
        return _safe_text(image)
    if not text:
        return None
    match = re.search(r"\bImage\s*:\s*([^\s,]+)", text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def _extract_question(text: str) -> str:
    if not text:
        return ""

    pattern = (
        r"(?:Question|Visual\s+Question)\s*:\s*(.*?)(?="
        r"\s+Options\s*:|"
        r"\s+Correct\s+Answer\s*:|"
        r"\s+Expected\s+Answer\s*:|"
        r"\s+Answer\s+Explanation\s*:|"
        r"\s+Solution\s*:|"
        r"\s+Reasoning\s*:|$)"
    )

    match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return _normalize_whitespace(_remove_coordinate_annotations(match.group(1)))


def _extract_options(text: str) -> list[str]:
    if not text:
        return []

    match = re.search(
        r"Options\s*:\s*(.*?)(?="
        r"\s+Correct\s+Answer\s*:|"
        r"\s+Expected\s+Answer\s*:|"
        r"\s+Answer\s+Explanation\s*:|"
        r"\s+Solution\s*:|"
        r"\s+Reasoning\s*:|$)",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return []

    options_text = match.group(1).strip()

    if options_text.startswith("[") and options_text.endswith("]"):
        try:
            parsed = ast.literal_eval(options_text)
            if isinstance(parsed, list):
                return [
                    _normalize_whitespace(_safe_text(option))
                    for option in parsed
                    if _safe_text(option)
                ]
        except Exception:
            pass

    matches = re.findall(
        r"(?:^|\s)([A-D])[.)]\s*(.*?)(?=\s+[A-D][.)]\s*|$)",
        options_text,
        flags=re.DOTALL,
    )
    return [
        _normalize_whitespace(f"{label}. {value}")
        for label, value in matches
        if value.strip()
    ]


def _build_clean_content(raw_text: str, question: str, options: list[str]) -> str:
    if question:
        if options:
            return f"{question}\n\nOptions:\n" + "\n".join(options)
        return question
    return _remove_sensitive_sections(raw_text)


def _canonical_difficulty(value: Any) -> str:
    normalized = _normalize_search_term(_safe_text(value))
    aliases = {
        "beginner": "easy",
        "basic": "easy",
        "easy": "easy",
        "intermediate": "medium",
        "moderate": "medium",
        "medium": "medium",
        "advanced": "hard",
        "hard": "hard",
        "general": "general",
    }
    return aliases.get(normalized, normalized or "general")


def _build_resource(result: Any, fallback_skill: str | None, index: int) -> dict:
    metadata = _extract_metadata(result)
    raw_text = _extract_result_text(result)
    final_skill = _result_skill(result) or fallback_skill

    question = _extract_question(raw_text)
    options = _extract_options(raw_text)
    safe_content = _build_clean_content(raw_text, question, options)
    image = _extract_image(raw_text, metadata)

    resource_id = (
        metadata.get("id")
        or metadata.get("question_id")
        or (result.get("id") if isinstance(result, dict) else None)
        or f"knowledge-{index}"
    )
    dataset = metadata.get("dataset") or metadata.get("source") or "Cognitive Reasoning Resources"

    return {
        "id": str(resource_id),
        "title": _skill_resource_title(final_skill),
        "content": safe_content,
        "question": question,
        "options": options,
        "skill": final_skill,
        "skill_name": _skill_name(final_skill) if final_skill else "Reasoning",
        "skill_description": _skill_description(final_skill) if final_skill else "",
        "difficulty": _canonical_difficulty(metadata.get("difficulty")),
        "dataset": _safe_text(dataset),
        "question_type": metadata.get("question_type") or "reasoning",
        "image": image,
    }


def _matches_skill(result: Any, expected_skill: str) -> bool:
    # Strict filtering is important: when a dimension is selected/detected,
    # records without a trustworthy skill annotation must not leak into it.
    return _result_skill(result) == expected_skill


@router.get("/search")
def search_knowledge(
    q: str = Query(..., min_length=2, max_length=500, description="Semantic search query"),
    skill: str | None = Query(default=None, description="Optional Mīmāṃsā-inspired reasoning dimension"),
    difficulty: str | None = Query(default=None, description="Optional difficulty filter"),
    limit: int = Query(default=12, ge=1, le=30),
    current_user=Depends(get_current_user),
):
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(status_code=400, detail="Search query must contain at least 2 characters.")

    normalized_skill = _normalize_skill_safe(skill) if skill else None
    if normalized_skill and normalized_skill not in SKILL_INFO:
        normalized_skill = SKILL_ALIASES.get(
            _normalize_search_term(skill),
            normalized_skill,
        )

    if normalized_skill and normalized_skill not in SKILL_INFO:
        raise HTTPException(
            status_code=400,
            detail="Invalid reasoning dimension. Use anumana, arthapatti, upamana, pratyaksha, shabda, or anupalabdhi.",
        )

    # A bare dimension search such as "shabda" or the user's "sabdha"
    # is an intentional dimension query, not a generic semantic query.
    if normalized_skill is None:
        normalized_skill = _detect_skill_from_query(query)

    normalized_difficulty = None
    if difficulty:
        normalized_difficulty = _canonical_difficulty(difficulty)
        if normalized_difficulty not in {"easy", "medium", "hard", "general"}:
            raise HTTPException(
                status_code=400,
                detail="Invalid difficulty. Use easy, medium, or hard.",
            )

    # Retrieve a larger candidate pool, then apply strict server-side filters.
    # This avoids unrelated semantic matches filling the response.
    retrieval_count = min(max(limit * 5, 30), 100)

    try:
        results = retrieve_context(
            query=query,
            skill=normalized_skill,
            n_results=retrieval_count,
        ) or []
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Knowledge Base search failed: {exc}",
        ) from exc

    resources: list[dict] = []
    for index, result in enumerate(results, start=1):
        if normalized_skill and not _matches_skill(result, normalized_skill):
            continue

        resource = _build_resource(
            result=result,
            fallback_skill=normalized_skill,
            index=index,
        )

        if normalized_difficulty and resource["difficulty"] != normalized_difficulty:
            continue

        resources.append(resource)
        if len(resources) >= limit:
            break

    return {
        "success": True,
        "data": {
            "query": query,
            "skill": normalized_skill,
            "skill_name": _skill_name(normalized_skill) if normalized_skill else None,
            "difficulty": normalized_difficulty,
            "count": len(resources),
            "results": resources,
        },
    }


@router.get("/dimensions")
def get_knowledge_dimensions(current_user=Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "dimensions": [
                {
                    "id": key,
                    "name": value["name"],
                    "description": value["description"],
                }
                for key, value in SKILL_INFO.items()
            ]
        },
    }
