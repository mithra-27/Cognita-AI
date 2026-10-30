import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Brain,
  Eye,
  Send,
} from 'lucide-react';

import './AssessmentRunner.css';

/* =========================================================
   COGNITIVE DIMENSIONS
   ========================================================= */

const DIMENSIONS = [
  {
    key: 'anumana',
    name: 'Anumāna',
    description:
      'Logical / inferential reasoning',
  },

  {
    key: 'arthapatti',
    name: 'Arthāpatti',
    description:
      'Abductive reasoning / problem solving',
  },

  {
    key: 'upamana',
    name: 'Upamāna',
    description:
      'Analogical reasoning',
  },

  {
    key: 'pratyaksha',
    name: 'Pratyakṣa',
    description:
      'Observation / visual reasoning',
  },

  {
    key: 'shabda',
    name: 'Śabda',
    description:
      'Reading comprehension / interpretation',
  },

  {
    key: 'anupalabdhi',
    name: 'Anupalabdhi',
    description:
      'Absence / contradiction / elimination reasoning',
  },
];

const QUESTIONS_PER_DIMENSION = 5;

const TOTAL_QUESTIONS =
  DIMENSIONS.length *
  QUESTIONS_PER_DIMENSION;


/* =========================================================
   API BASE URL
   ========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';


/* =========================================================
   NORMALIZE DIMENSION
   ========================================================= */

function normalizeDimension(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ṣ/g, 's')
    .replace(/ś/g, 's')
    .replace(/ā/g, 'a')
    .replace(/ṭ/g, 't')
    .replace(/ḍ/g, 'd')
    .replace(/ṇ/g, 'n')
    .replace(/ṃ/g, 'm')
    .replace(/ū/g, 'u')
    .replace(/ī/g, 'i')
    .replace(/āp/g, 'ap')
    .replace(/\s+/g, '')
    .trim();
}


/* =========================================================
   GET QUESTION DIMENSION
   ========================================================= */

function getQuestionDimension(question) {
  return normalizeDimension(
    question?.reasoning_category ||
      question?.dimension ||
      question?.skill ||
      ''
  );
}


/* =========================================================
   GET QUESTION ID
   ========================================================= */

function getQuestionId(question) {
  return (
    question?.id ||
    question?.question_id ||
    question?.questionId ||
    ''
  );
}


/* =========================================================
   VISUAL QUESTION
   ========================================================= */

function isVisualQuestion(question) {
  return (
    question?.question_type ===
      'visual_open_ended' ||
    getQuestionDimension(question) ===
      'pratyaksha'
  );
}


/* =========================================================
   CLEAN DATASET QUESTION TEXT
   =========================================================

   Some datasets may contain metadata inside the
   question field.

   The student must NEVER see:
   - Correct Answer
   - Correct Hypothesis
   - Answer
   - Label
   - Reasoning Skill
   - Options
   - dataset metadata
   ========================================================= */

