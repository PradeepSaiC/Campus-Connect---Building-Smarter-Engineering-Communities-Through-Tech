import { toast } from 'react-hot-toast';

// Simple in-memory registry for dedupe and throttling
const registry = new Map();

const now = () => Date.now();

function shouldShow(key, ttlMs) {
  if (!key) return true;
  const item = registry.get(key);
  const t = now();
  if (item && t - item.time < (ttlMs || 2000)) {
    return false;
  }
  registry.set(key, { time: t });
  return true;
}

function desktopNotify(title, body) {
  // Completely disable desktop notifications
  return;
  
  // The following code is kept but unreachable as a reference
  try {
    if (!('Notification' in window)) return;
    
    // Create completely silent notification options
    const options = {
      body,
      silent: true, // Ensure no sound
      icon: '/favicon.ico',
      requireInteraction: false,
      vibrate: [] // No vibration
    };

    if (Notification.permission === 'granted') {
      // Don't show any notifications even if permission is granted
      return;
    }
  } catch (error) {
    console.warn('Notification error:', error);
  }
}

function show(kind, message, opts = {}) {
  const { key, ttlMs = 2500, desktop = false, title } = opts;
  if (!message) return;
  if (!shouldShow(key || message, ttlMs)) return;
  
  // Disable all desktop notifications
  // desktopNotify is intentionally not called to prevent any notifications
  switch (kind) {
    case 'success':
      return toast.success(message);
    case 'error':
      return toast.error(message);
    case 'info':
      return toast(message);
    case 'loading':
      return toast.loading(message);
    case 'warn':
      return toast(message, { icon: '⚠️' });
    default:
      return toast(message);
  }
}

const notify = {
  success: (msg, opts) => show('success', msg, opts),
  error: (msg, opts) => show('error', msg, opts),
  info: (msg, opts) => show('info', msg, opts),
  warn: (msg, opts) => show('warn', msg, opts),
  loading: (msg, opts) => show('loading', msg, opts),
  requestPermission: () => {
    // Don't request notification permissions at all
    return Promise.resolve('denied');
  }
};

export default notify;
