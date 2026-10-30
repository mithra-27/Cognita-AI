"""
Central cognitive-dimension mapping, question loader,
question helpers, public-question sanitization,
and difficulty utilities for Cognita AI.

IMPORTANT ARCHITECTURE NOTE
----------------------------

The internal question object may contain the correct answer because
the backend needs it for scoring.

However, public_question() deliberately removes all answer-related
information before a question is returned to the frontend.

Therefore:

    RAG / Dataset
          ↓
    clean_question()
          ↓
    Internal question with answer
          ↓
    public_question()
          ↓
    Student frontend

The frontend must NEVER receive:

    correct_answer
    answer
    label
    correct_hypothesis
    document
"""

import json
import logging
import random
import re
from pathlib import Path


logger = logging.getLogger("cognita.questions")


# =========================================================
# DATA PATHS
# =========================================================

DATA_DIR = Path(__file__).parent / "data"

DEMO_FILE = DATA_DIR / "demo_questions.json"


# =========================================================
# COGNITIVE DIMENSIONS
# =========================================================

COGNITIVE_DIMENSIONS = {

    "anumana": {
        "display_name": "Anumāna",
        "skill": "Logical / inferential reasoning",
        "dataset": "LogiQA 2.0",
    },

    "arthapatti": {
        "display_name": "Arthāpatti",
        "skill": "Abductive reasoning / problem solving",
        "dataset": "ART",
    },

    "upamana": {
        "display_name": "Upamāna",
        "skill": "Analogical reasoning",
        "dataset": "AnaloBench",
    },

    "pratyaksha": {
        "display_name": "Pratyakṣa",
        "skill": "Observation / visual reasoning",
        "dataset": "VisReason",
    },

    "shabda": {
        "display_name": "Śabda",
        "skill": "Reading comprehension / interpretation",
        "dataset": "RACE",
    },

    "anupalabdhi": {
        "display_name": "Anupalabdhi",
        "skill": "Absence / contradiction / elimination reasoning",
        "dataset": "SNLI / NLI",
    },
}


# =========================================================
# DIMENSION ORDER
# =========================================================

DIMENSION_KEYS = list(
    COGNITIVE_DIMENSIONS.keys()
)


# =========================================================
# DIFFICULTY
# =========================================================

DIFFICULTY_ORDER = [
    "beginner",
    "intermediate",
    "advanced",
]


# =========================================================
# DEMO QUESTION CACHE
# =========================================================

_demo_cache: list[dict] | None = None


# =========================================================
# LOAD DEMO QUESTIONS
# =========================================================

def load_demo_questions() -> list[dict]:
    """
    Load demo questions from demo_questions.json.

    The file is loaded only once and then cached.
    """

    global _demo_cache

    if _demo_cache is not None:
        return _demo_cache

    if not DEMO_FILE.exists():

        logger.warning(
            "Demo questions file not found: %s",
            DEMO_FILE,
        )

        _demo_cache = []

        return _demo_cache

    try:

        with open(
            DEMO_FILE,
            "r",
            encoding="utf-8",
        ) as f:

            data = json.load(f)

        if not isinstance(data, list):

            logger.warning(
                "Demo questions file does not contain a list."
            )

            _demo_cache = []

            return _demo_cache

        _demo_cache = data

        logger.info(
            "Loaded %d demo questions.",
            len(_demo_cache),
        )

    except Exception as exc:

        logger.error(
            "Failed to load demo questions: %s",
            exc,
        )

        _demo_cache = []

    return _demo_cache


# =========================================================
# GET QUESTION BY ID FROM DEMO DATA
# =========================================================

def get_question_by_id(
    question_id: str,
) -> dict | None:
    """
    Find a demo question using its question ID.
    """

    if not question_id:
        return None

    for question in load_demo_questions():

        current_id = (
            question.get("question_id")
            or question.get("id")
        )

        if current_id == question_id:
            return question

    return None


# =========================================================
# VALIDATE SKILL / DIMENSION
# =========================================================

def valid_skill(
    skill: str,
) -> bool:
    """
    Check whether a cognitive dimension exists.

    Both canonical names and normalized names are accepted.
    """

    normalized = normalize_dimension(skill)

    return normalized in COGNITIVE_DIMENSIONS


# =========================================================
# DISPLAY NAME
# =========================================================

