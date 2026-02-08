import * as THREE from 'three';

const BODY_WIDTH = 0.6;
const BODY_HEIGHT = 1.2;
const BODY_DEPTH = 0.3;
const HEAD_SIZE = 0.5;
const ARM_WIDTH = 0.25;
const ARM_HEIGHT = 0.9;
const LEG_WIDTH = 0.25;
const LEG_HEIGHT = 0.9;

interface NpcData {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  action: string;
  color: [number, number, number];
}

interface NpcInstance {
  group: THREE.Group;
  nameSprite: THREE.Sprite;
  actionSprite: THREE.Sprite;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  prevX: number;
  prevZ: number;
  walkPhase: number;
  lastAction: string;
}

export class NPCRenderer {
  private scene: THREE.Scene;
  private npcs = new Map<string, NpcInstance>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  update(npcDataList: NpcData[], dt: number): void {
    const activeIds = new Set<string>();

    for (const data of npcDataList) {
      activeIds.add(data.id);
      let instance = this.npcs.get(data.id);

      if (!instance) {
        instance = this.createNpc(data);
        this.npcs.set(data.id, instance);
        this.scene.add(instance.group);
      }

      // Update position
      instance.group.position.set(data.x, data.y, data.z);
      instance.group.rotation.y = data.ry;

      // Walk animation
      const dx = data.x - instance.prevX;
      const dz = data.z - instance.prevZ;
      const speed = Math.sqrt(dx * dx + dz * dz);
      instance.prevX = data.x;
      instance.prevZ = data.z;

      if (speed > 0.01) {
        instance.walkPhase += dt * 8;
        const swing = Math.sin(instance.walkPhase) * 0.5;
        instance.leftArm.rotation.x = swing;
        instance.rightArm.rotation.x = -swing;
        instance.leftLeg.rotation.x = -swing;
        instance.rightLeg.rotation.x = swing;
      } else {
        // Idle - gradually return to neutral
        instance.leftArm.rotation.x *= 0.9;
        instance.rightArm.rotation.x *= 0.9;
        instance.leftLeg.rotation.x *= 0.9;
        instance.rightLeg.rotation.x *= 0.9;
      }

      // Update action label if changed
      if (data.action !== instance.lastAction) {
        instance.lastAction = data.action;
        this.updateActionSprite(instance.actionSprite, data.action);
      }
    }

    // Remove NPCs no longer present
    for (const [id, instance] of this.npcs) {
      if (!activeIds.has(id)) {
        this.scene.remove(instance.group);
        this.disposeInstance(instance);
        this.npcs.delete(id);
      }
    }
  }

  private createNpc(data: NpcData): NpcInstance {
    const group = new THREE.Group();
    const bodyColor = new THREE.Color(data.color[0], data.color[1], data.color[2]);
    const skinColor = new THREE.Color(0.9, 0.75, 0.6);

    // Head
    const headGeo = new THREE.BoxGeometry(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE);
    const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = BODY_HEIGHT / 2 + HEAD_SIZE / 2;
    group.add(head);

    // Body
    const bodyGeo = new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH);
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Arms - pivoted from shoulder
    const armGeo = new THREE.BoxGeometry(ARM_WIDTH, ARM_HEIGHT, BODY_DEPTH);
    const armMat = new THREE.MeshLambertMaterial({ color: bodyColor.clone().multiplyScalar(0.8) });

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-(BODY_WIDTH / 2 + ARM_WIDTH / 2), 0.1, 0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(BODY_WIDTH / 2 + ARM_WIDTH / 2, 0.1, 0);
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(LEG_WIDTH, LEG_HEIGHT, BODY_DEPTH);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333355 });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-LEG_WIDTH / 2 - 0.02, -(BODY_HEIGHT / 2 + LEG_HEIGHT / 2), 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(LEG_WIDTH / 2 + 0.02, -(BODY_HEIGHT / 2 + LEG_HEIGHT / 2), 0);
    group.add(rightLeg);

    // Name sprite
    const nameSprite = this.createTextSprite(data.name, 'bold 28px sans-serif', '#ffffff', 'rgba(0,0,0,0.5)');
    nameSprite.position.y = BODY_HEIGHT / 2 + HEAD_SIZE + 0.5;
    nameSprite.scale.set(2, 0.5, 1);
    group.add(nameSprite);

    // Action sprite (below name)
    const actionSprite = this.createTextSprite(data.action, '22px sans-serif', '#ffff88', 'rgba(0,0,0,0.3)');
    actionSprite.position.y = BODY_HEIGHT / 2 + HEAD_SIZE + 0.1;
    actionSprite.scale.set(2, 0.4, 1);
    group.add(actionSprite);

    group.position.set(data.x, data.y, data.z);

    return {
      group,
      nameSprite,
      actionSprite,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      prevX: data.x,
      prevZ: data.z,
      walkPhase: 0,
      lastAction: data.action,
    };
  }

  private createTextSprite(
    text: string,
    font: string,
    textColor: string,
    bgColor: string,
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = bgColor;
    ctx.roundRect(0, 8, canvas.width, canvas.height - 16, 8);
    ctx.fill();

    ctx.font = font;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    return new THREE.Sprite(material);
  }

  private updateActionSprite(sprite: THREE.Sprite, action: string): void {
    const oldTexture = sprite.material.map;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.roundRect(0, 8, canvas.width, canvas.height - 16, 8);
    ctx.fill();

    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#ffff88';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(action, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    sprite.material.map = texture;
    sprite.material.needsUpdate = true;
    oldTexture?.dispose();
  }

  private disposeInstance(instance: NpcInstance): void {
    instance.group.traverse((child) => {
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

  dispose(): void {
    for (const [id, instance] of this.npcs) {
      this.scene.remove(instance.group);
      this.disposeInstance(instance);
    }
    this.npcs.clear();
  }
}
