"""
Cognita AI - Cognitive Assessment Routes

Handles:

1. Starting the 30-question pre-assessment
2. Retrieving questions from ChromaDB/RAG
3. Falling back to demo questions when necessary
4. Serving VisReason images
5. Evaluating submitted answers
6. Calculating six cognitive skill scores
7. Calculating overall cognitive score
8. Creating/updating the cognitive profile
9. Saving the assessment in MongoDB

IMPORTANT:
- DIMENSION_KEYS is the project's actual constant.
- ChromaDB is READ ONLY during runtime.
- No dataset ingestion happens here.
- OpenAI failure/quota problems do NOT prevent submission.
- user_id is ALWAYS stored as a string so MongoDB lookups remain consistent.
"""

import logging
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from auth import get_current_user
from database import collections
from models import AssessmentSubmitRequest

from questions import (
    DIMENSION_KEYS,
    build_demo_assessment,
    get_question_by_id,
    public_question,
)

from services.rag import (
    get_question_by_id_from_rag,
    is_rag_available,
    retrieve_questions,
)

from services.ai import evaluate_answer


# ============================================================
# LOGGER
# ============================================================

logger = logging.getLogger("cognita.assessment")


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/assessment",
    tags=["Assessment"],
)


# ============================================================
# CONSTANTS
# ============================================================

QUESTIONS_PER_DIMENSION = 5

EXPECTED_TOTAL_QUESTIONS = (
    len(DIMENSION_KEYS)
    * QUESTIONS_PER_DIMENSION
)


# ============================================================
# VISREASON IMAGE DIRECTORY
# ============================================================

VISREASON_IMAGE_DIR = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "visreason"
    / "images"
)


# ============================================================
# USER ID HELPER
# ============================================================

def _get_user_id(current_user) -> str:
    """
    Convert the authenticated user ID to a string.

    This is VERY important because MongoDB treats:

        ObjectId("abc")

    and:

        "abc"

    as different values.

    The assessment/profile documents therefore always use
    the string representation.
    """

    if isinstance(current_user, dict):

        raw_user_id = (
            current_user.get("_id")
            or current_user.get("id")
            or current_user.get("user_id")
        )

    else:

        raw_user_id = current_user

    if raw_user_id is None:

        raise HTTPException(
            status_code=401,
            detail="Authenticated user ID could not be determined.",
        )

    return str(raw_user_id)


# ============================================================
# DATABASE HELPER
# ============================================================

def _get_collections():
    """
    Get MongoDB collections.

    IMPORTANT:
        database.collections is a FUNCTION.
        Therefore we MUST call:

            collections()

        and NOT:

            collections["assessments"]
    """

    cols = collections()

    if not cols:

        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )

    if "assessments" not in cols:

        raise HTTPException(
            status_code=503,
            detail="Assessments collection is unavailable.",
        )

    if "cognitive_profiles" not in cols:

        raise HTTPException(
            status_code=503,
            detail="Cognitive profiles collection is unavailable.",
        )

    return cols


# ============================================================
# QUESTION ID HELPER
# ============================================================

def _get_question_id(question: dict):
    """
    Support both RAG and local question formats.
    """

    if not isinstance(question, dict):
        return None

    return (
        question.get("question_id")
        or question.get("id")
        or question.get("_id")
    )


# ============================================================
# CLEAN QUESTION
# ============================================================

