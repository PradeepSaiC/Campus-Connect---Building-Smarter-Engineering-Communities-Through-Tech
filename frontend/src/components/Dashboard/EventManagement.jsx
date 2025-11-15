import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import { eventAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import { Plus, Calendar, Users, Video, Edit, Trash2, Eye, Play, Square, Link as LinkIcon } from 'lucide-react';
import CreateEventModal from './CreateEventModal.jsx';
import socketService from '../../services/socket.js';

const EventManagement = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  // auto-extension timer id
  const [extendTimerId, setExtendTimerId] = useState(null);
  // suppress list refresh window to prevent flicker just after start live
  const [suppressRefreshUntil, setSuppressRefreshUntil] = useState(0);
  const [starting, setStarting] = useState(false);
  // tick to trigger periodic re-render so time-based tags auto-update
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Periodic tick to refresh time-based status badges without network calls
  useEffect(() => {
    const id = setInterval(() => {
      setNowTick((t) => t + 1);
    }, 30000); // update every 30s
    return () => { if (id) clearInterval(id); };
  }, []);

  // Real-time refresh on event changes via Socket.IO (debounced, silent, and skipped while modal open)
  useEffect(() => {
    const s = socketService.socket;
    if (!s) return;
    let timer = null;
    const refreshSilentDebounced = () => {
      // avoid flicker while details modal is open or during suppression window
      if (selectedEvent) return;
      if (Date.now() < suppressRefreshUntil) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetchEvents(true);
      }, 250);
    };
    s.on('event_created', refreshSilentDebounced);
    s.on('event_updated', refreshSilentDebounced);
    s.on('event_deleted', refreshSilentDebounced);
    s.on('event_live_started', refreshSilentDebounced);
    s.on('event_live_stopped', refreshSilentDebounced);
    return () => {
      if (timer) clearTimeout(timer);
      s.off('event_created', refreshSilentDebounced);
      s.off('event_updated', refreshSilentDebounced);
      s.off('event_deleted', refreshSilentDebounced);
      s.off('event_live_started', refreshSilentDebounced);
      s.off('event_live_stopped', refreshSilentDebounced);
    };
  }, [selectedEvent, suppressRefreshUntil]);

  useEffect(() => {
    // Check if create parameter is in URL
    const urlParams = new URLSearchParams(location.search);
    const createParam = urlParams.get('create');
    if (createParam === 'true') {
      setShowCreateModal(true);
      // Clean up the URL parameter
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('create');
      window.history.replaceState({}, '', newUrl);
    }
  }, [location.search]);

  const fetchEvents = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await eventAPI.getByCollege(user?.id);
      setEvents(response?.data?.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      if (!silent) toast.error('Failed to load events');
      if (!silent) setEvents([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Prompt host 5 minutes before end to extend
  useEffect(() => {
    if (!selectedDetails?.isLive || !selectedDetails?.endTime) {
      if (extendTimerId) clearTimeout(extendTimerId);
      return;
    }
    const end = new Date(selectedDetails.endTime).getTime();
    const fiveMinBefore = end - 5 * 60 * 1000;
    const now = Date.now();
    const delay = Math.max(0, fiveMinBefore - now);
    const id = setTimeout(async () => {
      try {
        const confirmExtend = window.confirm('Event ended. Extend this streaming?');
        if (!confirmExtend) return;
        const choice = window.prompt('Extend by (enter minutes): 15, 30, 60', '15');
        const minutes = parseInt(choice || '0', 10);
        if (!Number.isFinite(minutes) || minutes <= 0) return;
        await eventAPI.extend(selectedDetails._id, minutes);
        toast.success(`Extended by ${minutes} minutes`);
        const { data } = await eventAPI.getOne(selectedDetails._id);
        setSelectedDetails(data);
      } catch (_) {}
    }, delay);
    setExtendTimerId(id);
    return () => { if (id) clearTimeout(id); };
  }, [selectedDetails?.isLive, selectedDetails?.endTime]);

  const handleEventCreated = () => {
    fetchEvents(); // Refresh the list
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await eventAPI.delete(eventId);
      toast.success('🎉 Event deleted successfully!');
      fetchEvents();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete event';
      toast.error(`❌ ${message}`);
    }
  };

  const getEventStatus = (event) => {
    // Always compute fresh from event fields and times so UI updates as time passes
    const colorBy = {
      live: 'bg-red-500/20 text-red-300',
      upcoming: 'bg-indigo-500/20 text-indigo-300',
      completed: 'bg-base-300 text-base-content/70',
    };
    const now = new Date();
    const start = event.startTime ? new Date(event.startTime) : (event.date ? new Date(event.date) : null);
    const end = event.endTime ? new Date(event.endTime) : null;
    let derived = 'upcoming';
    if (event.isCompleted) derived = 'completed';
    else if (event.isLive) derived = 'live';
    else if (start && end && now >= start && now <= end) derived = 'live';
    else if (end && now > end) derived = 'completed';
    else derived = 'upcoming';
    return { status: derived, color: colorBy[derived] };
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openDetails = async (ev) => {
    try {
      setSelectedEvent(ev);
      const { data } = await eventAPI.getOne(ev._id);
      setSelectedDetails(data);
    } catch (e) {
      setSelectedDetails(ev);
    }
  };

  const isHost = (ev) => {
    try { return String(ev?.host?._id || ev?.host || '') === String(user?.id); } catch (_) { return false; }
  };

  const startLive = async () => {
    try {
      setStarting(true);
      const { data } = await eventAPI.setLive(selectedEvent._id, { action: 'start' });
      toast.success('Event is now live');
      // Optimistically update modal without refetch to avoid flicker; socket will refresh list
      setSelectedDetails(prev => ({ ...(prev || {}), isLive: true }));
      // Suppress silent socket refresh for ~5s to let controls render without flicker
      setSuppressRefreshUntil(Date.now() + 5000);
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to start live';
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const stopLive = async () => {
    try {
      await eventAPI.setLive(selectedEvent._id, { action: 'stop' });
      toast.success('Live stream stopped');
      // Event is deleted on stop; close modal and let socket refresh the list
      setSelectedEvent(null);
      setSelectedDetails(null);
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to stop live';
      toast.error(msg);
    }
  };

  const stopLiveById = async (ev) => {
    if (!ev?._id) return;
    if (!confirm('Stop this live stream? This will end and delete the event.')) return;
    try {
      await eventAPI.setLive(ev._id, { action: 'stop' });
      toast.success('Live stream stopped');
      // socket will refresh list; do a silent refresh as well
      fetchEvents(true);
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to stop live';
      toast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Event Management</h1>
          <p className="opacity-70 mt-1">
            Create and manage live events, webinars, and guest lectures
          </p>
        </div>

        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-12 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-base-300 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-4 bg-base-300 rounded w-1/2 mx-auto mb-4"></div>
            <div className="h-4 bg-base-300 rounded w-3/4 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Event Management</h1>
          <p className="opacity-70 mt-1">
            Create and manage live events, webinars, and guest lectures
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Event</span>
        </button>
      </div>

      {events.length === 0 ? (
        null
      ) : (
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Your Events</h3>
            <div className="text-sm opacity-70">
              Total: {events.length} events
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, index) => {
              const eventStatus = getEventStatus(event);
              return (
                <div key={index} className="border border-base-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 bg-base-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-base-300 rounded-lg flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-medium">{event.title}</h4>
                        <p className="text-xs opacity-70">{event.type}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${eventStatus.color}`}>
                      {eventStatus.status}
                    </span>
                  </div>

                  <p className="text-sm opacity-80 mb-3 line-clamp-2">
                    {event.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-xs opacity-70">
                      <Calendar className="w-3 h-3 mr-1" />
                      {event.startTime ? formatDate(event.startTime) : formatDate(event.date)}
                      {event.endTime && (
                        <>
                          <span className="mx-1">–</span>
                          {formatDate(event.endTime)}
                        </>
                      )}
                    </div>
                    <div className="flex items-center text-xs opacity-70">
                      <Users className="w-3 h-3 mr-1" />
                      {event.participants?.length || 0} participants
                    </div>
                    {eventStatus.status === 'live' && (
                      <div className="flex items-center text-xs text-red-300">
                        <Video className="w-3 h-3 mr-1" />
                        Live Stream
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openDetails(event)}
                      className="flex-1 text-xs flex items-center justify-center btn btn-ghost"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View Details
                    </button>
                    {/* Removed admin-facing live view and stop live buttons */}
                    <button
                      onClick={() => handleDeleteEvent(event._id)}
                      className="text-xs p-1 btn btn-ghost"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleEventCreated}
      />

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-base-200">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-base-300 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold">Event Details</h2>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 hover:bg-base-200 rounded-lg transition-colors duration-200"
              >
                <Plus className="w-5 h-5 opacity-60 rotate-45" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">{(selectedDetails || selectedEvent)?.title}</h3>
                <p className="text-sm opacity-80">{(selectedDetails || selectedEvent)?.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Type</p>
                  <p className="text-sm opacity-70">{(selectedDetails || selectedEvent)?.type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Date & Time</p>
                  <p className="text-sm opacity-70">{formatDate((selectedDetails || selectedEvent)?.date)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Host</p>
                  <p className="text-sm opacity-70">{(selectedDetails?.hostName) || (selectedDetails?.host?.collegeName) || selectedEvent.hostName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Participants</p>
                  <p className="text-sm opacity-70">{(selectedDetails?.participants?.length) ?? (selectedEvent.participants?.length || 0)}</p>
                </div>
              </div>

              {/* Host controls for live stream */}
              {isHost(selectedDetails || selectedEvent) && (
                <div className="border border-base-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Video className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium">Live Stream Controls</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(selectedDetails?.isLive) ? (
                      <button onClick={stopLive} className="px-3 py-2 btn btn-ghost flex items-center gap-1"><Square className="w-4 h-4" /> Stop Live</button>
                    ) : (
                      (() => {
                        const finished = Boolean((selectedDetails?.isCompleted) || (selectedDetails?.endTime && new Date(selectedDetails.endTime) < new Date()));
                        if (finished) {
                          return (
                            <div className="px-3 py-2 rounded-lg bg-base-200 text-sm opacity-80">Event has been finished</div>
                          );
                        }
                        return (
                          <button disabled={starting} onClick={startLive} className={`px-3 py-2 btn btn-error flex items-center gap-1 ${starting ? 'btn-disabled cursor-not-allowed' : ''}`}><Play className="w-4 h-4" /> {starting ? 'Starting...' : 'Start Live'}</button>
                        );
                      })()
                    )}
                    {(selectedDetails?.isLive) && (
                      <button
                        onClick={() => {
                          const id = (selectedDetails || selectedEvent)?._id;
                          if (id) {
                            window.open(`/live/${id}?host=1`, '_blank');
                          }
                          // Close details modal immediately to avoid flicker
                          setSelectedEvent(null);
                          setSelectedDetails(null);
                        }}
                        className="px-3 py-2 btn btn-primary"
                      >
                        Open Host Studio
                      </button>
                    )}
                  </div>
                  <p className="text-xs opacity-70">After starting, click "Open Host Studio" to broadcast from your camera/mic. For webinars, registered students receive the link by email automatically.</p>
                </div>
              )}

              {/* Participants list */}
              {(selectedDetails?.participants?.length > 0) && (
                <div className="border border-base-200 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Registered Students</p>
                  <ul className="text-sm list-disc list-inside space-y-1 opacity-80">
                    {selectedDetails.participants.map(p => (
                      <li key={p._id}>{p.name} ({p.usn})</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Removed admin-facing audience live view button */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManagement;