// Socket initialization for client side
import io from 'socket.io-client';

// Initialize the socket connection at the top level of your component or in a custom hook
const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
const isBrowser = typeof window !== 'undefined';

const createNoopSocket = () => ({
  connected: false,
  on: () => {},
  once: () => {},
  off: () => {},
  emit: () => {},
});

const socket = isBrowser
  ? io(socketServerUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1000,
      timeout: 8000,
    })
  : createNoopSocket();

// Setup initial connection event listeners
if (isBrowser) {
  socket.on('connect', () => {
    console.log('Connected to server with socket ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error(`Socket connection error (${socketServerUrl}):`, err.message || err);
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });
}

export default socket;