import * as THREE from 'three';
import { RemotePlayer } from './RemotePlayer';

export class EntityManager {
  private players: Map<string, RemotePlayer> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addPlayer(id: string, name: string, x: number, y: number, z: number): RemotePlayer {
    // Remove existing player with same id if any
    this.removePlayer(id);

    const player = new RemotePlayer(id, name, x, y, z);
    this.players.set(id, player);
    this.scene.add(player.group);
    return player;
  }

  removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      this.scene.remove(player.group);
      player.dispose();
      this.players.delete(id);
    }
  }

  updatePlayer(id: string, x: number, y: number, z: number, rx: number, ry: number): void {
    const player = this.players.get(id);
    if (player) {
      player.setTarget(x, y, z, rx, ry);
    }
  }

  getPlayer(id: string): RemotePlayer | undefined {
    return this.players.get(id);
  }

  update(dt: number): void {
    for (const [, player] of this.players) {
      player.update();
    }
  }

  clear(): void {
    for (const [id] of this.players) {
      this.removePlayer(id);
    }
  }

  get playerCount(): number {
    return this.players.size;
  }
}