def dimension_display(
    skill: str,
) -> str:
    """
    Convert internal dimension name into display name.

    Example:

        anumana -> Anumāna
    """

    normalized = normalize_dimension(
        skill
    )

    return (
        COGNITIVE_DIMENSIONS
        .get(normalized, {})
        .get(
            "display_name",
            skill,
        )
    )


# =========================================================
# NORMALIZE DIMENSION
# =========================================================

def normalize_dimension(
    value: str | None,
) -> str:
    """
    Normalize cognitive dimension names.

    Supported examples:

        anumana
        Anumāna
        arthapatti
        Arthāpatti
        upamana
        Upamāna
        pratyaksha
        Pratyakṣa
        shabda
        Śabda
        sabda
        anupalabdhi
    """

    if value is None:
        return ""

    text = str(value).strip().lower()

    if not text:
        return ""

    # -----------------------------------------------------
    # Sanskrit diacritic normalization
    # -----------------------------------------------------

    replacements = {
        "ā": "a",
        "ī": "i",
        "ū": "u",

        "ṛ": "r",
        "ṝ": "r",

        "ḷ": "l",
        "ḹ": "l",

        "ś": "s",
        "ṣ": "s",

        "ṇ": "n",
        "ñ": "n",
        "ṅ": "n",

        "ṭ": "t",
        "ḍ": "d",

        "ṃ": "m",
        "ṁ": "m",

        "ḥ": "h",
    }

    for old, new in replacements.items():
        text = text.replace(
            old,
            new,
        )

    # -----------------------------------------------------
    # Remove spaces / separators
    # -----------------------------------------------------

    text = (
        text
        .replace(" ", "")
        .replace("-", "")
        .replace("_", "")
    )

    # -----------------------------------------------------
    # Common aliases
    # -----------------------------------------------------

    aliases = {

        "sabda": "shabda",
        "shabda": "shabda",

        "anumana": "anumana",

        "arthapatti": "arthapatti",

        "upamana": "upamana",

        "pratyaksha": "pratyaksha",

        "anupalabdhi": "anupalabdhi",
    }

    return aliases.get(
        text,
        text,
    )


# =========================================================
# QUESTION TYPE
# =========================================================

def get_question_type(
    q: dict,
) -> str:
    """
    Determine how the frontend should display a question.

    MCQ dimensions:

        Anumāna
        Arthāpatti
        Upamāna
        Śabda
        Anupalabdhi

    Open-ended visual:

        Pratyakṣa / VisReason
    """

    if not isinstance(q, dict):
        return "mcq"

    dimension = normalize_dimension(
        q.get("reasoning_category")
        or q.get("dimension")
        or q.get("skill")
        or ""
    )

    # -----------------------------------------------------
    # Pratyakṣa is visual open-ended
    # -----------------------------------------------------

    if dimension == "pratyaksha":
        return "visual_open_ended"

    # -----------------------------------------------------
    # Respect explicitly provided type for other questions
    # -----------------------------------------------------

    existing_type = q.get(
        "question_type"
    )

    if existing_type:
        return str(
            existing_type
        )

    return "mcq"


# =========================================================
# CHECK MCQ
# =========================================================

def has_usable_options(
    q: dict,
) -> bool:
    """
    Check whether a question has at least two
    usable MCQ options.
    """

    if not isinstance(q, dict):
        return False

    options = q.get(
        "options"
    )

    # -----------------------------------------------------
    # Options must be a list
    # -----------------------------------------------------

    if not isinstance(
        options,
        list,
    ):
        return False

    # -----------------------------------------------------
    # Remove empty options
    # -----------------------------------------------------

    cleaned = []

    for option in options:

        if option is None:
            continue

        text = str(
            option
        ).strip()

        if text:
            cleaned.append(
                text
            )

    return len(cleaned) >= 2


# =========================================================
# CHECK OPEN-ENDED QUESTION
# =========================================================

def has_usable_open_answer(
    q: dict,
) -> bool:
    """
    Check whether an open-ended question contains
    a valid internal answer.

    This is mainly used for VisReason / Pratyakṣa.
    """

    if not isinstance(q, dict):
        return False

    answer = (
        q.get("correct_answer")
        or q.get("answer")
        or q.get("label")
    )

    if answer is None:
        return False

    return (
        str(answer).strip() != ""
    )


# =========================================================
# CLEAN DATASET QUESTION TEXT
# =========================================================

