import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Brain,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Activity,
  Sparkles,
  BarChart3,
  Compass,
  Layers3,
  Zap,
  ChevronRight,
  CircleDot,
  Trophy,
} from 'lucide-react';

import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import Loading from '../components/Loading';

import './Dashboard.css';


// ============================================================
// JOURNEY STEP
// ============================================================

function JourneyStep({
  number,
  title,
  description,
  done,
  active,
  to,
}) {
  const content = (
    <div
      className={`dashboard-journey-step ${
        done ? 'is-done' : ''
      } ${active ? 'is-active' : ''}`}
    >
      <div className="dashboard-step-line" />

      <div className="dashboard-step-marker">
        {done ? (
          <CheckCircle2 size={15} />
        ) : (
          <span>{number}</span>
        )}
      </div>

      <div className="dashboard-step-content">
        <div className="dashboard-step-label">
          STEP {number}
        </div>

        <div className="dashboard-step-title">
          {title}
        </div>

        <div className="dashboard-step-description">
          {description}
        </div>
      </div>

      <ChevronRight
        size={15}
        className="dashboard-step-arrow"
      />
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="dashboard-step-link"
      >
        {content}
      </Link>
    );
  }

  return content;
}


// ============================================================
// COGNITIVE ORBIT
// ============================================================

function CognitiveOrbit({ score }) {
  const safeScore = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  );

  const nodes = [
    { x: 50, y: 4 },
    { x: 88, y: 27 },
    { x: 88, y: 73 },
    { x: 50, y: 96 },
    { x: 12, y: 73 },
    { x: 12, y: 27 },
  ];

  return (
    <div className="dashboard-orbit">

      <div className="dashboard-orbit-glow" />

      <div className="dashboard-orbit-ring dashboard-orbit-ring-outer" />
      <div className="dashboard-orbit-ring dashboard-orbit-ring-middle" />
      <div className="dashboard-orbit-ring dashboard-orbit-ring-inner" />

      <div className="dashboard-orbit-dashed" />

      {nodes.map((node, index) => (
        <span
          key={index}
          className={`dashboard-orbit-node ${
            index === 0 ? 'active' : ''
          }`}
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
          }}
        />
      ))}

      <div
        className="dashboard-score-ring"
        style={{
          '--score': `${safeScore}%`,
        }}
      >
        <div className="dashboard-score-inner">
          <Brain size={21} />

          <strong>
            {safeScore.toFixed(0)}%
          </strong>

          <span>
            COGNITIVE SCORE
          </span>
        </div>
      </div>

      <div className="dashboard-orbit-badge">
        <Sparkles size={14} />
      </div>
    </div>
  );
}


// ============================================================
// QUICK METRIC
// ============================================================

