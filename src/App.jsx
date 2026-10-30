import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import Background from './components/Background';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';

import Dashboard from './pages/Dashboard';
import PreAssessment from './pages/PreAssessment';
import Profile from './pages/Profile';
import LearningPath from './pages/LearningPath';
import AdaptiveTraining from './pages/AdaptiveTraining';
import Progress from './pages/Progress';
import PostAssessment from './pages/PostAssessment';
import AssessmentReview from './pages/AssessmentReview';
import AssessmentReports from './pages/AssessmentReports';
import AITutor from './pages/AITutor';
import Settings from './pages/Settings';
import KnowledgeBase from './pages/KnowledgeBase';

import VerifyOTP from './pages/VerifyOTP';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Background />
        <Navbar />

        <main>
          <Routes>

            {/* =====================================================
                PUBLIC ROUTES
            ===================================================== */}

            <Route
              path="/"
              element={<Landing />}
            />

            <Route
              path="/login"
              element={<Login />}
            />

            <Route
              path="/register"
              element={<Register />}
            />

            <Route
              path="/forgot-password"
              element={<ForgotPassword />}
            />

            {/* =====================================================
                PROTECTED ROUTES
            ===================================================== */}

            {/* Dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Pre Assessment */}
            <Route
              path="/assessment"
              element={
                <ProtectedRoute>
                  <PreAssessment />
                </ProtectedRoute>
              }
            />

            {/* Personal Cognitive Profile */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Learning Path */}
            <Route
              path="/learning-path"
              element={
                <ProtectedRoute>
                  <LearningPath />
                </ProtectedRoute>
              }
            />

            {/* Adaptive Training */}
            <Route
              path="/training"
              element={
                <ProtectedRoute>
                  <AdaptiveTraining />
                </ProtectedRoute>
              }
            />

            {/* Progress */}
            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <Progress />
                </ProtectedRoute>
              }
            />

            {/* Post Assessment */}
            <Route
              path="/post-assessment"
              element={
                <ProtectedRoute>
                  <PostAssessment />
                </ProtectedRoute>
              }
            />

            {/* Assessment Review */}
            <Route
              path="/assessment-review"
              element={
                <ProtectedRoute>
                  <AssessmentReview />
                </ProtectedRoute>
              }
            />

            {/* Assessment Reports */}
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <AssessmentReports />
                </ProtectedRoute>
              }
            />

            {/* AI Tutor */}
            <Route
              path="/ai-tutor"
              element={
                <ProtectedRoute>
                  <AITutor />
                </ProtectedRoute>
              }
            />

            {/* =====================================================
                KNOWLEDGE BASE
            ===================================================== */}

            <Route
              path="/knowledge"
              element={
                <ProtectedRoute>
                  <KnowledgeBase />
                </ProtectedRoute>
              }
            />

            {/* Settings */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* =====================================================
                PASSWORD RESET
            ===================================================== */}

            <Route
              path="/verify-otp"
              element={<VerifyOTP />}
            />

            <Route
              path="/reset-password"
              element={<ResetPassword />}
            />

          </Routes>
        </main>

        <Footer />
      </BrowserRouter>
    </AuthProvider>
  );
}