def clean_question_text(
    value: str | None,
) -> str:
    """
    Clean accidental metadata from dataset question text.

    This is defense-in-depth.

    Ideally these fields should never be part of the
    question text, but some converted datasets can contain
    strings such as:

        Correct Answer: 0
        Correct Hypothesis: 1
        Reasoning Skill: ...
        Options: ...

    Those must never be shown to students.
    """

    if value is None:
        return ""

    text = str(value).strip()

    if not text:
        return ""

    # -----------------------------------------------------
    # Remove answer / metadata sections
    # -----------------------------------------------------

    patterns = [

        r"\s*Correct\s+Hypothesis\s*:\s*.*$",

        r"\s*Correct\s+Answer\s*:\s*.*$",

        r"\s*Correct\s+Option\s*:\s*.*$",

        r"\s*(?:Correct\s+)?Answer\s*:\s*.*$",

        r"\s*Label\s*:\s*.*$",

        r"\s*Reasoning\s+Skill\s*:\s*.*$",

        r"\s*Dataset\s*:\s*.*$",

        r"\s*Source\s*:\s*.*$",
    ]

    for pattern in patterns:

        text = re.sub(
            pattern,
            "",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )

    # -----------------------------------------------------
    # Remove accidental trailing whitespace
    # -----------------------------------------------------

    return text.strip()


# =========================================================
# CLEAN OPTION TEXT
# =========================================================

