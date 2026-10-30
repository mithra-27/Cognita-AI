"""
Progress routes:
- Cognitive profile
- Overall progress
- Pre-assessment status
- Post-assessment
- Multiple post-assessment attempts
- Assessment history
- Improvement tracking
- Assessment reports
- Assessment review
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import collections
from models import AssessmentSubmitRequest

from questions import (
    DIMENSION_KEYS,
    get_question_by_id,
)

from scoring import (
    calculate_response_score,
    calculate_skill_scores,
    calculate_overall_score,
    get_skill_level,
    get_strongest_skill,
    get_weakest_skill,
    get_improvement,
)

from services.ai import (
    evaluate_answer,
    generate_profile_summary,
)

from services.rag import (
    retrieve_context,
    get_question_by_id_from_rag,
)


logger = logging.getLogger("cognita.progress")

router = APIRouter(
    prefix="/api",
    tags=["progress"],
)


# ============================================================
# HELPERS
# ============================================================

def _success(data):
    return {
        "success": True,
        "data": data,
    }


def _get_user_id(current_user):
    """
    Always convert the authenticated user ID to string.

    Assessment/profile documents use string user IDs.
    This prevents ObjectId vs string mismatches in MongoDB.
    """

    if isinstance(current_user, dict):

        user_id = (
            current_user.get("_id")
            or current_user.get("id")
            or current_user.get("user_id")
        )

    else:

        user_id = current_user

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="User ID not found.",
        )

    return str(user_id)


def _safe_iso_datetime(value):
    """
    Convert MongoDB datetime values to ISO strings.

    Keeps compatibility with existing records that may
    already contain strings.
    """

    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def _safe_float(value, default=0.0):
    """
    Safely convert a value to float.
    """

    try:
        return float(value or 0)

    except (TypeError, ValueError):
        return default


# ============================================================
# QUESTION LOOKUP
# ============================================================

def _get_question_for_report(question_id):
    """
    Retrieve the original question for an assessment report.

    IMPORTANT:
    Assessment questions are primarily sourced from the
    persistent ChromaDB/RAG collection.

    Therefore this function tries RAG/ChromaDB first and
    falls back to the legacy/local question lookup.

    This fixes cases where the assessment response contains
    student_answer/correct_answer but the report cannot find
    the original question text.
    """

    if not question_id:
        return None

    question_id = str(
        question_id
    ).strip()

    if not question_id:
        return None

    # ========================================================
    # 1. RAG / ChromaDB lookup
    # ========================================================

    try:

        question = get_question_by_id_from_rag(
            question_id
        )

        if question:

            logger.info(
                "Report question retrieved from RAG | "
                "question_id=%s",
                question_id,
            )

            return question

    except Exception as exc:

        logger.warning(
            "RAG question lookup failed for report | "
            "question_id=%s | error=%s",
            question_id,
            exc,
        )

    # ========================================================
    # 2. Legacy/local question lookup
    # ========================================================

    try:

        question = get_question_by_id(
            question_id
        )

        if question:

            logger.info(
                "Report question retrieved from local lookup | "
                "question_id=%s",
                question_id,
            )

            return question

    except Exception as exc:

        logger.warning(
            "Local question lookup failed for report | "
            "question_id=%s | error=%s",
            question_id,
            exc,
        )

    # ========================================================
    # 3. Nothing found
    # ========================================================

    logger.warning(
        "Question not found for assessment report | "
        "question_id=%s",
        question_id,
    )

    return None


# ============================================================
# BUILD REPORT RESPONSE
# ============================================================

def _build_report_response(response):
    """
    Convert a stored assessment response into a complete
    report-ready question/answer object.

    Existing assessment records may contain:

        question_id
        question
        options
        student_answer
        correct_answer
        correct
        score
        feedback
        difficulty
        skill
        image

    Older records may not contain the original question
    information. In that case the question is reconstructed
    using the question_id from RAG/ChromaDB first.
    """

    if not isinstance(response, dict):
        return None

    # ========================================================
    # QUESTION ID
    # ========================================================

    question_id = str(
        response.get(
            "question_id",
            "",
        )
        or ""
    ).strip()

    # ========================================================
    # RETRIEVE ORIGINAL QUESTION
    # ========================================================

    question = _get_question_for_report(
        question_id
    )

    # ========================================================
    # STORED RESPONSE INFORMATION
    # ========================================================

    question_text = response.get(
        "question",
        "",
    )

    correct_answer = response.get(
        "correct_answer",
        "",
    )

    options = response.get(
        "options",
        [],
    )

    skill = response.get(
        "skill"
    )

    difficulty = response.get(
        "difficulty",
        "beginner",
    )

    image = response.get(
        "image"
    )

    # ========================================================
    # RECOVER ORIGINAL QUESTION INFORMATION
    # ========================================================

    if question:

        # Question text
        if not question_text:

            question_text = question.get(
                "question",
                question.get(
                    "question_text",
                    "",
                ),
            )

        # Correct answer
        if not correct_answer:

            correct_answer = question.get(
                "correct_answer",
                question.get(
                    "answer",
                    "",
                ),
            )

        # Options
        if not options:

            options = question.get(
                "options",
                [],
            )

        # Skill
        if not skill:

            skill = (
                question.get(
                    "reasoning_category"
                )
                or question.get(
                    "skill"
                )
            )

        # Difficulty
        if not difficulty:

            difficulty = question.get(
                "difficulty",
                "beginner",
            )

        # Image
        if not image:

            image = (
                question.get(
                    "image"
                )
                or question.get(
                    "image_name"
                )
            )

    # ========================================================
    # NORMALIZE OPTIONS
    # ========================================================

    if not isinstance(options, list):
        options = []

    # ========================================================
    # NORMALIZE TEXT VALUES
    # ========================================================

    if question_text is None:
        question_text = ""

    if correct_answer is None:
        correct_answer = ""

    if skill is not None:
        skill = str(skill).strip().lower()

    # ========================================================
    # RETURN REPORT-READY OBJECT
    # ========================================================

    return {

        "question_id":
            question_id,

        "question":
            question_text,

        "options":
            options,

        "student_answer":
            response.get(
                "student_answer",
                "",
            ),

        "correct_answer":
            correct_answer,

        "correct":
            bool(
                response.get(
                    "correct",
                    False,
                )
            ),

        "score":
            _safe_float(
                response.get(
                    "score",
                    0,
                )
            ),

        "feedback":
            response.get(
                "feedback",
                "",
            ),

        "difficulty":
            difficulty,

        "skill":
            skill,

        "image":
            image,
    }


# ============================================================
# BUILD COMPLETE REPORT
# ============================================================

def _build_report(
    assessment,
    fallback_attempt=None,
):
    """
    Build the complete report for one assessment attempt.

    This function is read-only.
    It does not modify MongoDB.
    """

    if not assessment:
        return None

    # ========================================================
    # ATTEMPT
    # ========================================================

    attempt = assessment.get(
        "attempt",
        fallback_attempt,
    )

    # ========================================================
    # RESPONSES
    # ========================================================

    responses = assessment.get(
        "responses",
        [],
    )

    if not isinstance(responses, list):
        responses = []

    report_responses = []

    for response in responses:

        report_response = _build_report_response(
            response
        )

        if report_response is not None:

            report_responses.append(
                report_response
            )

    # ========================================================
    # SKILL SCORES
    # ========================================================

    skill_scores = (
        assessment.get(
            "skill_scores"
        )
        or assessment.get(
            "scores"
        )
        or {}
    )

    # ========================================================
    # OVERALL SCORE
    # ========================================================

    overall_score = _safe_float(
        assessment.get(
            "overall_score",
            0,
        )
    )

    # ========================================================
    # QUESTION COUNTS
    # ========================================================

    correct_count = sum(
        1
        for response in report_responses
        if response.get("correct")
    )

    incorrect_count = (
        len(report_responses)
        - correct_count
    )

    # ========================================================
    # AVERAGE RESPONSE SCORE
    # ========================================================

    if report_responses:

        average_response_score = (
            sum(
                response.get(
                    "score",
                    0,
                )
                for response in report_responses
            )
            / len(report_responses)
        )

    else:

        average_response_score = 0.0

    # ========================================================
    # RETURN COMPLETE REPORT
    # ========================================================

    return {

        # ----------------------------------------------------
        # Attempt
        # ----------------------------------------------------

        "attempt":
            attempt,

        "type":
            assessment.get(
                "type",
                "post",
            ),

        "created_at":
            _safe_iso_datetime(
                assessment.get(
                    "created_at"
                )
            ),

        # ----------------------------------------------------
        # Overall result
        # ----------------------------------------------------

        "overall_score":
            overall_score,

        "skill_level":
            assessment.get(
                "skill_level",
                "Beginner",
            ),

        "strongest_skill":
            assessment.get(
                "strongest_skill"
            ),

        "weakest_skill":
            assessment.get(
                "weakest_skill"
            ),

        # ----------------------------------------------------
        # Skill scores
        # ----------------------------------------------------

        "skill_scores":
            skill_scores,

        "scores":
            skill_scores,

        # ----------------------------------------------------
        # Question statistics
        # ----------------------------------------------------

        "total_questions":
            assessment.get(
                "total_questions",
                len(report_responses),
            ),

        "questions_answered":
            len(report_responses),

        "correct_count":
            correct_count,

        "incorrect_count":
            incorrect_count,

        "average_response_score":
            round(
                average_response_score,
                2,
            ),

        # ----------------------------------------------------
        # Detailed questions
        # ----------------------------------------------------

        "responses":
            report_responses,
    }


# ============================================================
# COGNITIVE PROFILE
# ============================================================

@router.get("/profile")
def get_profile(
    current_user=Depends(get_current_user),
):
    """
    Return the current user's cognitive profile.

    The profile is created after the pre-assessment
    and updated after subsequent post-assessments.
    """

    try:

        cols = collections()

        if not cols:

            raise HTTPException(
                status_code=503,
                detail="Database is unavailable.",
            )

        user_id = _get_user_id(
            current_user
        )

        logger.info(
            "Loading cognitive profile for user: %s",
            user_id,
        )

        profile = cols[
            "cognitive_profiles"
        ].find_one(
            {
                "user_id": user_id,
            }
        )

        # ====================================================
        # NO PROFILE
        # ====================================================

        if not profile:

            logger.info(
                "No cognitive profile found for user: %s",
                user_id,
            )

            return _success({

                "has_profile": False,

                "scores": {},

                "skill_scores": {},

                "overall_score": 0,

                "strongest_skill": None,

                "weakest_skill": None,

                "skill_level": "Beginner",

                "summary": "",
            })

        # ====================================================
        # SCORES
        # ====================================================

        scores = (
            profile.get(
                "skill_scores"
            )
            or profile.get(
                "scores"
            )
            or {}
        )

        has_profile = profile.get(
            "has_profile",
            bool(scores),
        )

        logger.info(
            "Cognitive profile found for user: %s | "
            "has_profile=%s | score=%s",
            user_id,
            has_profile,
            profile.get(
                "overall_score",
                0,
            ),
        )

        return _success({

            "has_profile":
                bool(has_profile),

            "scores":
                scores,

            "skill_scores":
                scores,

            "overall_score":
                profile.get(
                    "overall_score",
                    0,
                ),

            "strongest_skill":
                profile.get(
                    "strongest_skill",
                ),

            "weakest_skill":
                profile.get(
                    "weakest_skill",
                ),

            "skill_level":
                profile.get(
                    "skill_level",
                    "Beginner",
                ),

            "summary":
                profile.get(
                    "summary",
                    "",
                ),
        })

    except HTTPException:
        raise

    except Exception as exc:

        logger.exception(
            "Failed to load cognitive profile: %s",
            exc,
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to load cognitive profile.",
        )


# ============================================================
# PERSONAL PROFILE STREAK + JOURNEY HELPERS
# ============================================================

def _activity_date(value):
    """Return an ISO calendar date (YYYY-MM-DD) from a stored timestamp."""
    if not value:
        return None

    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).date().isoformat()

    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).date().isoformat()
        except ValueError:
            # A stored YYYY-MM-DD value is already usable.
            if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
                return raw[:10]

    return None


def _calculate_learning_streak(activity_dates):
    """Calculate current/longest streak from meaningful activity dates."""
    unique_dates = sorted({d for d in activity_dates if d})

    if not unique_dates:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "active_dates": [],
            "last_activity_date": None,
            "earned_badges": [],
            "next_badge": {"days": 1, "name": "First Step", "icon": "🌱"},
        }

    parsed = [datetime.fromisoformat(d).date() for d in unique_dates]
    longest = 1
    run = 1

    for previous, current in zip(parsed, parsed[1:]):
        if current == previous + timedelta(days=1):
            run += 1
            longest = max(longest, run)
        else:
            run = 1

    today = datetime.now(timezone.utc).date()
    last = parsed[-1]

    # Activity today keeps the streak alive; activity yesterday also counts
    # as the current streak until the next day is completed. Older activity
    # is no longer a current streak.
    if (today - last).days > 1:
        current = 0
    else:
        current = 1
        for index in range(len(parsed) - 1, 0, -1):
            if parsed[index] == parsed[index - 1] + timedelta(days=1):
                current += 1
            else:
                break

    badge_defs = [
        (1, "First Step", "🌱"),
        (3, "Reasoning Spark", "⚡"),
        (7, "Week of Wisdom", "🏆"),
        (14, "Reasoning Rhythm", "🔥"),
        (30, "Cognitive Momentum", "💎"),
        (60, "Deep Thinker", "🧠"),
        (100, "Cognita Mastery", "👑"),
    ]

    earned = [
        {"days": days, "name": name, "icon": icon}
        for days, name, icon in badge_defs
        if longest >= days
    ]

    next_badge = next((
        {"days": days, "name": name, "icon": icon}
        for days, name, icon in badge_defs
        if longest < days
    ), None)

    return {
        "current_streak": current,
        "longest_streak": longest,
        "active_dates": unique_dates,
        "last_activity_date": unique_dates[-1],
        "earned_badges": earned,
        "next_badge": next_badge,
    }


def _build_assessment_history(pre, post_assessments):
    """Build chronological assessment checkpoints for the profile line graph."""
    history = []

    if pre:
        scores = pre.get("skill_scores") or pre.get("scores") or {}
        history.append({
            "label": "Baseline",
            "type": "pre",
            "attempt": 0,
            "overall_score": _safe_float(pre.get("overall_score", 0)),
            "skill_scores": scores,
            "created_at": _safe_iso_datetime(pre.get("created_at")),
        })

    chronological_posts = list(reversed(post_assessments))
    for index, assessment in enumerate(chronological_posts, start=1):
        scores = assessment.get("skill_scores") or assessment.get("scores") or {}
        history.append({
            "label": f"Post {index}",
            "type": "post",
            "attempt": index,
            "overall_score": _safe_float(assessment.get("overall_score", 0)),
            "skill_scores": scores,
            "created_at": _safe_iso_datetime(assessment.get("created_at")),
        })

    return history


# ============================================================
# PROGRESS
# ============================================================

@router.get("/progress")
def get_progress(
    current_user=Depends(get_current_user),
):
    """
    Return complete student progress.

    Supports multiple post-assessment attempts.

    The latest post-assessment is used for the current
    Before vs After comparison.

    All post-assessment attempts are preserved in
    post_history for assessment history and reports.
    """

    try:

        cols = collections()

        if not cols:

            raise HTTPException(
                status_code=503,
                detail="Database is unavailable.",
            )

        user_id = _get_user_id(
            current_user
        )

        logger.info(
            "Loading progress for user: %s",
            user_id,
        )

        # ====================================================
        # PRE-ASSESSMENT
        # ====================================================

        pre = cols[
            "assessments"
        ].find_one(
            {
                "user_id": user_id,
                "type": "pre",
            },
            sort=[
                ("created_at", -1),
            ],
        )

        # ====================================================
        # POST-ASSESSMENTS
        # ====================================================

        post_assessments = list(
            cols[
                "assessments"
            ].find(
                {
                    "user_id": user_id,
                    "type": "post",
                },
                sort=[
                    ("created_at", -1),
                ],
            )
        )

        # Latest post-assessment
        post = (
            post_assessments[0]
            if post_assessments
            else None
        )

        has_pre = pre is not None
        has_post = post is not None

        post_attempts = len(
            post_assessments
        )

        # ====================================================
        # POST-ASSESSMENT HISTORY
        # ====================================================

        post_history = []

        for index, assessment in enumerate(
            post_assessments
        ):

            # Newest first.
            #
            # Example:
            # 3 attempts
            #
            # index 0 -> attempt 3
            # index 1 -> attempt 2
            # index 2 -> attempt 1

            attempt_number = (
                post_attempts - index
            )

            report = _build_report(
                assessment,
                fallback_attempt=attempt_number,
            )

            if not report:
                continue

            post_history.append(
                report
            )

        # ====================================================
        # PRE SCORES
        # ====================================================

        pre_scores = {}

        if pre:

            pre_scores = (
                pre.get(
                    "skill_scores"
                )
                or pre.get(
                    "scores"
                )
                or {}
            )

        # ====================================================
        # LATEST POST SCORES
        # ====================================================

        post_scores = None

        if post:

            post_scores = (
                post.get(
                    "skill_scores"
                )
                or post.get(
                    "scores"
                )
                or {}
            )

        # ====================================================
        # IMPROVEMENT
        # ====================================================

        improvement = None

        if pre_scores and post_scores:

            try:

                improvement = get_improvement(
                    pre_scores,
                    post_scores,
                )

            except Exception as exc:

                logger.warning(
                    "Improvement calculation failed: %s",
                    exc,
                )

        # ====================================================
        # TRAINING PROGRESS
        # ====================================================

        training = {}

        total_questions = 0

        try:

            training_docs = list(
                cols[
                    "training_progress"
                ].find(
                    {
                        "user_id": user_id,
                        "skill": {
                            "$ne": "__pending__"
                        },
                    }
                )
            )

        except Exception as exc:

            logger.warning(
                "Training progress lookup failed: %s",
                exc,
            )

            training_docs = []

        for doc in training_docs:

            skill = doc.get(
                "skill"
            )

            if not skill:
                continue

            questions_attempted = int(
                doc.get(
                    "questions_attempted",
                    0,
                )
                or 0
            )

            correct_answers = int(
                doc.get(
                    "correct_answers",
                    0,
                )
                or 0
            )

            score = _safe_float(
                doc.get(
                    "score",
                    0,
                )
            )

            training[skill] = {

                "difficulty":
                    doc.get(
                        "difficulty",
                        "beginner",
                    ),

                "questions_attempted":
                    questions_attempted,

                "correct_answers":
                    correct_answers,

                "score":
                    score,

                "activity_dates":
                    doc.get("activity_dates", []),

                "last_activity_at":
                    doc.get("updated_at") or doc.get("created_at"),
            }

            total_questions += (
                questions_attempted
            )

        # ====================================================
        # PROFILE
        # ====================================================

        profile = cols[
            "cognitive_profiles"
        ].find_one(
            {
                "user_id": user_id,
            }
        )

        profile_data = None

        if profile:

            profile_scores = (
                profile.get(
                    "skill_scores"
                )
                or profile.get(
                    "scores"
                )
                or {}
            )

            profile_data = {

                "has_profile":
                    True,

                "scores":
                    profile_scores,

                "skill_scores":
                    profile_scores,

                "overall_score":
                    profile.get(
                        "overall_score",
                        0,
                    ),

                "skill_level":
                    profile.get(
                        "skill_level",
                        "Beginner",
                    ),

                "strongest_skill":
                    profile.get(
                        "strongest_skill",
                    ),

                "weakest_skill":
                    profile.get(
                        "weakest_skill",
                    ),

                "summary":
                    profile.get(
                        "summary",
                        "",
                    ),
            }

        # ====================================================
        # PERSONAL PROFILE ACTIVITY + STREAK
        # ====================================================

        activity_dates = set()

        # Assessments are meaningful Cognita activity.
        assessment_docs = []
        if pre:
            assessment_docs.append(pre)
        assessment_docs.extend(post_assessments)

        for assessment in assessment_docs:
            date_key = _activity_date(assessment.get("created_at"))
            if date_key:
                activity_dates.add(date_key)

        # Training submissions are meaningful activity. Newer training
        # documents maintain activity_dates; legacy documents fall back
        # to their stored timestamps without changing old data.
        for doc in training_docs:
            for value in doc.get("activity_dates", []) or []:
                date_key = _activity_date(value)
                if date_key:
                    activity_dates.add(date_key)

            for field in ("created_at", "updated_at"):
                date_key = _activity_date(doc.get(field))
                if date_key:
                    activity_dates.add(date_key)

        streak = _calculate_learning_streak(activity_dates)
        assessment_history = _build_assessment_history(
            pre,
            post_assessments,
        )

        # ====================================================
        # LOG
        # ====================================================

        logger.info(
            "Progress for user %s | "
            "pre=%s | post=%s | post_attempts=%s | "
            "training_questions=%s | profile=%s",
            user_id,
            has_pre,
            has_post,
            post_attempts,
            total_questions,
            profile is not None,
        )

        # ====================================================
        # RESPONSE
        # ====================================================

        return _success({

            # ------------------------------------------------
            # Assessment status
            # ------------------------------------------------

            "has_pre_assessment":
                has_pre,

            "has_post_assessment":
                has_post,

            "pre_assessment":
                has_pre,

            "post_assessment":
                has_post,

            # ------------------------------------------------
            # Multiple post-assessment support
            # ------------------------------------------------

            "post_attempts":
                post_attempts,

            "post_history":
                post_history,

            # ------------------------------------------------
            # Latest complete report
            # ------------------------------------------------

            "latest_post_report":
                (
                    post_history[0]
                    if post_history
                    else None
                ),

            # ------------------------------------------------
            # Scores
            # ------------------------------------------------

            "pre_scores":
                pre_scores,

            "post_scores":
                post_scores,

            # ------------------------------------------------
            # Improvement
            # ------------------------------------------------

            "improvement":
                improvement,

            # ------------------------------------------------
            # Personal profile journey
            # ------------------------------------------------

            "assessment_history":
                assessment_history,

            "streak":
                streak,

            # ------------------------------------------------
            # Training
            # ------------------------------------------------

            "training":
                training,

            "training_sessions":
                total_questions,

            # ------------------------------------------------
            # Profile
            # ------------------------------------------------

            "profile":
                profile_data,
        })

    except HTTPException:
        raise

    except Exception as exc:

        logger.exception(
            "Failed to load progress: %s",
            exc,
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to load progress.",
        )


# ============================================================
# ASSESSMENT REPORTS
# ============================================================

@router.get("/post-assessment/reports")
def get_post_assessment_reports(
    current_user=Depends(get_current_user),
):
    """
    Return all post-assessment reports for the current user.

    Reports are returned newest-first.
    """

    try:

        cols = collections()

        if not cols:

            raise HTTPException(
                status_code=503,
                detail="Database is unavailable.",
            )

        user_id = _get_user_id(
            current_user
        )

        assessments = list(
            cols[
                "assessments"
            ].find(
                {
                    "user_id": user_id,
                    "type": "post",
                },
                sort=[
                    ("created_at", -1),
                ],
            )
        )

        total_attempts = len(
            assessments
        )

        reports = []

        for index, assessment in enumerate(
            assessments
        ):

            attempt_number = (
                assessment.get(
                    "attempt"
                )
                or (
                    total_attempts - index
                )
            )

            report = _build_report(
                assessment,
                fallback_attempt=attempt_number,
            )

            if report:

                reports.append(
                    report
                )

        logger.info(
            "Assessment reports loaded | "
            "user=%s | reports=%s",
            user_id,
            len(reports),
        )

        return _success({

            "total_attempts":
                len(reports),

            "reports":
                reports,
        })

    except HTTPException:
        raise

    except Exception as exc:

        logger.exception(
            "Failed to load assessment reports: %s",
            exc,
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to load assessment reports.",
        )


# ============================================================
# SINGLE ASSESSMENT REPORT
# ============================================================

@router.get(
    "/post-assessment/reports/{attempt}"
)
def get_post_assessment_report(
    attempt: int,
    current_user=Depends(get_current_user),
):
    """
    Return one specific post-assessment report.

    Example:

        GET /api/post-assessment/reports/1

    returns Post-Assessment 1.
    """

    if attempt < 1:

        raise HTTPException(
            status_code=400,
            detail="Assessment attempt must be at least 1.",
        )

    try:

        cols = collections()

        if not cols:

            raise HTTPException(
                status_code=503,
                detail="Database is unavailable.",
            )

        user_id = _get_user_id(
            current_user
        )

        # ====================================================
        # EXPLICIT ATTEMPT LOOKUP
        # ====================================================

        assessment = cols[
            "assessments"
        ].find_one(
            {
                "user_id": user_id,
                "type": "post",
                "attempt": attempt,
            }
        )

        # ====================================================
        # BACKWARD COMPATIBILITY
        # ====================================================

        if not assessment:

            assessments = list(
                cols[
                    "assessments"
                ].find(
                    {
                        "user_id": user_id,
                        "type": "post",
                    },
                    sort=[
                        ("created_at", 1),
                    ],
                )
            )

            if (
                not assessments
                or attempt > len(assessments)
            ):

                raise HTTPException(
                    status_code=404,
                    detail="Assessment report not found.",
                )

            assessment = (
                assessments[attempt - 1]
            )

        # ====================================================
        # BUILD REPORT
        # ====================================================

        report = _build_report(
            assessment,
            fallback_attempt=attempt,
        )

        if not report:

            raise HTTPException(
                status_code=404,
                detail="Assessment report not found.",
            )

        logger.info(
            "Assessment report loaded | "
            "user=%s | attempt=%s",
            user_id,
            attempt,
        )

        return _success(
            report
        )

    except HTTPException:
        raise

    except Exception as exc:

        logger.exception(
            "Failed to load assessment report | "
            "attempt=%s | error=%s",
            attempt,
            exc,
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to load assessment report.",
        )


# ============================================================
# ALL ASSESSMENT REVIEWS
# ============================================================

@router.get("/assessment/reviews")
def get_assessment_reviews(
    current_user=Depends(get_current_user),
):
    """
    Return review-ready reports for:

        Pre-Assessment
        Post-Assessment 1
        Post-Assessment 2
        Post-Assessment 3
        ...

    The dedicated Assessment Review page uses this endpoint
    to let the student select an assessment and review each
    question.

    Each question includes:

        question
        options
        student_answer
        correct_answer
        correct
        score
        feedback
        skill
        difficulty
        image

    Pre-assessment is returned first.

    Post-assessment attempts are returned chronologically.
    """

    try:

        cols = collections()

        if not cols:

            raise HTTPException(
                status_code=503,
                detail="Database is unavailable.",
            )

        user_id = _get_user_id(
            current_user
        )

        # ====================================================
        # PRE-ASSESSMENT
        # ====================================================

        pre = cols[
            "assessments"
        ].find_one(
            {
                "user_id": user_id,
                "type": "pre",
            },
            sort=[
                ("created_at", -1),
            ],
        )

        # ====================================================
        # ALL POST-ASSESSMENTS
        # ====================================================

        post_assessments = list(
            cols[
                "assessments"
            ].find(
                {
                    "user_id": user_id,
                    "type": "post",
                },
                sort=[
                    ("created_at", 1),
                ],
            )
        )

        assessments = []

        # ====================================================
        # PRE-ASSESSMENT
        # ====================================================

        if pre:

            pre_report = _build_report(
                pre,
                fallback_attempt=0,
            )

            if pre_report:

                pre_report["label"] = (
                    "Pre-Assessment"
                )

                pre_report[
                    "assessment_type"
                ] = "pre"

                pre_report[
                    "display_name"
                ] = "Pre-Assessment"

                pre_report[
                    "subtitle"
                ] = "Initial Assessment"

                assessments.append(
                    pre_report
                )

        # ====================================================
        # POST-ASSESSMENTS
        # ====================================================

        for index, assessment in enumerate(
            post_assessments
        ):

            stored_attempt = (
                assessment.get(
                    "attempt"
                )
            )

            attempt_number = (
                stored_attempt
                or (
                    index + 1
                )
            )

            report = _build_report(
                assessment,
                fallback_attempt=attempt_number,
            )

            if not report:
                continue

            report["label"] = (
                f"Post-Assessment "
                f"{attempt_number}"
            )

            report[
                "assessment_type"
            ] = "post"

            report[
                "display_name"
            ] = (
                f"Post-Assessment "
                f"{attempt_number}"
            )

            report[
                "subtitle"
            ] = "Training Cycle"

            assessments.append(
                report
            )

        # ====================================================
        # LOG
        # ====================================================

        logger.info(
            "Assessment reviews loaded | "
            "user=%s | assessments=%s | posts=%s",
            user_id,
            len(assessments),
            len(post_assessments),
        )

        # ====================================================
        # RESPONSE
        # ====================================================

        return _success({

            "total_assessments":
                len(assessments),

            "has_pre_assessment":
                pre is not None,

            "post_attempts":
                len(post_assessments),

            "assessments":
                assessments,
        })

    except HTTPException:
        raise

    except Exception as exc:

        logger.exception(
            "Failed to load assessment reviews: %s",
            exc,
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to load assessment reviews.",
        )


# ============================================================
# POST-ASSESSMENT SUBMISSION
# ============================================================

@router.post("/post-assessment/submit")
def submit_post_assessment(
    req: AssessmentSubmitRequest,
    current_user=Depends(get_current_user),
):
    """
    Submit a post-assessment and update the cognitive profile.

    Every submission is stored as a separate assessment
    document.

    Question lookup uses:

        1. ChromaDB / RAG
        2. Legacy question lookup

    This keeps the post-assessment pipeline consistent with
    the main assessment pipeline.
    """

    cols = collections()

    if not cols:

        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )

    user_id = _get_user_id(
        current_user
    )

    responses = req.all_responses

    if not responses:

        raise HTTPException(
            status_code=400,
            detail="No responses provided.",
        )

    dimension_results = {
        key: []
        for key in DIMENSION_KEYS
    }

    response_details = []

    # ========================================================
    # EVALUATE RESPONSES
    # ========================================================

    for resp in responses:

        question_id = str(
            resp.question_id
        ).strip()

        # ====================================================
        # QUESTION LOOKUP
        # ====================================================

        q = _get_question_for_report(
            question_id
        )

        if not q:

            logger.warning(
                "Unknown question ID during "
                "post-assessment submission: %s",
                question_id,
            )

            continue

        # ====================================================
        # SKILL
        # ====================================================

        skill = str(
            q.get(
                "reasoning_category",
                q.get(
                    "skill",
                    "anumana",
                ),
            )
            or "anumana"
        ).strip().lower()

        # ====================================================
        # CORRECT ANSWER
        # ====================================================

        correct_answer = str(
            q.get(
                "correct_answer",
                q.get(
                    "answer",
                    "",
                ),
            )
            or ""
        )

        # ====================================================
        # OPTIONS
        # ====================================================

        options = q.get(
            "options",
            [],
        )

        if not isinstance(
            options,
            list,
        ):

            options = []

        # ====================================================
        # QUESTION TEXT
        # ====================================================

        question_text = q.get(
            "question",
            q.get(
                "question_text",
                "",
            ),
        )

        # ====================================================
        # RAG CONTEXT
        # ====================================================

        try:

            context = retrieve_context(
                skill,
                question_text,
            )

        except Exception as exc:

            logger.warning(
                "RAG context retrieval failed for %s: %s",
                question_id,
                exc,
            )

            context = ""

        # ====================================================
        # AI EVALUATION
        # ====================================================

        try:

            evaluation = evaluate_answer(
                dimension=skill,
                question=question_text,
                options=options,
                correct_answer=correct_answer,
                student_answer=resp.student_answer,
                context=context,
            )

        except Exception as exc:

            logger.warning(
                "AI evaluation failed for %s: %s",
                question_id,
                exc,
            )

            # =================================================
            # DETERMINISTIC FALLBACK
            # =================================================

            student = str(
                resp.student_answer or ""
            ).strip().lower()

            correct = str(
                correct_answer or ""
            ).strip().lower()

            is_correct = (
                student != ""
                and correct != ""
                and student == correct
            )

            class FallbackEvaluation:

                def __init__(
                    self,
                    value,
                ):

                    self.correct = value

                    self.correctness_score = (
                        100.0
                        if value
                        else 0.0
                    )

                    self.reasoning_quality_score = (
                        70.0
                        if value
                        else 35.0
                    )

                    self.relevance_score = (
                        75.0
                        if value
                        else 40.0
                    )

                    self.understanding_score = (
                        72.0
                        if value
                        else 30.0
                    )

                    self.feedback = (
                        "Correct answer."
                        if value
                        else
                        "Review this reasoning area "
                        "and try again."
                    )

            evaluation = FallbackEvaluation(
                is_correct
            )

        # ====================================================
        # CALCULATE RESPONSE SCORE
        # ====================================================

        score = calculate_response_score(
            evaluation
        )

        if skill not in dimension_results:

            dimension_results[skill] = []

        dimension_results[
            skill
        ].append(
            score
        )

        # ====================================================
        # STORE COMPLETE RESPONSE
        # ====================================================

        response_details.append({

            "question_id":
                question_id,

            "question":
                question_text,

            "options":
                options,

            "student_answer":
                resp.student_answer,

            "correct_answer":
                correct_answer,

            "correct":
                bool(
                    evaluation.correct
                ),

            "score":
                score,

            "feedback":
                evaluation.feedback,

            "difficulty":
                q.get(
                    "difficulty",
                    "beginner",
                ),

            "skill":
                skill,

            "image":
                (
                    q.get(
                        "image"
                    )
                    or q.get(
                        "image_name"
                    )
                ),
        })

    # ========================================================
    # VALIDATION
    # ========================================================

    if not response_details:

        raise HTTPException(
            status_code=400,
            detail="No valid responses could be evaluated.",
        )

    # ========================================================
    # FINAL SKILL SCORES
    # ========================================================

    skill_scores = calculate_skill_scores(
        dimension_results
    )

    overall = calculate_overall_score(
        skill_scores
    )

    level = get_skill_level(
        overall
    )

    strongest = get_strongest_skill(
        skill_scores
    )

    weakest = get_weakest_skill(
        skill_scores
    )

    now = datetime.now(
        timezone.utc
    )

    # ========================================================
    # DETERMINE ATTEMPT NUMBER
    # ========================================================

    previous_post_count = cols[
        "assessments"
    ].count_documents(
        {
            "user_id": user_id,
            "type": "post",
        }
    )

    attempt_number = (
        previous_post_count + 1
    )

    # ========================================================
    # SAVE POST-ASSESSMENT
    # ========================================================

    assessment_doc = {

        "user_id":
            user_id,

        "type":
            "post",

        "attempt":
            attempt_number,

        "responses":
            response_details,

        "total_questions":
            len(response_details),

        "skill_scores":
            skill_scores,

        "scores":
            skill_scores,

        "overall_score":
            overall,

        "strongest_skill":
            strongest,

        "weakest_skill":
            weakest,

        "skill_level":
            level,

        "created_at":
            now,
    }

    cols[
        "assessments"
    ].insert_one(
        assessment_doc
    )

    # ========================================================
    # PROFILE SUMMARY
    # ========================================================

    try:

        summary = generate_profile_summary(
            skill_scores,
            strongest,
            weakest,
            level,
        )

    except Exception as exc:

        logger.warning(
            "Profile summary generation failed: %s",
            exc,
        )

        summary = (
            f"Your cognitive profile is at the "
            f"{level} level with an overall score "
            f"of {round(float(overall), 2)}%."
        )

    # ========================================================
    # UPDATE PROFILE
    # ========================================================

    profile_doc = {

        "user_id":
            user_id,

        "has_profile":
            True,

        "scores":
            skill_scores,

        "skill_scores":
            skill_scores,

        "overall_score":
            overall,

        "strongest_skill":
            strongest,

        "weakest_skill":
            weakest,

        "skill_level":
            level,

        "summary":
            summary,

        "updated_at":
            now,
    }

    cols[
        "cognitive_profiles"
    ].update_one(

        {
            "user_id":
                user_id,
        },

        {
            "$set":
                profile_doc,

            "$setOnInsert": {
                "created_at":
                    now,
            },
        },

        upsert=True,
    )

    # ========================================================
    # PRE-ASSESSMENT
    # ========================================================

    pre = cols[
        "assessments"
    ].find_one(

        {
            "user_id":
                user_id,

            "type":
                "pre",
        },

        sort=[
            ("created_at", -1)
        ],
    )

    pre_scores = {}

    if pre:

        pre_scores = (
            pre.get(
                "skill_scores"
            )
            or pre.get(
                "scores"
            )
            or {}
        )

    # ========================================================
    # IMPROVEMENT
    # ========================================================

    improvement = None

    if pre_scores:

        try:

            improvement = get_improvement(
                pre_scores,
                skill_scores,
            )

        except Exception as exc:

            logger.warning(
                "Improvement calculation failed: %s",
                exc,
            )

    # ========================================================
    # RETURN
    # ========================================================

    return _success({

        "skill_scores":
            skill_scores,

        "overall_score":
            overall,

        "strongest_skill":
            strongest,

        "weakest_skill":
            weakest,

        "skill_level":
            level,

        "attempt":
            attempt_number,

        "improvement":
            improvement,
    })