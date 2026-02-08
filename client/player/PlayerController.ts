import * as THREE from 'three';

const MOVE_SPEED = 20;
const LOOK_SENSITIVITY = 0.002;

export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private position = new THREE.Vector3(0, 80, 0);
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private keys = new Set<string>();
  private isLocked = false;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.camera.position.copy(this.position);

    // Pointer lock
    canvas.addEventListener('click', () => {
      canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === canvas;
    });

    // Mouse look
    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      this.euler.y -= e.movementX * LOOK_SENSITIVITY;
      this.euler.x -= e.movementY * LOOK_SENSITIVITY;
      this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  update(dt: number): void {
    if (!this.isLocked) return;

    // Apply rotation to camera
    this.camera.quaternion.setFromEuler(this.euler);

    // Movement direction relative to camera
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

    const velocity = new THREE.Vector3();

    if (this.keys.has('KeyW')) velocity.add(forward);
    if (this.keys.has('KeyS')) velocity.sub(forward);
    if (this.keys.has('KeyD')) velocity.add(right);
    if (this.keys.has('KeyA')) velocity.sub(right);
    if (this.keys.has('Space')) velocity.y += 1;
    if (this.keys.has('ShiftLeft')) velocity.y -= 1;

    if (velocity.lengthSq() > 0) {
      velocity.normalize().multiplyScalar(MOVE_SPEED * dt);
      this.position.add(velocity);
    }

    this.camera.position.copy(this.position);
  }

  getPosition(): { x: number; y: number; z: number } {
    return { x: this.position.x, y: this.position.y, z: this.position.z };
  }
}
