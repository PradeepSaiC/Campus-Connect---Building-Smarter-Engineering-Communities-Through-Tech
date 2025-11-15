import { useState } from 'react';
import { X, Calendar, User, FileText, Video, Clock } from 'lucide-react';
import { eventAPI, uploadAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';

// Must match backend enum (event.schema.js): ['webinar','lecture','cultural','workshop','seminar']
const EVENT_TYPES = [
  'Webinar',
  'Lecture',
  'Workshop',
  'Seminar',
  'Cultural'
];

const CreateEventModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    date: '',
    startTimeLocal: '',
    host: '',
    duration: '',
    maxParticipants: '',
    location: '',
    requirements: '',
    registrationUrl: ''
  });
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Build start and end Date from local date + time inputs
      const startIso = formData.date && formData.startTimeLocal ? new Date(`${formData.date}T${formData.startTimeLocal}`).toISOString() : '';
      
      // Map UI type labels to backend enum values
      const typeMap = {
        'Webinar': 'webinar',
        'Lecture': 'lecture',
        'Workshop': 'workshop',
        'Seminar': 'seminar',
        'Cultural': 'cultural',
        'Cultural Event': 'cultural'
      };
      const mappedType = typeMap[formData.type] || formData.type;

      const eventData = {
        title: formData.title,
        description: formData.description,
        type: mappedType,
        // Send start and end time explicitly; backend sets date=startTime
        ...(startIso ? { startTime: startIso, date: startIso } : {}),
        // duration required; backend will compute endTime from start+duration
        duration: parseInt(formData.duration, 10),
        ...(formData.maxParticipants ? { maxParticipants: parseInt(formData.maxParticipants, 10) } : {}),
        ...(formData.registrationUrl ? { registrationUrl: formData.registrationUrl } : {}),
        // backend derives host and hostName; extra fields like location/requirements are not part of schema
      };

      // Optional thumbnail upload
      if (thumbnailFile) {
        try {
          const { data } = await uploadAPI.uploadFile(thumbnailFile);
          if (data?.url) {
            eventData.thumbnail = data.url;
          }
        } catch (uploadErr) {
          console.error('Thumbnail upload failed', uploadErr);
          toast.error('Failed to upload image');
        }
      }

      await eventAPI.create(eventData);
      toast.success('🎉 Event created successfully!');
      onSuccess();
      // Refresh overview if available
      if (window.refreshOverview) {
        window.refreshOverview();
      }
      onClose();
      resetForm();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create event';
      toast.error(`❌ ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: '',
      date: '',
      startTimeLocal: '',
      host: '',
      duration: '',
      maxParticipants: '',
      location: '',
      requirements: '',
      registrationUrl: ''
    });
    setThumbnailFile(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Event</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Event Title *
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={formData.title}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g., Introduction to AI"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                Event Type *
              </label>
              <select
                id="type"
                name="type"
                required
                value={formData.type}
                onChange={handleChange}
                className="input-field"
              >
                <option value="">Select event type</option>
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              required
              value={formData.description}
              onChange={handleChange}
              className="input-field resize-none"
              rows={4}
              placeholder="Describe your event, what participants can expect, and any important details..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="date"
                  name="date"
                  type="date"
                  required
                  value={formData.date}
                  onChange={handleChange}
                  className="input-field pl-10"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div>
              <label htmlFor="startTimeLocal" className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="startTimeLocal"
                  name="startTimeLocal"
                  type="time"
                  required
                  value={formData.startTimeLocal}
                  onChange={handleChange}
                  className="input-field pl-10"
                />
              </div>
            </div>
          </div>

          {/* End time removed; endTime is derived from start time + duration */}

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes) *
            </label>
            <input
              id="duration"
              name="duration"
              type="number"
              min="1"
              value={formData.duration}
              onChange={handleChange}
              className="input-field"
              placeholder="60"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-2">
                Host/Speaker *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="host"
                  name="host"
                  type="text"
                  required
                  value={formData.host}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="e.g., Dr. John Smith"
                />
              </div>
            </div>

            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700 mb-2">
                Max Participants
              </label>
              <input
                id="maxParticipants"
                name="maxParticipants"
                type="number"
                min="1"
                value={formData.maxParticipants}
                onChange={handleChange}
                className="input-field"
                placeholder="0 (unlimited)"
              />
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
              Location/Venue
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={formData.location}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g., Main Auditorium, Room 101, or Online"
            />
          </div>

          <div>
            <label htmlFor="requirements" className="block text-sm font-medium text-gray-700 mb-2">
              Requirements/Prerequisites
            </label>
            <textarea
              id="requirements"
              name="requirements"
              value={formData.requirements}
              onChange={handleChange}
              className="input-field resize-none"
              rows={3}
              placeholder="Any prerequisites, materials needed, or special requirements for participants..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="registrationUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Registration URL (optional)
              </label>
              <input
                id="registrationUrl"
                name="registrationUrl"
                type="url"
                value={formData.registrationUrl}
                onChange={handleChange}
                className="input-field"
                placeholder="https://example.com/register"
              />
            </div>
            <div>
              <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700 mb-2">
                Event Image (optional)
              </label>
              <input
                id="thumbnail"
                name="thumbnail"
                type="file"
                accept="image/*"
                onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-700"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="spinner mr-2"></div>
                  Creating...
                </>
              ) : (
                'Create Event'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEventModal; 