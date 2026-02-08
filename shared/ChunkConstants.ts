export const CHUNK_SIZE = 32;
export const CHUNK_HEIGHT = 32; // same as CHUNK_SIZE for cubic chunks
export const WORLD_HEIGHT = 256;
export const VERTICAL_CHUNKS = WORLD_HEIGHT / CHUNK_HEIGHT; // 8
export const RENDER_DISTANCE = 8; // chunks
export const BLOCKS_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT; // 32768

export function blockIndex(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
}

export function worldToChunk(wx: number, wy: number, wz: number): { cx: number; cy: number; cz: number; lx: number; ly: number; lz: number } {
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cy = Math.floor(wy / CHUNK_HEIGHT);
  const cz = Math.floor(wz / CHUNK_SIZE);
  const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const ly = ((wy % CHUNK_HEIGHT) + CHUNK_HEIGHT) % CHUNK_HEIGHT;
  const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return { cx, cy, cz, lx, ly, lz };
}

export function chunkToWorld(cx: number, cy: number, cz: number): { wx: number; wy: number; wz: number } {
  return { wx: cx * CHUNK_SIZE, wy: cy * CHUNK_HEIGHT, wz: cz * CHUNK_SIZE };
}

export function chunkKey(cx: number, cy: number, cz: number): string {
  return `${cx},${cy},${cz}`;
}