def _clean_question(
    question: dict,
    fallback_id: str | None = None,
) -> dict:
    """
    Normalize questions coming from ChromaDB or demo data.
    """

    if not isinstance(question, dict):

        return {}

    question = dict(question)

    question_id = _get_question_id(question)

    if not question_id:
        question_id = fallback_id

    if question_id:

        question["question_id"] = str(
            question_id
        )

        question["id"] = str(
            question_id
        )

    # --------------------------------------------------------
    # Question text
    # --------------------------------------------------------

    question["question"] = str(
        question.get("question")
        or question.get("text")
        or ""
    ).strip()

    # --------------------------------------------------------
    # Options
    # --------------------------------------------------------

    options = question.get("options")

    if isinstance(options, str):

        if "|||" in options:

            options = [
                item.strip()
                for item in options.split("|||")
                if item.strip()
            ]

        else:

            options = [
                item.strip()
                for item in options.split("|")
                if item.strip()
            ]

    elif not isinstance(options, list):

        options = []

    question["options"] = [
        str(option).strip()
        for option in options
        if option is not None
        and str(option).strip()
    ]

    # --------------------------------------------------------
    # Correct answer
    # --------------------------------------------------------

    question["correct_answer"] = (
        question.get("correct_answer")
        or question.get("answer")
        or question.get("label")
        or ""
    )

    # --------------------------------------------------------
    # Answer alias
    # --------------------------------------------------------

    question["answer"] = question.get(
        "answer"
    )

    # --------------------------------------------------------
    # Dataset/source
    # --------------------------------------------------------

    question["dataset"] = (
        question.get("dataset")
        or ""
    )

    question["source"] = (
        question.get("source")
        or question.get("dataset")
        or ""
    )

    # --------------------------------------------------------
    # Reasoning category
    # --------------------------------------------------------

    question["reasoning_category"] = (
        question.get("reasoning_category")
        or question.get("dimension")
        or question.get("skill")
        or ""
    )

    # --------------------------------------------------------
    # VisReason / Pratyakṣa image
    # --------------------------------------------------------

    image_value = (
        question.get("image")
        or question.get("image_url")
        or question.get("imageUrl")
        or question.get("image_path")
        or question.get("imagePath")
        or ""
    )

    # Some VisReason records keep the image filename only inside
    # the stored document text, for example: "Image: 2361481.jpg".
    # Recover that filename so every Pratyakṣa question can display
    # its corresponding local image.
    if (
        not str(image_value).strip()
        and str(question["reasoning_category"]).lower().strip()
        == "pratyaksha"
    ):
        document_text = str(
            question.get("document")
            or question.get("text")
            or question.get("content")
            or ""
        )

        image_match = re.search(
            r"(?:Image\s*:\s*)?([A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp))",
            document_text,
            flags=re.IGNORECASE,
        )

        if image_match:
            image_value = image_match.group(1)

    # The frontend expects a filename because it builds the
    # /api/assessment/image/{image_name} URL itself.
    image_text = str(image_value).strip()
    if image_text:
        filename_match = re.search(
            r"([A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp))$",
            image_text,
            flags=re.IGNORECASE,
        )
        if filename_match:
            image_text = filename_match.group(1)

    question["image"] = image_text

    # --------------------------------------------------------
    # Difficulty
    # --------------------------------------------------------

    question["difficulty"] = (
        question.get("difficulty")
        or "medium"
    )

    # --------------------------------------------------------
    # Question type
    # --------------------------------------------------------

    if (
        str(
            question["reasoning_category"]
        ).lower().strip()
        == "pratyaksha"
    ):

        question["question_type"] = (
            "visual_open_ended"
        )

    else:

        question["question_type"] = "mcq"

    return question


# ============================================================
# QUESTION VALIDATION
# ============================================================

def _has_usable_options(
    question: dict,
) -> bool:
    """
    Normal MCQ must have at least two options.
    """

    options = question.get(
        "options",
        [],
    )

    if not isinstance(options, list):
        return False

    cleaned = [
        str(option).strip()
        for option in options
        if option is not None
        and str(option).strip()
    ]

    return len(cleaned) >= 2


def _has_usable_open_answer(
    question: dict,
) -> bool:
    """
    Pratyaksha / VisReason questions can be
    open-ended but must have a stored answer.
    """

    answer = (
        question.get("correct_answer")
        or question.get("answer")
        or question.get("label")
    )

    if answer is None:
        return False

    return (
        str(answer).strip()
        != ""
    )


# ============================================================
# DEDUPLICATE QUESTIONS
# ============================================================

def _deduplicate_questions(
    questions: list[dict],
    dimension: str,
) -> list[dict]:

    unique_questions = []

    seen_ids = set()

    for index, question in enumerate(
        questions
    ):

        cleaned = _clean_question(
            question,
            fallback_id=(
                f"{dimension}_generated_{index}"
            ),
        )

        question_id = _get_question_id(
            cleaned
        )

        if not question_id:
            continue

        question_id = str(
            question_id
        )

        if question_id in seen_ids:
            continue

        seen_ids.add(
            question_id
        )

        unique_questions.append(
            cleaned
        )

    return unique_questions


# ============================================================
# ANSWER NORMALIZATION
# ============================================================

def _normalize_answer(
    value,
) -> str:

    if value is None:
        return ""

    text = str(value).strip().lower()

    text = " ".join(
        text.split()
    )

    # Remove common MCQ punctuation.
    text = (
        text
        .replace("(", "")
        .replace(")", "")
        .replace(".", "")
        .replace(":", "")
    )

    return text.strip()


# ============================================================
# ANSWER COMPARISON
# ============================================================

