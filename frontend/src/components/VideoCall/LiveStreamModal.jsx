import { useState, useEffect, useRef } from 'react';
import { X, Video, VideoOff, Mic, MicOff, Users, Settings, Share } from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import videoCallAPI from '../../services/videoCallAPI.js';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';

const LiveStreamModal = ({ isOpen, onClose, streamData, isViewer = false }) => {
  const { user } = useAuthStore();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [agoraClient, setAgoraClient] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (isOpen && streamData) {
      if (isViewer) {
        joinAsViewer();
      } else {
        initializeStream();
      }
    }
    
    return () => {
      leaveStream();
    };
  }, [isOpen, streamData, isViewer]);

  const initializeStream = async () => {
    try {
      setIsConnecting(true);
      const credentials = await videoCallAPI.getCredentials();
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      setAgoraClient(client);

      // Set client role as host
      await client.setClientRole('host');

      // Handle user joined events
      client.on('user-joined', (user) => {
        setViewerCount(prev => prev + 1);
      });

      client.on('user-left', (user) => {
        setViewerCount(prev => Math.max(0, prev - 1));
      });

      // Join the channel
      await client.join(credentials.data.appId, streamData.channelName, streamData.token, user.id);
      
      // Create and publish local stream
      const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      const localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      
      await client.publish([localAudioTrack, localVideoTrack]);
      
      setLocalStream({ audioTrack: localAudioTrack, videoTrack: localVideoTrack });
      if (localVideoRef.current) {
        localVideoTrack.play(localVideoRef.current);
      }
      setIsConnecting(false);
      
    } catch (error) {
      console.error('Error initializing stream:', error);
      toast.error('Failed to start live stream');
      setIsConnecting(false);
    }
  };

  const joinAsViewer = async () => {
    try {
      setIsConnecting(true);
      const response = await videoCallAPI.joinStream(streamData.callId);
      const credentials = await videoCallAPI.getCredentials();
      
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      setAgoraClient(client);

      // Set client role as audience
      await client.setClientRole('audience');

      // Handle host published events
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video') {
          setRemoteStream(user);
          if (remoteVideoRef.current) {
            user.videoTrack?.play(remoteVideoRef.current);
          }
        }
        if (mediaType === 'audio') {
          user.audioTrack.play();
        }
      });

      client.on('user-unpublished', (user) => {
        setRemoteStream(null);
      });

      // Join the channel
      await client.join(credentials.data.appId, response.data.channelName, response.data.token, user.id);
      setViewerCount(response.data.viewers);
      setIsConnecting(false);
      
    } catch (error) {
      console.error('Error joining stream:', error);
      toast.error('Failed to join live stream');
      setIsConnecting(false);
    }
  };

  const leaveStream = async () => {
    try {
      if (agoraClient) {
        await agoraClient.leave();
      }
      if (localStream) {
        localStream.audioTrack?.close();
        localStream.videoTrack?.close();
      }
      if (isViewer) {
        await videoCallAPI.leaveStream(streamData.callId);
      }
    } catch (error) {
      console.error('Error leaving stream:', error);
    }
  };

  const toggleMute = () => {
    if (localStream?.audioTrack) {
      if (isMuted) {
        localStream.audioTrack.setEnabled(true);
      } else {
        localStream.audioTrack.setEnabled(false);
      }
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream?.videoTrack) {
      if (isVideoOff) {
        localStream.videoTrack.setEnabled(true);
      } else {
        localStream.videoTrack.setEnabled(false);
      }
      setIsVideoOff(!isVideoOff);
    }
  };

  const shareStream = () => {
    const streamUrl = `${window.location.origin}/stream/${streamData.callId}`;
    navigator.clipboard.writeText(streamUrl);
    toast.success('Stream link copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isViewer ? 'Live Stream' : 'Live Streaming'}
              </h2>
              <p className="text-sm text-gray-600">
                {streamData?.streamTitle || 'Untitled Stream'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isViewer && (
              <button
                onClick={shareStream}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                title="Share Stream"
              >
                <Share className="w-5 h-5 text-gray-500" />
              </button>
            )}
            <div className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded-full">
              <Users className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-600">{viewerCount}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="relative bg-gray-900 aspect-video">
          {/* Main Video */}
          <div
            ref={isViewer ? remoteVideoRef : localVideoRef}
            className="w-full h-full"
          />
          
          {/* No secondary local preview needed; main element already shows streamer video */}

          {/* Stream Status */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p>{isViewer ? 'Joining stream...' : 'Starting stream...'}</p>
              </div>
            </div>
          )}

          {/* Live Indicator */}
          <div className="absolute top-4 left-4 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>LIVE</span>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 bg-gray-50">
          {!isViewer ? (
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isMuted ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isVideoOff ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
              
              <button
                onClick={onClose}
                className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700"
              >
                <VideoOff className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Leave Stream
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveStreamModal; 