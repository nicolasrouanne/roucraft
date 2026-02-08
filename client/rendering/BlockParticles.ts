import * as THREE from 'three';
import { BlockType, BLOCK_PROPERTIES } from '../../shared/BlockTypes';

const GRAVITY = -15;
const PARTICLE_SIZE = 0.1;
const MIN_LIFETIME = 0.8;
const MAX_LIFETIME = 1.2;
const PARTICLE_COUNT = 10;
const SPREAD = 0.4;
const UPWARD_BIAS = 4;

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  age: number;
  material: THREE.MeshBasicMaterial;
}

const geometry = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);

export class BlockParticles {
  private particles: Particle[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawnAt(x: number, y: number, z: number, blockType: BlockType): void {
    const props = BLOCK_PROPERTIES[blockType];
    if (!props) return;

    const baseColor = new THREE.Color(props.color[0], props.color[1], props.color[2]);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: baseColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
        transparent: true,
        opacity: 1.0,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        x + 0.5 + (Math.random() - 0.5) * 0.6,
        y + 0.5 + (Math.random() - 0.5) * 0.6,
        z + 0.5 + (Math.random() - 0.5) * 0.6,
      );

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * SPREAD * 2,
        Math.random() * UPWARD_BIAS,
        (Math.random() - 0.5) * SPREAD * 2,
      );

      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity,
        lifetime: MIN_LIFETIME + Math.random() * (MAX_LIFETIME - MIN_LIFETIME),
        age: 0,
        material,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;

      if (p.age >= p.lifetime) {
        this.scene.remove(p.mesh);
        p.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Apply gravity
      p.velocity.y += GRAVITY * dt;

      // Update position
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      // Fade out
      const t = p.age / p.lifetime;
      p.material.opacity = 1.0 - t;

      // Spin
      p.mesh.rotation.x += dt * 3;
      p.mesh.rotation.y += dt * 2;
    }
  }
}
