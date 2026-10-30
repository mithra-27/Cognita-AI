"""
Cognita AI — Gemini-powered AI services.

Responsibilities:
- Evaluate student answers
- Generate adaptive training questions when required
- Generate cognitive-profile summaries
- Provide deterministic fallbacks when Gemini is unavailable

This module does NOT perform conventional/predictive ML.
"""

from __future__ import annotations

import json
import logging
import random
import re
from typing import Any

from config import settings
from models import AIEvaluation


logger = logging.getLogger("cognita.ai")


# ---------------------------------------------------------------------------
# Gemini configuration
# ---------------------------------------------------------------------------

GEMINI_MODEL = "gemini-3.6-flash"

_MAX_CHARS = 1200


# ---------------------------------------------------------------------------
# Cognitive-dimension display helper
# ---------------------------------------------------------------------------

def dimension_display(dimension: str | None) -> str:
    """
    Convert internal cognitive-dimension keys into display names.
    """

    if not dimension:
        return ""

    mapping = {
        "anumana": "Anumāna",
        "anumāna": "Anumāna",

        "arthapatti": "Arthāpatti",
        "arthāpatti": "Arthāpatti",

        "upamana": "Upamāna",
        "upamāna": "Upamāna",

        "pratyaksha": "Pratyakṣa",
        "pratyakṣa": "Pratyakṣa",

        "shabda": "Śabda",
        "śabda": "Śabda",
        "sabda": "Śabda",

        "anupalabdhi": "Anupalabdhi",
    }

    normalized = str(dimension).strip().lower()

    return mapping.get(
        normalized,
        str(dimension).strip(),
    )


# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------

def _client():
    """
    Create and return a Gemini client.

    Returns:
        Gemini client if GEMINI_API_KEY is configured.
        None otherwise.
    """

    if not settings.is_gemini_configured:
        logger.warning(
            "[AI] Gemini API key is not configured. "
            "Using deterministic fallback."
        )
        return None

    try:
        from google import genai

        client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

        logger.info(
            "[AI] Gemini client initialized successfully."
        )

        return client

    except Exception as exc:
        logger.exception(
            "[AI] Failed to initialize Gemini client: %s",
            exc,
        )
        return None


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_EVAL_PROMPT = """
You are the response evaluator for Cognita AI, a cognitive reasoning
assessment and adaptive cognitive skill training framework.

The framework evaluates six reasoning dimensions inspired by selected
Mīmāṃsā epistemological principles.

Evaluate the student's answer against the question and expected answer.

IMPORTANT RULES:

1. Be fair and semantically aware.

2. Do not require an exact word-for-word match.

3. Equivalent answers should be considered correct when their meaning
   matches the expected answer.

4. Consider:
   - spelling variations
   - capitalization differences
   - singular/plural variations
   - simple grammatical differences
   - semantically equivalent wording

5. For Pratyakṣa visual/open-ended questions:
   - The student's answer may use different wording from the expected answer.
   - Evaluate semantic equivalence.
   - Do not require an exact string match.
   - Do not invent visual information that is not present in the supplied
     question/context.

6. For MCQ questions:
   - The expected answer is authoritative for correctness.
   - Do not mark an objectively incorrect MCQ answer as correct merely
     because the student gives a confident explanation.

7. Do not invent information that is not supported by the question,
   expected answer, student answer, or supplied context.

8. Scores must be between 0 and 100.

Evaluation dimensions:

correctness_score:
How correct the student's answer is, from 0 to 100.

reasoning_quality_score:
Quality of reasoning demonstrated by the response, from 0 to 100.

relevance_score:
How relevant the response is to the question, from 0 to 100.

understanding_score:
Evidence that the student understood the underlying question/task,
from 0 to 100.

correct:
True when the answer is substantively correct.
False otherwise.

Provide concise constructive feedback.

Question:
{question}

Expected Answer:
{correct_answer}

Student Answer:
{student_answer}

Reasoning Dimension:
{dimension}

Additional Context:
{context}
"""


