import { useEffect, useMemo, useState } from 'react';

import {
  Brain,
  CheckCircle,
  ChevronRight,
  Loader2,
  Lock,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';

import { api, ApiError } from '../api/client';

import {
  DIMENSIONS,
  getDimension,
} from '../data/dimensions';

import EmptyState from '../components/EmptyState';
import Loading from '../components/Loading';

import './AdaptiveTraining.css';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

function normalizeSkill(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getDisplayName(skill) {
  const dimension = getDimension(skill);

  return (
    dimension?.name ||
    dimension?.title ||
    dimension?.label ||
    {
      anumana: 'Anumāna',
      arthapatti: 'Arthāpatti',
      upamana: 'Upamāna',
      pratyaksha: 'Pratyakṣa',
      shabda: 'Śabda',
      anupalabdhi: 'Anupalabdhi',
    }[normalizeSkill(skill)] ||
    skill ||
    'Reasoning'
  );
}

function buildRecommendationFromProfile(profile) {
  const scores = profile?.scores || {};
  const dimensions = Array.isArray(DIMENSIONS) ? DIMENSIONS : [];

  const priority = dimensions
    .map((dimension) => {
      const scoreValue = scores?.[dimension.key];

      if (scoreValue === undefined || scoreValue === null) {
        return null;
      }

      const score = Number(scoreValue);

      if (!Number.isFinite(score)) {
        return null;
      }

      return {
        skill: dimension.key,
        score: Number(score.toFixed(2)),
        skill_name:
          dimension.description ||
          dimension.skill ||
          '',
        display_name:
          dimension.name ||
          getDisplayName(dimension.key),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  if (!priority.length) {
    return null;
  }

  const weakest = priority[0];

  return {
    recommended_skill: weakest.skill,
    score: weakest.score,
    skill_name: weakest.skill_name,
    display_name: weakest.display_name,
    reason:
      'This is currently your weakest cognitive reasoning area and has been prioritized for improvement.',
    priority,
  };
}

export default function AdaptiveTraining() {
  const [selected, setSelected] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(true);
  const [error, setError] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [priority, setPriority] = useState([]);

  useEffect(() => {
    let active = true;

    const applyRecommendation = (data) => {
      if (!data) {
        return false;
      }

      setRecommendation(data);

      if (Array.isArray(data.priority)) {
        setPriority(data.priority);
      }

      if (data.recommended_skill) {
        setSelected(data.recommended_skill);
      }

      return true;
    };

    const loadRecommendation = async () => {
      setRecommendationLoading(true);
      setError('');

      try {
        /*
         * Primary source:
         * profile-based backend recommendation.
         */
        const data = await api.getTrainingRecommendation();

        if (!active) {
          return;
        }

        applyRecommendation(data);
      } catch (err) {
        /*
         * If the running backend does not yet expose
         * /api/training/recommendation, use the existing
         * Cognitive Profile endpoint as a safe UI fallback.
         *
         * This prevents the Training page from becoming unusable
         * because of a missing recommendation route.
         */
        if (
          err instanceof ApiError &&
          (err.status === 404 || err.message === 'Not Found')
        ) {
          try {
            const profile = await api.getProfile();

            if (!active) {
              return;
            }

            const fallback = buildRecommendationFromProfile(profile);

            if (fallback) {
              applyRecommendation(fallback);
            } else {
              setError(
                'Complete the cognitive assessment before starting adaptive training.'
              );
            }
          } catch (profileError) {
            console.error(
              'Failed to load Cognitive Profile fallback:',
              profileError
            );

            if (active) {
              setError(
                'Unable to load your Cognitive Profile. Please refresh and try again.'
              );
            }
          }
        } else if (active) {
          console.error(
            'Failed to load training recommendation:',
            err
          );

          setError(
            err instanceof ApiError
              ? err.message
              : 'Unable to load your training recommendation.'
          );
        }
      } finally {
        if (active) {
          setRecommendationLoading(false);
        }
      }
    };

    loadRecommendation();

    return () => {
      active = false;
    };
  }, []);

  const dimensions = useMemo(() => {
    if (!DIMENSIONS) {
      return [];
    }

    if (Array.isArray(DIMENSIONS)) {
      return DIMENSIONS.map((item) => {
        if (typeof item === 'string') {
          return {
            key: item,
            ...(getDimension(item) || {}),
          };
        }

        return item;
      });
    }

    return Object.entries(DIMENSIONS).map(
      ([key, value]) => ({
        key,
        ...value,
      })
    );
  }, []);

  const getSkillScore = (key) => {
    const item = priority.find(
      (entry) =>
        normalizeSkill(entry.skill) ===
        normalizeSkill(key)
    );

    if (!item) {
      return null;
    }

    const value = Number(item.score);

    return Number.isFinite(value) ? value : null;
  };

  const sortedDimensions = useMemo(() => {
    if (!dimensions.length) {
      return [];
    }

    return [...dimensions].sort((a, b) => {
      const scoreA = getSkillScore(a.key);
      const scoreB = getSkillScore(b.key);

      if (scoreA === null && scoreB === null) {
        return 0;
      }

      if (scoreA === null) {
        return 1;
      }

      if (scoreB === null) {
        return -1;
      }

      return scoreA - scoreB;
    });
  }, [dimensions, priority]);

  const getSkillInfo = (key) => {
    const dimension = getDimension(key);

    const priorityItem = priority.find(
      (item) =>
        normalizeSkill(item.skill) ===
        normalizeSkill(key)
    );

    return {
      name:
        priorityItem?.display_name ||
        dimension?.name ||
        dimension?.title ||
        dimension?.label ||
        getDisplayName(key),
      description:
        dimension?.description ||
        dimension?.skill ||
        '',
      score:
        priorityItem?.score ?? null,
    };
  };

  const isRecommended = (key) =>
    normalizeSkill(recommendation?.recommended_skill) ===
    normalizeSkill(key);

  const isPratyakshaQuestion = useMemo(() => {
    if (!question) {
      return false;
    }

    if (
      question.question_type ===
      'visual_open_ended'
    ) {
      return true;
    }

    if (
      question.type ===
      'visual_open_ended'
    ) {
      return true;
    }

    if (question.question_type === 'visual') {
      return true;
    }

    return (
      normalizeSkill(selected) ===
        'pratyaksha' ||
      normalizeSkill(
        question.skill ||
        question.reasoning_category ||
        question.dimension ||
        ''
      ) === 'pratyaksha'
    );
  }, [question, selected]);

  const pickSkill = async (key) => {
    if (loading) {
      return;
    }

    setSelected(key);
    setQuestion(null);
    setSelectedOption('');
    setFeedback(null);
    setError('');
    setLoading(true);

    try {
      const data = await api.generateTraining(key);

      if (!data) {
        throw new Error(
          'No training question was returned.'
        );
      }

      setQuestion(data);
    } catch (err) {
      console.error(
        'Failed to generate training question:',
        err
      );

      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to generate a training question. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (
      !question ||
      !selectedOption ||
      !selected
    ) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.submitTraining({
        question_id:
          question.id ||
          question.question_id,
        student_answer: selectedOption,
        skill: selected,
        difficulty: question.difficulty,
      });

      setFeedback(data);
    } catch (err) {
      console.error(
        'Failed to submit training answer:',
        err
      );

      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to submit your answer. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = async () => {
    if (!selected) {
      return;
    }

    setQuestion(null);
    setSelectedOption('');
    setFeedback(null);
    setError('');
    setLoading(true);

    try {
      const data = await api.generateTraining(
        selected,
        feedback?.next_difficulty
      );

      if (!data) {
        throw new Error(
          'No training question was returned.'
        );
      }

      setQuestion(data);
    } catch (err) {
      console.error(
        'Failed to generate next question:',
        err
      );

      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to generate the next question.'
      );
    } finally {
      setLoading(false);
    }
  };

  const changeSkill = () => {
    setQuestion(null);
    setSelectedOption('');
    setFeedback(null);
    setError('');
  };

  if (recommendationLoading) {
    return (
      <div className="training-page">
        <div className="training-loading-page">
          <div className="training-loading-orb">
            <Loader2 size={30} className="spin" />
          </div>
          <h3>Preparing Adaptive Training</h3>
          <p>
            Reading your Cognitive Profile and
            identifying the next training priority.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="training-page">
      <div className="training-header">
        <div>
          <div className="training-eyebrow">
            <Brain size={16} />
            Adaptive Cognitive Training
          </div>

          <h1>Adaptive Training</h1>

          <p>
            Practice the cognitive skills that need
            the most improvement based on your
            Cognitive Profile.
          </p>
        </div>

        <div className="training-header-icon">
          <Brain size={34} />
        </div>
      </div>

      {error && (
        <div className="training-error">
          <XCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {recommendation && (
        <div className="recommended-training-card">
          <div className="recommended-icon">
            <Target size={24} />
          </div>

          <div className="recommended-content">
            <div className="recommended-label">
              YOUR TRAINING PRIORITY
            </div>

            <h2>
              {recommendation.display_name ||
                getDisplayName(
                  recommendation.recommended_skill
                )}
            </h2>

            <p>
              {recommendation.reason ||
                'This cognitive skill has been prioritized from your Cognitive Profile.'}
            </p>

            <div className="recommended-score">
              <span>Cognitive Profile Score</span>
              <strong>
                {Number.isFinite(
                  Number(recommendation.score)
                )
                  ? `${Number(
                      recommendation.score
                    ).toFixed(2)}%`
                  : '—'}
              </strong>
            </div>
          </div>

          <div className="recommended-action">
            {!question &&
              selected ===
                recommendation.recommended_skill && (
                <button
                  type="button"
                  className="primary-training-button"
                  onClick={() =>
                    pickSkill(
                      recommendation.recommended_skill
                    )
                  }
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={18}
                        className="spin"
                      />
                      Preparing...
                    </>
                  ) : (
                    <>
                      <Zap size={18} />
                      Start Recommended Training
                    </>
                  )}
                </button>
              )}
          </div>
        </div>
      )}

      <div className="training-layout">
        <aside className="training-sidebar">
          <div className="sidebar-heading">
            <div>
              <span className="sidebar-title">
                Cognitive Skills
              </span>
              <span className="sidebar-subtitle">
                Weakest skills are prioritized
              </span>
            </div>

            <TrendingUp size={19} />
          </div>

          <div className="skill-list">
            {sortedDimensions.map(
              (dimension, index) => {
                const key = dimension.key;
                const info = getSkillInfo(key);
                const score = getSkillScore(key);
                const recommended =
                  isRecommended(key);
                const active =
                  selected === key;

                return (
                  <button
                    key={key}
                    type="button"
                    className={[
                      'skill-card',
                      active ? 'active' : '',
                      recommended
                        ? 'recommended'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() =>
                      pickSkill(key)
                    }
                    disabled={loading}
                  >
                    <div className="skill-card-top">
                      <div className="skill-number">
                        {index + 1}
                      </div>

                      <div className="skill-card-info">
                        <div className="skill-card-name">
                          {info.name}
                        </div>

                        {recommended && (
                          <span className="recommended-badge">
                            <Target size={11} />
                            Priority
                          </span>
                        )}
                      </div>

                      <ChevronRight
                        size={17}
                        className="skill-arrow"
                      />
                    </div>

                    <div className="skill-score-row">
                      <span>
                        Profile score
                      </span>

                      <strong>
                        {score !== null
                          ? `${score.toFixed(2)}%`
                          : '—'}
                      </strong>
                    </div>
                  </button>
                );
              }
            )}
          </div>

          <div className="priority-info">
            <Target size={17} />

            <div>
              <strong>Why this order?</strong>
              <p>
                Training begins with the cognitive
                skills showing the greatest need
                for improvement.
              </p>
            </div>
          </div>
        </aside>

        <main className="training-main">
          {!question &&
            !loading && (
              <EmptyState
                icon={Brain}
                title={
                  selected
                    ? `Ready to practice ${getSkillInfo(selected).name}`
                    : 'Choose a cognitive skill'
                }
                description={
                  selected
                    ? 'Start a training session to receive a question adapted to your current cognitive profile.'
                    : 'Select a skill from the list to begin adaptive cognitive training.'
                }
              />
            )}

          {loading && !question && (
            <div className="training-loading">
              <div className="loading-icon">
                <Loader2
                  size={34}
                  className="spin"
                />
              </div>

              <h3>
                Preparing your training question
              </h3>

              <p>
                Selecting a question for your
                current cognitive skill level...
              </p>
            </div>
          )}

          {question && !feedback && (
            <div className="question-card">
              <div className="question-header">
                <div>
                  <div className="question-skill">
                    {getSkillInfo(selected).name}
                  </div>

                  <h2>Cognitive Training</h2>
                </div>

                <div className="difficulty-badge">
                  {question.difficulty ||
                    'Adaptive'}
                </div>
              </div>

              <div className="question-body">
                <div className="question-number-label">
                  Practice Question
                </div>

                <p className="question-text">
                  {question.question}
                </p>
              </div>

              {isPratyakshaQuestion ? (
                <div className="visual-training-area">
                  {question.image ? (
                    <div className="training-visual-image">
                      <img
                        src={`${API_URL}/api/assessment/image/${encodeURIComponent(
                          question.image
                        )}`}
                        alt="Visual reasoning question"
                        onError={(event) => {
                          event.currentTarget.style.display =
                            'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="training-image-missing">
                      <span>
                        Visual question image unavailable.
                      </span>
                    </div>
                  )}

                  <div className="training-open-ended">
                    <label htmlFor="training-answer">
                      Your Answer
                    </label>

                    <input
                      id="training-answer"
                      type="text"
                      value={selectedOption}
                      onChange={(event) =>
                        setSelectedOption(
                          event.target.value
                        )
                      }
                      placeholder="Type your answer..."
                      autoComplete="off"
                      disabled={loading}
                    />
                  </div>
                </div>
              ) : (
                Array.isArray(
                  question.options
                ) &&
                question.options.length > 0 && (
                  <div className="options-list">
                    {question.options.map(
                      (option, index) => {
                        const active =
                          selectedOption ===
                          option;

                        return (
                          <button
                            key={`${option}-${index}`}
                            type="button"
                            className={[
                              'training-option',
                              active
                                ? 'selected'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() =>
                              setSelectedOption(
                                option
                              )
                            }
                            disabled={loading}
                          >
                            <span className="option-letter">
                              {String.fromCharCode(
                                65 + index
                              )}
                            </span>

                            <span>{option}</span>

                            {active && (
                              <CheckCircle
                                size={19}
                              />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                )
              )}

              <div className="question-actions">
                <button
                  type="button"
                  className="secondary-training-button"
                  onClick={changeSkill}
                  disabled={loading}
                >
                  Change Skill
                </button>

                <button
                  type="button"
                  className="primary-training-button"
                  onClick={submit}
                  disabled={
                    loading ||
                    !selectedOption
                  }
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={18}
                        className="spin"
                      />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      Submit Answer
                      <ChevronRight
                        size={18}
                      />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {feedback && (
            <div className="feedback-card">
              <div
                className={[
                  'feedback-result',
                  feedback.correct
                    ? 'correct'
                    : 'incorrect',
                ].join(' ')}
              >
                <div className="feedback-result-icon">
                  {feedback.correct ? (
                    <CheckCircle size={30} />
                  ) : (
                    <XCircle size={30} />
                  )}
                </div>

                <div>
                  <span>
                    {feedback.correct
                      ? 'Correct Answer'
                      : 'Keep Practicing'}
                  </span>

                  <h2>
                    {feedback.score !== undefined
                      ? `${Number(
                          feedback.score
                        ).toFixed(2)}%`
                      : 'Evaluated'}
                  </h2>
                </div>
              </div>

              {feedback.feedback && (
                <div className="feedback-section">
                  <div className="feedback-section-title">
                    Feedback
                  </div>
                  <p>
                    {feedback.feedback}
                  </p>
                </div>
              )}

              {feedback.reasoning_feedback && (
                <div className="feedback-section">
                  <div className="feedback-section-title">
                    Reasoning Analysis
                  </div>
                  <p>
                    {feedback.reasoning_feedback}
                  </p>
                </div>
              )}

              {feedback.suggested_improvement && (
                <div className="feedback-improvement">
                  <div className="improvement-icon">
                    <TrendingUp size={19} />
                  </div>

                  <div>
                    <strong>
                      Suggested Improvement
                    </strong>
                    <p>
                      {feedback.suggested_improvement}
                    </p>
                  </div>
                </div>
              )}

              {feedback.next_difficulty && (
                <div className="next-difficulty">
                  <Zap size={17} />
                  <span>
                    Next question difficulty:
                  </span>
                  <strong>
                    {feedback.next_difficulty}
                  </strong>
                </div>
              )}

              <div className="feedback-actions">
                <button
                  type="button"
                  className="secondary-training-button"
                  onClick={changeSkill}
                >
                  Change Skill
                </button>

                <button
                  type="button"
                  className="primary-training-button"
                  onClick={nextQuestion}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={18}
                        className="spin"
                      />
                      Preparing...
                    </>
                  ) : (
                    <>
                      Next Question
                      <ChevronRight
                        size={18}
                      />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <div className="training-footer-note">
        <Lock size={14} />
        <span>
          Your Cognitive Profile determines which
          skills receive priority. Training
          performance is tracked separately and
          does not overwrite your assessment
          results.
        </span>
      </div>
    </div>
  );
}
  ``