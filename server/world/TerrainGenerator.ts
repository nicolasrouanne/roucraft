import Alea from 'alea';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { BlockType } from '../../shared/BlockTypes.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '../../shared/ChunkConstants.js';

const BASE_HEIGHT = 64;
const AMPLITUDE = 30;
const WATER_LEVEL = 60;

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

export class TerrainGenerator {
  private noise2D: NoiseFunction2D;

  constructor(public readonly seed: number) {
    const rng = Alea(seed);
    this.noise2D = createNoise2D(rng);
  }

  generateChunk(cx: number, cy: number, cz: number): Uint8Array {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    const chunkWorldY = cy * CHUNK_HEIGHT;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = cx * CHUNK_SIZE + x;
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wz = cz * CHUNK_SIZE + z;
        const height = sampleHeight(this.noise2D, wx, wz);

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

          if (block !== BlockType.Air) {
            data[blockIndex(x, y, z)] = block;
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
