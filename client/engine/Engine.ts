import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { PlayerController } from '../player/PlayerController';
import { BlockInteraction } from '../player/BlockInteraction';
import { HUD } from '../ui/HUD';
import { SkySystem } from '../rendering/SkySystem';
import { BlockParticles } from '../rendering/BlockParticles';

const SKY_COLOR = 0x87CEEB;
const FOG_NEAR = 100;
const FOG_FAR = 400;
const MAX_DT = 0.1; // 100ms cap

export class Engine {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private chunkManager!: ChunkManager;
  private playerController!: PlayerController;
  private blockInteraction!: BlockInteraction;
  private hud!: HUD;
  private lastTime = 0;

  init(): void {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR);

    // Lighting
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(100, 200, 100);
    this.scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x362907, 0.3);
    this.scene.add(hemiLight);

    // Subsystems
    const seed = 12345;
    this.chunkManager = new ChunkManager(this.scene, seed);
    this.playerController = new PlayerController(this.camera, canvas);
    this.blockInteraction = new BlockInteraction(this.scene, this.playerController);
    this.hud = new HUD((blockType) => {
      this.blockInteraction.selectedBlockType = blockType;
    });

    // Resize handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Hide connection screen
    const connectionScreen = document.getElementById('connection-screen');
    if (connectionScreen) connectionScreen.style.display = 'none';

    // Start loop
    this.lastTime = performance.now();
    this.loop();
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    this.playerController.update(dt, this.chunkManager);

    const pos = this.playerController.getPosition();
    this.chunkManager.update(pos.x, pos.z);

    this.blockInteraction.update(this.camera, this.chunkManager);

    // HUD visibility based on pointer lock
    if (this.playerController.isLocked) {
      this.hud.show();
    } else {
      this.hud.hide();
    }

    this.hud.updateFps();
    this.hud.updateCoords(pos.x, pos.y, pos.z);
  }
}
