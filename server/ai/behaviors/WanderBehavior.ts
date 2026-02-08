import { type BehaviorNode, type Blackboard, NodeStatus, Sequence, Leaf } from '../BehaviorTree.js';
import { findPath, type PathNode } from '../Pathfinding.js';
import type { WorldManager } from '../../world/WorldManager.js';

const WANDER_RADIUS = 20;
const WALK_SPEED = 2; // blocks per second
const WAIT_MIN = 2;
const WAIT_MAX = 5;

export function createWanderBehavior(world: WorldManager): BehaviorNode {
  return new Sequence([
    // Pick a random destination
    new Leaf((bb: Blackboard) => {
      if (bb.wanderPath && bb.wanderPath.length > 0) return NodeStatus.SUCCESS;

      const ox = Math.floor(bb.x);
      const oz = Math.floor(bb.z);
      const oy = Math.floor(bb.y);

      const dx = ox + Math.floor(Math.random() * WANDER_RADIUS * 2) - WANDER_RADIUS;
      const dz = oz + Math.floor(Math.random() * WANDER_RADIUS * 2) - WANDER_RADIUS;

      // Find ground level at destination
      let dy = oy;
      for (let y = oy + 5; y >= oy - 10; y--) {
        const block = world.getBlock(dx, y - 1, dz);
        const above1 = world.getBlock(dx, y, dz);
        const above2 = world.getBlock(dx, y + 1, dz);
        if (block !== 0 && above1 === 0 && above2 === 0) {
          dy = y;
          break;
        }
      }

      const start: PathNode = { x: ox, y: oy, z: oz };
      const goal: PathNode = { x: dx, y: dy, z: dz };
      const path = findPath(world, start, goal);

      if (path && path.length > 1) {
        bb.wanderPath = path;
        bb.wanderPathIndex = 1; // skip start node
        bb.action = 'walking';
        return NodeStatus.SUCCESS;
      }

      return NodeStatus.FAILURE;
    }),

    // Walk along path
    new Leaf((bb: Blackboard, dt: number) => {
      const path = bb.wanderPath as PathNode[] | undefined;
      if (!path || bb.wanderPathIndex >= path.length) {
        bb.wanderPath = null;
        return NodeStatus.SUCCESS;
      }

      const target = path[bb.wanderPathIndex];
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
        bb.wanderPathIndex++;

        if (bb.wanderPathIndex >= path.length) {
          bb.wanderPath = null;
          return NodeStatus.SUCCESS;
        }
        return NodeStatus.RUNNING;
      }

      const step = WALK_SPEED * dt;
      const ratio = Math.min(step / dist, 1);
      bb.x += dx * ratio;
      bb.y += dy * ratio;
      bb.z += dz * ratio;

      // Face walking direction
      bb.ry = Math.atan2(dx, dz);

      return NodeStatus.RUNNING;
    }),

    // Wait at destination
    new Leaf((bb: Blackboard, dt: number) => {
      if (bb.wanderWait === undefined) {
        bb.wanderWait = WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
        bb.action = 'idle';
      }

      bb.wanderWait -= dt;
      if (bb.wanderWait <= 0) {
        bb.wanderWait = undefined;
        return NodeStatus.SUCCESS;
      }

      return NodeStatus.RUNNING;
    }),
  ]);
}
