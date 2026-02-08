import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { BLOCKS_PER_CHUNK } from '../../shared/ChunkConstants.js';

const SAVE_VERSION = 1;
const HEADER_SIZE = 12; // 4 bytes version + 4 bytes seed + 4 bytes chunk count
const CHUNK_KEY_SIZE = 12; // 3 x int32 (cx, cy, cz)

export interface SaveData {
  seed: number;
  modifiedChunks: Map<string, Uint8Array>;
}

function writeInt32(buf: Buffer, offset: number, value: number): void {
  buf.writeInt32LE(value, offset);
}

function readInt32(buf: Buffer, offset: number): number {
  return buf.readInt32LE(offset);
}

export function saveWorld(worldsDir: string, roomCode: string, seed: number, modifiedChunks: Map<string, Uint8Array>): void {
  const dir = join(worldsDir, roomCode);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const chunkCount = modifiedChunks.size;
  const totalSize = HEADER_SIZE + chunkCount * (CHUNK_KEY_SIZE + BLOCKS_PER_CHUNK);
  const buf = Buffer.alloc(totalSize);

  let offset = 0;

  // Header
  writeInt32(buf, offset, SAVE_VERSION); offset += 4;
  writeInt32(buf, offset, seed); offset += 4;
  writeInt32(buf, offset, chunkCount); offset += 4;

  // Chunks
  for (const [key, data] of modifiedChunks) {
    const [cx, cy, cz] = key.split(',').map(Number);
    writeInt32(buf, offset, cx); offset += 4;
    writeInt32(buf, offset, cy); offset += 4;
    writeInt32(buf, offset, cz); offset += 4;
    data.forEach((byte, i) => {
      buf[offset + i] = byte;
    });
    offset += BLOCKS_PER_CHUNK;
  }

  const filePath = join(dir, 'world.bin');
  writeFileSync(filePath, buf);
  console.log(`World saved: ${filePath} (${chunkCount} chunks, ${(totalSize / 1024).toFixed(1)}KB)`);
}

export function loadWorld(worldsDir: string, roomCode: string): SaveData | null {
  const filePath = join(worldsDir, roomCode, 'world.bin');
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const buf = readFileSync(filePath);

    let offset = 0;
    const version = readInt32(buf, offset); offset += 4;
    if (version !== SAVE_VERSION) {
      console.warn(`Unknown save version ${version}, skipping load`);
      return null;
    }

    const seed = readInt32(buf, offset); offset += 4;
    const chunkCount = readInt32(buf, offset); offset += 4;

    const modifiedChunks = new Map<string, Uint8Array>();

    for (let i = 0; i < chunkCount; i++) {
      const cx = readInt32(buf, offset); offset += 4;
      const cy = readInt32(buf, offset); offset += 4;
      const cz = readInt32(buf, offset); offset += 4;

      const data = new Uint8Array(BLOCKS_PER_CHUNK);
      for (let j = 0; j < BLOCKS_PER_CHUNK; j++) {
        data[j] = buf[offset + j];
      }
      offset += BLOCKS_PER_CHUNK;

      modifiedChunks.set(`${cx},${cy},${cz}`, data);
    }

    console.log(`World loaded: ${filePath} (${chunkCount} chunks)`);
    return { seed, modifiedChunks };
  } catch (err) {
    console.error(`Failed to load world from ${filePath}:`, err);
    return null;
  }
}
