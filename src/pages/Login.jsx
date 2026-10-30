import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import {
  BrainCircuit,
  Mail,
  Lock,
  LogIn,
  AlertCircle,
} from 'lucide-react';

import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

import './Login.css';

export default function Login() {
  const { login, isAuthenticated } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const from =
    location.state?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // =========================================================
  // VALIDATION
  // =========================================================

  const validate = () => {
    const e = {};

    if (!email.trim()) {
      e.email = 'Email is required.';
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email.trim()
      )
    ) {
      e.email = 'Enter a valid email address.';
    }

    if (!password) {
      e.password = 'Password is required.';
    }

    setErrors(e);

    return Object.keys(e).length === 0;
  };

  // =========================================================
  // SUBMIT
  // =========================================================

  const handleSubmit = async (ev) => {
    ev.preventDefault();

    setServerError('');

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const data = await api.login(
        email.trim(),
        password
      );

      const authData =
        data?.data ?? data;

      const token =
        authData?.token;

      const user =
        authData?.user;

      if (!token || !user) {
        throw new Error(
          'Login response is missing authentication data.'
        );
      }

      login(token, user);

      navigate(from, {
        replace: true,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError(
          err?.message ||
            'Something went wrong. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================
  // ALREADY AUTHENTICATED
  // =========================================================

  if (isAuthenticated) {
    navigate('/dashboard', {
      replace: true,
    });

    return null;
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="auth-page">

      {/* Background decoration */}
      <div className="auth-background-shape auth-shape-one" />
      <div className="auth-background-shape auth-shape-two" />

      <div className="auth-layout">

        {/* ================================================= */}
        {/* LEFT BRAND PANEL */}
        {/* ================================================= */}

        <div className="auth-brand-panel">

          {/* Brain image background */}
          <div className="auth-brain-image" />

          {/* Dark purple readability overlay */}
          <div className="auth-brain-overlay" />

          {/* Brand content */}
          <div className="brand-badge">
            <BrainCircuit size={20} />
            <span>Cognita AI</span>
          </div>

          <div className="brand-content">

            <div className="brand-icon-large">
              <BrainCircuit size={38} />
            </div>

            <p className="brand-eyebrow">
              COGNITIVE INTELLIGENCE PLATFORM
            </p>

            <h2>
              Understand Your Thinking.
              <br />
              <span>
                Improve Your Reasoning.
              </span>
            </h2>

            <p className="brand-description">
              Discover your reasoning strengths,
              identify areas for improvement, and
              build stronger cognitive skills through
              adaptive practice.
            </p>

          </div>

          <div className="brand-footer">
            <span className="brand-dot" />
            <span>
              Powered by Cognita AI
            </span>
          </div>

        </div>


        {/* ================================================= */}
        {/* LOGIN CARD */}
        {/* ================================================= */}

        <div className="auth-card login-card">

          {/* Mobile brand */}
          <div className="auth-mobile-brand">

            <div className="auth-icon">
              <BrainCircuit size={26} />
            </div>

          </div>


          {/* Heading */}
          <div className="auth-heading">

            <p className="auth-kicker">
              WELCOME BACK
            </p>

            <h1>
              Sign in to Cognita
            </h1>

            <p>
              Continue your cognitive learning journey.
            </p>

          </div>


          {/* Server error */}
          {serverError && (
            <div className="auth-alert auth-alert-error">

              <AlertCircle size={18} />

              <span>
                {serverError}
              </span>

            </div>
          )}


          {/* ================================================= */}
          {/* FORM */}
          {/* ================================================= */}

          <form
            onSubmit={handleSubmit}
            className="auth-form"
            noValidate
          >

            {/* EMAIL */}
            <div className="auth-field">

              <label htmlFor="email">
                Email address
              </label>

              <div className="auth-input-wrapper">

                <Mail
                  size={18}
                  className="auth-input-icon"
                />

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);

                    if (errors.email) {
                      setErrors((prev) => ({
                        ...prev,
                        email: '',
                      }));
                    }
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                />

              </div>

              {errors.email && (
                <p className="auth-field-error">
                  {errors.email}
                </p>
              )}

            </div>


            {/* PASSWORD */}
            <div className="auth-field">

              <div className="auth-label-row">

                <label htmlFor="password">
                  Password
                </label>

                <Link
                  to="/forgot-password"
                  className="auth-inline-link"
                >
                  Forgot password?
                </Link>

              </div>


              <div className="auth-input-wrapper">

                <Lock
                  size={18}
                  className="auth-input-icon"
                />

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);

                    if (errors.password) {
                      setErrors((prev) => ({
                        ...prev,
                        password: '',
                      }));
                    }
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

              </div>

              {errors.password && (
                <p className="auth-field-error">
                  {errors.password}
                </p>
              )}

            </div>


            {/* SUBMIT */}
            <button
              type="submit"
              className="auth-primary-button"
              disabled={submitting}
            >

              {submitting ? (
                <>
                  <span className="auth-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}

            </button>

          </form>


          {/* Divider */}
          <div className="auth-divider">
            <span>
              New to Cognita?
            </span>
          </div>


          {/* Register */}
          <Link
            to="/register"
            className="auth-secondary-button"
          >
            Create an account
          </Link>


          {/* Legal */}
          <p className="auth-legal">
            By continuing, you agree to use Cognita AI
            responsibly for cognitive learning and practice.
          </p>

        </div>

      </div>

    </div>
  );
}