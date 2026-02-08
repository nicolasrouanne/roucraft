import { WebSocket, WebSocketServer } from 'ws';
import { WorldManager } from '../world/WorldManager.js';
import {
  MessageType,
  ClientMessage,
  ServerMessage,
  RoomCreatedMessage,
  RoomJoinedMessage,
  RoomErrorMessage,
  ChunkDataMessage,
  BlockChangedMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  PlayerMovedMessage,
  ChatBroadcastMessage,
} from '../../shared/Protocol.js';
import { BlockType } from '../../shared/BlockTypes.js';
import { WORLD_HEIGHT } from '../../shared/ChunkConstants.js';

export interface PlayerInfo {
  ws: WebSocket;
  name: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
}

export interface Room {
  code: string;
  players: Map<string, PlayerInfo>;
  world: WorldManager;
  seed: number;
}

const MAX_PLAYERS_PER_ROOM = 8;
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export class NetworkManager {
  private rooms: Map<string, Room> = new Map();
  private wsToPlayer: Map<WebSocket, { roomCode: string; playerId: string }> = new Map();

  constructor(private wss: WebSocketServer) {
    this.wss.on('connection', (ws) => {
      console.log('Client connected');

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as ClientMessage;
          this.handleMessage(ws, message);
        } catch (err) {
          console.error('Invalid message:', err);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
    });
  }

  private handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case MessageType.CreateRoom:
        this.handleCreateRoom(ws, message.playerName);
        break;
      case MessageType.JoinRoom:
        this.handleJoinRoom(ws, message.roomCode, message.playerName);
        break;
      case MessageType.RequestChunk:
        this.handleRequestChunk(ws, message.cx, message.cy, message.cz);
        break;
      case MessageType.BlockUpdate:
        this.handleBlockUpdate(ws, message.x, message.y, message.z, message.blockType);
        break;
      case MessageType.PlayerUpdate:
        this.handlePlayerUpdate(ws, message.x, message.y, message.z, message.rx, message.ry);
        break;
      case MessageType.ChatMessage:
        this.handleChatMessage(ws, message.message);
        break;
    }
  }

  private handleCreateRoom(ws: WebSocket, playerName: string): void {
    // Generate unique room code
    let code: string;
    do {
      code = generateRoomCode();
    } while (this.rooms.has(code));

    const seed = Math.floor(Math.random() * 2147483647);
    const playerId = generatePlayerId();

    const room: Room = {
      code,
      players: new Map(),
      world: new WorldManager(seed),
      seed,
    };

    const spawnX = 0;
    const spawnY = 80;
    const spawnZ = 0;

    room.players.set(playerId, {
      ws,
      name: playerName,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      rx: 0,
      ry: 0,
    });

    this.rooms.set(code, room);
    this.wsToPlayer.set(ws, { roomCode: code, playerId });

    const response: RoomCreatedMessage = {
      type: MessageType.RoomCreated,
      roomCode: code,
      playerId,
      seed,
    };
    this.send(ws, response);

    console.log(`Room ${code} created by ${playerName} (seed: ${seed})`);
  }

  private handleJoinRoom(ws: WebSocket, roomCode: string, playerName: string): void {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      const error: RoomErrorMessage = {
        type: MessageType.RoomError,
        error: `Room "${code}" not found`,
      };
      this.send(ws, error);
      return;
    }

    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      const error: RoomErrorMessage = {
        type: MessageType.RoomError,
        error: `Room "${code}" is full (max ${MAX_PLAYERS_PER_ROOM} players)`,
      };
      this.send(ws, error);
      return;
    }

    const playerId = generatePlayerId();
    const spawnX = 0;
    const spawnY = 80;
    const spawnZ = 0;

    // Notify existing players about the new player
    const joinNotification: PlayerJoinedMessage = {
      type: MessageType.PlayerJoined,
      playerId,
      playerName,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
    };
    this.broadcastToRoom(code, joinNotification);

    // Add the new player
    room.players.set(playerId, {
      ws,
      name: playerName,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      rx: 0,
      ry: 0,
    });

    this.wsToPlayer.set(ws, { roomCode: code, playerId });

    // Send room state to the joining player
    const existingPlayers = Array.from(room.players.entries())
      .filter(([id]) => id !== playerId)
      .map(([id, p]) => ({ id, name: p.name, x: p.x, y: p.y, z: p.z }));

    const response: RoomJoinedMessage = {
      type: MessageType.RoomJoined,
      roomCode: code,
      playerId,
      seed: room.seed,
      players: existingPlayers,
    };
    this.send(ws, response);

    console.log(`${playerName} joined room ${code} (${room.players.size}/${MAX_PLAYERS_PER_ROOM})`);
  }

  handleDisconnect(ws: WebSocket): void {
    const playerInfo = this.wsToPlayer.get(ws);
    if (!playerInfo) {
      console.log('Unknown client disconnected');
      return;
    }

    const { roomCode, playerId } = playerInfo;
    const room = this.rooms.get(roomCode);

    if (room) {
      const player = room.players.get(playerId);
      const playerName = player?.name ?? 'Unknown';

      room.players.delete(playerId);
      console.log(`${playerName} left room ${roomCode} (${room.players.size}/${MAX_PLAYERS_PER_ROOM})`);

      if (room.players.size === 0) {
        this.rooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted (empty)`);
      } else {
        const leaveNotification: PlayerLeftMessage = {
          type: MessageType.PlayerLeft,
          playerId,
        };
        this.broadcastToRoom(roomCode, leaveNotification);
      }
    }

    this.wsToPlayer.delete(ws);
  }

  private handleRequestChunk(ws: WebSocket, cx: number, cy: number, cz: number): void {
    const playerInfo = this.wsToPlayer.get(ws);
    if (!playerInfo) return;

    const room = this.rooms.get(playerInfo.roomCode);
    if (!room) return;

    const chunkData = room.world.getChunk(cx, cy, cz);

    const response: ChunkDataMessage = {
      type: MessageType.ChunkData,
      cx,
      cy,
      cz,
      data: Array.from(chunkData),
    };
    this.send(ws, response);
  }

  private handleBlockUpdate(ws: WebSocket, x: number, y: number, z: number, blockType: number): void {
    const playerInfo = this.wsToPlayer.get(ws);
    if (!playerInfo) return;

    const room = this.rooms.get(playerInfo.roomCode);
    if (!room) return;

    // Validate block type
    if (blockType < 0 || blockType > BlockType.Flower) return;

    // Validate Y bounds
    if (y < 0 || y >= WORLD_HEIGHT) return;

    // Apply to world
    const success = room.world.setBlock(x, y, z, blockType as BlockType);
    if (!success) return;

    // Broadcast to all players in room (including sender for confirmation)
    const notification: BlockChangedMessage = {
      type: MessageType.BlockChanged,
      x,
      y,
      z,
      blockType,
      playerId: playerInfo.playerId,
    };
    this.broadcastToRoom(playerInfo.roomCode, notification);
  }

  private handlePlayerUpdate(ws: WebSocket, x: number, y: number, z: number, rx: number, ry: number): void {
    const playerInfo = this.wsToPlayer.get(ws);
    if (!playerInfo) return;

    const room = this.rooms.get(playerInfo.roomCode);
    if (!room) return;

    const player = room.players.get(playerInfo.playerId);
    if (!player) return;

    // Update stored position
    player.x = x;
    player.y = y;
    player.z = z;
    player.rx = rx;
    player.ry = ry;

    // Relay to other players
    const notification: PlayerMovedMessage = {
      type: MessageType.PlayerMoved,
      playerId: playerInfo.playerId,
      x,
      y,
      z,
      rx,
      ry,
    };
    this.broadcastToRoom(playerInfo.roomCode, notification, ws);
  }

  private handleChatMessage(ws: WebSocket, message: string): void {
    const playerInfo = this.wsToPlayer.get(ws);
    if (!playerInfo) return;

    const room = this.rooms.get(playerInfo.roomCode);
    if (!room) return;

    const player = room.players.get(playerInfo.playerId);
    if (!player) return;

    // Sanitize message length
    const sanitized = message.substring(0, 200);

    const broadcast: ChatBroadcastMessage = {
      type: MessageType.ChatBroadcast,
      playerId: playerInfo.playerId,
      playerName: player.name,
      message: sanitized,
    };
    this.broadcastToRoom(playerInfo.roomCode, broadcast);
  }

  private broadcastToRoom(roomCode: string, message: ServerMessage, excludeWs?: WebSocket): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const data = JSON.stringify(message);
    for (const [, player] of room.players) {
      if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(data);
      }
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getTotalPlayerCount(): number {
    let count = 0;
    for (const [, room] of this.rooms) {
      count += room.players.size;
    }
    return count;
  }
}