def clean_option_text(
    value,
) -> str:
    """
    Clean an individual MCQ option.
    """

    if value is None:
        return ""

    text = str(
        value
    ).strip()

    if not text:
        return ""

    # Remove accidental answer metadata.
    text = re.sub(
        r"\s*Correct\s+Answer\s*:\s*.*$",
        "",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    text = re.sub(
        r"\s*Correct\s+Hypothesis\s*:\s*.*$",
        "",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    return text.strip()


# =========================================================
# CLEAN / NORMALIZE QUESTION
# =========================================================

def clean_question(
    q: dict,
) -> dict:
    """
    Normalize question fields from datasets / RAG.

    IMPORTANT:

    This function keeps the correct answer internally.

    public_question() removes answer-related fields before
    sending a question to the frontend.
    """

    if not isinstance(q, dict):
        return {}

    # -----------------------------------------------------
    # Question ID
    # -----------------------------------------------------

    question_id = (
        q.get("question_id")
        or q.get("id")
        or q.get("questionId")
    )

    # -----------------------------------------------------
    # Question text
    # -----------------------------------------------------

    question_text = (
        q.get("question")
        or q.get("text")
        or ""
    )

    question_text = clean_question_text(
        question_text
    )

    # -----------------------------------------------------
    # Options
    # -----------------------------------------------------

    options = q.get(
        "options",
        [],
    )

    # -----------------------------------------------------
    # Convert string options into a list
    # -----------------------------------------------------

    if isinstance(
        options,
        str,
    ):

        # Try JSON first.
        try:

            parsed_options = json.loads(
                options
            )

            if isinstance(
                parsed_options,
                list,
            ):
                options = parsed_options

        except Exception:
            pass

        # If still a string, use delimiters.
        if isinstance(
            options,
            str,
        ):

            if "|||" in options:

                options = options.split(
                    "|||"
                )

            elif "|" in options:

                options = options.split(
                    "|"
                )

            else:

                options = [
                    options
                ]

    # -----------------------------------------------------
    # Ensure list
    # -----------------------------------------------------

    if not isinstance(
        options,
        list,
    ):
        options = []

    # -----------------------------------------------------
    # Clean options
    # -----------------------------------------------------

    cleaned_options = []

    for option in options:

        cleaned_option = (
            clean_option_text(
                option
            )
        )

        if cleaned_option:
            cleaned_options.append(
                cleaned_option
            )

    # -----------------------------------------------------
    # Determine dimension
    # -----------------------------------------------------

    dimension = normalize_dimension(
        q.get("reasoning_category")
        or q.get("dimension")
        or q.get("skill")
        or ""
    )

    # -----------------------------------------------------
    # Determine correct answer
    #
    # INTERNAL ONLY
    # -----------------------------------------------------

    correct_answer = (
        q.get("correct_answer")
        or q.get("answer")
        or q.get("label")
    )

    # -----------------------------------------------------
    # Build cleaned object
    # -----------------------------------------------------

    cleaned = dict(q)

    cleaned["question_id"] = (
        question_id
    )

    cleaned["id"] = (
        question_id
    )

    cleaned["question"] = (
        question_text
    )

    cleaned["options"] = (
        cleaned_options
    )

    cleaned["reasoning_category"] = (
        dimension
    )

    cleaned["dimension"] = (
        dimension
    )

    # -----------------------------------------------------
    # Internal correct answer
    # -----------------------------------------------------

    cleaned["correct_answer"] = (
        correct_answer
    )

    # Preserve original answer internally.
    cleaned["answer"] = q.get(
        "answer"
    )

    # Preserve label internally if present.
    cleaned["label"] = q.get(
        "label"
    )

    # -----------------------------------------------------
    # Difficulty
    # -----------------------------------------------------

    difficulty = (
        q.get("difficulty")
        or "beginner"
    )

    difficulty = str(
        difficulty
    ).strip().lower()

    if difficulty not in DIFFICULTY_ORDER:
        difficulty = "beginner"

    cleaned["difficulty"] = (
        difficulty
    )

    # -----------------------------------------------------
    # Dataset
    # -----------------------------------------------------

    cleaned["dataset"] = (
        q.get("dataset")
        or
        COGNITIVE_DIMENSIONS
        .get(
            dimension,
            {},
        )
        .get(
            "dataset"
        )
    )

    # -----------------------------------------------------
    # Source
    # -----------------------------------------------------

    cleaned["source"] = (
        q.get("source")
        or q.get("dataset")
    )

    # -----------------------------------------------------
    # Visual information
    # -----------------------------------------------------

    cleaned["image"] = q.get(
        "image"
    )

    # -----------------------------------------------------
    # Question type
    # -----------------------------------------------------

    cleaned["question_type"] = (
        get_question_type(
            cleaned
        )
    )

    return cleaned


# =========================================================
# PUBLIC QUESTION
# =========================================================

def public_question(
    q: dict,
) -> dict:
    """
    Prepare a question for the frontend.

    SECURITY RULE
    -------------

    The frontend must NEVER receive:

        correct_answer
        answer
        label
        correct_hypothesis
        document
        explanation

    Only student-safe information is returned.

    The backend can still retrieve the original question
    from RAG when scoring the submitted answer.
    """

    if not isinstance(q, dict):
        return {}

    # -----------------------------------------------------
    # Normalize question first
    # -----------------------------------------------------

    cleaned = clean_question(
        q
    )

    dimension = normalize_dimension(
        cleaned.get(
            "reasoning_category"
        )
        or cleaned.get(
            "dimension"
        )
        or cleaned.get(
            "skill"
        )
        or ""
    )

    question_type = (
        get_question_type(
            cleaned
        )
    )

    # -----------------------------------------------------
    # Student-safe question
    # -----------------------------------------------------

    public = {

        # -------------------------------------------------
        # Question identification
        # -------------------------------------------------

        "id": (
            cleaned.get(
                "question_id"
            )
        ),

        "question_id": (
            cleaned.get(
                "question_id"
            )
        ),

        # -------------------------------------------------
        # Question text
        # -------------------------------------------------

        "question": (
            clean_question_text(
                cleaned.get(
                    "question",
                    ""
                )
            )
        ),

        # -------------------------------------------------
        # MCQ options
        # -------------------------------------------------

        "options": [
            clean_option_text(
                option
            )
            for option in cleaned.get(
                "options",
                []
            )
            if clean_option_text(
                option
            )
        ],

        # -------------------------------------------------
        # Cognitive dimension
        # -------------------------------------------------

        "reasoning_category": (
            dimension
        ),

        "dimension": (
            dimension
        ),

        # -------------------------------------------------
        # Difficulty
        # -------------------------------------------------

        "difficulty": (
            cleaned.get(
                "difficulty",
                "beginner",
            )
        ),

        # -------------------------------------------------
        # Question type
        # -------------------------------------------------

        "question_type": (
            question_type
        ),

        # -------------------------------------------------
        # VisReason image
        # -------------------------------------------------

        "image": (
            cleaned.get(
                "image"
            )
        ),

        # -------------------------------------------------
        # Dataset
        # -------------------------------------------------

        "dataset": (
            cleaned.get(
                "dataset"
            )
        ),

        # -------------------------------------------------
        # Source
        # -------------------------------------------------

        "source": (
            cleaned.get(
                "source"
            )
        ),
    }

    # -----------------------------------------------------
    # Explicit security cleanup
    #
    # Even if a future change adds fields to `public`,
    # these answer fields are deleted.
    # -----------------------------------------------------

    forbidden_fields = {
        "correct_answer",
        "answer",
        "label",
        "correct_hypothesis",
        "correctAnswer",
        "correctHypothesis",
        "document",
        "explanation",
        "reasoning",
        "solution",
    }

    for field in forbidden_fields:
        public.pop(
            field,
            None,
        )

    return public


# =========================================================
# BUILD DEMO ASSESSMENT
# =========================================================

def build_demo_assessment(
    per_dimension: int = 2,
) -> list[dict]:
    """
    Assemble demo questions across all six
    cognitive dimensions.

    This function is used as a fallback when
    RAG does not provide enough questions.
    """

    questions = (
        load_demo_questions()
    )

    by_category = {
        dimension: []
        for dimension in DIMENSION_KEYS
    }

    # -----------------------------------------------------
    # Group questions by dimension
    # -----------------------------------------------------

    for question in questions:

        dimension = normalize_dimension(
            question.get(
                "reasoning_category"
            )
            or question.get(
                "dimension"
            )
            or question.get(
                "skill"
            )
        )

        if dimension in by_category:

            by_category[
                dimension
            ].append(
                question
            )

    # -----------------------------------------------------
    # Select questions
    # -----------------------------------------------------

    assembled = []

    for dimension in DIMENSION_KEYS:

        pool = by_category[
            dimension
        ][:]

        random.shuffle(
            pool
        )

        selected = pool[
            :per_dimension
        ]

        for question in selected:

            cleaned = clean_question(
                question
            )

            if cleaned:
                assembled.append(
                    cleaned
                )

    return assembled


# =========================================================
# BUILD DEMO TRAINING QUESTION
# =========================================================

def build_demo_training(
    skill: str,
    difficulty: str | None = None,
) -> dict | None:
    """
    Select one training question for a cognitive skill.

    If the requested difficulty is not available,
    another question from the same skill is used.
    """

    skill = normalize_dimension(
        skill
    )

    if not skill:
        return None

    pool = [

        question

        for question
        in load_demo_questions()

        if normalize_dimension(
            question.get(
                "reasoning_category"
            )
            or question.get(
                "dimension"
            )
            or question.get(
                "skill"
            )
        ) == skill
    ]

    # -----------------------------------------------------
    # Try requested difficulty
    # -----------------------------------------------------

    if difficulty:

        requested_difficulty = (
            str(
                difficulty
            )
            .strip()
            .lower()
        )

        matched = [

            question

            for question
            in pool

            if str(
                question.get(
                    "difficulty",
                    ""
                )
            )
            .strip()
            .lower()
            == requested_difficulty
        ]

        if matched:
            pool = matched

    # -----------------------------------------------------
    # No question available
    # -----------------------------------------------------

    if not pool:
        return None

    # -----------------------------------------------------
    # Return random cleaned question
    # -----------------------------------------------------

    return clean_question(
        random.choice(
            pool
        )
    )


# =========================================================
# NEXT DIFFICULTY
# =========================================================

def next_difficulty(
    current: str,
    score: float,
) -> str:
    """
    Adapt difficulty based on performance.

    >= 80:
        increase difficulty

    < 50:
        decrease difficulty

    50-79:
        keep current difficulty
    """

    current = (
        str(
            current
        )
        .strip()
        .lower()
    )

    try:

        index = (
            DIFFICULTY_ORDER.index(
                current
            )
        )

    except ValueError:

        index = 0

    # -----------------------------------------------------
    # High performance
    # -----------------------------------------------------

    if (
        score >= 80
        and index
        < len(
            DIFFICULTY_ORDER
        ) - 1
    ):

        return DIFFICULTY_ORDER[
            index + 1
        ]

    # -----------------------------------------------------
    # Low performance
    # -----------------------------------------------------

    if (
        score < 50
        and index > 0
    ):

        return DIFFICULTY_ORDER[
            index - 1
        ]

    # -----------------------------------------------------
    # Keep current
    # -----------------------------------------------------

    return DIFFICULTY_ORDER[
        index
    ]


# =========================================================
# DIFFICULTY FROM SCORE
# =========================================================

def difficulty_for_score(
    score: float,
) -> str:
    """
    Determine starting difficulty from score.

    < 60:
        beginner

    60-79:
        intermediate

    >= 80:
        advanced
    """

    try:
        score = float(
            score
        )

    except (
        TypeError,
        ValueError,
    ):
        score = 0.0

    if score < 60:
        return "beginner"

    if score < 80:
        return "intermediate"

    return "advanced"