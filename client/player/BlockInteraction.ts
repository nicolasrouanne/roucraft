import * as THREE from 'three';
import { BlockType, BLOCK_PROPERTIES } from '../../shared/BlockTypes';
import type { ChunkManager } from '../world/ChunkManager';
import type { PlayerController } from './PlayerController';

const MAX_REACH = 6;

export class BlockInteraction {
  private highlight: THREE.LineSegments;
  private targetBlock: { x: number; y: number; z: number } | null = null;
  private adjacentBlock: { x: number; y: number; z: number } | null = null;
  selectedBlockType: BlockType = BlockType.Grass;
  onBlockBreak: ((x: number, y: number, z: number, blockType: BlockType) => void) | null = null;
  onBlockPlace: ((x: number, y: number, z: number, blockType: BlockType) => void) | null = null;
  private playerController: PlayerController;

  constructor(scene: THREE.Scene, playerController: PlayerController) {
    this.playerController = playerController;

    // Wireframe highlight cube
    const geo = new THREE.BoxGeometry(1.001, 1.001, 1.001);
    const edges = new THREE.EdgesGeometry(geo);
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }),
    );
    this.highlight.visible = false;
    scene.add(this.highlight);

    // Mouse events for block break/place
    document.addEventListener('mousedown', (e) => {
      if (!this.playerController.isLocked) return;
      if (e.button === 0) this.breakBlock();
      if (e.button === 2) this.placeBlock();
    });

    // Prevent context menu
    document.addEventListener('contextmenu', (e) => {
      if (this.playerController.isLocked) e.preventDefault();
    });
  }

  private chunkManager: ChunkManager | null = null;

  update(camera: THREE.PerspectiveCamera, chunkManager: ChunkManager): void {
    this.chunkManager = chunkManager;
    this.raycast(camera, chunkManager);

    if (this.targetBlock) {
      this.highlight.visible = true;
      this.highlight.position.set(
        this.targetBlock.x + 0.5,
        this.targetBlock.y + 0.5,
        this.targetBlock.z + 0.5,
      );
    } else {
      this.highlight.visible = false;
    }
  }

  private raycast(camera: THREE.PerspectiveCamera, chunkManager: ChunkManager): void {
    // DDA voxel raycast
    const origin = camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = dir.x !== 0
      ? ((dir.x > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDeltaX)
      : Infinity;
    let tMaxY = dir.y !== 0
      ? ((dir.y > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDeltaY)
      : Infinity;
    let tMaxZ = dir.z !== 0
      ? ((dir.z > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDeltaZ)
      : Infinity;

    let prevX = x;
    let prevY = y;
    let prevZ = z;

    this.targetBlock = null;
    this.adjacentBlock = null;

    for (let i = 0; i < MAX_REACH * 3; i++) {
      const block = chunkManager.getBlock(x, y, z);
      if (block !== BlockType.Air && BLOCK_PROPERTIES[block as BlockType]?.solid) {
        this.targetBlock = { x, y, z };
        this.adjacentBlock = { x: prevX, y: prevY, z: prevZ };
        return;
      }

      prevX = x;
      prevY = y;
      prevZ = z;

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          if (tMaxX > MAX_REACH) break;
          x += stepX;
          tMaxX += tDeltaX;
        } else {
          if (tMaxZ > MAX_REACH) break;
          z += stepZ;
          tMaxZ += tDeltaZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          if (tMaxY > MAX_REACH) break;
          y += stepY;
          tMaxY += tDeltaY;
        } else {
          if (tMaxZ > MAX_REACH) break;
          z += stepZ;
          tMaxZ += tDeltaZ;
        }
      }
    }
  }

  private breakBlock(): void {
    if (!this.targetBlock || !this.chunkManager) return;
    const { x, y, z } = this.targetBlock;
    const blockType = this.chunkManager.getBlock(x, y, z) as BlockType;
    this.chunkManager.setBlock(x, y, z, BlockType.Air);
    if (this.onBlockBreak && blockType !== BlockType.Air) {
      this.onBlockBreak(x, y, z, blockType);
    }
  }

  private placeBlock(): void {
    if (!this.adjacentBlock || !this.chunkManager) return;
    const { x, y, z } = this.adjacentBlock;

    // Don't place if it would overlap the player
    if (this.playerController.overlapsPlayer(x, y, z, x + 1, y + 1, z + 1)) {
      return;
    }

    this.chunkManager.setBlock(x, y, z, this.selectedBlockType);
    this.onBlockPlace?.(x, y, z, this.selectedBlockType);
  }
}
