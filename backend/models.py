"""Pydantic models for request validation and AI evaluation."""

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required.")
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: str
    name: str
    email: str


# ---------- Assessment ----------
class AssessmentResponse(BaseModel):
    question_id: str
    student_answer: str


class AssessmentSubmitRequest(BaseModel):
    responses: list[AssessmentResponse] = Field(default_factory=list)
    answers: list[AssessmentResponse] = Field(default_factory=list)

    @property
    def all_responses(self) -> list[AssessmentResponse]:
        return self.responses or self.answers


# ---------- Training ----------
class TrainingGenerateRequest(BaseModel):
    skill: str
    difficulty: str | None = None


class TrainingSubmitRequest(BaseModel):
    question_id: str
    skill: str
    question: str | None = None
    options: list[str] | None = None
    student_answer: str
    difficulty: str | None = None
    correct_answer: str | None = None


# ---------- AI evaluation ----------
class AIEvaluation(BaseModel):
    correct: bool
    correctness_score: float = 0.0
    reasoning_quality_score: float = 0.0
    relevance_score: float = 0.0
    understanding_score: float = 0.0
    feedback: str = ""

    @field_validator(
        "correctness_score",
        "reasoning_quality_score",
        "relevance_score",
        "understanding_score",
    )
    @classmethod
    def clamp(cls, v: float) -> float:
        return max(0.0, min(100.0, float(v)))