function QuickMetric({
  icon: Icon,
  label,
  value,
  description,
  accent = 'purple',
}) {
  return (
    <div
      className={`dashboard-metric-card accent-${accent}`}
    >
      <div className="dashboard-metric-icon">
        <Icon size={17} />
      </div>

      <div className="dashboard-metric-content">
        <div className="dashboard-metric-label">
          {label}
        </div>

        <div className="dashboard-metric-value">
          {value}
        </div>

        {description && (
          <div className="dashboard-metric-description">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// DASHBOARD
// ============================================================

export default function Dashboard() {

  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [progress, setProgress] = useState(null);

  const [status, setStatus] = useState({
    loading: true,
    error: '',
  });


  // ==========================================================
  // LOAD DATA
  // ==========================================================

  useEffect(() => {

    if (authLoading) {
      return;
    }

    let active = true;

    const loadDashboard = async () => {

      setStatus({
        loading: true,
        error: '',
      });

      const results = await Promise.allSettled([
        api.getProfile(),
        api.getProgress(),
      ]);

      if (!active) {
        return;
      }

      const [profileRes, progressRes] = results;

      let loadedProfile =
        profileRes.status === 'fulfilled'
          ? profileRes.value
          : null;

      let loadedProgress =
        progressRes.status === 'fulfilled'
          ? progressRes.value
          : null;


      // Normalize API response if wrapped in data
      if (
        loadedProfile?.data &&
        typeof loadedProfile.data === 'object'
      ) {
        loadedProfile = loadedProfile.data;
      }

      if (
        loadedProgress?.data &&
        typeof loadedProgress.data === 'object'
      ) {
        loadedProgress = loadedProgress.data;
      }


      setProfile(loadedProfile);
      setProgress(loadedProgress);


      const failed = results.find(
        result => result.status === 'rejected'
      );

      const isServerDown =
        failed &&
        failed.reason instanceof ApiError &&
        failed.reason.status === undefined;


      setStatus({
        loading: false,
        error: isServerDown
          ? 'Unable to reach the server. Some information may be unavailable.'
          : '',
      });
    };


    loadDashboard();


    return () => {
      active = false;
    };

  }, [authLoading]);


  // ==========================================================
  // LOADING
  // ==========================================================

  if (authLoading) {
    return (
      <Loading label="Restoring your session…" />
    );
  }

  if (status.loading) {
    return (
      <Loading label="Loading your dashboard…" />
    );
  }


  // ==========================================================
  // PROFILE STATE
  // ==========================================================

  const hasProfile =
    profile?.has_profile === true ||
    profile?.profile_ready === true;


  const hasPost =
    progress?.post_assessment === true;


  // ==========================================================
  // WEAKEST SKILL
  // ==========================================================

  const weakest =
    hasProfile
      ? profile?.weakest_skill
      : null;


  const weakestName =
    weakest &&
    typeof weakest === 'object'
      ? weakest.name || ''
      : weakest || '';


  // ==========================================================
  // STRONGEST SKILL
  // ==========================================================

  const strongest =
    hasProfile
      ? profile?.strongest_skill
      : null;


  const strongestName =
    strongest &&
    typeof strongest === 'object'
      ? strongest.name || ''
      : strongest || '';


  // ==========================================================
  // TRAINING
  // ==========================================================

  const trainingSessions =
    Number(
      progress?.training_sessions ?? 0
    );


  // ==========================================================
  // OVERALL
  // ==========================================================

  const overall =
    Number(
      profile?.overall_score ?? 0
    );


  // ==========================================================
  // QUICK METRICS
  // ==========================================================

  const quickMetrics = [
    {
      icon: Brain,
      label: 'Cognitive score',
      value: hasProfile
        ? `${overall.toFixed(1)}%`
        : '—',
      description: hasProfile
        ? 'Overall reasoning performance'
        : 'Assessment required',
      accent: 'purple',
    },

    {
      icon: Target,
      label: 'Focus dimension',
      value:
        weakestName ||
        'Not identified',
      description: weakestName
        ? 'Priority for improvement'
        : 'Complete your assessment',
      accent: 'blue',
    },

    {
      icon: Activity,
      label: 'Training sessions',
      value: trainingSessions,
      description:
        trainingSessions > 0
          ? 'Practice sessions completed'
          : 'No training yet',
      accent: 'green',
    },

    {
      icon: TrendingUp,
      label: 'Post-assessment',
      value: hasPost
        ? 'Completed'
        : 'Pending',
      description: hasPost
        ? 'Growth measurement available'
        : 'Complete training first',
      accent: 'amber',
    },
  ];


  // ==========================================================
  // JOURNEY PROGRESS
  // ==========================================================

  let journeyProgress = 20;

  if (hasProfile) {
    journeyProgress = 40;
  }

  if (hasProfile && trainingSessions > 0) {
    journeyProgress = 60;
  }

  if (hasPost) {
    journeyProgress = 100;
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="dashboard-page">

      <div className="dashboard-background-grid" />
      <div className="dashboard-background-glow dashboard-glow-one" />
      <div className="dashboard-background-glow dashboard-glow-two" />


      <main className="dashboard-shell">


        {/* ====================================================
            PAGE HEADER
        ==================================================== */}

        <header className="dashboard-page-header">

          <div>

            <div className="dashboard-eyebrow">
              <Sparkles size={13} />
              PERSONALIZED COGNITIVE LEARNING
            </div>

            <h1>
              Your Cognitive Dashboard
            </h1>

            <p>
              Track your reasoning development,
              understand your current focus, and
              continue building stronger cognitive skills.
            </p>

          </div>


          <div className="dashboard-header-actions">

            {hasProfile && (
              <Link
                to="/profile"
                className="dashboard-outline-button"
              >
                <Brain size={15} />
                View Cognitive Profile
                <ArrowRight size={14} />
              </Link>
            )}

          </div>

        </header>


        {/* ====================================================
            HERO
        ==================================================== */}

        <section className="dashboard-hero">

          <div className="dashboard-hero-pattern" />

          <div className="dashboard-hero-content">

            <div className="dashboard-hero-left">

              <div className="dashboard-engine-pill">
                <Sparkles size={13} />
                COGNITA COGNITIVE ENGINE
              </div>


              <h2>
                Welcome back,{' '}
                <span>
                  {user?.name || 'learner'}.
                </span>
              </h2>


              <p className="dashboard-hero-description">
                {hasProfile
                  ? 'Your cognitive journey is underway. Keep strengthening the reasoning skills that matter most.'
                  : 'Begin your cognitive assessment to discover how you reason across six dimensions.'}
              </p>


              {hasProfile && weakestName && (

                <div className="dashboard-focus-banner">

                  <div className="dashboard-focus-icon">
                    <Target size={18} />
                  </div>

                  <div>

                    <div className="dashboard-focus-label">
                      NEXT BEST FOCUS
                    </div>

                    <div className="dashboard-focus-title">
                      {weakestName}
                    </div>

                    <div className="dashboard-focus-description">
                      Your current priority reasoning dimension
                    </div>

                  </div>

                </div>

              )}


              <div className="dashboard-hero-actions">

                <Link
                  to={
                    hasProfile
                      ? '/training'
                      : '/assessment'
                  }
                  className="dashboard-primary-button"
                >
                  {hasProfile
                    ? 'Continue Training'
                    : 'Begin Assessment'}

                  <ArrowRight size={16} />
                </Link>


                {hasProfile && (
                  <Link
                    to="/learning-path"
                    className="dashboard-secondary-button"
                  >
                    <Compass size={15} />
                    Learning Path
                  </Link>
                )}

              </div>

            </div>


            {/* ORBIT */}

            <div className="dashboard-hero-visual">

              <CognitiveOrbit
                score={overall}
              />

              <div className="dashboard-score-caption">
                <span>COGNITIVE PROFILE</span>
                <strong>
                  {hasProfile
                    ? 'Profile generated'
                    : 'Assessment not completed'}
                </strong>
              </div>

            </div>

          </div>

        </section>


        {/* ====================================================
            SERVER WARNING
        ==================================================== */}

        {status.error && (
          <div className="dashboard-alert">
            <AlertTriangle size={18} />
            {status.error}
          </div>
        )}


        {/* ====================================================
            QUICK METRICS
        ==================================================== */}

        <section className="dashboard-metrics">

          {quickMetrics.map(metric => (
            <QuickMetric
              key={metric.label}
              {...metric}
            />
          ))}

        </section>


        {/* ====================================================
            JOURNEY SECTION
        ==================================================== */}

        <section className="dashboard-section-header">

          <div>

            <div className="dashboard-section-eyebrow">
              YOUR COGNITIVE JOURNEY
            </div>

            <h2>
              From assessment to improvement
            </h2>

            <p>
              Cognita guides you through a structured
              reasoning-development cycle.
            </p>

          </div>


          <div className="dashboard-progress-summary">

            <strong>
              {journeyProgress}%
            </strong>

            <span>
              journey progress
            </span>

          </div>

        </section>


        <section className="dashboard-journey-card">

          <div className="dashboard-progress-line">

            <div
              className="dashboard-progress-fill"
              style={{
                width: `${journeyProgress}%`,
              }}
            />

          </div>


          <div className="dashboard-journey-grid">

            <JourneyStep
              number="01"
              title="Cognitive Assessment"
              description="Establish your baseline across six reasoning dimensions."
              done={hasProfile}
              active={!hasProfile}
              to="/assessment"
            />

            <JourneyStep
              number="02"
              title="Cognitive Profile"
              description="Understand your strongest and weakest reasoning abilities."
              done={hasProfile}
              active={hasProfile}
              to="/profile"
            />

            <JourneyStep
              number="03"
              title="Skill Priorities"
              description={
                weakestName
                  ? `Focus your practice on ${weakestName}.`
                  : 'Identify the reasoning dimensions that need attention.'
              }
              done={trainingSessions > 0}
              active={
                hasProfile &&
                trainingSessions === 0
              }
              to="/learning-path"
            />

            <JourneyStep
              number="04"
              title="Adaptive Training"
              description="Practice targeted reasoning questions and receive feedback."
              done={trainingSessions > 0}
              active={
                hasProfile &&
                trainingSessions > 0 &&
                !hasPost
              }
              to="/training"
            />

            <JourneyStep
              number="05"
              title="Post-Assessment"
              description="Measure your reasoning improvement after training."
              done={hasPost}
              active={
                trainingSessions > 0 &&
                !hasPost
              }
              to="/post-assessment"
            />

          </div>

        </section>


        {/* ====================================================
            MAIN CONTENT
        ==================================================== */}

        <section className="dashboard-main-grid">


          {/* ==================================================
              FOCUS AREA
          ================================================== */}

          <div className="dashboard-dark-card">

            <div className="dashboard-card-header">

              <div>

                <div className="dashboard-card-icon purple">
                  <Target size={17} />
                </div>

                <div className="dashboard-card-heading">
                  <h3>
                    Current focus
                  </h3>

                  <p>
                    Your highest-priority reasoning dimension
                  </p>
                </div>

              </div>

              <span className="dashboard-status-pill">
                PRIORITY
              </span>

            </div>


            {weakestName ? (

              <div className="dashboard-focus-content">

                <div className="dashboard-focus-large-icon">
                  <Target size={25} />
                </div>

                <div>

                  <div className="dashboard-focus-kicker">
                    NEXT BEST PRACTICE
                  </div>

                  <h3>
                    {weakestName}
                  </h3>

                  <p>
                    This dimension currently has the
                    most room for improvement in your
                    cognitive profile.
                  </p>

                </div>

                <Link
                  to="/training"
                  className="dashboard-card-button"
                >
                  Train this skill
                  <ArrowRight size={15} />
                </Link>

              </div>

            ) : (

              <EmptyState
                icon={Target}
                title="Focus area not identified"
                message="Complete the pre-assessment to discover your priority reasoning skill."
                actionTo="/assessment"
                actionLabel="Start Assessment"
              />

            )}

          </div>


          {/* ==================================================
              TRAINING ACTIVITY
          ================================================== */}

          <div className="dashboard-dark-card">

            <div className="dashboard-card-header">

              <div>

                <div className="dashboard-card-icon green">
                  <Activity size={17} />
                </div>

                <div className="dashboard-card-heading">
                  <h3>
                    Training activity
                  </h3>

                  <p>
                    Your current practice momentum
                  </p>
                </div>

              </div>

              <span className="dashboard-status-pill">
                {trainingSessions} SESSIONS
              </span>

            </div>


            <div className="dashboard-training-content">

              <div className="dashboard-training-orb">
                <Zap size={22} />
              </div>

              <div>

                <strong>
                  {trainingSessions > 0
                    ? 'Keep the momentum going'
                    : 'Ready to start practicing?'}
                </strong>

                <p>
                  {trainingSessions > 0
                    ? 'Consistency turns practice into measurable growth.'
                    : 'Begin adaptive training from your cognitive profile.'}
                </p>

              </div>

            </div>


            <Link
              to="/training"
              className="dashboard-primary-button compact"
            >
              {trainingSessions > 0
                ? 'Continue Training'
                : 'Start Training'}

              <ArrowRight size={15} />
            </Link>

          </div>

        </section>


        {/* ====================================================
            PROFILE SNAPSHOT
        ==================================================== */}

        {hasProfile && (

          <section className="dashboard-profile-strip">

            <div className="dashboard-profile-strip-icon">
              <Trophy size={20} />
            </div>

            <div className="dashboard-profile-strip-content">

              <div className="dashboard-section-eyebrow">
                COGNITIVE PROFILE
              </div>

              <h3>
                Your reasoning profile is ready.
              </h3>

              <p>
                {strongestName
                  ? `Your strongest identified dimension is ${strongestName}.`
                  : 'Explore your six-dimensional reasoning profile.'}
              </p>

            </div>

            <Link
              to="/profile"
              className="dashboard-secondary-button"
            >
              Explore Profile
              <ArrowRight size={15} />
            </Link>

          </section>

        )}


        {/* ====================================================
            POST ASSESSMENT CTA
        ==================================================== */}

        <section className="dashboard-final-cta">

          <div className="dashboard-final-icon">

            {hasPost ? (
              <CheckCircle2 size={22} />
            ) : (
              <BarChart3 size={22} />
            )}

          </div>


          <div className="dashboard-final-content">

            <div className="dashboard-section-eyebrow">
              NEXT MILESTONE
            </div>

            <h3>
              {hasPost
                ? 'Your improvement is ready to explore.'
                : 'Measure your cognitive improvement.'}
            </h3>

            <p>
              {hasPost
                ? 'Open Progress to compare your cognitive journey.'
                : 'Complete adaptive training and take the post-assessment.'}
            </p>

          </div>


          <Link
            to={
              hasPost
                ? '/progress'
                : '/post-assessment'
            }
            className="dashboard-primary-button"
          >
            {hasPost
              ? 'View Progress'
              : 'Post-Assessment'}

            <ArrowRight size={15} />
          </Link>

        </section>


      </main>

    </div>
  );
}