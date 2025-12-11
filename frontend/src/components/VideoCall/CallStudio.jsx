import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { Toaster, toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';
import socketService from '../../services/socket.js';
import videoCallAPI from '../../services/videoCallAPI.js';
import { studentAPI } from '../../services/api.js';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Users, Plus, X, Volume2, VolumeX } from 'lucide-react';

const CallStudio = () => {
  const { callId } = useParams();
  const { user } = useAuthStore();
  const qs = new URLSearchParams(window.location.search);
  const isCaller = qs.get('caller') === '1';
  const isAcceptFlow = qs.get('accept') === '1';
  const prefilledChannel = qs.get('channel') || '';
  const prefilledToken = qs.get('token') || '';
  const tokenFromStorage = (() => {
    try {
      const raw = localStorage.getItem('campusconnect-auth');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.token || null;
    } catch (_) { return null; }
  })();

  const [connecting, setConnecting] = useState(true);
  const [joinStatus, setJoinStatus] = useState('Joining...');
  const hasJoinedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [sharing, setSharing] = useState(false);
  const [cameraPrompt, setCameraPrompt] = useState({ show: false, lastError: '' });
  const [speakerMuted, setSpeakerMuted] = useState(false);

  const clientRef = useRef(null);
  const localTracks = useRef({ audio: null, video: null });
  const screenTrackRef = useRef(null);
  const remoteUsersRef = useRef(new Map());
  const remoteContainersRef = useRef(new Map());
  const containerRef = useRef(null);
  const localRef = useRef(null);
  const socketHandlerRef = useRef(null);

  const playInto = (track, container) => {
    if (!container) return;
    try { container.innerHTML = ''; } catch (_) {}
    try { track.play(container, { mirror: false }); } catch (_) {}
    try {
      const v = container.querySelector('video');
      if (v) {
        v.style.width = '100%';
        v.style.height = '100%';
        v.style.objectFit = 'cover';
        v.style.transform = 'none';
        v.classList?.remove?.('agora-video-player--mirror');
      }
    } catch (_) {}
  };

  const ensureRemoteContainer = (uid) => {
    const container = containerRef.current; if (!container) return null;
    const key = String(uid);
    let div = remoteContainersRef.current.get(key);
    if (!div) {
      div = document.createElement('div');
      div.className = 'w-full h-full';
      container.appendChild(div);
      remoteContainersRef.current.set(key, div);
    }
    return div;
  };

  const setAllRemoteAudioMuted = async (muted) => {
    const list = Array.from(remoteUsersRef.current.values());
    for (const u of list) {
      const t = u.audioTrack;
      if (!t) continue;
      try {
        if (typeof t.setVolume === 'function') {
          await t.setVolume(muted ? 0 : 100);
        } else {
          await t.setEnabled(!muted);
        }
      } catch (_) {}
      if (!muted) {
        try { await t.play(); } catch (_) {}
      }
    }
  };

  useEffect(() => {
    // Ensure socket is connected in the call tab so call_ended reaches this window
    if (tokenFromStorage) {
      socketService.connect(tokenFromStorage);
    } else {
      socketService.connect();
    }
    const handler = (payload) => {
      // Close the tab on remote end
      setJoinStatus('Call ended');
      setTimeout(() => {
        try { window.close(); } catch (_) {}
      }, 300);
    };
    try {
      socketService.socket?.on('call_ended', handler);
      socketHandlerRef.current = handler;
    } catch (_) {}
    // Also handle rejection
    const rejectHandler = () => {
      setJoinStatus('Call rejected');
      setTimeout(() => {
        try { window.close(); } catch (_) {}
      }, 500);
    };
    try { socketService.socket?.on('call_rejected', rejectHandler); } catch (_) {}
    return () => {
      try { socketService.socket?.off('call_ended', handler); } catch (_) {}
      try { socketService.socket?.off('call_rejected', rejectHandler); } catch (_) {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  useEffect(() => {
    let mounted = true;
    let callEndedHandler = null;
    (async () => {
      try {
        const cred = await videoCallAPI.getCredentials();
        const appId = cred?.data?.appId;
        if (!appId) throw new Error('Agora App ID missing');
        // Acquire call credentials
        let channelName = prefilledChannel || null;
        let token = prefilledToken || null;
        let uidFromServer = null;
        let tries = 0;
        // While waiting for accept, show Ringing
        if (!channelName || !token) {
          setJoinStatus('Ringing...');
        }
        if (isAcceptFlow && !isCaller) {
          // If opened via Accept button, fetch receiver-specific credentials first
          try {
            setJoinStatus('Joining...');
            const acc = await videoCallAPI.acceptCall(callId);
            channelName = channelName || acc?.data?.channelName || acc?.data?.channel || null;
            token = token || acc?.data?.token || null;
            uidFromServer = acc?.data?.uid || acc?.data?.account || uidFromServer;
          } catch (_) {}
        }
        // If still missing, poll shared credentials until ready
        while (tries < 10 && (!channelName || !token)) {
          try {
            const callCred = await videoCallAPI.getCallCredentials(callId);
            channelName = callCred?.data?.channelName || channelName;
            token = callCred?.data?.token || token;
            uidFromServer = callCred?.data?.uid || callCred?.data?.account || uidFromServer;
            if (channelName && token) break;
          } catch (_) {}
          setJoinStatus('Joining...');
          await new Promise(r => setTimeout(r, 500));
          tries += 1;
        }
        if (!channelName || !token) throw new Error('Call credentials missing');

        // Prefer VP9 for screen/text clarity when supported (Chrome/Edge). Safari sticks to h264.
        // Optimize for low latency
        // Cross-browser safest codec (Chrome/Edge/Firefox/Safari)
        const codec = 'h264';
        
        // Create client with optimized settings for low latency
        const client = AgoraRTC.createClient({ 
          mode: 'rtc', 
          codec,
          // Enable low-latency mode
          enableLowLatency: true,
          // Optimize for real-time communication
          audioEncoderConfiguration: {
            bitrateMax: 64,
            bitrateMin: 32,
            stereo: false,
            sampleRate: 48000,
            codec: 'aac'
          },
          // Conservative video for reliability across browsers
          videoEncoderConfiguration: {
            width: 960,
            height: 540,
            frameRate: 24,
            bitrateMax: 900,
            bitrateMin: 280,
            degradationPreference: 'maintain-framerate',
            codec: 'h264'
          }
        });
        
        clientRef.current = client;
        
        try { 
          // Enable dual stream for adaptive quality
          await client.enableDualStream?.(); 
          
          // Configure low stream parameters for poor network conditions
          await client.setLowStreamParameter?.({
            width: 320,
            height: 180,
            frameRate: 15,
            bitrate: 200,
            bitrateMin: 100,
            bitrateMax: 300
          }); 
          
          // Set audio profile for low latency
          await client.setAudioProfile?.('speech_low_latency'); 
          
          // Set network quality update interval (ms)
          await client.setNetworkQualityUpdateInterval?.(2000);
          
          // Enable audio volume indicator for better UX
          await client.enableAudioVolumeIndicator?.();
          
          // Optimize for low latency
          await client.setLowLatencyMode?.(true);
          
        } catch (error) {
          console.warn('Error optimizing client settings:', error);
        }

        const safePlayAudio = async (track) => {
          if (!track) return;
          try { await track.setEnabled(true); } catch (_) {}
          try { await track.setVolume?.(100); } catch (_) {}
          try { await track.play(); }
          catch (e) {
            // Autoplay may be blocked; resume on first user gesture
            const resume = () => { try { track.play(); } catch (_) {} window.removeEventListener('click', resume); };
            window.addEventListener('click', resume, { once: true });
          }
          try { if (typeof track.setVolume === 'function') { await track.setVolume(speakerMuted ? 0 : 100); } } catch (_) {}
        };

        client.on('user-published', async (user, mediaType) => {
          try { await client.subscribe(user, mediaType); } catch (_) { return; }
          const uid = String(user.uid || '');
          const prev = remoteUsersRef.current.get(uid) || {};
          if (mediaType === 'video') {
            try { await client.setStreamFallbackOption?.(user, 0); } catch (_) {}
            remoteUsersRef.current.set(uid, { ...prev, videoTrack: user.videoTrack, audioTrack: user.audioTrack });
            const div = ensureRemoteContainer(uid);
            if (div) playInto(user.videoTrack, div);
            // Proactively subscribe to audio as well and play
            try { await client.subscribe(user, 'audio'); } catch (_) {}
            if (user.audioTrack) { await safePlayAudio(user.audioTrack); }
          }
          if (mediaType === 'audio') {
            await safePlayAudio(user.audioTrack);
            remoteUsersRef.current.set(uid, { ...prev, audioTrack: user.audioTrack });
          }
        });

        // Enhanced adaptive bitrate and quality control
        client.on('network-quality', async (stats) => {
          try {
            const { uplinkNetworkQuality, downlinkNetworkQuality } = stats;
            const screen = screenTrackRef.current;
            const localCam = localTracks.current?.video || localTracksRef.current?.video;
            
            // Handle screen sharing optimization
            if (screen) {
              if (uplinkNetworkQuality >= 4) {
                // Poor network: reduce quality to maintain real-time performance
                await screen.setEncoderConfiguration?.({
                  width: 960,
                  height: 540,
                  frameRate: 15,
                  bitrateMin: 600,
                  bitrateMax: 1000,
                  degradationPreference: 'maintain-framerate'
                });
              } else if (uplinkNetworkQuality <= 2) {
                // Good network: increase quality
                await screen.setEncoderConfiguration?.({
                  width: 1920,
                  height: 1080,
                  frameRate: 30,
                  bitrateMin: 1800,
                  bitrateMax: 3000,
                  degradationPreference: 'maintain-quality'
                });
              }
            }
            
            // Local camera quality: bump up when network is good, lower when bad
            if (localCam && typeof localCam.setEncoderConfiguration === 'function') {
              if (uplinkNetworkQuality <= 2) {
                // Good uplink -> clearer video
                await localCam.setEncoderConfiguration?.({
                  width: 1280,
                  height: 720,
                  frameRate: 24,
                  bitrateMin: 600,
                  bitrateMax: 1400,
                  degradationPreference: 'maintain-framerate'
                });
              } else if (uplinkNetworkQuality >= 4) {
                // Poor uplink -> keep call stable
                await localCam.setEncoderConfiguration?.({
                  width: 640,
                  height: 360,
                  frameRate: 20,
                  bitrateMin: 280,
                  bitrateMax: 700,
                  degradationPreference: 'maintain-framerate'
                });
              }
            }
            
            // Optimize video quality based on network conditions
            const remoteUsers = Array.from(remoteUsersRef.current.values());
            for (const user of remoteUsers) {
              if (user.videoTrack) {
                try {
                  if (downlinkNetworkQuality >= 4) {
                    // Request lower quality from remote users when network is poor
                    await client.setRemoteVideoStreamType(user.uid, 1); // Low quality
                  } else if (downlinkNetworkQuality <= 2) {
                    // Request higher quality when network is good
                    await client.setRemoteVideoStreamType(user.uid, 0); // High quality
                  }
                } catch (error) {
                  console.warn('Error adjusting remote video quality:', error);
                }
              }
            }
            
            // Show network quality indicator to user
            const quality = ['Unknown', 'Excellent', 'Good', 'Poor', 'Bad', 'Very Bad', 'Down'][downlinkNetworkQuality] || 'Unknown';
            setJoinStatus(`Network: ${quality}`);
            
          } catch (error) {
            console.warn('Network quality handler error:', error);
          }
        });
        client.on('user-unpublished', (user, mediaType) => {
          const uid = String(user.uid || '');
          const prev = remoteUsersRef.current.get(uid) || {};
          if (mediaType === 'video') {
            remoteUsersRef.current.set(uid, { ...prev, videoTrack: null });
            // Remove the remote container to avoid stale frames
            try {
              const div = remoteContainersRef.current.get(uid);
              if (div && div.parentNode) div.parentNode.removeChild(div);
              remoteContainersRef.current.delete(uid);
            } catch (_) {}
          }
          if (mediaType === 'audio') {
            try { user.audioTrack?.stop(); } catch (_) {}
            remoteUsersRef.current.set(uid, { ...prev, audioTrack: null });
          }
        });

        // Handle call ended event from server
        callEndedHandler = () => {
          toast.success('Call ended by other participant');
          setTimeout(() => {
            try { window.close(); } catch (_) {}
          }, 1000);
        };
        window.addEventListener('call_ended', callEndedHandler);

        // Use the same UID/account the backend signed into the token.
        const joinUid = uidFromServer || String(user?.id || user?._id || '');
        const tryJoin = async () => {
          setJoinStatus('Joining...');
          const joinWithRetry = async (client, appId, channelName, token, uid) => {
            let retryCount = 0;
            const maxRetries = 5;
            const baseDelay = 1000; // 1 second initial delay
            
            // Pre-warm the connection
            try {
              await client.preloadChannel?.(channelName, token, uid);
            } catch (e) {
              console.warn('Preload channel failed, continuing with normal join:', e);
            }

            while (retryCount < maxRetries) {
              try {
                // Optimize join options
                const joinOptions = {
                  token,
                  uid: uid || null,
                  // Enable auto-fallback to TCP if UDP fails
                  fallback: 2, // 0: disable fallback, 1: auto fallback to TCP, 2: auto fallback to TCP with proxy
                  // Enable auto network recovery
                  autoReconnect: true,
                  // Set connection timeout (ms)
                  timeout: 10000,
                  // Enable audio quality optimization
                  audioQuality: 'high',
                  // Enable video quality optimization
                  videoQuality: 'high',
                  // Enable transport fallback
                  transportFallback: 2, // 0: disable, 1: enable fallback to TCP, 2: enable fallback to TCP with proxy
                  // Enable audio preprocessing
                  audioPreprocessing: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    highPassFilter: true,
                    typingNoiseDetection: true,
                    voiceActivityDetection: true
                  }
                };
                
                await client.join(appId, channelName, token, uid, joinOptions);
                
                // After successful join, optimize the connection
                try {
                  // Set network type to 4G by default for better performance
                  await client.setNetworkType?.(3); // 3 = 4G
                  
                  // Set audio and video quality preference
                  await client.setAudioQuality?.(4); // 4 = high quality
                  await client.setVideoQuality?.(4); // 4 = high quality
                  
                  // Enable audio volume indicator
                  await client.enableAudioVolumeIndicator?.();
                  
                  // Set client role to host for better control
                  await client.setClientRole?.('host');
                  
                } catch (optimizeError) {
                  console.warn('Error optimizing connection:', optimizeError);
                }
                
                return true; // Successfully joined
              } catch (error) {
                console.error(`Join attempt ${retryCount + 1} failed:`, error);
                retryCount++;
                
                if (retryCount >= maxRetries) {
                  throw error; // Re-throw after max retries
                }
                
                // Exponential backoff with jitter
                const delay = Math.min(
                  baseDelay * Math.pow(2, retryCount) + Math.random() * 1000,
                  10000 // Max 10 seconds
                );
                console.log(`Retrying in ${Math.round(delay)}ms...`);
                setJoinStatus(`Reconnecting in ${Math.ceil(delay/1000)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          };
          await joinWithRetry(client, appId, channelName, token, joinUid);
        };
        let joined = false;
        let joinAttempts = 0;
        while (!joined && joinAttempts < 12) {
          try {
            await tryJoin();
            joined = true;
          } catch (e) {
            const msg = String(e?.message || '');
            if (msg.includes('invalid token')) {
              setJoinStatus('Joining...');
              try {
                const refreshed = await videoCallAPI.getCallCredentials(callId);
                const newToken = refreshed?.data?.token;
                if (newToken) token = newToken;
              } catch (_) {}
            } else if (msg.includes('UID_CONFLICT')) {
              setJoinStatus('Joining...');
              // Try to obtain participant-specific credentials again (especially for receiver)
              try {
                if (isAcceptFlow && !isCaller) {
                  const acc = await videoCallAPI.acceptCall(callId);
                  token = acc?.data?.token || token;
                  uidFromServer = acc?.data?.uid || uidFromServer;
                } else {
                  const refreshed = await videoCallAPI.getCallCredentials(callId);
                  token = refreshed?.data?.token || token;
                  uidFromServer = refreshed?.data?.uid || uidFromServer;
                }
              } catch (_) {}
            } else {
              setJoinStatus('Joining...');
            }
            await new Promise(r => setTimeout(r, 1200));
            joinAttempts += 1;
          }
        }
        if (!joined) throw new Error('Unable to join call. Please try again.');

        // Create local tracks (low-latency camera)
        let mic = null, cam = null;
        try { 
          mic = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            AGC: true,
            encoderConfig: 'speech_standard'
          }); 
        } catch (_) {}
        try {
          cam = await AgoraRTC.createCameraVideoTrack({
            optimizationMode: 'motion',
            encoderConfig: { width: 426, height: 240, frameRate: 24, bitrateMin: 280, bitrateMax: 700 }
          });
        } catch (err) {
          const msg = String(err?.message || err || '');
          setCameraPrompt({ show: true, lastError: msg });
        }
        localTracks.current = { audio: mic, video: cam };
        const toPub = [];
        if (mic) toPub.push(mic);
        if (cam) toPub.push(cam);
        if (toPub.length) { try { await client.publish(toPub); } catch (_) {} }
        if (cam && localRef.current) playInto(cam, localRef.current);
        setConnecting(false);
        hasJoinedRef.current = true;

        // Periodic re-subscribe to mitigate drift
        const driftTimer = setInterval(async () => {
          try {
            const rem = client.remoteUsers || [];
            for (const ru of rem) {
              if (ru.hasVideo) {
                try { await client.subscribe(ru, 'video'); } catch (_) {}
                try { await client.setRemoteVideoStreamType?.(ru, 1); } catch (_) {}
              }
            }
          } catch (_) {}
        }, 70000);
        if (!mounted) clearInterval(driftTimer);
      } catch (e) {
        console.error('CallStudio init error', e);
        setJoinStatus('Joining...');
        // Do not reshow connecting overlay if we already joined successfully
        if (!hasJoinedRef.current) {
          setConnecting(true);
        }
      }
    })();
    return () => {
      mounted = false;
      try {
        const c = clientRef.current;
        const { audio, video } = localTracks.current;
        if (audio) { try { audio.stop(); audio.close(); } catch (_) {} }
        if (video) { try { video.stop(); video.close(); } catch (_) {} }
        if (c) c.leave();
        if (callEndedHandler) {
          window.removeEventListener('call_ended', callEndedHandler);
        }
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  useEffect(() => {
    if (!showInvite) return;
    (async () => {
      try {
        const res = await studentAPI.getAll({ params: { limit: 50 } });
        setStudents(res?.data?.students || []);
      } catch (_) {
        try {
          const res2 = await studentAPI.getByCollege(user?.id);
          setStudents(res2?.data?.students || []);
        } catch (_) {}
      }
    })();
  }, [showInvite, user?.id]);

  const inviteUser = async (student) => {
    try {
      setInviteLoading(true);
      await videoCallAPI.initiateCall(student._id, false);
      toast.success(`Invited ${student.name || student.usn || 'user'}`);
    } catch (e) {
      toast.error('Failed to invite');
    } finally { setInviteLoading(false); }
  };

  const toggleMute = async () => {
    const t = localTracks.current.audio; if (!t) return;
    const next = !muted; await t.setEnabled(!next); setMuted(next);
  };
  const toggleVideo = async () => {
    const t = localTracks.current.video; if (!t) return;
    const next = !videoOff; await t.setEnabled(!next); setVideoOff(next);
  };

  const toggleSpeaker = async () => {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    await setAllRemoteAudioMuted(next);
  };

  const toggleScreenShare = async () => {
    try {
      const client = clientRef.current;
      if (!client) return;
      if (!sharing) {
        // Start screen share: unpublish camera, publish screen
        const cam = localTracks.current.video;
        try { if (cam) await client.unpublish(cam); } catch (_) {}
        const screen = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: {
            width: 1920,
            height: 1080,
            frameRate: 30,
            bitrateMin: 1800,
            bitrateMax: 3500
          },
          optimizationMode: 'detail',
          withAudio: false
        }, 'disable');
        screenTrackRef.current = screen;
        try { await client.publish(screen); } catch (_) {}
        if (localRef.current) playInto(screen, localRef.current);
        setSharing(true);
      } else {
        // Stop screen share: unpublish screen, republish camera
        const screen = screenTrackRef.current;
        try { if (screen) { await client.unpublish(screen); screen.stop(); screen.close(); } } catch (_) {}
        screenTrackRef.current = null;
        const cam = localTracks.current.video;
        if (cam) {
          try { await client.publish(cam); } catch (_) {}
          if (localRef.current) playInto(cam, localRef.current);
        }
        setSharing(false);
      }
    } catch (e) {
      toast.error('Screen share failed');
    }
  };

  const endCall = async () => {
    try {
      const c = clientRef.current;
      const { audio, video } = localTracks.current;
      const screen = screenTrackRef.current;
      if (audio) { try { await c?.unpublish?.(audio); audio.stop(); audio.close(); } catch (_) {} }
      if (video) { try { await c?.unpublish?.(video); video.stop(); video.close(); } catch (_) {} }
      if (screen) { try { await c?.unpublish?.(screen); screen.stop(); screen.close(); } catch (_) {} }
      try { await c?.leave?.(); } catch (_) {}
      try { await videoCallAPI.endCall(callId); } catch (_) {}
      toast.success('Call ended');
      setTimeout(() => { try { window.close(); } catch (_) {} }, 500);
    } catch (_) {}
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const nm = (s.name || '').toLowerCase();
    const usn = (s.usn || '').toLowerCase();
    return nm.includes(q) || usn.includes(q);
  });

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <Toaster />
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">Campus Connect</span>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-600">Call Studio</span>
          <span className="text-xs text-gray-400">{isCaller ? '(Caller)' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInvite(true)} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm flex items-center gap-1"><Users className="w-4 h-4" /> Add participants</button>
        </div>
      </div>

      <div className="flex-1 relative">
        <div className="absolute inset-0" ref={containerRef} />
        <div className="absolute bottom-4 right-4 w-48 h-28 bg-black/80 rounded overflow-hidden border border-gray-700">
          <div ref={localRef} className="w-full h-full" />
        </div>
        {connecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-3" />
              <p>{joinStatus || 'Joining call...'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-3">
        <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button onClick={toggleSpeaker} className={`w-12 h-12 rounded-full flex items-center justify-center ${speakerMuted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          {speakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </button>
        <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center ${videoOff ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          {videoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
        </button>
        <button onClick={toggleScreenShare} className={`px-3 h-12 rounded-full flex items-center justify-center text-sm ${sharing ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          {sharing ? 'Stop Share' : 'Share Screen'}
        </button>
        <button onClick={endCall} className="px-3 h-12 rounded-full flex items-center justify-center text-sm bg-red-600 hover:bg-red-500">
          End Call
        </button>
      </div>

      {showInvite && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">Invite participants</div>
              <button onClick={() => setShowInvite(false)} className="p-1 hover:bg-gray-800 rounded"><X className="w-4 h-4" /></button>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or USN" className="w-full px-2 py-2 rounded bg-gray-800 border border-gray-700 text-sm mb-3" />
            <div className="max-h-72 overflow-auto space-y-2">
              {filtered.map(s => (
                <div key={s._id} className="flex items-center justify-between px-2 py-2 bg-gray-800 rounded">
                  <div>
                    <div className="text-sm">{s.name || s.usn}</div>
                    <div className="text-xs text-gray-400">{s.usn || s.email}</div>
                  </div>
                  <button disabled={inviteLoading} onClick={() => inviteUser(s)} className={`px-2 py-1 rounded text-xs ${inviteLoading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}><Plus className="w-3 h-3 inline mr-1" /> Invite</button>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-xs text-gray-400">No users found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {cameraPrompt.show && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-5">
            <div className="text-sm font-medium mb-2">Camera not available</div>
            <div className="text-xs text-gray-400 mb-4">
              Your camera appears to be in use by another app or blocked by the browser. You can continue without video or retry.
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setVideoOff(true); setCameraPrompt({ show: false, lastError: '' }); toast('Continuing without video'); }}
                className="px-3 py-2 text-xs rounded bg-gray-700 hover:bg-gray-600"
              >
                Continue without video
              </button>
              <button
                onClick={async () => {
                  try {
                    const client = clientRef.current;
                    const cam = await AgoraRTC.createCameraVideoTrack({
                      optimizationMode: 'motion',
                      encoderConfig: { width: 426, height: 240, frameRate: 24, bitrateMin: 280, bitrateMax: 700 }
                    });
                    // publish or replace published track
                    const prev = localTracks.current.video;
                    if (client) {
                      try { if (prev) await client.unpublish(prev); } catch (_) {}
                      try { await client.publish(cam); } catch (_) {}
                    }
                    localTracks.current.video = cam;
                    if (localRef.current) playInto(cam, localRef.current);
                    setVideoOff(false);
                    setCameraPrompt({ show: false, lastError: '' });
                  } catch (err) {
                    toast.error('Still cannot access camera');
                  }
                }}
                className="px-3 py-2 text-xs rounded bg-indigo-600 hover:bg-indigo-500"
              >
                Retry camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallStudio;
