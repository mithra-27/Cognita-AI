/* =========================================================
   COGNITA AI — PROGRESS
   ========================================================= */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Lock,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react";

import { api } from "../api/client";
import "./Progress.css";


/* =========================================================
   DIMENSIONS
   ========================================================= */

const DIMENSIONS = [
  {
    key: "anumana",
    name: "Logical Reasoning",
    sanskrit: "Anumāna",
    description:
      "Ability to derive conclusions through logical relationships and inference.",
  },
  {
    key: "arthapatti",
    name: "Problem Solving",
    sanskrit: "Arthāpatti",
    description:
      "Ability to infer the most plausible explanation from available information.",
  },
  {
    key: "upamana",
    name: "Analogical Reasoning",
    sanskrit: "Upamāna",
    description:
      "Ability to identify relationships and reason through meaningful comparisons.",
  },
  {
    key: "pratyaksha",
    name: "Visual Reasoning",
    sanskrit: "Pratyakṣa",
    description:
      "Ability to interpret observations and derive meaning from visual information.",
  },
  {
    key: "shabda",
    name: "Reading Comprehension",
    sanskrit: "Śabda",
    description:
      "Ability to interpret textual information and understand contextual meaning.",
  },
  {
    key: "anupalabdhi",
    name: "Elimination Reasoning",
    sanskrit: "Anupalabdhi",
    description:
      "Ability to identify contradictions, absence and eliminate inconsistent possibilities.",
  },
];


/* =========================================================
   HELPERS
   ========================================================= */

const normalizeKey = (value = "") => {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
};


const getDimensionInfo = (key) => {
  const normalized = normalizeKey(key);

  return (
    DIMENSIONS.find(
      (dimension) => normalizeKey(dimension.key) === normalized
    ) ||
    DIMENSIONS.find(
      (dimension) => normalizeKey(dimension.name) === normalized
    ) ||
    DIMENSIONS.find(
      (dimension) => normalizeKey(dimension.sanskrit) === normalized
    ) ||
    null
  );
};


const getScore = (value) => {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};


const formatScore = (value) => {
  return `${getScore(value)}%`;
};


const getLevel = (score) => {
  const value = getScore(score);

  if (value >= 80) return "Strong";
  if (value >= 60) return "Developing";
  if (value >= 40) return "Building";
  return "Needs Practice";
};


const getPriority = (score) => {
  const value = getScore(score);

  if (value < 40) return "High";
  if (value < 60) return "Medium";
  if (value < 75) return "Building";

  return "Strong";
};


const getPriorityClass = (score) => {
  const value = getScore(score);

  if (value < 40) return "high";
  if (value < 60) return "medium";
  if (value < 75) return "building";

  return "strong";
};


const getScoreFromObject = (source, dimension) => {
  if (!source || typeof source !== "object") {
    return 0;
  }

  const candidates = [
    dimension.key,
    dimension.name,
    dimension.sanskrit,
    normalizeKey(dimension.key),
    normalizeKey(dimension.name),
    normalizeKey(dimension.sanskrit),
  ];

  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(source, candidate)) {
      return getScore(source[candidate]);
    }
  }

  const matchingKey = Object.keys(source).find(
    (key) => normalizeKey(key) === normalizeKey(dimension.key)
  );

  if (matchingKey) {
    return getScore(source[matchingKey]);
  }

  return 0;
};


const getTrainingCount = (sessions) => {
  if (Array.isArray(sessions)) {
    return sessions.length;
  }

  if (typeof sessions === "number") {
    return sessions;
  }

  return 0;
};


const getSessionCompleted = (session) => {
  if (!session || typeof session !== "object") {
    return false;
  }

  return (
    session.completed === true ||
    session.is_completed === true ||
    session.status === "completed" ||
    session.status === "complete"
  );
};


/* =========================================================
   EMPTY STATE
   ========================================================= */

