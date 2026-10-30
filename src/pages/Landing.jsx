import { Link } from 'react-router-dom';

import {
  BrainCircuit,
  Lightbulb,
  GitCompare,
  Eye,
  BookOpen,
  Ban,
  Sparkles,
  ArrowRight,
  ClipboardList,
  ScanSearch,
  UserCog,
  TrendingUp,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';

import { DIMENSIONS } from '../data/dimensions';

import './Landing.css';
import welcomeBrain from './welcome-brain.jpg';


// =========================================================
// DIMENSION ICONS
// =========================================================

const ICONS = {
  BrainCircuit,
  Lightbulb,
  GitCompare,
  Eye,
  BookOpen,
  Ban,
};


// =========================================================
// HOW COGNITA WORKS
// =========================================================

const STEPS = [
  {
    num: '01',
    title: 'Assess',
    desc: 'Take a structured cognitive assessment across all six reasoning dimensions.',
    icon: ClipboardList,
  },
  {
    num: '02',
    title: 'Analyze',
    desc: 'Your responses are interpreted to map cognitive strengths and areas for improvement.',
    icon: ScanSearch,
  },
  {
    num: '03',
    title: 'Personalize',
    desc: 'Receive a focused learning path targeting your weaker reasoning dimensions.',
    icon: UserCog,
  },
  {
    num: '04',
    title: 'Improve',
    desc: 'Practice guided reasoning activities designed around your cognitive profile.',
    icon: TrendingUp,
  },
  {
    num: '05',
    title: 'Reassess',
    desc: 'Measure your progress and refine your cognitive profile through reassessment.',
    icon: RefreshCw,
  },
];


// =========================================================
// LANDING PAGE
// =========================================================

export default function Landing() {
  return (
    <main
      className="landing-page"
      style={{
        '--welcome-brain-image': `url(${welcomeBrain})`,
      }}
    >

      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="landing-hero">

        {/* Background effects */}

        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-grid" />

        {/* Floating cognitive particles */}

        <span className="hero-particle particle-one" />
        <span className="hero-particle particle-two" />
        <span className="hero-particle particle-three" />
        <span className="hero-particle particle-four" />
        <span className="hero-particle particle-five" />


        <div className="landing-hero-inner">

          {/* -----------------------------------------------
              LEFT — HERO CONTENT
          ------------------------------------------------ */}

          <div className="landing-hero-content">

            <div className="landing-eyebrow">

              <span className="eyebrow-icon">
                <Sparkles size={14} />
              </span>

              <span>
                AI • COGNITIVE SCIENCE • INDIAN KNOWLEDGE
              </span>

            </div>


            <h1 className="landing-title">

              Understand Your
              <span>Thinking.</span>

              <br />

              Improve Your
              <span>Reasoning.</span>

            </h1>


            <p className="landing-description">

              Cognita AI is an AI-powered cognitive assessment
              and adaptive learning platform inspired by six
              Mīmāṃsā reasoning principles.

            </p>


            <div className="landing-actions">

              <Link
                to="/register"
                className="landing-primary-button"
              >
                Start Your Cognitive Journey

                <ArrowRight size={18} />

              </Link>


              <Link
                to="/login"
                className="landing-secondary-button"
              >
                Sign In
              </Link>

            </div>


            {/* Hero stats */}

            <div className="hero-metrics">

              <div className="hero-metric">

                <strong>06</strong>

                <span>
                  Reasoning Dimensions
                </span>

              </div>


              <div className="hero-metric-divider" />


              <div className="hero-metric">

                <strong>AI</strong>

                <span>
                  Guided Learning
                </span>

              </div>


              <div className="hero-metric-divider" />


              <div className="hero-metric">

                <strong>RAG</strong>

                <span>
                  Knowledge Support
                </span>

              </div>

            </div>

          </div>


          {/* -----------------------------------------------
              RIGHT — BRAIN VISUAL
          ------------------------------------------------ */}

          <div className="landing-brain-stage">

            <div className="brain-orbit orbit-one" />
            <div className="brain-orbit orbit-two" />
            <div className="brain-orbit orbit-three" />


            <div className="brain-ring ring-one" />
            <div className="brain-ring ring-two" />


            {/* Image glow */}

            <div className="brain-image-glow" />


            {/* Brain image */}

            <div className="brain-image-card">

              <img
                src={welcomeBrain}
                alt="Illustration of a connected human brain"
                className="brain-image"
              />

            </div>


            {/* Floating labels */}

            <div className="brain-label label-reasoning">

              <BrainCircuit size={16} />

              <div>
                <strong>Reasoning</strong>
                <span>Understand</span>
              </div>

            </div>


            <div className="brain-label label-learning">

              <Sparkles size={16} />

              <div>
                <strong>Learning</strong>
                <span>Adapt</span>
              </div>

            </div>


            <div className="brain-label label-growth">

              <TrendingUp size={16} />

              <div>
                <strong>Growth</strong>
                <span>Improve</span>
              </div>

            </div>


            {/* Central badge */}

            <div className="brain-center-badge">

              <BrainCircuit size={19} />

              <span>
                COGNITA
              </span>

            </div>

          </div>

        </div>


        {/* Scroll indicator */}

        <div className="hero-scroll-indicator">

          <span>
            Explore Cognita
          </span>

          <ChevronDown size={16} />

        </div>

      </section>


      {/* =====================================================
          SIX DIMENSIONS
          ===================================================== */}

      <section className="landing-section dimensions-section">

        <div className="landing-section-heading">

          <span className="section-kicker">
            THE COGNITIVE FRAMEWORK
          </span>

          <h2>
            Six Dimensions of
            <span> Reasoning</span>
          </h2>

          <p>
            Cognita maps cognitive reasoning across six
            dimensions inspired by Mīmāṃsā epistemological
            principles.
          </p>

        </div>


        <div className="dimensions-grid">

          {DIMENSIONS.map((dimension, index) => {

            const Icon =
              ICONS[dimension.icon] ||
              BrainCircuit;

            return (
              <article
                key={dimension.key}
                className="cognitive-card"
              >

                <div className="cognitive-card-top">

                  <span className="cognitive-index">
                    0{index + 1}
                  </span>

                  <div className="cognitive-icon">
                    <Icon size={22} />
                  </div>

                </div>


                <div className="cognitive-card-content">

                  <h3>
                    {dimension.sanskrit}
                  </h3>

                  <p className="cognitive-english">
                    {dimension.english}
                  </p>

                  <p className="cognitive-description">
                    {dimension.description}
                  </p>

                </div>


                <div className="cognitive-card-line" />

              </article>
            );
          })}

        </div>

      </section>


      {/* =====================================================
          HOW IT WORKS
          ===================================================== */}

      <section className="landing-section process-section">

        <div className="landing-section-heading">

          <span className="section-kicker">
            YOUR COGNITIVE JOURNEY
          </span>

          <h2>
            From Assessment to
            <span> Improvement</span>
          </h2>

          <p>
            A structured learning cycle that helps you
            understand, practice, and develop your reasoning.
          </p>

        </div>


        <div className="process-wrapper">

          <div className="process-line" />


          <div className="process-grid">

            {STEPS.map((step) => {

              const Icon = step.icon;

              return (
                <article
                  key={step.num}
                  className="process-card"
                >

                  <div className="process-number">
                    {step.num}
                  </div>


                  <div className="process-icon">
                    <Icon size={21} />
                  </div>


                  <h3>
                    {step.title}
                  </h3>


                  <p>
                    {step.desc}
                  </p>

                </article>
              );
            })}

          </div>

        </div>

      </section>


      {/* =====================================================
          FINAL CTA
          ===================================================== */}

      <section className="landing-cta">

        <div className="cta-glow" />

        <div className="cta-content">

          <div className="cta-icon">

            <BrainCircuit size={28} />

          </div>


          <span className="section-kicker">
            BEGIN YOUR COGNITIVE JOURNEY
          </span>


          <h2>
            Your reasoning is
            <span> worth understanding.</span>
          </h2>


          <p>
            Discover how you reason, identify where you can
            improve, and build stronger cognitive skills with
            Cognita AI.
          </p>


          <Link
            to="/register"
            className="landing-primary-button cta-button"
          >
            Start with Cognita AI

            <ArrowRight size={18} />

          </Link>

        </div>

      </section>

    </main>
  );
}