_GEN_PROMPT = """
You are Cognita AI's adaptive cognitive training question generator.

Generate exactly ONE reasoning question for the requested cognitive
dimension.

The question must:

- Test the specified reasoning ability.
- Be appropriate for the requested difficulty.
- Be clear and unambiguous.
- Have exactly four answer options.
- Have one correct answer.
- Include a short explanation.
- Be suitable for a student cognitive-skills training system.
- Avoid requiring external/current information.
- Avoid medical or psychological diagnosis.
- Avoid questions requiring real-time internet information.

Return ONLY a structured JSON response with these fields:

{
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correct_answer": "...",
    "reasoning_category": "...",
    "difficulty": "...",
    "dataset": "Gemini-generated",
    "explanation": "..."
}

Cognitive Dimension:
{dimension}

Requested Difficulty:
{difficulty}

Reference Context:
{context}
"""


_SUMMARY_PROMPT = """
You are Cognita AI's cognitive-profile assistant.

Generate a concise and constructive summary of a student's cognitive
reasoning profile.

The summary should:

- Identify the student's strongest reasoning abilities.
- Identify areas that need improvement.
- Explain the profile in simple student-friendly language.
- Encourage targeted practice.
- Avoid medical or psychological diagnosis.
- Avoid claiming that the scores represent intelligence or clinical ability.
- Focus only on the six reasoning dimensions.
- Do not invent skills that are not present in the supplied profile.

Student Cognitive Profile:
{profile}

Overall Score:
{overall_score}

Strongest Skill:
{strongest_skill}

Weakest Skill:
{weakest_skill}
"""


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def _truncate(
    value: Any,
    max_chars: int = _MAX_CHARS,
) -> str:
    """
    Convert a value to text and safely truncate it.
    """

    if value is None:
        return ""

    text = str(value).strip()

    if len(text) <= max_chars:
        return text

    return text[:max_chars] + "..."


def _clean_dimension(
    dimension: str | None,
) -> str:
    """
    Normalize a cognitive dimension name.
    """

    if not dimension:
        return ""

    value = str(dimension).strip().lower()

    aliases = {
        "anumāna": "anumana",
        "anumana": "anumana",

        "arthāpatti": "arthapatti",
        "arthapatti": "arthapatti",

        "upamāna": "upamana",
        "upamana": "upamana",

        "pratyakṣa": "pratyaksha",
        "pratyaksha": "pratyaksha",

        "śabda": "shabda",
        "sabda": "shabda",
        "shabda": "shabda",

        "anupalabdhi": "anupalabdhi",
    }

    return aliases.get(
        value,
        value,
    )


def _is_pratyaksha(
    dimension: str | None,
) -> bool:
    """
    Return True for the Pratyakṣa visual/open-ended reasoning dimension.
    """

    return _clean_dimension(dimension) == "pratyaksha"


# ---------------------------------------------------------------------------
# Objective answer matching
# ---------------------------------------------------------------------------

def _normalize_answer(
    value: Any,
) -> str:
    """
    Normalize an answer for basic comparison.
    """

    if value is None:
        return ""

    text = str(value).strip().lower()

    # Normalize common whitespace.
    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    # Remove surrounding punctuation.
    text = re.sub(
        r"^[\s\W]+|[\s\W]+$",
        "",
        text,
    )

    return text


def _objective_correct(
    student_answer: Any,
    correct_answer: Any,
    options: Any = None,
) -> bool:
    """
    Perform objective answer matching.

    Supports:
    - Exact text matching
    - Option-letter matching
    - Student option letter -> option text
    - Correct option letter -> option text
    """

    student = _normalize_answer(
        student_answer
    )

    correct = _normalize_answer(
        correct_answer
    )

    if not student or not correct:
        return False

    # ---------------------------------------------------------
    # Direct exact match
    # ---------------------------------------------------------

    if student == correct:
        return True

    # ---------------------------------------------------------
    # Normalize options
    # ---------------------------------------------------------

    if not isinstance(options, list):
        options = []

    normalized_options = [
        _normalize_answer(option)
        for option in options
    ]

    letters = "abcdefghijklmnopqrstuvwxyz"

    # ---------------------------------------------------------
    # Student selected an option by letter
    # ---------------------------------------------------------

    student_index = None

    if len(student) == 1 and student in letters:
        index = letters.index(student)

        if index < len(normalized_options):
            student_index = index

    # ---------------------------------------------------------
    # Correct answer represented by a letter
    # ---------------------------------------------------------

    correct_index = None

    if len(correct) == 1 and correct in letters:
        index = letters.index(correct)

        if index < len(normalized_options):
            correct_index = index

    # ---------------------------------------------------------
    # Compare option indexes
    # ---------------------------------------------------------

    if (
        student_index is not None
        and correct_index is not None
        and student_index == correct_index
    ):
        return True

    # ---------------------------------------------------------
    # Student selected letter,
    # correct answer is option text
    # ---------------------------------------------------------

    if student_index is not None:

        if (
            student_index < len(normalized_options)
            and normalized_options[student_index] == correct
        ):
            return True

    # ---------------------------------------------------------
    # Correct answer is letter,
    # student supplied option text
    # ---------------------------------------------------------

    if correct_index is not None:

        if (
            correct_index < len(normalized_options)
            and normalized_options[correct_index] == student
        ):
            return True

    return False


