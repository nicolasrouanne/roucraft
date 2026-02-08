import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { NetworkManager } from './network/NetworkManager.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3001;

const networkManager = new NetworkManager(wss);

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
