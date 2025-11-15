import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api.js';
import useAuthStore from '../../store/authStore.js';
import { toast } from 'react-hot-toast';
import { User, Mail, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

const INTERESTS = [
  'Artificial Intelligence',
  'Machine Learning',
  'Data Science',
  'Web Development',
  'Mobile Development',
  'Cybersecurity',
  'Cloud Computing',
  'DevOps',
  'Blockchain',
  'IoT',
  'Robotics',
  'Game Development',
  'UI/UX Design',
  'Digital Marketing',
  'Business Analytics',
  'Finance',
  'Marketing',
  'Human Resources',
  'Operations',
  'Research'
];

const SKILLS = [
  'JavaScript',
  'Python',
  'Java',
  'React',
  'Node.js',
  'MongoDB',
  'SQL',
  'AWS',
  'Docker',
  'Git',
  'HTML/CSS',
  'TypeScript',
  'Angular',
  'Vue.js',
  'PHP',
  'C++',
  'C#',
  'Swift',
  'Kotlin',
  'Flutter',
  'TensorFlow',
  'PyTorch',
  'Scikit-learn',
  'Pandas',
  'NumPy',
  'Linux',
  'Networking',
  'Agile',
  'Scrum',
  'UI/UX Design'
];

const RegisterForm = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('usn'); // 'usn', 'otp', 'password', 'interests'
  const [formData, setFormData] = useState({
    usn: '',
    otp: '',
    password: '',
    confirmPassword: '',
    interests: [],
    skills: []
  });
  const [studentInfo, setStudentInfo] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleUsnSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await authAPI.firstLogin(formData.usn);
      setStudentInfo(response.data.student);
      setStep('otp');
      toast.success('📧 OTP sent to your email!');
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to send OTP';
      toast.error(`❌ ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // For demo purposes, accept any 6-digit OTP
      if (formData.otp.length === 6) {
        setStep('password');
        toast.success('✅ OTP verified!');
      } else {
        toast.error('❌ Please enter a valid 6-digit OTP');
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Invalid OTP';
      toast.error(`❌ ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('❌ Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('❌ Password must be at least 6 characters');
      return;
    }

    setStep('interests');
  };

  const handleInterestToggle = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleSkillToggle = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await authAPI.verifyOTP(
        formData.usn,
        formData.otp,
        formData.password,
        formData.interests,
        formData.skills
      );
      
      // Auto-login after successful registration
      const { login } = useAuthStore.getState();
      login(response.data.student, response.data.token);
      toast.success('🎉 Registration complete! Welcome to CampusConnect!');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(`❌ ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderUsnStep = () => (
    <form onSubmit={handleUsnSubmit} className="space-y-6">
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
          />
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
            Verifying...
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );

  const renderOtpStep = () => (
    <div className="space-y-6">
      {studentInfo && (
        <div className="bg-primary-50 rounded-lg p-4 border border-primary-100">
          <p className="text-sm text-primary-800">
            <strong>Student:</strong> {studentInfo.name}<br />
            <strong>Email:</strong> {studentInfo.email}<br />
            {/* studentInfo.college may be an object (e.g., { id, collegeName }) */}
            <strong>College:</strong> {studentInfo.college?.collegeName || studentInfo.collegeName || String(studentInfo.college || '')}
          </p>
        </div>
      )}

      <form onSubmit={handleOtpSubmit} className="space-y-6">
        <div>
          <label htmlFor="otp" className="block text-sm font-medium opacity-80 mb-2">
            Enter OTP sent to your email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 opacity-50" />
            </div>
            <input
              id="otp"
              name="otp"
              type="text"
              required
              maxLength={6}
              value={formData.otp}
              onChange={handleChange}
              className="input input-bordered w-full pl-10 text-center text-lg tracking-widest"
              placeholder="000000"
            />
          </div>
          <p className="text-xs opacity-70 mt-2">
            For demo: Enter any 6-digit number
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || formData.otp.length !== 6}
          className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <span className="loading loading-spinner mr-2" />
              Verifying...
            </>
          ) : (
            'Verify OTP'
          )}
        </button>
      </form>
    </div>
  );

  const renderPasswordStep = () => (
    <form onSubmit={handlePasswordSubmit} className="space-y-6">
      <div>
        <label htmlFor="password" className="block text-sm font-medium opacity-80 mb-2">
          Create Password
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
            placeholder="Enter your password"
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
          Confirm Password
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

      <button
        type="submit"
        disabled={!formData.password || !formData.confirmPassword}
        className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </form>
  );

  const renderInterestsStep = () => (
    <form onSubmit={handleFinalSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium opacity-80 mb-4">
          Select your interests (Choose at least 1)
        </label>
        <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
          {INTERESTS.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => handleInterestToggle(interest)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                formData.interests.includes(interest)
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-base-200 hover:border-base-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{interest}</span>
                {formData.interests.includes(interest) ? (
                  <CheckCircle className="h-4 w-4 text-primary-600" />
                ) : (
                  <XCircle className="h-4 w-4 opacity-50" />
                )}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs opacity-70 mt-2">
          Selected: {formData.interests.length} interests
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium opacity-80 mb-4">
          Select your skills (Optional)
        </label>
        <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
          {SKILLS.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => handleSkillToggle(skill)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                formData.skills.includes(skill)
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-base-200 hover:border-base-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{skill}</span>
                {formData.skills.includes(skill) ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 opacity-50" />
                )}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs opacity-70 mt-2">
          Selected: {formData.skills.length} skills
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || formData.interests.length < 1}
        className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <span className="loading loading-spinner mr-2" />
            Creating account...
          </>
        ) : (
          'Complete Registration'
        )}
      </button>
    </form>
  );

  const steps = [
    { key: 'usn', title: 'Enter USN', component: renderUsnStep },
    { key: 'otp', title: 'Verify OTP', component: renderOtpStep },
    { key: 'password', title: 'Set Password', component: renderPasswordStep },
    { key: 'interests', title: 'Select Interests', component: renderInterestsStep }
  ];

  // Ensure we always have a valid index; fallback to first step if something unexpected happens
  const foundIndex = steps.findIndex(s => s.key === step);
  const currentStepIndex = foundIndex >= 0 ? foundIndex : 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 text-base-content p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            CampusConnect
          </h1>
          <p className="opacity-70">
            Create your account
          </p>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-8">
          <div className="alert alert-info mb-6 text-sm">
            <div>
              <strong>Note:</strong> Make sure your college is registered on the platform.
              <br />
              You can only sign up if your college has added you to their student database.
            </div>
          </div>
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((s, index) => (
              <div key={s.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStepIndex
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-1 mx-2 ${
                    index < currentStepIndex ? 'bg-primary-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              {steps[currentStepIndex].title}
            </h2>
          </div>

          {steps[currentStepIndex].component()}

          <div className="mt-6 text-center">
            <p className="text-sm opacity-70">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Sign in here
              </button>
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm; 