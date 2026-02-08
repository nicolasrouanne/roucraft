export class Crosshair {
  private element: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    const s = this.element.style;
    s.position = 'absolute';
    s.top = '50%';
    s.left = '50%';
    s.transform = 'translate(-50%, -50%)';
    s.width = '20px';
    s.height = '20px';
    s.opacity = '0.7';
    s.pointerEvents = 'none';

    // Horizontal bar
    const hBar = document.createElement('div');
    const hs = hBar.style;
    hs.position = 'absolute';
    hs.top = '50%';
    hs.left = '0';
    hs.width = '100%';
    hs.height = '2px';
    hs.marginTop = '-1px';
    hs.backgroundColor = 'white';
    this.element.appendChild(hBar);

    // Vertical bar
    const vBar = document.createElement('div');
    const vs = vBar.style;
    vs.position = 'absolute';
    vs.left = '50%';
    vs.top = '0';
    vs.height = '100%';
    vs.width = '2px';
    vs.marginLeft = '-1px';
    vs.backgroundColor = 'white';
    this.element.appendChild(vBar);

    parent.appendChild(this.element);
  }

  show(): void {
    this.element.style.display = 'block';
  }

  hide(): void {
    this.element.style.display = 'none';
  }
}
