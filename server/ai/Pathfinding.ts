import { BlockType, BLOCK_PROPERTIES } from '../../shared/BlockTypes.js';
import { WORLD_HEIGHT } from '../../shared/ChunkConstants.js';
import type { WorldManager } from '../world/WorldManager.js';

export interface PathNode {
  x: number;
  y: number;
  z: number;
}

const MAX_NODES = 200;

function heuristic(a: PathNode, b: PathNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

function nodeKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function isSolid(world: WorldManager, x: number, y: number, z: number): boolean {
  if (y < 0 || y >= WORLD_HEIGHT) return false;
  const block = world.getBlock(x, y, z);
  return block !== BlockType.Air && BLOCK_PROPERTIES[block as BlockType]?.solid === true;
}

function isPassable(world: WorldManager, x: number, y: number, z: number): boolean {
  if (y < 0 || y >= WORLD_HEIGHT) return true;
  const block = world.getBlock(x, y, z);
  return block === BlockType.Air || BLOCK_PROPERTIES[block as BlockType]?.solid === false;
}

/** Check if a position is walkable: solid below, air at feet and head level */
function isWalkable(world: WorldManager, x: number, y: number, z: number): boolean {
  return isSolid(world, x, y - 1, z) &&
         isPassable(world, x, y, z) &&
         isPassable(world, x, y + 1, z);
}

const DIRS = [
  { dx: 1, dz: 0 },
  { dx: -1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: 0, dz: -1 },
];

function getNeighbors(world: WorldManager, node: PathNode): PathNode[] {
  const neighbors: PathNode[] = [];

  for (const { dx, dz } of DIRS) {
    const nx = node.x + dx;
    const nz = node.z + dz;

    // Same level walk
    if (isWalkable(world, nx, node.y, nz)) {
      neighbors.push({ x: nx, y: node.y, z: nz });
      continue;
    }

    // Step up by 1 block (jump) - need headroom above current position
    if (isWalkable(world, nx, node.y + 1, nz) &&
        isPassable(world, node.x, node.y + 2, node.z)) {
      neighbors.push({ x: nx, y: node.y + 1, z: nz });
      continue;
    }

    // Step down by 1 block
    if (isWalkable(world, nx, node.y - 1, nz) &&
        isPassable(world, nx, node.y, nz) &&
        isPassable(world, nx, node.y + 1, nz)) {
      neighbors.push({ x: nx, y: node.y - 1, z: nz });
    }
  }

  return neighbors;
}

interface AStarEntry {
  node: PathNode;
  g: number;
  f: number;
  parent: string | null;
}

export function findPath(
  world: WorldManager,
  start: PathNode,
  goal: PathNode,
): PathNode[] | null {
  const entries = new Map<string, AStarEntry>();
  const openKeys = new Set<string>();
  const closedKeys = new Set<string>();

  const startKey = nodeKey(start.x, start.y, start.z);
  const goalKey = nodeKey(goal.x, goal.y, goal.z);

  entries.set(startKey, {
    node: start,
    g: 0,
    f: heuristic(start, goal),
    parent: null,
  });
  openKeys.add(startKey);

  let explored = 0;

  while (openKeys.size > 0 && explored < MAX_NODES) {
    // Find node with lowest f
    let bestKey = '';
    let bestF = Infinity;
    for (const key of openKeys) {
      const entry = entries.get(key)!;
      if (entry.f < bestF) {
        bestF = entry.f;
        bestKey = key;
      }
    }

    openKeys.delete(bestKey);
    closedKeys.add(bestKey);
    explored++;

    // Goal reached - reconstruct path
    if (bestKey === goalKey) {
      const path: PathNode[] = [];
      let currentKey: string | null = bestKey;
      while (currentKey !== null) {
        const entry: AStarEntry = entries.get(currentKey)!;
        path.push(entry.node);
        currentKey = entry.parent;
      }
      path.reverse();
      return path;
    }

    const current = entries.get(bestKey)!;
    const neighbors = getNeighbors(world, current.node);

    for (const neighbor of neighbors) {
      const nKey = nodeKey(neighbor.x, neighbor.y, neighbor.z);
      if (closedKeys.has(nKey)) continue;

      const tentativeG = current.g + 1;
      const existing = entries.get(nKey);

      if (!existing || tentativeG < existing.g) {
        entries.set(nKey, {
          node: neighbor,
          g: tentativeG,
          f: tentativeG + heuristic(neighbor, goal),
          parent: bestKey,
        });
        openKeys.add(nKey);
      }
    }
  }

  return null;
}
