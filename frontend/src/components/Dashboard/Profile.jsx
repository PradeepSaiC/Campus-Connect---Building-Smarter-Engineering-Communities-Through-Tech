import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import { toast } from 'react-hot-toast';
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
  Plus,
  XCircle
} from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCollegePhoto, setUploadingCollegePhoto] = useState(false);
  const [customInterest, setCustomInterest] = useState('');
  const [showCustomInterestInput, setShowCustomInterestInput] = useState(false);
  const [accountStats, setAccountStats] = useState({
    chats: 0,
    events: 0,
    connections: 0
  });
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    interests: user?.interests || [],
    photoURL: user?.photoURL || '',
    collegePhotoURL: user?.collegePhotoURL || ''
  });

  // Fetch account statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/user/stats`, {
          headers: {
            Authorization: `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
          }
        });
        const data = await res.json();
        if (res.ok) {
          setAccountStats({
            chats: data.chats || 0,
            events: data.events || 0,
            connections: data.connections || 0
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, [user?._id]);

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

  const handlePhotoUpload = async (file, isCollegePhoto = false) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be < 5MB');
      return;
    }

    const setUploading = isCollegePhoto ? setUploadingCollegePhoto : setUploadingPhoto;
    const field = isCollegePhoto ? 'collegePhotoURL' : 'photoURL';

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/upload?type=${isCollegePhoto ? 'college' : 'profile'}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
        },
        body: fd
      });
      
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.message || 'Upload failed');
      
      // Update local form state
      setFormData(prev => ({ ...prev, [field]: data.url }));
      
      // Update backend
      const saveRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/student/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
        },
        body: JSON.stringify({ [field]: data.url })
      });
      
      const saveJson = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJson?.message || 'Failed to save photo');
      
      // Update global store
      updateUser({ ...user, [field]: data.url });
      toast.success('Photo uploaded successfully');
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !formData.interests.includes(customInterest.trim())) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, customInterest.trim()]
      }));
      setCustomInterest('');
      setShowCustomInterestInput(false);
    }
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
          photoURL: formData.photoURL,
          collegePhotoURL: formData.collegePhotoURL
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to update profile');
      
      updateUser({
        ...user,
        name: data?.student?.name ?? formData.name,
        email: data?.student?.email ?? formData.email,
        interests: data?.student?.interests ?? formData.interests,
        photoURL: data?.student?.photoURL ?? formData.photoURL,
        collegePhotoURL: data?.student?.collegePhotoURL ?? formData.collegePhotoURL
      });
      
      setIsEditing(false);
      toast.success('✅ Profile updated successfully!');
    } catch (e) {
      console.error('Update error:', e);
      toast.error(e?.message || 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      interests: user?.interests || [],
      photoURL: user?.photoURL || '',
      collegePhotoURL: user?.collegePhotoURL || ''
    });
    setCustomInterest('');
    setShowCustomInterestInput(false);
    setIsEditing(false);
  };

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
    'Other'
  ];

  const handleRemoveInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

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
        <div className="lg:col-span-1 space-y-6">
          {/* User Photo */}
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
                  {isEditing && (
                    <label className="absolute bottom-0 right-0 w-8 h-8 btn btn-primary btn-circle min-h-0 h-8 w-8 p-0 cursor-pointer">
                      <Camera className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file, false);
                          e.target.value = ''; // Reset input to allow re-uploading the same file
                        }}
                        disabled={uploadingPhoto}
                      />
                    </label>
                  )}
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
                    {user?.college?.collegeName || 'College not set'}
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
          
          {/* College Photo */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
            <div className="text-center">
              <h3 className="font-medium mb-4">College Photo</h3>
              <div className="relative inline-block w-full">
                <div className="w-full h-48 bg-base-300 rounded-lg flex items-center justify-center mx-auto mb-4 overflow-hidden relative">
                  {formData.collegePhotoURL ? (
                    <img
                      src={formData.collegePhotoURL}
                      alt="College"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold opacity-50">No college photo uploaded</span>
                  )}
                  {uploadingCollegePhoto && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="loading loading-spinner loading-sm text-white" />
                    </div>
                  )}
                </div>
                {isEditing && (
                  <label className="btn btn-primary btn-sm w-full">
                    <Camera className="w-4 h-4 mr-2" />
                    {formData.collegePhotoURL ? 'Change College Photo' : 'Upload College Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file, true);
                        e.target.value = ''; // Reset input to allow re-uploading the same file
                      }}
                      disabled={uploadingCollegePhoto}
                    />
                  </label>
                )}
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
                      {INTERESTS.map((interest) => (
                        <label key={interest} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.interests.includes(interest)}
                            onChange={() => {
                              if (interest === 'Other') {
                                setShowCustomInterestInput(!showCustomInterestInput);
                              } else {
                                handleInterestToggle(interest);
                              }
                            }}
                            className="checkbox checkbox-primary checkbox-sm"
                          />
                          <span className="text-sm">{interest}</span>
                        </label>
                      ))}
                    </div>
                    
                    {showCustomInterestInput && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={customInterest}
                          onChange={(e) => setCustomInterest(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addCustomInterest()}
                          placeholder="Enter custom interest"
                          className="input input-bordered input-sm flex-1"
                        />
                        <button 
                          onClick={addCustomInterest}
                          className="btn btn-primary btn-sm"
                          disabled={!customInterest.trim()}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    {formData.interests.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.interests.map((interest, index) => (
                          <div key={index} className="badge badge-outline badge-primary gap-1">
                            {interest}
                            <button 
                              onClick={() => handleRemoveInterest(interest)}
                              className="btn btn-ghost btn-xs btn-circle"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user?.interests?.length > 0 ? (
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-base-200 rounded-lg p-4 text-center transition-all hover:bg-base-300/50">
                    <p className="text-2xl font-bold text-indigo-300">{accountStats.chats}</p>
                    <p className="text-sm opacity-70">Chats</p>
                  </div>
                  <div className="bg-base-200 rounded-lg p-4 text-center transition-all hover:bg-base-300/50">
                    <p className="text-2xl font-bold text-indigo-300">{accountStats.events}</p>
                    <p className="text-sm opacity-70">Events Joined</p>
                  </div>
                  <div className="bg-base-200 rounded-lg p-4 text-center transition-all hover:bg-base-300/50">
                    <p className="text-2xl font-bold text-indigo-300">{accountStats.connections}</p>
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