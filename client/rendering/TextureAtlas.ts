import * as THREE from 'three';
import { BlockType, BLOCK_PROPERTIES } from '../../shared/BlockTypes';

const ATLAS_SIZE = 256;
const TILE_SIZE = 16;
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE; // 16

export class TextureAtlas {
  private texture: THREE.CanvasTexture;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Fill with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    // Generate tiles for each block type
    this.generateTile(ctx, BlockType.Grass, 0, this.grassTop);
    this.generateTile(ctx, BlockType.Grass, 1, this.grassSide);
    this.generateTile(ctx, BlockType.Dirt, 0, this.solidNoise);
    this.generateTile(ctx, BlockType.Stone, 0, this.stonePattern);
    this.generateTile(ctx, BlockType.Sand, 0, this.solidNoise);
    this.generateTile(ctx, BlockType.Water, 0, this.solidNoise);
    this.generateTile(ctx, BlockType.Wood, 0, this.woodPattern);
    this.generateTile(ctx, BlockType.Leaves, 0, this.leavesPattern);
    this.generateTile(ctx, BlockType.Cobblestone, 0, this.stonePattern);
    this.generateTile(ctx, BlockType.Planks, 0, this.planksPattern);
    this.generateTile(ctx, BlockType.Glass, 0, this.glassPattern);
    this.generateTile(ctx, BlockType.Brick, 0, this.brickPattern);
    this.generateTile(ctx, BlockType.Coal, 0, this.orePattern);
    this.generateTile(ctx, BlockType.Iron, 0, this.orePattern);
    this.generateTile(ctx, BlockType.Gold, 0, this.orePattern);

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
  }

  private tilePosition(blockType: number, variant: number): { tx: number; ty: number } {
    const index = blockType * 2 + variant; // 2 variants per block type
    const tx = (index % TILES_PER_ROW) * TILE_SIZE;
    const ty = Math.floor(index / TILES_PER_ROW) * TILE_SIZE;
    return { tx, ty };
  }

  private generateTile(
    ctx: CanvasRenderingContext2D,
    blockType: BlockType,
    variant: number,
    pattern: (ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]) => void,
  ): void {
    const { tx, ty } = this.tilePosition(blockType, variant);
    const props = BLOCK_PROPERTIES[blockType];
    const color = variant === 0 ? (props.colorTop || props.color) : props.color;
    pattern.call(this, ctx, tx, ty, color);
  }

  private solidNoise(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const noise = 0.9 + Math.random() * 0.2; // +/-10%
        const idx = (py * TILE_SIZE + px) * 4;
        imageData.data[idx] = Math.min(255, color[0] * 255 * noise);
        imageData.data[idx + 1] = Math.min(255, color[1] * 255 * noise);
        imageData.data[idx + 2] = Math.min(255, color[2] * 255 * noise);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  private grassTop(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const noise = 0.85 + Math.random() * 0.3;
        const darkSpot = Math.random() < 0.1 ? 0.7 : 1.0;
        const idx = (py * TILE_SIZE + px) * 4;
        imageData.data[idx] = Math.min(255, color[0] * 255 * noise * darkSpot);
        imageData.data[idx + 1] = Math.min(255, color[1] * 255 * noise * darkSpot);
        imageData.data[idx + 2] = Math.min(255, color[2] * 255 * noise * darkSpot);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  private grassSide(ctx: CanvasRenderingContext2D, x: number, y: number, _color: [number, number, number]): void {
    const brown: [number, number, number] = [0.55, 0.38, 0.2];
    const green: [number, number, number] = [0.36, 0.7, 0.2];
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const noise = 0.9 + Math.random() * 0.2;
        const isGreenEdge = py <= 2 + (Math.random() < 0.3 ? 1 : 0);
        const c = isGreenEdge ? green : brown;
        const idx = (py * TILE_SIZE + px) * 4;
        imageData.data[idx] = Math.min(255, c[0] * 255 * noise);
        imageData.data[idx + 1] = Math.min(255, c[1] * 255 * noise);
        imageData.data[idx + 2] = Math.min(255, c[2] * 255 * noise);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  private woodPattern(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const noise = 0.9 + Math.random() * 0.2;
        // Vertical grain lines
        const grain = (px % 4 === 0) ? 0.8 : 1.0;
        const idx = (py * TILE_SIZE + px) * 4;
        imageData.data[idx] = Math.min(255, color[0] * 255 * noise * grain);
        imageData.data[idx + 1] = Math.min(255, color[1] * 255 * noise * grain);
        imageData.data[idx + 2] = Math.min(255, color[2] * 255 * noise * grain);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  private leavesPattern(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const noise = 0.85 + Math.random() * 0.3;
        const darkSpot = Math.random() < 0.15 ? 0.6 : 1.0;
        const idx = (py * TILE_SIZE + px) * 4;
        imageData.data[idx] = Math.min(255, color[0] * 255 * noise * darkSpot);
        imageData.data[idx + 1] = Math.min(255, color[1] * 255 * noise * darkSpot);
        imageData.data[idx + 2] = Math.min(255, color[2] * 255 * noise * darkSpot);
        imageData.data[idx + 3] = 200;
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  private stonePattern(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const noise = 0.85 + Math.random() * 0.3;
        // Darker patches
        const patch = ((px + py * 3) % 7 < 2) ? 0.8 : 1.0;
        const idx = (py * TILE_SIZE + px) * 4;
        imageData.data[idx] = Math.min(255, color[0] * 255 * noise * patch);
        imageData.data[idx + 1] = Math.min(255, color[1] * 255 * noise * patch);
        imageData.data[idx + 2] = Math.min(255, color[2] * 255 * noise * patch);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  private planksPattern(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const noise = 0.9 + Math.random() * 0.2;
        // Horizontal plank lines
        const plankLine = (py % 4 === 0) ? 0.7 : 1.0;
        const idx = (py * TILE_SIZE + px) * 4;
        imageData.data[idx] = Math.min(255, color[0] * 255 * noise * plankLine);
        imageData.data[idx + 1] = Math.min(255, color[1] * 255 * noise * plankLine);
        imageData.data[idx + 2] = Math.min(255, color[2] * 255 * noise * plankLine);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  private glassPattern(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const idx = (py * TILE_SIZE + px) * 4;
        const isBorder = px === 0 || px === TILE_SIZE - 1 || py === 0 || py === TILE_SIZE - 1;
        if (isBorder) {
          imageData.data[idx] = color[0] * 200;
          imageData.data[idx + 1] = color[1] * 200;
          imageData.data[idx + 2] = color[2] * 200;
          imageData.data[idx + 3] = 200;
        } else {
          imageData.data[idx] = color[0] * 255;
          imageData.data[idx + 1] = color[1] * 255;
          imageData.data[idx + 2] = color[2] * 255;
          imageData.data[idx + 3] = 80;
        }
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  private brickPattern(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const noise = 0.9 + Math.random() * 0.2;
        // Brick mortar lines
        const row = Math.floor(py / 4);
        const isMortarH = py % 4 === 0;
        const offset = (row % 2) * 8;
        const isMortarV = (px + offset) % 8 === 0;
        const mortar = (isMortarH || isMortarV) ? 0.6 : 1.0;
        const idx = (py * TILE_SIZE + px) * 4;
        imageData.data[idx] = Math.min(255, color[0] * 255 * noise * mortar);
        imageData.data[idx + 1] = Math.min(255, color[1] * 255 * noise * mortar);
        imageData.data[idx + 2] = Math.min(255, color[2] * 255 * noise * mortar);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  private orePattern(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
    // Stone base with colored ore spots
    const stoneColor: [number, number, number] = [0.5, 0.5, 0.5];
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const noise = 0.9 + Math.random() * 0.2;
        const isOre = Math.random() < 0.15;
        const c = isOre ? color : stoneColor;
        const idx = (py * TILE_SIZE + px) * 4;
        imageData.data[idx] = Math.min(255, c[0] * 255 * noise);
        imageData.data[idx + 1] = Math.min(255, c[1] * 255 * noise);
        imageData.data[idx + 2] = Math.min(255, c[2] * 255 * noise);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  getTexture(): THREE.CanvasTexture {
    return this.texture;
  }
}
