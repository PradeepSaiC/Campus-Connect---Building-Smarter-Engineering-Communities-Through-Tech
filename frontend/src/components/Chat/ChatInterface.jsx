import { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../../services/api.js';
import useChatStore from '../../store/chatStore.js';
import useAuthStore from '../../store/authStore.js';
import socketService from '../../services/socket.js';
import { toast } from 'react-hot-toast';
import notify from '../../services/notify.js';
import { 
  Send, 
  Search, 
  Video, 
  Image, 
  Paperclip,
  Smile,
  X
} from 'lucide-react';
import videoCallAPI from '../../services/videoCallAPI.js';

const ChatInterface = function() {
  const { user, token } = useAuthStore();
  const { 
    chats, 
    currentChat, 
    messages, 
    setChats, 
    setCurrentChat,
    setMessages,
    addMessage,
    onlineUsers,
    typingUsers,
    unreadCounts,
    markChatAsRead
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const imageInputRef = useRef(null);
  // Removed connect gating
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const suppressNotifyRef = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    if (token) {
      socketService.connect(token);
    }

    // Do not disconnect here; socketService is shared across app (e.g., video calls)
    return () => {};
  }, [token]);

  // Ask for desktop notification permission early (non-blocking)
  useEffect(() => {
    try { if ('Notification' in window && Notification.permission === 'default') { Notification.requestPermission(); } } catch (_) {}
  }, []);

  useEffect(() => {
    fetchChats();
  }, []);

  // Listen for profile updates to refresh chat participants
  useEffect(() => {
    const handleProfileUpdate = () => {
      // Refresh chats when profile is updated
      fetchChats();
      // If current chat is open, refresh messages to get updated sender photos
      if (currentChat) {
        fetchMessages(currentChat._id);
      }
    };
    window.addEventListener('user_profile_updated', handleProfileUpdate);
    // Also listen to socket events for profile updates
    const s = socketService.socket;
    if (s) {
      s.on('user_profile_updated', handleProfileUpdate);
    }
    return () => {
      window.removeEventListener('user_profile_updated', handleProfileUpdate);
      if (s) {
        s.off('user_profile_updated', handleProfileUpdate);
      }
    };
  }, [currentChat]);

  // Allow other components to ask Chat to open a specific user chat
  useEffect(() => {
    const handler = async (e) => {
      const targetId = String(e?.detail?.userId || '');
      if (!targetId) return;
      // ensure chats available
      if (!Array.isArray(chats) || chats.length === 0) {
        await fetchChats();
      }
      const meId = user?.id;
      const findExisting = () => (useChatStore.getState().chats || []).find(c =>
        Array.isArray(c.participants) && c.participants.some(p => String(p._id) === targetId) &&
        c.participants.some(p => String(p._id) === String(meId))
      );
      let chat = findExisting();
      if (!chat) {
        // refetch once
        await fetchChats();
        chat = findExisting();
      }
      if (chat) {
        setCurrentChat(chat);
        markChatAsRead(chat._id);
        socketService.joinRoom(chat._id);
      }
    };
    window.addEventListener('open_chat_with', handler);
    return () => window.removeEventListener('open_chat_with', handler);
  }, [chats, user?.id]);

  // Image/emoji helpers
  const handlePickImage = () => {
    try { imageInputRef.current?.click(); } catch (_) {}
  };

  const handleImageSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentChat) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be < 5MB'); return; }
    const fd = new FormData();
    fd.append('file', file);
    try {
      setUploadingImage(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth'))?.state?.token || ''}`
        },
        body: fd
      });
      const ct = res.headers.get('content-type') || '';
      let data;
      if (ct.includes('application/json')) data = await res.json(); else { const text = await res.text(); throw new Error(text || 'Upload failed'); }
      if (!res.ok || !data?.url) throw new Error(data?.message || 'Upload failed');
      // Send image message
      socketService.sendMessage(
        currentChat._id,
        user.id,
        data.url,
        'image'
      );
      setTimeout(scrollToBottom, 100);
      toast.success('Image sent');
    } catch (err) {
      toast.error(err?.message || 'Failed to send image');
    } finally {
      setUploadingImage(false);
      try { e.target.value = ''; } catch (_) {}
    }
  };

  const EMOJIS = ['😀','😁','😂','🤣','😊','😍','🥳','👍','🙏','🔥','✨','🎉','💯','🫶'];
  const addEmoji = (emo) => {
    setMessageText((prev) => (prev || '') + emo);
    setEmojiOpen(false);
  };

  useEffect(() => {
    if (currentChat) {
      // Suppress the next new-message notification caused by loading messages
      // when user just selected/opened a chat
      suppressNotifyRef.current = true;
      fetchMessages(currentChat._id);
      markChatAsRead(currentChat._id);
      // Join chat room for real-time updates
      socketService.joinRoom(currentChat._id);
    }
  }, [currentChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await chatAPI.getChats();
      setChats(response.data);
    } catch (error) {
      console.error('Error fetching chats:', error);
      notify.error('Failed to load chats', { key: 'load_chats', ttlMs: 2500 });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId) => {
    try {
      const response = await chatAPI.getMessages(chatId);
      setMessages(response.data);
      try {
        const arr = response?.data || [];
        const last = arr.length ? arr[arr.length - 1] : null;
        if (last && last._id) {
          // Mark latest as already notified so opening a chat doesn't trigger a toast
          lastMessageIdRef.current = last._id;
        }
      } catch (_) {}
      // Clear one-shot suppression so future real-time messages notify normally
      suppressNotifyRef.current = false;
    } catch (error) {
      console.error('Error fetching messages:', error);
      notify.error('Failed to load messages', { key: `load_msgs_${chatId}`, ttlMs: 2500 });
    }
  };

  const handleChatSelect = (chat) => {
    setCurrentChat(chat);
    markChatAsRead(chat._id);
    // Join the specific chat room
    socketService.joinRoom(chat._id);
  };

  const handleStartVideoCall = async () => {
    if (!currentChat) return;
    
    try {
      const other = getOtherParticipant(currentChat);
      if (!other?._id) return;
      
      console.log('VC: Video call initiated', { 
        chatId: currentChat._id, 
        currentUser: user._id || user.id, 
        otherUser: other._id,
        otherName: other.name,
        chatStatus: currentChat.status 
      });
      
      const res = await videoCallAPI.initiateCall(other._id, false);
      toast.success(`Calling ${other.name}...`);
      if (res?.data?.callId) {
        try { window.open(`/call/${res.data.callId}?caller=1`, '_blank'); } catch (_) {}
      }
    } catch (error) {
      console.error('VC: initiate error', {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data
      });
      const status = error.response?.status;
      const msg = String(error.response?.data?.message || '').toLowerCase();
      if (status === 400 && msg.includes('already in progress')) {
        const other = currentChat ? getOtherParticipant(currentChat) : null;
        try {
          // Try to resume using payload first
          let callId = error.response?.data?.callId;
          let channelName = error.response?.data?.channelName;
          let token = error.response?.data?.token;
          if (!callId && other?._id) {
            const active = await videoCallAPI.getActiveForPeer(other._id);
            callId = active?.data?.callId || active?.data?._id || callId;
            channelName = active?.data?.channelName || channelName;
            token = active?.data?.token || token;
          }
          if (callId && (!channelName || !token)) {
            const cred = await videoCallAPI.getCallCredentials(callId);
            channelName = cred?.data?.channelName || channelName;
            token = cred?.data?.token || token;
          }
          if (channelName && token) {
            console.debug('VC: resuming existing call', { callId, channelName });
            window.dispatchEvent(new CustomEvent('open_video_call', {
              detail: { callId, channelName, token }
            }));
            return;
          }
        } catch (e) {
          console.warn('VC: resume attempt failed', e);
        }
        // If resume failed, ask to retry after connected
        toast.error('Call in progress. Try again.');
      } else {
        toast.error(`❌ ${error.response?.data?.message || 'Failed to initiate video call'}`);
      }
    }
  };

  // Removed connect handlers

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentChat || sending) return;

    try {
      setSending(true);

      // Send via socket
      socketService.sendMessage(
        currentChat._id,
        user.id,
        messageText.trim(),
        'text'
      );

      setMessageText('');
      setIsTyping(false);
      socketService.stopTyping(currentChat._id, user.id);
      
      // Scroll to bottom after sending
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      
    } catch (error) {
      console.error('Error sending message:', error);
      notify.error('Failed to send message', { key: 'send_msg', ttlMs: 2500 });
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    
    if (!isTyping && currentChat) {
      setIsTyping(true);
      socketService.startTyping(currentChat._id, user.id);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (currentChat) {
        socketService.stopTyping(currentChat._id, user.id);
      }
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    try {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
        return;
      }
    } catch (_) {}
    // Fallback
    try { messagesEndRef.current?.scrollIntoView({ block: 'end', inline: 'nearest' }); } catch (_) {}
  };

  // Desktop notification for new incoming messages
  const lastMessageIdRef = useRef(null);
  const openChatWithUser = (userId) => {
    try {
      window.dispatchEvent(new CustomEvent('open_chat_with', { detail: { userId } }));
    } catch (_) {}
  };

  useEffect(() => {
    if (!currentChat || !Array.isArray(messages) || messages.length === 0) return;
    if (suppressNotifyRef.current) { suppressNotifyRef.current = false; return; }
    const last = messages[messages.length - 1];
    if (!last || lastMessageIdRef.current === last._id) return;
    lastMessageIdRef.current = last._id;
    const isOwn = last?.sender?._id === user.id;
    if (isOwn) return;
    const senderName = last?.sender?.name || 'New message';
    const preview = String(last?.content || '').slice(0, 80) || 'Sent an attachment';
    toast.custom((t) => (
      <div
        className="pointer-events-auto bg-white text-gray-900 p-4 rounded-lg shadow-lg flex items-center gap-3 border border-gray-200 min-w-[280px]"
      >
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
          {last?.sender?.photoURL ? (
            <img
              src={last.sender.photoURL}
              alt={senderName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-primary-600">
              {senderName?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{senderName}</div>
          <div className="text-xs text-gray-600 truncate">{preview}</div>
        </div>
        <button
          onClick={() => {
            openChatWithUser(last?.sender?._id);
            try { toast.dismiss(t.id); } catch (_) {}
          }}
          className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded shadow hover:bg-primary-700"
        >
          View
        </button>
      </div>
    ), { id: `msg_${last._id}`, duration: 6000, position: 'top-right' });
  }, [messages, currentChat, user.id]);

  const getOtherParticipant = (chat) => {
    return chat.participants.find(p => p._id !== user.id);
  };

  const filteredChats = chats.filter(chat => {
    const otherParticipant = getOtherParticipant(chat);
    return otherParticipant?.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 opacity-70">Loading chats...</span>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] bg-base-100 rounded-xl shadow-sm border border-base-200 flex flex-col md:flex-row">
      {/* Chat List - Hidden on mobile when chat is open */}
      <div className={`md:w-80 border-r border-base-200 flex flex-col ${currentChat && 'hidden md:flex'}`}>
        {/* Search */}
        <div className="p-4 border-b border-base-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-50" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-bordered w-full pl-10"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-6 text-center opacity-70">
              <p>No chats found</p>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const otherParticipant = getOtherParticipant(chat);
              const isOnline = onlineUsers.has(otherParticipant?._id);
              const unreadCount = unreadCounts[chat._id] || 0;

              return (
                <div
                  key={chat._id}
                  onClick={() => handleChatSelect(chat)}
                  className={`p-4 border-b border-base-200 cursor-pointer transition-colors duration-200 ${
                    currentChat?._id === chat._id ? 'bg-base-300' : 'hover:bg-base-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-base-300 rounded-full flex items-center justify-center overflow-hidden">
                        {otherParticipant?.photoURL ? (
                          <img
                            src={otherParticipant.photoURL}
                            alt={otherParticipant?.name || 'User'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-primary-600 font-medium">
                            {otherParticipant?.name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        )}
                      </div>
                      {isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-base-100"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium truncate">
                          {otherParticipant?.name}
                        </h3>
                        {unreadCount > 0 && (
                          <span className="bg-primary-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm opacity-70 truncate">
                        {chat.lastMessage || 'No messages yet'}
                      </p>
                      <p className="text-xs opacity-50">
                        {chat.lastMessageTime ? formatTime(chat.lastMessageTime) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className={`flex-1 flex flex-col ${!currentChat && 'hidden md:flex'}`}>
        {currentChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-base-200 flex items-center justify-between bg-base-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-base-300 rounded-full flex items-center justify-center overflow-hidden">
                  {getOtherParticipant(currentChat)?.photoURL ? (
                    <img
                      src={getOtherParticipant(currentChat).photoURL}
                      alt={getOtherParticipant(currentChat)?.name || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-primary-600 font-medium">
                      {getOtherParticipant(currentChat)?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-medium">
                    {getOtherParticipant(currentChat)?.name}
                  </h3>
                  <p className="text-sm opacity-70">
                    {onlineUsers.has(getOtherParticipant(currentChat)?._id) ? '🟢 Online' : '⚫ Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleStartVideoCall}
                  disabled={!currentChat}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm ${
                    currentChat 
                      ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg' 
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                  title={
                    currentChat 
                      ? 'Start video call with ' + getOtherParticipant(currentChat)?.name 
                      : 'Chat request must be accepted first'
                  }
                >
                  <Video className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {currentChat ? 'Video Call' : 'Call Disabled'}
                  </span>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-base-200 chat-scrollbar chat-messages">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full opacity-70">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">💬</span>
                    </div>
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.sender._id === user.id;
                  return (
                    <div
                      key={message._id}
                      className={`flex message-bubble ${isOwnMessage ? 'message-own' : 'message-other'} items-end gap-2`}
                    >
                      {!isOwnMessage && (
                        <div className="w-8 h-8 bg-base-300 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {message.sender?.photoURL ? (
                            <img
                              src={message.sender.photoURL}
                              alt={message.sender?.name || 'User'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium text-primary-600">
                              {message.sender?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                        isOwnMessage
                          ? 'message-bubble-own'
                          : 'message-bubble-other'
                      }`}>
                        {message.messageType === 'image' ? (
                          <a href={message.content} target="_blank" rel="noreferrer">
                            <img src={message.content} alt="sent" className="max-h-64 rounded-lg object-contain" />
                          </a>
                        ) : (
                          <p className="text-sm leading-relaxed break-words">{message.content}</p>
                        )}
                        <div className={`flex items-center justify-end mt-2 space-x-1 ${
                          isOwnMessage ? 'text-primary-100' : 'opacity-60'
                        }`}>
                          <span className="text-xs">{formatTime(message.createdAt)}</span>
                          {isOwnMessage && (
                            <span className="text-xs">
                              {message.readBy?.length > 1 ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                      {isOwnMessage && (
                        <div className="w-8 h-8 bg-base-300 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {user?.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user?.name || 'You'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium text-primary-600">
                              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {typingUsers.has(getOtherParticipant(currentChat)?._id) && (
                <div className="flex justify-start">
                  <div className="bg-base-100 px-4 py-3 rounded-2xl rounded-bl-md border border-base-200 shadow-sm">
                    <div className="flex items-center space-x-1">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-base-content/50 rounded-full typing-dot"></div>
                        <div className="w-2 h-2 bg-base-content/50 rounded-full typing-dot"></div>
                        <div className="w-2 h-2 bg-base-content/50 rounded-full typing-dot"></div>
                      </div>
                      <span className="text-sm opacity-70 ml-2">Typing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-base-200 bg-base-100">
              <div className="flex items-end space-x-2">
                {/* Hidden input for image upload */}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
                <button className="p-2 rounded-lg hover:bg-base-200 transition-colors" onClick={handlePickImage} title="Send image" disabled={uploadingImage}>
                  <Image className={`w-4 h-4 ${uploadingImage ? 'animate-pulse opacity-60' : 'opacity-70'}`} />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    value={messageText}
                    onChange={handleTyping}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="textarea textarea-bordered w-full rounded-2xl resize-none max-h-32 chat-input"
                    rows={1}
                    disabled={sending}
                  />
                  {emojiOpen && (
                    <div className="absolute bottom-full mb-2 left-0 bg-base-100 border border-base-200 rounded-lg p-2 shadow z-10 flex flex-wrap gap-1 w-56">
                      {EMOJIS.map((e) => (
                        <button key={e} onClick={() => addEmoji(e)} className="text-xl hover:scale-110 transition-transform">{e}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="p-2 rounded-lg hover:bg-base-200 transition-colors" onClick={() => setEmojiOpen((v) => !v)} title="Emoji">
                  <Smile className="w-4 h-4 opacity-70" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sending}
                  className="p-3 rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center opacity-70 bg-base-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <p className="text-lg font-medium mb-2">Welcome to Campus Connect Chat!</p>
              <p className="text-sm">Select a chat to start messaging with your friends</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface; 