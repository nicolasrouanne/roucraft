import * as THREE from 'three';
import { TerrainGenerator } from '../../server/world/TerrainGenerator';
import { meshChunk, type ChunkNeighbors } from './ChunkMesher';
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  VERTICAL_CHUNKS,
  blockIndex,
  worldToChunk,
  chunkKey,
} from '../../shared/ChunkConstants';
import { BlockType } from '../../shared/BlockTypes';

const RENDER_DISTANCE = 4;

interface ChunkEntry {
  data: Uint8Array;
  mesh: THREE.Mesh | null;
}

export class ChunkManager {
  private chunks = new Map<string, ChunkEntry>();
  private terrainGenerator: TerrainGenerator;
  private scene: THREE.Scene;
  private material: THREE.MeshLambertMaterial;

  constructor(scene: THREE.Scene, seed: number) {
    this.scene = scene;
    this.terrainGenerator = new TerrainGenerator(seed);
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  }

  update(playerX: number, playerZ: number): void {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    const neededKeys = new Set<string>();

    // Determine which chunks should be loaded
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        for (let cy = 0; cy < VERTICAL_CHUNKS; cy++) {
          const key = chunkKey(cx, cy, cz);
          neededKeys.add(key);

          if (!this.chunks.has(key)) {
            this.loadChunk(cx, cy, cz);
          }
        }
      }
    }

    // Unload far chunks
    for (const [key, entry] of this.chunks) {
      if (!neededKeys.has(key)) {
        if (entry.mesh) {
          this.scene.remove(entry.mesh);
          entry.mesh.geometry.dispose();
        }
        this.chunks.delete(key);
      }
    }
  }

  private loadChunk(cx: number, cy: number, cz: number): void {
    const key = chunkKey(cx, cy, cz);
    const data = this.terrainGenerator.generateChunk(cx, cy, cz);
    const entry: ChunkEntry = { data, mesh: null };
    this.chunks.set(key, entry);
    this.createChunkMesh(key, data, cx, cy, cz);
  }

  private getNeighborData(cx: number, cy: number, cz: number): ChunkNeighbors {
    return {
      px: this.chunks.get(chunkKey(cx + 1, cy, cz))?.data,
      nx: this.chunks.get(chunkKey(cx - 1, cy, cz))?.data,
      py: this.chunks.get(chunkKey(cx, cy + 1, cz))?.data,
      ny: this.chunks.get(chunkKey(cx, cy - 1, cz))?.data,
      pz: this.chunks.get(chunkKey(cx, cy, cz + 1))?.data,
      nz: this.chunks.get(chunkKey(cx, cy, cz - 1))?.data,
    };
  }

  private createChunkMesh(
    key: string,
    data: Uint8Array,
    cx: number,
    cy: number,
    cz: number,
  ): void {
    const entry = this.chunks.get(key);
    if (!entry) return;

    // Remove old mesh if any
    if (entry.mesh) {
      this.scene.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      entry.mesh = null;
    }

    const neighbors = this.getNeighborData(cx, cy, cz);
    const meshData = meshChunk(data, neighbors);
    if (!meshData) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(meshData.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT, cz * CHUNK_SIZE);
    this.scene.add(mesh);
    entry.mesh = mesh;
  }

  rebuildChunkMesh(key: string): void {
    const entry = this.chunks.get(key);
    if (!entry) return;

    const parts = key.split(',').map(Number);
    this.createChunkMesh(key, entry.data, parts[0], parts[1], parts[2]);
  }

  getBlock(wx: number, wy: number, wz: number): BlockType {
    const { cx, cy, cz, lx, ly, lz } = worldToChunk(wx, wy, wz);
    const entry = this.chunks.get(chunkKey(cx, cy, cz));
    if (!entry) return BlockType.Air;
    return entry.data[blockIndex(lx, ly, lz)];
  }

  setBlock(wx: number, wy: number, wz: number, type: BlockType): void {
    const { cx, cy, cz, lx, ly, lz } = worldToChunk(wx, wy, wz);
    const key = chunkKey(cx, cy, cz);
    const entry = this.chunks.get(key);
    if (!entry) return;

    entry.data[blockIndex(lx, ly, lz)] = type;
    this.rebuildChunkMesh(key);

    // Rebuild neighbor chunks if block is on a border
    if (lx === 0) this.rebuildChunkMesh(chunkKey(cx - 1, cy, cz));
    if (lx === CHUNK_SIZE - 1) this.rebuildChunkMesh(chunkKey(cx + 1, cy, cz));
    if (ly === 0) this.rebuildChunkMesh(chunkKey(cx, cy - 1, cz));
    if (ly === CHUNK_HEIGHT - 1) this.rebuildChunkMesh(chunkKey(cx, cy + 1, cz));
    if (lz === 0) this.rebuildChunkMesh(chunkKey(cx, cy, cz - 1));
    if (lz === CHUNK_SIZE - 1) this.rebuildChunkMesh(chunkKey(cx, cy, cz + 1));
  }
}
