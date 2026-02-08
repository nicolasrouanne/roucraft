import { BlockType } from '../../shared/BlockTypes.js';
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  WORLD_HEIGHT,
  BLOCKS_PER_CHUNK,
  blockIndex,
  worldToChunk,
  chunkKey,
} from '../../shared/ChunkConstants.js';
import { TerrainGenerator } from './TerrainGenerator.js';
import { saveWorld, loadWorld } from './WorldSave.js';

export class WorldManager {
  readonly seed: number;
  private terrainGenerator: TerrainGenerator;
  private modifiedChunks: Map<string, Uint8Array> = new Map();

  constructor(seed: number) {
    this.seed = seed;
    this.terrainGenerator = new TerrainGenerator(seed);
  }

  save(worldsDir: string, roomCode: string): void {
    if (this.modifiedChunks.size === 0) return;
    saveWorld(worldsDir, roomCode, this.seed, this.modifiedChunks);
  }

  loadSave(worldsDir: string, roomCode: string): boolean {
    const data = loadWorld(worldsDir, roomCode);
    if (!data) return false;
    this.modifiedChunks = data.modifiedChunks;
    return true;
  }

  getChunk(cx: number, cy: number, cz: number): Uint8Array {
    const key = chunkKey(cx, cy, cz);

    const modified = this.modifiedChunks.get(key);
    if (modified) {
      return modified;
    }

    const generated = this.terrainGenerator.generateChunk(cx, cy, cz);
    return generated;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (y < 0 || y >= WORLD_HEIGHT) {
      return BlockType.Air;
    }

    const { cx, cy, cz, lx, ly, lz } = worldToChunk(x, y, z);
    const chunk = this.getChunk(cx, cy, cz);
    return chunk[blockIndex(lx, ly, lz)] as BlockType;
  }

  setBlock(x: number, y: number, z: number, type: BlockType): boolean {
    if (y < 0 || y >= WORLD_HEIGHT) {
      return false;
    }

    if (type < 0 || type > BlockType.Flower) {
      return false;
    }

    const { cx, cy, cz, lx, ly, lz } = worldToChunk(x, y, z);
    const key = chunkKey(cx, cy, cz);

    let chunk = this.modifiedChunks.get(key);
    if (!chunk) {
      // Copy generated chunk so we don't mutate the generator's output
      const generated = this.terrainGenerator.generateChunk(cx, cy, cz);
      chunk = new Uint8Array(generated);
      this.modifiedChunks.set(key, chunk);
    }

    chunk[blockIndex(lx, ly, lz)] = type;
    return true;
  }

  getModifiedChunkCount(): number {
    return this.modifiedChunks.size;
  }
}
