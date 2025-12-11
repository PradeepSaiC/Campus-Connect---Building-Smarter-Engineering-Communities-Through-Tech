import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoCallAPI from '../../services/videoCallAPI.js';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';

const VideoCallModal = ({ isOpen, onClose, callData, isIncoming = false, isRinging = false, onAcceptCall, onRejectCall, onEndCall }) => {
  const { user } = useAuthStore();
  
  // State management for call controls and status
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [duration, setDuration] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(() => {
    try { return localStorage.getItem('cc_camera_id') || ''; } catch (_) { return ''; }
  });
  const [cameraError, setCameraError] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('good');
  const [selectedQuality, setSelectedQuality] = useState(() => {
    try { return localStorage.getItem('cc_video_quality') || 'hd'; } catch (_) { return 'hd'; }
  });
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'outgoing');

  const localVideoRef = useRef(null);
  const playRemoteAudio = async (track) => {
    if (!track) return;
    
    const playWithRetry = async (retryCount = 0) => {
      try {
        // Ensure track is enabled and set volume
        await track.setEnabled(true);
        if (typeof track.setVolume === 'function') {
          await track.setVolume(100);
        }
        
        // Try to play the track
        await track.play();
        console.log('Audio track is now playing');
      } catch (playError) {
        console.warn('Audio play error:', playError);
        
        // If we've retried too many times, show a message to the user
        if (retryCount >= 2) {
          toast('Click anywhere to enable audio', { 
            icon: '🔊',
            duration: 3000
          });
          
          // Set up a one-time click handler to resume audio
          const resumeAudio = async () => {
            try {
              await playWithRetry(0);
            } catch (e) {
              console.error('Failed to resume audio after click:', e);
            }
            window.removeEventListener('click', resumeAudio);
          };
          
          window.addEventListener('click', resumeAudio, { once: true });
          return;
        }
        
        // Retry with a small delay
        await new Promise(resolve => setTimeout(resolve, 500));
        await playWithRetry(retryCount + 1);
      }
    };
    
    try {
      await playWithRetry();
    } catch (err) {
      console.error('Error in playRemoteAudio:', err);
      if (err.name === 'NotAllowedError' || err.name === 'NotReadableError') {
        toast.error('Audio permission issue. Please check your browser settings.');
      }
    }
  };
  const remoteVideoRef = useRef(null);
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
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

  const preflightAndCreateTracks = async () => {
    const client = clientRef.current;
    if (!client) return;
    // First attempt
    let micTrack = null;
    let camTrack = null;
    
    // Request audio permissions first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks to release the stream
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.warn('Audio permission denied:', e);
      toast.error('Microphone access is required for audio. Please allow microphone access.');
    }

    try { 
      micTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true,
        encoderConfig: 'music_standard',
        // Force audio track to be enabled
        enabled: true
      });
      
      if (micTrack) {
        try { 
          await micTrack.setEnabled(true); 
          console.log('Microphone track enabled');
        } catch (e) { 
          console.error('Failed to enable microphone track:', e);
        }
        try { 
          await micTrack.setVolume(100); 
          console.log('Microphone volume set to 100%');
        } catch (e) { 
          console.warn('Failed to set microphone volume:', e);
        }
        console.log('Microphone track ready with audio enhancements');
      }
    } catch (e) {
      console.error('Failed to create microphone track:', e);
      toast.error('Failed to access microphone. Please check your audio settings.');
    }
    // Low-latency camera config (240p@24fps motion)
    const cfg = {
      // Lower resolution for better performance
      width: 640,
      height: 360,
      frameRate: 24,
      bitrateMin: 200,
      bitrateMax: 600,
      // Enable hardware acceleration
      optimizationMode: 'motion',
      // Better quality settings
      scalabiltyMode: 'S1T3',
      // Enable H.264 baseline profile for better compatibility
      codec: 'h264',
      codecConfig: {
        width: 640,
        height: 360,
        frameRate: 24,
        bitrateMin: 200,
        bitrateMax: 600,
        bitrate: 400,
        // Enable temporal scalability for better adaptation
        scalabilityMode: 'S1T3'
      },
      // Enable hardware acceleration
      hwAccel: 'prefer-hardware',
      // Better video processing
      processing: {
        denoise: true,
        deinterlace: true,
        stabilization: true
      }
    };
    
    try {
      camTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: cfg,
        cameraId: selectedCameraId || undefined,
        optimizationMode: 'motion',
        // Enable hardware acceleration
        hwAccel: 'prefer-hardware',
        // Better video processing
        processing: {
          denoise: true,
          deinterlace: true,
          stabilization: true
        }
      });
      
      console.log('Camera track created with config:', cfg);
    } catch (e1) {
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
      try {
        // Clear any existing video elements
        while (localVideoRef.current.firstChild) {
          localVideoRef.current.removeChild(localVideoRef.current.firstChild);
        }
        
        // Play the track with optimized settings
        await camTrack.play(localVideoRef.current, { 
          mirror: false,
          // Enable hardware acceleration
          hwaccel: 'prefer-hardware',
          // Optimize for low latency
          optimizationMode: 'motion',
          // Better scaling
          objectFit: 'cover'
        });
        
        // Apply additional styling for better rendering
        const v = localVideoRef.current.querySelector('video');
        if (v) {
          v.style.transform = 'none';
          v.style.webkitTransform = 'none';
          v.style.objectFit = 'cover';
          v.style.width = '100%';
          v.style.height = '100%';
          v.playsInline = true;
          v.muted = true;
          v.setAttribute('playsinline', 'true');
          v.classList?.remove?.('agora-video-player--mirror');
          
          // Force hardware acceleration if possible
          v.style.transform = 'translateZ(0)';
          v.style.webkitTransform = 'translateZ(0)';
        }
      } catch (error) {
        console.error('Error initializing video track:', error);
        setCameraError(true);
      }
    }
    if (!camTrack) {
      setCameraError(true);
    } else {
      setCameraError(false);
    }
  };

  const qualityToConfig = (q) => {
    switch (q) {
      case 'sd':
        return { width: 426, height: 240, frameRate: 24, bitrateMin: 200, bitrateMax: 700 };
      case 'hd':
        return { width: 1280, height: 720, frameRate: 24, bitrateMin: 800, bitrateMax: 2200 };
      case 'fullhd':
        return { width: 1920, height: 1080, frameRate: 30, bitrateMin: 1500, bitrateMax: 3500 };
      default:
        return { width: 640, height: 360, frameRate: 24, bitrateMin: 300, bitrateMax: 1200 };
    }
  };

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

  const joinAndSetup = useCallback(async () => {
    if (isConnecting || isConnected) return;
    
    try {
      if (!callData?.channelName || !callData?.token) {
        console.warn('VCMdl: Missing credentials to join');
        toast.error('Missing call credentials. Please try again.');
        return;
      }
      
      setCallStatus('connecting');
      setIsConnecting(true);
      
      // Get Agora App ID
      const cred = await videoCallAPI.getCredentials();
      const appId = cred?.data?.appId;
      if (!appId) {
        toast.error('Agora App ID not configured');
        setIsConnecting(false);
        return;
      }

      // Create client with optimized settings for better reliability
      const client = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'h264',
        // Enable audio processing for better quality
        audioProcessing: {
          AEC: true,
          AGC: true,
          ANS: true,
          AGC2: true,
          AEC2: true
        }
      });
      clientRef.current = client;
      
      // Configure client with error handling
      try { 
        await client.enableDualStream?.(); 
        console.log('Dual stream enabled');
      } catch (e) { 
        console.warn('Failed to enable dual stream:', e); 
      }
      
      try { 
        await client.setLowStreamParameter?.({
          width: 320,
          height: 180,
          frameRate: 15,
          bitrate: 200,
          bitrateMin: 100,
          bitrateMax: 300
        }); 
        console.log('Low stream parameters set');
      } catch (e) { 
        console.warn('Failed to set low stream parameters:', e); 
      }
      
      try { 
        await client.setAudioProfile?.('music_standard', 'speech_low_latency');
        console.log('Audio profile set');
      } catch (e) { 
        console.warn('Failed to set audio profile:', e); 
      }

      // Remote user handlers
      client.on('user-published', async (user, mediaType) => {
        console.log(`User ${user.uid} published ${mediaType}`);
        console.log('Has audio:', user.hasAudio, 'Has video:', user.hasVideo);
        
        try {
          await client.subscribe(user, mediaType);
          console.log(`Subscribed to ${mediaType} for user ${user.uid}`);
          
          if (mediaType === 'video') {
            // Force low stream and set audio-fallback for poor network
            try { 
              await client.setRemoteVideoStreamType?.(user, 1);
              console.log('Set remote video stream type to low for user:', user.uid);
            } catch (e) { 
              console.warn('Failed to set remote video stream type:', e);
            }
            
            try { 
              await client.setStreamFallbackOption?.(user, 2);
              console.log('Set stream fallback option for user:', user.uid);
            } catch (e) { 
              console.warn('Failed to set stream fallback option:', e);
            }
            
            setRemoteStream(user);
            if (remoteVideoRef.current) {
              try { 
                remoteVideoRef.current.innerHTML = ''; 
                user.videoTrack?.play(remoteVideoRef.current, { mirror: false });
                console.log('Playing video track for user:', user.uid);
              } catch (e) {
                console.error('Error playing video track:', e);
              }
            }
          }
          
          if (mediaType === 'audio') {
            try {
              if (user.audioTrack) {
                await playRemoteAudio(user.audioTrack);
                console.log('Successfully playing audio track for user:', user.uid);
              } else {
                console.warn('No audio track found for user:', user.uid);
              }
            } catch (e) {
              console.error('Error playing audio track:', e);
              setTimeout(async () => {
                try {
                  if (user.audioTrack) {
                    await playRemoteAudio(user.audioTrack);
                  }
                } catch (retryError) {
                  console.error('Retry audio play failed:', retryError);
                }
              }, 500);
            }
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
  }, [isConnecting, isConnected, callData, videoCallAPI, setCallStatus, setIsConnecting]);

  // Network quality monitoring
  const checkNetworkQuality = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    
    try {
      const stats = client.getRTCStats();
      // Simple network quality check based on packet loss and RTT
      if (stats?.RTT > 500 || stats?.packetLossRatio > 0.1) {
        setNetworkQuality('poor');
        // Automatically reduce quality if network is poor
        if (selectedQuality !== 'sd') {
          // Use the qualityToConfig function directly instead of applyQuality to avoid circular dependencies
          const cfg = { width: 640, height: 360, frameRate: 20, bitrateMin: 200, bitrateMax: 400 };
          const v = localTracksRef.current.video;
          if (v && typeof v.setEncoderConfiguration === 'function') {
            v.setEncoderConfiguration(cfg).catch(console.error);
          }
          setSelectedQuality('sd');
          try { localStorage.setItem('cc_video_quality', 'sd'); } catch (_) {}
        }
      } else {
        setNetworkQuality('good');
      }
    } catch (e) {
      console.warn('Error checking network quality:', e);
    }
  }, [selectedQuality]);

  useEffect(() => {
    if (!isConnected) return;
    
    const qualityInterval = setInterval(checkNetworkQuality, 5000);
    return () => clearInterval(qualityInterval);
  }, [isConnected, checkNetworkQuality]);

  const cleanupCall = useCallback(async () => {
    try {
      setCallStatus('disconnecting');
      
      // Clear all timers
      const clearTimer = (timerRef) => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
      
      [durationTimerRef, resubTimerRef, republishTimerRef, replaceTimerRef, audioHealthTimerRef].forEach(clearTimer);
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
  }, [setCallStatus, setIsConnected, setLocalStream, setRemoteStream, setParticipantCount, setDuration]);

  // Auto-join when credentials are present and modal is open
  useEffect(() => {
    if (!isOpen) {
      // Cleanup when modal closes
      cleanupCall();
      return;
    }
    
    // Reset states when modal opens
    setCallStatus(isIncoming ? 'incoming' : 'outgoing');
    setNetworkQuality('good');
    setAudioError(false);
    setCameraError(false);
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

  // Get call status text
  const getStatusText = () => {
    switch (callStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'In Call';
      case 'disconnecting':
        return 'Ending call...';
      case 'incoming':
        return 'Incoming Call';
      case 'outgoing':
        return 'Calling...';
      default:
        return 'Call';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden transition-all duration-300 ${
        callStatus === 'connected' ? 'ring-2 ring-green-500' : ''
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {getStatusText()}
              </h2>
              {networkQuality === 'poor' && (
                <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                  Poor Connection
                </span>
              )}
              {audioError && (
                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                  Audio Issue
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {isIncoming ? `From ${otherName}` : `To ${otherName}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Camera and quality controls */}
            <div className="flex items-center gap-2">
              {cameras && cameras.length > 0 && (
                <select
                  value={selectedCameraId}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                  title="Select camera"
                  disabled={isConnecting}
                >
                  {cameras.map((c) => (
                    <option key={c.deviceId} value={c.deviceId}>
                      {c.label || `Camera ${c.deviceId.slice(0, 4)}`}
                    </option>
                  ))}
                </select>
              )}
              
              <select
                value={selectedQuality}
                onChange={(e) => applyQuality(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                title="Video quality"
                disabled={isConnecting}
              >
                <option value="sd">SD (480p)</option>
                <option value="hd">HD (720p)</option>
                <option value="fhd">Full HD (1080p)</option>
              </select>
              
              <button
                onClick={useScreenAsVideo}
                className={`px-2 py-1 text-sm rounded border ${
                  cameraError 
                    ? 'border-red-500 text-red-600 bg-red-50' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                } transition-colors`}
                title="Share your screen"
                disabled={isConnecting}
              >
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {cameraError ? 'Screen Only' : 'Share Screen'}
                </span>
              </button>
            </div>
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
                onClick={async () => {
                  const t = localTracksRef.current.audio;
                  if (!t) return;
                  const newMutedState = !isMuted;
                  try {
                    await t.setEnabled(!newMutedState); // Enable when not muted, disable when muted
                    setIsMuted(newMutedState);
                  } catch (e) {
                    console.error('Error toggling microphone:', e);
                    toast.error('Failed to toggle microphone');
                  }
                }}
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isMuted ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
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