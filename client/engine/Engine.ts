import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { PlayerController } from '../player/PlayerController';
import { BlockInteraction } from '../player/BlockInteraction';
import { HUD } from '../ui/HUD';
import { SkySystem } from '../rendering/SkySystem';
import { BlockParticles } from '../rendering/BlockParticles';
import { NPCRenderer } from '../entities/NPCRenderer';
import { SoundManager } from './SoundManager';
import { type GameSettings, loadSettings } from './Settings';
import type { NpcUpdateMessage } from '../../shared/Protocol';

const SKY_COLOR = 0x87CEEB;
const FOG_NEAR = 100;
const FOG_FAR = 400;
const MAX_DT = 0.1; // 100ms cap

export class Engine {
  private renderer!: THREE.WebGLRenderer;
  camera!: THREE.PerspectiveCamera;
  scene!: THREE.Scene;
  chunkManager!: ChunkManager;
  playerController!: PlayerController;
  blockInteraction!: BlockInteraction;
  hud!: HUD;
  private skySystem!: SkySystem;
  private blockParticles!: BlockParticles;
  private npcRenderer!: NPCRenderer;
  soundManager!: SoundManager;
  private lastNpcData: NpcUpdateMessage['npcs'] = [];
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

    // SkySystem takes over lighting (removes the lights above and manages its own)
    this.skySystem = new SkySystem(this.scene);

    // Block destruction particles
    this.blockParticles = new BlockParticles(this.scene);

    // NPC rendering
    this.npcRenderer = new NPCRenderer(this.scene);

    // Sound
    this.soundManager = new SoundManager();
    const settings = loadSettings();
    this.soundManager.volume = settings.volume;

    // Subsystems
    const seed = 12345;
    this.chunkManager = new ChunkManager(this.scene, seed);
    this.playerController = new PlayerController(this.camera, canvas);
    this.blockInteraction = new BlockInteraction(this.scene, this.playerController);
    this.blockInteraction.onBlockBreak = (x, y, z, blockType) => {
      this.blockParticles.spawnAt(x, y, z, blockType);
      this.soundManager.playBreak();
    };
    this.blockInteraction.onBlockPlace = (_x, _y, _z, _blockType) => {
      this.soundManager.playPlace();
    };
    this.hud = new HUD((blockType) => {
      this.blockInteraction.selectedBlockType = blockType;
    });

    // Resize handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

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
    this.skySystem.update(dt);
    this.blockParticles.update(dt);

    const pos = this.playerController.getPosition();
    this.chunkManager.update(pos.x, pos.z);

    this.blockInteraction.update(this.camera, this.chunkManager);

    // HUD visibility based on pointer lock
    if (this.playerController.isLocked) {
      this.hud.show();
    } else {
      this.hud.hide();
    }

    this.npcRenderer.update(this.lastNpcData, dt);

    this.hud.updateFps();
    this.hud.updateCoords(pos.x, pos.y, pos.z);
  }

  handleNpcUpdate(data: NpcUpdateMessage): void {
    this.lastNpcData = data.npcs;
  }

  applySettings(settings: GameSettings): void {
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
    this.soundManager.volume = settings.volume;
    this.playerController.mouseSensitivity = settings.mouseSensitivity;
  }
}
