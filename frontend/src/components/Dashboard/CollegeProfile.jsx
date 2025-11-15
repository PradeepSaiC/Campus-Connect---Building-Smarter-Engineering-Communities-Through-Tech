import { useState, useEffect } from 'react';
import { Building, Save, AlertCircle, Upload, X, Camera } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { toast } from 'react-hot-toast';

const CollegeProfile = () => {
  const { user, updateUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formData, setFormData] = useState({
    collegeName: '',
    adminName: '',
    adminEmail: '',
    collegeAddress: '',
    collegeType: 'Private',
    collegeVision: '',
    collegeLink: '',
    collegeLogo: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormData({
        collegeName: user.collegeName || '',
        adminName: user.adminName || '',
        adminEmail: user.adminEmail || '',
        collegeAddress: user.collegeAddress || '',
        collegeType: user.collegeType || 'Private',
        collegeVision: user.collegeVision || '',
        collegeLink: user.collegeLink || '',
        collegeLogo: user.collegeLogo || ''
      });
    }
  }, [user]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.collegeName.trim()) {
      newErrors.collegeName = 'College name is required';
    }

    if (!formData.adminName.trim()) {
      newErrors.adminName = 'Admin name is required';
    }

    if (!formData.adminEmail.trim()) {
      newErrors.adminEmail = 'Admin email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.adminEmail)) {
      newErrors.adminEmail = 'Please enter a valid email address';
    }

    if (!formData.collegeAddress.trim()) {
      newErrors.collegeAddress = 'College address is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/college/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth')).state.token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('🎉 Profile updated successfully!');
        updateUser(result.college);
        setIsEditing(false);
      } else {
        throw new Error(result.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(`❌ ${error.message || 'Failed to update profile'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('❌ File size must be less than 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
        },
        body: formData
      });

      const ct = response.headers.get('content-type') || '';
      let result;
      if (ct.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || 'Upload failed (non-JSON response)');
      }

      if (response.ok && result?.url) {
        setFormData(prev => ({
          ...prev,
          collegeLogo: result.url
        }));
        toast.success('🎉 Logo uploaded successfully!');
      } else {
        throw new Error(result?.message || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(`❌ ${error.message || 'Failed to upload logo'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">College Profile</h1>
          <p className="opacity-70 mt-1 hidden sm:block">
            Manage your college information and settings
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Building className="w-4 h-4" />
            <span>Edit Profile</span>
          </button>
        )}
      </div>
      
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* College Logo */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="w-24 h-24 bg-base-200 rounded-lg flex items-center justify-center overflow-hidden">
                {formData.collegeLogo ? (
                  <img 
                    src={formData.collegeLogo} 
                    alt="College Logo" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building className="w-12 h-12 opacity-60" />
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="loading loading-spinner loading-sm text-white" />
                  </div>
                )}
              </div>
              {/* Hidden input (shared by both labels) */}
              <input
                id="collegeLogoInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('❌ File size must be < 5MB');
                    return;
                  }
                  const fd = new FormData();
                  fd.append('file', file);
                  try {
                    setUploadingLogo(true);
                    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/upload`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
                      },
                      body: fd
                    });
                    const ct = response.headers.get('content-type') || '';
                    let result;
                    if (ct.includes('application/json')) {
                      result = await response.json();
                    } else {
                      const text = await response.text();
                      throw new Error(text || 'Upload failed (non-JSON response)');
                    }
                    if (!response.ok || !result?.url) throw new Error(result?.message || 'Failed to upload logo');
                    // Update local state
                    setFormData(prev => ({ ...prev, collegeLogo: result.url }));
                    // Persist immediately
                    try {
                      const save = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/college/profile`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
                        },
                        body: JSON.stringify({ ...formData, collegeLogo: result.url })
                      });
                      const saveJson = await save.json().catch(() => ({}));
                      if (!save.ok) throw new Error(saveJson?.message || 'Failed to save logo');
                      // Update auth store with latest college logo
                      updateUser({ ...user, collegeLogo: result.url });
                    } catch (err2) {
                      updateUser({ ...user, collegeLogo: result.url });
                    }
                    toast.success('🎉 Logo uploaded successfully!');
                  } catch (error) {
                    console.error('Error uploading logo:', error);
                    toast.error(`❌ ${error.message || 'Failed to upload logo'}`);
                  } finally {
                    setUploadingLogo(false);
                  }
                }}
              />
              {/* Make the entire logo area clickable without visual overlay */}
              <label htmlFor="collegeLogoInput" title="Change logo" className="absolute inset-0 cursor-pointer"></label>
              {/* Refined camera button */}
              <label
                htmlFor="collegeLogoInput"
                title="Change logo"
                className="absolute -bottom-2 -right-2 w-9 h-9 btn btn-outline btn-circle btn-xs min-h-0 p-0 cursor-pointer shadow ring-1 ring-base-300 hover:ring-indigo-400/40 bg-base-100/80 backdrop-blur"
              >
                <Camera className="w-4 h-4" />
              </label>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-base-content">{formData.collegeName}</h3>
              <p className="text-sm text-base-content">{formData.collegeType} College</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* College Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                College Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="collegeName"
                value={formData.collegeName}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`input input-bordered w-full ${errors.collegeName ? 'input-error' : ''}`}
                placeholder="Enter college name"
              />
              {errors.collegeName && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.collegeName}
                </p>
              )}
            </div>

            {/* College Type */}
            <div>
              <label className="block text-sm font-medium mb-2">
                College Type
              </label>
              <select
                name="collegeType"
                value={formData.collegeType}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`select select-bordered w-full`}
              >
                <option value="Private">Private</option>
                <option value="Public">Public</option>
              </select>
            </div>

            {/* Admin Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Admin Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="adminName"
                value={formData.adminName}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`input input-bordered w-full ${errors.adminName ? 'input-error' : ''}`}
                placeholder="Enter admin name"
              />
              {errors.adminName && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.adminName}
                </p>
              )}
            </div>

            {/* Admin Email */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="adminEmail"
                value={formData.adminEmail}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`input input-bordered w-full ${errors.adminEmail ? 'input-error' : ''}`}
                placeholder="Enter admin email"
              />
              {errors.adminEmail && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.adminEmail}
                </p>
              )}
            </div>

            {/* College Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                College Address <span className="text-red-500">*</span>
              </label>
              <textarea
                name="collegeAddress"
                value={formData.collegeAddress}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows="3"
                className={`textarea textarea-bordered w-full ${errors.collegeAddress ? 'textarea-error' : ''}`}
                placeholder="Enter college address"
              />
              {errors.collegeAddress && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.collegeAddress}
                </p>
              )}
            </div>

            {/* College Vision */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                College Vision
              </label>
              <textarea
                name="collegeVision"
                value={formData.collegeVision}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows="4"
                className={`textarea textarea-bordered w-full`}
                placeholder="Enter college vision and mission"
              />
            </div>

            {/* College Website */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                College Website
              </label>
              <input
                type="url"
                name="collegeLink"
                value={formData.collegeLink}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`input input-bordered w-full`}
                placeholder="https://www.college.edu"
              />
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex items-center space-x-3 pt-6 border-t border-base-200">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  // Reset form data to original values
                  setFormData({
                    collegeName: user.collegeName || '',
                    adminName: user.adminName || '',
                    adminEmail: user.adminEmail || '',
                    collegeAddress: user.collegeAddress || '',
                    collegeType: user.collegeType || 'Private',
                    collegeVision: user.collegeVision || '',
                    collegeLink: user.collegeLink || '',
                    collegeLogo: user.collegeLogo || ''
                  });
                  setErrors({});
                }}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default CollegeProfile; 