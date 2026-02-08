import { type BehaviorNode, type Blackboard, NodeStatus, Sequence, Leaf } from '../BehaviorTree.js';
import { findPath, type PathNode } from '../Pathfinding.js';
import { BlockType } from '../../../shared/BlockTypes.js';
import type { WorldManager } from '../../world/WorldManager.js';

const SEARCH_RADIUS = 15;
const WALK_SPEED = 2;
const MINE_TIME = 2; // seconds

export interface BlockRemovedCallback {
  (x: number, y: number, z: number): void;
}

function findNearbyBlock(
  world: WorldManager,
  cx: number,
  cy: number,
  cz: number,
  targetType: BlockType,
): PathNode | null {
  let closest: PathNode | null = null;
  let closestDist = Infinity;

  for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
    for (let dz = -SEARCH_RADIUS; dz <= SEARCH_RADIUS; dz++) {
      for (let dy = -5; dy <= 5; dy++) {
        const x = cx + dx;
        const y = cy + dy;
        const z = cz + dz;
        if (world.getBlock(x, y, z) === targetType) {
          // Need a walkable position adjacent to this block
          const positions = [
            { x: x + 1, y, z },
            { x: x - 1, y, z },
            { x, y, z: z + 1 },
            { x, y, z: z - 1 },
          ];
          for (const pos of positions) {
            if (world.getBlock(pos.x, pos.y, pos.z) === BlockType.Air &&
                world.getBlock(pos.x, pos.y + 1, pos.z) === BlockType.Air &&
                world.getBlock(pos.x, pos.y - 1, pos.z) !== BlockType.Air) {
              const dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
              if (dist < closestDist) {
                closestDist = dist;
                closest = { x: pos.x, y: pos.y, z: pos.z };
              }
            }
          }
        }
      }
    }
  }

  return closest;
}

const GATHER_TARGETS = [BlockType.Wood, BlockType.Stone, BlockType.Coal, BlockType.Iron];

export function createGatherBehavior(
  world: WorldManager,
  onBlockRemoved: BlockRemovedCallback,
): BehaviorNode {
  return new Sequence([
    // Find a target block and pathfind to it
    new Leaf((bb: Blackboard) => {
      if (bb.gatherPath && bb.gatherPath.length > 0) return NodeStatus.SUCCESS;

      const targetType = GATHER_TARGETS[Math.floor(Math.random() * GATHER_TARGETS.length)];
      const ox = Math.floor(bb.x);
      const oy = Math.floor(bb.y);
      const oz = Math.floor(bb.z);

      const adjacentPos = findNearbyBlock(world, ox, oy, oz, targetType);
      if (!adjacentPos) return NodeStatus.FAILURE;

      const start: PathNode = { x: ox, y: oy, z: oz };
      const path = findPath(world, start, adjacentPos);

      if (path && path.length > 0) {
        bb.gatherPath = path;
        bb.gatherPathIndex = 1;
        bb.gatherTarget = targetType;
        bb.gatherBlockPos = adjacentPos;
        bb.action = 'going to gather';
        return NodeStatus.SUCCESS;
      }

      return NodeStatus.FAILURE;
    }),

    // Walk along path to target
    new Leaf((bb: Blackboard, dt: number) => {
      const path = bb.gatherPath as PathNode[] | undefined;
      if (!path || bb.gatherPathIndex >= path.length) {
        bb.gatherPath = null;
        return NodeStatus.SUCCESS;
      }

      const target = path[bb.gatherPathIndex];
      const targetX = target.x + 0.5;
      const targetY = target.y;
      const targetZ = target.z + 0.5;

      const dx = targetX - bb.x;
      const dy = targetY - bb.y;
      const dz = targetZ - bb.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.2) {
        bb.x = targetX;
        bb.y = targetY;
        bb.z = targetZ;
        bb.gatherPathIndex++;

        if (bb.gatherPathIndex >= path.length) {
          bb.gatherPath = null;
          return NodeStatus.SUCCESS;
        }
        return NodeStatus.RUNNING;
      }

      const step = WALK_SPEED * dt;
      const ratio = Math.min(step / dist, 1);
      bb.x += dx * ratio;
      bb.y += dy * ratio;
      bb.z += dz * ratio;
      bb.ry = Math.atan2(dx, dz);

      return NodeStatus.RUNNING;
    }),

    // Mine the block
    new Leaf((bb: Blackboard, dt: number) => {
      if (bb.mineTimer === undefined) {
        bb.mineTimer = MINE_TIME;
        bb.action = 'mining';
      }

      bb.mineTimer -= dt;
      if (bb.mineTimer > 0) return NodeStatus.RUNNING;

      // Remove the block
      const pos = bb.gatherBlockPos as PathNode;
      if (pos) {
        // Find the actual block to mine (one of the 4 adjacent positions)
        const ox = Math.floor(bb.x);
        const oz = Math.floor(bb.z);
        const oy = Math.floor(bb.y);
        // Look at all adjacent blocks for the target type
        const checkPositions = [
          { x: ox + 1, y: oy, z: oz },
          { x: ox - 1, y: oy, z: oz },
          { x: ox, y: oy, z: oz + 1 },
          { x: ox, y: oy, z: oz - 1 },
          { x: ox + 1, y: oy - 1, z: oz },
          { x: ox - 1, y: oy - 1, z: oz },
          { x: ox, y: oy - 1, z: oz + 1 },
          { x: ox, y: oy - 1, z: oz - 1 },
        ];

        for (const cp of checkPositions) {
          if (world.getBlock(cp.x, cp.y, cp.z) === bb.gatherTarget) {
            world.setBlock(cp.x, cp.y, cp.z, BlockType.Air);
            onBlockRemoved(cp.x, cp.y, cp.z);
            break;
          }
        }

        // Increment resource counter
        const resourceKey = `gathered_${bb.gatherTarget}`;
        bb[resourceKey] = (bb[resourceKey] || 0) + 1;
      }

      bb.mineTimer = undefined;
      bb.gatherBlockPos = null;
      bb.action = 'idle';
      return NodeStatus.SUCCESS;
    }),
  ]);
}
