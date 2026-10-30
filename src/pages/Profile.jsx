import React, { useEffect, useMemo, useState } from 'react';

import {
  Award,
  BrainCircuit,
  Check,
  ChevronRight,
  Flame,
  GraduationCap,
  LockKeyhole,
  MessageCircleQuestion,
  RotateCcw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  BookOpen,
  BarChart3,
  Eye,
  EyeOff,
  Activity,
  Zap,
  Layers3,
  ArrowUpRight,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import { api, ApiError } from '../api/client';
import CognitiveProfile from './CognitiveProfile';

import './Profile.css';


/* ============================================================
   DIMENSIONS
============================================================ */

const DIMENSIONS = [
  {
    key: 'anumana',
    name: 'Anumāna',
    skill: 'Logical / inferential reasoning',
    short: 'Inference',
  },
  {
    key: 'arthapatti',
    name: 'Arthāpatti',
    skill: 'Abductive reasoning / problem solving',
    short: 'Abduction',
  },
  {
    key: 'upamana',
    name: 'Upamāna',
    skill: 'Analogical reasoning',
    short: 'Analogy',
  },
  {
    key: 'pratyaksha',
    name: 'Pratyakṣa',
    skill: 'Observation / visual reasoning',
    short: 'Observation',
  },
  {
    key: 'shabda',
    name: 'Śabda',
    skill: 'Reading comprehension / interpretation',
    short: 'Interpretation',
  },
  {
    key: 'anupalabdhi',
    name: 'Anupalabdhi',
    skill: 'Absence / contradiction / elimination reasoning',
    short: 'Elimination',
  },
];


/* ============================================================
   BADGES
============================================================ */

const BADGES = [
  {
    days: 1,
    name: 'First Step',
    icon: '🌱',
    text: 'Started your Cognita journey.',
  },
  {
    days: 3,
    name: 'Reasoning Spark',
    icon: '⚡',
    text: 'Three consecutive learning days.',
  },
  {
    days: 7,
    name: 'Week of Wisdom',
    icon: '🏆',
    text: 'A complete week of continuous practice.',
  },
  {
    days: 14,
    name: 'Reasoning Rhythm',
    icon: '🔥',
    text: 'Two weeks of consistent reasoning practice.',
  },
  {
    days: 30,
    name: 'Cognitive Momentum',
    icon: '💎',
    text: 'A full month of continuous activity.',
  },
  {
    days: 60,
    name: 'Deep Thinker',
    icon: '🧠',
    text: 'Sixty days of cognitive practice.',
  },
  {
    days: 100,
    name: 'Cognita Mastery',
    icon: '👑',
    text: 'One hundred days of consistency.',
  },
];


/* ============================================================
   HELPERS
============================================================ */

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}


function extractData(response) {
  return response?.data &&
    typeof response.data === 'object'
    ? response.data
    : response || {};
}


function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[āáàâä]/g, 'a')
    .replace(/[īíìîï]/g, 'i')
    .replace(/[ūúùûü]/g, 'u')
    .replace(/[ṣśš]/g, 's')
    .replace(/[ṛ]/g, 'r')
    .replace(/[^a-z]/g, '');
}


function scoreFor(scores, key) {
  if (!scores || typeof scores !== 'object') {
    return 0;
  }

  if (scores[key] !== undefined) {
    return number(scores[key]);
  }

  const wanted = normalizeKey(key);

  const match = Object.entries(scores).find(
    ([name]) => normalizeKey(name) === wanted
  );

  return match ? number(match[1]) : 0;
}


/* ============================================================
   COGNITIVE CORE
============================================================ */

function CognitiveCore({ score }) {
  const safeScore = Math.max(
    0,
    Math.min(100, number(score))
  );

  return (
    <div
      className="cognitive-core"
      aria-label={`Current cognitive score ${Math.round(safeScore)} out of 100`}
    >

      <div className="core-aura" />

      <div className="core-orbit orbit-one" />
      <div className="core-orbit orbit-two" />
      <div className="core-orbit orbit-three" />

      {[0, 1, 2, 3, 4, 5].map((item) => (
        <span
          key={item}
          className={`core-node node-${item}`}
        />
      ))}

      <div className="core-center">

        <div
          className="core-score-ring"
          style={{
            '--score': `${safeScore * 3.6}deg`,
          }}
        >
          <div className="core-score-inner">

            <BrainCircuit size={23} />

            <strong>
              {Math.round(safeScore)}
            </strong>

            <span>
              COGNITIVE
            </span>

          </div>
        </div>

      </div>

    </div>
  );
}


