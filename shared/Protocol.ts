export enum MessageType {
  // Client -> Server
  JoinRoom = 'joinRoom',
  CreateRoom = 'createRoom',
  LeaveRoom = 'leaveRoom',
  RequestChunk = 'requestChunk',
  BlockUpdate = 'blockUpdate',
  PlayerUpdate = 'playerUpdate',
  ChatMessage = 'chatMessage',

  // Server -> Client
  RoomJoined = 'roomJoined',
  RoomCreated = 'roomCreated',
  RoomError = 'roomError',
  ChunkData = 'chunkData',
  BlockChanged = 'blockChanged',
  PlayerJoined = 'playerJoined',
  PlayerLeft = 'playerLeft',
  PlayerMoved = 'playerMoved',
  ChatBroadcast = 'chatBroadcast',
  NpcUpdate = 'npcUpdate',
  WorldInfo = 'worldInfo',
}

export interface JoinRoomMessage {
  type: MessageType.JoinRoom;
  roomCode: string;
  playerName: string;
}

export interface CreateRoomMessage {
  type: MessageType.CreateRoom;
  playerName: string;
}

export interface RequestChunkMessage {
  type: MessageType.RequestChunk;
  cx: number;
  cy: number;
  cz: number;
}

export interface BlockUpdateMessage {
  type: MessageType.BlockUpdate;
  x: number;
  y: number;
  z: number;
  blockType: number;
}

export interface PlayerUpdateMessage {
  type: MessageType.PlayerUpdate;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
}

export interface ChatMessageMessage {
  type: MessageType.ChatMessage;
  message: string;
}

export interface RoomJoinedMessage {
  type: MessageType.RoomJoined;
  roomCode: string;
  playerId: string;
  seed: number;
  players: Array<{ id: string; name: string; x: number; y: number; z: number }>;
}

export interface RoomCreatedMessage {
  type: MessageType.RoomCreated;
  roomCode: string;
  playerId: string;
  seed: number;
}

export interface RoomErrorMessage {
  type: MessageType.RoomError;
  error: string;
}

export interface ChunkDataMessage {
  type: MessageType.ChunkData;
  cx: number;
  cy: number;
  cz: number;
  data: number[]; // Will be Uint8Array serialized
}

export interface BlockChangedMessage {
  type: MessageType.BlockChanged;
  x: number;
  y: number;
  z: number;
  blockType: number;
  playerId: string;
}

export interface PlayerJoinedMessage {
  type: MessageType.PlayerJoined;
  playerId: string;
  playerName: string;
  x: number;
  y: number;
  z: number;
}

export interface PlayerLeftMessage {
  type: MessageType.PlayerLeft;
  playerId: string;
}

export interface PlayerMovedMessage {
  type: MessageType.PlayerMoved;
  playerId: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
}

export interface ChatBroadcastMessage {
  type: MessageType.ChatBroadcast;
  playerId: string;
  playerName: string;
  message: string;
}

export interface NpcUpdateMessage {
  type: MessageType.NpcUpdate;
  npcs: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    action: string;
    color: [number, number, number];
  }>;
}

export interface WorldInfoMessage {
  type: MessageType.WorldInfo;
  seed: number;
  dayTime: number; // 0-1, 0 = midnight, 0.5 = noon
}

export type ClientMessage =
  | JoinRoomMessage
  | CreateRoomMessage
  | RequestChunkMessage
  | BlockUpdateMessage
  | PlayerUpdateMessage
  | ChatMessageMessage;

export type ServerMessage =
  | RoomJoinedMessage
  | RoomCreatedMessage
  | RoomErrorMessage
  | ChunkDataMessage
  | BlockChangedMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerMovedMessage
  | ChatBroadcastMessage
  | NpcUpdateMessage
  | WorldInfoMessage;
