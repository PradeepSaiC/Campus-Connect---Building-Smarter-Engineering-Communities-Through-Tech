import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Share2, Share2Off, Users } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';
import videoCallAPI from '../../services/videoCallAPI.js';
import socketService from '../../services/socket.js';

const VideoCallNew = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  // State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [callDuration, setCallDuration] = useState(0);

  // Refs
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
  const screenTrackRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const durationTimerRef = useRef(null);

  // Initialize call
  useEffect(() => {
    const initCall = async () => {
      try {
        if (!token) {
          toast.error('Authentication required');
          return;
        }

        // Get Agora credentials
        const credRes = await videoCallAPI.getCredentials();
        const appId = credRes?.data?.appId;
        if (!appId) throw new Error('Agora App ID not found');

        // Get call credentials
        let channelName = '';
        let agoraToken = '';
        try {
          const callRes = await videoCallAPI.getCallCredentials(callId);
          channelName = callRes?.data?.channelName;
          agoraToken = callRes?.data?.token;
        } catch (e) {
          console.warn('Failed to get call credentials, trying accept flow');
          const acceptRes = await videoCallAPI.acceptCall(callId);
          channelName = acceptRes?.data?.channelName;
          agoraToken = acceptRes?.data?.token;
        }

        if (!channelName || !agoraToken) {
          throw new Error('Failed to get call credentials');
        }

        // Create Agora client
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' });
        clientRef.current = client;

        // Setup event handlers
        setupEventHandlers(client);

        // Join channel
        const uid = String(user?.id || user?._id || '');
        await client.join(appId, channelName, agoraToken, uid);

        // Create and publish tracks
        await createAndPublishTracks(client);

        setIsConnecting(false);
        toast.success('Connected to call');

        // Start duration timer
        let seconds = 0;
        durationTimerRef.current = setInterval(() => {
          seconds += 1;
          setCallDuration(seconds);
        }, 1000);

      } catch (error) {
        console.error('Call initialization failed:', error);
        toast.error('Failed to join call: ' + error.message);
        setIsConnecting(false);
      }
    };

    initCall();

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callId, token, user]);

  const setupEventHandlers = (client) => {
    client.on('user-published', async (remoteUser, mediaType) => {
      try {
        await client.subscribe(remoteUser, mediaType);

        if (mediaType === 'video') {
          setRemoteUsers(prev => {
            const exists = prev.find(u => u.uid === remoteUser.uid);
            if (exists) {
              return prev.map(u => u.uid === remoteUser.uid ? { ...u, videoTrack: remoteUser.videoTrack } : u);
            }
            return [...prev, { uid: remoteUser.uid, videoTrack: remoteUser.videoTrack, audioTrack: null }];
          });

          if (remoteVideoRef.current && remoteUser.videoTrack) {
            remoteVideoRef.current.innerHTML = '';
            remoteUser.videoTrack.play(remoteVideoRef.current);
          }
        }

        if (mediaType === 'audio') {
          try {
            await remoteUser.audioTrack?.setEnabled(true);
            await remoteUser.audioTrack?.play();
          } catch (e) {
            console.warn('Audio autoplay blocked, waiting for user gesture');
            const resume = () => {
              try { remoteUser.audioTrack?.play(); } catch (_) {}
              window.removeEventListener('click', resume);
            };
            window.addEventListener('click', resume, { once: true });
          }

          setRemoteUsers(prev =>
            prev.map(u => u.uid === remoteUser.uid ? { ...u, audioTrack: remoteUser.audioTrack } : u)
          );
        }
      } catch (error) {
        console.error('Failed to subscribe to remote user:', error);
      }
    });

    client.on('user-unpublished', (remoteUser, mediaType) => {
      if (mediaType === 'video') {
        setRemoteUsers(prev =>
          prev.map(u => u.uid === remoteUser.uid ? { ...u, videoTrack: null } : u)
        );
      }
      if (mediaType === 'audio') {
        try { remoteUser.audioTrack?.stop(); } catch (_) {}
        setRemoteUsers(prev =>
          prev.map(u => u.uid === remoteUser.uid ? { ...u, audioTrack: null } : u)
        );
      }
    });

    client.on('user-left', (remoteUser) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid));
    });
  };

  const createAndPublishTracks = async (client) => {
    try {
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true,
        encoderConfig: 'speech_standard'
      });

      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: 640, height: 480, frameRate: 24 }
      });

      localTracksRef.current = { audio: audioTrack, video: videoTrack };

      // Play local video
      if (localVideoRef.current && videoTrack) {
        videoTrack.play(localVideoRef.current);
      }

      // Publish tracks
      await client.publish([audioTrack, videoTrack]);
    } catch (error) {
      console.error('Failed to create tracks:', error);
      toast.error('Failed to access camera/microphone');
    }
  };

  const toggleMute = async () => {
    const audioTrack = localTracksRef.current.audio;
    const client = clientRef.current;
    if (!audioTrack || !client) return;

    try {
      if (!isMuted) {
        // Mute: unpublish audio
        await client.unpublish(audioTrack);
        await audioTrack.setEnabled(false);
        setIsMuted(true);
        toast.success('Microphone muted');
      } else {
        // Unmute: enable and republish audio
        await audioTrack.setEnabled(true);
        await client.publish(audioTrack);
        setIsMuted(false);
        toast.success('Microphone unmuted');
      }
    } catch (error) {
      console.error('Toggle mute failed:', error);
      toast.error('Failed to toggle microphone');
    }
  };

  const toggleVideo = async () => {
    const videoTrack = localTracksRef.current.video;
    if (!videoTrack) return;

    try {
      if (!isVideoOff) {
        await videoTrack.setEnabled(false);
        setIsVideoOff(true);
        toast.success('Camera turned off');
      } else {
        await videoTrack.setEnabled(true);
        setIsVideoOff(false);
        toast.success('Camera turned on');
      }
    } catch (error) {
      console.error('Toggle video failed:', error);
      toast.error('Failed to toggle camera');
    }
  };

  const toggleScreenShare = async () => {
    const client = clientRef.current;
    if (!client) return;

    try {
      if (!isScreenSharing) {
        // Start screen share
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: { width: 1920, height: 1080, frameRate: 30 }
        });

        screenTrackRef.current = screenTrack;
        const videoTrack = localTracksRef.current.video;

        if (videoTrack) {
          await client.unpublish(videoTrack);
        }

        await client.publish(screenTrack);

        if (localVideoRef.current) {
          localVideoRef.current.innerHTML = '';
          screenTrack.play(localVideoRef.current);
        }

        setIsScreenSharing(true);
        toast.success('Screen sharing started');
      } else {
        // Stop screen share
        const screenTrack = screenTrackRef.current;
        const videoTrack = localTracksRef.current.video;

        if (screenTrack) {
          await client.unpublish(screenTrack);
          screenTrack.stop();
          screenTrack.close();
          screenTrackRef.current = null;
        }

        if (videoTrack) {
          await client.publish(videoTrack);
          if (localVideoRef.current) {
            localVideoRef.current.innerHTML = '';
            videoTrack.play(localVideoRef.current);
          }
        }

        setIsScreenSharing(false);
        toast.success('Screen sharing stopped');
      }
    } catch (error) {
      console.error('Screen share toggle failed:', error);
      toast.error('Failed to toggle screen share');
    }
  };

  const endCall = async () => {
    try {
      const client = clientRef.current;
      const { audio, video } = localTracksRef.current;
      const screenTrack = screenTrackRef.current;

      if (audio) {
        try { await client?.unpublish(audio); audio.stop(); audio.close(); } catch (_) {}
      }
      if (video) {
        try { await client?.unpublish(video); video.stop(); video.close(); } catch (_) {}
      }
      if (screenTrack) {
        try { await client?.unpublish(screenTrack); screenTrack.stop(); screenTrack.close(); } catch (_) {}
      }

      if (client) {
        try { await client.leave(); } catch (_) {}
      }

      if (durationTimerRef.current) clearInterval(durationTimerRef.current);

      try {
        await videoCallAPI.endCall(callId);
      } catch (_) {}

      toast.success('Call ended');
      navigate('/');
    } catch (error) {
      console.error('End call failed:', error);
      toast.error('Failed to end call');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <Toaster />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium">Video Call</span>
          <span className="text-xs text-gray-400">{formatDuration(callDuration)}</span>
        </div>
        <div className="text-xs text-gray-400">
          {remoteUsers.length} participant{remoteUsers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
              <p className="text-gray-300">Connecting to call...</p>
            </div>
          </div>
        )}

        {/* Remote Video */}
        <div className="w-full h-full" ref={remoteVideoRef} />

        {/* Local Video - Picture in Picture */}
        <div className="absolute bottom-20 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700 shadow-lg">
          <div ref={localVideoRef} className="w-full h-full" />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-4 flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? <Share2Off className="w-6 h-6" /> : <Share2 className="w-6 h-6" />}
        </button>

        <button
          onClick={endCall}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all"
          title="End call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default VideoCallNew;
