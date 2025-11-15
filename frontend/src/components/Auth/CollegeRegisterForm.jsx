import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import { 
  Building, 
  User, 
  Mail, 
  MapPin, 
  Eye, 
  EyeOff, 
  ArrowLeft,
  CheckCircle,
  XCircle
} from 'lucide-react';

const CollegeRegisterForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    collegeName: '',
    adminName: '',
    adminEmail: '',
    password: '',
    confirmPassword: '',
    collegeAddress: '',
    collegeType: 'Private',
    collegeVision: ''
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
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('❌ Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('❌ Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const collegeData = {
        collegeName: formData.collegeName,
        adminName: formData.adminName,
        adminEmail: formData.adminEmail,
        password: formData.password,
        collegeAddress: formData.collegeAddress,
        collegeType: formData.collegeType,
        collegeVision: formData.collegeVision
      };

      await authAPI.collegeRegister(collegeData);
      toast.success('🎉 College registered successfully! You can now log in.');
      navigate('/college-login');
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(`❌ ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex items-center justify-center bg-base-200 text-base-content p-4">
      <div className="w-full max-w-2xl space-y-8">

        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            CampusConnect
          </h1>
          <p className="opacity-70">
            Register Your College
          </p>
        </div>

        <div className="card bg-base-100 shadow-xl max-h-[80vh] overflow-auto">
          <div className="card-body p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* College Information */}
            <div>
              <label htmlFor="collegeName" className="block text-sm font-medium opacity-80 mb-2">
                College Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="h-5 w-5 opacity-50" />
                </div>
                <input
                  id="collegeName"
                  name="collegeName"
                  type="text"
                  required
                  value={formData.collegeName}
                  onChange={handleChange}
                  className="input input-bordered w-full pl-10"
                  placeholder="Enter college name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="adminName" className="block text-sm font-medium opacity-80 mb-2">
                Administrator Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 opacity-50" />
                </div>
                <input
                  id="adminName"
                  name="adminName"
                  type="text"
                  required
                  value={formData.adminName}
                  onChange={handleChange}
                  className="input input-bordered w-full pl-10"
                  placeholder="Enter administrator name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium opacity-80 mb-2">
                Administrator Email *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 opacity-50" />
                </div>
                <input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  required
                  value={formData.adminEmail}
                  onChange={handleChange}
                  className="input input-bordered w-full pl-10"
                  placeholder="Enter administrator email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="collegeAddress" className="block text-sm font-medium opacity-80 mb-2">
                College Address *
              </label>
              <div className="relative md:col-span-2">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 opacity-50" />
                </div>
                <textarea
                  id="collegeAddress"
                  name="collegeAddress"
                  required
                  value={formData.collegeAddress}
                  onChange={handleChange}
                  className="textarea textarea-bordered w-full pl-10 resize-none"
                  placeholder="Enter complete college address"
                  rows={3}
                />
              </div>
            </div>

            <div>
              <label htmlFor="collegeType" className="block text-sm font-medium opacity-80 mb-2">
                College Type *
              </label>
              <select
                id="collegeType"
                name="collegeType"
                value={formData.collegeType}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="Private">Private</option>
                <option value="Public">Public</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="collegeVision" className="block text-sm font-medium opacity-80 mb-2">
                College Vision & Mission
              </label>
              <textarea
                id="collegeVision"
                name="collegeVision"
                value={formData.collegeVision}
                onChange={handleChange}
                className="textarea textarea-bordered w-full resize-none"
                placeholder="Brief description of your college's vision and mission"
                rows={3}
              />
            </div>

            {/* Password Fields */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium opacity-80 mb-2">
                Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Eye className="h-5 w-5 opacity-50" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input input-bordered w-full pl-10 pr-10"
                  placeholder="Create a password"
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium opacity-80 mb-2">
                Confirm Password *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input input-bordered w-full"
                placeholder="Confirm your password"
              />
            </div>

            {/* Password Validation */}
            {formData.password && (
              <div className="space-y-2 md:col-span-2">
                <p className="text-sm font-medium opacity-80">Password Requirements:</p>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    {formData.password.length >= 6 ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-sm ${formData.password.length >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                      At least 6 characters
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {formData.password === formData.confirmPassword && formData.confirmPassword ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-sm ${formData.password === formData.confirmPassword && formData.confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                      Passwords match
                    </span>
                  </div>
                </div>
              </div>
            )}
            </div>

            <button
              type="submit"
              disabled={isLoading || formData.password !== formData.confirmPassword || formData.password.length < 6}
              className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner mr-2" />
                  Registering College...
                </>
              ) : (
                'Register College'
              )}
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollegeRegisterForm; 