import * as THREE from 'three';

const BODY_WIDTH = 0.6;
const BODY_HEIGHT = 1.2;
const BODY_DEPTH = 0.3;
const HEAD_SIZE = 0.5;
const ARM_WIDTH = 0.25;
const ARM_HEIGHT = 0.9;
const LEG_WIDTH = 0.25;
const LEG_HEIGHT = 0.9;
const INTERPOLATION_DELAY = 100; // ms

interface PositionSnapshot {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  time: number;
}

export class RemotePlayer {
  readonly id: string;
  readonly name: string;
  readonly group: THREE.Group;

  private nameSprite: THREE.Sprite;
  private positionBuffer: PositionSnapshot[] = [];
  private currentX = 0;
  private currentY = 0;
  private currentZ = 0;
  private currentRx = 0;
  private currentRy = 0;

  constructor(id: string, name: string, x: number, y: number, z: number) {
    this.id = id;
    this.name = name;
    this.group = new THREE.Group();

    this.currentX = x;
    this.currentY = y;
    this.currentZ = z;
    this.group.position.set(x, y, z);

    // Generate a deterministic color from player id
    const hue = this.hashToHue(id);
    const bodyColor = new THREE.Color().setHSL(hue, 0.6, 0.5);
    const skinColor = new THREE.Color(0.9, 0.75, 0.6);

    // Head
    const headGeo = new THREE.BoxGeometry(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE);
    const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = BODY_HEIGHT / 2 + HEAD_SIZE / 2;
    this.group.add(head);

    // Body
    const bodyGeo = new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH);
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0;
    this.group.add(body);

    // Left arm
    const armGeo = new THREE.BoxGeometry(ARM_WIDTH, ARM_HEIGHT, BODY_DEPTH);
    const armMat = new THREE.MeshLambertMaterial({ color: bodyColor.clone().multiplyScalar(0.8) });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-(BODY_WIDTH / 2 + ARM_WIDTH / 2), 0.1, 0);
    this.group.add(leftArm);

    // Right arm
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(BODY_WIDTH / 2 + ARM_WIDTH / 2, 0.1, 0);
    this.group.add(rightArm);

    // Left leg
    const legGeo = new THREE.BoxGeometry(LEG_WIDTH, LEG_HEIGHT, BODY_DEPTH);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333355 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-LEG_WIDTH / 2 - 0.02, -(BODY_HEIGHT / 2 + LEG_HEIGHT / 2), 0);
    this.group.add(leftLeg);

    // Right leg
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(LEG_WIDTH / 2 + 0.02, -(BODY_HEIGHT / 2 + LEG_HEIGHT / 2), 0);
    this.group.add(rightLeg);

    // Name label sprite
    this.nameSprite = this.createNameSprite(name);
    this.nameSprite.position.y = BODY_HEIGHT / 2 + HEAD_SIZE + 0.3;
    this.group.add(this.nameSprite);
  }

  private hashToHue(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash) % 360) / 360;
  }

  private createNameSprite(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.roundRect(0, 8, canvas.width, canvas.height - 16, 8);
    ctx.fill();

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  pushPosition(x: number, y: number, z: number, rx: number, ry: number): void {
    this.positionBuffer.push({
      x, y, z, rx, ry,
      time: performance.now(),
    });

    // Keep only recent snapshots
    const cutoff = performance.now() - 1000;
    while (this.positionBuffer.length > 2 && this.positionBuffer[0].time < cutoff) {
      this.positionBuffer.shift();
    }
  }

  update(): void {
    const now = performance.now();
    const renderTime = now - INTERPOLATION_DELAY;

    if (this.positionBuffer.length >= 2) {
      // Find the two snapshots to interpolate between
      let from = this.positionBuffer[0];
      let to = this.positionBuffer[1];

      for (let i = 0; i < this.positionBuffer.length - 1; i++) {
        if (this.positionBuffer[i].time <= renderTime && this.positionBuffer[i + 1].time >= renderTime) {
          from = this.positionBuffer[i];
          to = this.positionBuffer[i + 1];
          break;
        }
      }

      const duration = to.time - from.time;
      const t = duration > 0 ? Math.min(1, (renderTime - from.time) / duration) : 1;

      this.currentX = from.x + (to.x - from.x) * t;
      this.currentY = from.y + (to.y - from.y) * t;
      this.currentZ = from.z + (to.z - from.z) * t;
      this.currentRx = from.rx + (to.rx - from.rx) * t;
      this.currentRy = from.ry + (to.ry - from.ry) * t;
    } else if (this.positionBuffer.length === 1) {
      const snap = this.positionBuffer[0];
      this.currentX = snap.x;
      this.currentY = snap.y;
      this.currentZ = snap.z;
      this.currentRx = snap.rx;
      this.currentRy = snap.ry;
    }

    this.group.position.set(this.currentX, this.currentY, this.currentZ);
    this.group.rotation.y = this.currentRy;
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    });
  }
}