def _answers_match(
    student_answer,
    correct_answer,
    options=None,
) -> bool:
    """
    Robust answer comparison.

    Supports:

    1. Exact text
    2. Case-insensitive text
    3. A/B/C/D
    4. 1/2/3/4
    5. Option text vs stored option text
    """

    student = _normalize_answer(
        student_answer
    )

    correct = _normalize_answer(
        correct_answer
    )

    if not student or not correct:
        return False

    # --------------------------------------------------------
    # Direct match
    # --------------------------------------------------------

    if student == correct:
        return True

    # --------------------------------------------------------
    # MCQ letter / number mapping
    # --------------------------------------------------------

    if isinstance(
        options,
        list,
    ):

        cleaned_options = [
            _normalize_answer(option)
            for option in options
        ]

        letters = [
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
        ]

        # Student selected A/B/C/D.
        if student in letters:

            index = letters.index(
                student
            )

            if index < len(
                cleaned_options
            ):

                if (
                    cleaned_options[index]
                    == correct
                ):
                    return True

        # Student selected 1/2/3/4.
        if student.isdigit():

            try:

                index = (
                    int(student) - 1
                )

                if (
                    0 <= index
                    < len(cleaned_options)
                ):

                    if (
                        cleaned_options[index]
                        == correct
                    ):
                        return True

            except Exception:
                pass

        # Correct answer itself is A/B/C/D.
        if correct in letters:

            index = letters.index(
                correct
            )

            if index < len(
                cleaned_options
            ):

                if (
                    student
                    == cleaned_options[index]
                ):
                    return True

        # Correct answer is 1/2/3/4.
        if correct.isdigit():

            try:

                index = (
                    int(correct) - 1
                )

                if (
                    0 <= index
                    < len(cleaned_options)
                ):

                    if (
                        student
                        == cleaned_options[index]
                    ):
                        return True

            except Exception:
                pass

    return False


# ============================================================
# RESPONSE SCORE
# ============================================================

def _calculate_response_score(
    is_correct: bool,
) -> float:
    """
    Deterministic assessment score.

    Correct = 100
    Incorrect = 0

    This guarantees that the assessment can always
    be submitted even if OpenAI is unavailable.
    """

    if is_correct:
        return 100.0

    return 0.0


# ============================================================
# SKILL SCORE
# ============================================================

def _calculate_skill_scores(
    dimension_results: dict,
) -> dict:

    scores = {}

    for dimension in DIMENSION_KEYS:

        values = dimension_results.get(
            dimension,
            [],
        )

        if values:

            scores[dimension] = round(
                sum(values)
                / len(values),
                2,
            )

        else:

            scores[dimension] = 0.0

    return scores


# ============================================================
# OVERALL SCORE
# ============================================================

def _calculate_overall_score(
    skill_scores: dict,
) -> float:

    assessed_scores = [
        float(score)
        for dimension, score
        in skill_scores.items()
        if float(score) >= 0
    ]

    if not assessed_scores:
        return 0.0

    return round(
        sum(assessed_scores)
        / len(assessed_scores),
        2,
    )


# ============================================================
# SKILL LEVEL
# ============================================================

def _get_skill_level(
    score: float,
) -> str:

    score = float(score)

    if score < 40:
        return "Beginner"

    if score < 60:
        return "Developing"

    if score < 80:
        return "Proficient"

    return "Strong"


# ============================================================
# STRONGEST SKILL
# ============================================================

def _get_strongest_skill(
    skill_scores: dict,
):

    if not skill_scores:
        return None

    return max(
        skill_scores,
        key=skill_scores.get,
    )


# ============================================================
# WEAKEST SKILL
# ============================================================

def _get_weakest_skill(
    skill_scores: dict,
):

    if not skill_scores:
        return None

    return min(
        skill_scores,
        key=skill_scores.get,
    )


# ============================================================
# PROFILE SUMMARY
# ============================================================

def _create_profile_summary(
    overall_score,
    skill_level,
    strongest_skill,
    weakest_skill,
):

    skill_names = {

        "anumana":
            "logical and inferential reasoning",

        "arthapatti":
            "abductive reasoning and problem solving",

        "upamana":
            "analogical reasoning",

        "pratyaksha":
            "visual and observational reasoning",

        "shabda":
            "reading comprehension and interpretation",

        "anupalabdhi":
            "absence, contradiction, and elimination reasoning",
    }

    strongest_name = skill_names.get(
        str(strongest_skill).lower(),
        str(strongest_skill),
    )

    weakest_name = skill_names.get(
        str(weakest_skill).lower(),
        str(weakest_skill),
    )

    return (
        f"Your cognitive profile is at the "
        f"{skill_level} level with an overall "
        f"score of {round(float(overall_score), 2)}%. "
        f"Your strongest area is "
        f"{strongest_name}, while your main "
        f"area for improvement is "
        f"{weakest_name}."
    )


# ============================================================
# SERVE VISREASON IMAGE
# ============================================================

@router.get(
    "/image/{image_name}"
)
def get_assessment_image(
    image_name: str,
):

    # Prevent path traversal.
    safe_name = Path(
        image_name
    ).name

    image_path = (
        VISREASON_IMAGE_DIR
        / safe_name
    )

    if not image_path.exists():

        raise HTTPException(
            status_code=404,
            detail="Assessment image not found.",
        )

    return FileResponse(
        image_path
    )


# ============================================================
# START ASSESSMENT
# ============================================================