# ---------------------------------------------------------------------------
# Gemini JSON parsing
# ---------------------------------------------------------------------------

def _parse_json(
    raw_text: str | None,
) -> dict[str, Any] | None:
    """
    Robustly parse a JSON object returned by Gemini.

    Supports:
    - Plain JSON
    - Markdown code fences
    - JSON embedded inside surrounding text
    """

    if not raw_text:
        return None

    text = str(raw_text).strip()

    if not text:
        return None

    # ---------------------------------------------------------
    # 1. Direct JSON
    # ---------------------------------------------------------

    try:

        parsed = json.loads(text)

        if isinstance(parsed, dict):
            return parsed

    except json.JSONDecodeError:
        pass

    # ---------------------------------------------------------
    # 2. Remove markdown code fences
    # ---------------------------------------------------------

    cleaned = re.sub(
        r"```(?:json)?",
        "",
        text,
        flags=re.IGNORECASE,
    )

    cleaned = cleaned.replace(
        "```",
        "",
    ).strip()

    try:

        parsed = json.loads(cleaned)

        if isinstance(parsed, dict):
            return parsed

    except json.JSONDecodeError:
        pass

    # ---------------------------------------------------------
    # 3. Extract first JSON object
    # ---------------------------------------------------------

    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start != -1 and end > start:

        candidate = cleaned[
            start : end + 1
        ]

        try:

            parsed = json.loads(candidate)

            if isinstance(parsed, dict):
                return parsed

        except json.JSONDecodeError:
            pass

    return None


# ---------------------------------------------------------------------------
# Evaluation normalization
# ---------------------------------------------------------------------------

def _normalize_evaluation(
    data: dict[str, Any],
    objective_correct: bool,
    dimension: str | None,
) -> AIEvaluation:
    """
    Normalize Gemini output into the application's AIEvaluation model.

    MCQ:
        Objective correctness remains authoritative.

    Pratyakṣa:
        Gemini semantic correctness is allowed because the task is
        open-ended.
    """

    dimension_key = _clean_dimension(
        dimension
    )

    def safe_score(
        key: str,
        default: float = 0.0,
    ) -> float:

        value = data.get(
            key,
            default,
        )

        try:
            value = float(value)

        except (
            TypeError,
            ValueError,
        ):
            value = default

        return max(
            0.0,
            min(
                100.0,
                value,
            ),
        )

    # ---------------------------------------------------------
    # Gemini semantic correctness
    # ---------------------------------------------------------

    gemini_correct = bool(
        data.get(
            "correct",
            False,
        )
    )

    # ---------------------------------------------------------
    # Pratyakṣa
    # ---------------------------------------------------------

    if dimension_key == "pratyaksha":

        final_correct = gemini_correct

        correctness_score = safe_score(
            "correctness_score",
            100.0 if final_correct else 0.0,
        )

    # ---------------------------------------------------------
    # MCQ dimensions
    # ---------------------------------------------------------

    else:

        final_correct = objective_correct

        if objective_correct:

            correctness_score = safe_score(
                "correctness_score",
                100.0,
            )

        else:

            correctness_score = 0.0

    return AIEvaluation(
        correct=final_correct,

        correctness_score=correctness_score,

        reasoning_quality_score=safe_score(
            "reasoning_quality_score",
            0.0,
        ),

        relevance_score=safe_score(
            "relevance_score",
            0.0,
        ),

        understanding_score=safe_score(
            "understanding_score",
            0.0,
        ),

        feedback=str(
            data.get(
                "feedback",
                "",
            )
        ).strip(),
    )


# ---------------------------------------------------------------------------
# Fallback evaluation
# ---------------------------------------------------------------------------

