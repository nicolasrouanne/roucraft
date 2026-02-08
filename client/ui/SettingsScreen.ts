import { type GameSettings, loadSettings, saveSettings, getDefaults } from '../engine/Settings';

export class SettingsScreen {
  private overlay: HTMLDivElement;
  private settings: GameSettings;
  private isVisible = false;
  private onChange: ((settings: GameSettings) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.settings = loadSettings();

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.75);
      z-index: 90;
    `;

    this.render();
    parent.appendChild(this.overlay);

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.isVisible) {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      }
    });
  }

  setOnChange(callback: (settings: GameSettings) => void): void {
    this.onChange = callback;
  }

  getSettings(): GameSettings {
    return { ...this.settings };
  }

  show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.overlay.style.display = 'flex';
    this.updateSliderValues();
  }

  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.overlay.style.display = 'none';
  }

  toggle(): void {
    if (this.isVisible) this.hide();
    else this.show();
  }

  get visible(): boolean {
    return this.isVisible;
  }

  private render(): void {
    this.overlay.innerHTML = `
      <div style="
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 32px;
        width: 420px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      ">
        <h2 style="
          color: #fff;
          margin: 0 0 24px 0;
          font-size: 22px;
          font-weight: 600;
          text-align: center;
          font-family: 'Segoe UI', sans-serif;
        ">Settings</h2>

        ${this.sliderRow('render-distance', 'Render Distance', 2, 12, 1, this.settings.renderDistance, ' chunks')}
        ${this.sliderRow('fov', 'Field of View', 60, 110, 5, this.settings.fov, '')}
        ${this.sliderRow('mouse-sens', 'Mouse Sensitivity', 0.1, 2.0, 0.1, this.settings.mouseSensitivity, 'x')}
        ${this.sliderRow('volume', 'Volume', 0, 100, 5, Math.round(this.settings.volume * 100), '%')}

        <div style="display: flex; gap: 10px; margin-top: 24px;">
          <button id="settings-reset" style="
            flex: 1;
            padding: 10px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            color: #ccc;
            font-size: 14px;
            cursor: pointer;
            font-family: 'Segoe UI', sans-serif;
          ">Reset Defaults</button>
          <button id="settings-close" style="
            flex: 1;
            padding: 10px;
            background: #4a7cff;
            border: none;
            border-radius: 6px;
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            font-family: 'Segoe UI', sans-serif;
          ">Done</button>
        </div>
      </div>
    `;

    // Wire up sliders
    this.wireSlider('render-distance', (v) => { this.settings.renderDistance = v; });
    this.wireSlider('fov', (v) => { this.settings.fov = v; });
    this.wireSlider('mouse-sens', (v) => { this.settings.mouseSensitivity = v; });
    this.wireSlider('volume', (v) => { this.settings.volume = v / 100; });

    this.overlay.querySelector('#settings-reset')!.addEventListener('click', () => {
      this.settings = getDefaults();
      this.updateSliderValues();
      this.applyAndSave();
    });

    this.overlay.querySelector('#settings-close')!.addEventListener('click', () => {
      this.hide();
    });
  }

  private sliderRow(id: string, label: string, min: number, max: number, step: number, value: number, suffix: string): string {
    return `
      <div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <label style="color: #ccc; font-size: 14px; font-family: 'Segoe UI', sans-serif;">${label}</label>
          <span id="${id}-value" style="color: #fff; font-size: 14px; font-family: monospace;">${this.formatValue(value, step)}${suffix}</span>
        </div>
        <input id="${id}-slider" type="range"
          min="${min}" max="${max}" step="${step}" value="${value}"
          style="
            width: 100%;
            accent-color: #4a7cff;
            cursor: pointer;
          "
        />
      </div>
    `;
  }

  private wireSlider(id: string, setter: (value: number) => void): void {
    const slider = this.overlay.querySelector(`#${id}-slider`) as HTMLInputElement;
    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      setter(val);
      this.applyAndSave();

      // Update displayed value
      const suffix = id === 'render-distance' ? ' chunks' :
                     id === 'volume' ? '%' :
                     id === 'mouse-sens' ? 'x' : '';
      const valueEl = this.overlay.querySelector(`#${id}-value`) as HTMLSpanElement;
      valueEl.textContent = this.formatValue(val, parseFloat(slider.step)) + suffix;
    });
  }

  private updateSliderValues(): void {
    this.setSlider('render-distance', this.settings.renderDistance);
    this.setSlider('fov', this.settings.fov);
    this.setSlider('mouse-sens', this.settings.mouseSensitivity);
    this.setSlider('volume', Math.round(this.settings.volume * 100));
  }

  private setSlider(id: string, value: number): void {
    const slider = this.overlay.querySelector(`#${id}-slider`) as HTMLInputElement | null;
    if (slider) {
      slider.value = String(value);
      slider.dispatchEvent(new Event('input'));
    }
  }

  private formatValue(value: number, step: number): string {
    if (step >= 1) return String(Math.round(value));
    return value.toFixed(1);
  }

  private applyAndSave(): void {
    saveSettings(this.settings);
    this.onChange?.({ ...this.settings });
  }
}
