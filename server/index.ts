import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { NetworkManager } from './network/NetworkManager.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// CORS configuration for production
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL // Will be set to your Cloudflare Pages URL
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worldsDir = path.join(__dirname, '..', 'worlds');

const networkManager = new NetworkManager(wss, worldsDir);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'RouCraft',
    rooms: networkManager.getRoomCount(),
    players: networkManager.getTotalPlayerCount(),
  });
});

server.listen(PORT, () => {
  console.log(`RouCraft server running on port ${PORT}`);
});
