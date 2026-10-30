import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import { api } from '../api/client';

import './AssessmentReview.css';


// =========================================================
// COGNITIVE DIMENSIONS
// =========================================================

const dimensions = [
  {
    key: 'anumana',
    name: 'Anumāna',
    skill: 'Logical Reasoning',
    icon: '∴',
  },
  {
    key: 'arthapatti',
    name: 'Arthāpatti',
    skill: 'Abductive Reasoning',
    icon: '◈',
  },
  {
    key: 'upamana',
    name: 'Upamāna',
    skill: 'Analogical Reasoning',
    icon: '≈',
  },
  {
    key: 'pratyaksha',
    name: 'Pratyakṣa',
    skill: 'Visual Reasoning',
    icon: '◉',
  },
  {
    key: 'shabda',
    name: 'Śabda',
    skill: 'Reading Comprehension',
    icon: 'Aa',
  },
  {
    key: 'anupalabdhi',
    name: 'Anupalabdhi',
    skill: 'Elimination Reasoning',
    icon: '⊘',
  },
];


// =========================================================
// GENERAL HELPERS
// =========================================================

function firstDefined(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ''
  );
}


function parseNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


function parseOptions(options) {
  if (Array.isArray(options)) {
    return options;
  }

  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch {
      return options
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}


function formatDate(value) {
  if (!value) {
    return 'Assessment attempt';
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString(
      undefined,
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    );
  } catch {
    return String(value);
  }
}


// =========================================================
// QUESTION NORMALIZATION
// =========================================================

function normalizeQuestion(question, index) {
  if (!question) {
    return {
      id: index + 1,
      number: index + 1,
      question: '',
      options: [],
      studentAnswer: '',
      correctAnswer: '',
      correct: false,
      feedback: '',
      explanation: '',
      difficulty: '',
      skill: '',
      dimension: '',
      image: '',
      score: null,
    };
  }

  const studentAnswer = firstDefined(
    question.student_answer,
    question.studentAnswer,
    question.answer,
    question.response,
    question.selected_answer,
    question.selectedAnswer,
    ''
  );

  const correctAnswer = firstDefined(
    question.correct_answer,
    question.correctAnswer,
    question.expected_answer,
    question.expectedAnswer,
    question.answer_key,
    question.answerKey,
    question.correct_option,
    question.correctOption,
    ''
  );

  const rawScore = firstDefined(
    question.score,
    question.question_score,
    question.questionScore,
    null
  );

  const explicitCorrect =
    question.correct !== undefined
      ? Boolean(question.correct)
      : question.is_correct !== undefined
      ? Boolean(question.is_correct)
      : question.isCorrect !== undefined
      ? Boolean(question.isCorrect)
      : null;

  /*
   * If the backend explicitly provides correctness,
   * always trust it.
   *
   * Otherwise, use the question score when available.
   */
  const correct =
    explicitCorrect !== null
      ? explicitCorrect
      : rawScore !== null
      ? Number(rawScore) > 0
      : false;

  return {
    id:
      firstDefined(
        question.id,
        question.question_id,
        question.questionId,
        question._id,
        index + 1
      ),

    number:
      firstDefined(
        question.number,
        question.question_number,
        question.questionNumber,
        index + 1
      ),

    question:
      firstDefined(
        question.question,
        question.question_text,
        question.questionText,
        question.text,
        question.prompt,
        ''
      ),

    options: parseOptions(
      firstDefined(
        question.options,
        question.choices,
        []
      )
    ),

    studentAnswer,

    correctAnswer,

    correct,

    score: rawScore,

    feedback:
      firstDefined(
        question.feedback,
        question.ai_feedback,
        question.aiFeedback,
        question.evaluation_feedback,
        ''
      ),

    explanation:
      firstDefined(
        question.explanation,
        question.reasoning,
        question.reasoning_explanation,
        question.reasoningExplanation,
        ''
      ),

    difficulty:
      firstDefined(
        question.difficulty,
        question.level,
        ''
      ),

    skill:
      firstDefined(
        question.skill,
        question.reasoning_skill,
        question.reasoningSkill,
        ''
      ),

    dimension:
      firstDefined(
        question.dimension,
        question.reasoning_category,
        question.reasoningCategory,
        ''
      ),

    image:
      firstDefined(
        question.image,
        question.image_name,
        question.imageName,
        question.image_file,
        question.imageFile,
        ''
      ),
  };
}


// =========================================================
// DIMENSION NAME
// =========================================================

function getDimensionName(value) {
  if (!value) {
    return 'Cognitive Reasoning';
  }

  const normalized = String(value)
    .toLowerCase()
    .replace(/ā/g, 'a')
    .replace(/ṛ/g, 'r')
    .replace(/ṣ/g, 's');

  const found = dimensions.find((item) => {
    const key = item.key
      .toLowerCase();

    const name = item.name
      .toLowerCase()
      .replace(/ā/g, 'a')
      .replace(/ṛ/g, 'r')
      .replace(/ṣ/g, 's');

    const skill = item.skill
      .toLowerCase();

    return (
      normalized.includes(key) ||
      normalized.includes(name) ||
      normalized.includes(skill)
    );
  });

  return found
    ? found.name
    : String(value);
}


// =========================================================
// ASSESSMENT NORMALIZATION
// =========================================================

function normalizeAssessment(
  assessment,
  index
) {
  if (!assessment) {
    return null;
  }

  const type = String(
    firstDefined(
      assessment.assessment_type,
      assessment.assessmentType,
      assessment.type,
      'post'
    )
  )
    .toLowerCase()
    .trim();

  const attempt =
    type === 'pre'
      ? null
      : firstDefined(
          assessment.attempt,
          assessment.attempt_number,
          assessment.attemptNumber,
          index
        );

  /*
   * Backend normally returns:
   *
   * responses
   * response_details
   * questions
   *
   * Support all three.
   */
  let rawQuestions = firstDefined(
    assessment.questions,
    assessment.response_details,
    assessment.responseDetails,
    assessment.responses,
    []
  );

  /*
   * Some backend structures may wrap the actual
   * question data inside a report object.
   */
  if (
    !Array.isArray(rawQuestions) &&
    assessment.report
  ) {
    rawQuestions = firstDefined(
      assessment.report.questions,
      assessment.report.response_details,
      assessment.report.responses,
      []
    );
  }

  /*
   * Responses can occasionally arrive as an object
   * rather than an array.
   */
  if (
    rawQuestions &&
    typeof rawQuestions === 'object' &&
    !Array.isArray(rawQuestions)
  ) {
    rawQuestions = Object.values(
      rawQuestions
    );
  }

  const questions = Array.isArray(
    rawQuestions
  )
    ? rawQuestions.map(
        (question, questionIndex) =>
          normalizeQuestion(
            question,
            questionIndex
          )
      )
    : [];

  const score = parseNumber(
    firstDefined(
      assessment.overall_score,
      assessment.overallScore,
      assessment.score,
      assessment.total_score,
      assessment.totalScore,
      0
    ),
    0
  );

  const totalQuestions = parseNumber(
    firstDefined(
      assessment.total_questions,
      assessment.totalQuestions,
      questions.length
    ),
    questions.length
  );

  const calculatedCorrectCount =
    questions.filter(
      (question) => question.correct
    ).length;

  const correctCount = parseNumber(
    firstDefined(
      assessment.correct_count,
      assessment.correctCount,
      calculatedCorrectCount
    ),
    calculatedCorrectCount
  );

  const calculatedIncorrectCount =
    Math.max(
      0,
      totalQuestions - correctCount
    );

  const incorrectCount = parseNumber(
    firstDefined(
      assessment.incorrect_count,
      assessment.incorrectCount,
      calculatedIncorrectCount
    ),
    calculatedIncorrectCount
  );

  let title = firstDefined(
    assessment.title,
    assessment.label
  );

  if (!title) {
    title =
      type === 'pre'
        ? 'Pre-Assessment'
        : `Post-Assessment ${
            attempt || index
          }`;
  }

  const date = firstDefined(
    assessment.date,
    assessment.created_at,
    assessment.createdAt,
    assessment.completed_at,
    assessment.completedAt,
    ''
  );

  return {
    ...assessment,

    id:
      firstDefined(
        assessment.id,
        assessment.assessment_id,
        assessment.assessmentId,
        `${type}-${attempt ?? index}`
      ),

    type,

    attempt,

    title,

    date: formatDate(date),

    score,

    overall_score: score,

    total_questions: totalQuestions,

    correct_count: correctCount,

    incorrect_count: incorrectCount,

    questions,
  };
}


// =========================================================
// COMPONENT
// =========================================================

export default function AssessmentReview() {
  const navigate = useNavigate();

  const [
    assessments,
    setAssessments,
  ] = useState([]);

  const [
    selectedAssessment,
    setSelectedAssessment,
  ] = useState('');

  const [
    selectedQuestion,
    setSelectedQuestion,
  ] = useState(0);

  const [
    filter,
    setFilter,
  ] = useState('all');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');


// =========================================================
// LOAD REAL BACKEND DATA
// =========================================================

  const loadReviews = async () => {
    try {
      setLoading(true);
      setError('');

      console.log(
        '[Assessment Review] Loading assessment reviews...'
      );

      const response =
        await api.getAssessmentReviews();

      console.log(
        '[Assessment Review] API response:',
        response
      );

      /*
       * client.js already unwraps:
       *
       * response.data
       *
       * Therefore the normal structure here is:
       *
       * {
       *   total_assessments: ...,
       *   assessments: [...]
       * }
       *
       * The second fallback supports an unwrapped
       * or differently wrapped response as well.
       */
      const rawAssessments =
        response?.assessments ??
        response?.data?.assessments ??
        [];

      const normalized =
        Array.isArray(rawAssessments)
          ? rawAssessments
              .map(
                (assessment, index) =>
                  normalizeAssessment(
                    assessment,
                    index + 1
                  )
              )
              .filter(Boolean)
          : [];

      /*
       * Keep Pre-Assessment first and then
       * Post-Assessment attempts chronologically.
       */
      normalized.sort((a, b) => {
        if (
          a.type === 'pre' &&
          b.type !== 'pre'
        ) {
          return -1;
        }

        if (
          a.type !== 'pre' &&
          b.type === 'pre'
        ) {
          return 1;
        }

        if (
          a.type === 'post' &&
          b.type === 'post'
        ) {
          return (
            Number(a.attempt || 0) -
            Number(b.attempt || 0)
          );
        }

        return 0;
      });

      setAssessments(normalized);

      if (normalized.length > 0) {
        setSelectedAssessment(
          String(normalized[0].id)
        );
      } else {
        setSelectedAssessment('');
      }

      setSelectedQuestion(0);
      setFilter('all');

      console.log(
        '[Assessment Review] Loaded assessments:',
        normalized.length
      );
    } catch (err) {
      console.error(
        '[Assessment Review] Failed to load:',
        err
      );

      setError(
        err?.message ||
          'Unable to load assessment review data.'
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadReviews();
  }, []);


// =========================================================
// CURRENT ASSESSMENT
// =========================================================

  const currentAssessment =
    assessments.find(
      (assessment) =>
        String(assessment.id) ===
        String(selectedAssessment)
    ) ||
    assessments[0] ||
    null;


// =========================================================
// QUESTIONS
// =========================================================

  const questions = useMemo(() => {
    return (
      currentAssessment?.questions || []
    );
  }, [currentAssessment]);


// =========================================================
// FILTER QUESTIONS
// =========================================================

  const filteredQuestions =
    useMemo(() => {
      if (filter === 'correct') {
        return questions.filter(
          (question) =>
            question.correct
        );
      }

      if (filter === 'incorrect') {
        return questions.filter(
          (question) =>
            !question.correct
        );
      }

      return questions;
    }, [questions, filter]);


// =========================================================
// KEEP SELECTED QUESTION VALID
// =========================================================

  useEffect(() => {
    if (
      selectedQuestion >=
      filteredQuestions.length
    ) {
      setSelectedQuestion(
        Math.max(
          0,
          filteredQuestions.length - 1
        )
      );
    }
  }, [
    filteredQuestions.length,
    selectedQuestion,
  ]);


// =========================================================
// ACTIVE QUESTION
// =========================================================

  const activeQuestion =
    filteredQuestions[
      selectedQuestion
    ] || null;


// =========================================================
// COUNTS
// =========================================================

  const correctCount =
    currentAssessment?.correct_count ??
    questions.filter(
      (question) => question.correct
    ).length;

  const incorrectCount =
    currentAssessment?.incorrect_count ??
    Math.max(
      0,
      questions.length - correctCount
    );


// =========================================================
// HANDLERS
// =========================================================

  const handleAssessmentChange = (
    id
  ) => {
    setSelectedAssessment(id);
    setSelectedQuestion(0);
    setFilter('all');
  };


  const handleFilterChange = (
    newFilter
  ) => {
    setFilter(newFilter);
    setSelectedQuestion(0);
  };


  const handleNext = () => {
    if (
      selectedQuestion <
      filteredQuestions.length - 1
    ) {
      setSelectedQuestion(
        (previous) =>
          previous + 1
      );
    }
  };


  const handlePrevious = () => {
    if (selectedQuestion > 0) {
      setSelectedQuestion(
        (previous) =>
          previous - 1
      );
    }
  };


// =========================================================
// PRACTICE THIS SKILL
// =========================================================

  const handlePractice = () => {
    if (!activeQuestion) {
      return;
    }

    const skill =
      activeQuestion.skill ||
      activeQuestion.dimension ||
      '';

    navigate('/training', {
      state: {
        practiceSkill: skill,
        source: 'assessment-review',
      },
    });
  };


// =========================================================
// IMAGE URL
// =========================================================

  const getImageUrl = (
    imageName
  ) => {
    if (!imageName) {
      return '';
    }

    const apiUrl =
      import.meta.env.VITE_API_URL ||
      'http://127.0.0.1:8000';

    return `${apiUrl}/api/assessment/image/${encodeURIComponent(
      imageName
    )}`;
  };


// =========================================================
// LOADING STATE
// =========================================================

  if (loading) {
    return (
      <div className="assessment-review-page">

        <div className="assessment-review-glow glow-one" />
        <div className="assessment-review-glow glow-two" />

        <main className="assessment-review-container">

          <section className="review-empty-state">

            <div className="empty-state-icon">
              ◇
            </div>

            <h2>
              Loading assessment reviews...
            </h2>

            <p>
              Cognita AI is retrieving your
              assessment attempts and question
              results.
            </p>

          </section>

        </main>

      </div>
    );
  }


// =========================================================
// ERROR STATE
// =========================================================

  if (error) {
    return (
      <div className="assessment-review-page">

        <div className="assessment-review-glow glow-one" />
        <div className="assessment-review-glow glow-two" />

        <main className="assessment-review-container">

          <section className="review-empty-state">

            <div className="empty-state-icon">
              !
            </div>

            <h2>
              Unable to load assessment reviews
            </h2>

            <p>
              {error}
            </p>

            <button
              onClick={loadReviews}
            >
              Try Again
            </button>

          </section>

        </main>

      </div>
    );
  }


// =========================================================
// NO DATA STATE
// =========================================================

  if (!assessments.length) {
    return (
      <div className="assessment-review-page">

        <div className="assessment-review-glow glow-one" />
        <div className="assessment-review-glow glow-two" />

        <main className="assessment-review-container">

          <section className="review-header">

            <div>

              <div className="review-eyebrow">
                <span className="eyebrow-dot" />
                LEARNING INSIGHTS
              </div>

              <h1>
                Assessment Review
              </h1>

              <p>
                Review your answers, understand
                your mistakes, and strengthen the
                reasoning skills that need more
                practice.
              </p>

            </div>

            <button
              className="back-dashboard-button"
              onClick={() =>
                navigate('/progress')
              }
            >
              <span>←</span>
              Back to Progress
            </button>

          </section>


          <section className="question-review-section">

            <div className="review-empty-state">

              <div className="empty-state-icon">
                ◇
              </div>

              <h2>
                No assessment results yet
              </h2>

              <p>
                Complete your assessment first.
                Once your results are saved,
                Cognita AI will show your answers,
                correct answers, feedback, and
                reasoning explanations here.
              </p>

              <button
                onClick={() =>
                  navigate('/assessment')
                }
              >
                Take Pre-Assessment
              </button>

            </div>

          </section>

        </main>

      </div>
    );
  }


// =========================================================
// MAIN UI
// =========================================================

  return (
    <div className="assessment-review-page">

      <div className="assessment-review-glow glow-one" />
      <div className="assessment-review-glow glow-two" />

      <main className="assessment-review-container">


        {/* =================================================
            HEADER
        ================================================= */}

        <section className="review-header">

          <div>

            <div className="review-eyebrow">
              <span className="eyebrow-dot" />
              LEARNING INSIGHTS
            </div>

            <h1>
              Assessment Review
            </h1>

            <p>
              Review your answers, understand
              your mistakes, and strengthen the
              reasoning skills that need more
              practice.
            </p>

          </div>

          <button
            className="back-dashboard-button"
            onClick={() =>
              navigate('/progress')
            }
          >
            <span>←</span>
            Back to Progress
          </button>

        </section>


        {/* =================================================
            ASSESSMENT SELECTOR
        ================================================= */}

        <section className="assessment-selector-card">

          <div className="selector-heading">

            <div className="selector-icon">
              ⌘
            </div>

            <div>

              <h2>
                Choose an assessment
              </h2>

              <p>
                Compare your answers across
                different assessment attempts.
              </p>

            </div>

          </div>


          <div className="assessment-tabs">

            {assessments.map(
              (assessment) => {

                const isActive =
                  String(
                    assessment.id
                  ) ===
                  String(
                    selectedAssessment
                  );

                return (
                  <button
                    key={
                      assessment.id
                    }
                    className={`assessment-tab ${
                      isActive
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      handleAssessmentChange(
                        assessment.id
                      )
                    }
                  >

                    <span className="tab-indicator">

                      {assessment.type ===
                      'pre'
                        ? 'P'
                        : `P${
                            assessment.attempt ||
                            ''
                          }`}

                    </span>


                    <span className="tab-content">

                      <strong>
                        {
                          assessment.title
                        }
                      </strong>

                      <small>
                        {assessment.type ===
                        'pre'
                          ? 'Initial Assessment'
                          : 'Training Cycle'}
                      </small>

                    </span>


                    <span className="tab-arrow">
                      →
                    </span>

                  </button>
                );
              }
            )}

          </div>

        </section>


        {/* =================================================
            SUMMARY
        ================================================= */}

        <section className="review-summary-grid">


          <div className="summary-card score-summary">

            <div className="summary-label">
              OVERALL SCORE
            </div>

            <div className="score-value">

              {currentAssessment?.score ??
                '--'}

              <span>
                /100
              </span>

            </div>

            <div className="score-caption">

              {currentAssessment?.type ===
              'pre'
                ? 'Starting point'
                : 'Assessment performance'}

            </div>

          </div>


          <div className="summary-card">

            <div className="summary-icon correct-icon">
              ✓
            </div>

            <div>

              <div className="summary-label">
                CORRECT
              </div>

              <div className="summary-number">
                {questions.length
                  ? correctCount
                  : '--'}
              </div>

              <div className="summary-caption">
                Questions answered correctly
              </div>

            </div>

          </div>


          <div className="summary-card">

            <div className="summary-icon incorrect-icon">
              ×
            </div>

            <div>

              <div className="summary-label">
                NEEDS REVIEW
              </div>

              <div className="summary-number">
                {questions.length
                  ? incorrectCount
                  : '--'}
              </div>

              <div className="summary-caption">
                Opportunities to improve
              </div>

            </div>

          </div>


          <div className="summary-card">

            <div className="summary-icon skill-icon">
              ◇
            </div>

            <div>

              <div className="summary-label">
                QUESTIONS
              </div>

              <div className="summary-number">
                {questions.length ||
                  currentAssessment?.total_questions ||
                  '--'}
              </div>

              <div className="summary-caption">
                Total reviewed questions
              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            QUESTION REVIEW
        ================================================= */}

        <section className="question-review-section">

          <div className="review-section-header">

            <div>

              <div className="section-kicker">
                QUESTION-BY-QUESTION REVIEW
              </div>

              <h2>
                Learn from your answers
              </h2>

              <p>
                See what you answered, what the
                expected answer was, and why.
              </p>

            </div>


            <div className="review-filter">

              <button
                className={
                  filter === 'all'
                    ? 'filter-button active'
                    : 'filter-button'
                }
                onClick={() =>
                  handleFilterChange(
                    'all'
                  )
                }
              >
                All
              </button>


              <button
                className={
                  filter === 'incorrect'
                    ? 'filter-button active incorrect'
                    : 'filter-button'
                }
                onClick={() =>
                  handleFilterChange(
                    'incorrect'
                  )
                }
              >
                Needs Review
              </button>


              <button
                className={
                  filter === 'correct'
                    ? 'filter-button active correct'
                    : 'filter-button'
                }
                onClick={() =>
                  handleFilterChange(
                    'correct'
                  )
                }
              >
                Correct
              </button>

            </div>

          </div>


          <div className="review-workspace">


            {/* =================================================
                QUESTION SIDEBAR
            ================================================= */}

            <aside className="question-sidebar">

              <div className="question-sidebar-header">

                <span>
                  Questions
                </span>

                <span>
                  {
                    filteredQuestions.length
                  }
                </span>

              </div>


              <div className="question-list">

                {filteredQuestions.length >
                0 ? (

                  filteredQuestions.map(
                    (
                      question,
                      index
                    ) => (

                      <button
                        key={`${question.id}-${index}`}
                        className={`question-list-item ${
                          selectedQuestion ===
                          index
                            ? 'active'
                            : ''
                        }`}
                        onClick={() =>
                          setSelectedQuestion(
                            index
                          )
                        }
                      >

                        <span className="question-number">

                          {String(
                            question.number
                          ).padStart(
                            2,
                            '0'
                          )}

                        </span>


                        <span className="question-list-text">

                          Question{' '}
                          {
                            question.number
                          }

                        </span>


                        <span
                          className={
                            question.correct
                              ? 'status-dot correct'
                              : 'status-dot incorrect'
                          }
                        >

                          {question.correct
                            ? '✓'
                            : '×'}

                        </span>

                      </button>

                    )
                  )

                ) : (

                  <div className="empty-question-list">

                    <div>
                      ◇
                    </div>

                    <p>
                      No questions match
                      this filter.
                    </p>

                  </div>

                )}

              </div>

            </aside>


            {/* =================================================
                QUESTION DETAIL
            ================================================= */}

            <div className="question-detail">

              {activeQuestion ? (

                <>


                  {/* QUESTION TOPBAR */}

                  <div className="question-topbar">

                    <div className="question-meta">

                      <span className="question-counter">

                        Question{' '}
                        {
                          activeQuestion.number
                        }

                      </span>


                      {activeQuestion.difficulty && (

                        <span className="difficulty-badge">

                          {
                            activeQuestion.difficulty
                          }

                        </span>

                      )}


                      {(activeQuestion.skill ||
                        activeQuestion.dimension) && (

                        <span className="skill-badge">

                          {getDimensionName(
                            activeQuestion.skill ||
                              activeQuestion.dimension
                          )}

                        </span>

                      )}

                    </div>


                    <div
                      className={
                        activeQuestion.correct
                          ? 'result-badge correct'
                          : 'result-badge incorrect'
                      }
                    >

                      <span>
                        {activeQuestion.correct
                          ? '✓'
                          : '×'}
                      </span>

                      {activeQuestion.correct
                        ? 'Correct'
                        : 'Needs Review'}

                    </div>

                  </div>


                  {/* QUESTION CARD */}

                  <div className="question-card">

                    <div className="question-card-label">
                      QUESTION
                    </div>


                    <h3>
                      {
                        activeQuestion.question ||
                        'Question details are not available.'
                      }
                    </h3>


                    {/* VISUAL QUESTION */}

                    {activeQuestion.image && (

                      <div className="review-image-container">

                        <img
                          src={getImageUrl(
                            activeQuestion.image
                          )}
                          alt="Visual reasoning question"
                          onError={(
                            event
                          ) => {
                            event.currentTarget.style.display =
                              'none';
                          }}
                        />

                      </div>

                    )}


                    {/* OPTIONS */}

                    {activeQuestion.options
                      ?.length > 0 && (

                      <div className="review-options">

                        {activeQuestion.options.map(
                          (
                            option,
                            index
                          ) => {

                            const optionText =
                              typeof option ===
                              'object'
                                ? firstDefined(
                                    option.text,
                                    option.label,
                                    option.value,
                                    ''
                                  )
                                : option;

                            const normalizedOption =
                              String(
                                optionText
                              )
                                .trim()
                                .toLowerCase();

                            const normalizedStudent =
                              String(
                                activeQuestion.studentAnswer ??
                                  ''
                              )
                                .trim()
                                .toLowerCase();

                            const normalizedCorrect =
                              String(
                                activeQuestion.correctAnswer ??
                                  ''
                              )
                                .trim()
                                .toLowerCase();

                            const isStudentAnswer =
                              normalizedOption ===
                              normalizedStudent;

                            const isCorrectAnswer =
                              normalizedOption ===
                              normalizedCorrect;

                            let optionClass =
                              'review-option';

                            if (
                              isCorrectAnswer
                            ) {
                              optionClass +=
                                ' correct-option';
                            }

                            if (
                              isStudentAnswer &&
                              !isCorrectAnswer
                            ) {
                              optionClass +=
                                ' wrong-option';
                            }

                            return (

                              <div
                                key={index}
                                className={
                                  optionClass
                                }
                              >

                                <span className="option-letter">

                                  {String.fromCharCode(
                                    65 +
                                      index
                                  )}

                                </span>


                                <span className="option-text">

                                  {
                                    optionText
                                  }

                                </span>


                                {isCorrectAnswer && (

                                  <span className="option-status">
                                    ✓ Correct
                                  </span>

                                )}


                                {isStudentAnswer &&
                                  !isCorrectAnswer && (

                                  <span className="option-status wrong">
                                    Your answer
                                  </span>

                                )}

                              </div>

                            );
                          }
                        )}

                      </div>

                    )}

                  </div>


                  {/* ANSWER COMPARISON */}

                  <div className="answer-comparison">

                    <div className="answer-box student-answer">

                      <div className="answer-box-header">

                        <span className="answer-icon">
                          YOU
                        </span>

                        <span>
                          Your answer
                        </span>

                      </div>


                      <div className="answer-content">

                        {
                          activeQuestion.studentAnswer ||
                          'No answer recorded.'
                        }

                      </div>

                    </div>


                    <div className="answer-box expected-answer">

                      <div className="answer-box-header">

                        <span className="answer-icon">
                          ✓
                        </span>

                        <span>
                          Correct answer
                        </span>

                      </div>


                      <div className="answer-content">

                        {
                          activeQuestion.correctAnswer ||
                          'Correct answer information is not available.'
                        }

                      </div>

                    </div>

                  </div>


                  {/* AI FEEDBACK */}

                  {(activeQuestion.feedback ||
                    activeQuestion.explanation) && (

                    <div className="learning-card">

                      <div className="learning-card-header">

                        <div className="learning-icon">
                          ✦
                        </div>

                        <div>

                          <div className="learning-kicker">
                            COGNITA INSIGHT
                          </div>

                          <h3>
                            Understand the reasoning
                          </h3>

                        </div>

                      </div>


                      {activeQuestion.feedback && (

                        <div className="feedback-block">

                          <div className="feedback-label">
                            FEEDBACK
                          </div>

                          <p>
                            {
                              activeQuestion.feedback
                            }
                          </p>

                        </div>

                      )}


                      {activeQuestion.explanation && (

                        <div className="feedback-block">

                          <div className="feedback-label">
                            WHY THIS ANSWER WORKS
                          </div>

                          <p>
                            {
                              activeQuestion.explanation
                            }
                          </p>

                        </div>

                      )}

                    </div>

                  )}


                  {/* PRACTICE */}

                  <div className="practice-card">

                    <div className="practice-content">

                      <span className="practice-icon">
                        ↗
                      </span>

                      <div>

                        <div className="practice-kicker">
                          KEEP IMPROVING
                        </div>

                        <h3>
                          Practice this reasoning skill
                        </h3>

                        <p>
                          Continue with adaptive
                          questions focused on this
                          area.
                        </p>

                      </div>

                    </div>


                    <button
                      className="practice-button"
                      onClick={
                        handlePractice
                      }
                    >
                      Practice This Skill
                      <span>
                        →
                      </span>
                    </button>

                  </div>


                  {/* NAVIGATION */}

                  <div className="question-navigation">

                    <button
                      className="navigation-button"
                      disabled={
                        selectedQuestion ===
                        0
                      }
                      onClick={
                        handlePrevious
                      }
                    >
                      ← Previous
                    </button>


                    <span>
                      {
                        selectedQuestion +
                        1
                      }{' '}
                      /{' '}
                      {
                        filteredQuestions.length
                      }
                    </span>


                    <button
                      className="navigation-button primary"
                      disabled={
                        selectedQuestion >=
                        filteredQuestions.length -
                          1
                      }
                      onClick={
                        handleNext
                      }
                    >
                      Next Question →
                    </button>

                  </div>

                </>

              ) : (

                <div className="review-empty-state">

                  <div className="empty-state-icon">
                    ◇
                  </div>

                  <h2>
                    No question available
                  </h2>

                  <p>
                    There are no questions available
                    for this assessment or filter.
                  </p>

                </div>

              )}

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}