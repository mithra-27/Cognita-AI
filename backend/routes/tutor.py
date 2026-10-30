"""
Cognita AI — AI Tutor Routes

Responsibilities:
- Provide a conversational cognitive-skills tutor.
- Retrieve relevant reasoning questions/context from ChromaDB.
- Use Gemini to explain concepts and guide students.
- Support natural requests for explanations, examples, practice,
  hints, and mistake analysis.
- Keep tutoring focused on the six Cognita cognitive dimensions.
- Provide deterministic fallback responses when Gemini is unavailable.

IMPORTANT:
- This module does NOT perform conventional/predictive ML.
- This module does NOT modify ChromaDB.
- RAG retrieval is read-only.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from services.ai import _client, dimension_display, GEMINI_MODEL
from services.rag import retrieve_context, normalize_skill


logger = logging.getLogger("cognita.tutor")


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/tutor",
    tags=["AI Tutor"],
)


# ============================================================
# CONSTANTS
# ============================================================

DIMENSION_KEYS = [
    "anumana",
    "arthapatti",
    "upamana",
    "pratyaksha",
    "shabda",
    "anupalabdhi",
]

MAX_MESSAGE_LENGTH = 2000
MAX_CONTEXT_RESULTS = 5


# ============================================================
# REQUEST / RESPONSE MODELS
# ============================================================

class TutorRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=MAX_MESSAGE_LENGTH,
    )

    # Frontend sends the selected cognitive dimension
    dimension: str | None = None

    # Recent conversation from frontend
    conversation: list[dict[str, str]] = Field(
        default_factory=list
    )


class TutorResponse(BaseModel):
    success: bool
    data: dict[str, Any]


# ============================================================
# HELPERS
# ============================================================

def _clean_dimension(
    dimension: str | None,
) -> str:
    """
    Normalize the cognitive dimension.
    """

    if not dimension:
        return ""

    value = normalize_skill(
        str(dimension)
    )

    if value in DIMENSION_KEYS:
        return value

    return ""


def _truncate(
    value: Any,
    max_chars: int = 5000,
) -> str:
    """
    Safely convert a value to text.
    """

    if value is None:
        return ""

    text = str(value).strip()

    if len(text) <= max_chars:
        return text

    return text[:max_chars] + "..."


def _format_context(
    retrieved: list[dict[str, Any]],
) -> str:
    """
    Convert retrieved RAG documents into tutor context.
    """

    if not retrieved:
        return ""

    sections = []

    for index, item in enumerate(
        retrieved,
        start=1,
    ):

        document = item.get(
            "document",
            "",
        )

        metadata = item.get(
            "metadata",
            {},
        )

        sections.append(
            f"""
REFERENCE {index}

QUESTION / CONTEXT:
{_truncate(document, 1800)}

