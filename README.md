# RouCraft

A 3D voxel game inspired by Minecraft, built entirely in TypeScript. Features procedural terrain, multiplayer via WebSocket, and AI NPCs that build structures autonomously.

## Quick Start

```bash
# Install dependencies
npm install

# Start both client and server
npm run dev
```

Open http://localhost:3000 in your browser.

## How to Play

### Connection Screen

When the game loads, you'll see the connection screen:

1. **Enter your name** (required, 2-16 characters)
2. Choose one of:
   - **Play Solo** - offline mode, local terrain generation
   - **Create Room** - starts a multiplayer room and displays a 6-character code to share
   - **Join Room** - enter a room code to join a friend's world

### Controls

| Key | Action |
|-----|--------|
| **WASD** / **ZQSD** | Move |
| **Space** | Jump |
| **Shift** | Sprint |
| **Mouse** | Look around |
| **Left Click** | Break block |
| **Right Click** | Place block |
| **1-9** / **Mouse Wheel** | Select block in hotbar |
| **T** or **Enter** | Open chat (multiplayer) |
| **Escape** | Settings menu |
| **F3** | Toggle debug info (FPS + coordinates) |

Click anywhere on the game to lock the mouse cursor (required for playing).

### Block Types

The hotbar at the bottom gives you 9 blocks: Grass, Dirt, Stone, Sand, Wood, Cobblestone, Planks, Glass, and Brick.

### Multiplayer

- Create a room and share the 6-character code with friends (up to 8 players per room)
- You'll see other players as colored humanoid figures with floating names
- Block changes are synchronized in real-time
- Use the chat (T or Enter) to communicate

### AI NPCs

4 NPCs roam the world (Bjorn, Elara, Grimm, Freya). They autonomously:
- **Build** small houses, towers, and walls
- **Gather** resources by mining blocks
- **Wander** and explore the terrain

Watch them construct structures block by block!

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start client (port 3000) + server (port 3001) concurrently |
| `npm run dev:client` | Start only the Vite client dev server |
| `npm run dev:server` | Start only the game server (with hot reload) |
| `npm run build` | Production build (client + server) |

## Architecture

```
roucraft/
├── shared/                    # Code shared between client and server
│   ├── BlockTypes.ts          # 16 block types with colors and properties
│   ├── ChunkConstants.ts      # Chunk sizing (32x32x32), coordinate math
│   ├── Protocol.ts            # WebSocket message types
│   └── MathUtils.ts           # clamp, lerp, distance helpers
├── server/
│   ├── index.ts               # Express + WebSocket entry point (port 3001)
│   ├── world/
│   │   ├── TerrainGenerator.ts  # Simplex noise terrain with caves, trees, ores
│   │   ├── WorldManager.ts      # Authoritative world state
│   │   └── WorldSave.ts         # Binary save/load system
│   ├── network/
│   │   └── NetworkManager.ts    # Room management, message routing
│   └── ai/
│       ├── BehaviorTree.ts      # Sequence, Selector, Leaf nodes
│       ├── Pathfinding.ts       # A* on voxel grid (200 node limit)
│       ├── NpcManager.ts        # NPC lifecycle and tick loop (2Hz)
│       └── behaviors/           # Wander, Build, Gather behaviors
├── client/
│   ├── index.html             # Game shell with canvas
│   ├── main.ts                # Game orchestrator and event wiring
│   ├── engine/
│   │   ├── Engine.ts          # Three.js renderer, camera, game loop
│   │   ├── SoundManager.ts    # Procedural Web Audio sounds
│   │   └── Settings.ts        # localStorage settings store
│   ├── world/
│   │   ├── ChunkManager.ts    # Chunk load/unload around player
│   │   ├── ChunkMesher.ts     # Greedy meshing + ambient occlusion
│   │   ├── ChunkMeshWorker.ts # Web Worker for off-thread meshing
│   │   └── WorkerPool.ts      # 2-4 worker pool with priority queue
│   ├── player/
│   │   ├── PlayerController.ts  # FPS movement, gravity, AABB collisions
│   │   └── BlockInteraction.ts  # Raycast block break/place
│   ├── rendering/
│   │   ├── SkySystem.ts       # 20-min day/night cycle, stars
│   │   ├── TextureAtlas.ts    # Procedural 256x256 block textures
│   │   └── BlockParticles.ts  # Block destruction particles
│   ├── entities/
│   │   ├── RemotePlayer.ts    # Other players (box model, interpolation)
│   │   ├── NPCRenderer.ts     # NPC visuals with walk animation
│   │   └── EntityManager.ts   # Manages all remote entities
│   ├── network/
│   │   └── NetworkClient.ts   # WebSocket client with auto-reconnect
│   └── ui/
│       ├── ConnectionScreen.ts  # Landing page (solo/create/join)
│       ├── HUD.ts               # Hotbar + debug overlay
│       ├── Crosshair.ts        # Centered crosshair
│       ├── ChatUI.ts           # In-game chat
│       └── SettingsScreen.ts   # Settings overlay (Escape key)
```

## Tech Stack

- **Client**: Three.js + TypeScript + Vite
- **Server**: Node.js + Express + WebSocket (ws)
- **Terrain**: Simplex noise (simplex-noise + alea for seeded generation)
- **No database** - worlds saved as binary files on the server

## Key Technical Details

- **Chunk system**: 32x32x32 blocks per chunk, 256 blocks world height
- **Greedy meshing**: merges adjacent identical faces into larger quads (60-80% triangle reduction)
- **Ambient occlusion**: per-vertex AO computed during meshing (4 levels)
- **Web Workers**: 2-4 workers for off-thread mesh generation
- **Multiplayer**: server-authoritative blocks, client-authoritative movement
- **Procedural sounds**: Web Audio API oscillators (no audio files needed)
- **Auto-save**: worlds saved every 5 minutes to binary files

## License

MIT