@router.post("/start")
def start_assessment(
    assessment_type: str = Query(default="pre", pattern="^(pre|post)$"),
    current_user=Depends(
        get_current_user
    ),
):
    """
    Prepare exactly:

        6 dimensions × 5 questions = 30 questions
    """

    try:

        user_id = _get_user_id(
            current_user
        )

        logger.info(
            "Starting %s-assessment for user: %s",
            assessment_type,
            user_id,
        )

        # ----------------------------------------------------
        # Initialize question storage.
        # ----------------------------------------------------

        questions_by_dimension = {
            dimension: []
            for dimension
            in DIMENSION_KEYS
        }

        # ----------------------------------------------------
        # RAG retrieval
        # ----------------------------------------------------

        rag_available = False

        try:

            rag_available = (
                is_rag_available()
            )

        except Exception as exc:

            logger.warning(
                "Could not check RAG availability: %s",
                exc,
            )

        logger.info(
            "RAG available: %s",
            rag_available,
        )

        if rag_available:

            for dimension in DIMENSION_KEYS:

                try:

                    retrieved = (
                        retrieve_questions(
                            dimension,
                            QUESTIONS_PER_DIMENSION,
                        )
                    )

                    if not retrieved:
                        retrieved = []

                    logger.info(
                        "RAG retrieved %s questions for %s",
                        len(retrieved),
                        dimension,
                    )

                    for question in retrieved:

                        if not isinstance(
                            question,
                            dict,
                        ):
                            continue

                        cleaned = _clean_question(
                            question
                        )

                        if not cleaned.get(
                            "question"
                        ):
                            continue

                        # ------------------------------------------------
                        # MCQ dimensions
                        # ------------------------------------------------

                        if dimension != "pratyaksha":

                            if not _has_usable_options(
                                cleaned
                            ):
                                continue

                        # ------------------------------------------------
                        # Pratyaksha
                        # ------------------------------------------------

                        else:

                            if not _has_usable_open_answer(
                                cleaned
                            ):
                                continue

                        cleaned[
                            "reasoning_category"
                        ] = dimension

                        if (
                            dimension
                            == "pratyaksha"
                        ):

                            cleaned[
                                "question_type"
                            ] = (
                                "visual_open_ended"
                            )

                        else:

                            cleaned[
                                "question_type"
                            ] = "mcq"

                        questions_by_dimension[
                            dimension
                        ].append(
                            cleaned
                        )

                except Exception as exc:

                    logger.exception(
                        "RAG retrieval failed for %s: %s",
                        dimension,
                        exc,
                    )

        # ----------------------------------------------------
        # Deduplicate RAG questions
        # ----------------------------------------------------

        for dimension in DIMENSION_KEYS:

            questions_by_dimension[
                dimension
            ] = _deduplicate_questions(
                questions_by_dimension[
                    dimension
                ],
                dimension,
            )

        # ----------------------------------------------------
        # Demo fallback
        # ----------------------------------------------------

        try:

            fallback_questions = (
                build_demo_assessment(
                    per_dimension=(
                        QUESTIONS_PER_DIMENSION
                    )
                )
            )

        except TypeError:

            fallback_questions = (
                build_demo_assessment()
            )

        except Exception as exc:

            logger.exception(
                "Failed to create fallback questions: %s",
                exc,
            )

            fallback_questions = []

        # ----------------------------------------------------
        # Organize fallback questions
        # ----------------------------------------------------

        fallback_by_dimension = {
            dimension: []
            for dimension
            in DIMENSION_KEYS
        }

        if isinstance(
            fallback_questions,
            list,
        ):

            for question in fallback_questions:

                if not isinstance(
                    question,
                    dict,
                ):
                    continue

                cleaned = _clean_question(
                    question
                )

                dimension = (
                    cleaned.get(
                        "reasoning_category"
                    )
                    or cleaned.get(
                        "dimension"
                    )
                    or cleaned.get(
                        "skill"
                    )
                )

                if dimension in (
                    fallback_by_dimension
                ):

                    fallback_by_dimension[
                        dimension
                    ].append(
                        cleaned
                    )

        elif isinstance(
            fallback_questions,
            dict,
        ):

            for dimension in DIMENSION_KEYS:

                values = (
                    fallback_questions.get(
                        dimension,
                        [],
                    )
                )

                if isinstance(
                    values,
                    list,
                ):

                    fallback_by_dimension[
                        dimension
                    ].extend(
                        values
                    )

        # ----------------------------------------------------
        # Fill missing questions
        # ----------------------------------------------------

        for dimension in DIMENSION_KEYS:

            current_questions = (
                questions_by_dimension[
                    dimension
                ]
            )

            # Keep only first five if RAG
            # already has enough.
            if len(
                current_questions
            ) >= QUESTIONS_PER_DIMENSION:

                questions_by_dimension[
                    dimension
                ] = current_questions[
                    :QUESTIONS_PER_DIMENSION
                ]

                continue

            existing_ids = {
                str(
                    _get_question_id(
                        question
                    )
                )
                for question
                in current_questions
                if _get_question_id(
                    question
                )
            }

            for fallback in (
                fallback_by_dimension.get(
                    dimension,
                    [],
                )
            ):

                if len(
                    current_questions
                ) >= QUESTIONS_PER_DIMENSION:

                    break

                cleaned = _clean_question(
                    fallback
                )

                if not cleaned.get(
                    "question"
                ):
                    continue

                if dimension != "pratyaksha":

                    if not _has_usable_options(
                        cleaned
                    ):
                        continue

                else:

                    if not _has_usable_open_answer(
                        cleaned
                    ):
                        continue

                cleaned[
                    "reasoning_category"
                ] = dimension

                question_id = (
                    _get_question_id(
                        cleaned
                    )
                )

                if not question_id:

                    question_id = (
                        f"fallback_"
                        f"{dimension}_"
                        f"{len(current_questions)}"
                    )

                    cleaned[
                        "question_id"
                    ] = question_id

                    cleaned[
                        "id"
                    ] = question_id

                question_id = str(
                    question_id
                )

                if question_id in existing_ids:
                    continue

                existing_ids.add(
                    question_id
                )

                current_questions.append(
                    cleaned
                )

            questions_by_dimension[
                dimension
            ] = _deduplicate_questions(
                current_questions,
                dimension,
            )[
                :QUESTIONS_PER_DIMENSION
            ]

        # ----------------------------------------------------
        # Validate six dimensions
        # ----------------------------------------------------

        dimension_counts = {
            dimension: len(
                questions_by_dimension[
                    dimension
                ]
            )
            for dimension
            in DIMENSION_KEYS
        }

        logger.info(
            "Assessment dimension counts: %s",
            dimension_counts,
        )

        missing = {
            dimension: count
            for dimension, count
            in dimension_counts.items()
            if count < QUESTIONS_PER_DIMENSION
        }

        if missing:

            logger.error(
                "Assessment could not be prepared. "
                "Missing questions: %s",
                missing,
            )

            raise HTTPException(
                status_code=503,
                detail={
                    "message": (
                        "Could not prepare 5 questions "
                        "for every cognitive dimension."
                    ),
                    "dimension_counts":
                        dimension_counts,
                },
            )

        # ----------------------------------------------------
        # Build final list
        # ----------------------------------------------------

        final_questions = []

        for dimension in DIMENSION_KEYS:

            for question in (
                questions_by_dimension[
                    dimension
                ][:QUESTIONS_PER_DIMENSION]
            ):

                cleaned = _clean_question(
                    question
                )

                cleaned[
                    "reasoning_category"
                ] = dimension

                if dimension == "pratyaksha":

                    cleaned[
                        "question_type"
                    ] = (
                        "visual_open_ended"
                    )

                else:

                    cleaned[
                        "question_type"
                    ] = "mcq"

                final_questions.append(
                    cleaned
                )

        # ----------------------------------------------------
        # Validate total = 30
        # ----------------------------------------------------

        if len(final_questions) != (
            EXPECTED_TOTAL_QUESTIONS
        ):

            raise HTTPException(
                status_code=503,
                detail={
                    "message":
                        "Assessment must contain exactly "
                        "30 questions.",
                    "expected":
                        EXPECTED_TOTAL_QUESTIONS,
                    "actual":
                        len(final_questions),
                    "dimension_counts":
                        dimension_counts,
                },
            )

        # ----------------------------------------------------
        # Remove correct answers before sending
        # ----------------------------------------------------

        public_questions = []

        for question in final_questions:

            try:

                public_q = public_question(
                    question
                )

                if public_q is None:
                    continue

                public_questions.append(
                    public_q
                )

            except Exception as exc:

                logger.exception(
                    "Failed to create public question %s: %s",
                    _get_question_id(
                        question
                    ),
                    exc,
                )

        # ----------------------------------------------------
        # Final validation
        # ----------------------------------------------------

        if len(public_questions) != (
            EXPECTED_TOTAL_QUESTIONS
        ):

            raise HTTPException(
                status_code=503,
                detail={
                    "message":
                        "Failed to prepare all 30 "
                        "assessment questions.",
                    "expected":
                        EXPECTED_TOTAL_QUESTIONS,
                    "actual":
                        len(public_questions),
                },
            )

        logger.info(
            "Assessment successfully prepared: %s questions",
            len(public_questions),
        )

        # ----------------------------------------------------
        # Return
        # ----------------------------------------------------

        return {
            "success": True,
            "data": {
                "assessment_type": assessment_type,
                "questions":
                    public_questions,

                "total_questions":
                    len(public_questions),

                "questions_per_dimension":
                    QUESTIONS_PER_DIMENSION,

                "dimensions":
                    len(DIMENSION_KEYS),

                "dimension_keys":
                    DIMENSION_KEYS,

                "dimension_counts":
                    dimension_counts,
            },

            # Also expose questions at root level
            # for frontend compatibility.
            "questions":
                public_questions,

            "total_questions":
                len(public_questions),
            "assessment_type": assessment_type,
        }

    except HTTPException:
        raise

    except Exception as exc:

        logger.exception(
            "Unexpected error while starting assessment: %s",
            exc,
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to start assessment.",
        )


