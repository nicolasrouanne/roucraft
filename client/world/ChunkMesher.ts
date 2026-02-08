import { BlockType, BLOCK_PROPERTIES } from '../../shared/BlockTypes';
import { CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '../../shared/ChunkConstants';

export interface ChunkNeighbors {
  px?: Uint8Array; // +x
  nx?: Uint8Array; // -x
  py?: Uint8Array; // +y
  ny?: Uint8Array; // -y
  pz?: Uint8Array; // +z
  nz?: Uint8Array; // -z
}

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

// Face definitions: [dx, dy, dz, normal, vertices (4 corners)]
// Each vertex: [x, y, z]
const FACES = [
  { // +X
    dir: [1, 0, 0],
    normal: [1, 0, 0],
    vertices: [
      [1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0],
    ],
  },
  { // -X
    dir: [-1, 0, 0],
    normal: [-1, 0, 0],
    vertices: [
      [0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1],
    ],
  },
  { // +Y
    dir: [0, 1, 0],
    normal: [0, 1, 0],
    vertices: [
      [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1],
    ],
  },
  { // -Y
    dir: [0, -1, 0],
    normal: [0, -1, 0],
    vertices: [
      [0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0],
    ],
  },
  { // +Z
    dir: [0, 0, 1],
    normal: [0, 0, 1],
    vertices: [
      [1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1],
    ],
  },
  { // -Z
    dir: [0, 0, -1],
    normal: [0, 0, -1],
    vertices: [
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    ],
  },
];

function getBlock(
  data: Uint8Array,
  neighbors: ChunkNeighbors,
  x: number,
  y: number,
  z: number,
): BlockType {
  if (x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && z >= 0 && z < CHUNK_SIZE) {
    return data[blockIndex(x, y, z)];
  }
  // Check neighbor chunks
  if (x >= CHUNK_SIZE && neighbors.px) {
    return neighbors.px[blockIndex(x - CHUNK_SIZE, y, z)];
  }
  if (x < 0 && neighbors.nx) {
    return neighbors.nx[blockIndex(x + CHUNK_SIZE, y, z)];
  }
  if (y >= CHUNK_HEIGHT && neighbors.py) {
    return neighbors.py[blockIndex(x, y - CHUNK_HEIGHT, z)];
  }
  if (y < 0 && neighbors.ny) {
    return neighbors.ny[blockIndex(x, y + CHUNK_HEIGHT, z)];
  }
  if (z >= CHUNK_SIZE && neighbors.pz) {
    return neighbors.pz[blockIndex(x, y, z - CHUNK_SIZE)];
  }
  if (z < 0 && neighbors.nz) {
    return neighbors.nz[blockIndex(x, y, z + CHUNK_SIZE)];
  }
  // No neighbor data available, treat as air
  return BlockType.Air;
}

function getBlockColor(blockType: BlockType, faceIndex: number): [number, number, number] {
  const props = BLOCK_PROPERTIES[blockType];
  // faceIndex 2 = +Y (top), faceIndex 3 = -Y (bottom)
  if (faceIndex === 2 && props.colorTop) return props.colorTop;
  if (faceIndex === 3 && props.colorBottom) return props.colorBottom;
  return props.color;
}

export function meshChunk(
  chunkData: Uint8Array,
  neighbors: ChunkNeighbors,
): MeshData | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const blockType = chunkData[blockIndex(x, y, z)] as BlockType;
        if (blockType === BlockType.Air) continue;

        const blockProps = BLOCK_PROPERTIES[blockType];

        for (let faceIdx = 0; faceIdx < FACES.length; faceIdx++) {
          const face = FACES[faceIdx];
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];

          const neighborType = getBlock(chunkData, neighbors, nx, ny, nz);
          const neighborProps = BLOCK_PROPERTIES[neighborType];

          // Show face if neighbor is air or transparent (and not the same type)
          if (neighborType === BlockType.Air ||
              (neighborProps.transparent && neighborType !== blockType)) {
            // Skip drawing water faces against other water
            if (blockProps.transparent && neighborType === blockType) continue;

            const color = getBlockColor(blockType, faceIdx);

            for (const vert of face.vertices) {
              positions.push(x + vert[0], y + vert[1], z + vert[2]);
              normals.push(face.normal[0], face.normal[1], face.normal[2]);
              colors.push(color[0], color[1], color[2]);
            }

            // Two triangles per face: 0-1-2, 0-2-3
            indices.push(
              vertexCount, vertexCount + 1, vertexCount + 2,
              vertexCount, vertexCount + 2, vertexCount + 3,
            );
            vertexCount += 4;
          }
        }
      }
    }
  }

  if (vertexCount === 0) return null;

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  };
}
