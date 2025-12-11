import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

// Create axios instance with auth header (reads from sessionStorage first)
const createAuthInstance = () => {
  let bearer = null;
  try {
    const persisted = sessionStorage.getItem('campusconnect-auth') ?? localStorage.getItem('campusconnect-auth');
    if (persisted) {
      const parsed = JSON.parse(persisted);
      bearer = parsed?.state?.token || parsed?.token || null;
    }
  } catch (_) {}

  const headers = { 'Content-Type': 'application/json' };
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

  return axios.create({
    baseURL: API_BASE_URL,
    headers
  });
};

const videoCallAPI = {
  // Initiate video call
  initiateCall: async (receiverId, isLiveStream = false, streamTitle = '', streamDescription = '') => {
    const instance = createAuthInstance();
    const body = {
      receiverId,
      isLiveStream,
      streamTitle,
      streamDescription
    };
    try {
      console.debug('VCAPI: initiateCall', body);
      const res = await instance.post('/video-call/initiate', body);
      console.debug('VCAPI: initiateCall response', res?.data);
      return res;
    } catch (err) {
      console.error('VCAPI: initiateCall error', { status: err?.response?.status, data: err?.response?.data });
      throw err;
    }
  },

  // Accept video call
  acceptCall: async (callId) => {
    const instance = createAuthInstance();
    try {
      console.debug('VCAPI: acceptCall', { callId });
      const res = await instance.post(`/video-call/${callId}/accept`);
      console.debug('VCAPI: acceptCall response', res?.data);
      return res;
    } catch (err) {
      console.error('VCAPI: acceptCall error', { status: err?.response?.status, data: err?.response?.data });
      throw err;
    }
  },

  // Reject video call
  rejectCall: async (callId) => {
    const instance = createAuthInstance();
    try {
      console.debug('VCAPI: rejectCall', { callId });
      const res = await instance.post(`/video-call/${callId}/reject`);
      console.debug('VCAPI: rejectCall response', res?.data);
      return res;
    } catch (err) {
      console.error('VCAPI: rejectCall error', { status: err?.response?.status, data: err?.response?.data });
      throw err;
    }
  },

  // End video call
  endCall: async (callId) => {
    const instance = createAuthInstance();
    try {
      console.debug('VCAPI: endCall', { callId });
      const res = await instance.post(`/video-call/${callId}/end`);
      console.debug('VCAPI: endCall response', res?.data);
      return res;
    } catch (err) {
      console.error('VCAPI: endCall error', { status: err?.response?.status, data: err?.response?.data });
      throw err;
    }
  },

  // Get Agora credentials
  getCredentials: async () => {
    const instance = createAuthInstance();
    try {
      console.debug('VCAPI: getCredentials');
      const res = await instance.get('/video-call/credentials');
      console.debug('VCAPI: getCredentials response', res?.data);
      return res;
    } catch (err) {
      console.error('VCAPI: getCredentials error', { status: err?.response?.status, data: err?.response?.data });
      throw err;
    }
  },

  // Join live stream
  joinStream: async (callId) => {
    const instance = createAuthInstance();
    try {
      console.debug('VCAPI: joinStream', { callId });
      const res = await instance.post(`/video-call/${callId}/join-stream`);
      console.debug('VCAPI: joinStream response', res?.data);
      return res;
    } catch (err) {
      console.error('VCAPI: joinStream error', { status: err?.response?.status, data: err?.response?.data });
      throw err;
    }
  },

  // Leave live stream
  leaveStream: async (callId) => {
    const instance = createAuthInstance();
    try {
      console.debug('VCAPI: leaveStream', { callId });
      const res = await instance.post(`/video-call/${callId}/leave-stream`);
      console.debug('VCAPI: leaveStream response', res?.data);
      return res;
    } catch (err) {
      console.error('VCAPI: leaveStream error', { status: err?.response?.status, data: err?.response?.data });
      throw err;
    }
  },

  // Resume helpers (backend may expose one or both)
  getActiveForPeer: async (peerId) => {
    const instance = createAuthInstance();
    const candidates = [
      `/video-call/active?peerId=${encodeURIComponent(peerId)}`,
      `/video-call/current?peerId=${encodeURIComponent(peerId)}`
    ];
    let lastErr;
    for (const path of candidates) {
      try {
        console.debug('VCAPI: getActiveForPeer', { path });
        const res = await instance.get(path);
        console.debug('VCAPI: getActiveForPeer response', res?.data);
        return res;
      } catch (err) {
        lastErr = err;
        console.warn('VCAPI: getActiveForPeer failed', { path, status: err?.response?.status });
      }
    }
    throw lastErr || new Error('No active call endpoint available');
  },

  getCallCredentials: async (callId) => {
    const instance = createAuthInstance();
    const candidates = [
      `/video-call/${callId}/credentials`,
      `/video-call/${callId}`
    ];
    let lastErr;
    for (const path of candidates) {
      try {
        console.debug('VCAPI: getCallCredentials', { path });
        const res = await instance.get(path);
        console.debug('VCAPI: getCallCredentials response', res?.data);
        return res;
      } catch (err) {
        lastErr = err;
        console.warn('VCAPI: getCallCredentials failed', { path, status: err?.response?.status });
      }
    }
    throw lastErr || new Error('No credentials endpoint available');
  }
};

export default videoCallAPI; 