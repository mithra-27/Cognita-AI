import { useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  BrainCircuit,
  Menu,
  X,
  LogOut,
  BookOpen,
  Sparkles,
  Route,
  FileText,
  Settings,
  Database,
  LayoutDashboard,
  UserRound,
  Dumbbell,
  TrendingUp,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const {
    isAuthenticated,
    user,
    logout,
  } = useAuth();

  const [open, setOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    logout();

    setOpen(false);

    navigate('/');
  };

  // =========================================================
  // CLOSE MOBILE MENU
  // =========================================================

  const close = () => {
    setOpen(false);
  };

  // =========================================================
  // ACTIVE ROUTE
  // =========================================================

  const isActive = (path) => {
    return location.pathname === path;
  };

  // =========================================================
  // AUTHENTICATED NAVIGATION
  // =========================================================

  const protectedLinks = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      title: 'View your Cognita dashboard',
    },

    {
      to: '/profile',
      label: 'Profile',
      icon: UserRound,
      title: 'View your personal profile',
    },

    {
      to: '/learning-path',
      label: 'Learning Path',
      icon: Route,
      title: 'View your personalized learning path',
    },

    {
      to: '/training',
      label: 'Training',
      icon: Dumbbell,
      title: 'Practice cognitive reasoning skills',
    },

    {
      to: '/progress',
      label: 'Progress',
      icon: TrendingUp,
      title: 'Track your cognitive progress',
    },

    {
      to: '/reports',
      label: 'Reports',
      icon: FileText,
      title: 'View your assessment reports',
    },

    {
      to: '/ai-tutor',
      label: 'AI Tutor',
      icon: Sparkles,
      title: 'Ask Cognita AI Tutor',
    },

    {
      to: '/knowledge',
      label: 'Knowledge Base',
      icon: Database,
      title: 'Explore reasoning knowledge and examples',
    },

    {
      to: '/assessment-review',
      label: 'Assessment Review',
      icon: BookOpen,
      title: 'Review your assessment answers',
    },

    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      title: 'Manage your Cognita settings',
    },
  ];

  // =========================================================
  // RENDER NAVIGATION LINK
  // =========================================================

  const renderLink = (
    item,
    mobile = false
  ) => {
    const Icon = item.icon;

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={
          mobile
            ? close
            : undefined
        }
        className={
          isActive(item.to)
            ? 'active'
            : ''
        }
        title={item.title}
      >
        {Icon && (
          <Icon
            size={
              mobile
                ? 16
                : 14
            }
            strokeWidth={2}
          />
        )}

        <span>{item.label}</span>
      </Link>
    );
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <nav
      className="navbar"
      aria-label="Primary navigation"
    >
      <div className="navbar-inner">

        {/* =====================================================
            BRAND
        ===================================================== */}

        <Link
          to="/"
          className="navbar-brand"
          onClick={close}
          aria-label="Cognita AI home"
        >
          <span className="brand-mark">
            <BrainCircuit
              size={18}
              strokeWidth={2.2}
            />
          </span>

          <span>COGNITA AI</span>
        </Link>

        {/* =====================================================
            DESKTOP NAVIGATION
        ===================================================== */}

        <div className="navbar-links desktop">

          {isAuthenticated ? (
            <>
              {protectedLinks.map(
                (item) =>
                  renderLink(item)
              )}

              {/* USER NAME */}

              {user?.name && (
                <span
                  style={{
                    color:
                      'var(--text-muted)',
                    fontSize:
                      '0.76rem',
                    fontWeight: 600,
                    padding:
                      '8px 7px',
                    whiteSpace:
                      'nowrap',
                    borderLeft:
                      '1px solid var(--border-light)',
                    marginLeft: '3px',
                    paddingLeft: '12px',
                  }}
                  title="Signed-in user"
                >
                  {user.name}
                </span>
              )}

              {/* LOGOUT */}

              <button
                onClick={
                  handleLogout
                }
                className="secondary-button button-sm"
                style={{
                  marginLeft: '3px',
                }}
                type="button"
              >
                <LogOut
                  size={14}
                  strokeWidth={2}
                />

                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className={
                  isActive('/login')
                    ? 'active'
                    : ''
                }
              >
                Login
              </Link>

              <Link
                to="/register"
                className="primary-button button-sm"
              >
                Get Started
              </Link>
            </>
          )}

        </div>

        {/* =====================================================
            MOBILE MENU BUTTON
        ===================================================== */}

        <button
          className="navbar-toggle"
          onClick={() =>
            setOpen(
              (value) =>
                !value
            )
          }
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          type="button"
        >
          {open ? (
            <X size={22} />
          ) : (
            <Menu size={22} />
          )}
        </button>
      </div>

      {/* =====================================================
          MOBILE NAVIGATION
      ===================================================== */}

      {open && (
        <div className="navbar-links mobile-open">

          {isAuthenticated ? (
            <>
              {protectedLinks.map(
                (item) =>
                  renderLink(
                    item,
                    true
                  )
              )}

              <button
                onClick={
                  handleLogout
                }
                className="secondary-button button-sm"
                style={{
                  marginTop: '4px',
                }}
                type="button"
              >
                <LogOut
                  size={15}
                  strokeWidth={2}
                />

                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={close}
                className={
                  isActive('/login')
                    ? 'active'
                    : ''
                }
              >
                Login
              </Link>

              <Link
                to="/register"
                onClick={close}
                className="primary-button button-sm"
                style={{
                  marginTop: '4px',
                }}
              >
                Get Started
              </Link>
            </>
          )}

        </div>
      )}
    </nav>
  );
}
