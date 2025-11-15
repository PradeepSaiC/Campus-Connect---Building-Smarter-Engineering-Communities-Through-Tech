import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore.js';
import { collegeAPI, departmentAPI, eventAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import { 
  Building, 
  Users, 
  GraduationCap, 
  Calendar,
  TrendingUp,
  Activity,
  Plus,
  AlertCircle
} from 'lucide-react';

const CollegeOverview = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDepartments: 0,
    totalEvents: 0,
    activeConnections: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchCollegeData();
  }, []);

  const fetchCollegeData = async () => {
    setIsLoading(true);
    try {
      // Fetch departments for this college
      const departmentsResponse = await departmentAPI.getByCollege(user?.id);
      const departments = departmentsResponse?.data?.departments || [];
      setDepartments(departments);
      
      // Fetch events for this college
      const eventsResponse = await eventAPI.getByCollege(user?.id);
      const events = eventsResponse?.data?.events || [];
      setEvents(events);
      
      // Calculate total students from departments
      const totalStudents = departments.reduce((sum, dept) => sum + (dept.totalStudents || 0), 0);
      const totalDepartments = departments.length;
      const totalEvents = events.length;
      
      setStats({
        totalStudents,
        totalDepartments,
        totalEvents,
        activeConnections: 0 // This would need real-time data
      });
    } catch (error) {
      console.error('Error fetching college data:', error);
      toast.error('Failed to load college data');
      // Set empty stats on error
      setStats({
        totalStudents: 0,
        totalDepartments: 0,
        totalEvents: 0,
        activeConnections: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh data (can be called from other components)
  const refreshData = () => {
    fetchCollegeData();
  };

  // Expose refresh function globally for other components to use
  useEffect(() => {
    window.refreshOverview = refreshData;
    return () => {
      delete window.refreshOverview;
    };
  }, []);

  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'indigo',
      change: stats.totalStudents > 0 ? `${stats.totalStudents} students` : 'No students yet',
      changeType: stats.totalStudents > 0 ? 'positive' : 'neutral'
    },
    {
      title: 'Departments',
      value: stats.totalDepartments,
      icon: Building,
      color: 'indigo',
      change: stats.totalDepartments > 0 ? `${stats.totalDepartments} departments` : 'No departments yet',
      changeType: stats.totalDepartments > 0 ? 'positive' : 'neutral'
    },
    {
      title: 'Events Hosted',
      value: stats.totalEvents,
      icon: Calendar,
      color: 'indigo',
      change: stats.totalEvents > 0 ? `${stats.totalEvents} events` : 'No events yet',
      changeType: stats.totalEvents > 0 ? 'positive' : 'neutral'
    },
    {
      title: 'Active Connections',
      value: stats.activeConnections,
      icon: Activity,
      color: 'indigo',
      change: 'Coming soon',
      changeType: 'neutral'
    }
  ];

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-base-300 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-base-300 rounded w-1/2"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-base-300 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-base-300 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-base-300 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
        <h1 className="text-3xl font-bold">College Overview</h1>
        <p className="opacity-70 mt-2">
          Welcome back, {user?.adminName}! Here's what's happening at {user?.collegeName}.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium opacity-70 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold mb-2">{stat.value.toLocaleString()}</p>
                  <div className="flex items-center">
                    <AlertCircle className="w-4 h-4 opacity-60" />
                    <span className="text-sm font-medium ml-1 opacity-70">
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ml-4 bg-indigo-500/20`}>
                  <Icon className="w-6 h-6 text-indigo-300" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
          <h3 className="text-lg font-semibold mb-6">Quick Actions</h3>
          <div className="space-y-4">
            <button 
              onClick={() => window.location.href = '/dashboard?tab=departments&create=true'}
              className="w-full flex items-center space-x-4 p-4 text-left hover:bg-base-200 rounded-lg transition-colors duration-200 border border-base-200"
            >
              <div className="w-10 h-10 bg-base-300 rounded-lg flex items-center justify-center">
                <Plus className="w-5 h-5 opacity-70" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Add New Department</p>
                <p className="text-sm opacity-70">Create a new department in your college</p>
              </div>
            </button>
            <button 
              onClick={() => window.location.href = '/dashboard?tab=students&upload=true'}
              className="w-full flex items-center space-x-4 p-4 text-left hover:bg-base-200 rounded-lg transition-colors duration-200 border border-base-200"
            >
              <div className="w-10 h-10 bg-base-300 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 opacity-70" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Upload Students</p>
                <p className="text-sm opacity-70">Bulk upload student records</p>
              </div>
            </button>
            <button 
              onClick={() => window.location.href = '/dashboard?tab=events&create=true'}
              className="w-full flex items-center space-x-4 p-4 text-left hover:bg-base-200 rounded-lg transition-colors duration-200 border border-base-200"
            >
              <div className="w-10 h-10 bg-base-300 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 opacity-70" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Create Event</p>
                <p className="text-sm opacity-70">Host a new live event</p>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
          <h3 className="text-lg font-semibold mb-6">Recent Activity</h3>
          {departments.length === 0 && events.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 opacity-60" />
              </div>
              <p className="opacity-70 mb-2">No recent activity</p>
              <p className="text-sm opacity-60">Start by adding departments and creating events</p>
            </div>
          ) : (
            <div className="space-y-6">
              {departments.slice(0, 2).map((dept, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="w-3 h-3 bg-indigo-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Department created</p>
                    <p className="text-xs opacity-70 mt-1">{dept.name} department added</p>
                    <p className="text-xs opacity-60 mt-1">Recently</p>
                  </div>
                </div>
              ))}
              {events.slice(0, 2).map((event, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="w-3 h-3 bg-indigo-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Event created</p>
                    <p className="text-xs opacity-70 mt-1">{event.title}</p>
                    <p className="text-xs opacity-60 mt-1">Recently</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* College Information */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
        <h3 className="text-lg font-semibold mb-6">College Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-medium mb-4">Basic Details</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-base-200">
                <span className="opacity-70">College Name:</span>
                <span className="font-medium">{user?.collegeName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-base-200">
                <span className="opacity-70">Type:</span>
                <span className="font-medium">{user?.collegeType || 'Private'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-base-200">
                <span className="opacity-70">Admin:</span>
                <span className="font-medium">{user?.adminName}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="opacity-70">Email:</span>
                <span className="font-medium">{user?.adminEmail}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-4">Address</h4>
            <div className="bg-base-200 rounded-lg p-4">
              <p className="text-sm opacity-80 leading-relaxed">
                {user?.collegeAddress || 'Address not provided'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollegeOverview; 