# ============================================================
# SUBMIT PRE-ASSESSMENT
# ============================================================

@router.post("/submit")
def submit_assessment(
    request: AssessmentSubmitRequest,
    assessment_type: str = Query(default="pre", pattern="^(pre|post)$"),
    current_user=Depends(
        get_current_user
    ),
):
    """
    Submit the pre-assessment.

    The assessment will ALWAYS be saved if the submitted
    question IDs can be resolved.

    OpenAI is optional.

    If OpenAI returns 429 / insufficient quota / another
    evaluation error, deterministic answer evaluation is used
    instead.

    MongoDB stores:

        assessments
        cognitive_profiles
    """

    try:

        # ----------------------------------------------------
        # User ID
        # ----------------------------------------------------

        user_id = _get_user_id(
            current_user
        )

        logger.info(
            "Using user ID for assessment/profile: %s",
            user_id,
        )

        # ----------------------------------------------------
        # Responses
        # ----------------------------------------------------

        responses = (
            request.all_responses
        )

        if not responses:

            raise HTTPException(
                status_code=400,
                detail=(
                    "No assessment responses "
                    "were submitted."
                ),
            )

        logger.info(
            "Received %s responses from user %s",
            len(responses),
            user_id,
        )

        # ----------------------------------------------------
        # Database
        # ----------------------------------------------------

        cols = _get_collections()

        assessments_collection = (
            cols["assessments"]
        )

        profiles_collection = (
            cols["cognitive_profiles"]
        )

        # ----------------------------------------------------
        # Dimension score storage
        # ----------------------------------------------------

        dimension_results = {
            dimension: []
            for dimension
            in DIMENSION_KEYS
        }

        evaluated_responses = []

        correct_count = 0

        # ====================================================
        # PROCESS EACH RESPONSE
        # ====================================================

        for response in responses:

            # ------------------------------------------------
            # Extract response
            # ------------------------------------------------

            if isinstance(
                response,
                dict,
            ):

                question_id = (
                    response.get(
                        "question_id"
                    )
                )

                student_answer = (
                    response.get(
                        "student_answer"
                    )
                    or response.get(
                        "answer"
                    )
                    or response.get(
                        "selected_answer"
                    )
                    or ""
                )

            else:

                question_id = getattr(
                    response,
                    "question_id",
                    None,
                )

                student_answer = (
                    getattr(
                        response,
                        "student_answer",
                        None,
                    )
                    or getattr(
                        response,
                        "answer",
                        None,
                    )
                    or getattr(
                        response,
                        "selected_answer",
                        None,
                    )
                    or ""
                )

            if not question_id:

                logger.warning(
                    "Response without question_id "
                    "was ignored."
                )

                continue

            question_id = str(
                question_id
            )

            # ------------------------------------------------
            # Find question in ChromaDB
            # ------------------------------------------------

            question = None

            try:

                question = (
                    get_question_by_id_from_rag(
                        question_id
                    )
                )

            except Exception as exc:

                logger.warning(
                    "RAG question lookup failed for %s: %s",
                    question_id,
                    exc,
                )

            # ------------------------------------------------
            # Local question fallback
            # ------------------------------------------------

            if not question:

                try:

                    question = (
                        get_question_by_id(
                            question_id
                        )
                    )

                except Exception as exc:

                    logger.warning(
                        "Local question lookup failed "
                        "for %s: %s",
                        question_id,
                        exc,
                    )

            # ------------------------------------------------
            # Question not found
            # ------------------------------------------------

            if not question:

                logger.warning(
                    "Question not found during submission: %s",
                    question_id,
                )

                continue

            # ------------------------------------------------
            # Clean question
            # ------------------------------------------------

            question = _clean_question(
                question
            )

            question_text = (
                question.get(
                    "question",
                    "",
                )
            )

            options = (
                question.get(
                    "options",
                    [],
                )
            )

            correct_answer = (
                question.get(
                    "correct_answer"
                )
                or question.get(
                    "answer"
                )
                or question.get(
                    "label"
                )
                or ""
            )

            dimension = (
                question.get(
                    "reasoning_category"
                )
                or question.get(
                    "dimension"
                )
                or question.get(
                    "skill"
                )
                or "anumana"
            )

            dimension = str(
                dimension
            ).strip().lower()

            if dimension not in DIMENSION_KEYS:

                logger.warning(
                    "Unknown dimension '%s' for question %s. "
                    "Using anumana.",
                    dimension,
                    question_id,
                )

                dimension = "anumana"

            difficulty = (
                question.get(
                    "difficulty"
                )
                or "medium"
            )

            # =================================================
            # OBJECTIVE CORRECTNESS
            # =================================================

            is_correct = _answers_match(
                student_answer,
                correct_answer,
                options,
            )

            if is_correct:
                correct_count += 1

            # =================================================
            # OPTIONAL AI EVALUATION
            # =================================================

            ai_feedback = ""

            reasoning_quality_score = 0.0
            relevance_score = 0.0
            understanding_score = 0.0

            try:

                evaluation = evaluate_answer(
                    dimension=dimension,
                    question=question_text,
                    options=options,
                    correct_answer=correct_answer,
                    student_answer=str(
                        student_answer
                    ),
                )

                # IMPORTANT:
                # Correctness is controlled by objective
                # answer matching, not by the LLM.

                ai_feedback = str(
                    getattr(
                        evaluation,
                        "feedback",
                        "",
                    )
                    or ""
                )

                reasoning_quality_score = float(
                    getattr(
                        evaluation,
                        "reasoning_quality_score",
                        0.0,
                    )
                    or 0.0
                )

                relevance_score = float(
                    getattr(
                        evaluation,
                        "relevance_score",
                        0.0,
                    )
                    or 0.0
                )

                understanding_score = float(
                    getattr(
                        evaluation,
                        "understanding_score",
                        0.0,
                    )
                    or 0.0
                )

            except Exception as exc:

                # ------------------------------------------------
                # OpenAI 429 / quota / API error MUST NOT
                # prevent assessment submission.
                # ------------------------------------------------

                logger.warning(
                    "AI evaluation unavailable for question %s. "
                    "Using deterministic fallback. Error: %s",
                    question_id,
                    exc,
                )

                if is_correct:

                    reasoning_quality_score = 70.0
                    relevance_score = 75.0
                    understanding_score = 72.0

                    ai_feedback = (
                        "Correct answer. "
                        "Evaluation completed using the "
                        "stored assessment answer."
                    )

                else:

                    reasoning_quality_score = 35.0
                    relevance_score = 40.0
                    understanding_score = 30.0

                    ai_feedback = (
                        "The answer does not match the "
                        "stored correct answer."
                    )

            # =================================================
            # RESPONSE SCORE
            # =================================================

            # Correctness is weighted 60%.
            # Other cognitive dimensions are supplied by
            # AI when available and deterministic fallback
            # values otherwise.

            correctness_score = (
                100.0
                if is_correct
                else 0.0
            )

            response_score = round(
                (
                    0.60
                    * correctness_score
                )
                + (
                    0.20
                    * reasoning_quality_score
                )
                + (
                    0.10
                    * relevance_score
                )
                + (
                    0.10
                    * understanding_score
                ),
                2,
            )

            # ------------------------------------------------
            # Add to dimension
            # ------------------------------------------------

            dimension_results[
                dimension
            ].append(
                response_score
            )

            # ------------------------------------------------
            # Save response details
            # ------------------------------------------------

            evaluated_responses.append(
                {
                    "question_id":
                        question_id,

                    "student_answer":
                        str(
                            student_answer
                        ),

                    "correct_answer":
                        str(
                            correct_answer
                        ),

                    "correct":
                        bool(
                            is_correct
                        ),

                    "reasoning_category":
                        dimension,

                    "difficulty":
                        difficulty,

                    "question_type":
                        question.get(
                            "question_type",
                            "mcq",
                        ),

                    "dataset":
                        question.get(
                            "dataset",
                            "",
                        ),

                    "source":
                        question.get(
                            "source",
                            "",
                        ),

                    "correctness_score":
                        correctness_score,

                    "reasoning_quality_score":
                        round(
                            reasoning_quality_score,
                            2,
                        ),

                    "relevance_score":
                        round(
                            relevance_score,
                            2,
                        ),

                    "understanding_score":
                        round(
                            understanding_score,
                            2,
                        ),

                    "score":
                        response_score,

                    "feedback":
                        ai_feedback,
                }
            )

        # ====================================================
        # VALIDATION
        # ====================================================

        if not evaluated_responses:

            raise HTTPException(
                status_code=400,
                detail=(
                    "None of the submitted questions "
                    "could be evaluated."
                ),
            )

        # ====================================================
        # SKILL SCORES
        # ====================================================

        skill_scores = (
            _calculate_skill_scores(
                dimension_results
            )
        )

        # ====================================================
        # OVERALL SCORE
        # ====================================================

        overall_score = (
            _calculate_overall_score(
                skill_scores
            )
        )

        # ====================================================
        # LEVEL
        # ====================================================

        skill_level = (
            _get_skill_level(
                overall_score
            )
        )

        # ====================================================
        # STRONGEST / WEAKEST
        # ====================================================

        strongest_skill = (
            _get_strongest_skill(
                skill_scores
            )
        )

        weakest_skill = (
            _get_weakest_skill(
                skill_scores
            )
        )

        # ====================================================
        # TIMESTAMP
        # ====================================================

        now = datetime.now(
            timezone.utc
        )

        # ====================================================
        # ASSESSMENT DOCUMENT
        # ====================================================

        assessment_document = {

            "user_id":
                user_id,

            "type":
                assessment_type,

            "responses":
                evaluated_responses,

            "total_questions":
                len(
                    evaluated_responses
                ),

            "correct_answers":
                correct_count,

            "overall_score":
                overall_score,

            "skill_level":
                skill_level,

            "skill_scores":
                skill_scores,

            # Compatibility with older frontend.
            "scores":
                skill_scores,

            "strongest_skill":
                strongest_skill,

            "weakest_skill":
                weakest_skill,

            "created_at":
                now,

            "updated_at":
                now,
        }

        # ====================================================
        # SAVE ASSESSMENT
        # ====================================================

        try:

            insert_result = (
                assessments_collection.insert_one(
                    assessment_document
                )
            )

            logger.info(
                "%s-assessment saved successfully "
                "for user: %s | id=%s",
                assessment_type.capitalize(),
                user_id,
                insert_result.inserted_id,
            )

        except Exception as exc:

            logger.exception(
                "Failed to save assessment for user %s: %s",
                user_id,
                exc,
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Assessment could not be saved."
                ),
            )

        # ====================================================
        # COGNITIVE PROFILE
        # ====================================================

        profile_document = {

            "user_id":
                user_id,

            "has_profile":
                True,

            "profile_ready":
                True,

            "overall_score":
                overall_score,

            "skill_level":
                skill_level,

            "skill_scores":
                skill_scores,

            # Compatibility field.
            "scores":
                skill_scores,

            "strongest_skill":
                strongest_skill,

            "weakest_skill":
                weakest_skill,

            "summary":
                _create_profile_summary(
                    overall_score,
                    skill_level,
                    strongest_skill,
                    weakest_skill,
                ),

            "dimensions": {
                dimension: {
                    "score":
                        skill_scores.get(
                            dimension,
                            0.0,
                        ),

                    "level":
                        _get_skill_level(
                            skill_scores.get(
                                dimension,
                                0.0,
                            )
                        ),
                }
                for dimension
                in DIMENSION_KEYS
            },

            "created_at":
                now,

            "updated_at":
                now,
        }

        # ====================================================
        # SAVE / UPDATE PROFILE
        # ====================================================

        try:

            profile_update = dict(profile_document)
            profile_update.pop("created_at", None)

            profiles_collection.update_one(
                {
                    "user_id":
                        user_id,
                },
                {
                    "$set":
                        profile_update,

                    "$setOnInsert": {
                        "created_at":
                            now,
                    },
                },
                upsert=True,
            )

            logger.info(
                "Cognitive profile updated successfully "
                "for user: %s",
                user_id,
            )

        except Exception as exc:

            logger.exception(
                "Failed to save cognitive profile "
                "for user %s: %s",
                user_id,
                exc,
            )

            # Assessment is already saved.
            # Report this separately.
            raise HTTPException(
                status_code=500,
                detail=(
                    "Assessment was saved, but the "
                    "cognitive profile could not be created."
                ),
            )

        # ====================================================
        # RETURN RESULT
        # ====================================================

        return {

            "success":
                True,

            "message":
                f"{assessment_type.capitalize()}-assessment completed successfully.",

            "data": {

                "assessment_type":
                    assessment_type,

                "total_questions":
                    len(
                        evaluated_responses
                    ),

                "correct_answers":
                    correct_count,

                "overall_score":
                    overall_score,

                "skill_level":
                    skill_level,

                "skill_scores":
                    skill_scores,

                "scores":
                    skill_scores,

                "strongest_skill":
                    strongest_skill,

                "weakest_skill":
                    weakest_skill,

                "cognitive_profile":
                    profile_document,

                "profile_ready":
                    True,

                "has_profile":
                    True,
            },

            # Root-level compatibility.
            "overall_score":
                overall_score,

            "skill_scores":
                skill_scores,

            "profile_ready":
                True,

            "has_profile":
                True,
        }

    except HTTPException:
        raise

    except Exception as exc:

        logger.exception(
            "Assessment submission failed for user %s: %s",
            (
                locals().get(
                    "user_id",
                    "unknown",
                )
            ),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to submit assessment."
            ),
        )