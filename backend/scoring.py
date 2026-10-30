"""Scoring engine — response, skill, and overall cognitive score calculation.

Formula per response:
  0.60 * correctness + 0.20 * reasoning_quality + 0.10 * relevance + 0.10 * understanding
All inputs and outputs are 0-100.
"""

from models import AIEvaluation
from questions import COGNITIVE_DIMENSIONS, DIMENSION_KEYS

WEIGHTS = {
    "correctness": 0.60,
    "reasoning_quality": 0.20,
    "relevance": 0.10,
    "understanding": 0.10,
}


def calculate_response_score(evaluation: AIEvaluation) -> float:
    """Weighted score for a single response (0-100)."""
    score = (
        WEIGHTS["correctness"] * evaluation.correctness_score
        + WEIGHTS["reasoning_quality"] * evaluation.reasoning_quality_score
        + WEIGHTS["relevance"] * evaluation.relevance_score
        + WEIGHTS["understanding"] * evaluation.understanding_score
    )
    return round(max(0.0, min(100.0, score)), 2)


def calculate_skill_scores(
    dimension_results: dict[str, list[float]],
) -> dict[str, float]:
    """Average response scores per dimension. Returns all six keys."""
    scores = {}
    for key in DIMENSION_KEYS:
        vals = dimension_results.get(key, [])
        if vals:
            scores[key] = round(sum(vals) / len(vals), 2)
        else:
            scores[key] = 0.0
    return scores


def calculate_overall_score(skill_scores: dict[str, float]) -> float:
    """Overall = average of six dimension scores that were actually assessed."""
    assessed = [v for k, v in skill_scores.items() if v > 0]
    if not assessed:
        return 0.0
    return round(sum(assessed) / len(assessed), 2)


def get_skill_level(score: float) -> str:
    if score < 40:
        return "Beginner"
    if score < 60:
        return "Developing"
    if score < 80:
        return "Proficient"
    return "Strong"


def get_strongest_skill(skill_scores: dict[str, float]) -> str | None:
    assessed = {k: v for k, v in skill_scores.items() if v > 0}
    if not assessed:
        return None
    return max(assessed, key=assessed.get)


def get_weakest_skill(skill_scores: dict[str, float]) -> str | None:
    assessed = {k: v for k, v in skill_scores.items() if v > 0}
    if not assessed:
        return None
    return min(assessed, key=assessed.get)


def get_improvement(
    pre_scores: dict[str, float], post_scores: dict[str, float]
) -> dict[str, float]:
    """Per-dimension delta (post - pre). Only for assessed dimensions."""
    improvement = {}
    for key in DIMENSION_KEYS:
        pre = pre_scores.get(key, 0.0)
        post = post_scores.get(key, 0.0)
        if post > 0:  # only include dimensions assessed in post
            improvement[key] = round(post - pre, 2)
    return improvement
