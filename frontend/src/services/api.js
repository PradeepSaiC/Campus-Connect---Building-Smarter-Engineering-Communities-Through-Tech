import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('campusconnect-auth');
    if (token) {
      try {
        const authData = JSON.parse(token);
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`;
        }
      } catch (error) {
        console.error('Error parsing auth token:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data and redirect to login
      localStorage.removeItem('campusconnect-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  // Student auth
  firstLogin: (usn) => api.post('/auth/first-login', { usn }),
  verifyOTP: (usn, otp, password, interests, skills, photoURL) => 
    api.post('/auth/verify-otp', { usn, otp, password, interests, skills, photoURL }),
  login: (usn, password) => api.post('/auth/login', { usn, password }),
  
  // College auth
  collegeRegister: (collegeData) => api.post('/college/register', collegeData),
  collegeLogin: (adminEmail, password) => 
    api.post('/college/login', { adminEmail, password }),
};

// Connect API (unified consent)
export const connectAPI = {
  request: (peerId) => api.post('/connect/request', { peerId }),
  update: (id, action) => api.put(`/connect/${id}`, { action }),
  status: (peerId) => api.get('/connect/status', { params: { peerId } }),
  list: () => api.get('/connect/list')
};

// College API
export const collegeAPI = {
  getAll: () => api.get('/colleges'),
  getById: (id) => api.get(`/colleges/${id}`),
  addDepartment: (departmentData) => api.post('/college/departments', departmentData),
  uploadStudents: (formData) => api.post('/college/upload-students', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  updateProfile: (profileData) => api.put('/college/profile', profileData),
};

// Department API
export const departmentAPI = {
  getStudents: (id) => api.get(`/departments/${id}/students`),
  getByCollege: (collegeId) => api.get(`/colleges/${collegeId}/departments`),
  create: (departmentData) => api.post('/college/departments', departmentData),
  update: (id, departmentData) => api.put(`/college/departments/${id}`, departmentData),
  delete: (id) => api.delete(`/college/departments/${id}`),
};

// Student API
export const studentAPI = {
  searchByInterests: (interests, limit = 20) => 
    api.get('/students/search', { params: { interests, limit } }),
  getByCollege: (collegeId) => api.get(`/colleges/${collegeId}/students`),
  getByDepartment: (departmentId) => api.get(`/departments/${departmentId}/students`),
  getAll: (params) => api.get('/college/students', { params }),
  getById: (id) => api.get(`/college/students/${id}`),
  add: (studentData) => api.post('/college/students', studentData),
  update: (id, studentData) => api.put(`/college/students/${id}`, studentData),
  delete: (id) => api.delete(`/college/students/${id}`),
  transfer: (id, departmentId) => api.put(`/college/students/${id}/transfer`, { departmentId }),
};

// Chat Request API
export const chatRequestAPI = {
  createRequest: (data) => api.post('/chat-requests', data),
  getRequests: (type = 'received') => api.get(`/chat-requests?type=${type}`),
  respondToRequest: (requestId, action) => api.put(`/chat-requests/${requestId}`, { action })
};

// Video Call Request API
export const videoCallRequestAPI = {
  createRequest: (data) => api.post('/video-call-requests', data),
  getRequests: (type = 'received') => api.get(`/video-call-requests?type=${type}`),
  respondToRequest: (requestId, action) => api.put(`/video-call-requests/${requestId}`, { action })
};

// Chat API
export const chatAPI = {
  createChat: (participantId) => api.post('/chats', { participantId }),
  getChats: () => api.get('/chats'),
  getMessages: (chatId) => api.get(`/chats/${chatId}/messages`),
};

// Event API
export const eventAPI = {
  create: (eventData) => api.post('/events', eventData),
  getAll: (params = {}) => api.get('/events', { params }),
  getOne: (id) => api.get(`/events/${id}`),
  getByCollege: (collegeId) => api.get(`/colleges/${collegeId}/events`),
  join: (eventId) => api.post(`/events/${eventId}/join`),
  update: (id, eventData) => api.put(`/events/${id}`, eventData),
  setLive: (id, data) => api.put(`/events/${id}/live`, data),
  getStreamToken: (id, role = 'audience', session = '') => api.get(`/events/${id}/stream-token`, { params: { role, session } }),
  getStreamTokenPublic: (id) => api.get(`/events/${id}/stream-token-public`),
  delete: (id) => api.delete(`/events/${id}`),
  extend: (id, minutes) => api.put(`/events/${id}/extend`, { minutes }),
};

// Polls API
export const pollsAPI = {
  create: (eventId, question, options) => api.post(`/events/${eventId}/polls`, { question, options }),
  list: (eventId) => api.get(`/events/${eventId}/polls`),
  vote: (pollId, optionIndex) => api.post(`/polls/${pollId}/vote`, { optionIndex }),
  close: (pollId) => api.post(`/polls/${pollId}/close`),
};

// File Upload API
export const uploadAPI = {
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Interests API
export const interestsAPI = {
  getAll: () => api.get('/interests')
};

export default api; 