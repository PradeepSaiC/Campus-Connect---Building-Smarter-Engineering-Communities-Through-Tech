import { useState, useEffect, useRef } from 'react';
import { Phone, Video, PhoneOff } from 'lucide-react';
import VideoCallModal from './VideoCallModal.jsx';
import LiveStreamModal from './LiveStreamModal.jsx';
import videoCallAPI from '../../services/videoCallAPI.js';
import { toast } from 'react-hot-toast';
import notify from '../../services/notify.js';
import useAuthStore from '../../store/authStore.js';
import socketService from '../../services/socket.js';

const VideoCallManager = () => {
  const { user, token } = useAuthStore();
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  // Removed call history state per requirement
  const [actionBusy, setActionBusy] = useState(false);
  const handlersAttachedRef = useRef(false);
  const ringtoneRef = useRef({ ctx: null, osc: null, gain: null, timer: null });

  useEffect(() => {
    return () => {
      stopRingtone();
    };
  }, []);

  const startRingtone = () => {
    try {
      // Stop any existing ringtone first
      stopRingtone();
      
      // Use Web Audio API to create a pleasant ringtone
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Create a pleasant two-tone ring
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(800, ctx.currentTime);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1000, ctx.currentTime);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      // Gentle volume
      gain.gain.setValueAtTime(0, ctx.currentTime);
      
      // Ring pattern: 0.5s on, 0.5s off, 0.5s on, 1.5s off
      const timer = setInterval(() => {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.setValueAtTime(0, t + 0.5);
        gain.gain.setValueAtTime(0.1, t + 1);
        gain.gain.setValueAtTime(0, t + 1.5);
      }, 3000);
      
      osc1.start();
      osc2.start();
      const stopTimer = setTimeout(() => {
        stopRingtone();
      }, 45000);
      ringtoneRef.current = { ctx, osc1, osc2, gain, timer, stopTimer };
    } catch (error) {
      console.warn('Could not start ringtone:', error);
    }
  };

  const stopRingtone = () => {
    const r = ringtoneRef.current;
    try {
      if (r?.timer) clearInterval(r.timer);
      if (r?.stopTimer) clearTimeout(r.stopTimer);
      if (r?.osc1) r.osc1.stop();
      if (r?.osc2) r.osc2.stop();
      if (r?.ctx) r.ctx.close();
    } catch (error) {
      console.warn('Error stopping ringtone:', error);
    }
    ringtoneRef.current = { ctx: null, osc1: null, osc2: null, gain: null, timer: null, stopTimer: null };
  };

  useEffect(() => {
    // Ensure shared socket is connected and authenticated
    if (token) {
      socketService.connect(token);
    }

    // Ask for desktop notification permission early (non-blocking)
    try { if ('Notification' in window && Notification.permission === 'default') { Notification.requestPermission(); } } catch (_) {}

    const attachHandlers = () => {
      const s = socketService.socket;
      if (!s || handlersAttachedRef.current) return;
      handlersAttachedRef.current = true;
      s.on('incoming_call', async (data) => {
        const me = useAuthStore.getState().user;
        const myId = String(me?._id || me?.id || '');
        const rcvId = String(data?.receiverId || '');
        if (!rcvId || rcvId !== myId) {
          return;
        }
        handleIncomingCall(data);
      });
      s.on('call_accepted', (data) => { handleCallAccepted(data); });
      s.on('call_rejected', (data) => { handleCallRejected(data); });
      s.on('call_ended', (data) => { handleCallEnded(data); });
    };

    // Attach immediately if already connected
    if (socketService.isSocketConnected()) {
      attachHandlers();
    }
    // Also attach on future connect events
    const s0 = socketService.socket;
    if (s0) {
      s0.on('connect', attachHandlers);
    }

    return () => {
      const s2 = socketService.socket;
      if (s2) {
        s2.off('incoming_call');
        s2.off('call_accepted');
        s2.off('call_rejected');
        s2.off('call_ended');
        s2.off('connect', attachHandlers);
      }
      handlersAttachedRef.current = false;
    };
  }, [token]);

  useEffect(() => {
    const openHandler = (e) => {
      const data = e.detail;
      if (!data) return;
      // Caller opens ringing UI immediately
      setActiveCall({ ...data, isRinging: true, isCaller: true });
      setIncomingCall(null);
      // Do NOT play ringtone for caller
    };
    window.addEventListener('open_video_call', openHandler);
    return () => window.removeEventListener('open_video_call', openHandler);
  }, []);

  // Removed call history loading effect

  const handleIncomingCall = (callData) => {
    // Small popup instead of full modal; accept opens new tab
    const { user } = useAuthStore.getState();
    const me = { id: user?.id, name: user?.name, usn: user?.usn };
    const data = { ...callData, receiver: me };
    setIncomingCall(data);
    startRingtone();
    const callerName = callData?.sender?.name 
      || callData?.caller?.name 
      || callData?.from?.name 
      || callData?.initiator?.name 
      || callData?.senderName 
      || 'Caller';
    toast.custom(
      (t) => (
        <div className="pointer-events-auto bg-white text-gray-900 p-4 rounded-lg shadow-lg flex items-center gap-3 border border-gray-200 min-w-[300px]">
          <div className="flex-1">
            <div className="text-base font-semibold">Incoming call</div>
            <div className="text-sm text-gray-600">From {callerName}</div>
          </div>
          <button onClick={async () => { await handleAcceptCall(data); try { toast.dismiss(t.id); } catch (_) {} }} className="px-3 py-2 bg-green-600 text-white rounded text-sm">Accept</button>
          <button onClick={async () => { await handleRejectCall(data); try { toast.dismiss(t.id); } catch (_) {} }} className="px-3 py-2 bg-red-600 text-white rounded text-sm">Reject</button>
        </div>
      ),
      { id: `incoming_${callData?.callId || ''}`, duration: 12000, position: 'top-right' }
    );
  };

  const handleCallAccepted = async (callData) => {
    const data = { ...callData };
    if (!data.token || !data.channelName) {
      console.error('Missing token/channelName in call_accepted payload');
      toast.error('Call accepted but missing credentials');
      return;
    }
    stopRingtone();
    try {
      const me = useAuthStore.getState().user;
      const myId = String(me?._id || me?.id || '');
      const senderId = String(data?.sender?._id || data?.senderId || '');
      // Only the caller auto-opens here; receiver already opened via Accept button
      if (myId && senderId && myId === senderId) {
        if (data?.callId) {
          const q = new URLSearchParams({
            caller: '1',
            channel: data.channelName || '',
            token: data.token || ''
          });
          window.open(`/call/${data.callId}?${q.toString()}`, '_blank');
        }
      }
    } catch (_) {}
    setActiveCall(null);
    setIncomingCall(null);
    notify.success('Call connected!', { key: `call_connected_${callData?.callId || ''}`, ttlMs: 2000 });
  };

  const handleCallRejected = (callData) => {
    stopRingtone();
    setActiveCall(null);
    setIncomingCall(null);
    notify.info('Call rejected', { key: `call_rejected_${callData?.callId || ''}`, ttlMs: 2500 });
  };

  const handleCallEnded = (callData) => {
    stopRingtone();
    setActiveCall(null);
    setIncomingCall(null);
    notify.info(`Call ended. Duration: ${formatDuration(callData.duration)}`, { key: `call_ended_${callData?.callId || ''}`, ttlMs: 3000 });
  };

  const handleAcceptCall = async (callData) => {
    if (!callData?.callId) {
      console.error('VCM: No callId provided in callData:', callData);
      notify.error('Invalid call data', { key: 'invalid_call_data', ttlMs: 2000 });
      return;
    }
    try {
      const me = useAuthStore.getState().user;
      const myId = String(me?._id || me?.id || '');
      const intended = String(callData?.receiver?.id || callData?.receiverId || '');
      if (!intended || intended !== myId) {
        notify.error('Only the receiver can accept this call', { key: 'not_receiver', ttlMs: 2000 });
        return;
      }
    } catch (_) {}
    
    try {
      // Under user gesture: trigger permission prompt early for better reliability
      try {
        if (navigator?.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          stream.getTracks().forEach(t => t.stop());
        }
      } catch (_) {}
      const response = await videoCallAPI.acceptCall(callData.callId);
      stopRingtone();
      setIncomingCall(null);
      // Open Call Studio immediately; pass credentials to avoid polling lag
      try { 
        const q = new URLSearchParams({
          accept: '1',
          channel: response?.data?.channelName || callData.channelName || '',
          token: response?.data?.token || ''
        });
        window.open(`/call/${callData.callId}?${q.toString()}`, '_blank'); 
      } catch (_) {}
      setActiveCall(null);
      notify.success('Call accepted! Opening call...', { key: `call_accepted_${callData.callId}`, ttlMs: 2000 });
    } catch (error) {
      console.error('VCM: accept error', { status: error?.response?.status, data: error?.response?.data });
      notify.error('Failed to accept call', { key: 'accept_failed', ttlMs: 2500 });
    }
  };

  const handleAcceptStream = async (callData) => {
    if (actionBusy || activeCall) return;
    try {
      setActionBusy(true);
      setIncomingCall(null);
      const response = await videoCallAPI.joinStream(callData.callId);
      setActiveCall({
        ...callData,
        token: response.data.token,
        channelName: response.data.channelName || callData.channelName,
        isViewer: true
      });
      setIncomingCall(null);
    } catch (error) {
      console.error('VCM: join stream error', { status: error?.response?.status, data: error?.response?.data });
      notify.error('Failed to join stream', { key: 'join_stream_failed', ttlMs: 2500 });
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectCall = async (callData) => {
    try {
      await videoCallAPI.rejectCall(callData.callId);
      stopRingtone();
      setActiveCall(null);
      setIncomingCall(null);
      notify.info('Call rejected', { key: `call_rejected_${callData?.callId || ''}`, ttlMs: 2000 });
    } catch (error) {
      console.error('VCM: reject error', { status: error?.response?.status, data: error?.response?.data });
      notify.error('Failed to reject call', { key: 'reject_failed', ttlMs: 2500 });
      // Still clear the call state even if API fails
      stopRingtone();
      setActiveCall(null);
      setIncomingCall(null);
    }
  };

  // Removed call history loader

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Removed formatDate (used only for history)

  // Removed history helpers

  return null;
};

export default VideoCallManager;