METADATA:
{_truncate(metadata, 600)}
""".strip()
        )

    return "\n\n".join(sections)


def _format_conversation(
    conversation: list[dict[str, str]],
) -> str:
    """
    Convert recent conversation into a compact prompt.
    """

    if not conversation:
        return "No previous conversation."

    messages = []

    recent = conversation[-8:]

    for item in recent:

        if not isinstance(
            item,
            dict,
        ):
            continue

        role = str(
            item.get(
                "role",
                "user",
            )
        ).strip().lower()

        content = str(
            item.get(
                "content",
                "",
            )
        ).strip()

        if not content:
            continue

        if role not in {
            "user",
            "assistant",
        }:
            role = "user"

        messages.append(
            f"{role.upper()}: "
            f"{_truncate(content, 800)}"
        )

    return "\n".join(messages)


# ============================================================
# REQUEST INTENT DETECTION
# ============================================================

def _detect_intent(
    message: str,
) -> str:
    """
    Detect the student's basic tutoring intent.

    This is NOT a machine-learning classifier.
    It is a transparent keyword-based routing rule.
    """

    text = (
        message
        .strip()
        .lower()
    )

    # Practice / example question
    practice_terms = [
        "practice question",
        "practice",
        "example question",
        "an example question",
        "give me a question",
        "give me one question",
        "show me a question",
        "test me",
        "quiz me",
        "question to solve",
        "question for practice",
    ]

    if any(
        term in text
        for term in practice_terms
    ):
        return "practice"

    # Hint
    hint_terms = [
        "hint",
        "clue",
        "help me solve",
        "help me with this",
        "stuck",
    ]

    if any(
        term in text
        for term in hint_terms
    ):
        return "hint"

    # Explanation
    explanation_terms = [
        "explain",
        "what is",
        "what does",
        "meaning",
        "concept",
        "teach me",
        "how does",
    ]

    if any(
        term in text
        for term in explanation_terms
    ):
        return "explanation"

    # Simple example
    example_terms = [
        "simple example",
        "give me an example",
        "show me an example",
        "example of",
        "for example",
    ]

    if any(
        term in text
        for term in example_terms
    ):
        return "example"

    # Answer / mistake analysis
    answer_terms = [
        "my answer",
        "is this correct",
        "why is my answer",
        "why is this wrong",
        "why is the answer",
        "explain the answer",
        "explain why",
        "mistake",
        "wrong answer",
    ]

    if any(
        term in text
        for term in answer_terms
    ):
        return "mistake_analysis"

    return "general"


# ============================================================
# DIMENSION-SPECIFIC PRACTICE INSTRUCTIONS
# ============================================================

def _practice_instruction(
    dimension: str,
) -> str:

    instructions = {

        "anumana":
            "Create or retrieve a logical/inferential reasoning question. "
            "The student should infer a conclusion from evidence.",

        "arthapatti":
            "Create or retrieve an abductive reasoning/problem-solving "
            "question where the student identifies the explanation that "
            "best accounts for the facts.",

        "upamana":
            "Create or retrieve an analogical reasoning question where "
            "the student identifies a meaningful relationship between "
            "examples or situations.",

        "pratyaksha":
            "Create or retrieve an observation/visual reasoning question. "
            "Focus on information that can be directly observed. "
            "Do not claim to visually inspect an image unless image data "
            "is actually provided to the model.",

        "shabda":
            "Create or retrieve a reading comprehension/interpretation "
            "question based on a passage or textual information. "
            "Ask the student to identify the correct interpretation, "
            "main idea, inference, or supporting detail.",

        "anupalabdhi":
            "Create or retrieve an elimination/contradiction reasoning "
            "question. Focus on absence, contradiction, or eliminating "
            "unsupported possibilities.",
    }

    return instructions.get(
        dimension,
        "Create a reasoning practice question appropriate to the "
        "selected cognitive dimension.",
    )


# ============================================================
# TUTOR PROMPT
# ============================================================

_TUTOR_PROMPT = """
You are Cognita AI Tutor.

Cognita AI is a cognitive reasoning assessment and
cognitive skill development framework inspired by selected
Mīmāṃsā epistemological principles.

The six reasoning dimensions are:

1. Anumāna — logical / inferential reasoning
2. Arthāpatti — abductive reasoning / problem solving
3. Upamāna — analogical reasoning
4. Pratyakṣa — observation / visual reasoning
5. Śabda — reading comprehension / interpretation
6. Anupalabdhi — absence / contradiction / elimination reasoning

Your role is to help a student improve their reasoning skills.

============================================================
IMPORTANT SAFETY AND PROJECT RULES
============================================================

1. Do not diagnose intelligence, mental health, or psychological
   conditions.

2. Do not claim that a student's score represents intelligence.

3. Do not mention machine learning, predictive models, XGBoost,
   SHAP, or conventional ML techniques.

4. Explain concepts in simple student-friendly language.

5. Teach through:
   - explanations
   - examples
   - step-by-step reasoning
   - hints
   - practice questions
   - mistake analysis

6. Never claim that the benchmark datasets are traditional
   Mīmāṃsā datasets.

   They are modern reasoning datasets mapped to computational
   cognitive dimensions inspired by selected Mīmāṃsā principles.

7. Stay focused on the selected cognitive dimension.

8. If RAG references are provided, use them as supporting
   knowledge.

9. Do not invent information that conflicts with the retrieved
   references.

============================================================
STUDENT INTENT
============================================================

The student's intent has been detected as:

{intent}

Possible intents:

- practice = student wants a practice/example question
- explanation = student wants the concept explained
- example = student wants a simple example
- hint = student wants guidance without immediately revealing
  the complete answer
- mistake_analysis = student wants help understanding an answer
  or mistake
- general = normal reasoning conversation

============================================================
PRACTICE QUESTION RULE
============================================================

If intent is PRACTICE:

The student explicitly wants a question.

{practice_instruction}

Use the retrieved RAG references when they contain a suitable
question.

Present ONE question at a time.

If the retrieved reference contains answer choices, preserve
the useful structure and present the options.

Do NOT immediately reveal the correct answer.

