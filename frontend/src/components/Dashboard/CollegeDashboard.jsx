import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import socketService from '../../services/socket.js';
import { toast } from 'react-hot-toast';
import { 
  Users, 
  Building, 
  GraduationCap, 
  Calendar, 
  Settings, 
  LogOut,
  Menu,
  X,
  Home,
  Plus,
  Upload,
  BarChart3
} from 'lucide-react';
import logo from '../../assets/campusconnect-logo.svg';

import CollegeOverview from './CollegeOverview.jsx';
import DepartmentManagement from './DepartmentManagement.jsx';
import StudentManagement from './StudentManagement.jsx';
import EventManagement from './EventManagement.jsx';
import CollegeProfile from './CollegeProfile.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';

const CollegeDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      navigate('/college-login');
      return;
    }

    // Connect to socket
    socketService.connect(token);
    socketService.joinRoom(user.id);

    return () => {
      socketService.disconnect();
    };
  }, [user, token, navigate]);

  // Handle URL parameters for tab navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['overview', 'departments', 'students', 'events', 'profile'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const handleLogout = () => {
    socketService.disconnect();
    logout();
    toast.success('👋 Logged out successfully');
    navigate('/college-login');
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'profile', label: 'Profile', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <CollegeOverview />;
      case 'departments':
        return <DepartmentManagement />;
      case 'students':
        return <StudentManagement />;
      case 'events':
        return <EventManagement />;
      case 'profile':
        return <CollegeProfile />;
      default:
        return <CollegeOverview />;
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-base-200 text-base-content flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-base-100 shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-base-200">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="CampusConnect" className="w-8 h-8" />
              <h1 className="text-xl font-bold">CampusConnect</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-base-200"
            >
              <X className="w-5 h-5 opacity-70" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-6 border-b border-base-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-base-300 rounded-full flex items-center justify-center overflow-hidden">
                {user?.collegeLogo ? (
                  <img src={user.collegeLogo} alt={user?.collegeName || 'Logo'} className="w-full h-full object-cover" />
                ) : (
                  <Building className="w-5 h-5 opacity-70" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.collegeName}
                </p>
                <p className="text-xs opacity-70 truncate">
                  {user?.adminName}
                </p>
                <p className="text-xs opacity-70 truncate">
                  Administrator
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-base-200 border-r-2 border-indigo-400'
                      : 'hover:bg-base-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${activeTab === item.id ? '' : 'opacity-60'}`} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-base-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-base-200 rounded-lg transition-colors duration-200"
            >
              <LogOut className="w-5 h-5 text-red-600" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Mobile Top Navbar */}
        <div className="lg:hidden sticky top-0 z-10 bg-base-100 border-b border-base-200">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <img src={logo} alt="CampusConnect" className="w-5 h-5" />
              <span className="font-semibold">CampusConnect</span>
            </div>
            <div className="opacity-0">.</div>
          </div>
        </div>
        {/* Content Area */}
        <div className="flex-1 p-6 overflow-auto">
          <ErrorBoundary friendlyMessage="A display error occurred. Please try again.">
            {renderContent()}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default CollegeDashboard; 