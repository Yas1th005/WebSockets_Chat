// Socket initialization for client side
import io from 'socket.io-client';

// Initialize the socket connection at the top level of your component or in a custom hook
const socket = io('http://localhost:5000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Setup initial connection event listeners
socket.on('connect', () => {
  console.log('Connected to server with socket ID:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

export default socket;