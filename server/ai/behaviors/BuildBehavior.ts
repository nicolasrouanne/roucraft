import { type BehaviorNode, type Blackboard, NodeStatus, Sequence, Leaf } from '../BehaviorTree.js';
import { findPath, type PathNode } from '../Pathfinding.js';
import { BlockType } from '../../../shared/BlockTypes.js';
import type { WorldManager } from '../../world/WorldManager.js';

const PLACE_INTERVAL = 0.5; // seconds per block
const WALK_SPEED = 2;

interface BuildBlock {
  dx: number;
  dy: number;
  dz: number;
  type: BlockType;
}

interface BuildTemplate {
  name: string;
  blocks: BuildBlock[];
}

const SMALL_HOUSE: BuildTemplate = {
  name: 'house',
  blocks: (() => {
    const blocks: BuildBlock[] = [];
    // Floor
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        blocks.push({ dx: x, dy: 0, dz: z, type: BlockType.Planks });
      }
    }
    // Walls (4 high)
    for (let y = 1; y <= 3; y++) {
      for (let x = 0; x < 5; x++) {
        blocks.push({ dx: x, dy: y, dz: 0, type: BlockType.Cobblestone });
        blocks.push({ dx: x, dy: y, dz: 4, type: BlockType.Cobblestone });
      }
      for (let z = 1; z < 4; z++) {
        blocks.push({ dx: 0, dy: y, dz: z, type: BlockType.Cobblestone });
        blocks.push({ dx: 4, dy: y, dz: z, type: BlockType.Cobblestone });
      }
    }
    // Door opening (remove 2 blocks on front wall)
    const filtered = blocks.filter(b => {
      if (b.dx === 2 && b.dz === 0 && (b.dy === 1 || b.dy === 2)) return false;
      return true;
    });
    // Roof
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        filtered.push({ dx: x, dy: 4, dz: z, type: BlockType.Planks });
      }
    }
    return filtered;
  })(),
};

const TOWER: BuildTemplate = {
  name: 'tower',
  blocks: (() => {
    const blocks: BuildBlock[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
          // Only outer ring, hollow inside
          if (x > 0 && x < 2 && z > 0 && z < 2 && y > 0 && y < 7) continue;
          blocks.push({ dx: x, dy: y, dz: z, type: BlockType.Brick });
        }
      }
    }
    return blocks;
  })(),
};

const WALL: BuildTemplate = {
  name: 'wall',
  blocks: (() => {
    const blocks: BuildBlock[] = [];
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 3; y++) {
        blocks.push({ dx: x, dy: y, dz: 0, type: BlockType.Stone });
      }
    }
    return blocks;
  })(),
};

const TEMPLATES = [SMALL_HOUSE, TOWER, WALL];

export interface BlockPlacedCallback {
  (x: number, y: number, z: number, type: BlockType): void;
}

export function createBuildBehavior(
  world: WorldManager,
  onBlockPlaced: BlockPlacedCallback,
): BehaviorNode {
  return new Sequence([
    // Choose a template and location
    new Leaf((bb: Blackboard) => {
      if (bb.buildPlan) return NodeStatus.SUCCESS;

      const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
      const ox = Math.floor(bb.x) + Math.floor(Math.random() * 20) - 10;
      const oz = Math.floor(bb.z) + Math.floor(Math.random() * 20) - 10;

      // Find ground level
      let oy = Math.floor(bb.y);
      for (let y = oy + 5; y >= oy - 10; y--) {
        if (world.getBlock(ox, y - 1, oz) !== BlockType.Air &&
            world.getBlock(ox, y, oz) === BlockType.Air) {
          oy = y;
          break;
        }
      }

      bb.buildPlan = {
        template,
        originX: ox,
        originY: oy,
        originZ: oz,
        blockIndex: 0,
        placeTimer: 0,
      };
      bb.action = 'building ' + template.name;
      return NodeStatus.SUCCESS;
    }),

    // Place blocks one by one
    new Leaf((bb: Blackboard, dt: number) => {
      const plan = bb.buildPlan;
      if (!plan) return NodeStatus.FAILURE;

      plan.placeTimer -= dt;
      if (plan.placeTimer > 0) return NodeStatus.RUNNING;

      const template = plan.template as BuildTemplate;
      if (plan.blockIndex >= template.blocks.length) {
        bb.buildPlan = null;
        bb.action = 'idle';
        return NodeStatus.SUCCESS;
      }

      const block = template.blocks[plan.blockIndex];
      const wx = plan.originX + block.dx;
      const wy = plan.originY + block.dy;
      const wz = plan.originZ + block.dz;

      // Move NPC near the block
      const dx = wx + 0.5 - bb.x;
      const dz = wz + 0.5 - bb.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 3) {
        // Walk closer
        const step = WALK_SPEED * dt;
        const ratio = Math.min(step / dist, 1);
        bb.x += dx * ratio;
        bb.z += dz * ratio;
        bb.ry = Math.atan2(dx, dz);
        return NodeStatus.RUNNING;
      }

      // Place the block
      world.setBlock(wx, wy, wz, block.type);
      onBlockPlaced(wx, wy, wz, block.type);

      plan.blockIndex++;
      plan.placeTimer = PLACE_INTERVAL;

      // Face the block
      bb.ry = Math.atan2(dx, dz);

      return NodeStatus.RUNNING;
    }),
  ]);
}
