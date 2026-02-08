import { Engine } from './engine/Engine';
import { ConnectionScreen, type ConnectionResult } from './ui/ConnectionScreen';
import { ChatUI } from './ui/ChatUI';
import { NetworkClient } from './network/NetworkClient';
import { EntityManager } from './entities/EntityManager';
import { BlockType } from '../shared/BlockTypes';

// --- Globals ---
const network = new NetworkClient();
let engine: Engine | null = null;
let entityManager: EntityManager | null = null;
let chatUI: ChatUI | null = null;
let playerName = 'Player';
let isMultiplayer = false;

// --- Connection Screen ---
const uiOverlay = document.getElementById('ui-overlay')!;
const connectionScreen = new ConnectionScreen(uiOverlay);
connectionScreen.show();

connectionScreen.setOnConnect((result: ConnectionResult) => {
  playerName = result.playerName;

  if (result.mode === 'solo') {
    startSoloGame();
  } else if (result.mode === 'create') {
    startMultiplayerGame('create', result.playerName);
  } else if (result.mode === 'join') {
    startMultiplayerGame('join', result.playerName, result.roomCode);
  }
});

// --- Solo Game ---
function startSoloGame(): void {
  isMultiplayer = false;
  network.startOffline();
  connectionScreen.hide();
  initEngine();
}

// --- Multiplayer Game ---
function startMultiplayerGame(mode: 'create' | 'join', name: string, roomCode?: string): void {
  isMultiplayer = true;

  network.on('connected', () => {
    if (mode === 'create') {
      network.createRoom(name);
    } else if (roomCode) {
      network.joinRoom(roomCode, name);
    }
  });

  network.on('roomCreated', (msg) => {
    connectionScreen.showRoomCode(msg.roomCode);
    connectionScreen.hide();
    initEngine();
    wireNetworkEvents();
  });

  network.on('roomJoined', (msg) => {
    connectionScreen.hide();
    initEngine();
    wireNetworkEvents();

    // Add existing players in the room
    if (entityManager && msg.players) {
      for (const p of msg.players) {
        entityManager.addPlayer(p.id, p.name, p.x, p.y, p.z);
      }
    }
  });

  network.on('roomError', (msg) => {
    connectionScreen.showError(msg.error);
  });

  network.on('disconnected', () => {
    if (chatUI) {
      chatUI.addSystemMessage('Disconnected from server. Attempting to reconnect...');
    }
  });

  network.connect();
}

// --- Engine Init ---
function initEngine(): void {
  if (engine) return;

  engine = new Engine();
  engine.init();

  entityManager = new EntityManager(engine.scene);

  // Chat UI
  const hudEl = document.getElementById('hud')!;
  chatUI = new ChatUI(hudEl);
  chatUI.setOnSend((message) => {
    if (isMultiplayer && network.isConnected) {
      network.sendChat(message);
    } else {
      chatUI!.addMessage(playerName, message);
    }
  });

  // Chat key handling - intercept T/Enter before other game keys
  document.addEventListener('keydown', (e) => {
    if (chatUI && chatUI.handleKeyDown(e)) {
      return;
    }
  });

  // Wire block interaction callbacks for network
  const origBreak = engine.blockInteraction.onBlockBreak;
  engine.blockInteraction.onBlockBreak = (x, y, z, blockType) => {
    // Fire existing particle callback
    origBreak?.(x, y, z, blockType);
    // Send to server
    if (isMultiplayer && network.isConnected) {
      network.sendBlockUpdate(x, y, z, BlockType.Air);
    }
  };

  engine.blockInteraction.onBlockPlace = (x, y, z, blockType) => {
    if (isMultiplayer && network.isConnected) {
      network.sendBlockUpdate(x, y, z, blockType);
    }
  };

  // Send player position updates in multiplayer
  if (isMultiplayer) {
    setInterval(() => {
      if (!engine || !network.isConnected) return;
      const pos = engine.playerController.getPosition();
      const rot = engine.playerController.getRotation();
      network.sendPlayerUpdate(pos.x, pos.y, pos.z, rot.rx, rot.ry);
    }, 50);
  }
}

// --- Network Event Wiring ---
function wireNetworkEvents(): void {
  if (!engine || !entityManager || !chatUI) return;

  network.on('blockChanged', (msg) => {
    engine!.chunkManager.setBlock(msg.x, msg.y, msg.z, msg.blockType as BlockType);
  });

  network.on('playerJoined', (msg) => {
    entityManager!.addPlayer(msg.playerId, msg.playerName, msg.x, msg.y, msg.z);
    chatUI!.addSystemMessage(`${msg.playerName} joined the game`);
  });

  network.on('playerLeft', (msg) => {
    const player = entityManager!.getPlayer(msg.playerId);
    if (player) {
      chatUI!.addSystemMessage(`${player.name} left the game`);
    }
    entityManager!.removePlayer(msg.playerId);
  });

  network.on('playerMoved', (msg) => {
    entityManager!.updatePlayer(msg.playerId, msg.x, msg.y, msg.z, msg.rx, msg.ry);
  });

  network.on('chatBroadcast', (msg) => {
    chatUI!.addMessage(msg.playerName, msg.message);
  });

  network.on('npcUpdate', (msg) => {
    engine!.handleNpcUpdate(msg);
  });
}
