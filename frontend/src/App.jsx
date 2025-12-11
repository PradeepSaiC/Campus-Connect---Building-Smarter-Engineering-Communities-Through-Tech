import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore.js';
import LoginForm from './components/Auth/LoginForm.jsx';
import RegisterForm from './components/Auth/RegisterForm.jsx';
import CollegeLoginForm from './components/Auth/CollegeLoginForm.jsx';
import CollegeRegisterForm from './components/Auth/CollegeRegisterForm.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import LiveStreamNew from './components/VideoCall/LiveStreamNew.jsx';
import VideoCallNew from './components/VideoCall/VideoCallNew.jsx';
import Landing from './components/Landing/Landing.jsx';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirects to dashboard if already authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
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
            path="/live/:streamId" 
            element={
              <ProtectedRoute>
                <LiveStreamNew />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/call/:callId" 
            element={
              <ProtectedRoute>
                <VideoCallNew />
              </ProtectedRoute>
            } 
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
