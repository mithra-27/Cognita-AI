import { useState } from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';

import { api } from '../api/client';

import './AuthPages.css';

export default function VerifyOTP() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(
    location.search
  );

  const email =
    params.get('email') || '';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleVerify = async (event) => {
    event.preventDefault();

    setError('');
    setMessage('');

    if (!email) {
      setError(
        'Email address is missing. Please start the password reset process again.'
      );
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError(
        'Please enter the complete 6-digit verification OTP.'
      );
      return;
    }

    try {
      setLoading(true);

      const response =
        await api.verifyResetOtp(
          email,
          otp
        );

      const resetToken =
        response?.reset_token ||
        response?.resetToken ||
        response?.data?.reset_token ||
        response?.data?.resetToken;

      if (!resetToken) {
        throw new Error(
          'Password reset session could not be created. Please request a new OTP.'
        );
      }

      setMessage(
        'OTP verified successfully.'
      );

      setTimeout(() => {
        navigate(
          `/reset-password?token=${encodeURIComponent(
            resetToken
          )}`
        );
      }, 500);
    } catch (err) {
      console.error(
        'OTP verification failed:',
        err
      );

      setError(
        err?.message ||
          'Invalid or expired OTP. Please try again.'
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
            <ShieldCheck size={28} />
          </div>

          <div className="auth-heading auth-heading-center">
            <p className="auth-kicker">
              VERIFY IDENTITY
            </p>

            <h1>Verify your OTP</h1>

            <p>
              Enter the 6-digit verification code
              sent to your registered email.
            </p>
          </div>

          {email && (
            <div className="auth-email-pill">
              <span>Code sent to</span>
              <strong>{email}</strong>
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={handleVerify}
          >
            <div className="auth-field otp-field">
              <label htmlFor="otp">
                Verification code
              </label>

              <input
                id="otp"
                className="auth-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(event) => {
                  const value =
                    event.target.value
                      .replace(/\D/g, '')
                      .slice(0, 6);

                  setOtp(value);
                  setError('');
                }}
                placeholder="000000"
                autoFocus
              />

              <div className="auth-hint">
                This verification code expires
                in 5 minutes.
              </div>
            </div>

            {error && (
              <div className="auth-alert auth-alert-error">
                {error}
              </div>
            )}

            {message && (
              <div className="auth-alert auth-alert-success">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="auth-primary-button"
              disabled={
                loading ||
                otp.length !== 6
              }
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Verifying OTP...
                </>
              ) : (
                <>
                  <ShieldCheck size={17} />
                  Verify OTP
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