Invite the student to answer.

For example:

"Here is a Śabda practice question:

[passage/question]

A. ...
B. ...
C. ...
D. ...

What is your answer?"

============================================================
EXPLANATION RULE
============================================================

If intent is EXPLANATION:

Explain the selected reasoning skill simply.

Use:
1. Meaning
2. Simple idea
3. Short example
4. How to practice

============================================================
EXAMPLE RULE
============================================================

If intent is EXAMPLE:

Give a short, easy example related to the selected
cognitive dimension.

============================================================
HINT RULE
============================================================

If intent is HINT:

Give a useful clue or reasoning step.

Do not reveal the complete answer unless explicitly requested.

============================================================
MISTAKE ANALYSIS RULE
============================================================

If intent is MISTAKE_ANALYSIS:

Explain:
1. What the reasoning requires.
2. What the student's reasoning appears to do.
3. Where the reasoning went wrong.
4. How to approach it correctly.

============================================================
CURRENT COGNITIVE DIMENSION
============================================================

{dimension}

============================================================
STUDENT MESSAGE
============================================================

{message}

============================================================
RECENT CONVERSATION
============================================================

{conversation}

============================================================
RAG REFERENCES
============================================================

{context}

============================================================
FINAL RESPONSE REQUIREMENTS
============================================================

Be supportive, concise, and educational.

For practice requests, give ONE question and let the student
attempt it before revealing the answer.

For explanations, teach the concept clearly.

For hints, guide rather than solve.

For mistakes, explain the reasoning.

