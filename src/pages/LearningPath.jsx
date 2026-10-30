import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Lock,
  Target,
  TrendingUp,
  Sparkles,
  BookOpen,
  RotateCcw,
  AlertCircle,
  Layers3,
  GraduationCap,
  Zap,
} from 'lucide-react';

import { api, ApiError } from '../api/client';

import './LearningPath.css';

/* =========================================================
   COGNITIVE DIMENSIONS
========================================================= */

const DIMENSIONS = [
  {
    key: 'anumana',
    name: 'Anumāna',
    displayName: 'Logical Reasoning',
    skill: 'Logical / Inferential Reasoning',
    description:
      'Draw logical conclusions from available evidence and identify valid relationships between facts.',
    milestones: [
      'Foundations',
      'Basic inference',
      'Complex inference',
    ],
  },
  {
    key: 'arthapatti',
    name: 'Arthāpatti',
    displayName: 'Problem Solving',
    skill: 'Abductive Reasoning / Problem Solving',
    description:
      'Find the explanation or hypothesis that best accounts for the available facts.',
    milestones: [
      'Assumption identification',
      'Hypothesis reasoning',
      'Advanced problems',
    ],
  },
  {
    key: 'upamana',
    name: 'Upamāna',
    displayName: 'Analogical Reasoning',
    skill: 'Analogical Reasoning',
    description:
      'Identify meaningful relationships between examples, concepts and situations.',
    milestones: [
      'Basic analogies',
      'Relationship mapping',
      'Advanced analogy',
    ],
  },
  {
    key: 'pratyaksha',
    name: 'Pratyakṣa',
    displayName: 'Visual Reasoning',
    skill: 'Observation / Visual Reasoning',
    description:
      'Reason carefully from observed information and visual evidence.',
    milestones: [
      'Observation basics',
      'Evidence comparison',
      'Complex visual reasoning',
    ],
  },
  {
    key: 'shabda',
    name: 'Śabda',
    displayName: 'Reading & Interpretation',
    skill: 'Reading / Interpretation',
    description:
      'Understand, interpret and reason from textual information.',
    milestones: [
      'Text comprehension',
      'Meaning extraction',
      'Deep interpretation',
    ],
  },
  {
    key: 'anupalabdhi',
    name: 'Anupalabdhi',
    displayName: 'Elimination Reasoning',
    skill: 'Elimination / Contradiction Reasoning',
    description:
      'Reason using absence, contradiction and elimination of impossible alternatives.',
    milestones: [
      'Absence detection',
      'Contradiction analysis',
      'Complex elimination',
    ],
  },
];

/* =========================================================
   HELPERS
========================================================= */

function unwrapApiData(value) {
  if (!value) {
    return null;
  }

  if (
    value.data &&
    typeof value.data === 'object' &&
    !Array.isArray(value.data)
  ) {
    return value.data;
  }

  return value;
}

function clampScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, number));
}

