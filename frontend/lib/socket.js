import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (socket) return socket;

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (!token) return null;

  let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (!socketUrl && typeof window !== 'undefined') {
    socketUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  if (!socketUrl) {
    socketUrl = 'http://localhost:5000';
  }
  console.log('[Socket Diagnostics] Connecting to socket URL:', socketUrl);

  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
