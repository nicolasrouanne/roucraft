export enum BlockType {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Water = 5,
  Wood = 6,
  Leaves = 7,
  Cobblestone = 8,
  Planks = 9,
  Glass = 10,
  Brick = 11,
  Coal = 12,
  Iron = 13,
  Gold = 14,
  Flower = 15,
}

export interface BlockProperties {
  name: string;
  color: [number, number, number]; // RGB 0-1
  transparent: boolean;
  solid: boolean;
  colorTop?: [number, number, number];
  colorBottom?: [number, number, number];
}

export const BLOCK_PROPERTIES: Record<BlockType, BlockProperties> = {
  [BlockType.Air]: { name: 'Air', color: [0, 0, 0], transparent: true, solid: false },
  [BlockType.Grass]: { name: 'Grass', color: [0.36, 0.7, 0.2], transparent: false, solid: true, colorTop: [0.36, 0.7, 0.2], colorBottom: [0.55, 0.38, 0.2] },
  [BlockType.Dirt]: { name: 'Dirt', color: [0.55, 0.38, 0.2], transparent: false, solid: true },
  [BlockType.Stone]: { name: 'Stone', color: [0.5, 0.5, 0.5], transparent: false, solid: true },
  [BlockType.Sand]: { name: 'Sand', color: [0.86, 0.82, 0.56], transparent: false, solid: true },
  [BlockType.Water]: { name: 'Water', color: [0.2, 0.4, 0.8], transparent: true, solid: false },
  [BlockType.Wood]: { name: 'Wood', color: [0.45, 0.3, 0.15], transparent: false, solid: true },
  [BlockType.Leaves]: { name: 'Leaves', color: [0.2, 0.55, 0.15], transparent: true, solid: true },
  [BlockType.Cobblestone]: { name: 'Cobblestone', color: [0.4, 0.4, 0.4], transparent: false, solid: true },
  [BlockType.Planks]: { name: 'Planks', color: [0.7, 0.55, 0.3], transparent: false, solid: true },
  [BlockType.Glass]: { name: 'Glass', color: [0.8, 0.9, 0.95], transparent: true, solid: true },
  [BlockType.Brick]: { name: 'Brick', color: [0.6, 0.25, 0.2], transparent: false, solid: true },
  [BlockType.Coal]: { name: 'Coal', color: [0.2, 0.2, 0.2], transparent: false, solid: true },
  [BlockType.Iron]: { name: 'Iron', color: [0.7, 0.6, 0.55], transparent: false, solid: true },
  [BlockType.Gold]: { name: 'Gold', color: [0.9, 0.8, 0.2], transparent: false, solid: true },
  [BlockType.Flower]: { name: 'Flower', color: [0.9, 0.2, 0.3], transparent: true, solid: false },
};
