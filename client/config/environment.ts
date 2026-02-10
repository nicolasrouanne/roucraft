// Environment configuration
export const getWebSocketUrl = (): string => {
  // In production, use the environment variable set during build
  if (import.meta.env.PROD && import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // In development or if no env var is set, use local WebSocket
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;

  // If we're in dev mode (localhost:3000), connect to localhost:3001
  if (import.meta.env.DEV) {
    return `${protocol}//${host}:3001`;
  }

  // In production without explicit WS_URL, assume WebSocket is on same host
  return `${protocol}//${host}/ws`;
};