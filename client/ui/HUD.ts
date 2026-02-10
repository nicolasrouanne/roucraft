import { BlockType, BLOCK_PROPERTIES } from '../../shared/BlockTypes';
import { Crosshair } from './Crosshair';

const HOTBAR_BLOCKS: BlockType[] = [
  BlockType.Grass,
  BlockType.Dirt,
  BlockType.Stone,
  BlockType.Sand,
  BlockType.Wood,
  BlockType.Cobblestone,
  BlockType.Planks,
  BlockType.Glass,
  BlockType.Brick,
];

export class HUD {
  private container: HTMLDivElement;
  private crosshair: Crosshair;
  private hotbarSlots: HTMLDivElement[] = [];
  private selectedIndex = 0;
  private fpsElement: HTMLDivElement;
  private coordsElement: HTMLDivElement;
  private roomCodeElement: HTMLDivElement;
  private debugVisible = false;
  private frameCount = 0;
  private lastFpsTime = 0;
  private onBlockSelected: (blockType: BlockType) => void;

  constructor(onBlockSelected: (blockType: BlockType) => void) {
    this.onBlockSelected = onBlockSelected;
    this.container = document.getElementById('hud') as HTMLDivElement;

    this.crosshair = new Crosshair(this.container);

    // Debug info (FPS + coords)
    this.fpsElement = document.createElement('div');
    const fs = this.fpsElement.style;
    fs.position = 'absolute';
    fs.top = '8px';
    fs.left = '8px';
    fs.color = 'white';
    fs.fontSize = '14px';
    fs.fontFamily = 'monospace';
    fs.textShadow = '1px 1px 2px black';
    fs.display = 'none';
    fs.pointerEvents = 'none';
    this.container.appendChild(this.fpsElement);

    // Room code display
    this.roomCodeElement = document.createElement('div');
    const rcs = this.roomCodeElement.style;
    rcs.position = 'absolute';
    rcs.top = '8px';
    rcs.right = '8px';
    rcs.color = '#6bff6b';
    rcs.fontSize = '20px';
    rcs.fontFamily = 'monospace';
    rcs.fontWeight = 'bold';
    rcs.textShadow = '2px 2px 4px black';
    rcs.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    rcs.padding = '8px 12px';
    rcs.borderRadius = '6px';
    rcs.letterSpacing = '2px';
    rcs.display = 'none';
    rcs.cursor = 'pointer';
    rcs.transition = 'all 0.2s ease';
    rcs.userSelect = 'text';
    rcs.zIndex = '1000'; // Keep above other UI elements
    rcs.title = 'Click to copy room code';
    // Append to body instead of HUD container so it stays visible
    document.body.appendChild(this.roomCodeElement);

    // Make room code clickable to copy
    this.roomCodeElement.addEventListener('click', () => {
      const code = this.roomCodeElement.textContent?.replace('Room: ', '') || '';
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          // Visual feedback
          const original = this.roomCodeElement.textContent;
          this.roomCodeElement.textContent = 'Copied!';
          this.roomCodeElement.style.backgroundColor = 'rgba(50, 255, 50, 0.3)';
          setTimeout(() => {
            this.roomCodeElement.textContent = original;
            this.roomCodeElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
          }, 1000);
        });
      }
    });

    // Hover effect
    this.roomCodeElement.addEventListener('mouseenter', () => {
      this.roomCodeElement.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
      this.roomCodeElement.style.transform = 'scale(1.05)';
    });

    this.roomCodeElement.addEventListener('mouseleave', () => {
      this.roomCodeElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      this.roomCodeElement.style.transform = 'scale(1)';
    });

    this.coordsElement = document.createElement('div');
    const cs = this.coordsElement.style;
    cs.position = 'absolute';
    cs.top = '28px';
    cs.left = '8px';
    cs.color = 'white';
    cs.fontSize = '14px';
    cs.fontFamily = 'monospace';
    cs.textShadow = '1px 1px 2px black';
    cs.display = 'none';
    cs.pointerEvents = 'none';
    this.container.appendChild(this.coordsElement);

    // Hotbar
    this.createHotbar();

    // Key bindings
    document.addEventListener('keydown', (e) => {
      // Number keys 1-9
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        this.selectSlot(num - 1);
      }
      // F3 for debug
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugVisible = !this.debugVisible;
        this.fpsElement.style.display = this.debugVisible ? 'block' : 'none';
        this.coordsElement.style.display = this.debugVisible ? 'block' : 'none';
      }
    });

    // Mouse wheel for hotbar
    document.addEventListener('wheel', (e) => {
      const dir = e.deltaY > 0 ? 1 : -1;
      let idx = this.selectedIndex + dir;
      if (idx < 0) idx = 8;
      if (idx > 8) idx = 0;
      this.selectSlot(idx);
    });

    this.lastFpsTime = performance.now();
  }

  private createHotbar(): void {
    const bar = document.createElement('div');
    const bs = bar.style;
    bs.position = 'absolute';
    bs.bottom = '12px';
    bs.left = '50%';
    bs.transform = 'translateX(-50%)';
    bs.display = 'flex';
    bs.gap = '2px';
    bs.pointerEvents = 'auto';

    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      const ss = slot.style;
      ss.width = '48px';
      ss.height = '48px';
      ss.border = i === 0 ? '2px solid white' : '2px solid rgba(50,50,50,0.8)';
      ss.backgroundColor = 'rgba(0,0,0,0.5)';
      ss.display = 'flex';
      ss.flexDirection = 'column';
      ss.alignItems = 'center';
      ss.justifyContent = 'center';
      ss.cursor = 'pointer';
      ss.borderRadius = '4px';
      ss.position = 'relative';

      const blockType = HOTBAR_BLOCKS[i];
      const props = BLOCK_PROPERTIES[blockType];

      // Color preview
      const preview = document.createElement('div');
      const ps = preview.style;
      ps.width = '28px';
      ps.height = '28px';
      ps.borderRadius = '2px';
      const [r, g, b] = props.color;
      ps.backgroundColor = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
      slot.appendChild(preview);

      // Name label
      const label = document.createElement('div');
      const ls = label.style;
      ls.fontSize = '7px';
      ls.color = 'white';
      ls.marginTop = '1px';
      ls.textAlign = 'center';
      ls.lineHeight = '1';
      ls.textShadow = '1px 1px 1px black';
      label.textContent = props.name;
      slot.appendChild(label);

      slot.addEventListener('click', () => this.selectSlot(i));
      bar.appendChild(slot);
      this.hotbarSlots.push(slot);
    }

    this.container.appendChild(bar);
  }

  private selectSlot(index: number): void {
    this.hotbarSlots[this.selectedIndex].style.border = '2px solid rgba(50,50,50,0.8)';
    this.selectedIndex = index;
    this.hotbarSlots[index].style.border = '2px solid white';
    this.onBlockSelected(HOTBAR_BLOCKS[index]);
  }

  updateFps(): void {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      const fps = Math.round((this.frameCount / (now - this.lastFpsTime)) * 1000);
      this.fpsElement.textContent = `${fps} FPS`;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  updateCoords(x: number, y: number, z: number): void {
    if (this.debugVisible) {
      this.coordsElement.textContent = `X: ${x.toFixed(1)} Y: ${y.toFixed(1)} Z: ${z.toFixed(1)}`;
    }
  }

  showRoomCode(code: string): void {
    this.roomCodeElement.textContent = `Room: ${code}`;
    this.roomCodeElement.style.display = 'block';
  }

  show(): void {
    this.container.style.display = 'flex';
    this.crosshair.show();
  }

  hide(): void {
    this.container.style.display = 'none';
    this.crosshair.hide();
  }
}
