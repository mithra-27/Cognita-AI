import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Brain,
  Trophy,
  AlertTriangle,
  Sparkles,
  AlertCircle,
  Gauge,
  ArrowUpRight,
  Target,
  UserRound,
  ShieldCheck,
  TrendingUp,
  Focus,
  Zap,
  Activity,
  Layers3,
} from 'lucide-react';

import { api, ApiError } from '../api/client';
import { DIMENSIONS } from '../data/dimensions';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';

import './CognitiveProfile.css';

/* =========================================================
   HELPERS
========================================================= */

function safeScore(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(0, Math.min(100, n));
}

function normalizeProfile(response) {
  if (
    response?.data &&
    typeof response.data === 'object' &&
    (
      response.data.has_profile !== undefined ||
      response.data.profile_ready !== undefined ||
      response.data.scores !== undefined ||
      response.data.skill_scores !== undefined
    )
  ) {
    return response.data;
  }

  return response || {};
}

/* =========================================================
   FLOATING NEURAL PARTICLES
========================================================= */

function NeuralParticles() {
  const particles = Array.from({ length: 18 });

  return (
    <div className="neural-particles" aria-hidden="true">
      {particles.map((_, index) => (
        <span
          key={index}
          className="neural-particle"
          style={{
            '--particle-index': index,
            '--particle-delay': `${(index % 7) * 0.45}s`,
            '--particle-x': `${(index * 31) % 100}%`,
            '--particle-y': `${(index * 47) % 100}%`,
          }}
        />
      ))}
    </div>
  );
}

/* =========================================================
   COGNITIVE ORB
========================================================= */

function CognitiveOrb({ score }) {
  const safe = safeScore(score);

  return (
    <div className="cognitive-orb-wrapper">
      <div className="orb-shadow" />

      <div className="cognitive-orb">
        <div className="orb-inner">
          <Brain size={34} className="orb-brain" />

          <strong>{Math.round(safe)}</strong>

          <span>COGNITIVE INDEX</span>
        </div>

        <div className="orb-ring orb-ring-one" />
        <div className="orb-ring orb-ring-two" />
        <div className="orb-ring orb-ring-three" />

        <span className="orb-node node-one" />
        <span className="orb-node node-two" />
        <span className="orb-node node-three" />
        <span className="orb-node node-four" />
      </div>
    </div>
  );
}

/* =========================================================
   RADAR CHART
========================================================= */

function RadarChart({ scores }) {
  const size = 340;
  const center = size / 2;
  const radius = 112;
  const levels = 4;
  const dimensions = DIMENSIONS;
  const n = dimensions.length;

  const angle = (index) =>
    (Math.PI * 2 * index) / n - Math.PI / 2;

  const point = (index, r) => {
    const a = angle(index);

    return [
      center + r * Math.cos(a),
      center + r * Math.sin(a),
    ];
  };

  const polygon = (points) =>
    points.map((pointValue) => pointValue.join(',')).join(' ');

  const dataPoints = dimensions.map((dimension, index) => {
  const rawValue =
    scores?.[dimension.key] ??
    scores?.[dimension.sanskrit] ??
    scores?.[dimension.english] ??
    0;

  const value = safeScore(rawValue);

  return point(
    index,
    radius * (value / 100)
  );
});

  return (
    <div className="radar-stage">
      <div className="radar-glow" />

      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="cognitive-radar"
        role="img"
        aria-label="Six dimensional cognitive profile radar chart"
      >
        <defs>
          <linearGradient
            id="cognitiveRadarGradient"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#d7c8ff"
              stopOpacity="0.42"
            />

            <stop
              offset="50%"
              stopColor="#9473ff"
              stopOpacity="0.23"
            />

            <stop
              offset="100%"
              stopColor="#5b3dcc"
              stopOpacity="0.06"
            />
          </linearGradient>

          <filter id="radarGlow">
            <feGaussianBlur
              stdDeviation="4"
              result="blur"
            />

            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background levels */}
        {Array.from({ length: levels }).map(
          (_, level) => {
            const r =
              (radius * (level + 1)) /
              levels;

            return (
              <polygon
                key={level}
                points={polygon(
                  dimensions.map((_, index) =>
                    point(index, r)
                  )
                )}
                fill="none"
                stroke="rgba(205,190,255,.12)"
                strokeWidth="1"
                className="radar-grid"
              />
            );
          }
        )}

        {/* Axis lines */}
        {dimensions.map((dimension, index) => {
          const [x, y] = point(
            index,
            radius
          );

          return (
            <line
              key={dimension.key}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(205,190,255,.11)"
              strokeWidth="1"
            />
          );
        })}

        {/* Cognitive area */}
        <polygon
          points={polygon(dataPoints)}
          fill="url(#cognitiveRadarGradient)"
          stroke="#b9a4ff"
          strokeWidth="2.5"
          filter="url(#radarGlow)"
          className="radar-data-area"
        />

        {/* Data nodes */}
        {dataPoints.map(
          ([x, y], index) => (
            <g key={index}>
              <circle
                cx={x}
                cy={y}
                r="9"
                fill="rgba(151,116,255,.12)"
                className="radar-node-glow"
              />

              <circle
                cx={x}
                cy={y}
                r="4.5"
                fill="#f2edff"
                stroke="#9a79ff"
                strokeWidth="2"
              />
            </g>
          )
        )}

        {/* Labels */}
        {dimensions.map(
          (dimension, index) => {
            const [x, y] = point(
              index,
              radius + 28
            );

            return (
              <text
                key={dimension.key}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="700"
                fill="#c9bdf0"
              >
                {dimension.sanskrit}
              </text>
            );
          }
        )}
      </svg>

      <div className="radar-center">
        <Brain size={20} />
        <span>REASONING</span>
      </div>
    </div>
  );
}

