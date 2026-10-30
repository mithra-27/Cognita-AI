"""Training routes: generate adaptive question, submit answer."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import collections
from models import TrainingGenerateRequest, TrainingSubmitRequest
from questions import (
    valid_skill,
    build_demo_training,
    public_question,
    next_difficulty,
    difficulty_for_score,
    get_question_by_id,
    COGNITIVE_DIMENSIONS,
    dimension_display,
)
from scoring import calculate_response_score
from services.ai import evaluate_answer, generate_training_question
from services.rag import (
    is_rag_available,
    retrieve_context,
    retrieve_questions,
)

logger = logging.getLogger("cognita.training")

router = APIRouter(
    prefix="/api/training",
    tags=["training"],
)


def _success(data) -> dict:
    """Return a standard successful API response."""
    return {
        "success": True,
        "data": data,
    }


def _get_user_id(current_user: dict) -> str:
    """
    Convert the authenticated user's ID to a string.

    Cognitive profiles and training progress use string user IDs
    consistently across the application.
    """
    return str(current_user["_id"])


def _get_profile_skill_score(
    cols,
    user_id: str,
    skill: str,
) -> float | None:
    """Get the user's official cognitive profile score for a skill."""

    profile = cols["cognitive_profiles"].find_one(
        {"user_id": user_id}
    )

    if not profile:
        return None

    if not profile.get("has_profile"):
        return None

    scores = profile.get("scores", {})

    value = scores.get(skill)

    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _get_training_score(
    cols,
    user_id: str,
    skill: str,
) -> float | None:
    """Get the user's previous training score for a skill."""

    doc = cols["training_progress"].find_one(
        {
            "user_id": user_id,
            "skill": skill,
        }
    )

    if not doc:
        return None

    value = doc.get("score")

    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@router.post("/generate")
