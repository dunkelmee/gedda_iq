import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;

// Priority:
//   1. NEXT_PUBLIC_BACKEND_URL baked at build time (set this on Render / Vercel / etc.)
//   2. Same hostname the browser used, port 4000 (works for localhost and Docker on LAN)
function backendUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000`;
}

export function getSocket(): Socket {
  if (typeof window === 'undefined') throw new Error('Socket is client-only');
  if (!_socket) {
    _socket = io(backendUrl(), {
      autoConnect: false,
      transports: ['websocket'],
    });
  }
  return _socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}