def _fallback_evaluation(
    objective_correct: bool,
    dimension: str | None = None,
) -> AIEvaluation:
    """
    Deterministic fallback when Gemini cannot evaluate the answer.
    """

    correct = bool(
        objective_correct
    )

    if correct:

        return AIEvaluation(
            correct=True,

            correctness_score=100.0,

            reasoning_quality_score=70.0,

            relevance_score=75.0,

            understanding_score=72.0,

            feedback=(
                "Your answer is correct. "
                "The evaluation was completed in fallback mode "
                "without AI."
            ),
        )

    return AIEvaluation(
        correct=False,

        correctness_score=0.0,

        reasoning_quality_score=35.0,

        relevance_score=40.0,

        understanding_score=30.0,

        feedback=(
            "Your answer does not match the expected answer. "
            "Try identifying the key information in the question "
            "before answering."
        ),
    )


# ---------------------------------------------------------------------------
# Final score helper
# ---------------------------------------------------------------------------

def _calculate_final_score(
    evaluation: AIEvaluation,
) -> float:
    """
    Calculate the final response score.

    Transparent weighting:

        Correctness       = 60%
        Reasoning Quality = 20%
        Relevance         = 10%
        Understanding     = 10%
    """

    score = (
        0.60
        * evaluation.correctness_score

        + 0.20
        * evaluation.reasoning_quality_score

        + 0.10
        * evaluation.relevance_score

        + 0.10
        * evaluation.understanding_score
    )

    return round(
        max(
            0.0,
            min(
                100.0,
                score,
            ),
        ),
        2,
    )


# ---------------------------------------------------------------------------
# Answer evaluation
# ---------------------------------------------------------------------------

def evaluate_answer(
    question: str,
    student_answer: str,
    correct_answer: str,
    dimension: str,
    options: list[str] | None = None,
    context: str = "",
) -> AIEvaluation:
    """
    Evaluate a student's answer using Gemini.

    Parameters:
        question:
            Assessment/training question.

        student_answer:
            Student's submitted answer.

        correct_answer:
            Dataset/reference answer.

        dimension:
            Cognitive dimension.

        options:
            MCQ options, if applicable.

        context:
            Additional question context.

    Returns:
        AIEvaluation
    """

    dimension_key = _clean_dimension(
        dimension
    )

    # ---------------------------------------------------------
    # Objective matching
    # ---------------------------------------------------------

    objective_correct = _objective_correct(
        student_answer,
        correct_answer,
        options,
    )

    logger.info(
        "[AI] Evaluating answer | "
        "dimension=%s | objective_correct=%s",
        dimension_key,
        objective_correct,
    )

    # ---------------------------------------------------------
    # Gemini client
    # ---------------------------------------------------------

    client = _client()

    if client is None:

        logger.info(
            "[AI] Gemini unavailable. "
            "Using fallback evaluation."
        )

        return _fallback_evaluation(
            objective_correct=objective_correct,
            dimension=dimension_key,
        )

    # ---------------------------------------------------------
    # Build evaluation prompt
    # ---------------------------------------------------------

    prompt = _EVAL_PROMPT.format(

        question=_truncate(
            question
        ),

        correct_answer=_truncate(
            correct_answer
        ),

        student_answer=_truncate(
            student_answer
        ),

        dimension=dimension_display(
            dimension
        ),

        context=_truncate(
            context
        ),
    )

    # ---------------------------------------------------------
    # Gemini request
    # ---------------------------------------------------------

    try:

        from google.genai import types

        logger.info(
            "[AI] Sending answer evaluation request "
            "to Gemini | model=%s",
            GEMINI_MODEL,
        )

        response = client.models.generate_content(

            model=GEMINI_MODEL,

            contents=prompt,

            config=types.GenerateContentConfig(

                temperature=0.2,

                max_output_tokens=300,

                response_mime_type="application/json",

                response_schema=AIEvaluation,
            ),
        )

        logger.info(
            "[AI] Gemini evaluation response received."
        )

        # -----------------------------------------------------
        # Preferred structured-output path
        # -----------------------------------------------------

        data: dict[str, Any] | None = None

        parsed = getattr(
            response,
            "parsed",
            None,
        )

        if parsed is not None:

            if isinstance(
                parsed,
                AIEvaluation,
            ):

                data = parsed.model_dump()

                logger.info(
                    "[AI] Gemini structured "
                    "evaluation parsed successfully."
                )

            elif isinstance(
                parsed,
                dict,
            ):

                data = parsed

                logger.info(
                    "[AI] Gemini structured "
                    "dictionary parsed successfully."
                )

        # -----------------------------------------------------
        # Fallback to response.text
        # -----------------------------------------------------

        if data is None:

            raw_text = (
                getattr(
                    response,
                    "text",
                    "",
                )
                or ""
            )

            data = _parse_json(
                raw_text
            )

            if data:

                logger.info(
                    "[AI] Gemini evaluation JSON "
                    "parsed from response text."
                )

        # -----------------------------------------------------
        # Invalid Gemini response
        # -----------------------------------------------------

        if not data:

            logger.warning(
                "[AI] Unable to parse model JSON response."
            )

            logger.warning(
                "[AI] Raw Gemini response: %r",
                getattr(
                    response,
                    "text",
                    "",
                ),
            )

            logger.warning(
                "[AI] Gemini returned invalid JSON. "
                "Using fallback evaluation."
            )

            return _fallback_evaluation(
                objective_correct=objective_correct,
                dimension=dimension_key,
            )

        # -----------------------------------------------------
        # Normalize Gemini evaluation
        # -----------------------------------------------------

        evaluation = _normalize_evaluation(

            data=data,

            objective_correct=objective_correct,

            dimension=dimension_key,
        )

        logger.info(
            "[AI] Evaluation complete | "
            "correct=%s | score=%.2f",
            evaluation.correct,
            _calculate_final_score(
                evaluation
            ),
        )

        return evaluation

    except Exception as exc:

        logger.exception(
            "[AI] Gemini evaluation failed: %s",
            exc,
        )

        return _fallback_evaluation(
            objective_correct=objective_correct,
            dimension=dimension_key,
        )


