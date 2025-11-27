import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import { toast } from 'react-hot-toast';
import { interestsAPI, chatAPI, eventAPI, chatRequestAPI } from '../../services/api.js';
import { 
  User, 
  Mail, 
  Building, 
  GraduationCap, 
  Edit, 
  Save, 
  X,
  LogOut,
  Camera,
  Plus
} from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    interests: user?.interests || [],
    photoURL: user?.photoURL || ''
  });
  const [statsData, setStatsData] = useState({
    chats: 0,
    events: 0,
    connections: 0,
    loading: true
  });
  const [statsError, setStatsError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleInterestToggle = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleAddCustomInterest = () => {
    const trimmed = customInterestInput.trim();
    if (!trimmed) return;
    if (formData.interests.includes(trimmed)) {
      toast.error('This interest is already added');
      return;
    }
    setFormData(prev => ({
      ...prev,
      interests: [...prev.interests, trimmed]
    }));
    setCustomInterestInput('');
    toast.success('Custom interest added!');
  };

  const handleRemoveInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/student/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          interests: formData.interests,
          photoURL: formData.photoURL
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to update profile');
      updateUser({
        ...user,
        name: data?.student?.name ?? formData.name,
        email: data?.student?.email ?? formData.email,
        interests: data?.student?.interests ?? formData.interests,
        photoURL: data?.student?.photoURL ?? formData.photoURL
      });
      setIsEditing(false);
      toast.success('✅ Profile updated successfully!');
    } catch (e) {
      toast.error(e?.message || 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      interests: user?.interests || []
    });
    setIsEditing(false);
  };

  const [availableInterests, setAvailableInterests] = useState([
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
    'Business Analytics'
  ]);

  // Fetch all interests (including custom ones)
  useEffect(() => {
    const fetchInterests = async () => {
      try {
        const response = await interestsAPI.getAll();
        if (response.data?.interests) {
          setAvailableInterests(response.data.interests);
        }
      } catch (error) {
        console.error('Error fetching interests:', error);
      }
    };
    fetchInterests();
  }, []);

  // Fetch account statistics (chats, events, connections)
  useEffect(() => {
    const uid = String(user?._id || user?.id || '');
    if (!uid) return;
    let cancelled = false;
    const loadStats = async () => {
      setStatsData((prev) => ({ ...prev, loading: true }));
      setStatsError('');
      try {
        const [chatsRes, eventsRes, chatReqReceived, chatReqSent] = await Promise.all([
          chatAPI.getChats().catch(() => ({ data: [] })),
          eventAPI.getAll().catch(() => ({ data: [] })),
          chatRequestAPI.getRequests('received').catch(() => ({ data: [] })),
          chatRequestAPI.getRequests('sent').catch(() => ({ data: [] }))
        ]);

        const chatCount = Array.isArray(chatsRes?.data) ? chatsRes.data.length : 0;

        const eventsListRaw = eventsRes?.data;
        const eventsList = Array.isArray(eventsListRaw)
          ? eventsListRaw
          : Array.isArray(eventsListRaw?.events)
            ? eventsListRaw.events
            : [];
        const eventsCount = eventsList.filter((ev) => {
          if (!Array.isArray(ev?.participants)) return false;
          return ev.participants.some((p) => {
            const pid = typeof p === 'string' ? p : (p?._id || p?.id || '');
            return String(pid) === uid;
          });
        }).length;

        const acceptedRequests = [
          ...(Array.isArray(chatReqReceived?.data) ? chatReqReceived.data : []),
          ...(Array.isArray(chatReqSent?.data) ? chatReqSent.data : [])
        ].filter((req) => String(req?.status || '').toLowerCase() === 'accepted');
        const connectionsSet = new Set();
        acceptedRequests.forEach((req) => {
          const senderId = String(req?.sender?._id || req?.sender?.id || '');
          const receiverId = String(req?.receiver?._id || req?.receiver?.id || '');
          if (senderId === uid && receiverId) {
            connectionsSet.add(receiverId);
          } else if (receiverId === uid && senderId) {
            connectionsSet.add(senderId);
          }
        });
        const connectionsCount = connectionsSet.size;

        if (!cancelled) {
          setStatsData({
            chats: chatCount,
            events: eventsCount,
            connections: connectionsCount,
            loading: false
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
        if (!cancelled) {
          setStatsError('Failed to load stats');
          setStatsData((prev) => ({ ...prev, loading: false }));
        }
      }
    };
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="opacity-70 mt-1 hidden sm:block">
            Manage your account information and preferences
          </p>
        </div>
        <div className="flex space-x-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 px-4 py-2 btn btn-primary"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="flex items-center space-x-2 px-4 py-2 btn btn-ghost"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 btn btn-success"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
            </>
          )}
          <button
            onClick={() => { try { logout(); toast.success('Logged out'); navigate('/login'); } catch (_) {} }}
            className="flex items-center space-x-2 px-4 py-2 btn btn-error"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden relative">
                  {formData.photoURL ? (
                    <img
                      src={formData.photoURL}
                      alt={formData.name}
                      className="w-24 h-24 object-cover"
                    />
                  ) : (
                    <span className="text-xl font-semibold">{(formData.name || 'U').charAt(0).toUpperCase()}</span>
                  )}
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="loading loading-spinner loading-sm text-white" />
                    </div>
                  )}
                </div>
                <label className={`absolute bottom-0 right-0 w-8 h-8 btn ${isEditing ? 'btn-primary' : 'btn-ghost'} btn-circle min-h-0 h-8 w-8 p-0 cursor-pointer`}>
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('File must be < 5MB');
                        return;
                      }
                      const fd = new FormData();
                      fd.append('file', file);
                      try {
                        setUploadingPhoto(true);
                        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/upload`, {
                          method: 'POST',
                          headers: {
                            Authorization: `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
                          },
                          body: fd
                        });
                        const ct = res.headers.get('content-type') || '';
                        let data;
                        if (ct.includes('application/json')) {
                          data = await res.json();
                        } else {
                          const text = await res.text();
                          throw new Error(text || 'Upload failed (non-JSON response)');
                        }
                        if (!res.ok || !data?.url) throw new Error(data?.message || 'Upload failed');
                        // Update local form state
                        setFormData((prev) => ({ ...prev, photoURL: data.url }));
                        // Persist immediately so other sessions/devices get it
                        try {
                          const saveRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/student/profile`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
                            },
                            body: JSON.stringify({ photoURL: data.url })
                          });
                          const saveJson = await saveRes.json().catch(() => ({}));
                          if (!saveRes.ok) throw new Error(saveJson?.message || 'Failed to save photo');
                          // Update global store to rerender everywhere
                          updateUser({ ...user, photoURL: saveJson?.student?.photoURL || data.url });
                          // Broadcast a custom event for any listeners
                          try { window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: { field: 'photoURL', value: data.url } })); } catch (_) {}
                        } catch (err2) {
                          // Even if backend save fails, keep UI updated locally
                          updateUser({ ...user, photoURL: data.url });
                        }
                        toast.success('Profile photo uploaded');
                      } catch (err) {
                        toast.error(err?.message || 'Upload failed');
                      } finally {
                        setUploadingPhoto(false);
                      }
                    }}
                  />
                </label>
              </div>
              
              <h2 className="text-xl font-semibold mb-1">{isEditing ? formData.name : user?.name}</h2>
              <p className="opacity-70 mb-4">{user?.usn}</p>
              
              <div className="space-y-3 text-left">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 opacity-60" />
                  <span className="text-sm opacity-70">
                    {isEditing ? formData.email : user?.email}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Building className="w-4 h-4 opacity-60" />
                  <span className="text-sm opacity-70">
                    {user?.college?.collegeName}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <GraduationCap className="w-4 h-4 opacity-60" />
                  <span className="text-sm opacity-70">
                    {user?.department?.name || 'Department not assigned'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="lg:col-span-2">
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
            <h3 className="text-lg font-semibold mb-6">Profile Information</h3>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-md font-medium mb-4">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Full Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="input input-bordered w-full"
                      />
                    ) : (
                      <p>{user?.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="input input-bordered w-full"
                      />
                    ) : (
                      <p>{user?.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div>
                <h4 className="text-md font-medium mb-4">Academic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      USN
                    </label>
                    <p>{user?.usn}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      College
                    </label>
                    <p>{user?.college?.collegeName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Department
                    </label>
                    <p>{user?.department?.name || 'Not assigned'}</p>
                  </div>
                </div>
              </div>

              {/* Interests */}
              <div>
                <h4 className="text-md font-medium mb-4">Interests</h4>
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {availableInterests.map((interest) => (
                        <label key={interest} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.interests.includes(interest)}
                            onChange={() => handleInterestToggle(interest)}
                            className="checkbox checkbox-primary checkbox-sm"
                          />
                          <span className="text-sm">{interest}</span>
                        </label>
                      ))}
                    </div>
                    {/* Custom Interests Input */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Add Custom Interest</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customInterestInput}
                          onChange={(e) => setCustomInterestInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomInterest();
                            }
                          }}
                          className="input input-bordered flex-1"
                          placeholder="Enter a custom interest"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomInterest}
                          className="btn btn-primary"
                          disabled={!customInterestInput.trim()}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Selected Interests Display */}
                    {formData.interests.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Selected Interests</label>
                        <div className="flex flex-wrap gap-2">
                          {formData.interests.map((interest, idx) => (
                            <span
                              key={idx}
                              className="badge badge-primary badge-lg gap-2"
                            >
                              {interest}
                              <button
                                type="button"
                                onClick={() => handleRemoveInterest(interest)}
                                className="btn btn-ghost btn-xs btn-circle p-0 min-h-0 h-4 w-4"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user?.interests && user.interests.length > 0 ? (
                      user.interests.map((interest, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-sm rounded-full"
                        >
                          {interest}
                        </span>
                      ))
                    ) : (
                      <p className="opacity-70">No interests selected</p>
                    )}
                  </div>
                )}
              </div>

              {/* Account Statistics */}
              <div>
                <h4 className="text-md font-medium mb-4">Account Statistics</h4>
                {statsError && (
                  <p className="text-sm text-red-500 mb-2">{statsError}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-base-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-indigo-300">
                      {statsData.loading ? '—' : statsData.chats}
                    </p>
                    <p className="text-sm opacity-70">Chats</p>
                  </div>
                  <div className="bg-base-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-indigo-300">
                      {statsData.loading ? '—' : statsData.events}
                    </p>
                    <p className="text-sm opacity-70">Events Joined</p>
                  </div>
                  <div className="bg-base-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-indigo-300">
                      {statsData.loading ? '—' : statsData.connections}
                    </p>
                    <p className="text-sm opacity-70">Connections</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 