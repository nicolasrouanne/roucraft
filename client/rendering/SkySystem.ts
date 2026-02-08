import * as THREE from 'three';

const CYCLE_DURATION = 20 * 60; // 20 minutes in seconds
const TWO_PI = Math.PI * 2;
const SUN_DISTANCE = 300;

// Sky colors for different times of day
const DAY_SKY = new THREE.Color(0x87CEEB);
const SUNSET_SKY = new THREE.Color(0xE86850);
const NIGHT_SKY = new THREE.Color(0x0a0a2e);

const DAY_FOG = new THREE.Color(0x87CEEB);
const SUNSET_FOG = new THREE.Color(0xD06040);
const NIGHT_FOG = new THREE.Color(0x0a0a2e);

const DAY_AMBIENT = new THREE.Color(0xffffff);
const NIGHT_AMBIENT = new THREE.Color(0x1a1a4e);

const SUNSET_SUN_COLOR = new THREE.Color(0xFFAA44);
const NOON_SUN_COLOR = new THREE.Color(0xffffff);

export class SkySystem {
  private time = 0.35; // Start slightly after sunrise
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private scene: THREE.Scene;
  private stars: THREE.Points;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Remove existing lights from the scene that Engine created - we take over
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.DirectionalLight ||
          obj instanceof THREE.AmbientLight ||
          obj instanceof THREE.HemisphereLight) {
        toRemove.push(obj);
      }
    });
    for (const obj of toRemove) {
      scene.remove(obj);
    }

    // Sun directional light
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    scene.add(this.sunLight);

    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(this.ambientLight);

    // Stars
    this.stars = this.createStars();
    this.stars.visible = false;
    scene.add(this.stars);

    this.updateLighting();
  }

  private createStars(): THREE.Points {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Random positions on a large sphere
      const theta = Math.random() * TWO_PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 400;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)); // Only upper hemisphere
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.8,
    });
    return new THREE.Points(geometry, material);
  }

  update(dt: number): void {
    this.time = (this.time + dt / CYCLE_DURATION) % 1.0;
    this.updateLighting();
  }

  private updateLighting(): void {
    const t = this.time;
    // Sun angle: 0=midnight (below), 0.25=sunrise (horizon), 0.5=noon (top), 0.75=sunset
    const sunAngle = t * TWO_PI;
    const sunY = Math.sin(sunAngle - Math.PI / 2); // -1 at midnight, +1 at noon
    const sunXZ = Math.cos(sunAngle - Math.PI / 2);

    // Sun position
    this.sunLight.position.set(
      sunXZ * SUN_DISTANCE,
      sunY * SUN_DISTANCE,
      SUN_DISTANCE * 0.3,
    );

    // Sun intensity: brightest at noon, off at night
    const sunHeight = Math.max(0, sunY); // 0 when below horizon
    const sunIntensity = Math.pow(sunHeight, 0.5); // Smooth ramp
    this.sunLight.intensity = sunIntensity;

    // Sun color: orange near horizon, white at noon
    if (sunHeight > 0.3) {
      this.sunLight.color.copy(NOON_SUN_COLOR);
    } else if (sunHeight > 0) {
      const blend = sunHeight / 0.3;
      this.sunLight.color.copy(SUNSET_SUN_COLOR).lerp(NOON_SUN_COLOR, blend);
    }

    // Ambient light
    const ambientIntensity = 0.1 + 0.3 * sunHeight;
    this.ambientLight.intensity = ambientIntensity;
    this.ambientLight.color.copy(NIGHT_AMBIENT).lerp(DAY_AMBIENT, Math.min(1, sunHeight * 3));

    // Sky / background color
    const skyColor = new THREE.Color();
    if (sunHeight > 0.3) {
      skyColor.copy(DAY_SKY);
    } else if (sunHeight > 0) {
      const blend = sunHeight / 0.3;
      skyColor.copy(SUNSET_SKY).lerp(DAY_SKY, blend);
    } else {
      // Below horizon: blend from sunset to night based on how far below
      const belowBlend = Math.min(1, Math.abs(sunY) * 3);
      skyColor.copy(SUNSET_SKY).lerp(NIGHT_SKY, belowBlend);
    }
    this.scene.background = skyColor;

    // Fog color
    const fogColor = new THREE.Color();
    if (sunHeight > 0.3) {
      fogColor.copy(DAY_FOG);
    } else if (sunHeight > 0) {
      fogColor.copy(SUNSET_FOG).lerp(DAY_FOG, sunHeight / 0.3);
    } else {
      fogColor.copy(SUNSET_FOG).lerp(NIGHT_FOG, Math.min(1, Math.abs(sunY) * 3));
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(fogColor);
    }

    // Stars visible at night
    const starsVisible = sunY < -0.05;
    this.stars.visible = starsVisible;
    if (starsVisible) {
      const starMat = this.stars.material as THREE.PointsMaterial;
      starMat.opacity = Math.min(1, Math.abs(sunY) * 4);
    }
  }

  getTime(): number {
    return this.time;
  }
}