function EmptyState() {
  return (
    <div className="progress-empty">
      <div className="progress-empty-icon">
        <BarChart3 size={28} strokeWidth={1.8} />
      </div>

      <span className="progress-eyebrow">
        <Sparkles size={12} />
        PROGRESS INSIGHT
      </span>

      <h2>Your cognitive progress starts here</h2>

      <p>
        Complete your pre-assessment to establish your initial cognitive
        profile. Your progress page will then track development across the
        six reasoning dimensions.
      </p>

      <Link to="/assessment" className="progress-primary-button">
        Begin Assessment
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}


/* =========================================================
   LOADING
   ========================================================= */

function ProgressLoading() {
  return (
    <main className="progress-page">
      <div className="progress-background-grid" />
      <div className="progress-background-orb progress-orb-one" />
      <div className="progress-background-orb progress-orb-two" />

      <div className="progress-container">
        <div className="progress-loading">
          <div className="progress-loading-icon">
            <BarChart3 size={25} />
          </div>

          <div className="progress-loading-spinner" />

          <h2>Loading your progress</h2>
          <p>Preparing your cognitive development overview.</p>
        </div>
      </div>
    </main>
  );
}


/* =========================================================
   PROGRESS PAGE
   ========================================================= */

export default function Progress() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadProgress = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await api.getProgress();

        if (mounted) {
          setProgress(data);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err?.message ||
              "Unable to load your progress right now. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProgress();

    return () => {
      mounted = false;
    };
  }, []);


  if (loading) {
    return <ProgressLoading />;
  }


  /* =========================================================
     DATA
     ========================================================= */

  const data = progress || {};

  const preScores =
    data.pre_scores ||
    data.preScores ||
    data.pre_assessment_scores ||
    {};

  const postScores =
    data.post_scores ||
    data.postScores ||
    data.post_assessment_scores ||
    {};

  const trainingSessions =
    data.training_sessions ||
    data.trainingSessions ||
    [];

  const hasPreAssessment =
    data.has_pre_assessment ??
    data.pre_assessment_completed ??
    data.preAssessmentCompleted ??
    Object.keys(preScores || {}).length > 0;

  const hasPostAssessment =
    data.has_post_assessment ??
    data.post_assessment_completed ??
    data.postAssessmentCompleted ??
    Object.keys(postScores || {}).length > 0;


  /* =========================================================
     DIMENSION DATA
     ========================================================= */

  const dimensionData = DIMENSIONS.map((dimension) => {
    const pre = getScoreFromObject(preScores, dimension);
    const post = getScoreFromObject(postScores, dimension);

    const improvement =
      hasPostAssessment && (pre > 0 || post > 0)
        ? post - pre
        : 0;

    const currentScore = hasPostAssessment ? post : pre;

    return {
      ...dimension,
      pre,
      post,
      currentScore,
      improvement,
      level: getLevel(currentScore),
      priority: getPriority(currentScore),
      priorityClass: getPriorityClass(currentScore),
    };
  });


  /* =========================================================
     OVERALL SCORES
     ========================================================= */

  const preValues = dimensionData
    .map((item) => item.pre)
    .filter((value) => value > 0);

  const postValues = dimensionData
    .map((item) => item.post)
    .filter((value) => value > 0);

  const currentValues = dimensionData
    .map((item) => item.currentScore)
    .filter((value) => value > 0);


  const preOverall =
    data.pre_score ??
    data.preScore ??
    (preValues.length
      ? Math.round(
          preValues.reduce((sum, value) => sum + value, 0) /
            preValues.length
        )
      : 0);


  const postOverall =
    data.post_score ??
    data.postScore ??
    (postValues.length
      ? Math.round(
          postValues.reduce((sum, value) => sum + value, 0) /
            postValues.length
        )
      : 0);


  const currentOverall =
    data.overall_score ??
    data.overallScore ??
    (currentValues.length
      ? Math.round(
          currentValues.reduce((sum, value) => sum + value, 0) /
            currentValues.length
        )
      : 0);


  const overallImprovement =
    hasPostAssessment
      ? getScore(postOverall) - getScore(preOverall)
      : 0;


  /* =========================================================
     STRONGEST / WEAKEST
     ========================================================= */

  const sortedDimensions = [...dimensionData].sort(
    (a, b) => b.currentScore - a.currentScore
  );

  const strongestDimension = sortedDimensions[0];
  const weakestDimension =
    sortedDimensions[sortedDimensions.length - 1];


  /* =========================================================
     TRAINING
     ========================================================= */

  const totalTrainingSessions = getTrainingCount(trainingSessions);

  const completedTrainingSessions = Array.isArray(trainingSessions)
    ? trainingSessions.filter(getSessionCompleted).length
    : Number(
        data.completed_training_sessions ??
          data.completedTrainingSessions ??
          0
      );


  const latestTrainingSession =
    Array.isArray(trainingSessions) && trainingSessions.length
      ? trainingSessions[trainingSessions.length - 1]
      : null;


  /* =========================================================
     JOURNEY
     ========================================================= */

  const journey = [
    {
      number: "01",
      title: "Assessment",
      description: "Establish your initial reasoning profile.",
      status: hasPreAssessment ? "completed" : "active",
      icon: Target,
      href: "/assessment",
    },
    {
      number: "02",
      title: "Cognitive Profile",
      description: "Understand your strongest and developing skills.",
      status: hasPreAssessment ? "completed" : "locked",
      icon: Brain,
      href: "/profile",
    },
    {
      number: "03",
      title: "Adaptive Training",
      description: "Practice skills identified for development.",
      status:
        totalTrainingSessions > 0
          ? "completed"
          : hasPreAssessment
          ? "active"
          : "locked",
      icon: TrendingUp,
      href: "/training",
    },
    {
      number: "04",
      title: "Post-Assessment",
      description: "Measure changes after cognitive training.",
      status: hasPostAssessment
        ? "completed"
        : totalTrainingSessions > 0
        ? "active"
        : "locked",
      icon: RotateCcw,
      href: "/post-assessment",
    },
    {
      number: "05",
      title: "Progress Review",
      description: "Compare your cognitive development over time.",
      status: hasPostAssessment ? "active" : "locked",
      icon: Trophy,
      href: "/progress",
    },
  ];


  /* =========================================================
     ERROR
     ========================================================= */

  if (error && !progress) {
    return (
      <main className="progress-page">
        <div className="progress-background-grid" />
        <div className="progress-background-orb progress-orb-one" />
        <div className="progress-background-orb progress-orb-two" />

        <div className="progress-container">
          <div className="progress-alert">
            <XCircle size={17} />
            <span>{error}</span>
          </div>

          <EmptyState />
        </div>
      </main>
    );
  }


  /* =========================================================
     EMPTY
     ========================================================= */

  if (!hasPreAssessment) {
    return (
      <main className="progress-page">
        <div className="progress-background-grid" />
        <div className="progress-background-orb progress-orb-one" />
        <div className="progress-background-orb progress-orb-two" />

        <div className="progress-container">
          <header className="progress-header">
            <div>
              <span className="progress-eyebrow">
                <BarChart3 size={12} />
                COGNITIVE DEVELOPMENT
              </span>

              <h1>Progress</h1>

              <p>
                Track how your reasoning skills develop across your
                Cognita AI learning journey.
              </p>
            </div>

            <Link
              to="/profile"
              className="progress-profile-button"
            >
              <Brain size={14} />
              Cognitive Profile
            </Link>
          </header>

          <EmptyState />
        </div>
      </main>
    );
  }


  /* =========================================================
     MAIN UI
     ========================================================= */

  return (
    <main className="progress-page">
      <div className="progress-background-grid" />
      <div className="progress-background-orb progress-orb-one" />
      <div className="progress-background-orb progress-orb-two" />

      <div className="progress-container">

        {/* =====================================================
            HEADER
            ===================================================== */}

        <header className="progress-header">
          <div>
            <span className="progress-eyebrow">
              <BarChart3 size={12} />
              COGNITIVE DEVELOPMENT
            </span>

            <h1>Progress</h1>

            <p>
              Follow your cognitive development across assessment,
              training, and post-assessment milestones.
            </p>
          </div>

          <Link
            to="/profile"
            className="progress-profile-button"
          >
            <Brain size={14} />
            Cognitive Profile
          </Link>
        </header>


        {/* =====================================================
            ALERT
            ===================================================== */}

        {error && (
          <div className="progress-alert">
            <XCircle size={16} />
            <span>{error}</span>
          </div>
        )}


        {/* =====================================================
            HERO
            ===================================================== */}

        <section className="progress-hero">

          <div className="progress-hero-left">

            <span className="progress-hero-badge">
              <Sparkles size={12} />
              YOUR COGNITIVE JOURNEY
            </span>

            <h2>
              See how your
              <span> reasoning skills </span>
              are developing.
            </h2>

            <p>
              Your progress is represented across six cognitive
              dimensions, allowing you to understand where you are
              building strength and where continued practice can help.
            </p>

            <div className="progress-focus-row">

              <div className="progress-focus-card">
                <div className="progress-focus-icon">
                  <Trophy size={17} />
                </div>

                <div>
                  <span>STRONGEST AREA</span>

                  <strong>
                    {strongestDimension?.name || "—"}
                  </strong>

                  <small>
                    {strongestDimension
                      ? `${strongestDimension.currentScore}% current score`
                      : "Complete your assessment"}
                  </small>
                </div>
              </div>


              <div className="progress-focus-card">
                <div className="progress-focus-icon">
                  <Target size={17} />
                </div>

                <div>
                  <span>DEVELOPMENT FOCUS</span>

                  <strong>
                    {weakestDimension?.name || "—"}
                  </strong>

                  <small>
                    {weakestDimension
                      ? `${weakestDimension.currentScore}% current score`
                      : "Complete your assessment"}
                  </small>
                </div>
              </div>

            </div>
          </div>


          {/* ===================================================
              HERO SCORE
              =================================================== */}

          <div className="progress-hero-right">

            <div className="progress-score-ring">

              <svg
                viewBox="0 0 120 120"
                className="progress-ring-svg"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="49"
                  className="progress-ring-background"
                />

                <circle
                  cx="60"
                  cy="60"
                  r="49"
                  className="progress-ring-progress"
                  style={{
                    strokeDashoffset:
                      308 -
                      (308 * getScore(currentOverall)) / 100,
                  }}
                />
              </svg>

              <div className="progress-ring-content">
                <strong>{getScore(currentOverall)}%</strong>
                <span>current</span>
              </div>

            </div>


            <div className="progress-score-summary">

              <span>OVERALL COGNITIVE SCORE</span>

              <strong>
                {hasPostAssessment
                  ? "Post-Assessment"
                  : "Pre-Assessment"}
              </strong>

              <p>
                {hasPostAssessment
                  ? overallImprovement > 0
                    ? `+${overallImprovement}% change from your initial assessment.`
                    : overallImprovement < 0
                    ? `${overallImprovement}% change from your initial assessment.`
                    : "Your overall score is unchanged from the initial assessment."
                  : "Complete training and post-assessment to measure development."}
              </p>

            </div>

          </div>

        </section>


        {/* =====================================================
            STATS
            ===================================================== */}

        <section className="progress-stats">

          <div className="progress-stat-card highlight">
            <div className="progress-stat-icon">
              <BarChart3 size={18} />
            </div>

            <div>
              <span>OVERALL SCORE</span>
              <strong>{formatScore(currentOverall)}</strong>
              <small>
                {hasPostAssessment
                  ? "Post-assessment result"
                  : "Initial assessment"}
              </small>
            </div>
          </div>


          <div className="progress-stat-card">
            <div className="progress-stat-icon">
              <TrendingUp size={18} />
            </div>

            <div>
              <span>CHANGE</span>

              <strong>
                {hasPostAssessment
                  ? `${overallImprovement > 0 ? "+" : ""}${overallImprovement}%`
                  : "—"}
              </strong>

              <small>
                {hasPostAssessment
                  ? "Since initial assessment"
                  : "Post-assessment pending"}
              </small>
            </div>
          </div>


          <div className="progress-stat-card">
            <div className="progress-stat-icon">
              <Clock3 size={18} />
            </div>

            <div>
              <span>TRAINING SESSIONS</span>
              <strong>{totalTrainingSessions}</strong>
              <small>
                {completedTrainingSessions} completed
              </small>
            </div>
          </div>

        </section>


        {/* =====================================================
            JOURNEY
            ===================================================== */}

        <section className="progress-journey-section">

          <div className="progress-section-heading">

            <div>
              <span className="progress-section-eyebrow">
                LEARNING JOURNEY
              </span>

              <h2>Your development path</h2>

              <p>
                Progress through assessment, training and review.
              </p>
            </div>

            <div className="progress-section-count">
              <strong>
                {hasPostAssessment ? "05" : "03"}
              </strong>
              <span>stages reached</span>
            </div>

          </div>


          <div className="progress-journey-card">

            {journey.map((stage, index) => {
              const Icon = stage.icon;

              const content = (
                <div
                  className={`progress-journey-step ${stage.status}`}
                  key={stage.number}
                >
                  <div className="progress-journey-marker">
                    {stage.status === "completed" ? (
                      <CheckCircle2 size={16} />
                    ) : stage.status === "locked" ? (
                      <Lock size={14} />
                    ) : (
                      <Icon size={16} />
                    )}
                  </div>

                  <div className="progress-journey-number">
                    {stage.number}
                  </div>

                  <h3>{stage.title}</h3>

                  <p>{stage.description}</p>

                  {index < journey.length - 1 && (
                    <ChevronRight className="progress-journey-arrow" size={15} />
                  )}
                </div>
              );

              if (stage.status === "locked") {
                return (
                  <div
                    className="progress-journey-link"
                    key={stage.number}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  to={stage.href}
                  className="progress-journey-link"
                  key={stage.number}
                >
                  {content}
                </Link>
              );
            })}

          </div>

        </section>


        {/* =====================================================
            DIMENSIONS
            ===================================================== */}

        <section className="progress-dimensions-section">

          <div className="progress-section-heading progress-dimension-heading">

            <div>
              <span className="progress-section-eyebrow">
                COGNITIVE DIMENSIONS
              </span>

              <h2>Your reasoning profile</h2>

              <p>
                Compare your development across the six Cognita AI
                reasoning dimensions.
              </p>
            </div>

            <div className="progress-dimension-indicator">
              <Brain size={13} />
              6 DIMENSIONS
            </div>

          </div>


          <div className="progress-dimension-grid">

            {dimensionData.map((dimension, index) => {

              const comparisonValue = hasPostAssessment
                ? dimension.post
                : dimension.pre;

              return (
                <article
                  className={`progress-dimension-card ${
                    dimension.currentScore < 60
                      ? "development"
                      : ""
                  }`}
                  key={dimension.key}
                >

                  <div className="progress-dimension-top">

                    <div className="progress-dimension-rank">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="progress-dimension-title">

                      <div className="progress-dimension-title-row">
                        <h3>{dimension.name}</h3>

                        <span
                          className={`progress-priority-pill ${dimension.priorityClass}`}
                        >
                          {dimension.priority}
                        </span>
                      </div>

                      <div className="progress-dimension-sanskrit">
                        {dimension.sanskrit}
                      </div>

                    </div>

                    <div className="progress-dimension-score">
                      <strong>
                        {formatScore(comparisonValue)}
                      </strong>

                      <span>score</span>
                    </div>

                  </div>


                  <p className="progress-dimension-description">
                    {dimension.description}
                  </p>


                  <div className="progress-score-header">

                    <div>
                      <span>DEVELOPMENT</span>

                      <strong>
                        {dimension.level}
                      </strong>
                    </div>

                    {hasPostAssessment && (
                      <span
                        className={`progress-change ${
                          dimension.improvement > 0
                            ? "positive"
                            : dimension.improvement < 0
                            ? "negative"
                            : ""
                        }`}
                      >
                        {dimension.improvement > 0
                          ? `+${dimension.improvement}%`
                          : `${dimension.improvement}%`}
                      </span>
                    )}

                  </div>


                  <div className="progress-score-track">

                    <div
                      className="progress-score-fill"
                      style={{
                        width: `${comparisonValue}%`,
                      }}
                    />

                  </div>


                  {hasPostAssessment && (
                    <div className="progress-comparison">

                      <div>
                        <span>INITIAL</span>
                        <strong>
                          {formatScore(dimension.pre)}
                        </strong>
                      </div>

                      <div className="progress-comparison-arrow">
                        <ArrowRight size={13} />
                      </div>

                      <div>
                        <span>CURRENT</span>
                        <strong>
                          {formatScore(dimension.post)}
                        </strong>
                      </div>

                    </div>
                  )}


                  <div className="progress-dimension-footer">

                    <span
                      className={`progress-status ${
                        dimension.currentScore >= 75
                          ? "complete"
                          : ""
                      }`}
                    >
                      {dimension.currentScore >= 75 ? (
                        <>
                          <CheckCircle2 size={12} />
                          Strong development
                        </>
                      ) : (
                        <>
                          <Target size={12} />
                          Continue building
                        </>
                      )}
                    </span>

                    <Link
                      to="/training"
                      className="progress-action"
                    >
                      Practice
                      <ArrowRight size={12} />
                    </Link>

                  </div>

                </article>
              );
            })}

          </div>

        </section>


        {/* =====================================================
            BEFORE / AFTER
            ===================================================== */}

        <section className="progress-analysis-section">

          <div className="progress-section-heading">

            <div>
              <span className="progress-section-eyebrow">
                DEVELOPMENT REVIEW
              </span>

              <h2>Before and after</h2>

              <p>
                See how your overall cognitive score has changed.
              </p>
            </div>

          </div>


          <div className="progress-analysis-card">

            <div className="progress-analysis-score">

              <span>INITIAL</span>

              <strong>
                {formatScore(preOverall)}
              </strong>

              <small>
                Pre-assessment
              </small>

            </div>


            <div className="progress-analysis-line">

              <div className="progress-analysis-line-track">
                <div
                  className="progress-analysis-line-fill"
                  style={{
                    width: `${getScore(
                      Math.max(preOverall, postOverall)
                    )}%`,
                  }}
                />
              </div>

              <div className="progress-analysis-arrow">
                <ArrowRight size={17} />
              </div>

            </div>


            <div className="progress-analysis-score current">

              <span>CURRENT</span>

              <strong>
                {hasPostAssessment
                  ? formatScore(postOverall)
                  : formatScore(preOverall)}
              </strong>

              <small>
                {hasPostAssessment
                  ? "Post-assessment"
                  : "Post-assessment pending"}
              </small>

            </div>


            <div className="progress-analysis-result">

              <div className="progress-analysis-result-icon">
                <TrendingUp size={17} />
              </div>

              <div>
                <span>OVERALL CHANGE</span>

                <strong>
                  {hasPostAssessment
                    ? `${overallImprovement > 0 ? "+" : ""}${overallImprovement}%`
                    : "—"}
                </strong>
              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            TRAINING SUMMARY
            ===================================================== */}

        <section className="progress-training-section">

          <div className="progress-section-heading">

            <div>
              <span className="progress-section-eyebrow">
                TRAINING ACTIVITY
              </span>

              <h2>Your practice activity</h2>

              <p>
                Continue training to strengthen developing reasoning
                skills.
              </p>
            </div>

            <div className="progress-training-count">
              <strong>{completedTrainingSessions}</strong>
              <span>completed sessions</span>
            </div>

          </div>


          <div className="progress-training-card">

            <div className="progress-training-icon">
              <TrendingUp size={21} />
            </div>

            <div className="progress-training-content">

              <span>
                {latestTrainingSession
                  ? "LATEST TRAINING"
                  : "NEXT STEP"}
              </span>

              <strong>
                {latestTrainingSession
                  ? "Continue your cognitive training"
                  : "Begin adaptive cognitive training"}
              </strong>

              <p>
                {latestTrainingSession
                  ? "Keep practicing the reasoning skills identified in your cognitive profile."
                  : "Use your cognitive profile to begin targeted practice across your developing skills."}
              </p>

            </div>

            <Link
              to="/training"
              className="progress-training-button"
            >
              Open Training
              <ArrowRight size={14} />
            </Link>

          </div>

        </section>


        {/* =====================================================
            BOTTOM ACTIONS
            ===================================================== */}

        <section className="progress-actions">

          <div className="progress-action-card">

            <div className="progress-action-icon">
              <Brain size={19} />
            </div>

            <div className="progress-action-content">

              <span>COGNITIVE PROFILE</span>

              <strong>
                Explore your reasoning strengths
              </strong>

              <p>
                Review your current cognitive profile and skill
                development areas.
              </p>

            </div>

            <Link
              to="/profile"
              className="progress-action-button"
            >
              View Profile
              <ArrowRight size={13} />
            </Link>

          </div>


          <div className="progress-action-card secondary">

            <div className="progress-action-icon">
              <Target size={19} />
            </div>

            <div className="progress-action-content">

              <span>ADAPTIVE TRAINING</span>

              <strong>
                Continue developing your skills
              </strong>

              <p>
                Practice reasoning skills through your personalized
                training path.
              </p>

            </div>

            <Link
              to="/training"
              className="progress-action-button"
            >
              Continue Training
              <ArrowRight size={13} />
            </Link>

          </div>

        </section>

      </div>
    </main>
  );
}