def generate_training(
    req: TrainingGenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate an adaptive training question.

    Priority:
    1. RAG-retrieved question
    2. AI-generated question
    3. Demo fallback question

    The correct answer is never sent to the frontend.
    """

    cols = collections()

    if not cols:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )

    # ---------------------------------------------------------
    # Normalize authenticated user ID
    # ---------------------------------------------------------

    user_id = _get_user_id(current_user)

    # ---------------------------------------------------------
    # Validate skill
    # ---------------------------------------------------------

    if not valid_skill(req.skill):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid skill: {req.skill}. "
                f"Must be one of {list(COGNITIVE_DIMENSIONS.keys())}."
            ),
        )

    # ---------------------------------------------------------
    # Require completed cognitive assessment
    # ---------------------------------------------------------

    profile = cols["cognitive_profiles"].find_one(
        {"user_id": user_id}
    )

    if not profile or not profile.get("has_profile"):
        raise HTTPException(
            status_code=403,
            detail=(
                "Complete the cognitive assessment "
                "before starting adaptive training."
            ),
        )

    # ---------------------------------------------------------
    # Determine difficulty
    # ---------------------------------------------------------

    difficulty = req.difficulty

    if not difficulty:
        profile_score = _get_profile_skill_score(
            cols,
            user_id,
            req.skill,
        )

        training_score = _get_training_score(
            cols,
            user_id,
            req.skill,
        )

        # Prefer previous training performance if available.
        # Otherwise use the official cognitive profile score.
        base = (
            training_score
            if training_score is not None
            else (profile_score if profile_score is not None else 0)
        )

        difficulty = difficulty_for_score(base)

    # ---------------------------------------------------------
    # Generate question
    # ---------------------------------------------------------

    question = None

    # =========================================================
    # 1. Try RAG retrieval
    # =========================================================

    if is_rag_available():
        try:
            rag_qs = retrieve_questions(
                req.skill,
                n_results=3,
            )

            if rag_qs:
                import random

                question = random.choice(rag_qs)

                logger.info(
                    "Training question retrieved from RAG: "
                    "user=%s skill=%s",
                    user_id,
                    req.skill,
                )

        except Exception as exc:
            logger.warning(
                "RAG training retrieval failed for skill=%s: %s",
                req.skill,
                exc,
            )

    # =========================================================
    # 2. Try AI generation
    # =========================================================

    if not question:
        try:
            context = retrieve_context(
                req.skill,
                COGNITIVE_DIMENSIONS[req.skill]["skill"],
            )

            question = generate_training_question(
                req.skill,
                difficulty,
                context,
            )

            if question:
                logger.info(
                    "Training question generated by AI: "
                    "user=%s skill=%s difficulty=%s",
                    user_id,
                    req.skill,
                    difficulty,
                )

        except Exception as exc:
            logger.warning(
                "AI training question generation failed: %s",
                exc,
            )

    # =========================================================
    # 3. Demo fallback
    # =========================================================

    if not question:
        question = build_demo_training(
            req.skill,
            difficulty,
        )

        if question:
            logger.info(
                "Using demo training question: "
                "user=%s skill=%s difficulty=%s",
                user_id,
                req.skill,
                difficulty,
            )

    # ---------------------------------------------------------
    # No question available
    # ---------------------------------------------------------

    if not question:
        raise HTTPException(
            status_code=504,
            detail=(
                "No training questions available "
                "for this skill."
            ),
        )

    # ---------------------------------------------------------
    # Ensure requested difficulty is reflected
    # ---------------------------------------------------------

    question["difficulty"] = difficulty

    # ---------------------------------------------------------
    # Prepare public question
    # ---------------------------------------------------------
    #
    # public_question() removes sensitive fields such as
    # correct_answer before sending the question to React.
    #
    # The complete question is stored server-side temporarily
    # for answer verification.
    # ---------------------------------------------------------

    pub = public_question(question)

    # ---------------------------------------------------------
    # Store pending question
    # ---------------------------------------------------------
    #
    # The correct answer remains in MongoDB temporarily and is
    # never trusted from the frontend.
    # ---------------------------------------------------------

    cols["training_progress"].update_one(
        {
            "user_id": user_id,
            "skill": "__pending__",
        },
        {
            "$set": {
                "user_id": user_id,
                "skill": "__pending__",
                "pending_question": question,
                "updated_at": datetime.now(
                    timezone.utc
                ).isoformat(),
            }
        },
        upsert=True,
    )

    logger.info(
        "Pending training question stored: "
        "user=%s skill=%s question_id=%s",
        user_id,
        req.skill,
        question.get("question_id"),
    )

    return _success(pub)


@router.post("/submit")
def submit_training(
    req: TrainingSubmitRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Evaluate a training answer and update training progress.

    The correct answer is obtained from the server-side question
    cache or the local question repository. It is never accepted
    from the frontend.
    """

    cols = collections()

    if not cols:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )

    # ---------------------------------------------------------
    # Normalize authenticated user ID
    # ---------------------------------------------------------

    user_id = _get_user_id(current_user)

    # ---------------------------------------------------------
    # Validate skill
    # ---------------------------------------------------------

    if not valid_skill(req.skill):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid skill: {req.skill}.",
        )

    # ---------------------------------------------------------
    # Retrieve original question
    # ---------------------------------------------------------

    question = None

    # =========================================================
    # 1. Try pending question cache
    # =========================================================

    pending = cols["training_progress"].find_one(
        {
            "user_id": user_id,
            "skill": "__pending__",
        }
    )

    if pending and pending.get("pending_question"):
        pending_question = pending["pending_question"]

        if (
            pending_question.get("question_id")
            == req.question_id
        ):
            question = pending_question

    # =========================================================
    # 2. Fallback to local question lookup
    # =========================================================

    if not question:
        question = get_question_by_id(
            req.question_id
        )

    # ---------------------------------------------------------
    # Question not found
    # ---------------------------------------------------------

    if not question:
        raise HTTPException(
            status_code=404,
            detail=(
                "Training question not found or expired. "
                "Please generate a new question."
            ),
        )

    # ---------------------------------------------------------
    # Extract question information
    # ---------------------------------------------------------

    correct_answer = question.get(
        "correct_answer",
        "",
    )

    options = question.get(
        "options",
        [],
    )

    difficulty = (
        req.difficulty
        or question.get(
            "difficulty",
            "beginner",
        )
    )

    # ---------------------------------------------------------
    # Retrieve supporting context
    # ---------------------------------------------------------

    try:
        context = retrieve_context(
            req.skill,
            question.get(
                "question",
                "",
            ),
        )
    except Exception as exc:
        logger.warning(
            "Context retrieval failed during training "
            "evaluation: %s",
            exc,
        )
        context = ""

    # ---------------------------------------------------------
    # Evaluate answer
    # ---------------------------------------------------------

    evaluation = evaluate_answer(
        dimension=req.skill,
        question=question.get(
            "question",
            "",
        ),
        options=options,
        correct_answer=correct_answer,
        student_answer=req.student_answer,
        context=context,
    )

    # ---------------------------------------------------------
    # Calculate final response score
    # ---------------------------------------------------------

    score = calculate_response_score(
        evaluation
    )

    # ---------------------------------------------------------
    # Update training progress
    # ---------------------------------------------------------

    _update_training_progress(
        cols=cols,
        user_id=user_id,
        skill=req.skill,
        difficulty=difficulty,
        correct=evaluation.correct,
        score=score,
    )

    # ---------------------------------------------------------
    # Determine next difficulty
    # ---------------------------------------------------------

    next_diff = next_difficulty(
        difficulty,
        score,
    )

    # ---------------------------------------------------------
    # Build feedback
    # ---------------------------------------------------------

    feedback = evaluation.feedback

    reasoning_feedback = (
        f"Your reasoning quality was rated "
        f"{evaluation.reasoning_quality_score:.0f}/100, "
        f"relevance "
        f"{evaluation.relevance_score:.0f}/100, "
        f"and understanding "
        f"{evaluation.understanding_score:.0f}/100."
    )

    if evaluation.correct:
        suggested = (
            "Good reasoning. Try the next question "
            "at a higher difficulty to push your limits."
        )
    else:
        suggested = (
            f"Focus on "
            f"{dimension_display(req.skill)}: "
            f"{COGNITIVE_DIMENSIONS[req.skill]['skill']}. "
            "Review the underlying concept and try again."
        )

    # ---------------------------------------------------------
    # Clear pending question
    # ---------------------------------------------------------

    cols["training_progress"].delete_one(
        {
            "user_id": user_id,
            "skill": "__pending__",
        }
    )

    logger.info(
        "Training answer submitted: "
        "user=%s skill=%s score=%s correct=%s next=%s",
        user_id,
        req.skill,
        score,
        evaluation.correct,
        next_diff,
    )

    # ---------------------------------------------------------
    # Return result
    # ---------------------------------------------------------

    return _success(
        {
            "correct": evaluation.correct,
            "score": score,
            "feedback": feedback,
            "reasoning_feedback": reasoning_feedback,
            "suggested_improvement": suggested,
            "next_difficulty": next_diff,
        }
    )


