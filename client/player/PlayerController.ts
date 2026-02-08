import * as THREE from 'three';
import { BlockType, BLOCK_PROPERTIES } from '../../shared/BlockTypes';
import type { ChunkManager } from '../world/ChunkManager';

const WALK_SPEED = 5;
const SPRINT_SPEED = 8;
const LOOK_SENSITIVITY = 0.002;
const GRAVITY = -20;
const TERMINAL_VELOCITY = -50;
const JUMP_IMPULSE = 8;
const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.6;
const HALF_WIDTH = PLAYER_WIDTH / 2; // 0.3

export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private position = new THREE.Vector3(0, 100, 0);
  private velocity = new THREE.Vector3(0, 0, 0);
  private pitch = 0;
  private yaw = 0;
  private keys = new Set<string>();
  isLocked = false;
  private isOnGround = false;
  private spawned = false;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;

    // Pointer lock
    canvas.addEventListener('click', () => {
      if (!this.isLocked) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === canvas;
    });

    // Mouse look
    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      this.yaw -= e.movementX * LOOK_SENSITIVITY;
      this.pitch -= e.movementY * LOOK_SENSITIVITY;
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  private findSpawnHeight(chunkManager: ChunkManager): number {
    for (let y = 200; y >= 0; y--) {
      const block = chunkManager.getBlock(0, y, 0);
      if (block !== BlockType.Air && BLOCK_PROPERTIES[block as BlockType]?.solid) {
        return y + 1;
      }
    }
    return 80;
  }

  update(dt: number, chunkManager: ChunkManager): void {
    // Find spawn position on first update
    if (!this.spawned) {
      const spawnY = this.findSpawnHeight(chunkManager);
      this.position.set(0, spawnY + 1, 0);
      this.spawned = true;
    }

    // Apply camera rotation
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    if (!this.isLocked) {
      this.camera.position.set(
        this.position.x,
        this.position.y + EYE_HEIGHT,
        this.position.z,
      );
      return;
    }

    // Movement input
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const right = new THREE.Vector3(1, 0, 0);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const isSprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = isSprinting ? SPRINT_SPEED : WALK_SPEED;

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.keys.has('KeyW') || this.keys.has('KeyZ')) moveDir.add(forward);
    if (this.keys.has('KeyS')) moveDir.sub(forward);
    if (this.keys.has('KeyD')) moveDir.add(right);
    if (this.keys.has('KeyA') || this.keys.has('KeyQ')) moveDir.sub(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
    }

    // Horizontal velocity from input
    this.velocity.x = moveDir.x * speed;
    this.velocity.z = moveDir.z * speed;

    // Jump
    if (this.keys.has('Space') && this.isOnGround) {
      this.velocity.y = JUMP_IMPULSE;
      this.isOnGround = false;
    }

    // Gravity
    this.velocity.y += GRAVITY * dt;
    if (this.velocity.y < TERMINAL_VELOCITY) {
      this.velocity.y = TERMINAL_VELOCITY;
    }

    // Sweep collision: move each axis independently
    const dx = this.velocity.x * dt;
    const dy = this.velocity.y * dt;
    const dz = this.velocity.z * dt;

    // Move X
    this.position.x += dx;
    if (this.collidesAt(this.position, chunkManager)) {
      this.position.x -= dx;
      if (dx > 0) {
        this.position.x = Math.floor(this.position.x + HALF_WIDTH) - HALF_WIDTH;
      } else {
        this.position.x = Math.ceil(this.position.x - HALF_WIDTH) + HALF_WIDTH;
      }
      this.velocity.x = 0;
    }

    // Move Y
    this.position.y += dy;
    if (this.collidesAt(this.position, chunkManager)) {
      this.position.y -= dy;
      if (dy < 0) {
        // Falling - land on top of block
        this.position.y = Math.floor(this.position.y);
        this.isOnGround = true;
      } else {
        // Hit ceiling
        this.position.y = Math.ceil(this.position.y + PLAYER_HEIGHT) - PLAYER_HEIGHT;
      }
      this.velocity.y = 0;
    } else {
      this.isOnGround = false;
    }

    // Move Z
    this.position.z += dz;
    if (this.collidesAt(this.position, chunkManager)) {
      this.position.z -= dz;
      if (dz > 0) {
        this.position.z = Math.floor(this.position.z + HALF_WIDTH) - HALF_WIDTH;
      } else {
        this.position.z = Math.ceil(this.position.z - HALF_WIDTH) + HALF_WIDTH;
      }
      this.velocity.z = 0;
    }

    // Update camera
    this.camera.position.set(
      this.position.x,
      this.position.y + EYE_HEIGHT,
      this.position.z,
    );
  }

  private collidesAt(pos: THREE.Vector3, chunkManager: ChunkManager): boolean {
    const minX = Math.floor(pos.x - HALF_WIDTH);
    const maxX = Math.floor(pos.x + HALF_WIDTH - 0.0001);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + PLAYER_HEIGHT - 0.0001);
    const minZ = Math.floor(pos.z - HALF_WIDTH);
    const maxZ = Math.floor(pos.z + HALF_WIDTH - 0.0001);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const block = chunkManager.getBlock(bx, by, bz);
          if (block !== BlockType.Air && BLOCK_PROPERTIES[block as BlockType]?.solid) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /** Check if a world-space AABB overlaps the player */
  overlapsPlayer(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    const pMinX = this.position.x - HALF_WIDTH;
    const pMaxX = this.position.x + HALF_WIDTH;
    const pMinY = this.position.y;
    const pMaxY = this.position.y + PLAYER_HEIGHT;
    const pMinZ = this.position.z - HALF_WIDTH;
    const pMaxZ = this.position.z + HALF_WIDTH;

    return pMinX < maxX && pMaxX > minX &&
           pMinY < maxY && pMaxY > minY &&
           pMinZ < maxZ && pMaxZ > minZ;
  }

  getPosition(): { x: number; y: number; z: number } {
    return { x: this.position.x, y: this.position.y, z: this.position.z };
  }

  getRotation(): { rx: number; ry: number } {
    return { rx: this.pitch, ry: this.yaw };
  }
}
