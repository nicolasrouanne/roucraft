const STORAGE_KEY = 'roucraft-settings';

export interface GameSettings {
  renderDistance: number; // 2-12 chunks
  fov: number;           // 60-110
  mouseSensitivity: number; // 0.1-2.0 multiplier
  volume: number;        // 0-1
}

const DEFAULTS: GameSettings = {
  renderDistance: 4,
  fov: 75,
  mouseSensitivity: 1.0,
  volume: 0.5,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        renderDistance: clamp(parsed.renderDistance ?? DEFAULTS.renderDistance, 2, 12),
        fov: clamp(parsed.fov ?? DEFAULTS.fov, 60, 110),
        mouseSensitivity: clamp(parsed.mouseSensitivity ?? DEFAULTS.mouseSensitivity, 0.1, 2.0),
        volume: clamp(parsed.volume ?? DEFAULTS.volume, 0, 1),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function getDefaults(): GameSettings {
  return { ...DEFAULTS };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