/* ============================================================
   LINE CHART
============================================================ */

function LineChart({ history, selectedSkill }) {

  const width = 860;
  const height = 300;

  const left = 58;
  const right = 24;
  const top = 28;
  const bottom = 52;

  const chartW = width - left - right;
  const chartH = height - top - bottom;

  const points = history.map((item, index) => ({
    x:
      history.length === 1
        ? left + chartW / 2
        : left +
          (index / (history.length - 1)) *
            chartW,

    y:
      top +
      chartH -
      (
        Math.max(
          0,
          Math.min(
            100,
            number(item.overall_score)
          )
        ) / 100
      ) *
        chartH,

    value: number(item.overall_score),
    label: item.label,
  }));

  const path = points
    .map(
      (p, index) =>
        `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    )
    .join(' ');

  const area =
    points.length > 1
      ? `${path} L ${
          points[points.length - 1].x
        } ${top + chartH} L ${
          points[0].x
        } ${top + chartH} Z`
      : '';

  if (!history.length) {
    return (
      <div className="profile-chart-empty">

        <div className="chart-empty-icon">
          <TrendingUp size={28} />
        </div>

        <strong>
          Your growth line will appear here
        </strong>

        <span>
          Complete assessments to create real
          Baseline → Post-Assessment checkpoints.
        </span>

      </div>
    );
  }

  return (
    <div className="profile-chart-wrap">

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="profile-line-chart"
        role="img"
        aria-label="Cognitive score progression line chart"
      >

        <defs>

          <linearGradient
            id="profileAreaGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >

            <stop
              offset="0%"
              stopColor="#9b7cff"
              stopOpacity=".32"
            />

            <stop
              offset="100%"
              stopColor="#9b7cff"
              stopOpacity="0"
            />

          </linearGradient>

          <filter id="profileGlow">

            <feGaussianBlur
              stdDeviation="3"
              result="blur"
            />

            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>

          </filter>

        </defs>


        {[0, 25, 50, 75, 100].map((tick) => {

          const y =
            top +
            chartH -
            (tick / 100) * chartH;

          return (
            <g key={tick}>

              <line
                x1={left}
                y1={y}
                x2={width - right}
                y2={y}
                className="chart-grid-line"
              />

              <text
                x={left - 12}
                y={y + 4}
                textAnchor="end"
                className="chart-axis-label"
              >
                {tick}
              </text>

            </g>
          );
        })}


        {area && (
          <path
            d={area}
            className="chart-area"
          />
        )}


        {points.length > 1 && (
          <path
            d={path}
            className="chart-line"
            filter="url(#profileGlow)"
          />
        )}


        {points.map((point) => (
          <g
            key={`${point.label}-${point.x}`}
          >

            <circle
              cx={point.x}
              cy={point.y}
              r="9"
              className="chart-point-ring"
            />

            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              className="chart-point"
            />

            <text
              x={point.x}
              y={height - 20}
              textAnchor="middle"
              className="chart-label"
            >
              {point.label}
            </text>

            <text
              x={point.x}
              y={point.y - 14}
              textAnchor="middle"
              className="chart-value"
            >
              {Math.round(point.value)}
            </text>

          </g>
        ))}

      </svg>


      <div className="chart-caption">

        <span>
          <span className="legend-dot" />
          Official assessment score
        </span>

        {selectedSkill ? (
          <span>
            Viewing: {selectedSkill.name}
          </span>
        ) : (
          <span>
            Real assessment checkpoints only
          </span>
        )}

      </div>

    </div>
  );
}


/* ============================================================
   STREAK CALENDAR
============================================================ */

function StreakCalendar({ activeDates }) {

  const active = new Set(activeDates || []);

  const today = new Date();

  const days = Array.from(
    { length: 7 },
    (_, index) => {

      const d = new Date(today);

      d.setDate(
        today.getDate() - (6 - index)
      );

      const key =
        `${d.getFullYear()}-` +
        `${String(d.getMonth() + 1).padStart(2, '0')}-` +
        `${String(d.getDate()).padStart(2, '0')}`;

      return {
        key,

        day: d
          .toLocaleDateString(undefined, {
            weekday: 'short',
          })
          .slice(0, 2),

        date: d.getDate(),

        active: active.has(key),
      };
    }
  );

  return (
    <div className="streak-week">

      {days.map((day) => (

        <div
          className={`streak-day ${
            day.active ? 'active' : ''
          }`}
          key={day.key}
        >

          <span>
            {day.day}
          </span>

          <div className="streak-day-orb">

            {day.active ? (
              <Check size={15} />
            ) : (
              day.date
            )}

          </div>

        </div>
      ))}

    </div>
  );
}


/* ============================================================
   PROFILE
============================================================ */

export default function Profile() {

  const navigate = useNavigate();

  const [progress, setProgress] =
    useState(null);

  const [account, setAccount] =
    useState(null);

  const [selectedKey, setSelectedKey] =
    useState('anumana');

  const [
    showCognitiveProfile,
    setShowCognitiveProfile,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');


  /* ==========================================================
     LOAD
  ========================================================== */

  useEffect(() => {

    let active = true;

    async function load() {

      try {

        setLoading(true);
        setError('');

        const [
          progressResponse,
          meResponse,
        ] = await Promise.all([
          api.getProgress(),
          api.me().catch(() => null),
        ]);

        if (!active) {
          return;
        }

        setProgress(
          extractData(progressResponse)
        );

        setAccount(
          extractData(meResponse)
        );

      } catch (err) {

        if (active) {

          setError(
            err instanceof ApiError
              ? err.message
              : 'Unable to load your personal profile.'
          );

        }

      } finally {

        if (active) {
          setLoading(false);
        }

      }
    }

    load();

    return () => {
      active = false;
    };

  }, []);


  /* ==========================================================
     DATA
  ========================================================== */

  const profile =
    progress?.profile || {};

  const scores =
    profile.skill_scores ||
    profile.scores ||
    progress?.post_scores ||
    progress?.pre_scores ||
    {};

  const history =
    Array.isArray(progress?.assessment_history)
      ? progress.assessment_history
      : [];

  const selectedSkill =
    DIMENSIONS.find(
      (item) =>
        item.key === selectedKey
    ) || DIMENSIONS[0];

  const selectedHistory = useMemo(
    () =>
      history.map((item) => ({
        ...item,
        overall_score: scoreFor(
          item.skill_scores,
          selectedSkill.key
        ),
      })),
    [history, selectedSkill.key]
  );


  const streak =
    progress?.streak || {};

  const currentStreak =
    number(streak.current_streak);

  const longestStreak =
    number(streak.longest_streak);

  const totalTraining =
    number(progress?.training_sessions);


  const overall = number(
    profile.overall_score ??
      (
        history.length
          ? history[
              history.length - 1
            ]?.overall_score
          : 0
      )
  );


  const strongestKey =
    normalizeKey(
      profile.strongest_skill
    );

  const weakestKey =
    normalizeKey(
      profile.weakest_skill
    );


  const strongest =
    DIMENSIONS.find(
      (d) =>
        normalizeKey(d.key) ===
          strongestKey ||
        normalizeKey(d.name) ===
          strongestKey
    );


  const weakest =
    DIMENSIONS.find(
      (d) =>
        normalizeKey(d.key) ===
          weakestKey ||
        normalizeKey(d.name) ===
          weakestKey
    );


  const training =
    progress?.training || {};


  const userName =
    account?.name ||
    account?.user?.name ||
    'Cognita Learner';


  const userEmail =
    account?.email ||
    account?.user?.email ||
    '';


  const nextBadge =
    streak.next_badge ||
    BADGES.find(
      (badge) =>
        longestStreak < badge.days
    );


  const badgeProgress =
    nextBadge
      ? Math.min(
          100,
          (currentStreak /
            nextBadge.days) *
            100
        )
      : 100;


  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {

    return (
      <div className="container profile-page">

        <div className="profile-loading">

          <div className="loading-core">
            <BrainCircuit size={30} />
          </div>

          <strong>
            Building your cognitive identity…
          </strong>

          <span>
            Mapping your reasoning journey
          </span>

        </div>

      </div>
    );
  }


  /* ==========================================================
     ERROR
  ========================================================== */

  if (error) {

    return (
      <div className="container profile-page">

        <div className="profile-error">

          <RotateCcw size={22} />

          <strong>
            {error}
          </strong>

          <button
            onClick={() =>
              window.location.reload()
            }
          >
            Try again
          </button>

        </div>

      </div>
    );
  }


  /* ==========================================================
     EMPTY PROFILE
  ========================================================== */

  if (
    !profile?.has_profile &&
    !progress?.has_pre_assessment
  ) {

    return (
      <div className="container profile-page">

        <section className="identity-hero empty-profile">

          <div className="hero-neural-bg" />

          <div className="hero-particle particle-a" />
          <div className="hero-particle particle-b" />
          <div className="hero-particle particle-c" />

          <div className="identity-avatar">
            <BrainCircuit size={36} />
          </div>

          <div>

            <span className="eyebrow">
              PERSONAL COGNITIVE IDENTITY
            </span>

            <h1>
              Build your Cognita profile
            </h1>

            <p>
              Complete your pre-assessment and
              this page will transform your real
              assessment and learning activity
              into a personal cognitive journey.
            </p>

          </div>

          <button
            className="profile-primary-action"
            onClick={() =>
              navigate('/assessment')
            }
          >
            Start assessment
            <ChevronRight size={17} />
          </button>

        </section>

      </div>
    );
  }


  /* ==========================================================
     MAIN
  ========================================================== */

  return (

    <div className="container profile-page">

      {/* ======================================================
          HERO
      ====================================================== */}

      <section className="identity-hero">

        <div className="hero-neural-bg" />

        <div className="hero-particle particle-a" />
        <div className="hero-particle particle-b" />
        <div className="hero-particle particle-c" />

        <div className="identity-main">

          <div className="identity-avatar">
            <UserRound size={34} />
          </div>

          <div>

            <span className="eyebrow">
              MY COGNITIVE IDENTITY
            </span>

            <h1>
              {userName}
            </h1>

            {userEmail && (
              <p className="identity-email">
                {userEmail}
              </p>
            )}

            <p className="identity-summary">
              {profile.summary ||
                'Your profile connects assessment evidence, targeted practice and continuous learning into one reasoning journey.'}
            </p>

            <div className="hero-mini-stats">

              <div>
                <Activity size={14} />
                <span>
                  {history.length} checkpoints
                </span>
              </div>

              <div>
                <Zap size={14} />
                <span>
                  {totalTraining} training attempts
                </span>
              </div>

              <div>
                <Layers3 size={14} />
                <span>
                  6 reasoning dimensions
                </span>
              </div>

            </div>

          </div>

        </div>


        <div className="hero-core-section">

          <CognitiveCore
            score={overall}
          />

          <div className="hero-level">

            <span>
              CURRENT LEVEL
            </span>

            <strong>
              {profile.skill_level ||
                'Beginner'}
            </strong>

            <div className="hero-score">
              {Math.round(overall)}
              <small>/100</small>
            </div>

          </div>

        </div>

      </section>


      {/* ======================================================
          COGNITIVE PROFILE
      ====================================================== */}

      <section className="cognitive-profile-trigger">

        <div className="cognitive-profile-trigger-content">

          <div className="cognitive-profile-trigger-icon">
            <BrainCircuit size={21} />
          </div>

          <div>

            <span className="card-kicker">
              DETAILED REASONING PROFILE
            </span>

            <h3>
              Explore your cognitive profile
            </h3>

            <p>
              View your six-dimensional reasoning
              scores, cognitive constellation,
              strongest and focus dimensions,
              and cognitive interpretation.
            </p>

          </div>

        </div>


        <button
          type="button"
          className="cognitive-profile-view-button"
          aria-expanded={showCognitiveProfile}
          onClick={() =>
            setShowCognitiveProfile(
              (previous) => !previous
            )
          }
        >

          {showCognitiveProfile ? (
            <>
              <EyeOff size={17} />
              Hide cognitive profile
            </>
          ) : (
            <>
              <Eye size={17} />
              View your cognitive profile
            </>
          )}

          <ChevronRight
            size={16}
            className={
              showCognitiveProfile
                ? 'cognitive-profile-chevron-open'
                : ''
            }
          />

        </button>

      </section>


      {showCognitiveProfile && (
        <section className="embedded-cognitive-profile">
          <CognitiveProfile embedded />
        </section>
      )}


      {/* ======================================================
          STREAK
      ====================================================== */}

      <section className="streak-panel">

        <div className="streak-glow" />

        <div className="streak-head">

          <div className="streak-title">

            <div className="streak-flame">
              <Flame size={23} />
            </div>

            <div>

              <span className="eyebrow">
                CONSISTENCY ENGINE
              </span>

              <h2>
                {currentStreak} day streak
              </h2>

              <p>
                Meaningful Cognita activity keeps
                your learning streak alive.
              </p>

            </div>

          </div>


          <div className="streak-stats">

            <div>
              <span>Longest</span>
              <strong>
                {longestStreak} days
              </strong>
            </div>

            <div>
              <span>Training</span>
              <strong>
                {totalTraining} attempts
              </strong>
            </div>

          </div>

        </div>


        <StreakCalendar
          activeDates={
            streak.active_dates || []
          }
        />


        {nextBadge && (

          <div className="next-badge-strip">

            <span className="next-badge-icon">
              {nextBadge.icon}
            </span>

            <div>

              <strong>
                {nextBadge.name}
              </strong>

              <span>
                {Math.max(
                  0,
                  nextBadge.days -
                    currentStreak
                )}{' '}
                more consecutive day
                {nextBadge.days -
                  currentStreak ===
                1
                  ? ''
                  : 's'}{' '}
                to unlock
              </span>

            </div>

            <div className="badge-progress">

              <span
                style={{
                  width:
                    `${badgeProgress}%`,
                }}
              />

            </div>

          </div>

        )}

      </section>


      {/* ======================================================
          JOURNEY HEADER
      ====================================================== */}

      <section className="profile-section-heading">

        <div>

          <span className="eyebrow">
            COGNITIVE JOURNEY
          </span>

          <h2>
            How your reasoning changes over time
          </h2>

          <p>
            Follow your real assessment checkpoints
            and observe how your reasoning develops.
          </p>

        </div>

        <div className="checkpoint-count">

          <BarChart3 size={16} />

          {history.length} checkpoint
          {history.length === 1
            ? ''
            : 's'}

        </div>

      </section>


      {/* ======================================================
          JOURNEY GRID
      ====================================================== */}

      <section className="journey-grid">

        <div className="profile-card journey-card">

          <div className="card-heading">

            <div>

              <span className="card-kicker">
                OVERALL JOURNEY
              </span>

              <h3>
                Assessment growth
              </h3>

            </div>

            <div className="card-heading-icon">
              <TrendingUp size={19} />
            </div>

          </div>

          <LineChart
            history={history}
          />

        </div>


        <div className="profile-card skill-focus-card">

          <div className="card-heading">

            <div>

              <span className="card-kicker">
                DIMENSION JOURNEY
              </span>

              <h3>
                Track one reasoning skill
              </h3>

            </div>

            <div className="card-heading-icon">
              <Target size={19} />
            </div>

          </div>


          <select
            value={selectedKey}
            onChange={(event) =>
              setSelectedKey(
                event.target.value
              )
            }
            className="skill-select"
            aria-label="Select reasoning dimension"
          >

            {DIMENSIONS.map(
              (dimension) => (

                <option
                  key={dimension.key}
                  value={dimension.key}
                >
                  {dimension.name} —{' '}
                  {dimension.short}
                </option>

              )
            )}

          </select>


          <LineChart
            history={selectedHistory}
            selectedSkill={selectedSkill}
          />


          <div className="selected-skill-note">

            <div>

              <strong>
                {selectedSkill.name}
              </strong>

              <span>
                {selectedSkill.skill}
              </span>

            </div>

            <b>
              {Math.round(
                scoreFor(
                  scores,
                  selectedSkill.key
                )
              )}
              /100
            </b>

          </div>

        </div>

      </section>


      {/* ======================================================
          SIX DIMENSIONS
      ====================================================== */}

      <section className="profile-card snapshot-card">

        <div className="card-heading">

          <div>

            <span className="card-kicker">
              YOUR SIX DIMENSIONS
            </span>

            <h3>
              Reasoning fingerprint
            </h3>

          </div>

          <div className="card-heading-icon">
            <BrainCircuit size={19} />
          </div>

        </div>


        <div className="dimension-grid">

          {DIMENSIONS.map(
            (dimension, index) => {

              const value =
                scoreFor(
                  scores,
                  dimension.key
                );

              const isStrong =
                strongest?.key ===
                dimension.key;

              const isWeak =
                weakest?.key ===
                dimension.key;

              const trainingInfo =
                training[
                  dimension.key
                ] || {};

              return (

                <button
                  type="button"
                  className={`dimension-tile ${
                    selectedKey ===
                    dimension.key
                      ? 'selected'
                      : ''
                  }`}
                  key={dimension.key}
                  style={{
                    '--tile-delay':
                      `${index * 70}ms`,
                  }}
                  aria-pressed={
                    selectedKey ===
                    dimension.key
                  }
                  onClick={() =>
                    setSelectedKey(
                      dimension.key
                    )
                  }
                >

                  <div className="dimension-glow" />

                  <div className="dimension-top">

                    <span>
                      {dimension.name}
                    </span>

                    <div className="dimension-icon">

                      {isStrong ? (
                        <TrendingUp size={15} />
                      ) : isWeak ? (
                        <TrendingDown size={15} />
                      ) : (
                        <Target size={15} />
                      )}

                    </div>

                  </div>


                  <div className="dimension-score">

                    <strong>
                      {Math.round(value)}
                    </strong>

                    <span>
                      /100
                    </span>

                  </div>


                  <span className="dimension-skill">
                    {dimension.skill}
                  </span>


                  <div className="dimension-meter">

                    <span
                      style={{
                        width:
                          `${Math.min(
                            100,
                            Math.max(
                              0,
                              value
                            )
                          )}%`,
                      }}
                    />

                  </div>


                  <div className="dimension-meta">

                    <span>
                      {number(
                        trainingInfo.questions_attempted
                      )}{' '}
                      practice
                    </span>

                    <span>
                      {Math.round(
                        number(
                          trainingInfo.score
                        )
                      )}{' '}
                      training score
                    </span>

                  </div>

                </button>

              );

            }
          )}

        </div>

      </section>


      {/* ======================================================
          INSIGHTS
      ====================================================== */}

      <section className="insight-grid">

        <div className="profile-card insight-card strongest">

          <div className="insight-orb" />

          <span className="card-kicker">
            YOUR CURRENT EDGE
          </span>

          <div className="insight-icon">
            <Sparkles size={20} />
          </div>

          <h3>
            {strongest?.name ||
              'Your strongest dimension'}
          </h3>

          <p>
            {strongest?.skill ||
              'Your highest assessed reasoning dimension will appear here.'}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/reports')
            }
          >
            View reports
            <ArrowUpRight size={16} />
          </button>

        </div>


        <div className="profile-card insight-card focus">

          <div className="insight-orb" />

          <span className="card-kicker">
            NEXT AREA TO DEVELOP
          </span>

          <div className="insight-icon">
            <Target size={20} />
          </div>

          <h3>
            {weakest?.name ||
              'Your priority dimension'}
          </h3>

          <p>
            {weakest?.skill ||
              'Complete more assessment data to identify your priority dimension.'}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/training')
            }
          >
            Practice this skill
            <ArrowUpRight size={16} />
          </button>

        </div>

      </section>


      {/* ======================================================
          BADGES
      ====================================================== */}

      <section className="profile-card badge-card">

        <div className="card-heading">

          <div>

            <span className="card-kicker">
              BADGE COLLECTION
            </span>

            <h3>
              Consistency milestones
            </h3>

          </div>

          <div className="card-heading-icon">
            <Award size={19} />
          </div>

        </div>


        <div className="badge-grid">

          {BADGES.map((badge) => {

            const earned =
              longestStreak >=
              badge.days;

            return (

              <div
                className={`badge-item ${
                  earned
                    ? 'earned'
                    : 'locked'
                } ${
                  badge.days === 7
                    ? 'featured'
                    : ''
                }`}
                key={badge.days}
              >

                <div className="badge-icon">

                  {earned ? (
                    badge.icon
                  ) : (
                    <LockKeyhole size={20} />
                  )}

                </div>

                <div>

                  <strong>
                    {badge.name}
                  </strong>

                  <span>
                    {badge.days}-day streak
                  </span>

                  <p>
                    {badge.text}
                  </p>

                </div>

                {earned && (
                  <Check
                    size={16}
                    className="badge-check"
                  />
                )}

              </div>

            );

          })}

        </div>

      </section>


      {/* ======================================================
          ACTIONS
      ====================================================== */}

      <section className="profile-journey-actions">

        <button
          type="button"
          onClick={() =>
            navigate('/training')
          }
        >

          <GraduationCap size={18} />

          <span>
            <strong>
              Adaptive Training
            </strong>

            <small>
              Strengthen your priority
              reasoning skill
            </small>
          </span>

          <ChevronRight size={17} />

        </button>


        <button
          type="button"
          onClick={() =>
            navigate('/ai-tutor')
          }
        >

          <MessageCircleQuestion size={18} />

          <span>
            <strong>
              AI Tutor
            </strong>

            <small>
              Clear a concept or reasoning
              doubt
            </small>
          </span>

          <ChevronRight size={17} />

        </button>


        <button
          type="button"
          onClick={() =>
            navigate('/assessment-review')
          }
        >

          <BookOpen size={18} />

          <span>
            <strong>
              Assessment Review
            </strong>

            <small>
              Learn from your previous
              answers
            </small>
          </span>

          <ChevronRight size={17} />

        </button>

      </section>

    </div>
  );
}