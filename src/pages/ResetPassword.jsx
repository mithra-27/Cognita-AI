import { useState } from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  LockKeyhole,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

import { api } from '../api/client';

import './AuthPages.css';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(
    location.search
  );

  const resetToken =
    params.get('token') || '';

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const handleReset = async (event) => {
    event.preventDefault();

    setError('');
    setMessage('');

    if (!resetToken) {
      setError(
        'Your password reset session is missing or invalid. Please request a new OTP.'
      );
      return;
    }

    if (password.length < 6) {
      setError(
        'Your new password must contain at least 6 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        'The passwords do not match.'
      );
      return;
    }

    try {
      setLoading(true);

      await api.resetPassword(
        resetToken,
        password
      );

      setMessage(
        'Your password has been reset successfully.'
      );

      setTimeout(() => {
        navigate('/login');
      }, 1600);
    } catch (err) {
      console.error(
        'Password reset failed:',
        err
      );

      setError(
        err?.message ||
          'Unable to reset your password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="auth-page">
      <div className="auth-background-shape auth-shape-one" />
      <div className="auth-background-shape auth-shape-two" />

      <div className="auth-simple-layout">

        <div className="auth-card recovery-card">

          <div className="auth-icon">
            <LockKeyhole size={28} />
          </div>

          <div className="auth-heading auth-heading-center">
            <p className="auth-kicker">
              SECURE YOUR ACCOUNT
            </p>

            <h1>Create new password</h1>

            <p>
              Choose a new password for your
              Cognita AI account.
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={handleReset}
          >

            {/* NEW PASSWORD */}
            <div className="auth-field">
              <label htmlFor="password">
                New password
              </label>

              <div className="auth-input-wrapper">
                <LockKeyhole
                  className="auth-input-icon"
                  size={17}
                />

                <input
                  id="password"
                  className="auth-input with-icon"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(
                      event.target.value
                    );

                    setError('');
                  }}
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                />
              </div>

              <div className="auth-hint">
                Use at least 6 characters.
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div className="auth-field">
              <label htmlFor="confirmPassword">
                Confirm new password
              </label>

              <div className="auth-input-wrapper">
                <LockKeyhole
                  className="auth-input-icon"
                  size={17}
                />

                <input
                  id="confirmPassword"
                  className="auth-input with-icon"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(
                      event.target.value
                    );

                    setError('');
                  }}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <div className="auth-alert auth-alert-error">
                {error}
              </div>
            )}

            {message && (
              <div className="auth-alert auth-alert-success">
                <CheckCircle2 size={16} />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              className="auth-primary-button"
              disabled={
                loading ||
                !password ||
                !confirmPassword
              }
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Resetting password...
                </>
              ) : (
                <>
                  <LockKeyhole size={17} />
                  Reset Password
                </>
              )}
            </button>

          </form>

          <div className="auth-divider" />

          <button
            type="button"
            className="auth-back-button"
            onClick={handleBackToLogin}
          >
            <ArrowLeft size={14} />
            Back to Login
          </button>

          <div className="auth-brand">
            Secure account recovery ·{' '}
            <span>Cognita AI</span>
          </div>

        </div>
      </div>
    </div>
  );
}