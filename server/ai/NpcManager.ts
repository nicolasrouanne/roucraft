import { type BehaviorNode, type Blackboard, Selector } from './BehaviorTree.js';
import { createWanderBehavior } from './behaviors/WanderBehavior.js';
import { createBuildBehavior, type BlockPlacedCallback } from './behaviors/BuildBehavior.js';
import { createGatherBehavior, type BlockRemovedCallback } from './behaviors/GatherBehavior.js';
import type { WorldManager } from '../world/WorldManager.js';
import { BlockType } from '../../shared/BlockTypes.js';
import { getHeightAt } from '../world/TerrainGenerator.js';
import type { NpcUpdateMessage } from '../../shared/Protocol.js';
import { MessageType } from '../../shared/Protocol.js';

const TICK_INTERVAL = 500; // 2Hz
const NPC_COUNT = 4;
const SPAWN_RADIUS = 30;

const NPC_NAMES = ['Bjorn', 'Elara', 'Grimm', 'Freya', 'Thane'];
const NPC_COLORS: [number, number, number][] = [
  [0.8, 0.3, 0.3],
  [0.3, 0.7, 0.4],
  [0.3, 0.4, 0.8],
  [0.9, 0.7, 0.2],
  [0.7, 0.3, 0.7],
];

interface NpcState {
  id: string;
  name: string;
  color: [number, number, number];
  blackboard: Blackboard;
  behaviorTree: BehaviorNode;
}

export class NpcManager {
  private npcs: NpcState[] = [];
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = Date.now();
  private onBlockChanged: (x: number, y: number, z: number, type: BlockType) => void;

  constructor(
    private world: WorldManager,
    private seed: number,
    onBlockChanged: (x: number, y: number, z: number, type: BlockType) => void,
  ) {
    this.onBlockChanged = onBlockChanged;
    this.spawnNpcs();
  }

  private spawnNpcs(): void {
    for (let i = 0; i < NPC_COUNT; i++) {
      const angle = (i / NPC_COUNT) * Math.PI * 2;
      const spawnX = Math.floor(Math.cos(angle) * SPAWN_RADIUS);
      const spawnZ = Math.floor(Math.sin(angle) * SPAWN_RADIUS);
      const spawnY = getHeightAt(spawnX, spawnZ, this.seed) + 1;

      const name = NPC_NAMES[i % NPC_NAMES.length];
      const color = NPC_COLORS[i % NPC_COLORS.length];
      const id = `npc_${i}_${name.toLowerCase()}`;

      const blackboard: Blackboard = {
        x: spawnX + 0.5,
        y: spawnY,
        z: spawnZ + 0.5,
        rx: 0,
        ry: 0,
        action: 'idle',
      };

      const onBlockPlaced: BlockPlacedCallback = (x, y, z, type) => {
        this.onBlockChanged(x, y, z, type);
      };

      const onBlockRemoved: BlockRemovedCallback = (x, y, z) => {
        this.onBlockChanged(x, y, z, BlockType.Air);
      };

      const behaviorTree = new Selector([
        createBuildBehavior(this.world, onBlockPlaced),
        createGatherBehavior(this.world, onBlockRemoved),
        createWanderBehavior(this.world),
      ]);

      this.npcs.push({ id, name, color, blackboard, behaviorTree });
    }
  }

  start(): void {
    if (this.tickTimer) return;
    this.lastTickTime = Date.now();
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private tick(): void {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    for (const npc of this.npcs) {
      npc.behaviorTree.tick(npc.blackboard, dt);
    }
  }

  getNpcUpdateMessage(): NpcUpdateMessage {
    return {
      type: MessageType.NpcUpdate,
      npcs: this.npcs.map(npc => ({
        id: npc.id,
        name: npc.name,
        x: npc.blackboard.x,
        y: npc.blackboard.y,
        z: npc.blackboard.z,
        rx: npc.blackboard.rx ?? 0,
        ry: npc.blackboard.ry ?? 0,
        action: npc.blackboard.action ?? 'idle',
        color: npc.color,
      })),
    };
  }
}
