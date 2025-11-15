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
    if (Notification.permission === 'granted') {
      new Notification(title || 'Notification', { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') new Notification(title || 'Notification', { body });
      });
    }
  } catch (_) {}
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