Do not add unnecessary technical details.
"""


# ============================================================
# FALLBACK RESPONSE
# ============================================================

def _fallback_response(
    message: str,
    dimension: str,
    intent: str,
    retrieved: list[dict[str, Any]],
) -> str:

    display_name = (
        dimension_display(dimension)
        if dimension
        else "Cognitive Reasoning"
    )

    # --------------------------------------------------------
    # PRACTICE
    # --------------------------------------------------------

    if intent == "practice":

        # Use RAG result if available
        if retrieved:

            first = retrieved[0]

            document = str(
                first.get(
                    "document",
                    "",
                )
            ).strip()

            if document:

                return (
                    f"Here is a {display_name} practice question "
                    "from Cognita's reasoning knowledge base:\n\n"
                    f"{_truncate(document, 2500)}\n\n"
                    "Take a moment to reason through it and give me "
                    "your answer. I’ll help you analyze your reasoning."
                )

        # Deterministic fallback examples
        if dimension == "shabda":

            return (
                "Here is a Śabda practice question:\n\n"
                "Read the statement:\n"
                "\"Regular exercise can improve physical fitness, "
                "but its benefits depend on consistency and an "
                "appropriate routine.\"\n\n"
                "Which conclusion is best supported by the statement?\n\n"
                "A. Exercise is always beneficial regardless of the routine.\n"
                "B. Consistent and appropriate exercise can contribute "
                "to better physical fitness.\n"
                "C. Only intense exercise improves physical fitness.\n"
                "D. Exercise completely guarantees good health.\n\n"
                "What is your answer? Explain briefly why you chose it."
            )

        if dimension == "anumana":

            return (
                "Here is an Anumāna practice question:\n\n"
                "Every metal exposed to sufficient heat expands. "
                "This metal rod has been sufficiently heated.\n\n"
                "What conclusion logically follows?\n\n"
                "A. The metal rod contracts.\n"
                "B. The metal rod expands.\n"
                "C. The metal rod changes into another material.\n"
                "D. Nothing can be concluded.\n\n"
                "What is your answer?"
            )

        if dimension == "arthapatti":

            return (
                "Here is an Arthāpatti practice question:\n\n"
                "A student regularly attends class, but her assignment "
                "submissions are consistently missing. What explanation "
                "best accounts for these facts?\n\n"
                "A. She never attends class.\n"
                "B. She may be attending class but failing to complete "
                "the assignments.\n"
                "C. The class does not have assignments.\n"
                "D. She has stopped studying completely.\n\n"
                "Which explanation best fits the available facts?"
            )

        if dimension == "upamana":

            return (
                "Here is an Upamāna practice question:\n\n"
                "A bat and a bird both have wings, but they belong to "
                "different biological groups. What is the most useful "
                "comparison?\n\n"
                "A. They are identical animals.\n"
                "B. They share the functional feature of flight while "
                "having different biological characteristics.\n"
                "C. Birds are mammals because bats can fly.\n"
                "D. Wings prove that two animals belong to the same group.\n\n"
                "What relationship do you identify?"
            )

        if dimension == "pratyaksha":

            return (
                "Here is a Pratyakṣa practice question:\n\n"
                "Imagine that you observe three objects on a table: "
                "a red cup, a blue book, and a black pen.\n\n"
                "Which statement is directly supported by the observation?\n\n"
                "A. The cup is expensive.\n"
                "B. The book contains useful information.\n"
                "C. The pen is black.\n"
                "D. The owner likes the color blue.\n\n"
                "Which answer is based only on what can be observed?"
            )

        if dimension == "anupalabdhi":

            return (
                "Here is an Anupalabdhi practice question:\n\n"
                "A classroom is completely empty and there are no "
                "students present. Which conclusion is directly "
                "supported by the observation?\n\n"
                "A. No student is currently in the classroom.\n"
                "B. No student will ever enter the classroom.\n"
                "C. Students dislike the classroom.\n"
                "D. The classroom will remain empty all day.\n\n"
                "Which conclusion follows from the absence of students?"
            )

    # --------------------------------------------------------
    # EXPLANATION
    # --------------------------------------------------------

    if intent == "explanation":

        if dimension == "shabda":

            return (
                "Śabda focuses on understanding and interpreting "
                "information communicated through text.\n\n"
                "A simple way to practice it is:\n"
                "1. Read the passage carefully.\n"
                "2. Identify the main idea.\n"
                "3. Separate stated facts from assumptions.\n"
                "4. Choose the conclusion that is best supported "
                "by the passage.\n\n"
                "The key skill is interpreting what the text actually "
                "supports rather than adding information that is not given."
            )

        if dimension == "anumana":

            return (
                "Anumāna means logical or inferential reasoning. "
                "You use available evidence to reach a conclusion "
                "that logically follows from it.\n\n"
                "Think of it as:\n"
                "Evidence → reasoning → conclusion.\n\n"
                "The important part is making sure the conclusion "
                "is supported by the evidence."
            )

        if dimension == "arthapatti":

            return (
                "Arthāpatti focuses on finding an explanation that "
                "best accounts for the available facts.\n\n"
                "Ask yourself: "
                "\"What must be true for these facts to make sense "
                "together?\""
            )

        if dimension == "upamana":

            return (
                "Upamāna focuses on analogical reasoning. "
                "You compare examples and identify a meaningful "
                "relationship between them.\n\n"
                "Look beyond surface similarities and ask what "
                "relationship is actually shared."
            )

        if dimension == "pratyaksha":

            return (
                "Pratyakṣa focuses on reasoning from observation.\n\n"
                "Start with what is directly observable, separate "
                "observation from assumption, and make only conclusions "
                "supported by the available information."
            )

        if dimension == "anupalabdhi":

            return (
                "Anupalabdhi focuses on reasoning from absence, "
                "contradiction, and elimination.\n\n"
                "Look at what is missing or contradictory and determine "
                "which possibilities can therefore be eliminated."
            )

    # --------------------------------------------------------
    # EXAMPLE
    # --------------------------------------------------------

    if intent == "example":

        if dimension == "shabda":

            return (
                "Here is a simple Śabda example:\n\n"
                "Passage: \"The library closes at 6 PM on weekdays.\"\n\n"
                "Question: When does the library close on a weekday?\n\n"
                "The answer comes directly from interpreting the "
                "information in the passage: 6 PM."
            )

        if dimension == "anumana":

            return (
                "Example of Anumāna:\n\n"
                "Fact: Dark clouds are gathering.\n"
                "Fact: Dark clouds often precede rain.\n"
                "Inference: It may rain soon.\n\n"
                "The conclusion is based on the available evidence."
            )

        return (
            f"A simple example of {display_name} would involve "
            "using the information available to identify the most "
            "reasonable interpretation or conclusion."
        )

    # --------------------------------------------------------
    # HINT
    # --------------------------------------------------------

    if intent == "hint":

        return (
            f"For {display_name}, start by identifying exactly what "
            "information the question gives you. Then ask yourself: "
            "\"What conclusion or relationship is directly supported "
            "by that information?\" Avoid adding assumptions."
        )

    # --------------------------------------------------------
    # GENERAL
    # --------------------------------------------------------

    return (
        f"I can help you practice {display_name} step by step. "
        "You can ask me to explain the concept, give you a practice "
        "question, show an example, provide a hint, or explain a mistake."
    )


# ============================================================
# GEMINI TUTOR
# ============================================================

def _generate_tutor_response(
    message: str,
    dimension: str,
    conversation: list[dict[str, str]],
    context: str,
    intent: str,
) -> str | None:
    """
    Generate tutoring response using Gemini.
    """

    client = _client()

    if client is None:
        return None

    prompt = _TUTOR_PROMPT.format(
        intent=intent.upper(),

        dimension=(
            dimension_display(dimension)
            if dimension
            else "Cognitive Reasoning"
        ),

        message=_truncate(
            message,
            2000,
        ),

        conversation=_truncate(
            _format_conversation(
                conversation
            ),
            5000,
        ),

        context=_truncate(
            context,
            7000,
        ),

        practice_instruction=(
            _practice_instruction(
                dimension
            )
            if dimension
            else
            "Provide one reasoning practice question "
            "covering a suitable Cognita cognitive dimension."
        ),
    )

    try:

        logger.info(
            "[Tutor] Sending tutoring request | "
            "intent=%s | dimension=%s | model=%s",
            intent,
            dimension or "general",
            GEMINI_MODEL,
        )

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )

        text = (
            getattr(
                response,
                "text",
                "",
            )
            or ""
        ).strip()

        if not text:

            logger.warning(
                "[Tutor] Gemini returned empty response."
            )

            return None

        logger.info(
            "[Tutor] Tutor response generated successfully | "
            "intent=%s",
            intent,
        )

        return text

    except Exception as exc:

        logger.exception(
            "[Tutor] Gemini tutoring request failed: %s",
            exc,
        )

        return None


# ============================================================
# CHAT ENDPOINT
# ============================================================

@router.post(
    "/chat",
    response_model=TutorResponse,
)
def tutor_chat(
    request: TutorRequest,
    current_user=Depends(
        get_current_user
    ),
):

    if not request.message.strip():

        raise HTTPException(
            status_code=400,
            detail="Tutor message cannot be empty.",
        )

    # --------------------------------------------------------
    # Normalize dimension
    # --------------------------------------------------------

    dimension = _clean_dimension(
        request.dimension
    )

    # --------------------------------------------------------
    # Detect intent
    # --------------------------------------------------------

    intent = _detect_intent(
        request.message
    )

    logger.info(
        "[Tutor] Chat request | "
        "dimension=%s | intent=%s | message=%s",
        dimension or "general",
        intent,
        request.message[:120],
    )

    # --------------------------------------------------------
    # RAG retrieval
    # --------------------------------------------------------

    retrieved: list[dict[str, Any]] = []

    try:

        retrieved = retrieve_context(
            query=request.message,
            skill=dimension or None,
            n_results=MAX_CONTEXT_RESULTS,
        )

        logger.info(
            "[Tutor] Retrieved %s RAG references.",
            len(retrieved),
        )

    except Exception as exc:

        logger.warning(
            "[Tutor] RAG retrieval failed: %s",
            exc,
        )

        retrieved = []

    context = _format_context(
        retrieved
    )

    # --------------------------------------------------------
    # Gemini
    # --------------------------------------------------------

    answer = _generate_tutor_response(
        message=request.message,
        dimension=dimension,
        conversation=request.conversation,
        context=context,
        intent=intent,
    )

    # --------------------------------------------------------
    # Fallback
    # --------------------------------------------------------

    if not answer:

        answer = _fallback_response(
            message=request.message,
            dimension=dimension,
            intent=intent,
            retrieved=retrieved,
        )

        source = "fallback"

    else:

        source = "gemini_rag"

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "success": True,

        "data": {

            "answer": answer,

            "dimension": dimension,

            "dimension_display": (
                dimension_display(dimension)
                if dimension
                else "Cognitive Reasoning"
            ),

            "source": source,

            "intent": intent,

            "rag_references": len(
                retrieved
            ),
        },
    }


# ============================================================
# TUTOR HEALTH / STATUS
# ============================================================

@router.get("/status")
def tutor_status(
    current_user=Depends(
        get_current_user
    ),
):

    client_available = False

    try:

        client_available = (
            _client() is not None
        )

    except Exception:

        client_available = False

    return {

        "success": True,

        "data": {

            "available": True,

            "gemini_configured":
                client_available,

            "rag_enabled":
                True,

            "dimensions":
                DIMENSION_KEYS,
        },
    }


# ============================================================
# EXPORT
# ============================================================

__all__ = [
    "router",
]