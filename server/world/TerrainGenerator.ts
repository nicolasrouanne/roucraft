import Alea from 'alea';
import { createNoise2D, createNoise3D, type NoiseFunction2D, type NoiseFunction3D } from 'simplex-noise';
import { BlockType } from '../../shared/BlockTypes.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '../../shared/ChunkConstants.js';

const BASE_HEIGHT = 64;
const AMPLITUDE = 30;
const WATER_LEVEL = 60;
const CAVE_THRESHOLD = 0.6;
const CAVE_MAX_Y = 50;

const OCTAVES = [
  { freq: 0.01, amp: 1 },
  { freq: 0.02, amp: 0.5 },
  { freq: 0.04, amp: 0.25 },
  { freq: 0.08, amp: 0.125 },
];

function sampleHeight(noise2D: NoiseFunction2D, wx: number, wz: number): number {
  let value = 0;
  let totalAmp = 0;
  for (const { freq, amp } of OCTAVES) {
    value += noise2D(wx * freq, wz * freq) * amp;
    totalAmp += amp;
  }
  value /= totalAmp;
  return Math.floor(BASE_HEIGHT + value * AMPLITUDE);
}

// Deterministic hash for per-block decisions (ores, flowers, trees)
function blockHash(x: number, y: number, z: number, seed: number): number {
  let h = seed;
  h = ((h ^ (x * 374761393)) + 1376312589) | 0;
  h = ((h ^ (y * 668265263)) + 2144716967) | 0;
  h = ((h ^ (z * 1274126177)) + 1879968187) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h & 0x7fffffff) / 0x7fffffff; // 0..1
}

export class TerrainGenerator {
  private noise2D: NoiseFunction2D;
  private noise3D: NoiseFunction3D;
  private treeNoise: NoiseFunction2D;

  constructor(public readonly seed: number) {
    const rng = Alea(seed);
    this.noise2D = createNoise2D(rng);
    this.noise3D = createNoise3D(rng);
    this.treeNoise = createNoise2D(rng);
  }

