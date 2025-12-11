import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore.js';
import LoginForm from './components/Auth/LoginForm.jsx';
import RegisterForm from './components/Auth/RegisterForm.jsx';
import CollegeLoginForm from './components/Auth/CollegeLoginForm.jsx';
import CollegeRegisterForm from './components/Auth/CollegeRegisterForm.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import LiveStream from './components/Events/LiveStream.jsx';
import CallStudio from './components/VideoCall/CallStudio.jsx';
import Landing from './components/Landing/Landing.jsx';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    // Consider hydration done when either authenticated or no persisted auth exists
    const persisted = sessionStorage.getItem('campusconnect-auth') ?? localStorage.getItem('campusconnect-auth');
    if (isAuthenticated || !persisted) {
      setHydrating(false);
      return;
    }
    // Delay one tick to allow zustand to rehydrate from sessionStorage
    const t = setTimeout(() => setHydrating(false), 50);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  if (isLoading || hydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
};

// Public Route Component (redirects to dashboard if already authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    const persisted = sessionStorage.getItem('campusconnect-auth') ?? localStorage.getItem('campusconnect-auth');
    if (isAuthenticated || !persisted) {
      setHydrating(false);
      return;
    }
    const t = setTimeout(() => setHydrating(false), 50);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  if (isLoading || hydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

function App() {
  return (
    <Router>
      <div className="App">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginForm />
              </PublicRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <RegisterForm />
              </PublicRoute>
            } 
          />
          <Route 
            path="/student-register" 
            element={
              <PublicRoute>
                <RegisterForm />
              </PublicRoute>
            } 
          />
          <Route 
            path="/college-login" 
            element={
              <PublicRoute>
                <CollegeLoginForm />
              </PublicRoute>
            } 
          />
          <Route 
            path="/college-register" 
            element={
              <PublicRoute>
                <CollegeRegisterForm />
              </PublicRoute>
            } 
          />
          
          {/* Protected Routes */}
          <Route 
            path="/dashboard/*" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/live/:eventId" 
            element={<LiveStream />} 
          />
          <Route 
            path="/call/:callId" 
            element={<CallStudio />} 
          />
          
          {/* Public Landing */}
          <Route path="/" element={<Landing />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
