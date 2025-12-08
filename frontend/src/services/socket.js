import { io } from 'socket.io-client';
import useChatStore from '../store/chatStore.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentRooms = new Set();
    this.lastToken = null;
    this._playTick = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } catch (_) {}
    };
  }

  connect(token) {
    if (this.socket) {
      try {
        if (!token && !this.lastToken) {
          const raw = localStorage.getItem('campusconnect-auth');
          if (raw) {
            const parsed = JSON.parse(raw);
            this.lastToken = parsed?.state?.token || null;
          }
        }
      } catch (_) {}
      this.lastToken = token || this.lastToken || null;
      if (this.isConnected && this.socket) {
        if (this.lastToken) {
          this.socket.emit('authenticate', this.lastToken);
        }
        return;
      }
    }
    // Resolve token: prefer param, then previous, then from localStorage
    try {
      if (!token && !this.lastToken) {
        const raw = localStorage.getItem('campusconnect-auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          this.lastToken = parsed?.state?.token || null;
        }
      }
    } catch (_) {}
    this.lastToken = token || this.lastToken || null;

    const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      // Pass token at connect-time as well (server may use handshake auth)
      auth: { token: this.lastToken }
    });

    // Core lifecycle
    this.socket.on('connect', () => {
      console.log('🔌 Connected to server');
      this.isConnected = true;
      // Authenticate first
      if (this.lastToken) {
        this.socket.emit('authenticate', this.lastToken);
      }
      // Then rejoin any rooms
      this.currentRooms.forEach((roomId) => this.socket.emit('join', roomId));
    });
    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
      this.isConnected = false;
    });
    this.socket.on('reconnect', () => {
      console.log('🔌 Reconnected to server');
      this.isConnected = true;
      // Re-authenticate on reconnect
      if (this.lastToken) {
        this.socket.emit('authenticate', this.lastToken);
      }
    });

    // Connection/auth errors
    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket connect_error:', err?.message || err);
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('token') || msg.includes('expired') || msg.includes('invalid')) {
        try { localStorage.removeItem('campusconnect-auth'); } catch (_) {}
        // Hard redirect to login
        window.location.href = '/login';
      }
    });

    // Messaging
    this.socket.on('new_message', (data) => {
      const { addMessage, updateUnreadCount, currentChat, unreadCounts } = useChatStore.getState();
      addMessage(data.message);
      if (!currentChat || currentChat._id !== data.chatId) {
        const currentCount = unreadCounts[data.chatId] || 0;
        updateUnreadCount(data.chatId, currentCount + 1);
      }
      // Notify only on incoming (not sent by me)
      const myId = (() => {
        try {
          const raw = localStorage.getItem('campusconnect-auth');
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed?.state?.user?._id || parsed?.state?.user?.id || null;
        } catch (_) { return null; }
      })();
      const senderId = data?.message?.senderId || data?.message?.sender?._id || data?.message?.sender;
      const isIncoming = senderId && myId && String(senderId) !== String(myId);
      if (isIncoming || !senderId) {
        this._playTick();
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const title = data?.message?.senderName || 'New message';
            const body = data?.message?.content || 'You have a new message';
            new Notification(title, { body });
          }
        } catch (_) {}
      }
    });

    // Presence snapshots and deltas
    this.socket.on('online_users', (users) => {
      try {
        const { setOnlineUsers } = useChatStore.getState();
        setOnlineUsers(users || []);
        console.log('🟢 Online users synced:', users);
      } catch (e) {
        console.error('Error setting online users:', e);
      }
    });
    this.socket.on('user_typing', (data) => {
      const { setTypingUser } = useChatStore.getState();
      setTypingUser(data.userId, data.isTyping);
    });
    this.socket.on('user_online', (userId) => {
      const { addOnlineUser } = useChatStore.getState();
      addOnlineUser(userId);
    });
    this.socket.on('user_offline', (userId) => {
      const { removeOnlineUser } = useChatStore.getState();
      removeOnlineUser(userId);
    });

    // Acks and errors
    this.socket.on('message_sent', (data) => {
      console.log('✅ Message sent successfully:', data);
    });
    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    // Custom auth error from server during explicit authenticate flow
    this.socket.on('auth_error', (payload) => {
      console.error('❌ Socket auth error:', payload);
      try { localStorage.removeItem('campusconnect-auth'); } catch (_) {}
      window.location.href = '/login';
    });

    // Video call ended by other participant
    this.socket.on('call_ended', (data) => {
      console.log('📞 Call ended by other participant:', data);
      // Dispatch custom event that CallStudio can listen to
      window.dispatchEvent(new CustomEvent('call_ended', { detail: data }));
    });

    // Authenticate if we already have token in first connect flow
    if (this.lastToken) {
      this.socket.emit('authenticate', this.lastToken);
    }
  }

  joinRoom(roomId) {
    if (this.socket && this.isConnected && roomId) {
      console.log('🚪 Joining room:', roomId);
      this.socket.emit('join', roomId);
      this.currentRooms.add(roomId);
    }
  }

  leaveRoom(roomId) {
    if (this.socket && this.isConnected && roomId) {
      console.log('🚪 Leaving room:', roomId);
      this.socket.emit('leave', roomId);
      this.currentRooms.delete(roomId);
    }
  }

  sendMessage(chatId, senderId, content, messageType = 'text') {
    if (this.socket && this.isConnected) {
      console.log('📤 Sending message:', { chatId, senderId, content, messageType });
      this.socket.emit('send_message', {
        chatId,
        senderId,
        content,
        messageType
      });
    } else {
      console.error('❌ Socket not connected, cannot send message');
    }
  }

  startTyping(chatId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', { chatId, userId, isTyping: true });
    }
  }

  stopTyping(chatId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', { chatId, userId, isTyping: false });
    }
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentRooms.clear();
    }
  }

  isSocketConnected() {
    return this.isConnected && this.socket;
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      rooms: Array.from(this.currentRooms)
    };
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService; 