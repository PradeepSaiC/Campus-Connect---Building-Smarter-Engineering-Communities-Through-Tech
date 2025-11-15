import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  // State
  chats: [],
  currentChat: null,
  messages: [],
  onlineUsers: new Set(),
  typingUsers: new Set(),
  unreadCounts: {},

  // Actions
  setChats: (chats) => set({ chats }),
  
  addChat: (chat) => {
    const { chats } = get();
    const existingChat = chats.find(c => c._id === chat._id);
    if (!existingChat) {
      set({ chats: [chat, ...chats] });
    }
  },
  
  setCurrentChat: (chat) => set({ currentChat: chat }),
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => {
    const { messages, currentChat } = get();
    
    // Check if message already exists
    const messageExists = messages.find(m => m._id === message._id);
    if (messageExists) return;
    
    // Add message to current chat if it matches
    if (currentChat && message.chatId === currentChat._id) {
      set({ messages: [...messages, message] });
    }
    
    // Update chat's last message
    const { chats } = get();
    const updatedChats = chats.map(chat => {
      if (chat._id === message.chatId) {
        return {
          ...chat,
          lastMessage: message.content,
          lastMessageTime: message.createdAt || new Date()
        };
      }
      return chat;
    });
    set({ chats: updatedChats });
  },
  
  updateMessage: (messageId, updates) => {
    const { messages } = get();
    const updatedMessages = messages.map(msg => 
      msg._id === messageId ? { ...msg, ...updates } : msg
    );
    set({ messages: updatedMessages });
  },
  
  setOnlineUsers: (users) => set({ onlineUsers: new Set(users) }),
  
  addOnlineUser: (userId) => {
    const { onlineUsers } = get();
    const newOnlineUsers = new Set(onlineUsers);
    newOnlineUsers.add(userId);
    set({ onlineUsers: newOnlineUsers });
  },
  
  removeOnlineUser: (userId) => {
    const { onlineUsers } = get();
    const newOnlineUsers = new Set(onlineUsers);
    newOnlineUsers.delete(userId);
    set({ onlineUsers: newOnlineUsers });
  },
  
  setTypingUser: (userId, isTyping) => {
    const { typingUsers } = get();
    const newTypingUsers = new Set(typingUsers);
    if (isTyping) {
      newTypingUsers.add(userId);
    } else {
      newTypingUsers.delete(userId);
    }
    set({ typingUsers: newTypingUsers });
  },
  
  updateUnreadCount: (chatId, count) => {
    const { unreadCounts } = get();
    set({ unreadCounts: { ...unreadCounts, [chatId]: count } });
  },
  
  markChatAsRead: (chatId) => {
    const { unreadCounts } = get();
    const updated = { ...unreadCounts };
    delete updated[chatId];
    set({ unreadCounts: updated });
  },
  
  markMessageAsRead: (messageId) => {
    const { messages, currentChat } = get();
    if (!currentChat) return;
    
    const updatedMessages = messages.map(msg => {
      if (msg._id === messageId && !msg.readBy?.includes(currentChat._id)) {
        return {
          ...msg,
          readBy: [...(msg.readBy || []), currentChat._id]
        };
      }
      return msg;
    });
    set({ messages: updatedMessages });
  },
  
  clearChat: () => set({ currentChat: null, messages: [] }),
  
  clearAll: () => set({
    chats: [],
    currentChat: null,
    messages: [],
    onlineUsers: new Set(),
    typingUsers: new Set(),
    unreadCounts: {}
  }),

  // Getters
  getUnreadCount: (chatId) => {
    const { unreadCounts } = get();
    return unreadCounts[chatId] || 0;
  },

  getTotalUnreadCount: () => {
    const { unreadCounts } = get();
    return Object.values(unreadCounts).reduce((total, count) => total + count, 0);
  },

  isUserOnline: (userId) => {
    const { onlineUsers } = get();
    return onlineUsers.has(userId);
  },

  isUserTyping: (userId) => {
    const { typingUsers } = get();
    return typingUsers.has(userId);
  }
}));

export default useChatStore; 