import * as THREE from 'three';
import { TerrainGenerator } from '../../server/world/TerrainGenerator';
import { meshChunk, type ChunkNeighbors } from './ChunkMesher';
import { WorkerPool, type WorkerMeshResult } from './WorkerPool';
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
  waterMesh: THREE.Mesh | null;
  meshing: boolean; // true if a worker is currently meshing this chunk
  generation: number; // incremented on each remesh to detect stale results
}

export class ChunkManager {
  private chunks = new Map<string, ChunkEntry>();
  private terrainGenerator: TerrainGenerator;
  private scene: THREE.Scene;
  private opaqueMaterial: THREE.MeshLambertMaterial;
  private waterMaterial: THREE.MeshLambertMaterial;
  private workerPool: WorkerPool;
  private playerX = 0;
  private playerZ = 0;

  constructor(scene: THREE.Scene, seed: number) {
    this.scene = scene;
    this.terrainGenerator = new TerrainGenerator(seed);
    this.opaqueMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.workerPool = new WorkerPool();
  }

  update(playerX: number, playerZ: number): void {
    this.playerX = playerX;
    this.playerZ = playerZ;
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    const neededKeys = new Set<string>();

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
        if (entry.waterMesh) {
          this.scene.remove(entry.waterMesh);
          entry.waterMesh.geometry.dispose();
        }
        this.chunks.delete(key);
      }
    }
  }

  private loadChunk(cx: number, cy: number, cz: number): void {
    const key = chunkKey(cx, cy, cz);
    const data = this.terrainGenerator.generateChunk(cx, cy, cz);
    const entry: ChunkEntry = { data, mesh: null, waterMesh: null, meshing: false, generation: 0 };
    this.chunks.set(key, entry);
    this.createChunkMeshAsync(key, data, cx, cy, cz);
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

  private chunkPriority(cx: number, cz: number): number {
    const pcx = Math.floor(this.playerX / CHUNK_SIZE);
    const pcz = Math.floor(this.playerZ / CHUNK_SIZE);
    const dx = cx - pcx;
    const dz = cz - pcz;
    // Higher priority for closer chunks (invert distance)
    return 1000 - (dx * dx + dz * dz);
  }

  private async createChunkMeshAsync(
    key: string,
    data: Uint8Array,
    cx: number,
    cy: number,
    cz: number,
  ): Promise<void> {
    const entry = this.chunks.get(key);
    if (!entry) return;

    entry.meshing = true;
    const gen = ++entry.generation;

    const neighbors = this.getNeighborData(cx, cy, cz);
    const priority = this.chunkPriority(cx, cz);

    try {
      const result = await this.workerPool.meshChunk(data, neighbors, cx, cy, cz, priority);

      // Check if chunk was unloaded or remeshed while we waited
      const currentEntry = this.chunks.get(key);
      if (!currentEntry || currentEntry.generation !== gen) return;

      currentEntry.meshing = false;

      // Remove old meshes
      if (currentEntry.mesh) {
        this.scene.remove(currentEntry.mesh);
        currentEntry.mesh.geometry.dispose();
        currentEntry.mesh = null;
      }
      if (currentEntry.waterMesh) {
        this.scene.remove(currentEntry.waterMesh);
        currentEntry.waterMesh.geometry.dispose();
        currentEntry.waterMesh = null;
      }

      if (!result) return;

      this.applyMeshResult(currentEntry, result, cx, cy, cz);
    } catch (err) {
      // Worker failed, fall back to synchronous meshing
      const currentEntry = this.chunks.get(key);
      if (!currentEntry || currentEntry.generation !== gen) return;
      currentEntry.meshing = false;
      this.createChunkMeshSync(key, data, cx, cy, cz);
    }
  }

  private applyMeshResult(
    entry: ChunkEntry,
    result: WorkerMeshResult,
    cx: number,
    cy: number,
    cz: number,
  ): void {
    // Opaque mesh
    if (result.positions.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(result.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(result.normals, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(result.colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(result.indices, 1));

      const mesh = new THREE.Mesh(geometry, this.opaqueMaterial);
      mesh.position.set(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT, cz * CHUNK_SIZE);
      this.scene.add(mesh);
      entry.mesh = mesh;
    }

    // Water mesh
    if (result.waterPositions.length > 0) {
      const waterGeometry = new THREE.BufferGeometry();
      waterGeometry.setAttribute('position', new THREE.BufferAttribute(result.waterPositions, 3));
      waterGeometry.setAttribute('normal', new THREE.BufferAttribute(result.waterNormals, 3));
      waterGeometry.setAttribute('color', new THREE.BufferAttribute(result.waterColors, 3));
      waterGeometry.setIndex(new THREE.BufferAttribute(result.waterIndices, 1));

      const waterMesh = new THREE.Mesh(waterGeometry, this.waterMaterial);
      waterMesh.position.set(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT, cz * CHUNK_SIZE);
      waterMesh.renderOrder = 1;
      this.scene.add(waterMesh);
      entry.waterMesh = waterMesh;
    }
  }

  private createChunkMeshSync(
    key: string,
    data: Uint8Array,
    cx: number,
    cy: number,
    cz: number,
  ): void {
    const entry = this.chunks.get(key);
    if (!entry) return;

    if (entry.mesh) {
      this.scene.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      entry.mesh = null;
    }
    if (entry.waterMesh) {
      this.scene.remove(entry.waterMesh);
      entry.waterMesh.geometry.dispose();
      entry.waterMesh = null;
    }

    const neighbors = this.getNeighborData(cx, cy, cz);
    const meshData = meshChunk(data, neighbors, cx, cy, cz);
    if (!meshData) return;

    this.applyMeshResult(entry, meshData, cx, cy, cz);
  }

  rebuildChunkMesh(key: string): void {
    const entry = this.chunks.get(key);
    if (!entry) return;

    const parts = key.split(',').map(Number);
    // For block edits, use synchronous meshing for immediate feedback
    this.createChunkMeshSync(key, entry.data, parts[0], parts[1], parts[2]);
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

  dispose(): void {
    this.workerPool.dispose();
  }
}
