import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api.js';
import useAuthStore from '../../store/authStore.js';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, User, Lock } from 'lucide-react';

const LoginForm = () => {
  const navigate = useNavigate();
  const { login, setLoading, setError } = useAuthStore();
  
  const [formData, setFormData] = useState({
    usn: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLoading(true);
    setError(null);

    try {
      // Clear any existing auth data before new login attempt
      localStorage.removeItem('campusconnect-auth');
      sessionStorage.removeItem('campusconnect-auth');
      
      const response = await authAPI.login(formData.usn, formData.password);
      
      // Clear form data after successful login
      setFormData({
        usn: '',
        password: ''
      });
      
      login(response.data.student, response.data.token);
      toast.success('🎉 Login successful!');
      
      // Get the redirect path from location state or default to dashboard
      const from = location.state?.from || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      // Clear form on error
      setFormData(prev => ({
        ...prev,
        password: '' // Clear password field on error
      }));
      
      const message = error.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(message);
      toast.error(`❌ ${message}`);
      
      // Clear any partial auth state
      if (error.response?.status === 401) {
        localStorage.removeItem('campusconnect-auth');
        sessionStorage.removeItem('campusconnect-auth');
      }
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 text-base-content p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">CampusConnect</h1>
          <p className="opacity-70 mt-1">Welcome back! Please sign in to your account</p>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="usn" className="block text-sm font-medium opacity-80 mb-2">
                  USN (University Serial Number)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 opacity-50" />
                  </div>
                  <input
                    id="usn"
                    name="usn"
                    type="text"
                    required
                    value={formData.usn}
                    onChange={handleChange}
                    className="input input-bordered w-full pl-10"
                    placeholder="Enter your USN"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium opacity-80 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 opacity-50" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="input input-bordered w-full pl-10 pr-10"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 opacity-50" />
                    ) : (
                      <Eye className="h-5 w-5 opacity-50" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm opacity-70">
                Haven't registered yet?{' '}
                <button
                  onClick={() => navigate('/student-register')}
                  className="font-medium text-primary-600 hover:text-primary-500"
                >
                  Sign up here
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm; 