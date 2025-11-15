import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { eventAPI, pollsAPI } from '../../services/api.js';
import socketService from '../../services/socket.js';
import { toast } from 'react-hot-toast';
import { Mic, MicOff, Video, VideoOff, ArrowLeft } from 'lucide-react';

const LiveStream = () => {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isHost = searchParams.get('host') === '1';

  const [client, setClient] = useState(null);
  const initRef = useRef(false);
  const [connecting, setConnecting] = useState(true);
  const [eventInfo, setEventInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [collegeName, setCollegeName] = useState('');
  const [localTracks, setLocalTracks] = useState({ audio: null, video: null });
  const [prevCamTrack, setPrevCamTrack] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [startingShare, setStartingShare] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [waitingHost, setWaitingHost] = useState(false);
  const [ended, setEnded] = useState(false);
  const [left, setLeft] = useState(false);
  const [joined, setJoined] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const closeTimerRef = useRef(null);
  // Polls state
  const [showPolls, setShowPolls] = useState(false);
  const [polls, setPolls] = useState([]);
  const [unreadPolls, setUnreadPolls] = useState(0);
  const showPollsRef = useRef(false);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState(''); // newline-separated
  const [votedPollIds, setVotedPollIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('votedPolls') || '[]'); } catch (_) { return []; }
  });

  const videoRef = useRef(null);
  // Stable per-tab session id to avoid Agora UID conflicts
  const sessionIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  const lastPlayedTrackIdRef = useRef('');
  const remoteActiveUidRef = useRef('');

  // Helper: clear container and play track with consistent styles to avoid duplicated renders
  const playIntoContainer = (track) => {
    const container = videoRef.current;
    if (!container || !track) return;
    try {
      const mt = track.getMediaStreamTrack?.();
      const tid = mt ? mt.id : '';
      if (tid && lastPlayedTrackIdRef.current === tid) {
        return; // already playing this track; avoid re-render flicker
      }
      lastPlayedTrackIdRef.current = tid;
    } catch (_) {}
    try { container.innerHTML = ''; } catch (_) {}
    try { track.play(container, { mirror: false }); } catch (_) {}
    try {
      const v = container.querySelector('video');
      if (v) {
        v.style.width = '100%';
        v.style.height = '100%';
        v.style.objectFit = 'cover';
        v.style.display = 'block';
        v.style.backgroundColor = 'black';
        // Force no mirror for front camera so left/right are true-to-life
        try { v.classList?.remove?.('agora-video-player--mirror'); } catch (_) {}
        try { v.style.transform = 'none'; v.style.webkitTransform = 'none'; } catch (_) {}
      }
    } catch (_) {}
  };

  useEffect(() => {
    let mounted = true;
    if (initRef.current) return () => {};
    initRef.current = true;
    const join = async (attempt = 0) => {
      try {
        console.log('[LIVE:UI] join() start', { eventId, isHost, attempt });
        setConnecting(true);
        // Load event to decide access model and display info
        const ev = await eventAPI.getOne(eventId);
        console.log('[LIVE:UI] fetched event', ev?.data);
        const eventData = ev?.data;
        setEventInfo(eventData || null);
        // Participants list is disabled to reduce UI churn and flicker
        // Attempt to determine college name
        if (eventData?.hostName) setCollegeName(eventData.hostName);
        const eventType = eventData?.type;
        let isEventLive = eventData?.isLive;
        // If host is starting, request backend to start live first
        if (isHost && !isEventLive) {
          try {
            console.log('[LIVE:UI] requesting start live', { eventId });
            await eventAPI.setLive(eventId, { action: 'start' });
            console.log('[LIVE:UI] start live success', { eventId });
            isEventLive = true;
          } catch (_) {
            console.warn('[LIVE:UI] start live failed or not allowed (will wait)', _?.response?.data || _);
            // If cannot start (e.g., not time yet), keep waiting but do not end
            setConnecting(false);
            setWaitingHost(true);
            return;
          }
        } else if (!isHost && !isEventLive) {
          // Audience view: if not live, either ended or waiting
          const endedNow = Boolean(eventData?.isCompleted) || (eventData?.endTime && new Date(eventData.endTime) <= new Date());
          setConnecting(false);
          if (endedNow) setEnded(true); else setWaitingHost(true);
          return;
        }
        const role = isHost ? 'host' : 'audience';
        let data;
        if (!isHost && eventType === 'cultural') {
          // Public cultural stream
          ({ data } = await eventAPI.getStreamTokenPublic(eventId));
        } else {
          // Host or restricted audience (e.g., webinar)
          ({ data } = await eventAPI.getStreamToken(eventId, role, sessionIdRef.current));
        }
        const c = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' });
        console.log('[LIVE:UI] Agora client created', { role: isHost ? 'host' : 'audience' });
        setClient(c);
        try { await c.setClientRole?.(isHost ? 'host' : 'audience', !isHost ? { level: 1 } : undefined); } catch (_) {}
        // Enable dual stream so audience can subscribe to low-latency low stream
        try { await c.enableDualStream?.(); } catch (_) {}
        // Aggressive low-stream params for latency
        try { await c.setLowStreamParameter?.({ width: 160, height: 90, frameRate: 15, bitrate: 120 }); } catch (_) {}
        // Low-latency speech profile
        try { await c.setAudioProfile?.('speech_low_latency'); } catch (_) {}

        // We will not use Agora-based viewerCount; instead rely on event participants
        c.on('user-published', async (user, mediaType) => {
          console.log('[LIVE:UI] user-published', { uid: String(user.uid || ''), mediaType });
          const uid = String(user.uid || '');
          if (mediaType === 'video') {
            // Only subscribe to and render the first active remote video
            if (remoteActiveUidRef.current && remoteActiveUidRef.current !== uid) {
              console.log('[LIVE:UI] skipping second remote video uid', uid);
              return;
            }
            try { await c.subscribe(user, 'video'); } catch (_) {}
            // Prefer audio-only on poor network
            try { if (!isHost) await c.setStreamFallbackOption?.(user, 2); } catch (_) {}
            // Force low stream for audience
            if (!isHost) { try { await c.setRemoteVideoStreamType?.(user, 1); } catch (_) {} }
            remoteActiveUidRef.current = uid;
            lastPlayedTrackIdRef.current = user.videoTrack?.getTrackId?.() || '';
            if (videoRef.current) {
              playIntoContainer(user.videoTrack);
            }
            setConnecting(false);
            setWaitingHost(false);
            return;
          }
          if (mediaType === 'audio') {
            // Play audio only for the active remote video publisher (if chosen), else ignore
            if (remoteActiveUidRef.current && remoteActiveUidRef.current !== uid) {
              return;
            }
            try { await c.subscribe(user, 'audio'); } catch (_) { return; }
            user.audioTrack?.play();
            setConnecting(false);
            setWaitingHost(false);
            return;
          }
        });
        c.on('user-unpublished', (user, mediaType) => {
          console.log('[LIVE:UI] user-unpublished', { uid: String(user.uid || ''), mediaType });
          if (mediaType === 'video') {
            const uid = String(user.uid || '');
            if (remoteActiveUidRef.current === uid) {
              remoteActiveUidRef.current = '';
              lastPlayedTrackIdRef.current = '';
              try { if (videoRef.current) videoRef.current.innerHTML = ''; } catch (_) {}
              // For audience, switch to waiting overlay rather than black screen
              if (!isHost) {
                setWaitingHost(true);
                setConnecting(false);
              }
            }
          }
        });
        c.on('user-left', (user) => {
          console.log('[LIVE:UI] user-left', { uid: String(user.uid || '') });
          const uid = String(user.uid || '');
          if (remoteActiveUidRef.current === uid) {
            remoteActiveUidRef.current = '';
            lastPlayedTrackIdRef.current = '';
            try { if (videoRef.current) videoRef.current.innerHTML = ''; } catch (_) {}
            // For audience, show waiting overlay after host leaves/unpublishes
            if (!isHost) {
              setWaitingHost(true);
              setConnecting(false);
            }
          }
        });

        console.log('[LIVE:UI] joining channel', { appId: data.appId, channel: data.channelName, account: data.account });
        await c.join(data.appId, data.channelName, data.token, data.account);
        console.log('[LIVE:UI] join success');

        if (isHost) {
          // Try to create microphone; if permission denied, continue with video-only
          let mic = null;
          try { mic = await AgoraRTC.createMicrophoneAudioTrack(); } catch (e) { console.warn('[LIVE:UI] mic track create failed', e); mic = null; }
          // Lower-latency encoder config: 240p @ 24fps, motion optimized
          const cam = await AgoraRTC.createCameraVideoTrack({
            optimizationMode: 'motion',
            encoderConfig: {
              width: 426,
              height: 240,
              frameRate: 24,
              bitrateMin: 280,
              bitrateMax: 700
            },
            cameraId: selectedCameraId || undefined
          });
          if (mic) {
            console.log('[LIVE:UI] publishing mic+cam');
            await c.publish([mic, cam]);
            setLocalTracks({ audio: mic, video: cam });
          } else {
            console.log('[LIVE:UI] publishing cam only');
            await c.publish([cam]);
            setLocalTracks({ audio: null, video: cam });
            setMuted(true);
          }
          if (videoRef.current) {
            playIntoContainer(cam);
          }
          // Host is live immediately after publish
          setConnecting(false);
          setWaitingHost(false);
          console.log('[LIVE:UI] host publish complete');
        } else {
          // Audience: if host not yet published, show waiting state after join
          setWaitingHost(true);
          // Fallback: after 8s, remove spinner but keep waiting message
          setTimeout(() => {
            setConnecting(false);
          }, 8000);
        }
        // Notify server about live viewer presence
        try {
          const s = socketService.socket;
          if (s && !isHost) {
            // ensure socket is authenticated before joining viewer list
            try {
              const token = localStorage.getItem('token');
              if (token) s.emit('authenticate', token);
            } catch (_) {}
            console.log('[LIVE:UI] emit live_viewer_join');
            s.emit('live_viewer_join', { eventId });
          }
        } catch (_) {}
        setJoined(true);
        console.log('[LIVE:UI] joined flag set');
      } catch (e) {
        // If event was deleted or not found, show ended overlay instead of error
        const status = e?.response?.status;
        if (status === 404) {
          console.warn('[LIVE:UI] event not found, marking ended');
          try { if (client) await client.leave(); } catch (_) {}
          try { localTracks.audio?.close?.(); localTracks.video?.close?.(); } catch (_) {}
          setEnded(true);
        } else {
          const msg = String(e?.message || '').toUpperCase();
          if (attempt === 0 && (msg.includes('UID_CONFLICT') || e?.code === 'UID_CONFLICT')) {
            // regenerate session id and retry once after brief delay
            sessionIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            setTimeout(() => join(1), 500);
            return;
          }
          console.error('Live join error', e);
          toast.error('Failed to join live stream');
        }
        setConnecting(false);
      } finally {
        // no-op
      }
    };
    join();
    return () => {
      mounted = false;
      (async () => {
        console.log('[LIVE:UI] cleanup on unmount start');
        try {
          const c = client;
          if (c) { console.log('[LIVE:UI] leaving channel'); await c.leave(); }
          localTracks.audio?.close();
          localTracks.video?.close();
        } catch (_) {}
        try {
          const s = socketService.socket;
          if (s && !isHost) { console.log('[LIVE:UI] emit live_viewer_leave'); s.emit('live_viewer_leave', { eventId }); }
        } catch (_) {}
        console.log('[LIVE:UI] cleanup on unmount complete');
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, isHost]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await AgoraRTC.getCameras();
        if (!mounted) return;
        setCameras(list || []);
        if (!selectedCameraId && list && list[0]) {
          setSelectedCameraId(list[0].deviceId);
        }
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);

  // Listen for server broadcast that the host ended the live
  useEffect(() => {
    const s = socketService.socket;
    if (!s) return () => {};
    const onStopped = async (payload) => {
      try {
        const stoppedId = String(payload?.id || payload?.eventId || '');
        if (stoppedId !== String(eventId)) return;
        // Only audience should switch to waiting on host stop
        if (isHost) return;
        // For audience, go back to waiting state instead of ended overlay
        setWaitingHost(true);
        setConnecting(false);
        setEnded(false);
        try { if (client) await client.leave(); } catch (_) {}
        try { localTracks.audio?.close?.(); localTracks.video?.close?.(); } catch (_) {}
        try { if (videoRef.current) videoRef.current.innerHTML = ''; } catch (_) {}
        // Schedule tab auto-close after rejoin message is shown
        try { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); } catch (_) {}
        closeTimerRef.current = setTimeout(() => {
          try { window.close(); } catch (_) {}
          try { if (window.history.length > 1) navigate(-1); else navigate('/'); } catch (_) {}
        }, 6000);
      } catch (_) {}
    };
    s.on('event_live_stopped', onStopped);
    return () => {
      try { s.off('event_live_stopped', onStopped); } catch (_) {}
    };
  }, [eventId, client, localTracks]);

  // When waitingHost toggles off (stream resumed), cancel any pending close
  useEffect(() => {
    if (!waitingHost) {
      try { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } } catch (_) {}
    }
  }, [waitingHost]);

  // Polls: refresh list while joined & live
  useEffect(() => {
    let id;
    const refresh = async () => {
      if (!eventId) return;
      try {
        const list = await pollsAPI.list(eventId);
        const newList = list?.data || [];
        // If new poll(s) arrived while panel closed, bump unread
        if (!showPollsRef.current && newList.length > (polls?.length || 0)) {
          setUnreadPolls((c) => c + (newList.length - (polls?.length || 0)));
        }
        setPolls(newList);
      } catch (_) {}
    };
    // socket: new poll created
    const s = socketService.socket;
    const onCreated = (payload) => {
      try {
        if (String(payload?.eventId || '') !== String(eventId)) return;
        setPolls((prev) => [payload.poll, ...(prev || [])]);
        if (!showPollsRef.current) {
          setUnreadPolls((c) => c + 1);
          try { console.log('[POLL:UI] new poll arrived', payload?.poll?.question); } catch (_) {}
          try { toast.success('New poll posted'); } catch (_) {}
        }
      } catch (_) {}
    };
    const onDeleted = (payload) => {
      try {
        if (String(payload?.eventId || '') !== String(eventId)) return;
        const pid = String(payload?.pollId || '');
        setPolls((prev) => (prev || []).filter(p => String(p._id) !== pid));
      } catch (_) {}
    };
    try { s?.on('poll_created', onCreated); s?.on('poll_deleted', onDeleted); } catch (_) {}
    id = setInterval(refresh, 7000);
    refresh();
    return () => {
      if (id) clearInterval(id);
      try { s?.off('poll_created', onCreated); s?.off('poll_deleted', onDeleted); } catch (_) {}
    };
  }, [eventId]);

  // Keep a live ref of showPolls for socket callbacks
  useEffect(() => { showPollsRef.current = showPolls; }, [showPolls]);

  const createPoll = async () => {
    if (!pollQuestion.trim()) { toast.error('Enter a question'); return; }
    const opts = pollOptionsText.split('\n').map(s => s.trim()).filter(Boolean);
    if (opts.length < 2) { toast.error('Enter at least 2 options'); return; }
    setCreatingPoll(true);
    try {
      await pollsAPI.create(eventId, pollQuestion.trim(), opts);
      setPollQuestion('');
      setPollOptionsText('');
      const list = await pollsAPI.list(eventId);
      setPolls(list?.data || []);
      toast.success('Poll created');
    } catch (e) {
      toast.error('Failed to create poll');
    } finally { setCreatingPoll(false); }
  };

  const votePoll = async (pollId, optionIndex) => {
    try {
      if (votedPollIds.includes(pollId)) return;
      await pollsAPI.vote(pollId, optionIndex);
      const next = [...votedPollIds, pollId];
      setVotedPollIds(next);
      try { localStorage.setItem('votedPolls', JSON.stringify(next)); } catch (_) {}
      // soft refresh results
      const list = await pollsAPI.list(eventId);
      setPolls(list?.data || []);
    } catch (e) {
      toast.error('Failed to vote');
    }
  };

  const closePoll = async (pollId) => {
    try { await pollsAPI.close(pollId); toast.success('Poll closed');
      const list = await pollsAPI.list(eventId); setPolls(list?.data || []);
    } catch (_) { toast.error('Failed to close poll'); }
  };

  // Helper to join when polling detects stream has started while user is waiting
  const tryJoinAfterStart = async (eventType, attempt = 0) => {
    try {
      if (client || joined || ended) return;
      const role = isHost ? 'host' : 'audience';
      let data;
      if (!isHost && eventType === 'cultural') {
        ({ data } = await eventAPI.getStreamTokenPublic(eventId));
      } else {
        ({ data } = await eventAPI.getStreamToken(eventId, role, sessionIdRef.current));
      }
      const c = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' });
      setClient(c);
      try { await c.setClientRole?.(isHost ? 'host' : 'audience'); } catch (_) {}
      try { await c.enableDualStream?.(); } catch (_) {}
      try { await c.setLowStreamParameter?.({ width: 160, height: 90, frameRate: 15, bitrate: 120 }); } catch (_) {}
      try { await c.setAudioProfile?.('speech_low_latency'); } catch (_) {}
      c.on('user-published', async (user, mediaType) => {
        try { await c.subscribe(user, mediaType); } catch (_) { return; }
        try { if (!isHost) await c.setStreamFallbackOption?.(user, 2); } catch (_) {}
        if (!isHost) { try { await c.setRemoteVideoStreamType?.(user, 1); } catch (_) {} }
        if (mediaType === 'video' && videoRef.current) {
          const uid = String(user.uid || '');
          if (remoteActiveUidRef.current && remoteActiveUidRef.current !== uid) return;
          remoteActiveUidRef.current = uid;
          playIntoContainer(user.videoTrack);
        }
        if (mediaType === 'audio') user.audioTrack?.play();
        setConnecting(false);
        setWaitingHost(false);
      });
      c.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'video') {
          const uid = String(user.uid || '');
          if (remoteActiveUidRef.current === uid) {
            remoteActiveUidRef.current = '';
            lastPlayedTrackIdRef.current = '';
            try { if (videoRef.current) videoRef.current.innerHTML = ''; } catch (_) {}
          }
        }
      });
      c.on('user-left', (user) => {
        const uid = String(user.uid || '');
        if (remoteActiveUidRef.current === uid) {
          remoteActiveUidRef.current = '';
          lastPlayedTrackIdRef.current = '';
          try { if (videoRef.current) videoRef.current.innerHTML = ''; } catch (_) {}
        }
      });
      await c.join(data.appId, data.channelName, data.token, data.account);
      if (isHost) {
        const mic = await AgoraRTC.createMicrophoneAudioTrack();
        const cam = await AgoraRTC.createCameraVideoTrack({
          optimizationMode: 'motion',
          encoderConfig: { width: 426, height: 240, frameRate: 24, bitrateMin: 280, bitrateMax: 700 },
          cameraId: selectedCameraId || undefined
        });
        await c.publish([mic, cam]);
        setLocalTracks({ audio: mic, video: cam });
        if (videoRef.current) playIntoContainer(cam);
        setConnecting(false);
        setWaitingHost(false);
      } else {
        setWaitingHost(true);
        setTimeout(() => { setConnecting(false); }, 8000);
      }
      // ensure presence is registered on retry as well
      try {
        const s = socketService.socket;
        if (s && !isHost) {
          try { const token = localStorage.getItem('token'); if (token) s.emit('authenticate', token); } catch (_) {}
          s.emit('live_viewer_join', { eventId });
        }
      } catch (_) {}
      setJoined(true);
    } catch (e) {
      const msg = String(e?.message || '').toUpperCase();
      if (attempt === 0 && (msg.includes('UID_CONFLICT') || e?.code === 'UID_CONFLICT')) {
        sessionIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        setTimeout(() => tryJoinAfterStart(eventType, 1), 500);
        return;
      }
      /* ignore and retry on next poll */
    }
  };

  // Poll event info only while not joined and not ended, to detect start/end with minimal churn
  useEffect(() => {
    let timerId;
    if (joined || ended) {
      return () => {};
    }
    const poll = async () => {
      try {
        const ev = await eventAPI.getOne(eventId);
        const data = ev?.data || {};
        setEventInfo(data);
        // Participants list disabled: skip updating participants and counts
        if (data?.hostName && !collegeName) setCollegeName(data.hostName);
        // If not live, audience should see waiting state (unless event completed/deleted)
        if (!isHost && data?.isLive === false) {
          const completed = Boolean(data?.isCompleted);
          if (completed && !ended) {
            setWaitingHost(false);
            setConnecting(false);
            setEnded(true);
            try { if (client) await client.leave(); } catch (_) {}
            try { localTracks.audio?.close?.(); localTracks.video?.close?.(); } catch (_) {}
          } else {
            setEnded(false);
            setConnecting(false);
            setWaitingHost(true);
            try { if (client) await client.leave(); } catch (_) {}
            try { localTracks.audio?.close?.(); localTracks.video?.close?.(); } catch (_) {}
            try { if (videoRef.current) videoRef.current.innerHTML = ''; } catch (_) {}
          }
          return;
        }
        // If became live while waiting, auto-join
        if (data?.isLive && !joined && !client) {
          await tryJoinAfterStart(data.type);
        }
      } catch (e) {
        const status = e?.response?.status;
        if (status === 404 && !ended) {
          // Event deleted; treat as ended
          setWaitingHost(false);
          setConnecting(false);
          setEnded(true);
          try { if (client) await client.leave(); } catch (_) {}
          try { localTracks.audio?.close?.(); localTracks.video?.close?.(); } catch (_) {}
        }
      }
    };
    // Poll every 7s to reduce re-renders until joined
    timerId = setInterval(poll, 7000);
    return () => { if (timerId) clearInterval(timerId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, joined, ended]);

  // Participants panel removed: no socket subscription for host viewers list

  const switchCamera = async (cameraId) => {
    try { setSelectedCameraId(cameraId); } catch (_) {}
    const c = client;
    const currentVideo = localTracks.video;
    try {
      const newCam = await AgoraRTC.createCameraVideoTrack({
        optimizationMode: 'motion',
        encoderConfig: { width: 426, height: 240, frameRate: 24, bitrateMin: 280, bitrateMax: 700 },
        cameraId: cameraId || undefined
      });
      if (c) {
        if (currentVideo) {
          try { await c.unpublish([currentVideo]); } catch (_) {}
          try { currentVideo.stop?.(); } catch (_) {}
          try { currentVideo.close?.(); } catch (_) {}
        }
        try { await c.publish([newCam]); } catch (_) {}
        setLocalTracks(prev => ({ ...prev, video: newCam }));
        if (videoRef.current) {
          if (currentVideo) {
            try { currentVideo.stop?.(); } catch (_) {}
          }
          playIntoContainer(newCam);
        }
      }
    } catch (e) {
      console.error('switchCamera error', e);
      toast.error('Failed to switch camera');
    }
  };

  const shareScreen = async () => {
    const c = client;
    if (!c) return;
    const currentVideo = localTracks.video; // likely screen track
    try {
      // Must be HTTPS or localhost for getDisplayMedia
      if (!(window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        toast.error('Screen share requires HTTPS. Please use a secure URL.');
        return;
      }
      setStartingShare(true);
      // Request video-only screen capture for Firefox compatibility
      let screenTrackObj = await AgoraRTC.createScreenVideoTrack({ withAudio: false });
      const screenTrack = Array.isArray(screenTrackObj) ? screenTrackObj[0] : screenTrackObj;
      if (screenTrack) {
        // keep previous camera to restore later
        setPrevCamTrack(currentVideo || null);
        if (currentVideo) {
          try { await c.unpublish([currentVideo]); } catch (_) {}
          // Stop rendering locally but DO NOT close; we'll restore and publish it later
          try { currentVideo.stop?.(); } catch (_) {}
        }
        try { await c.publish([screenTrack]); } catch (_) {}
        setLocalTracks({ audio: localTracks.audio, video: screenTrack });
        setIsScreenSharing(true);
        if (videoRef.current) {
          if (currentVideo) {
            try { currentVideo.stop?.(); } catch (_) {}
          }
          playIntoContainer(screenTrack);
        }
        // when user stops from browser UI, restore camera
        try {
          screenTrack.on('track-ended', async () => {
            await stopShare();
          });
        } catch (_) {
          try { screenTrack.onended = async () => { await stopShare(); }; } catch (_) {}
        }
      }
    } catch (e) {
      console.error('shareScreen error', e);
      const msg = String(e?.message || e || '').toLowerCase();
      if (msg.includes('denied') || msg.includes('not allowed') || e?.name === 'NotAllowedError') {
        toast.error('Permission denied. Please allow screen sharing in the browser prompt.');
      } else if (e?.name === 'NotFoundError') {
        toast.error('No screen sources found. Try another window or monitor.');
      } else if (e?.name === 'NotReadableError') {
        toast.error('Screen is busy or protected. Close other apps using screen capture and try again.');
      } else if (e?.name === 'SecurityError') {
        toast.error('Screen share blocked by browser security. Use HTTPS.');
      } else if (e?.name === 'AbortError') {
        toast.error('Screen share was cancelled.');
      } else {
        toast.error('Failed to start screen share');
      }
    } finally {
      setStartingShare(false);
    }
  };

  const stopShare = async () => {
    const c = client;
    if (!c) return;
    const currentVideo = localTracks.video; // likely screen track
    try {
      console.log('[LIVE:UI] stopShare: start');
      if (currentVideo) {
        try { await c.unpublish([currentVideo]); } catch (_) {}
        try { currentVideo.stop?.(); } catch (_) {}
        try { currentVideo.close?.(); } catch (_) {}
        console.log('[LIVE:UI] stopShare: screen track unpublished and closed');
      }
      // restore previous camera or create a new one
      let cam = prevCamTrack;
      if (!cam) {
        console.log('[LIVE:UI] stopShare: no prevCamTrack, creating new camera');
        cam = await AgoraRTC.createCameraVideoTrack({
          optimizationMode: 'motion',
          encoderConfig: { width: 426, height: 240, frameRate: 24, bitrateMin: 280, bitrateMax: 700 },
          cameraId: selectedCameraId || undefined
        });
      }
      try { await cam.setEnabled?.(true); } catch (e) { console.warn('[LIVE:UI] stopShare: cam.setEnabled error', e); }
      try {
        await c.publish([cam]);
        console.log('[LIVE:UI] stopShare: camera published');
      } catch (e) {
        console.warn('[LIVE:UI] stopShare: publish cam failed, recreating track', e);
        try { cam?.stop?.(); } catch (_) {}
        try { cam?.close?.(); } catch (_) {}
        const fresh = await AgoraRTC.createCameraVideoTrack({
          optimizationMode: 'motion',
          encoderConfig: { width: 426, height: 240, frameRate: 24, bitrateMin: 280, bitrateMax: 700 },
          cameraId: selectedCameraId || undefined
        });
        await c.publish([fresh]);
        cam = fresh;
        console.log('[LIVE:UI] stopShare: fresh camera published');
      }
      setLocalTracks({ audio: localTracks.audio, video: cam });
      setIsScreenSharing(false);
      setVideoOff(false);
      setPrevCamTrack(null);
      if (videoRef.current) {
        playIntoContainer(cam);
      }
      try {
        const mst = cam.getMediaStreamTrack?.();
        console.log('[LIVE:UI] stopShare: cam track state', { readyState: mst?.readyState, enabled: mst?.enabled });
      } catch (_) {}
    } catch (e) {
      console.error('stopShare error', e);
      toast.error('Failed to stop screen share');
    }
  };

  const endStream = async () => {
    try {
      console.log('[LIVE:UI] endStream: requesting stop');
      await eventAPI.setLive(eventId, { action: 'stop' });
      console.log('[LIVE:UI] endStream: stop success');
    } catch (e) {}
    try {
      const c = client;
      if (c) { console.log('[LIVE:UI] endStream: leaving channel'); await c.leave(); }
      localTracks.audio?.close?.();
      localTracks.video?.close?.();
    } catch (_) {}
    setEnded(true);
    // Host: close tab immediately after ending
    setTimeout(() => {
      try { window.close(); } catch (_) {}
      try { if (window.history.length > 1) navigate(-1); else navigate('/'); } catch (_) {}
    }, 300);
  };

  const leaveStream = async () => {
    try {
      const c = client;
      if (c) { console.log('[LIVE:UI] leaveStream: leaving channel'); await c.leave(); }
      localTracks.audio?.close?.();
      localTracks.video?.close?.();
    } catch (_) {}
    try {
      const s = socketService.socket;
      if (s && !isHost) { console.log('[LIVE:UI] leaveStream: emit live_viewer_leave'); s.emit('live_viewer_leave', { eventId }); }
    } catch (_) {}
    if (!isHost) setLeft(true); else setEnded(true);
    // Audience manual leave: close shortly to return to previous page
    setTimeout(() => {
      try { window.close(); } catch (_) {}
      try { if (window.history.length > 1) navigate(-1); else navigate('/'); } catch (_) {}
    }, 300);
  };

  const toggleMute = async () => {
    if (!localTracks.audio) return;
    const next = !muted;
    await localTracks.audio.setEnabled(!next);
    setMuted(next);
  };

  const toggleVideo = async () => {
    if (isScreenSharing) {
      toast.error('Disable screen share to control camera');
      return;
    }
    if (!localTracks.video) return;
    const next = !videoOff;
    await localTracks.video.setEnabled(!next);
    setVideoOff(next);
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Minimal header with college name + is streaming */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }} className="p-2 rounded hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-sm text-gray-300">{collegeName || 'College'} is streaming</span>
            {eventInfo?.title && (
              <span className="text-[11px] text-gray-400">{eventInfo.title}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm"></div>
      </div>

      {/* Content: video area and optional participants panel for host */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 min-h-0">
        <div className="md:col-span-12 flex items-center justify-center overflow-hidden"> 
          <div ref={videoRef} className="relative w-full h-full bg-black overflow-hidden" />
        </div>
      </div>

      {/* Controls pinned to bottom */}
      <div className="p-3 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-3 flex-wrap">
        {isHost ? (
          <>
          {cameras && cameras.length > 0 && (
            <select
              value={selectedCameraId}
              onChange={(e) => switchCamera(e.target.value)}
              disabled={isScreenSharing}
              className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"
              title="Select camera"
            >
              {cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>{c.label || 'Camera'}</option>
              ))}
            </select>
          )}
          <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
            {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          <button onClick={toggleVideo} disabled={isScreenSharing} className={`w-12 h-12 rounded-full flex items-center justify-center ${isScreenSharing ? 'bg-gray-700 opacity-50 cursor-not-allowed' : (videoOff ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600')}`}>
            {videoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
          {!isScreenSharing ? (
            <button onClick={shareScreen} disabled={startingShare} className={`px-3 py-2 rounded ${startingShare ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>Share Screen</button>
          ) : (
            <button onClick={stopShare} className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 rounded">Stop Share</button>
          )}
          <button onClick={() => { setShowPolls((s) => { const next = !s; if (next) setUnreadPolls(0); return next; }); }} className="relative px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded">Polls{unreadPolls > 0 ? '' : ''}
            {unreadPolls > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full px-1 leading-4">{unreadPolls}</span>
            )}
          </button>
          <button onClick={endStream} className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded">End Stream</button>
          </>
        ) : (
          <>
            <button onClick={leaveStream} className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded">Leave Stream</button>
            <button onClick={() => { setShowPolls((s) => { const next = !s; if (next) setUnreadPolls(0); return next; }); }} className="relative px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded">Polls{unreadPolls > 0 ? '' : ''}
              {unreadPolls > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full px-1 leading-4">{unreadPolls}</span>
              )}
            </button>
          </>
        )}
      </div>

      {connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-3"></div>
            <p>{isHost ? 'Starting stream...' : 'Joining stream...'}</p>
          </div>
        </div>
      )}

      {!connecting && waitingHost && !ended && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center space-y-3">
            <p className="text-gray-200">Waiting for host to start publishing...</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded">Retry</button>
          </div>
        </div>
      )}

      {ended && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <p className="text-gray-100 text-lg">This live stream has ended.</p>
          </div>
        </div>
      )}

      {left && !isHost && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center space-y-3">
            <p className="text-gray-100 text-lg">You left the stream.</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded">Rejoin</button>
          </div>
        </div>
      )}

      {/* Polls panel */}
      {showPolls && (
        <div className="absolute right-4 bottom-20 w-80 bg-gray-900 border border-gray-800 rounded-lg shadow-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Polls</span>
            <button onClick={() => setShowPolls(false)} className="text-xs text-gray-400 hover:text-gray-200">Close</button>
          </div>
          {isHost && (
            <div className="space-y-2">
              <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Question" className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm" />
              <textarea value={pollOptionsText} onChange={(e) => setPollOptionsText(e.target.value)} placeholder={'Options (one per line)'} rows={3} className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm"></textarea>
              <button disabled={creatingPoll} onClick={createPoll} className={`w-full px-3 py-2 rounded ${creatingPoll ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'} text-sm`}>{creatingPoll ? 'Creating...' : 'Create Poll'}</button>
            </div>
          )}
          <div className="space-y-3 max-h-64 overflow-auto">
            {(polls || []).map((p) => {
              const total = (p.options || []).reduce((sum, o) => sum + (o.votes || o.count || 0), 0);
              const isActive = p.isActive !== false; // default active if not provided
              return (
                <div key={p._id} className="bg-gray-800 rounded p-2 space-y-2">
                  <div className="text-sm font-medium">{p.question}</div>
                  <div className="space-y-1">
                    {(p.options || []).map((o, idx) => {
                      const count = o.votes || o.count || 0;
                      const pct = total > 0 ? Math.round((count * 100) / total) : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-gray-300">
                            <span>{o.text}</span>
                            <span>{count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 bg-gray-700 rounded">
                            <div className="h-2 bg-indigo-600 rounded" style={{ width: `${pct}%` }}></div>
                          </div>
                          {!isHost && isActive && !votedPollIds.includes(p._id) && (
                            <button onClick={() => votePoll(p._id, idx)} className="w-full mt-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs">Vote</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isHost && isActive && (
                    <button onClick={() => closePoll(p._id)} className="w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Close Poll</button>
                  )}
                </div>
              );
            })}
            {(!polls || polls.length === 0) && (
              <div className="text-xs text-gray-400">No polls yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveStream;
