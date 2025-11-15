import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import socketService from '../../services/socket.js';
import { toast } from 'react-hot-toast';
import { 
  Users, 
  MessageCircle, 
  Search, 
  Calendar, 
  Settings, 
  LogOut,
  Menu,
  X,
  Building,
  GraduationCap
} from 'lucide-react';
import logo from '../../assets/campusconnect-logo.svg';
import { chatRequestAPI, videoCallRequestAPI } from '../../services/api.js';

import CollegesList from './CollegesList.jsx';
import ChatInterface from '../Chat/ChatInterface.jsx';
import SearchStudents from './SearchStudents.jsx';
import EventsList from './EventsList.jsx';
import Profile from './Profile.jsx';
import CollegeDashboard from './CollegeDashboard.jsx';
import VideoCallManager from '../VideoCall/VideoCallManager.jsx';
import RequestManager from '../Requests/RequestManager.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import CollegeDetails from './CollegeDetails.jsx';
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('colleges');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requestBadge, setRequestBadge] = useState(0);
  const [chatPending, setChatPending] = useState(0);
  const [videoPending, setVideoPending] = useState(0);
  const [requestsDefaultTab, setRequestsDefaultTab] = useState('chat');
  const [selectedCollegeId, setSelectedCollegeId] = useState('');

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
      return;
    }

    // Connect to socket
    socketService.connect(token);
    // Join both fallback room and user_* room to guarantee delivery
    socketService.joinRoom(user.id);
    socketService.joinRoom(`user_${user.id}`);

    return () => {};
  }, [user, token, navigate]);

  useEffect(() => {
    let mounted = true;
    let timer;
    const load = async () => {
      try {
        const [chatRecv, videoRecv] = await Promise.all([
          chatRequestAPI.getRequests('received'),
          videoCallRequestAPI.getRequests('received')
        ]);
        const chatP = (chatRecv.data || []).filter(r => r.status === 'pending').length;
        const videoP = (videoRecv.data || []).filter(r => r.status === 'pending').length;
        const count = chatP + videoP;
        if (mounted) {
          setChatPending(chatP);
          setVideoPending(videoP);
          setRequestBadge(count);
        }
      } catch (_) {
        if (mounted) {
          setRequestBadge(0);
          setChatPending(0);
          setVideoPending(0);
        }
      } finally {
        timer = setTimeout(load, 20000);
      }
    };
    load();
    return () => { mounted = false; if (timer) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const s = socketService.isSocketConnected() ? socketService.socket : null;
    if (!s) return;
    const onChatReqUpdate = (payload) => {
      try {
        if (payload?.status === 'accepted') {
          setRequestsDefaultTab('chat');
          toast.success(`${payload?.sender?.name || 'User'} accepted your chat request`);
        }
      } catch (_) {}
    };
    const onVideoReqUpdate = (payload) => {
      try {
        if (payload?.status === 'accepted') {
          setRequestsDefaultTab('video');
          toast.success(`${payload?.sender?.name || 'User'} accepted your video call request. Start a call from Chat.`);
        }
      } catch (_) {}
    };
    s.on('chat_request_updated', onChatReqUpdate);
    s.on('video_request_updated', onVideoReqUpdate);
    return () => {
      const s2 = socketService.socket;
      if (s2) {
        s2.off('chat_request_updated', onChatReqUpdate);
        s2.off('video_request_updated', onVideoReqUpdate);
      }
    };
  }, [socketService, token]);

  // Allow other components to open Chat tab for a specific user
  useEffect(() => {
    const handler = (e) => {
      try {
        const detail = e?.detail || {};
        if (detail.routed) {
          // Already routed to Chat; let ChatInterface consume it
          return;
        }
        setActiveTab('chat');
        setSidebarOpen(false);
        // Re-dispatch after Chat mounts so ChatInterface can catch it
        setTimeout(() => {
          try { window.dispatchEvent(new CustomEvent('open_chat_with', { detail: { ...detail, routed: true } })); } catch (_) {}
        }, 50);
      } catch (_) {}
    };
    window.addEventListener('open_chat_with', handler);
    // College details navigation
    const openCollege = (e) => {
      try {
        const id = String(e?.detail?.collegeId || '');
        if (!id) return;
        setSelectedCollegeId(id);
        setActiveTab('collegeDetails');
        setSidebarOpen(false);
      } catch (_) {}
    };
    window.addEventListener('open_college_details', openCollege);
    return () => {
      window.removeEventListener('open_chat_with', handler);
      window.removeEventListener('open_college_details', openCollege);
    };
  }, []);

  const handleLogout = () => {
    socketService.disconnect();
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Check if user is a college administrator
  const isCollegeAdmin = user?.type === 'college' || user?.adminEmail;

  // If user is a college admin, show college dashboard
  if (isCollegeAdmin) {
    return <CollegeDashboard />;
  }

  // Student dashboard
  const menuItems = [
    { id: 'colleges', label: 'Colleges', icon: Building, description: 'Browse colleges and departments' },
    { id: 'search', label: 'Find Students', icon: Search, description: 'Discover students by interests' },
    { id: 'requests', label: 'Requests', icon: MessageCircle, description: 'Manage connection requests' },
    { id: 'chat', label: 'Chat', icon: MessageCircle, description: 'Real-time messaging' },
    { id: 'events', label: 'Events', icon: Calendar, description: 'Join live events' },
    { id: 'profile', label: 'Profile', icon: Users, description: 'Manage your profile' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'colleges':
        return <CollegesList />;
      case 'collegeDetails':
        return (
          <CollegeDetails
            collegeId={selectedCollegeId}
            onBack={() => setActiveTab('colleges')}
          />
        );
      case 'requests':
        return <RequestManager defaultTab={requestsDefaultTab} />;
      case 'chat':
        return <ChatInterface />;
      case 'search':
        return <SearchStudents />;
      case 'events':
        return <EventsList />;
      case 'profile':
        return <Profile />;
      default:
        return <CollegesList />;
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
              <div className="w-12 h-12 bg-base-300 rounded-full flex items-center justify-center overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user?.name || 'Profile'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold">{(user?.name || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.name}
                </p>
                <p className="text-xs opacity-70 truncate">
                  {user?.usn}
                </p>
                <p className="text-xs opacity-70 truncate">
                  {user?.college?.collegeName}
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
                  className={`w-full flex items-start space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    activeTab === item.id
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600 shadow-sm'
                      : 'hover:bg-base-200 hover:shadow-sm'
                  }`}
                >
                  <Icon className={`w-5 h-5 mt-0.5 ${activeTab === item.id ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`} />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.label}</span>
                      {item.id === 'chat' && chatPending > 0 && (
                        <span className="inline-block w-2 h-2 rounded-full bg-base-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs opacity-70 mt-0.5">{item.description}</p>
                    {item.id === 'requests' && requestBadge > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-base-300 text-base-content text-xs px-2 py-0.5 min-w-[20px] mt-1">
                        {requestBadge}
                      </span>
                    )}
                  </div>
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
          <ErrorBoundary friendlyMessage="A display error occurred. Please try switching tabs or retry.">
            {renderContent()}
          </ErrorBoundary>
        </div>
      </div>

      {/* Video Call Manager */}
      <VideoCallManager />
    </div>
  );
};

export default Dashboard;