  generateChunk(cx: number, cy: number, cz: number): Uint8Array {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    const chunkWorldY = cy * CHUNK_HEIGHT;

    // Height map for this chunk's XZ columns
    const heightMap = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = cx * CHUNK_SIZE + x;
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wz = cz * CHUNK_SIZE + z;
        heightMap[x + z * CHUNK_SIZE] = sampleHeight(this.noise2D, wx, wz);
      }
    }

    // Pass 1: basic terrain + caves + ores
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = cx * CHUNK_SIZE + x;
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wz = cz * CHUNK_SIZE + z;
        const height = heightMap[x + z * CHUNK_SIZE];

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const wy = chunkWorldY + y;
          let block = BlockType.Air;

          if (wy === height) {
            block = height <= 62 ? BlockType.Sand : BlockType.Grass;
          } else if (wy >= height - 3 && wy < height) {
            block = BlockType.Dirt;
          } else if (wy < height - 3) {
            block = BlockType.Stone;
          } else if (wy <= WATER_LEVEL && wy > height) {
            block = BlockType.Water;
          }

          // Caves: 3D noise carving below CAVE_MAX_Y, only in solid non-surface blocks
          if (block === BlockType.Stone && wy < CAVE_MAX_Y && wy > 1) {
            const caveValue = this.noise3D(wx * 0.05, wy * 0.05, wz * 0.05);
            if (caveValue > CAVE_THRESHOLD) {
              block = BlockType.Air;
            }
          }

          // Ores: placed randomly in remaining stone
          if (block === BlockType.Stone) {
            const rnd = blockHash(wx, wy, wz, this.seed);
            if (wy < 20 && rnd < 0.003) {
              block = BlockType.Gold;
            } else if (wy < 40 && rnd < 0.008) {
              block = BlockType.Iron;
            } else if (wy < 60 && rnd < 0.015) {
              block = BlockType.Coal;
            }
          }

          if (block !== BlockType.Air) {
            data[blockIndex(x, y, z)] = block;
          }
        }
      }
    }

    // Pass 2: flowers on grass (1 block above surface)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = cx * CHUNK_SIZE + x;
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wz = cz * CHUNK_SIZE + z;
        const height = heightMap[x + z * CHUNK_SIZE];
        const flowerY = height + 1;
        const ly = flowerY - chunkWorldY;

        if (ly >= 0 && ly < CHUNK_HEIGHT && height > WATER_LEVEL) {
          // Check surface is grass
          const surfaceLy = height - chunkWorldY;
          if (surfaceLy >= 0 && surfaceLy < CHUNK_HEIGHT) {
            const surfaceBlock = data[blockIndex(x, surfaceLy, z)];
            if (surfaceBlock === BlockType.Grass) {
              const rnd = blockHash(wx, flowerY, wz, this.seed + 7);
              if (rnd < 0.02) {
                data[blockIndex(x, ly, z)] = BlockType.Flower;
              }
            }
          }
        }
      }
    }

    // Pass 3: trees on grass
    // Trees are column-based; only place trunk base at surface+1
    // Need to check a wider area for canopy overlap (trees can extend into neighbor chunks)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = cx * CHUNK_SIZE + x;
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wz = cz * CHUNK_SIZE + z;
        const height = heightMap[x + z * CHUNK_SIZE];

        if (height <= WATER_LEVEL) continue;

        // Check if surface is grass in this chunk
        const surfaceLy = height - chunkWorldY;
        if (surfaceLy < 0 || surfaceLy >= CHUNK_HEIGHT) continue;
        if (data[blockIndex(x, surfaceLy, z)] !== BlockType.Grass) continue;

        // Tree placement: ~1 tree per 8x8 area
        const treeRnd = blockHash(wx, 0, wz, this.seed + 42);
        if (treeRnd > 0.016) continue; // ~1.6% chance per grass block

        // Avoid trees too close to chunk edges (canopy would be clipped)
        if (x < 2 || x >= CHUNK_SIZE - 2 || z < 2 || z >= CHUNK_SIZE - 2) continue;

        // Don't place flower here if tree goes here
        const flowerLy = height + 1 - chunkWorldY;
        if (flowerLy >= 0 && flowerLy < CHUNK_HEIGHT && data[blockIndex(x, flowerLy, z)] === BlockType.Flower) {
          data[blockIndex(x, flowerLy, z)] = BlockType.Air;
        }

        // Trunk height: 4-6
        const trunkHeight = 4 + Math.floor(treeRnd * 1000) % 3;
        const canopyRadius = 2;

        // Place trunk
        for (let ty = 1; ty <= trunkHeight; ty++) {
          const ly = height + ty - chunkWorldY;
          if (ly >= 0 && ly < CHUNK_HEIGHT) {
            data[blockIndex(x, ly, z)] = BlockType.Wood;
          }
        }

        // Place leaves (sphere-ish shape around top of trunk)
        const leafCenterY = height + trunkHeight;
        for (let dx = -canopyRadius; dx <= canopyRadius; dx++) {
          for (let dz = -canopyRadius; dz <= canopyRadius; dz++) {
            for (let dy = -1; dy <= canopyRadius; dy++) {
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (dist > canopyRadius + 0.5) continue;

              const lx = x + dx;
              const lz = z + dz;
              const ly = leafCenterY + dy - chunkWorldY;

              if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
              if (ly < 0 || ly >= CHUNK_HEIGHT) continue;

              // Don't overwrite trunk
              if (data[blockIndex(lx, ly, lz)] === BlockType.Air) {
                data[blockIndex(lx, ly, lz)] = BlockType.Leaves;
              }
            }
          }
        }
      }
    }

    return data;
  }
}

export function getHeightAt(wx: number, wz: number, seed: number): number {
  const rng = Alea(seed);
  const noise2D = createNoise2D(rng);
  return sampleHeight(noise2D, wx, wz);
}
