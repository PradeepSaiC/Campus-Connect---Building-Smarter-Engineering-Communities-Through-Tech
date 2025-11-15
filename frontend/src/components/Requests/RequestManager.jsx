import { useState, useEffect } from 'react';
import { chatRequestAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import socketService from '../../services/socket.js';

import { 
  MessageCircle, 
  Check, 
  X, 
  Clock, 
  User,
  Send
} from 'lucide-react';

const RequestManager = () => {
  const [chatRequests, setChatRequests] = useState({ received: [], sent: [] });
  const [loading, setLoading] = useState(true);
  const [selectedRequestType, setSelectedRequestType] = useState('received');

  useEffect(() => {
    fetchRequests();
    let mounted = true;
    const interval = setInterval(() => {
      if (mounted) fetchRequests();
    }, 15000);
    const onFocus = () => fetchRequests();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const s = socketService.isSocketConnected() ? socketService.socket : null;
    if (s) {
      const events = [
        'chat_request_created','chat_request_updated','chat_request_deleted'
      ];
      events.forEach(ev => s.on(ev, fetchRequests));
    }
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      const s2 = socketService.socket;
      if (s2) {
        const events = [
          'chat_request_created','chat_request_updated','chat_request_deleted'
        ];
        events.forEach(ev => s2.off(ev, fetchRequests));
      }
    };
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      // Fetch chat requests
      const [receivedChat, sentChat] = await Promise.all([
        chatRequestAPI.getRequests('received'),
        chatRequestAPI.getRequests('sent')
      ]);

      setChatRequests({
        received: receivedChat.data,
        sent: sentChat.data
      });
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('❌ Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToRequest = async (requestId, action) => {
    try {
      await chatRequestAPI.respondToRequest(requestId, action);
      
      toast.success(`✅ Request ${action}ed successfully`);
      fetchRequests();
    } catch (error) {
      console.error('Error responding to request:', error);
      toast.error(`❌ Failed to ${action} request`);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleString();
  };

  const getRequestStatusColor = (status) => {
    // Neutral badges for all statuses
    return 'bg-base-300 text-base-content/80';
  };

  const getCurrentRequests = () => {
    return chatRequests[selectedRequestType];
  };

  const renderRequestCard = (request) => {
    const isReceived = selectedRequestType === 'received';
    const otherUser = isReceived ? request.sender : request.receiver;
    const isPending = request.status === 'pending';

    return (
      <div key={request._id} className="bg-base-100 rounded-lg border border-base-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-base-300 rounded-full flex items-center justify-center">
              <span className="font-medium">
                {otherUser?.name?.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="font-medium">{otherUser?.name}</h3>
              <p className="text-sm opacity-70">{otherUser?.usn}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 opacity-70" />
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRequestStatusColor(request.status)}`}>
              {request.status}
            </span>
          </div>
        </div>

        {request.message && (
          <p className="text-sm opacity-80 mb-3 bg-base-200 p-3 rounded">
            "{request.message}"
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs opacity-70">
            {isReceived ? 'Received' : 'Sent'} on {formatTime(request.createdAt)}
          </div>

          {isReceived && isPending && (
            <div className="flex space-x-2">
              <button
                onClick={() => handleRespondToRequest(request._id, 'accept')}
                className="flex items-center space-x-1 px-3 py-1 rounded-lg btn btn-sm btn-success"
              >
                <Check className="w-4 h-4" />
                <span>Accept</span>
              </button>
              <button
                onClick={() => handleRespondToRequest(request._id, 'reject')}
                className="flex items-center space-x-1 px-3 py-1 rounded-lg btn btn-sm btn-error btn-outline"
              >
                <X className="w-4 h-4" />
                <span>Reject</span>
              </button>
            </div>
          )}

          {!isReceived && isPending && (
            <div className="flex items-center space-x-1 opacity-70">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Waiting for response</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-600">Loading requests...</span>
      </div>
    );
  }

  const currentRequests = getCurrentRequests();

  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Chat Requests</h2>
        <p className="opacity-70">Manage your chat requests</p>
      </div>

      {/* Request Type Toggle */}
      <div className="flex space-x-1 mb-6 bg-base-200 p-1 rounded-lg">
        <button
          onClick={() => setSelectedRequestType('received')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            selectedRequestType === 'received'
              ? 'bg-base-100 shadow-sm'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <User className="w-4 h-4" />
            <span>Received ({currentRequests.filter(r => r.status === 'pending').length})</span>
          </div>
        </button>
        <button
          onClick={() => setSelectedRequestType('sent')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            selectedRequestType === 'sent'
              ? 'bg-base-100 shadow-sm'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <Send className="w-4 h-4" />
            <span>Sent</span>
          </div>
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {currentRequests.length === 0 ? (
          <div className="text-center py-12 opacity-70">
            <div className="w-16 h-16 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 opacity-60" />
            </div>
            <p className="text-lg font-medium mb-2">
              No chat requests
            </p>
            <p>
              {selectedRequestType === 'received' 
                ? 'You have no pending requests'
                : 'You haven\'t sent any requests yet'
              }
            </p>
          </div>
        ) : (
          currentRequests.map(request => renderRequestCard(request))
        )}
      </div>
    </div>
  );
};

export default RequestManager; 