function getDisplayQuestion(value) {
  if (!value) {
    return '';
  }

  let text = String(value).trim();

  /*
   * Remove Options section.
   */
  text = text.replace(
    /\s*Options\s*:\s*(?:\[.*|\{.*|.*)$/is,
    ''
  );

  /*
   * Remove Correct Hypothesis.
   */
  text = text.replace(
    /\s*Correct\s+Hypothesis\s*:\s*.*$/is,
    ''
  );

  /*
   * Remove Correct Answer.
   */
  text = text.replace(
    /\s*Correct\s+Answer\s*:\s*.*$/is,
    ''
  );

  /*
   * Remove Correct option.
   */
  text = text.replace(
    /\s*Correct\s+Option\s*:\s*.*$/is,
    ''
  );

  /*
   * Remove Answer.
   */
  text = text.replace(
    /\s*(?:Correct\s+)?Answer\s*:\s*.*$/is,
    ''
  );

  /*
   * Remove Label.
   */
  text = text.replace(
    /\s*Label\s*:\s*.*$/is,
    ''
  );

  /*
   * Remove Reasoning Skill.
   */
  text = text.replace(
    /\s*Reasoning\s+Skill\s*:\s*.*$/is,
    ''
  );

  /*
   * Remove dataset/source metadata if accidentally
   * included in the question string.
   */
  text = text.replace(
    /\s*(?:Dataset|Source)\s*:\s*.*$/is,
    ''
  );

  return text.trim();
}


/* =========================================================
   CLEAN OPTION
   ========================================================= */

function getDisplayOption(option) {
  if (
    option === null ||
    option === undefined
  ) {
    return '';
  }

  let text = String(option).trim();

  /*
   * Remove surrounding quotes.
   */
  if (
    text.length >= 2 &&
    (
      (
        text.startsWith('"') &&
        text.endsWith('"')
      ) ||
      (
        text.startsWith("'") &&
        text.endsWith("'")
      )
    )
  ) {
    text = text.slice(1, -1);
  }

  /*
   * Remove accidental answer metadata
   * from option strings.
   */
  text = text.replace(
    /\s*Correct\s+Answer\s*:\s*.*$/is,
    ''
  );

  return text.trim();
}


/* =========================================================
   IMAGE URL
   ========================================================= */

function getImageUrl(imageName) {
  if (!imageName) {
    return '';
  }

  return `${API_URL}/api/assessment/image/${encodeURIComponent(
    imageName
  )}`;
}


/* =========================================================
   COMPONENT
   ========================================================= */

export default function AssessmentRunner({
  title = 'Assessment',
  badgeLabel = 'Begin Assessment',
  loadQuestions,
  submitAnswers,
}) {
  const [questions, setQuestions] =
    useState([]);

  const [answers, setAnswers] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [started, setStarted] =
    useState(false);

  const [completed, setCompleted] =
    useState(false);

  const [
    currentDimensionIndex,
    setCurrentDimensionIndex,
  ] = useState(0);

  const [
    currentQuestionIndex,
    setCurrentQuestionIndex,
  ] = useState(0);

  const [
    imageError,
    setImageError,
  ] = useState(false);


  /* =======================================================
     CURRENT DIMENSION
     ======================================================= */

  const currentDimension =
    DIMENSIONS[
      currentDimensionIndex
    ] || DIMENSIONS[0];


  /* =======================================================
     GROUP QUESTIONS BY DIMENSION
     ======================================================= */

  const groupedQuestions = useMemo(() => {
    const grouped = {};

    DIMENSIONS.forEach(
      (dimension) => {
        grouped[dimension.key] = [];
      }
    );

    questions.forEach(
      (question) => {
        const dimension =
          getQuestionDimension(question);

        if (grouped[dimension]) {
          grouped[dimension].push(
            question
          );
        }
      }
    );

    return grouped;
  }, [questions]);


  /* =======================================================
     CURRENT QUESTIONS
     ======================================================= */

  const currentQuestions =
    groupedQuestions[
      currentDimension.key
    ] || [];

  const currentQuestion =
    currentQuestions[
      currentQuestionIndex
    ] || null;


  /* =======================================================
     LOAD ASSESSMENT
     ======================================================= */

  useEffect(() => {
    startAssessment();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function startAssessment() {
    setLoading(true);
    setError('');
    setStarted(false);
    setCompleted(false);

    setCurrentDimensionIndex(0);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setImageError(false);

    try {
      const response =
        await loadQuestions();

      const loadedQuestions =
        response?.data?.questions ||
        response?.questions ||
        [];

      if (
        !Array.isArray(
          loadedQuestions
        )
      ) {
        throw new Error(
          'Invalid assessment response from server.'
        );
      }

      if (
        loadedQuestions.length === 0
      ) {
        throw new Error(
          'No assessment questions were returned.'
        );
      }


      /* ===================================================
         VERIFY SIX DIMENSIONS
         =================================================== */

      const missingDimensions =
        DIMENSIONS.filter(
          (dimension) => {
            const count =
              loadedQuestions.filter(
                (question) =>
                  getQuestionDimension(
                    question
                  ) === dimension.key
              ).length;

            return (
              count <
              QUESTIONS_PER_DIMENSION
            );
          }
        );


      if (
        missingDimensions.length > 0
      ) {
        const names =
          missingDimensions
            .map(
              (dimension) =>
                dimension.name
            )
            .join(', ');

        throw new Error(
          `The assessment could not prepare 5 questions for: ${names}.`
        );
      }


      /* ===================================================
         VERIFY QUESTION IDs
         =================================================== */

      const invalidQuestions =
        loadedQuestions.filter(
          (question) =>
            !getQuestionId(question)
        );


      if (
        invalidQuestions.length > 0
      ) {
        throw new Error(
          'Some assessment questions are missing question IDs.'
        );
      }


      /* ===================================================
         VERIFY TOTAL
         =================================================== */

      if (
        loadedQuestions.length <
        TOTAL_QUESTIONS
      ) {
        throw new Error(
          `Expected ${TOTAL_QUESTIONS} questions but received ${loadedQuestions.length}.`
        );
      }


      setQuestions(
        loadedQuestions
      );

      setAnswers({});

      setCurrentDimensionIndex(0);
      setCurrentQuestionIndex(0);

      setStarted(true);
      setCompleted(false);

    } catch (err) {
      console.error(
        'Assessment loading error:',
        err
      );

      setError(
        err?.message ||
          'The assessment could not be prepared. Please try again.'
      );

      setStarted(false);

    } finally {
      setLoading(false);
    }
  }


  /* =======================================================
     STORE ANSWER
     ======================================================= */

  function handleAnswer(
    questionId,
    answer
  ) {
    setAnswers(
      (previous) => ({
        ...previous,
        [questionId]: answer,
      })
    );

    setError('');
  }


  /* =======================================================
     CURRENT ANSWER
     ======================================================= */

  function hasCurrentAnswer() {
    if (!currentQuestion) {
      return false;
    }

    const questionId =
      getQuestionId(
        currentQuestion
      );

    const answer =
      answers[questionId];

    return (
      answer !== undefined &&
      answer !== null &&
      String(answer).trim() !== ''
    );
  }


  /* =======================================================
     NEXT QUESTION
     ======================================================= */

  function handleNext() {
    if (!hasCurrentAnswer()) {
      setError(
        'Please answer this question before continuing.'
      );
      return;
    }

    setError('');

    /*
     * More questions in current dimension.
     */
    if (
      currentQuestionIndex <
      currentQuestions.length - 1
    ) {
      setCurrentQuestionIndex(
        (previous) =>
          previous + 1
      );

      setImageError(false);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });

      return;
    }


    /*
     * Move to next dimension.
     */
    if (
      currentDimensionIndex <
      DIMENSIONS.length - 1
    ) {
      setCurrentDimensionIndex(
        (previous) =>
          previous + 1
      );

      setCurrentQuestionIndex(0);

      setImageError(false);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });

      return;
    }


    /*
     * All 30 questions completed.
     */
    handleSubmit();
  }


  /* =======================================================
     PREVIOUS QUESTION
     ======================================================= */

  function handlePrevious() {
    setError('');

    /*
     * Previous question within
     * current dimension.
     */
    if (
      currentQuestionIndex > 0
    ) {
      setCurrentQuestionIndex(
        (previous) =>
          previous - 1
      );

      setImageError(false);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });

      return;
    }


    /*
     * Previous dimension.
     */
    if (
      currentDimensionIndex > 0
    ) {
      const previousDimensionIndex =
        currentDimensionIndex - 1;

      const previousDimension =
        DIMENSIONS[
          previousDimensionIndex
        ];

      const previousQuestions =
        groupedQuestions[
          previousDimension.key
        ] || [];

      setCurrentDimensionIndex(
        previousDimensionIndex
      );

      setCurrentQuestionIndex(
        Math.max(
          previousQuestions.length - 1,
          0
        )
      );

      setImageError(false);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }


  /* =======================================================
     SUBMIT ASSESSMENT
     ======================================================= */

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    /*
     * Make sure every question has
     * an answer.
     */
    const unanswered =
      questions.filter(
        (question) => {
          const questionId =
            getQuestionId(
              question
            );

          const answer =
            answers[questionId];

          return (
            answer === undefined ||
            answer === null ||
            String(answer).trim() === ''
          );
        }
      );


    if (unanswered.length > 0) {
      setError(
        `Please answer all questions. ${unanswered.length} question(s) remaining.`
      );

      return;
    }


    setSubmitting(true);
    setError('');


    try {
      /*
       * Convert frontend answer state
       * into backend response format.
       */
      const responses =
        questions.map(
          (question) => {
            const questionId =
              getQuestionId(
                question
              );

            return {
              question_id:
                questionId,

              student_answer:
                String(
                  answers[
                    questionId
                  ] ?? ''
                ).trim(),
            };
          }
        );


      /*
       * IMPORTANT:
       *
       * submitAnswers() will wrap this
       * array as:
       *
       * {
       *   responses: [...]
       * }
       */
      console.log(
        'Submitting assessment responses:',
        responses
      );


      if (
        responses.length !==
        TOTAL_QUESTIONS
      ) {
        throw new Error(
          `Expected ${TOTAL_QUESTIONS} responses but prepared ${responses.length}.`
        );
      }


      const result =
        await submitAnswers(
          responses
        );


      console.log(
        'Assessment submitted successfully:',
        result
      );


      setCompleted(true);

    } catch (err) {
      console.error(
        'Assessment submission error:',
        err
      );

      setError(
        err?.message ||
          'Unable to submit the assessment. Please try again.'
      );

    } finally {
      setSubmitting(false);
    }
  }


  /* =======================================================
     PROGRESS
     ======================================================= */

  const totalQuestions =
    TOTAL_QUESTIONS;

  const answeredQuestions =
    questions.filter(
      (question) => {
        const questionId =
          getQuestionId(
            question
          );

        const answer =
          answers[questionId];

        return (
          answer !== undefined &&
          answer !== null &&
          String(answer).trim() !== ''
        );
      }
    ).length;


  const progress =
    totalQuestions > 0
      ? Math.round(
          (
            answeredQuestions /
            totalQuestions
          ) * 100
        )
      : 0;


  /* =======================================================
     LOADING SCREEN
     ======================================================= */

  if (loading) {
    return (
      <div className="assessment-page">
        <div className="assessment-card loading-card">

          <Brain size={42} />

          <h2>
            Preparing your assessment...
          </h2>

          <p>
            Retrieving questions from
            the cognitive reasoning
            knowledge base.
          </p>

          <div className="assessment-loader" />

        </div>
      </div>
    );
  }


  /* =======================================================
     INITIAL ERROR SCREEN
     ======================================================= */

  if (
    error &&
    !started
  ) {
    return (
      <div className="assessment-page">

        <div className="assessment-card error-card">

          <div className="error-icon">
            !
          </div>

          <h2>
            Assessment unavailable
          </h2>

          <p>
            {error}
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={
              startAssessment
            }
          >
            Try Again
          </button>

        </div>

      </div>
    );
  }


  /* =======================================================
     COMPLETION SCREEN
     ======================================================= */

  if (completed) {
    return (
      <div className="assessment-page">

        <div className="assessment-card completion-card">

          <div className="completion-icon">
            <CheckCircle2 size={54} />
          </div>

          <h1>
            Assessment Completed
          </h1>

          <p>
            Your responses have been
            submitted successfully.
          </p>

          <div className="completion-stat">

            <strong>
              {totalQuestions}
            </strong>

            <span>
              Questions Completed
            </span>

          </div>

          <p className="completion-note">
            Your cognitive reasoning
            profile is being prepared
            from your assessment
            responses.
          </p>

        </div>

      </div>
    );
  }


  /* =======================================================
     NO QUESTION
     ======================================================= */

  if (!currentQuestion) {
    return (
      <div className="assessment-page">

        <div className="assessment-card error-card">

          <h2>
            Question unavailable
          </h2>

          <p>
            The current question
            could not be loaded.
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={
              startAssessment
            }
          >
            Reload Assessment
          </button>

        </div>

      </div>
    );
  }


  /* =======================================================
     CURRENT QUESTION DATA
     ======================================================= */

  const questionId =
    getQuestionId(
      currentQuestion
    );

  const visualQuestion =
    isVisualQuestion(
      currentQuestion
    );

  const selectedAnswer =
    answers[questionId] ?? '';

  const displayQuestion =
    getDisplayQuestion(
      currentQuestion.question
    );

  const isLastQuestion =
    currentDimensionIndex ===
      DIMENSIONS.length - 1 &&
    currentQuestionIndex ===
      currentQuestions.length - 1;

  const imageUrl =
    getImageUrl(
      currentQuestion.image
    );


  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="assessment-page">

      {/* =================================================
          HEADER
          ================================================= */}

      <div className="assessment-header">

        <div>

          <div className="assessment-badge">
            {badgeLabel}
          </div>

          <h1>
            {title}
          </h1>

          <p>
            Assess your cognitive
            reasoning across six
            Mīmāṃsā-inspired dimensions.
          </p>

        </div>


        {/* OVERALL PROGRESS */}

        <div className="assessment-progress-box">

          <span>
            Overall Progress
          </span>

          <strong>
            {progress}%
          </strong>

          <div className="progress-track">

            <div
              className="progress-fill"
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

        </div>

      </div>


      {/* =================================================
          DIMENSION NAVIGATION
          ================================================= */}

      <div className="dimension-navigation">

        {DIMENSIONS.map(
          (
            dimension,
            index
          ) => {

            const dimensionQuestions =
              groupedQuestions[
                dimension.key
              ] || [];

            const dimensionAnswered =
              dimensionQuestions.filter(
                (question) => {

                  const id =
                    getQuestionId(
                      question
                    );

                  const answer =
                    answers[id];

                  return (
                    answer !== undefined &&
                    answer !== null &&
                    String(answer).trim() !== ''
                  );
                }
              ).length;

            const active =
              index ===
              currentDimensionIndex;

            const completedDimension =
              dimensionAnswered >=
              QUESTIONS_PER_DIMENSION;

            return (
              <div
                key={
                  dimension.key
                }
                className={[
                  'dimension-item',

                  active
                    ? 'active'
                    : '',

                  completedDimension
                    ? 'completed'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >

                <div className="dimension-number">

                  {completedDimension ? (
                    <CheckCircle2
                      size={18}
                    />
                  ) : (
                    index + 1
                  )}

                </div>


                <div className="dimension-info">

                  <strong>
                    {dimension.name}
                  </strong>

                  <span>
                    {dimensionAnswered}/
                    {QUESTIONS_PER_DIMENSION}
                  </span>

                </div>

              </div>
            );
          }
        )}

      </div>


      {/* =================================================
          QUESTION CARD
          ================================================= */}

      <div className="assessment-card question-card">

        {/* QUESTION HEADER */}

        <div className="question-top">

          <div>

            <span className="question-dimension">
              {currentDimension.name}
            </span>

            <h2>
              Question{' '}
              {currentQuestionIndex + 1}{' '}
              of{' '}
              {QUESTIONS_PER_DIMENSION}
            </h2>

          </div>


          {/* QUESTION TYPE */}

          <div className="question-type-badge">

            {visualQuestion ? (
              <>
                <Eye size={16} />
                Visual Reasoning
              </>
            ) : (
              <>
                <Brain size={16} />
                Multiple Choice
              </>
            )}

          </div>

        </div>


        {/* =================================================
            QUESTION CONTENT
            ================================================= */}

        <div className="question-content">

          <h3>
            {displayQuestion}
          </h3>


          {/* =================================================
              PRATYAKṢA VISUAL QUESTION
              ================================================= */}

          {visualQuestion ? (

            <div className="visual-question-area">

              {/* IMAGE */}

              {currentQuestion.image && (
                <div className="visual-question-image">

                  {!imageError ? (
                    <img
                      src={imageUrl}
                      alt="Visual reasoning question"
                      loading="eager"
                      onError={() => {
                        console.error(
                          'Assessment image could not be loaded:',
                          currentQuestion.image,
                          imageUrl
                        );

                        setImageError(true);
                      }}
                    />
                  ) : (
                    <div className="image-error-message">

                      <Eye
                        size={28}
                      />

                      <p>
                        Visual image is
                        currently unavailable.
                      </p>

                      <small>
                        Image:{' '}
                        {currentQuestion.image}
                      </small>

                    </div>
                  )}

                </div>
              )}


              {/* OPEN-ENDED ANSWER */}

              <div className="open-ended-answer">

                <label
                  htmlFor={`answer-${questionId}`}
                >
                  Your Answer
                </label>

                <input
                  id={`answer-${questionId}`}
                  type="text"
                  value={
                    selectedAnswer
                  }
                  onChange={(event) =>
                    handleAnswer(
                      questionId,
                      event.target.value
                    )
                  }
                  placeholder="Type your answer..."
                  autoComplete="off"
                />

              </div>

            </div>

          ) : (

            /* =================================================
               MCQ
               ================================================= */

            <div className="options-list">

              {Array.isArray(
                currentQuestion.options
              ) &&
                currentQuestion.options.map(
                  (
                    option,
                    index
                  ) => {

                    const displayOption =
                      getDisplayOption(
                        option
                      );

                    const selected =
                      selectedAnswer ===
                      option;

                    return (
                      <button
                        key={`${questionId}-${index}`}
                        type="button"
                        className={[
                          'option-button',

                          selected
                            ? 'selected'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}

                        onClick={() =>
                          handleAnswer(
                            questionId,
                            option
                          )
                        }
                      >

                        <span className="option-letter">
                          {String.fromCharCode(
                            65 + index
                          )}
                        </span>

                        <span className="option-text">
                          {displayOption}
                        </span>

                        {selected && (
                          <CheckCircle2
                            size={20}
                            className="option-check"
                          />
                        )}

                      </button>
                    );
                  }
                )}

            </div>

          )}

        </div>


        {/* =================================================
            ERROR
            ================================================= */}

        {error && started && (
          <div className="inline-error">
            {error}
          </div>
        )}


        {/* =================================================
            FOOTER
            ================================================= */}

        <div className="question-footer">

          <button
            type="button"
            className="secondary-button"

            onClick={
              handlePrevious
            }

            disabled={
              currentDimensionIndex === 0 &&
              currentQuestionIndex === 0
            }
          >

            <ArrowLeft
              size={18}
            />

            Previous

          </button>


          <div className="answer-status">

            {hasCurrentAnswer() ? (
              <>
                <CheckCircle2
                  size={17}
                />

                Answer selected
              </>
            ) : (
              'Please answer this question'
            )}

          </div>


          <button
            type="button"
            className="primary-button"

            onClick={
              handleNext
            }

            disabled={
              !hasCurrentAnswer() ||
              submitting
            }
          >

            {isLastQuestion ? (
              <>
                <Send
                  size={18}
                />

                {submitting
                  ? 'Submitting...'
                  : 'Submit Assessment'}
              </>
            ) : (
              <>
                Next

                <ArrowRight
                  size={18}
                />
              </>
            )}

          </button>

        </div>

      </div>


      {/* =================================================
          FOOTER NOTE
          ================================================= */}

      <div className="assessment-footer-note">

        <span>
          {currentDimension.description}
        </span>

        <span>
          {answeredQuestions}/
          {totalQuestions} answered
        </span>

      </div>

    </div>
  );
}