# ---------------------------------------------------------------------------
# Adaptive training question generation
# ---------------------------------------------------------------------------

def generate_training_question(
    dimension: str,
    difficulty: str = "beginner",
    context: str = "",
) -> dict[str, Any] | None:
    """
    Generate a training question using Gemini.

    RAG remains the primary source for existing benchmark questions.
    Gemini generation is available when a generated question is required.
    """

    dimension_key = _clean_dimension(
        dimension
    )

    client = _client()

    if client is None:

        logger.warning(
            "[AI] Gemini unavailable. "
            "Cannot generate training question."
        )

        return None

    prompt = _GEN_PROMPT.format(

        dimension=dimension_display(
            dimension
        ),

        difficulty=difficulty,

        context=_truncate(
            context
        ),
    )

    try:

        from google.genai import types

        logger.info(
            "[AI] Generating training question | "
            "dimension=%s | difficulty=%s | model=%s",
            dimension_key,
            difficulty,
            GEMINI_MODEL,
        )

        response = client.models.generate_content(

            model=GEMINI_MODEL,

            contents=prompt,

            config=types.GenerateContentConfig(

                temperature=0.7,

                max_output_tokens=700,

                response_mime_type="application/json",
            ),
        )

        # -----------------------------------------------------
        # Try structured parsed response first
        # -----------------------------------------------------

        data: dict[str, Any] | None = None

        parsed = getattr(
            response,
            "parsed",
            None,
        )

        if isinstance(
            parsed,
            dict,
        ):
            data = parsed

        # -----------------------------------------------------
        # Fallback to response.text
        # -----------------------------------------------------

        if data is None:

            raw_text = (
                getattr(
                    response,
                    "text",
                    "",
                )
                or ""
            )

            data = _parse_json(
                raw_text
            )

        if not data:

            logger.warning(
                "[AI] Unable to parse generated "
                "training question."
            )

            logger.warning(
                "[AI] Raw Gemini generation response: %r",
                getattr(
                    response,
                    "text",
                    "",
                ),
            )

            return None

        # -----------------------------------------------------
        # Extract generated fields
        # -----------------------------------------------------

        question = str(
            data.get(
                "question",
                "",
            )
        ).strip()

        options = data.get(
            "options",
            [],
        )

        correct_answer = str(
            data.get(
                "correct_answer",
                "",
            )
        ).strip()

        reasoning_category = str(
            data.get(
                "reasoning_category",
                dimension_key,
            )
        ).strip()

        explanation = str(
            data.get(
                "explanation",
                data.get(
                    "feedback",
                    "",
                ),
            )
        ).strip()

        # -----------------------------------------------------
        # Validate question
        # -----------------------------------------------------

        if not question:

            logger.warning(
                "[AI] Generated training question is empty."
            )

            return None

        # -----------------------------------------------------
        # Validate options
        # -----------------------------------------------------

        if not isinstance(
            options,
            list,
        ):

            options = []

        options = [
            str(option).strip()
            for option in options
            if str(option).strip()
        ]

        # Cognita currently expects four-option MCQs
        # for Gemini-generated training questions.

        if len(options) != 4:

            logger.warning(
                "[AI] Generated question did not contain "
                "exactly four options."
            )

            return None

        # -----------------------------------------------------
        # Validate correct answer
        # -----------------------------------------------------

        if not correct_answer:

            logger.warning(
                "[AI] Generated question has no correct answer."
            )

            return None

        # -----------------------------------------------------
        # Return normalized question
        # -----------------------------------------------------

        return {

            "question_id": str(
                data.get(
                    "question_id",
                    f"gemini_{random.randint(100000, 999999)}",
                )
            ),

            "question": question,

            "options": options,

            "correct_answer": correct_answer,

            "reasoning_category": reasoning_category,

            "difficulty": str(
                data.get(
                    "difficulty",
                    difficulty,
                )
            ).strip(),

            "dataset": str(
                data.get(
                    "dataset",
                    "Gemini-generated",
                )
            ).strip(),

            "source": "gemini",

            "feedback": explanation,
        }

    except Exception as exc:

        logger.exception(
            "[AI] Gemini training-question "
            "generation failed: %s",
            exc,
        )

        return None


