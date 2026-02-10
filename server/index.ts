import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { NetworkManager } from './network/NetworkManager.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

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
