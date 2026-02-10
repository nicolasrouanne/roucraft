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
  NpcUpdateMessage,
  WorldInfoMessage,
} from '../../shared/Protocol';

type EventMap = {
  roomCreated: RoomCreatedMessage;
  roomJoined: RoomJoinedMessage;
  roomError: RoomErrorMessage;
  chunkData: ChunkDataMessage;
  blockChanged: BlockChangedMessage;
  playerJoined: PlayerJoinedMessage;
  playerLeft: PlayerLeftMessage;
  playerMoved: PlayerMovedMessage;
  chatBroadcast: ChatBroadcastMessage;
  npcUpdate: NpcUpdateMessage;
  worldInfo: WorldInfoMessage;
  connected: void;
  disconnected: void;
};

type EventHandler<T> = (data: T) => void;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventHandler<any>>> = new Map();
  private reconnectAttempts = 0;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: number | null = null;
  private url: string = '';
  private isOffline = false;
  private lastPositionSend = 0;
  private positionThrottle = 50; // ms

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  get offline(): boolean {
    return this.isOffline;
  }

  connect(url?: string): void {
    // Use provided URL, environment variable, or default to local development
    if (url) {
      this.url = url;
    } else if (import.meta.env.VITE_WS_URL) {
      this.url = import.meta.env.VITE_WS_URL;
    } else {
      // Default for local development - use wss:// for HTTPS, ws:// for HTTP
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${protocol}//${window.location.hostname}:3001`;
    }
    this.isOffline = false;
    this.doConnect();
  }

  startOffline(): void {
    this.isOffline = true;
    this.disconnect();
  }

  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect on intentional disconnect
      this.ws.close();
      this.ws = null;
    }
  }

  private doConnect(): void {
    if (this.isOffline) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected', undefined as any);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        this.routeMessage(message);
      } catch (err) {
        console.error('Failed to parse server message:', err);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.emit('disconnected', undefined as any);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private scheduleReconnect(): void {
    if (this.isOffline) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  private routeMessage(message: ServerMessage): void {
    switch (message.type) {
      case MessageType.RoomCreated:
        this.emit('roomCreated', message);
        break;
      case MessageType.RoomJoined:
        this.emit('roomJoined', message);
        break;
      case MessageType.RoomError:
        this.emit('roomError', message);
        break;
      case MessageType.ChunkData:
        this.emit('chunkData', message);
        break;
      case MessageType.BlockChanged:
        this.emit('blockChanged', message);
        break;
      case MessageType.PlayerJoined:
        this.emit('playerJoined', message);
        break;
      case MessageType.PlayerLeft:
        this.emit('playerLeft', message);
        break;
      case MessageType.PlayerMoved:
        this.emit('playerMoved', message);
        break;
      case MessageType.ChatBroadcast:
        this.emit('chatBroadcast', message);
        break;
      case MessageType.NpcUpdate:
        this.emit('npcUpdate', message);
        break;
      case MessageType.WorldInfo:
        this.emit('worldInfo', message);
        break;
    }
  }

  // --- Send methods ---

  createRoom(playerName: string): void {
    this.send({ type: MessageType.CreateRoom, playerName });
  }

  joinRoom(roomCode: string, playerName: string): void {
    this.send({ type: MessageType.JoinRoom, roomCode, playerName });
  }

  requestChunk(cx: number, cy: number, cz: number): void {
    this.send({ type: MessageType.RequestChunk, cx, cy, cz });
  }

  sendBlockUpdate(x: number, y: number, z: number, blockType: number): void {
    this.send({ type: MessageType.BlockUpdate, x, y, z, blockType });
  }

  sendPlayerUpdate(x: number, y: number, z: number, rx: number, ry: number): void {
    const now = performance.now();
    if (now - this.lastPositionSend < this.positionThrottle) return;
    this.lastPositionSend = now;
    this.send({ type: MessageType.PlayerUpdate, x, y, z, rx, ry });
  }

  sendChat(message: string): void {
    this.send({ type: MessageType.ChatMessage, message });
  }

  private send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // --- Event system ---

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }
}
