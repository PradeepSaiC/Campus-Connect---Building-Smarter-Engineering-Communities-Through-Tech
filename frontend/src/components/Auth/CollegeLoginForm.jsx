import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api.js';
import useAuthStore from '../../store/authStore.js';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, Building, Lock, ArrowLeft } from 'lucide-react';

const CollegeLoginForm = () => {
  const navigate = useNavigate();
  const { login, setLoading, setError } = useAuthStore();
  
  const [formData, setFormData] = useState({
    adminEmail: '',
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
      const response = await authAPI.collegeLogin(formData.adminEmail, formData.password);
      login(response.data.college, response.data.token);
      toast.success('🎉 College login successful!');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      setError(message);
      toast.error(`❌ ${message}`);
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex items-center justify-center bg-base-200 text-base-content p-4">
      <div className="max-w-md w-full space-y-8">

        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            CampusConnect
          </h1>
          <p className="opacity-70">
            College Administrator Login
          </p>
        </div>

        <div className="card bg-base-100 shadow-xl max-h-[80vh] overflow-auto">
          <div className="card-body p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium opacity-80 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="h-5 w-5 opacity-50" />
                </div>
                <input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  required
                  value={formData.adminEmail}
                  onChange={handleChange}
                  className="input input-bordered w-full pl-10"
                  placeholder="Enter admin email"
                  autoComplete="email"
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
              className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign In as Administrator'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm opacity-70">
              Don't have a college account?{' '}
              <button
                onClick={() => navigate('/college-register')}
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Register your college
              </button>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-base-200">
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 opacity-80 hover:opacity-100 transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Student Login</span>
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollegeLoginForm; 