/* =========================================================
   SCORE RING
========================================================= */

function ScoreRing({ value }) {
  const safe = safeScore(value);

  const radius = 54;
  const circumference =
    2 * Math.PI * radius;

  const dash =
    (safe / 100) * circumference;

  return (
    <div className="score-ring">
      <svg
        viewBox="0 0 142 142"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="scoreRingGradient"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#ddd2ff"
            />

            <stop
              offset="100%"
              stopColor="#7451ed"
            />
          </linearGradient>
        </defs>

        <circle
          cx="71"
          cy="71"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,.08)"
          strokeWidth="10"
        />

        <circle
          cx="71"
          cy="71"
          r={radius}
          fill="none"
          stroke="url(#scoreRingGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="score-ring-progress"
        />
      </svg>

      <div className="score-ring-content">
        <strong>{Math.round(safe)}%</strong>
        <span>overall</span>
      </div>
    </div>
  );
}

/* =========================================================
   DIMENSION CARD
========================================================= */

function DimensionCard({
  dimension,
  score,
  index,
  strongest,
  weakest,
}) {
  const safe = safeScore(score);

  const isStrongest =
    dimension.key === strongest;

  const isWeakest =
    dimension.key === weakest;

  return (
    <div
      className={`dimension-analysis-card ${
        isStrongest
          ? 'dimension-strongest'
          : ''
      } ${
        isWeakest
          ? 'dimension-focus'
          : ''
      }`}
      style={{
        '--dimension-delay': `${index * 0.07}s`,
      }}
    >
      <div className="dimension-analysis-top">
        <div className="dimension-index">
          {String(index + 1).padStart(2, '0')}
        </div>

        <div className="dimension-title">
          <strong>
            {dimension.sanskrit}
          </strong>

          <span>
            {dimension.english}
          </span>
        </div>

        <div className="dimension-score">
          {Math.round(safe)}
        </div>
      </div>

      <div className="dimension-progress">
        <span
          style={{
            width: `${safe}%`,
          }}
        />
      </div>

      <div className="dimension-analysis-bottom">
        <span>
          {safe >= 70
            ? 'Strong expression'
            : safe >= 45
            ? 'Developing'
            : 'Focus area'}
        </span>

        {isStrongest && (
          <span className="dimension-status strong">
            <TrendingUp size={13} />
            Current edge
          </span>
        )}

        {isWeakest && (
          <span className="dimension-status focus">
            <Target size={13} />
            Development focus
          </span>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   COGNITIVE PROFILE
========================================================= */

export default function CognitiveProfile({
  embedded = false,
}) {
  const { user } = useAuth();

  const [profile, setProfile] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  /*
    IMPORTANT:
    All hooks are declared before ANY return.
    This fixes:
    "Rendered more hooks than during the previous render."
  */

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setError('');

        const response =
          await api.getProfile();

        const normalized =
          normalizeProfile(response);

        if (active) {
          setProfile(normalized);
        }
      } catch (err) {
        console.error(
          'Failed to load cognitive profile:',
          err
        );

        if (active) {
          setError(
            err instanceof ApiError
              ? err.message ||
                'Unable to load your cognitive profile.'
              : 'Unable to load your cognitive profile.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  /*
    Calculate all derived values BEFORE render returns.
    No hooks are used here.
  */

  const hasProfile =
    profile?.has_profile === true ||
    profile?.profile_ready === true;

  const scores =
    profile?.scores ||
    profile?.skill_scores ||
    {};

  const overall = safeScore(
    profile?.overall_score
  );

  const strongest =
    profile?.strongest_skill || '';

  const weakest =
    profile?.weakest_skill || '';

  const skillLevel =
    profile?.skill_level ||
    'Beginner';

  const summary =
    profile?.summary || '';

  const strongestName =
    typeof strongest === 'object'
      ? strongest.name
      : strongest;

  const weakestName =
    typeof weakest === 'object'
      ? weakest.name
      : weakest;

  const strongestKey =
    typeof strongest === 'object'
      ? strongest.key
      : String(strongest)
          .toLowerCase()
          .replace(/[^a-z]/g, '');

  const weakestKey =
    typeof weakest === 'object'
      ? weakest.key
      : String(weakest)
          .toLowerCase()
          .replace(/[^a-z]/g, '');

  const ordered = DIMENSIONS.map(
    (dimension) => ({
      ...dimension,
      score: safeScore(
        scores?.[dimension.key]
      ),
    })
  ).sort(
    (a, b) => b.score - a.score
  );

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div
        className={
          embedded
            ? 'cognitive-embedded-shell'
            : 'container cognitive-page'
        }
      >
        <div className="cognitive-loading">
          <div className="loading-brain">
            <Brain size={32} />
          </div>

          <strong>
            Mapping your cognitive profile…
          </strong>

          <span>
            Connecting your reasoning dimensions
          </span>
        </div>
      </div>
    );
  }

  /* =======================================================
     EMPTY PROFILE
  ======================================================= */

  if (!hasProfile) {
    return (
      <div
        className={
          embedded
            ? 'cognitive-embedded-shell'
            : 'container cognitive-page'
        }
      >
        <div className="cognitive-empty">
          <div className="empty-brain">
            <Brain size={34} />
          </div>

          <span className="cognitive-eyebrow">
            COGNITIVE PROFILE
          </span>

          <h2>
            Build your cognitive identity
          </h2>

          <p>
            Complete the pre-assessment to
            generate your six-dimensional
            reasoning profile.
          </p>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <EmptyState
            icon={Brain}
            title="Cognitive profile not available"
            message="Complete the pre-assessment to unlock your reasoning profile."
            actionTo="/assessment"
            actionLabel="Start Cognitive Assessment"
          />
        </div>
      </div>
    );
  }

  /* =======================================================
     PROFILE CONTENT
  ======================================================= */

  const content = (
    <div
      className={
        embedded
          ? 'cognitive-embedded-content'
          : 'cognitive-page-content'
      }
    >
      {/* ===================================================
          3D COGNITIVE HERO
      =================================================== */}

      <section className="cognitive-hero">
        <NeuralParticles />

        <div className="hero-light hero-light-one" />
        <div className="hero-light hero-light-two" />

        <div className="cognitive-hero-grid">
          <div className="cognitive-hero-copy">
            <div className="cognitive-identity-badge">
              <ShieldCheck size={15} />
              <span>
                COGNITIVE IDENTITY
              </span>
            </div>

            <h1>
              {user?.name ||
                'Learner'}
            </h1>

            <p className="cognitive-email">
              {user?.email ||
                'Your reasoning profile'}
            </p>

            <p className="cognitive-hero-description">
              Your reasoning profile maps six
              cognitive dimensions into a
              visual representation of your
              current reasoning strengths and
              development areas.
            </p>

            <div className="cognitive-pills">
              <span>
                <Brain size={13} />
                Six dimensions
              </span>

              <span>
                <Activity size={13} />
                Assessment based
              </span>

              <span>
                <Layers3 size={13} />
                Reasoning profile
              </span>
            </div>
          </div>

          <div className="cognitive-hero-orb">
            <CognitiveOrb
              score={overall}
            />
          </div>

          <div className="cognitive-hero-score">
            <ScoreRing
              value={overall}
            />

            <div>
              <span>
                CURRENT LEVEL
              </span>

              <strong>
                {skillLevel}
              </strong>

              <small>
                Overall reasoning
                profile
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          QUICK SNAPSHOT
      =================================================== */}

      <section className="cognitive-snapshot">
        <div className="cognitive-snapshot-card">
          <div className="snapshot-icon">
            <Trophy size={19} />
          </div>

          <span>
            CURRENT EDGE
          </span>

          <strong>
            {strongestName || '—'}
          </strong>

          <small>
            Strongest assessed
            dimension
          </small>
        </div>

        <div className="cognitive-snapshot-card">
          <div className="snapshot-icon">
            <Focus size={19} />
          </div>

          <span>
            DEVELOPMENT FOCUS
          </span>

          <strong>
            {weakestName || '—'}
          </strong>

          <small>
            Dimension to practise
          </small>
        </div>

        <div className="cognitive-snapshot-card">
          <div className="snapshot-icon">
            <Gauge size={19} />
          </div>

          <span>
            PROFILE LEVEL
          </span>

          <strong>
            {skillLevel}
          </strong>

          <small>
            Current reasoning level
          </small>
        </div>
      </section>

      {/* ===================================================
          CONSTELLATION
      =================================================== */}

      <section className="cognitive-main-grid">
        <div className="cognitive-panel constellation-panel">
          <div className="cognitive-panel-heading">
            <div>
              <span>
                COGNITIVE CONSTELLATION
              </span>

              <h2>
                Your reasoning shape
              </h2>

              <p>
                A visual map of your six
                Mīmāṃsā-inspired reasoning
                dimensions.
              </p>
            </div>

            <div className="heading-icon">
              <Sparkles size={18} />
            </div>
          </div>

          <RadarChart
            scores={scores}
          />
        </div>

        {/* =================================================
            DIMENSION STRENGTHS
        ================================================= */}

        <div className="cognitive-panel dimension-panel">
          <div className="cognitive-panel-heading">
            <div>
              <span>
                DIMENSION ANALYSIS
              </span>

              <h2>
                Reasoning fingerprint
              </h2>

              <p>
                Your six assessed cognitive
                dimensions.
              </p>
            </div>

            <div className="heading-icon">
              <Zap size={18} />
            </div>
          </div>

          <div className="dimension-analysis-list">
            {ordered.map(
              (
                dimension,
                index
              ) => (
                <DimensionCard
                  key={
                    dimension.key
                  }
                  dimension={
                    dimension
                  }
                  score={
                    dimension.score
                  }
                  index={
                    index
                  }
                  strongest={
                    strongestKey
                  }
                  weakest={
                    weakestKey
                  }
                />
              )
            )}
          </div>
        </div>
      </section>

      {/* ===================================================
          INTERPRETATION
      =================================================== */}

      {summary && (
        <section className="interpretation-panel">
          <div className="interpretation-orb">
            <Sparkles size={21} />
          </div>

          <div>
            <span>
              COGNITIVE INTERPRETATION
            </span>

            <h2>
              What your profile suggests
            </h2>

            <p>
              {summary}
            </p>
          </div>
        </section>
      )}

      {/* ===================================================
          EDGE + FOCUS
      =================================================== */}

      <section className="cognitive-insight-grid">
        <div className="cognitive-insight-card edge-card">
          <div className="insight-top">
            <div className="insight-icon">
              <TrendingUp size={20} />
            </div>

            <span>
              CURRENT EDGE
            </span>
          </div>

          <h3>
            {strongestName ||
              'Strongest dimension'}
          </h3>

          <p>
            This dimension currently
            represents your strongest
            assessed reasoning area.
          </p>
        </div>

        <div className="cognitive-insight-card focus-card">
          <div className="insight-top">
            <div className="insight-icon">
              <Target size={20} />
            </div>

            <span>
              DEVELOPMENT FOCUS
            </span>
          </div>

          <h3>
            {weakestName ||
              'Focus dimension'}
          </h3>

          <p>
            Adaptive practice can use
            this dimension as a focus
            for continued reasoning
            development.
          </p>
        </div>
      </section>

      {/* ===================================================
          ACTION
      =================================================== */}

      <section className="cognitive-action-panel">
        <div className="action-icon">
          <Brain size={22} />
        </div>

        <div className="action-copy">
          <span>
            CONTINUE YOUR COGNITIVE JOURNEY
          </span>

          <h2>
            Turn insight into practice
          </h2>

          <p>
            Continue with adaptive training
            to practise your reasoning
            dimensions.
          </p>
        </div>

        <Link
          to="/training"
          className="cognitive-action-button"
        >
          Continue Training
          <ArrowUpRight size={17} />
        </Link>
      </section>
    </div>
  );

  /* =======================================================
     STANDALONE / EMBEDDED WRAPPER
  ======================================================= */

  if (embedded) {
    return (
      <div className="cognitive-embedded-shell">
        {content}
      </div>
    );
  }

  return (
    <div className="container cognitive-page">
      {content}
    </div>
  );
}