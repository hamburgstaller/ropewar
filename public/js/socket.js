/**
 * Socket.io singleton.
 * Auto-reconnect + event dispatch.
 */

let socket = null;
const listeners = new Map();   // event -> [fn]
let currentUserId = null;
let currentUsername = null;

export const socketService = {
  /**
   * Establish the socket connection (identity comes from the session cookie).
   */
  connect() {
    if (socket && socket.connected) return socket;
    socket = io({
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[socket] connected:', socket.id);
      // After a page refresh, ask the server to resume any active match
      socket.emit('client:resume_match');
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[socket] connection error:', err.message);
    });

    // Re-attach existing listeners
    for (const [event, fns] of listeners) {
      socket.on(event, (...args) => fns.forEach(fn => fn(...args)));
    }

    return socket;
  },

  getSocket() {
    if (!socket) this.connect();
    return socket;
  },

  getSocketId() {
    return socket ? socket.id : null;
  },

  emit(event, payload) {
    const s = this.getSocket();
    s.emit(event, payload);
  },

  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(fn);
    if (socket) socket.on(event, fn);
  },

  off(event, fn) {
    if (!listeners.has(event)) return;
    const arr = listeners.get(event);
    const idx = arr.indexOf(fn);
    if (idx !== -1) arr.splice(idx, 1);
    if (socket) socket.off(event, fn);
  },

  setUser(userId, username) {
    currentUserId = userId;
    currentUsername = username;
  },

  getUser() {
    return { userId: currentUserId, username: currentUsername };
  }
};
