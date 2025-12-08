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
  try {
    if (!('Notification' in window)) return;
    if (document.hasFocus()) return; // avoid duplicates when focused
    
    // Create notification options with silent flag
    const options = {
      body,
      silent: true, // This disables the default notification sound
      icon: '/favicon.ico', // Optional: Add your app icon
      vibrate: [200, 100, 200] // Optional: Add haptic feedback instead of sound
    };

    if (Notification.permission === 'granted') {
      // Create and show the notification
      const notification = new Notification(title || 'Campus Connect', options);
      
      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
    } else if (Notification.permission !== 'denied') {
      // Request permission if not denied
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          const notification = new Notification(title || 'Campus Connect', options);
          setTimeout(() => notification.close(), 5000);
        }
      });
    }
  } catch (error) {
    console.warn('Error showing desktop notification:', error);
  }
}

function show(kind, message, opts = {}) {
  const { key, ttlMs = 2500, desktop = false, title } = opts;
  if (!message) return;
  if (!shouldShow(key || message, ttlMs)) return;
  if (desktop) desktopNotify(title || 'Campus Connect', message);
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
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (_) {}
  }
};

export default notify;
