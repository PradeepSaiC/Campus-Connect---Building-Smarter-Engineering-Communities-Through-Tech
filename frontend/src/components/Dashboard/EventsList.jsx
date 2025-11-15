import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore.js';

import { eventAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import { 
  Calendar, 
  Clock, 
  Users, 
  Play, 
  Building,
  Filter,
  Search
} from 'lucide-react';
import socketService from '../../services/socket.js';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    const s = socketService.socket;
    if (!s) return;
    const refresh = () => fetchEvents();
    s.on('event_created', refresh);
    s.on('event_updated', refresh);
    s.on('event_deleted', refresh);
    s.on('event_live_started', refresh);
    s.on('event_live_stopped', refresh);
    return () => {
      s.off('event_created', refresh);
      s.off('event_updated', refresh);
      s.off('event_deleted', refresh);
      s.off('event_live_started', refresh);
      s.off('event_live_stopped', refresh);
    };
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') {
        params.type = filter;
      }
      if (searchQuery && searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const { data } = await eventAPI.getAll(params);
      // Sort: live first, then by nearest date
      const list = Array.isArray(data) ? data.slice() : [];
      list.sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return new Date(a.date) - new Date(b.date);
      });
      setEvents(list);
    } catch (e) {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinEvent = async (eventId) => {
    try {
      await eventAPI.join(eventId);
      toast.success('🎉 Successfully joined the event!');
      fetchEvents(); // Refresh to update participant count
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to join event';
      toast.error(`❌ ${message}`);
    }
  };

  const getEventTypeIcon = (type) => {
    switch (type) {
      case 'webinar':
        return '🎓';
      case 'lecture':
        return '📚';
      case 'cultural':
        return '🎭';
      case 'workshop':
        return '🔧';
      case 'seminar':
        return '💡';
      default:
        return '📅';
    }
  };

  const getEventTypeColor = (type) => {
    switch (type) {
      case 'webinar':
        return 'bg-blue-100 text-blue-700';
      case 'lecture':
        return 'bg-green-100 text-green-700';
      case 'cultural':
        return 'bg-purple-100 text-purple-700';
      case 'workshop':
        return 'bg-orange-100 text-orange-700';
      case 'seminar':
        return 'bg-indigo-100 text-indigo-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
        <span className="ml-2 text-gray-600">Loading events...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="opacity-70 mt-1">
            Join live-streamed events from colleges across the network
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-600">{events.length}</p>
          <p className="text-sm opacity-70">Upcoming Events</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-50" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-bordered w-full pl-10"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 opacity-60" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="select select-bordered select-sm"
            >
              <option value="all">All Types</option>
              <option value="webinar">Webinars</option>
              <option value="lecture">Lectures</option>
              <option value="cultural">Cultural</option>
              <option value="workshop">Workshops</option>
              <option value="seminar">Seminars</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvents.length === 0 ? (
          <div className="col-span-full text-center py-12 opacity-70">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p>No events found</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event._id}
              className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
            >
              {/* Thumbnail */}
              {event.thumbnail && (
                <div className="w-full h-40 bg-base-300 overflow-hidden">
                  <img src={event.thumbnail} alt={event.title} className="w-full h-full object-cover" />
                </div>
              )}

              {/* Event Header */}
              <div className="p-6 border-b border-base-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getEventTypeIcon(event.type)}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full bg-indigo-500/20 text-indigo-300`}>
                      {event.type}
                    </span>
                  </div>
                  {event.isLive && (
                    <div className="flex items-center space-x-1 bg-red-500/20 text-red-300 px-2 py-1 rounded-full">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium">LIVE</span>
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold mb-2 line-clamp-2">
                  {event.title}
                </h3>
                
                <p className="text-sm opacity-80 line-clamp-3">
                  {event.description}
                </p>
              </div>

              {/* Event Details */}
              <div className="p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <Building className="w-4 h-4 opacity-60" />
                  <span className="text-sm opacity-70">{event.hostName}</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 opacity-60" />
                  <span className="text-sm opacity-70">
                    {formatDate(event.date)}
                  </span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Clock className="w-4 h-4 opacity-60" />
                  <span className="text-sm opacity-70">
                    {event.startTime && event.endTime
                      ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)} (${event.duration} min)`
                      : `${formatTime(event.date)} • ${event.duration} min`}
                  </span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Users className="w-4 h-4 opacity-60" />
                  <span className="text-sm opacity-70">
                    {event.currentParticipants}/{event.maxParticipants} participants
                  </span>
                </div>

                {/* Tags */}
                {event.tags && event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {event.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-base-300 text-base-content/70 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {event.tags.length > 3 && (
                      <span className="px-2 py-1 bg-base-300 text-base-content/70 text-xs rounded-full">
                        +{event.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  {event.isLive && event.streamUrl ? (
                    <button onClick={() => window.open(event.streamUrl, '_blank')} className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 btn btn-error">
                      <Play className="w-4 h-4" />
                      <span>Join Live</span>
                    </button>
                  ) : event.registrationUrl ? (
                    <a
                      href={event.registrationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 btn btn-primary text-center"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Register</span>
                    </a>
                  ) : (
                    (() => {
                      const myId = user?.id || user?._id;
                      const alreadyJoined = Array.isArray(event.participants) && event.participants.some(p => String(p) === String(myId));
                      const isFull = event.currentParticipants >= event.maxParticipants;
                      return (
                        <button
                          onClick={() => handleJoinEvent(event._id)}
                          disabled={isFull || alreadyJoined}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Calendar className="w-4 h-4" />
                          <span>
                            {alreadyJoined ? 'Joined' : isFull ? 'Full' : 'Join Event'}
                          </span>
                        </button>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EventsList; 