def _update_training_progress(
    cols,
    user_id: str,
    skill: str,
    difficulty: str,
    correct: bool,
    score: float,
):
    """
    Update per-skill training progress document.

    Training progress is intentionally kept separate from the
    official cognitive assessment scores.
    """

    existing = cols["training_progress"].find_one(
        {
            "user_id": user_id,
            "skill": skill,
        }
    )

    now = datetime.now(
        timezone.utc
    ).isoformat()

    # =========================================================
    # Existing training record
    # =========================================================

    if existing:
        attempted = (
            existing.get(
                "questions_attempted",
                0,
            )
            + 1
        )

        correct_count = (
            existing.get(
                "correct_answers",
                0,
            )
            + (1 if correct else 0)
        )

        # Running average of training response scores.
        prev_score = existing.get(
            "score",
            0,
        )

        prev_count = existing.get(
            "questions_attempted",
            0,
        )

        new_score = round(
            (
                (prev_score * prev_count)
                + score
            )
            / max(1, attempted),
            2,
        )

        cols["training_progress"].update_one(
            {
                "user_id": user_id,
                "skill": skill,
            },
            {
                "$set": {
                    "difficulty": difficulty,
                    "questions_attempted": attempted,
                    "correct_answers": correct_count,
                    "score": new_score,
                    "updated_at": now,
                    "last_activity_at": now,
                },
                "$addToSet": {
                    "activity_dates": now[:10],
                }
            },
        )

    # =========================================================
    # First training attempt for this skill
    # =========================================================

    else:
        cols["training_progress"].insert_one(
            {
                "user_id": user_id,
                "skill": skill,
                "difficulty": difficulty,
                "questions_attempted": 1,
                "correct_answers": (
                    1 if correct else 0
                ),
                "score": round(score, 2),
                "updated_at": now,
                "created_at": now,
                "last_activity_at": now,
                "activity_dates": [now[:10]],
            }
        )