# ---------------------------------------------------------------------------
# Cognitive-profile summary
# ---------------------------------------------------------------------------

def generate_profile_summary(
    profile: dict[str, Any],
    overall_score: float,
    strongest_skill: str,
    weakest_skill: str,
) -> str:
    """
    Generate a student-friendly cognitive-profile summary.
    """

    client = _client()

    if client is None:

        return _fallback_summary(

            profile=profile,

            overall_score=overall_score,

            strongest_skill=strongest_skill,

            weakest_skill=weakest_skill,
        )

    prompt = _SUMMARY_PROMPT.format(

        profile=_truncate(

            json.dumps(
                profile,
                ensure_ascii=False,
            ),

            max_chars=4000,
        ),

        overall_score=overall_score,

        strongest_skill=dimension_display(
            strongest_skill
        ),

        weakest_skill=dimension_display(
            weakest_skill
        ),
    )

    try:

        logger.info(
            "[AI] Generating cognitive profile "
            "summary | model=%s",
            GEMINI_MODEL,
        )

        response = client.models.generate_content(

            model=GEMINI_MODEL,

            contents=prompt,
        )

        summary = (
            getattr(
                response,
                "text",
                "",
            )
            or ""
        ).strip()

        if summary:

            logger.info(
                "[AI] Cognitive profile "
                "summary generated."
            )

            return summary

    except Exception as exc:

        logger.exception(
            "[AI] Gemini profile-summary "
            "generation failed: %s",
            exc,
        )

    return _fallback_summary(

        profile=profile,

        overall_score=overall_score,

        strongest_skill=strongest_skill,

        weakest_skill=weakest_skill,
    )


# ---------------------------------------------------------------------------
# Deterministic profile summary fallback
# ---------------------------------------------------------------------------

def _fallback_summary(
    profile: dict[str, Any],
    overall_score: float,
    strongest_skill: str,
    weakest_skill: str,
) -> str:
    """
    Generate a deterministic profile summary without an LLM.
    """

    strongest = dimension_display(
        strongest_skill
    )

    weakest = dimension_display(
        weakest_skill
    )

    # ---------------------------------------------------------
    # Determine broad level
    # ---------------------------------------------------------

    if overall_score >= 75:

        level = "advanced"

    elif overall_score >= 50:

        level = "intermediate"

    else:

        level = "beginner"

    return (
        f"Your current cognitive profile indicates a "
        f"{level} overall reasoning level. "
        f"Your strongest area is {strongest}, while "
        f"{weakest} is the main area for improvement. "
        f"Focused practice on the weaker reasoning skill can "
        f"help strengthen your overall reasoning performance."
    )


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "evaluate_answer",
    "generate_training_question",
    "generate_profile_summary",
]