function normalizeSkill(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/* =========================================================
   DIMENSION VALUE RESOLUTION
========================================================= */

function getDimensionValue(source, dimension, fallback = undefined) {
  if (!source || typeof source !== 'object') {
    return fallback;
  }

  const possibleKeys = [
    dimension.key,
    dimension.name,
    dimension.displayName,
    dimension.skill,
  ];

  /* Exact lookup */
  for (const key of possibleKeys) {
    if (
      Object.prototype.hasOwnProperty.call(source, key) &&
      source[key] !== null &&
      source[key] !== undefined
    ) {
      return source[key];
    }
  }

  /* Normalized lookup */
  const normalizedTargets = possibleKeys.map(normalizeSkill);

  for (const [sourceKey, value] of Object.entries(source)) {
    if (
      normalizedTargets.includes(normalizeSkill(sourceKey)) &&
      value !== null &&
      value !== undefined
    ) {
      return value;
    }
  }

  return fallback;
}

/* =========================================================
   RECOMMENDATION RESOLUTION
========================================================= */

function resolveDimensionKey(value) {
  if (!value) {
    return null;
  }

  const normalized = normalizeSkill(value);

  if (!normalized) {
    return null;
  }

  const found = DIMENSIONS.find((dimension) => {
    const candidates = [
      dimension.key,
      dimension.name,
      dimension.displayName,
      dimension.skill,
    ].map(normalizeSkill);

    return candidates.some(
      (candidate) =>
        candidate === normalized ||
        candidate.includes(normalized) ||
        normalized.includes(candidate)
    );
  });

  return found?.key || null;
}

/* =========================================================
   TRAINING HELPERS
========================================================= */

function normalizeTrainingRecord(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value;
}

function getTrainingCount(trainingRecord) {
  const count = Number(
    trainingRecord?.questions_attempted ??
      trainingRecord?.attempted ??
      trainingRecord?.questionsAttempted ??
      trainingRecord?.attempts ??
      trainingRecord?.question_count ??
      0
  );

  if (!Number.isFinite(count)) {
    return 0;
  }

  return Math.max(0, Math.floor(count));
}

function getTrainingScore(trainingRecord) {
  const rawScore =
    trainingRecord?.score ??
    trainingRecord?.training_score ??
    trainingRecord?.trainingScore ??
    null;

  if (
    rawScore === null ||
    rawScore === undefined ||
    rawScore === ''
  ) {
    return null;
  }

  const score = Number(rawScore);

  if (!Number.isFinite(score)) {
    return null;
  }

  return clampScore(score);
}

/*
 * Five practice questions = one complete practice cycle.
 *
 * This is practice activity only.
 * It does NOT mean the skill is mastered.
 */
function getPracticeProgress(trainingRecord) {
  const attempted = getTrainingCount(trainingRecord);

  if (attempted <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((Math.min(attempted, 5) / 5) * 100)
  );
}

/* =========================================================
   SCORE LEVEL
========================================================= */

function getSkillLevel(score) {
  if (score >= 80) {
    return 'Strong';
  }

  if (score >= 60) {
    return 'Proficient';
  }

  if (score >= 40) {
    return 'Developing';
  }

  return 'Beginner';
}

/* =========================================================
   PRIORITY
========================================================= */

function getPriority(score, rank) {
  if (rank === 0 || score < 40) {
    return 'High Priority';
  }

  if (score < 60) {
    return 'Priority';
  }

  if (score < 80) {
    return 'Continue Building';
  }

  return 'Maintain';
}

function getPriorityClass(score, rank) {
  if (rank === 0 || score < 40) {
    return 'high';
  }

  if (score < 60) {
    return 'medium';
  }

  if (score < 80) {
    return 'building';
  }

  return 'strong';
}

/* =========================================================
   MILESTONE LOGIC
========================================================= */

/*
 * IMPORTANT:
 *
 * Exactly ONE milestone can be "current".
 *
 * The milestone thresholds are:
 *
 * 0 → Foundations
 * 40 → Basic inference / intermediate milestone
 * 70 → Advanced milestone
 * 85 → Final milestone completed
 *
 * Practice activity can help show that the student is
 * actively working on a milestone, but practice alone
 * does not mean mastery.
 */

function getMilestoneStates(score, practiceProgress) {
  let currentIndex = 0;

  if (score >= 70) {
    currentIndex = 2;
  } else if (score >= 40) {
    currentIndex = 1;
  } else {
    currentIndex = 0;
  }

  return [0, 1, 2].map((index) => {
    /*
     * Final milestone is completed only at >=85
     * and with the five-question practice cycle.
     */
    if (
      index === 2 &&
      score >= 85 &&
      practiceProgress >= 100
    ) {
      return 'completed';
    }

    /*
     * Earlier milestones are completed when the
     * student has clearly crossed their threshold.
     */
    if (
      index === 0 &&
      score >= 60
    ) {
      return 'completed';
    }

    if (
      index === 1 &&
      score >= 75
    ) {
      return 'completed';
    }

    /*
     * If the student has reached the current level,
     * only this one milestone is current.
     */
    if (index === currentIndex) {
      return 'current';
    }

    /*
     * Everything after the current milestone is locked.
     */
    if (index > currentIndex) {
      return 'locked';
    }

    /*
     * Any earlier milestone not caught above is completed.
     */
    return 'completed';
  });
}

/* =========================================================
   JOURNEY STEP
========================================================= */

function JourneyStep({
  number,
  icon,
  title,
  description,
  completed,
  active,
  locked,
  to,
  last,
}) {
  const content = (
    <div
      className={[
        'journey-step',
        completed ? 'completed' : '',
        active ? 'active' : '',
        locked ? 'locked' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="journey-step-marker">
        {completed ? (
          <Check size={15} />
        ) : locked ? (
          <Lock size={14} />
        ) : (
          icon
        )}
      </div>

      <div className="journey-step-copy">
        <div className="journey-step-number">
          STEP {number}
        </div>

        <h3>{title}</h3>

        <p>{description}</p>
      </div>

      {!locked && to && (
        <ChevronRight
          size={18}
          className="journey-arrow"
        />
      )}
    </div>
  );

  return (
    <>
      {to && !locked ? (
        <Link
          to={to}
          className="journey-step-link"
          aria-label={title}
        >
          {content}
        </Link>
      ) : (
        content
      )}

      {!last && (
        <div
          className={[
            'journey-connector',
            completed ? 'completed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      )}
    </>
  );
}

/* =========================================================
   SKILL CARD
========================================================= */

function SkillCard({
  item,
  rank,
  recommendedSkill,
  onPractice,
}) {
  const {
    dimension,
    score,
    level,
    priority,
    priorityClass,
    training,
    practiceProgress,
  } = item;

  const isRecommended =
    recommendedSkill === dimension.key;

  const attempted =
    getTrainingCount(training);

  const trainingScore =
    getTrainingScore(training);

  const milestoneStates =
    getMilestoneStates(
      score,
      practiceProgress
    );

  const finalMilestoneCompleted =
    milestoneStates[2] === 'completed';

  const remaining =
    Math.max(0, 5 - Math.min(attempted, 5));

  return (
    <article
      className={[
        'skill-card',
        isRecommended ? 'recommended' : '',
        finalMilestoneCompleted ? 'complete' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isRecommended && (
        <div className="skill-recommended-ribbon">
          <Sparkles size={13} />
          Recommended next
        </div>
      )}

      {/* ===================================================
          CARD HEADER
      =================================================== */}

      <div className="skill-card-top">
        <div className="skill-rank">
          {String(rank + 1).padStart(2, '0')}
        </div>

        <div className="skill-card-title">
          <div className="skill-title-row">
            <h3>{dimension.displayName}</h3>

            <span
              className={`priority-pill ${priorityClass}`}
            >
              {priority}
            </span>
          </div>

          <div className="skill-sanskrit">
            {dimension.name}
          </div>

          <div className="skill-category">
            {dimension.skill}
          </div>
        </div>

        <div className="skill-score">
          <strong>
            {Math.round(score)}
          </strong>

          <span>/100</span>
        </div>
      </div>

      {/* ===================================================
          DESCRIPTION
      =================================================== */}

      <p className="skill-description">
        {dimension.description}
      </p>

      {/* ===================================================
          SCORE PROGRESS
      =================================================== */}

      <div className="skill-progress-header">
        <div>
          <span>Skill progress</span>

          <strong>
            {Math.round(score)}%
          </strong>
        </div>

        <span className="skill-level">
          {level}
        </span>
      </div>

      <div
        className="skill-progress-track"
        aria-label={`${dimension.displayName} score ${Math.round(
          score
        )}%`}
      >
        <div
          className="skill-progress-fill"
          style={{
            width: `${score}%`,
          }}
        />
      </div>

      {/* ===================================================
          MILESTONES
      =================================================== */}

      <div className="milestone-list">
        {dimension.milestones.map(
          (milestone, milestoneIndex) => {
            const state =
              milestoneStates[
                milestoneIndex
              ];

            return (
              <div
                key={milestone}
                className={`milestone ${state}`}
              >
                <div className="milestone-icon">
                  {state === 'completed' ? (
                    <CheckCircle2 size={16} />
                  ) : state === 'locked' ? (
                    <Lock size={14} />
                  ) : (
                    <Circle size={14} />
                  )}
                </div>

                <span>{milestone}</span>

                {state === 'current' && (
                  <span className="milestone-current">
                    Current
                  </span>
                )}

                {state === 'completed' && (
                  <span className="milestone-complete-label">
                    Completed
                  </span>
                )}
              </div>
            );
          }
        )}
      </div>

      {/* ===================================================
          TRAINING STATISTICS
      =================================================== */}

      <div className="skill-stats">
        <div>
          <span>Practice</span>

          <strong>
            {Math.min(attempted, 5)}/5
          </strong>
        </div>

        <div>
          <span>Training score</span>

          <strong>
            {trainingScore !== null
              ? `${Math.round(trainingScore)}%`
              : '—'}
          </strong>
        </div>

        <div>
          <span>Practice progress</span>

          <strong>
            {practiceProgress}%
          </strong>
        </div>
      </div>

      {/* ===================================================
          FOOTER
      =================================================== */}

      <div className="skill-card-footer">
        <div>
          {finalMilestoneCompleted ? (
            <span className="status-text complete">
              <CheckCircle2 size={14} />
              Skill milestone completed
            </span>
          ) : attempted === 0 ? (
            <span className="status-text">
              Ready to practice
            </span>
          ) : remaining === 0 ? (
            <span className="status-text">
              Practice cycle complete — continue improving your score
            </span>
          ) : (
            <span className="status-text">
              {remaining} question
              {remaining === 1 ? '' : 's'} remaining
            </span>
          )}
        </div>

        <button
          type="button"
          className="skill-action"
          onClick={() =>
            onPractice(dimension.key)
          }
        >
          {attempted > 0
            ? 'Continue Training'
            : 'Start Training'}

          <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LearningPath() {
  const navigate = useNavigate();

  const [profile, setProfile] =
    useState(null);

  const [progress, setProgress] =
    useState(null);

  const [recommendation, setRecommendation] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  /* =======================================================
     LOAD PROFILE + PROGRESS + RECOMMENDATION
  ======================================================= */

  useEffect(() => {
    let active = true;

    async function loadLearningPath() {
      setLoading(true);
      setError('');

      try {
        const results =
          await Promise.allSettled([
            api.getProfile(),
            api.getProgress(),
            api.getTrainingRecommendation(),
          ]);

        if (!active) {
          return;
        }

        const [
          profileResult,
          progressResult,
          recommendationResult,
        ] = results;

        /* ---------------------------------------------------
           PROFILE
        --------------------------------------------------- */

        if (
          profileResult.status ===
          'fulfilled'
        ) {
          setProfile(
            unwrapApiData(
              profileResult.value
            )
          );
        }

        /* ---------------------------------------------------
           PROGRESS
        --------------------------------------------------- */

        if (
          progressResult.status ===
          'fulfilled'
        ) {
          setProgress(
            unwrapApiData(
              progressResult.value
            )
          );
        }

        /* ---------------------------------------------------
           RECOMMENDATION
        --------------------------------------------------- */

        if (
          recommendationResult.status ===
          'fulfilled'
        ) {
          setRecommendation(
            unwrapApiData(
              recommendationResult.value
            )
          );
        }

        /* ---------------------------------------------------
           ERROR HANDLING
        --------------------------------------------------- */

        const rejected =
          results.find(
            (result) =>
              result.status ===
              'rejected'
          );

        if (rejected) {
          const reason =
            rejected.reason;

          if (
            reason instanceof ApiError &&
            reason.status === null
          ) {
            setError(
              'Unable to reach the server. Please make sure the backend is running.'
            );
          } else if (
            profileResult.status ===
            'rejected'
          ) {
            setError(
              reason?.message ||
                'Unable to load your learning path.'
            );
          }
        }
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err?.message ||
            'Unable to load your learning path.'
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadLearningPath();

    return () => {
      active = false;
    };
  }, []);

  /* =======================================================
     NORMALIZE API DATA
  ======================================================= */

  const profileData =
    unwrapApiData(profile) || {};

  const progressData =
    unwrapApiData(progress) || {};

  const recommendationData =
    unwrapApiData(
      recommendation
    ) || {};

  /* =======================================================
     COGNITIVE PROFILE
  ======================================================= */

  const cognitiveProfile =
    profileData?.cognitive_profile ||
    profileData?.cognitiveProfile ||
    {};

  /*
   * Supports all known API response structures.
   */
  const scores =
    profileData?.skill_scores ||
    profileData?.scores ||
    profileData?.skillScores ||
    cognitiveProfile?.skill_scores ||
    cognitiveProfile?.scores ||
    cognitiveProfile?.skillScores ||
    {};

  /* =======================================================
     TRAINING PROGRESS
  ======================================================= */

  const training =
    progressData?.training ||
    progressData?.training_progress ||
    progressData?.trainingProgress ||
    progressData?.skills ||
    progressData?.skill_progress ||
    progressData?.skillProgress ||
    {};

  /* =======================================================
     PROFILE STATUS
  ======================================================= */

  const hasProfile =
    profileData?.has_profile === true ||
    profileData?.profile_ready === true ||
    profileData?.profileReady === true ||
    Boolean(
      profileData?.cognitive_profile
    ) ||
    Boolean(
      profileData?.cognitiveProfile
    ) ||
    Object.keys(scores).length > 0;

  const hasPreAssessment =
    progressData?.has_pre_assessment === true ||
    progressData?.pre_assessment === true ||
    progressData?.hasPreAssessment === true ||
    progressData?.preAssessment === true ||
    hasProfile;

  const postAssessmentCount =
    Number(
      progressData?.post_assessment_count ??
        progressData?.postAssessmentCount ??
        progressData?.post_assessments_count ??
        progressData?.postAssessmentsCount ??
        0
    );

  const hasPostAssessment =
    progressData?.has_post_assessment === true ||
    progressData?.post_assessment === true ||
    progressData?.hasPostAssessment === true ||
    progressData?.postAssessment === true ||
    postAssessmentCount > 0;

  /* =======================================================
     BUILD SIX-SKILL PATH
  ======================================================= */

  const skillPath = useMemo(() => {
    return DIMENSIONS.map((dimension) => {
      const rawScore =
        getDimensionValue(
          scores,
          dimension,
          0
        );

      const score =
        clampScore(rawScore);

      const rawTraining =
        getDimensionValue(
          training,
          dimension,
          {}
        );

      const trainingRecord =
        normalizeTrainingRecord(
          rawTraining
        );

      const practiceProgress =
        getPracticeProgress(
          trainingRecord
        );

      return {
        dimension,
        score,
        level: getSkillLevel(score),
        priority: '',
        priorityClass: '',
        training: trainingRecord,
        practiceProgress,
      };
    })
      /*
       * Transparent score-based ordering.
       *
       * Lowest current cognitive score first.
       *
       * No ML prediction is used.
       */
      .sort(
        (a, b) =>
          a.score - b.score
      )
      .map((item, index) => ({
        ...item,

        priority:
          getPriority(
            item.score,
            index
          ),

        priorityClass:
          getPriorityClass(
            item.score,
            index
          ),
      }));
  }, [scores, training]);

  /* =======================================================
     TRAINING ACTIVITY
  ======================================================= */

  const totalTrainingQuestions =
    skillPath.reduce(
      (total, item) =>
        total +
        getTrainingCount(
          item.training
        ),
      0
    );

  /*
   * Number of final skill milestones completed.
   *
   * This is intentionally NOT used as the main
   * circular progress indicator because a student
   * can make meaningful progress without completing
   * a final milestone.
   */
  const completedMilestones =
    skillPath.filter(
      (item) =>
        getMilestoneStates(
          item.score,
          item.practiceProgress
        )[2] === 'completed'
    ).length;

  const milestoneCompletion =
    Math.round(
      (completedMilestones /
        DIMENSIONS.length) *
        100
    );

  /*
   * Overall practice activity.
   *
   * Maximum useful practice shown is 5 questions
   * per cognitive dimension.
   *
   * 30 total questions = 100% practice coverage.
   */
  const maximumPracticeQuestions =
    DIMENSIONS.length * 5;

  const practiceCoverage =
    Math.min(
      100,
      Math.round(
        (Math.min(
          totalTrainingQuestions,
          maximumPracticeQuestions
        ) /
          maximumPracticeQuestions) *
          100
      )
    );

  /* =======================================================
     RECOMMENDATION
  ======================================================= */

  const backendRecommendedSkill =
    recommendationData?.recommended_skill ||
    recommendationData?.recommendedSkill ||
    recommendationData?.recommended_dimension ||
    recommendationData?.recommendedDimension ||
    recommendationData?.skill ||
    recommendationData?.dimension ||
    recommendationData?.next_skill ||
    recommendationData?.nextSkill ||
    null;

  /*
   * Backend recommendation first.
   *
   * Weakest score is the transparent fallback.
   */
  const recommendedKey =
    resolveDimensionKey(
      backendRecommendedSkill
    ) ||
    skillPath[0]?.dimension.key ||
    null;

  const recommendedItem =
    skillPath.find(
      (item) =>
        item.dimension.key ===
        recommendedKey
    ) ||
    skillPath[0] ||
    null;

  const recommendationReason =
    recommendationData?.reason ||
    recommendationData?.recommendation_reason ||
    recommendationData?.recommendationReason ||
    recommendationData?.message ||
    'This skill is currently one of your highest-priority reasoning areas based on your cognitive profile.';

  /* =======================================================
     PRACTICE NAVIGATION
  ======================================================= */

  function handlePractice(skill) {
    if (!skill) {
      navigate('/training');
      return;
    }

    navigate('/training', {
      state: {
        practiceSkill: skill,
        source: 'learning-path',
      },
    });
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="learning-path-page">
        <div className="learning-background-grid" />

        <div className="learning-background-orb orb-one" />
        <div className="learning-background-orb orb-two" />

        <main className="learning-path-container">
          <div className="learning-loading">
            <div className="loading-icon">
              <Brain size={28} />
            </div>

            <div
              className="loading-spinner"
              aria-hidden="true"
            />

            <h2>
              Building your learning path
            </h2>

            <p>
              Reading your cognitive profile
              and training progress...
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* =======================================================
     NO COGNITIVE PROFILE
  ======================================================= */

  if (!hasProfile) {
    return (
      <div className="learning-path-page">
        <div className="learning-background-grid" />

        <div className="learning-background-orb orb-one" />
        <div className="learning-background-orb orb-two" />

        <main className="learning-path-container">
          <header className="learning-header">
            <div>
              <div className="learning-eyebrow">
                <Target size={14} />
                PERSONALIZED LEARNING
              </div>

              <h1>
                Your Learning Path
              </h1>

              <p>
                A reasoning-focused sequence
                created from your cognitive
                profile.
              </p>
            </div>
          </header>

          {error && (
            <div
              className="learning-alert"
              role="alert"
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <section className="learning-empty">
            <div className="empty-icon">
              <Brain size={30} />
            </div>

            <div className="learning-eyebrow">
              COGNITIVE PROFILE REQUIRED
            </div>

            <h2>
              Your learning path is not ready yet
            </h2>

            <p>
              Complete the pre-assessment first.
              Cognita will understand your six
              reasoning dimensions and then
              organize your learning priorities.
            </p>

            <Link
              to="/assessment"
              className="primary-learning-button"
            >
              Start Cognitive Assessment
              <ArrowRight size={17} />
            </Link>
          </section>
        </main>
      </div>
    );
  }

  /* =======================================================
     MAIN PAGE
  ======================================================= */

  return (
    <div className="learning-path-page">
      <div className="learning-background-grid" />

      <div className="learning-background-orb orb-one" />
      <div className="learning-background-orb orb-two" />

      <main className="learning-path-container">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="learning-header">
          <div>
            <div className="learning-eyebrow">
              <Target size={14} />
              PERSONALIZED LEARNING
            </div>

            <h1>
              Your Learning Path
            </h1>

            <p>
              A reasoning-focused sequence built
              from your current cognitive profile
              and real training activity.
            </p>
          </div>

          <Link
            to="/profile"
            className="header-profile-button"
          >
            <Brain size={16} />
            View Cognitive Profile
            <ArrowRight size={15} />
          </Link>
        </header>

        {error && (
          <div
            className="learning-alert"
            role="alert"
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* =================================================
            HERO
        ================================================= */}

        <section className="path-hero">

          <div className="path-hero-left">

            <div className="hero-badge">
              <Sparkles size={14} />
              COGNITA PATH ENGINE
            </div>

            <h2>
              Strengthen your reasoning,
              <br />
              <span>
                one skill at a time.
              </span>
            </h2>

            <p>
              Your reasoning dimensions are
              ordered from lower to higher
              performance so that training can
              begin where improvement is most
              needed.
            </p>

            {recommendedItem && (
              <div className="next-focus">

                <div className="next-focus-icon">
                  <Target size={19} />
                </div>

                <div className="next-focus-content">
                  <span>
                    NEXT BEST FOCUS
                  </span>

                  <strong>
                    {
                      recommendedItem
                        .dimension
                        .displayName
                    }
                  </strong>

                  <small>
                    {
                      recommendedItem
                        .dimension
                        .name
                    }
                    {' · '}
                    {recommendationReason}
                  </small>
                </div>

              </div>
            )}

          </div>

          {/* =================================================
              HERO PROGRESS
          ================================================= */}

          <div className="path-hero-right">

            <div
              className="completion-ring"
              aria-label={`${practiceCoverage}% practice coverage`}
            >
              <svg
                viewBox="0 0 120 120"
                className="completion-svg"
                aria-hidden="true"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="ring-background"
                />

                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="ring-progress"
                  style={{
                    strokeDashoffset:
                      314 -
                      (314 *
                        practiceCoverage) /
                        100,
                  }}
                />
              </svg>

              <div className="ring-content">
                <strong>
                  {practiceCoverage}%
                </strong>

                <span>
                  practice coverage
                </span>
              </div>
            </div>

            <div className="hero-status">
              <span>
                SKILL MILESTONE STATUS
              </span>

              <strong>
                {milestoneCompletion === 100
                  ? 'All milestones completed'
                  : 'Path in progress'}
              </strong>

              <p>
                {completedMilestones} of{' '}
                {DIMENSIONS.length}{' '}
                final skill milestones completed
              </p>
            </div>

          </div>

        </section>

        {/* =================================================
            QUICK STATS
        ================================================= */}

        <section
          className="learning-stats"
          aria-label="Learning path statistics"
        >

          <div className="learning-stat-card">
            <div className="stat-icon">
              <Layers3 size={19} />
            </div>

            <div>
              <span>
                REASONING DIMENSIONS
              </span>

              <strong>
                6
              </strong>

              <small>
                Cognitive skills
              </small>
            </div>
          </div>

          <div className="learning-stat-card">
            <div className="stat-icon">
              <GraduationCap size={19} />
            </div>

            <div>
              <span>
                TRAINING ATTEMPTS
              </span>

              <strong>
                {totalTrainingQuestions}
              </strong>

              <small>
                Practice questions attempted
              </small>
            </div>
          </div>

          <div className="learning-stat-card highlight">
            <div className="stat-icon">
              <Zap size={19} />
            </div>

            <div>
              <span>
                CURRENT FOCUS
              </span>

              <strong>
                {
                  recommendedItem
                    ?.dimension
                    .displayName ||
                  '—'
                }
              </strong>

              <small>
                Highest priority skill
              </small>
            </div>
          </div>

        </section>

        {/* =================================================
            COGNITIVE JOURNEY
        ================================================= */}

        <section className="journey-section">

          <div className="section-heading">
            <div>
              <div className="section-eyebrow">
                YOUR COGNITIVE JOURNEY
              </div>

              <h2>
                From assessment to improvement
              </h2>

              <p>
                Cognita guides you through a
                structured reasoning-development
                cycle.
              </p>
            </div>

            <div className="training-count">
              <strong>
                {totalTrainingQuestions}
              </strong>

              <span>
                training questions attempted
              </span>
            </div>
          </div>

          <div className="journey-card">

            <JourneyStep
              number="01"
              icon={
                <Target size={16} />
              }
              title="Cognitive Assessment"
              description="Measure your reasoning across six cognitive dimensions."
              completed={hasPreAssessment}
              active={!hasPreAssessment}
              locked={false}
              to="/assessment"
            />

            <JourneyStep
              number="02"
              icon={
                <Brain size={16} />
              }
              title="Cognitive Profile"
              description="Identify your current strengths and areas that need improvement."
              completed={hasProfile}
              active={hasProfile}
              locked={!hasProfile}
              to="/profile"
            />

            <JourneyStep
              number="03"
              icon={
                <TrendingUp size={16} />
              }
              title="Skill Priorities"
              description="Order your reasoning dimensions from lower to higher current performance."
              completed={hasProfile}
              active={hasProfile}
              locked={!hasProfile}
            />

            <JourneyStep
              number="04"
              icon={
                <GraduationCap size={16} />
              }
              title="Adaptive Training"
              description="Practice targeted reasoning questions and receive feedback."
              completed={
                totalTrainingQuestions > 0
              }
              active={
                hasProfile &&
                totalTrainingQuestions === 0
              }
              locked={!hasProfile}
              to="/training"
            />

            <JourneyStep
              number="05"
              icon={
                <RotateCcw size={16} />
              }
              title="Post-Assessment"
              description="Reassess your reasoning and compare your improvement."
              completed={hasPostAssessment}
              active={
                hasProfile &&
                totalTrainingQuestions > 0 &&
                !hasPostAssessment
              }
              locked={!hasProfile}
              to="/post-assessment"
              last
            />

          </div>

        </section>

        {/* =================================================
            SKILL SEQUENCE
        ================================================= */}

        <section className="skill-sequence-section">

          <div className="section-heading skill-heading">
            <div>
              <div className="section-eyebrow">
                SIX REASONING DIMENSIONS
              </div>

              <h2>
                Your personalized skill sequence
              </h2>

              <p>
                Lower-scoring dimensions appear
                first so your practice begins where
                improvement can be prioritized.
              </p>
            </div>

            <div className="sequence-indicator">
              <TrendingUp size={15} />
              Lower score first
            </div>
          </div>

          <div className="skill-grid">

            {skillPath.map(
              (item, index) => (
                <SkillCard
                  key={
                    item.dimension.key
                  }
                  item={item}
                  rank={index}
                  recommendedSkill={
                    recommendedKey
                  }
                  onPractice={
                    handlePractice
                  }
                />
              )
            )}

          </div>

        </section>

        {/* =================================================
            BOTTOM ACTIONS
        ================================================= */}

        <section className="learning-actions">

          <div className="learning-action-card">

            <div className="action-card-icon">
              <BookOpen size={21} />
            </div>

            <div className="action-card-content">
              <span>
                NEED HELP?
              </span>

              <strong>
                Understand a difficult concept
              </strong>

              <p>
                Ask Cognita AI Tutor to explain
                a reasoning concept in simpler
                words or with an example.
              </p>
            </div>

            <Link
              to="/ai-tutor"
              className="action-button"
            >
              Open AI Tutor
              <ArrowRight size={16} />
            </Link>

          </div>

          <div className="learning-action-card secondary">

            <div className="action-card-icon">
              <RotateCcw size={21} />
            </div>

            <div className="action-card-content">
              <span>
                LEARN FROM YOUR ANSWERS
              </span>

              <strong>
                Review previous assessments
              </strong>

              <p>
                Revisit correct and incorrect
                answers and understand your
                mistakes.
              </p>
            </div>

            <Link
              to="/assessment-review"
              className="action-button"
            >
              Assessment Review
              <ArrowRight size={16} />
            </Link>

          </div>

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="learning-footer">
          <div className="footer-brand">
            <Brain size={17} />
            <strong>
              COGNITA AI
            </strong>
          </div>

          <span>
            Understand Your Thinking. Improve Your Reasoning.
          </span>

          <small>
            Mīmāṃsā-inspired cognitive reasoning framework
          </small>
        </footer>

      </main>
    </div>
  );
}