import { useState, useEffect, useRef } from 'react';
import { X, Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoCallAPI from '../../services/videoCallAPI.js';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';

const VideoCallModal = ({ isOpen, onClose, callData, isIncoming = false, isRinging = false, onAcceptCall, onRejectCall, onEndCall }) => {
  const { user } = useAuthStore();
  
  // State management
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [duration, setDuration] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState(() => {
    try { return localStorage.getItem('cc_camera_id') || ''; } catch (_) { return ''; }
  });
  const [cameraError, setCameraError] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState(() => {
    try { return localStorage.getItem('cc_video_quality') || 'hd'; } catch (_) { return 'hd'; }
  });
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioError, setAudioError] = useState(null);

  const localVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null, screen: null });
  const networkQualityTimerRef = useRef(null);
  
  // Initialize audio context with error handling
  const initAudioContext = async () => {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') return null;
      
      if (!audioContextRef.current) {
        // Create audio context with better error handling
        try {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
          });
          console.log('AudioContext created successfully');
        } catch (error) {
          console.error('Failed to create AudioContext:', error);
          toast.error('Your browser does not support Web Audio API. Audio may not work correctly.');
          return null;
        }
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
          console.log('AudioContext resumed successfully');
        } catch (error) {
          console.error('Failed to resume AudioContext:', error);
          toast.error('Could not initialize audio. Please interact with the page first.');
          return null;
        }
      }
      
      return audioContextRef.current;
    } catch (error) {
      console.error('Error in initAudioContext:', error);
      return null;
    }
  };
  
  const playRemoteAudio = async (track) => {
    if (!track) {
      console.warn('No audio track provided to playRemoteAudio');
      return;
    }
    
    try {
      console.log('Initializing audio context for remote track');
      const audioContext = await initAudioContext();
      if (!audioContext) {
        console.error('Could not initialize audio context');
        return;
      }

      // Ensure track is enabled
      try {
        await track.setEnabled(true);
        console.log('Audio track enabled');
      } catch (e) {
        console.error('Failed to enable audio track:', e);
      }
      
      // Set volume to maximum if supported
      if (typeof track.setVolume === 'function') {
        try {
          await track.setVolume(100);
          console.log('Audio volume set to 100%');
        } catch (e) {
          console.warn('Could not set audio volume:', e);
        }
      }
      
      // Try to play the track with retry mechanism
      const playWithRetry = async (retryCount = 0) => {
        try {
          await track.play();
          console.log('Audio track is playing successfully');
          return true;
        } catch (playError) {
          console.warn(`Audio play failed (attempt ${retryCount + 1}/3):`, playError);
          
          if (retryCount < 2) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
            return playWithRetry(retryCount + 1);
          }
          
          // If we've exhausted retries, try one last time after resuming audio context
          try {
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
            }
            await track.play();
            console.log('Audio track started after final resume attempt');
            return true;
          } catch (finalError) {
            console.error('Final audio play attempt failed:', finalError);
            toast.error('Could not play audio. Please check your audio settings and ensure your browser has permission to play audio.');
            return false;
          }
        }
      };
      
      // Start the playback with retry
      await playWithRetry();
      
      // Set up a one-time click handler to resume audio if needed
      const handleUserInteraction = async () => {
        try {
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          if (track.isPlaying === false) {
            await track.play();
          }
          window.removeEventListener('click', handleUserInteraction);
        } catch (e) {
          console.error('Failed to resume audio on user interaction:', e);
        }
      };
      
      window.addEventListener('click', handleUserInteraction, { once: true });
    } catch (error) {
      console.error('Error setting up remote audio:', error);
      toast.error('Could not set up audio. Please check your audio settings.');
    }
  };
  const remoteVideoRef = useRef(null);
  const clientRef = useRef(null);
  const durationTimerRef = useRef(null);
  const resubTimerRef = useRef(null);
  const republishTimerRef = useRef(null);
  const replaceTimerRef = useRef(null);
  const audioHealthTimerRef = useRef(null);
  const prewarmRequestedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prewarmRequestedRef.current) {
      prewarmRequestedRef.current = true;
      (async () => {
        try {
          if (navigator?.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
          }
        } catch (_) {}
      })();
    }
  }, [isOpen]);

  const toggleMicrophone = async () => {
    try {
      const audioTrack = localTracksRef.current?.audio;
      if (!audioTrack) {
        console.warn('No audio track available to toggle');
        return;
      }
      
      const newState = !isAudioEnabled;
      console.log(`Toggling microphone to: ${newState ? 'ON' : 'OFF'}`);
      
      try {
        // If enabling, make sure we have permissions and audio context is active
        if (newState) {
          // Request microphone permissions if not already granted
          const permissionResult = await navigator.permissions.query({ name: 'microphone' });
          if (permissionResult.state === 'denied') {
            toast.error('Microphone access is denied. Please check your browser permissions.');
            return;
          }
          
          // Initialize audio context
          const audioContext = await initAudioContext();
          if (!audioContext) {
            toast.error('Could not initialize audio. Please check your audio settings.');
            return;
          }
        }
        
        // Toggle the track
        await audioTrack.setEnabled(newState);
        setIsAudioEnabled(newState);
        
        // If we're enabling, ensure the track is properly published
        if (newState && clientRef.current) {
          try {
            await clientRef.current.publish(audioTrack);
            console.log('Audio track published successfully');
          } catch (publishError) {
            console.error('Could not publish audio track:', publishError);
            toast.error('Failed to enable microphone. Please check your audio settings.');
            // Revert the state if publish fails
            await audioTrack.setEnabled(false);
            setIsAudioEnabled(false);
          }
        }
      } catch (error) {
        console.error('Error in toggleMicrophone:', error);
        toast.error('Failed to toggle microphone. Please check your audio settings.');
      }
    } catch (error) {
      console.error('Error toggling microphone:', error);
      toast.error('Failed to toggle microphone. Please check your audio settings.');
      setAudioError(error.message);
    }
  };
  
  // Handle audio device change
  const handleAudioDeviceChange = async (deviceId) => {
    try {
      setSelectedAudioDeviceId(deviceId);
      
      // Only proceed if we have an active audio track
      if (!localTracksRef.current?.audio) return;
      
      // Create new audio track with the selected device
      const [newAudioTrack] = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: deviceId,
        AEC: true,
        AGC: true,
        ANS: true,
        encoderConfig: 'speech_standard'
      });
      
      // Replace the old track
      const oldTrack = localTracksRef.current.audio;
      if (oldTrack) {
        await clientRef.current?.unpublish(oldTrack);
        oldTrack.stop();
        oldTrack.close();
      }
      
      // Update the reference and publish new track
      localTracksRef.current.audio = newAudioTrack;
      if (clientRef.current) {
        await clientRef.current.publish(newAudioTrack);
      }
      
      // Update UI state
      setIsAudioEnabled(true);
      toast.success('Microphone device changed');
    } catch (error) {
      console.error('Error changing audio device:', error);
      toast.error('Failed to change audio device');
      setAudioError(error.message);
    }
  };

  const preflightAndCreateTracks = async () => {
    const client = clientRef.current;
    if (!client) return;
    
    // First, ensure we have audio permissions
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.warn('Audio permission not granted:', error);
      toast.error('Microphone access is required for audio calls. Please allow microphone access and try again.');
    }

    let micTrack = null;
    let camTrack = null;
    
    // Create audio track with better error handling
    try {
      micTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,  // Acoustic Echo Cancellation
        ANS: true,  // Automatic Noise Suppression
        AGC: true,  // Automatic Gain Control
        encoderConfig: 'music_standard'
      });
      
      if (micTrack) {
        try { 
          await micTrack.setEnabled(true);
          await micTrack.setVolume(100);
          console.log('Microphone track created and enabled');
        } catch (e) {
          console.error('Failed to configure microphone:', e);
          toast.error('Could not configure microphone. Please check your audio settings.');
        }
      }
    } catch (e) {
      console.error('Failed to create microphone track:', e);
      toast.error('Could not access microphone. Please check your audio settings and permissions.');
      return;
    }
    // Low-latency camera config (240p@24fps motion)
    const cfg = { width: 426, height: 240, frameRate: 24, bitrateMin: 280, bitrateMax: 700 };
    try { camTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: cfg,
      cameraId: selectedCameraId || undefined,
      optimizationMode: 'motion'
    }); } catch (e1) {
      // If camera is busy or fails, enumerate devices and try alternates
      try {
        const cams = await AgoraRTC.getCameras();
        for (const dev of cams) {
          try {
            camTrack = await AgoraRTC.createCameraVideoTrack({ cameraId: dev.deviceId, encoderConfig: cfg, optimizationMode: 'motion' });
            if (camTrack) break;
          } catch (_) {}
        }
      } catch (_) {}
    }
    // If both failed, try a quick permission preflight to trigger browser prompt, then retry once
    if (!micTrack && !camTrack && navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        // Immediately stop the preflight stream tracks; Agora will create its own tracks
        stream.getTracks().forEach(t => t.stop());
        try { 
          micTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            AGC: true,
            encoderConfig: 'music_standard'
          });
          if (micTrack) {
            try { await micTrack.setEnabled(true); } catch (_) {}
            try { await micTrack.setVolume?.(100); } catch (_) {}
          }
        } catch (_) {}
        try { camTrack = await AgoraRTC.createCameraVideoTrack({ encoderConfig: cfg, cameraId: selectedCameraId || undefined, optimizationMode: 'motion' }); } catch (e2) {
          try {
            const cams = await AgoraRTC.getCameras();
            for (const dev of cams) {
              try {
                camTrack = await AgoraRTC.createCameraVideoTrack({ cameraId: dev.deviceId, encoderConfig: cfg, optimizationMode: 'motion' });
                if (camTrack) break;
              } catch (_) {}
            }
          } catch (_) {}
        }
      } catch (_) {
        // Still no permission; proceed without local tracks
      }
    }
    localTracksRef.current = { audio: micTrack, video: camTrack };
    setLocalStream({ audioTrack: micTrack || null, videoTrack: camTrack || null });
    const toPublish = [];
    if (micTrack) {
      // Ensure audio is enabled before publishing
      try {
        await micTrack.setEnabled(true);
        toPublish.push(micTrack);
        console.log('Publishing audio track');
      } catch (e) {
        console.error('Failed to enable audio track:', e);
      }
    }
    if (camTrack) {
      try { await camTrack.setEnabled(true); } catch (_) {}
      toPublish.push(camTrack);
    }
    if (toPublish.length > 0) {
      try {
        await client.publish(toPublish);
        console.log('Published tracks:', toPublish.length);
      } catch (e) {
        console.error('Failed to publish tracks:', e);
      }
    }
    if (micTrack && typeof micTrack.getAudioLevel === 'function') {
      try {
        if (audioHealthTimerRef.current) clearInterval(audioHealthTimerRef.current);
      } catch (_) {}
      audioHealthTimerRef.current = setInterval(() => {
        const currentMic = localTracksRef.current.audio;
        if (!currentMic || typeof currentMic.getAudioLevel !== 'function') {
          try { clearInterval(audioHealthTimerRef.current); } catch (_) {}
          audioHealthTimerRef.current = null;
          return;
        }
        try {
          const level = currentMic.getAudioLevel();
          if (typeof level === 'number' && level < 0.0005) {
            currentMic.setEnabled(false).then(() => currentMic.setEnabled(true)).catch(() => {});
          }
        } catch (_) {}
      }, 7000);
    }
    if (camTrack && localVideoRef.current) {
      camTrack.play(localVideoRef.current, { mirror: false });
      try {
        const v = localVideoRef.current.querySelector('video');
        if (v) {
          v.style.transform = 'none'; v.style.webkitTransform = 'none';
          v.classList?.remove?.('agora-video-player--mirror');
        }
      } catch (_) {}
    }
    if (!camTrack) {
      setCameraError(true);
    } else {
      setCameraError(false);
    }
  };

  const qualityToConfig = () => ({ width: 426, height: 240, frameRate: 24, bitrateMin: 280, bitrateMax: 700 });

  const applyQuality = async (q) => {
    try { localStorage.setItem('cc_video_quality', q); } catch (_) {}
    setSelectedQuality(q);
    const v = localTracksRef.current.video;
    const cfg = qualityToConfig(q);
    // Try live reconfig; if not supported, recreate track.
    try {
      if (v && typeof v.setEncoderConfiguration === 'function') {
        await v.setEncoderConfiguration(cfg);
        return;
      }
    } catch (_) {}
    // Fallback: recreate camera track if we have one
    if (v && v.getTrack && v.getTrack().kind === 'video') {
      const id = selectedCameraId || undefined;
      let newCam = null;
      try { newCam = await AgoraRTC.createCameraVideoTrack({ cameraId: id, encoderConfig: cfg }); } catch (_) {}
      const client = clientRef.current;
      if (newCam && client) {
        const toUnpub = [v];
        try { await client.unpublish(toUnpub); await client.publish([newCam]); } catch (_) {}
        localTracksRef.current.video = newCam;
        try { v.stop(); v.close(); } catch (_) {}
        if (localVideoRef.current) newCam.play(localVideoRef.current, { mirror: false });
      }
    }
  };

  // Load available audio devices
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
        
        // Set the first available audio device as default if none selected
        if (audioInputs.length > 0 && !selectedAudioDeviceId) {
          setSelectedAudioDeviceId(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting audio devices:', error);
        setAudioError('Could not access microphone. Please check your permissions.');
      }
    };
    
    getAudioDevices();
    
    // Listen for device changes
    useEffect(() => {
      // Initialize audio context
      const init = async () => {
        await initAudioContext();
      };
      init();
      
      // Add user gesture handler for audio context
      const handleUserGesture = async () => {
        try {
          await initAudioContext();
        } catch (e) {
          console.warn('Could not resume audio context:', e);
        }
      };
      
      // Set up user interaction listeners for audio context
      const interactionEvents = ['click', 'keydown', 'touchstart'];
      interactionEvents.forEach(event => {
        window.addEventListener(event, handleUserGesture, { once: true });
      });
      if (!callData?.channelName || !callData?.token) {
        console.warn('VCMdl: Missing credentials to join');
        return;
      }
      setIsConnecting(true);
      
      // Get Agora App ID
      const cred = await videoCallAPI.getCredentials();
      const appId = cred?.data?.appId;
      if (!appId) {
        toast.error('Agora App ID not configured');
        setIsConnecting(false);
        return;
      }

      // Create client with optimized settings
      const client = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'h264',
        audio: {
          AEC: true,      // Acoustic Echo Cancellation
          ANS: true,      // Automatic Noise Suppression
          AGC: true,      // Automatic Gain Control
          codec: 'aac',
          sampleRate: 48000,
          channelCount: 1,
          bitrate: 64,    // 64kbps for better voice quality
          stereo: false,
          audioProcessing: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        },
        // Optimized WebRTC configuration
        websocketRetryConfig: {
          timeout: 2000,
          timeoutFactor: 1.5,
          maxRetryCount: 3
        },
        // ICE servers for better NAT traversal
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        // Optimize for low-latency communication
        turnServer: {
          turnServerURL: 'turn:turn.agora.io:3478',
          username: 'agora',
          password: 'agora',
          udpport: 3478,
          tcpport: 3478,
          forceturn: false
        }
      clientRef.current = client;

      // Configure audio and video settings
      try {
        // Set audio profile for voice calls
        await client.setAudioProfile('speech_standard');
        
        // Enable dual stream for adaptive quality
        try {
          await client.enableDualStream();
          await client.setLowStreamParameter({
            width: 160,
            height: 90,
            framerate: 15,
            bitrate: 45
          });
        } catch (e) {
          console.warn('Dual stream not supported:', e);
        }
        
        // Set audio frame rate
        await client.setAudioFrameRate(24);
        
        // Enable audio volume indicator
        await client.enableAudioVolumeIndicator();
        
      } catch (e) {
        console.warn('Could not configure client settings:', e);
      }

      // Network quality monitoring
      client.on('network-quality', (stats) => {
        try {
          const { downlinkNetworkQuality, uplinkNetworkQuality } = stats;
          
          // Adjust audio bitrate based on network quality
          if (localTracksRef.current.audio) {
            if (uplinkNetworkQuality > 3) { // Poor network
              localTracksRef.current.audio.setBitrate(32);
            } else {
              localTracksRef.current.audio.setBitrate(64);
            }
          }
          
          // Log quality metrics
          console.log('Network quality - Downlink:', downlinkNetworkQuality, 'Uplink:', uplinkNetworkQuality);
          
        } catch (error) {
          console.error('Error handling network quality:', error);
        }
      });
      
      // Remote user handlers with improved error handling
      client.on('user-published', async (user, mediaType) => {
        console.log(`User ${user.uid} published ${mediaType}`);
        
        // Handle audio tracks
        if (mediaType === 'audio') {
          try {
            await client.subscribe(user, 'audio');
            const audioTrack = user.audioTrack;
            if (audioTrack) {
              await playRemoteAudio(audioTrack);
            }
          } catch (error) {
            console.error('Error subscribing to remote audio:', error);
          }
        }
        
        // Handle video tracks
        if (mediaType === 'video') {
          try {
            await client.subscribe(user, 'video');
            const videoTrack = user.videoTrack;
            if (videoTrack && remoteVideoRef.current) {
              videoTrack.play(remoteVideoRef.current);
            }
          } catch (error) {
            console.error('Error subscribing to remote video:', error);
          }
        }
        
        try {
          // Subscribe to the user's stream
          await client.subscribe(user, mediaType);
          console.log(`Subscribed to ${mediaType} for user ${user.uid}`);
          
          if (mediaType === 'video') {
            try {
              // Set video quality and fallback options
              await client.setRemoteVideoStreamType?.(user, 1); // Low quality stream
              await client.setStreamFallbackOption?.(user, 2);  // Auto-fallback based on network
              
              // Update remote stream state
              setRemoteStream(user);
              
              // Play the video track
              if (remoteVideoRef.current && user.videoTrack) {
                try {
                  // Clear previous video if any
                  remoteVideoRef.current.innerHTML = '';
                  // Play with hardware acceleration and proper scaling
                  await user.videoTrack.play(remoteVideoRef.current, { 
                    mirror: false,
                    fit: 'contain'
                  });
                  
                  // Ensure video element has proper styling
                  const videoElement = remoteVideoRef.current.querySelector('video');
                  if (videoElement) {
                    videoElement.style.width = '100%';
                    videoElement.style.height = '100%';
                    videoElement.style.objectFit = 'contain';
                  }
                  
                  console.log('Playing video track for user:', user.uid);
                } catch (e) {
                  console.error('Error playing video track:', e);
                  toast.error('Could not display video. Trying to reconnect...');
                }
              }
            } catch (e) {
              console.error('Error setting up video:', e);
            }
          }
          
          if (mediaType === 'audio') {
            const playAudioWithRetry = async (retryCount = 0) => {
              try {
                if (user.audioTrack) {
                  // Set volume and play
                  await user.audioTrack.setVolume(100);
                  await user.audioTrack.play();
                  console.log('Playing audio track for user:', user.uid);
                }
              } catch (e) {
                console.error('Error playing audio track:', e);
                
                // Retry up to 3 times with exponential backoff
                if (retryCount < 3) {
                  const delay = 500 * Math.pow(2, retryCount);
                  console.log(`Retrying audio in ${delay}ms...`);
                  setTimeout(() => playAudioWithRetry(retryCount + 1), delay);
                } else {
                  toast.error('Could not start audio. Please check your audio settings.');
                }
              }
            };
            
            // Start audio playback with retry
            playAudioWithRetry();
          }
          
          setParticipantCount((c) => Math.max(1, c + 1));
        } catch (e) {
          console.error(`Failed to handle ${mediaType} for user ${user.uid}:`, e);
        }
      });
      client.on('user-unpublished', (user, mediaType) => {
        console.log(`User ${user.uid} unpublished ${mediaType}`);
        
        if (mediaType === 'video') {
          setRemoteStream(null);
          console.log('Cleared remote video stream');
        }
        
        if (mediaType === 'audio') {
          try { 
            if (user.audioTrack) {
              console.log('Stopping audio track for user:', user.uid);
              user.audioTrack.stop();
              user.audioTrack.close();
            }
          } catch (e) {
            console.warn('Error stopping audio track:', e);
          }
        }
        
        setParticipantCount((c) => Math.max(1, c - 1));
        console.log('Participant count updated');
      });
      client.on('connection-state-change', async (curState, prevState) => {
        try {
          if (curState === 'CONNECTED') {
            // Re-publish local tracks after reconnect
            const c = clientRef.current;
            const { audio, video } = localTracksRef.current;
            const toPublish = [];
            if (audio) toPublish.push(audio);
            if (video) toPublish.push(video);
            if (c && toPublish.length) {
              try { await c.publish(toPublish); } catch (_) {}
            }
            // Re-subscribe any remote users
            const remotes = c?.remoteUsers || [];
            for (const ru of remotes) {
              try {
                if (ru.hasVideo) {
                  await c.subscribe(ru, 'video');
                  setRemoteStream(ru);
                  if (remoteVideoRef.current) {
                    try { remoteVideoRef.current.innerHTML = ''; } catch (_) {}
                    ru.videoTrack?.play(remoteVideoRef.current, { mirror: false });
                  }
                }
                if (ru.hasAudio && ru.audioTrack) {
                  await c.subscribe(ru, 'audio');
                  try {
                    await playRemoteAudio(ru.audioTrack);
                  } catch (e) {
                    console.error('Error playing remote audio on reconnect:', e);
                  }
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      });

      // Join channel with optimized options
      const uid = String(user?.id || user?._id);
      try {
        await client.setClientRole?.('host');
      } catch (_) {}
      try {
        await client.enableAudioVolumeIndicator?.();
      } catch (_) {}
      try {
        await client.join(appId, callData.channelName, callData.token || null, uid || null);
      } catch (joinError) {
        console.error('Join error:', joinError);
        // Retry join once
        try {
            await client.join(appId, callData.channelName, callData.token || null, uid || null);
        } catch (retryError) {
          throw retryError;
        }
      }

      // Automatically attempt to create/publish tracks (with permission preflight fallback)
      await preflightAndCreateTracks();

      // One-time republish after a short delay to handle edge cases where initial publish isn't seen by peer
      republishTimerRef.current = setTimeout(async () => {
        try {
          const c = clientRef.current;
          const { video, audio } = localTracksRef.current;
          if (c && (video || audio)) {
            const toUnpub = [];
            if (audio) toUnpub.push(audio);
            if (video) toUnpub.push(video);
            if (toUnpub.length) {
              try { await c.unpublish(toUnpub); } catch (_) {}
              try { await c.publish(toUnpub); } catch (_) {}
            }
          }
        } catch (_) {}
      }, 2500);

      // One-time replace camera track if remote video not received soon after
      replaceTimerRef.current = setTimeout(async () => {
        try {
          if (!remoteStream) {
            const c = clientRef.current;
            const { video } = localTracksRef.current;
            // Create a fresh camera track with the same low-bitrate config
            let newCam = null;
            try {
              newCam = await AgoraRTC.createCameraVideoTrack({
                encoderConfig: { width: 320, height: 240, frameRate: 15, bitrateMin: 120, bitrateMax: 200 }
              });
            } catch (_) {}
            if (newCam && c) {
              try { await newCam.setEnabled(true); } catch (_) {}
              const toUnpub = [];
              if (video) toUnpub.push(video);
              try {
                if (toUnpub.length) await c.unpublish(toUnpub);
                await c.publish([newCam]);
                localTracksRef.current.video = newCam;
                if (video) { try { video.stop(); video.close(); } catch (_) {} }
                if (localVideoRef.current) newCam.play(localVideoRef.current);
              } catch (_) {}
            }
          }
        } catch (_) {}
      }, 4000);

      // Fallback: subscribe to any already-published remote users
      const remotes = client.remoteUsers || [];
      for (const ru of remotes) {
        try {
          if (ru.hasVideo) {
            await client.subscribe(ru, 'video');
            setRemoteStream(ru);
            if (remoteVideoRef.current) {
              try { remoteVideoRef.current.innerHTML = ''; } catch (_) {}
              ru.videoTrack?.play(remoteVideoRef.current, { mirror: false });
            }
          }
          if (ru.hasAudio) {
            await client.subscribe(ru, 'audio');
            try {
              await ru.audioTrack?.setEnabled(true);
              await ru.audioTrack?.play();
              try {
                await ru.audioTrack?.setVolume(100);
              } catch (_) {}
            } catch (e) {
              console.error('Error playing remote audio:', e);
            }
          }
        } catch (e) {
          // keep UI running; errors will be visible in console
        }
      }

      // Retry subscribe a few times in case remote publishes shortly after join
      let attempts = 0;
      resubTimerRef.current = setInterval(async () => {
        attempts += 1;
        if (attempts > 5) {
          clearInterval(resubTimerRef.current);
          resubTimerRef.current = null;
          return;
        }
        try {
          const rem = client.remoteUsers || [];
          for (const u of rem) {
            if (u.hasVideo && !remoteStream) {
              await client.subscribe(u, 'video');
              setRemoteStream(u);
              if (remoteVideoRef.current) {
                try { remoteVideoRef.current.innerHTML = ''; } catch (_) {}
                u.videoTrack?.play(remoteVideoRef.current);
              }
            }
            if (u.hasAudio && u.audioTrack) {
              await client.subscribe(u, 'audio');
              try {
                await playRemoteAudio(u.audioTrack);
              } catch (e) {
                console.error('Error playing audio in retry:', e);
              }
            }
          }
        } catch (_) {}
      }, 1000);

      setIsConnected(true);
      setIsConnecting(false);

      // Start duration timer
      let seconds = 0;
      durationTimerRef.current = setInterval(() => {
        seconds += 1;
        setDuration(seconds);
      }, 1000);
    } catch (e) {
      console.error('VCMdl: failed to join/publish', e);
      // Do not hard fail if permissions denied; user can still receive remote
      setIsConnecting(false);
    }
  };

  const cleanupCall = async () => {
    try {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (resubTimerRef.current) {
        clearInterval(resubTimerRef.current);
        resubTimerRef.current = null;
      }
      if (republishTimerRef.current) {
        clearTimeout(republishTimerRef.current);
        republishTimerRef.current = null;
      }
      if (replaceTimerRef.current) {
        clearTimeout(replaceTimerRef.current);
        replaceTimerRef.current = null;
      }
      if (audioHealthTimerRef.current) {
        clearInterval(audioHealthTimerRef.current);
        audioHealthTimerRef.current = null;
      }
      const client = clientRef.current;
      const { audio, video } = localTracksRef.current;
      if (audio) {
        try { audio.stop(); audio.close(); } catch (_) {}
      }
      if (video) {
        try { video.stop(); video.close(); } catch (_) {}
      }
      localTracksRef.current = { audio: null, video: null };
      if (client) {
        try { await client.leave(); } catch (_) {}
        clientRef.current = null;
      }
      setIsConnected(false);
      setLocalStream(null);
      setRemoteStream(null);
      setParticipantCount(1);
      setDuration(0);
    } catch (e) {
      console.warn('VCMdl: cleanup error', e);
    }
  };

  // Auto-join when credentials are present and modal is open
  useEffect(() => {
    if (!isOpen) {
      // Cleanup when modal closes
      cleanupCall();
      return;
    }
    if (callData?.token && callData?.channelName) {
      joinAndSetup();
    }
    return () => {
      // Cleanup on unmount/close
      cleanupCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, callData?.token, callData?.channelName]);

  // Resume video if tab returns to visible
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === 'visible') {
        const { video } = localTracksRef.current;
        try {
          if (video) await video.setEnabled(true);
        } catch (_) {}
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

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

  const switchCamera = async (cameraId) => {
    try { localStorage.setItem('cc_camera_id', cameraId || ''); } catch (_) {}
    setSelectedCameraId(cameraId);
    const client = clientRef.current;
    const current = localTracksRef.current.video;
    let newCam = null;
    try {
      newCam = await AgoraRTC.createCameraVideoTrack({ cameraId, encoderConfig: qualityToConfig(selectedQuality), optimizationMode: 'detail' });
    } catch (_) {}
    if (newCam && client) {
      try { await newCam.setEnabled(true); } catch (_) {}
      const toUnpub = [];
      if (current) toUnpub.push(current);
      try {
        if (toUnpub.length) await client.unpublish(toUnpub);
        await client.publish([newCam]);
        localTracksRef.current.video = newCam;
        if (current) { try { current.stop(); current.close(); } catch (_) {} }
        if (localVideoRef.current) newCam.play(localVideoRef.current);
        setCameraError(false);
      } catch (_) {}
    }
  };

  const useScreenAsVideo = async () => {
    const client = clientRef.current;
    if (!client) return;
    
    // Get current tracks
    const currentVideo = localTracksRef.current.video;
    const currentAudio = localTracksRef.current.audio;
    
    try {
      // First, try to get screen sharing track
      let screenTrackObj = null;
      try {
        screenTrackObj = await AgoraRTC.createScreenVideoTrack({ 
          encoderConfig: qualityToConfig(selectedQuality), 
          optimizationMode: 'detail' 
        }, 'disable'); // 'disable' to not include audio from screen sharing
      } catch (error) {
        console.error('Failed to create screen track:', error);
        toast.error('Failed to start screen sharing. Please check your browser permissions.');
        return;
      }
      
      const screenTrack = Array.isArray(screenTrackObj) ? screenTrackObj[0] : screenTrackObj;
      if (!screenTrack) return;
      
      // Store the current video track to restore later
      const previousVideoTrack = currentVideo;
      
      // Unpublish current video track if exists
      const toUnpublish = [];
      if (currentVideo) toUnpublish.push(currentVideo);
      
      try {
        // Unpublish current video
        if (toUnpublish.length > 0) {
          await client.unpublish(toUnpublish);
        }
        
        // Publish screen share track
        await client.publish([screenTrack]);
        
        // Update local tracks reference
        localTracksRef.current.video = screenTrack;
        
        // Stop and clean up the previous video track
        if (previousVideoTrack) {
          try { 
            previousVideoTrack.stop(); 
            previousVideoTrack.close(); 
          } catch (e) {
            console.warn('Error stopping previous video track:', e);
          }
        }
        
        // Play the screen share in the local video element
        if (localVideoRef.current) {
          try {
            localVideoRef.current.innerHTML = ''; // Clear any existing video elements
            screenTrack.play(localVideoRef.current, { mirror: false });
          } catch (e) {
            console.error('Error playing screen track:', e);
          }
        }
        
        // Update UI state
        setCameraError(false);
        setIsVideoOff(false); // Make sure video is enabled for screen sharing
        
        // Add event listener to detect when screen sharing is stopped
        const handleScreenShareEnded = () => {
          // Clean up the screen track
          try {
            screenTrack.close();
            localTracksRef.current.video = null;
            
            // Re-enable camera if needed
            if (localVideoRef.current) {
              localVideoRef.current.innerHTML = '';
            }
            
            // Show message to user
            toast.info('Screen sharing ended');
          } catch (e) {
            console.error('Error cleaning up screen share:', e);
          }
        };
        
        // Listen for screen sharing stop events
        const track = screenTrack.getVideoTrack ? screenTrack.getVideoTrack() : null;
        if (track) {
          track.onended = handleScreenShareEnded;
        }
        
        // Also listen for the browser's built-in screen sharing end event
        document.addEventListener('visibilitychange', handleScreenShareEnded, { once: true });
        
      } catch (error) {
        console.error('Error during screen sharing setup:', error);
        toast.error('Failed to start screen sharing');
        
        // Clean up if something went wrong
        try { screenTrack.close(); } catch (_) {}
        
        // Try to restore camera if available
        if (previousVideoTrack) {
          try {
            await client.publish([previousVideoTrack]);
            localTracksRef.current.video = previousVideoTrack;
            if (localVideoRef.current) {
              previousVideoTrack.play(localVideoRef.current, { mirror: false });
            }
          } catch (e) {
            console.error('Failed to restore camera after screen share error:', e);
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error in useScreenAsVideo:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleAccept = () => {
    if (onAcceptCall && callData) onAcceptCall(callData);
  };

  const handleReject = () => {
    if (onRejectCall && callData) onRejectCall(callData);
  };

  const handleEndCall = async () => {
    await cleanupCall();
    if (onEndCall) onEndCall();
  };

  if (!isOpen) {
    return null;
  }

  // Render modal

  const getDisplayName = (person) => {
    if (!person) return 'Unknown';
    return person.name || person.usn || person.id || 'Unknown';
  };

  const otherName = isIncoming 
    ? getDisplayName(callData?.caller)
    : getDisplayName(callData?.receiver);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isIncoming && !callData?.token ? 'Incoming Call' : isConnected ? 'In Call' : 'Calling...'}
            </h2>
            <p className="text-sm text-gray-600">
              {isIncoming ? `From ${otherName}` : `To ${otherName}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Camera selector */}
            {cameras && cameras.length > 0 && (
              <select
                value={selectedCameraId}
                onChange={(e) => switchCamera(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                title="Select camera"
              >
                {cameras.map((c) => (
                  <option key={c.deviceId} value={c.deviceId}>{c.label || 'Camera'}</option>
                ))}
              </select>
            )}
            {/* Screen fallback */}
            <button
              onClick={useScreenAsVideo}
              className={`px-2 py-1 text-sm rounded border ${cameraError ? 'border-red-500 text-red-600' : 'border-gray-300 text-gray-700'} hover:bg-gray-100`}
              title="Use screen as video"
            >
              {cameraError ? 'Use Screen as Video (camera busy)' : 'Use Screen as Video'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="relative bg-gray-900 aspect-video">
          {/* Remote video */}
          <div ref={remoteVideoRef} className="w-full h-full" />
          {/* Local preview */}
          <div className="absolute bottom-4 right-4 w-48 h-28 bg-black rounded overflow-hidden shadow">
            <div ref={localVideoRef} className="w-full h-full" />
          </div>

          {/* Connecting overlay */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p>Connecting...</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gray-50 flex items-center justify-center space-x-4">
          {isIncoming && !callData?.token ? (
            <>
              <button onClick={handleAccept} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                <Phone className="w-5 h-5" /> Accept
              </button>
              <button onClick={handleReject} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
                <PhoneOff className="w-5 h-5" /> Reject
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleMicrophone}
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isAudioEnabled ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-red-600 text-white'
                }`}
                title={isAudioEnabled ? 'Mute' : 'Unmute'}
              >
                {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>

              <button
                onClick={async () => {
                  try {
                    const client = clientRef.current;
                    const { audio } = localTracksRef.current;
                    
                    // Stop and remove existing audio track
                    if (audio) {
                      try {
                        if (client) {
                          await client.unpublish([audio]);
                        }
                        audio.close();
                      } catch (e) {
                        console.warn('Error removing old audio track:', e);
                      }
                      localTracksRef.current.audio = null;
                    }
                    
                    // Create and publish new audio track
                    try {
                      const newAudio = await AgoraRTC.createMicrophoneAudioTrack({
                        AEC: true,
                        ANS: true,
                        AGC: true,
                        encoderConfig: 'music_standard'
                      });
                      
                      if (newAudio) {
                        await newAudio.setEnabled(true);
                        await newAudio.setVolume(100);
                        
                        if (client) {
                          await client.publish([newAudio]);
                        }
                        
                        localTracksRef.current.audio = newAudio;
                        setIsMuted(false);
                        toast.success('Microphone reconnected');
                      }
                    } catch (e) {
                      console.error('Failed to create new audio track:', e);
                      toast.error('Could not reconnect microphone. Please check permissions.');
                    }
                  } catch (error) {
                    console.error('Error in audio retry:', error);
                    toast.error('Failed to fix audio. Please try again.');
                  }
                }}
                className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                title="Retry Audio"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>

              <button
                onClick={async () => {
                  const t = localTracksRef.current.video;
                  if (!t) return;
                  const newVideoOffState = !isVideoOff;
                  try {
                    await t.setEnabled(!newVideoOffState); // Enable when not off, disable when off
                    setIsVideoOff(newVideoOffState);
                  } catch (e) {
                    console.error('Error toggling video:', e);
                    toast.error('Failed to toggle video');
                  }
                }}
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isVideoOff ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>

              <button onClick={handleEndCall} className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700">
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCallModal;