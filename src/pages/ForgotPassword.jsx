import { useState } from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  ArrowLeft,
  BrainCircuit,
  Mail,
  Send,
} from 'lucide-react';

import {
  api,
  ApiError,
} from '../api/client';

import './ForgotPassword.css';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setMessage('');

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(
        'Please enter your email address.'
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail
      )
    ) {
      setError(
        'Enter a valid email address.'
      );
      return;
    }

    try {
      setLoading(true);

      const result =
        await api.forgotPassword(
          normalizedEmail
        );

      setMessage(
        result?.message ||
          'If an account exists for this email, a verification OTP has been sent.'
      );

      setTimeout(() => {
        navigate(
          `/verify-otp?email=${encodeURIComponent(
            normalizedEmail
          )}`
        );
      }, 800);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to process your request. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-background-shape auth-shape-one" />
      <div className="auth-background-shape auth-shape-two" />

      <div className="auth-simple-layout">

        <div className="auth-card recovery-card">

          <div className="auth-icon">
            <BrainCircuit size={27} />
          </div>

          <div className="auth-heading auth-heading-center">
            <p className="auth-kicker">
              ACCOUNT RECOVERY
            </p>

            <h1>
              Forgot your password?
            </h1>

            <p>
              Enter your registered email and
              we'll send you a verification code.
            </p>
          </div>

          {error && (
            <div
              className="auth-alert auth-alert-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {message && (
            <div
              className="auth-alert auth-alert-success"
              role="status"
            >
              {message}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="auth-form"
          >
            <div className="auth-field">
              <label htmlFor="reset-email">
                Email address
              </label>

              <div className="auth-input-wrapper">
                <Mail
                  size={18}
                  className="auth-input-icon"
                />

                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  placeholder="Enter your registered email"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-primary-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Sending OTP...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Send Verification Code
                </>
              )}
            </button>
          </form>

          <div className="auth-divider" />

          <Link
            to="/login"
            className="auth-back-link"
          >
            <ArrowLeft size={15} />
            Back to Login
          </Link>

          <p className="recovery-note">
            Your account security matters. Never share
            your verification code with anyone.
          </p>

        </div>
      </div>
    </div>
  );
}