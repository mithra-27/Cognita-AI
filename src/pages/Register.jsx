import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  BrainCircuit,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

import './Register.css';

export default function Register() {
  const navigate = useNavigate();
  const { user, register } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard', {
        replace: true,
      });
    }
  }, [user, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError('');

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (!name) {
      setError('Please enter your name.');
      return;
    }

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    if (password.length < 6) {
      setError(
        'Password must contain at least 6 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      const result = await register(
        name,
        email,
        password
      );

      console.log(
        'Registration successful:',
        result
      );

      if (
        !result?.token &&
        !result?.access_token
      ) {
        navigate('/login', {
          replace: true,
          state: {
            message:
              'Registration successful. Please log in.',
            email,
          },
        });
      }
    } catch (err) {
      console.error(
        'Registration error:',
        err
      );

      const message =
        err?.message ||
        'Registration failed. Please check your details and try again.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-background-shape auth-shape-one" />
      <div className="auth-background-shape auth-shape-two" />

      <div className="auth-layout register-layout">

        {/* BRAND PANEL */}
        <div className="auth-brand-panel register-brand-panel">
          <div className="brand-badge">
            <BrainCircuit size={20} />
            <span>Cognita AI</span>
          </div>

          <div className="brand-content">
            <div className="brand-icon-large">
              <UserPlus size={36} />
            </div>

            <p className="brand-eyebrow">
              BEGIN YOUR COGNITIVE JOURNEY
            </p>

            <h2>
              Discover how
              <br />
              <span>you think.</span>
            </h2>

            <p className="brand-description">
              Create your Cognita account and explore
              reasoning assessment, personalized practice,
              and adaptive cognitive skill development.
            </p>

            <div className="brand-feature-list">
              <div>
                <span>01</span>
                <p>Assess your reasoning skills</p>
              </div>

              <div>
                <span>02</span>
                <p>Identify your cognitive profile</p>
              </div>

              <div>
                <span>03</span>
                <p>Practice with adaptive activities</p>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <span className="brand-dot" />
            <span>Powered by Cognita AI</span>
          </div>
        </div>

        {/* REGISTER CARD */}
        <div className="auth-card register-card">

          <div className="auth-mobile-brand">
            <div className="auth-icon">
              <UserPlus size={26} />
            </div>
          </div>

          <div className="auth-heading">
            <p className="auth-kicker">
              GET STARTED
            </p>

            <h1>Create your account</h1>

            <p>
              Build your personalized cognitive learning
              experience.
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

          <form
            onSubmit={handleSubmit}
            className="auth-form"
          >

            {/* NAME */}
            <div className="auth-field">
              <label htmlFor="name">
                Full name
              </label>

              <div className="auth-input-wrapper">
                <User
                  size={18}
                  className="auth-input-icon"
                />

                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                  disabled={loading}
                  required
                />
              </div>
            </div>

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
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="auth-field">
              <label htmlFor="password">
                Password
              </label>

              <div className="auth-input-wrapper">
                <Lock
                  size={18}
                  className="auth-input-icon"
                />

                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Create a password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value
                    )
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              <small className="form-hint">
                Minimum 6 characters.
              </small>
            </div>

            {/* CONFIRM PASSWORD */}
            <div className="auth-field">
              <label htmlFor="confirmPassword">
                Confirm password
              </label>

              <div className="auth-input-wrapper">
                <Lock
                  size={18}
                  className="auth-input-icon"
                />

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      (value) => !value
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* SUBMIT */}
            <button
              type="submit"
              className="auth-primary-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>Already have an account?</span>
          </div>

          <Link
            to="/login"
            className="auth-secondary-button"
          >
            Log in instead
          </Link>

        </div>
      </div>
    </div>
  );
}