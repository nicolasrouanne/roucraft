// Web Worker for chunk meshing - runs greedy meshing off the main thread
// This file is loaded as a module worker via Vite's worker support

import { BlockType, BLOCK_PROPERTIES } from '../../shared/BlockTypes';
import { CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '../../shared/ChunkConstants';

interface ChunkNeighbors {
  px?: Uint8Array;
  nx?: Uint8Array;
  py?: Uint8Array;
  ny?: Uint8Array;
  pz?: Uint8Array;
  nz?: Uint8Array;
}

const AO_CURVE = [0.4, 0.6, 0.8, 1.0];

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
  if (x >= CHUNK_SIZE && neighbors.px) return neighbors.px[blockIndex(x - CHUNK_SIZE, y, z)];
  if (x < 0 && neighbors.nx) return neighbors.nx[blockIndex(x + CHUNK_SIZE, y, z)];
  if (y >= CHUNK_HEIGHT && neighbors.py) return neighbors.py[blockIndex(x, y - CHUNK_HEIGHT, z)];
  if (y < 0 && neighbors.ny) return neighbors.ny[blockIndex(x, y + CHUNK_HEIGHT, z)];
  if (z >= CHUNK_SIZE && neighbors.pz) return neighbors.pz[blockIndex(x, y, z - CHUNK_SIZE)];
  if (z < 0 && neighbors.nz) return neighbors.nz[blockIndex(x, y, z + CHUNK_SIZE)];
  return BlockType.Air;
}

function isSolid(blockType: BlockType): boolean {
  return BLOCK_PROPERTIES[blockType]?.solid ?? false;
}

function getBlockColor(blockType: BlockType, faceIndex: number): [number, number, number] {
  const props = BLOCK_PROPERTIES[blockType];
  if (faceIndex === 2 && props.colorTop) return props.colorTop;
  if (faceIndex === 3 && props.colorBottom) return props.colorBottom;
  return props.color;
}

function vertexAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0;
  return 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0));
}

interface FaceDef {
  d: number;
  u: number;
  v: number;
  sign: number;
  faceIdx: number;
  normal: [number, number, number];
}

const FACE_DEFS: FaceDef[] = [
  { d: 0, u: 2, v: 1, sign: 1, faceIdx: 0, normal: [1, 0, 0] },
  { d: 0, u: 2, v: 1, sign: -1, faceIdx: 1, normal: [-1, 0, 0] },
  { d: 1, u: 0, v: 2, sign: 1, faceIdx: 2, normal: [0, 1, 0] },
  { d: 1, u: 0, v: 2, sign: -1, faceIdx: 3, normal: [0, -1, 0] },
  { d: 2, u: 0, v: 1, sign: 1, faceIdx: 4, normal: [0, 0, 1] },
  { d: 2, u: 0, v: 1, sign: -1, faceIdx: 5, normal: [0, 0, -1] },
];

const AXIS_SIZE = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE];

function shouldShowFace(blockType: BlockType, neighborType: BlockType): boolean {
  if (neighborType === BlockType.Air) return true;
  const neighborProps = BLOCK_PROPERTIES[neighborType];
  if (neighborProps.transparent && neighborType !== blockType) return true;
  return false;
}

function meshChunkData(
  chunkData: Uint8Array,
  neighbors: ChunkNeighbors,
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  const waterPositions: number[] = [];
  const waterNormals: number[] = [];
  const waterColors: number[] = [];
  const waterIndices: number[] = [];
  let waterVertexCount = 0;

  for (const face of FACE_DEFS) {
    const dSize = AXIS_SIZE[face.d];
    const uSize = AXIS_SIZE[face.u];
    const vSize = AXIS_SIZE[face.v];
    const mask = new Int32Array(uSize * vSize);

    for (let d = 0; d < dSize; d++) {
      for (let v = 0; v < vSize; v++) {
        for (let u = 0; u < uSize; u++) {
          const pos = [0, 0, 0];
          pos[face.d] = d;
          pos[face.u] = u;
          pos[face.v] = v;

          const blockType = chunkData[blockIndex(pos[0], pos[1], pos[2])] as BlockType;
          if (blockType === BlockType.Air) {
            mask[u + v * uSize] = 0;
            continue;
          }

          const nPos = [pos[0], pos[1], pos[2]];
          nPos[face.d] += face.sign;
          const neighborType = getBlock(chunkData, neighbors, nPos[0], nPos[1], nPos[2]);

          mask[u + v * uSize] = shouldShowFace(blockType, neighborType) ? blockType : 0;
        }
      }

      const visited = new Uint8Array(uSize * vSize);

      for (let v = 0; v < vSize; v++) {
        for (let u = 0; u < uSize; u++) {
          const idx = u + v * uSize;
          if (visited[idx] || mask[idx] === 0) continue;

          const blockType = mask[idx] as BlockType;
          const isWater = blockType === BlockType.Water;

          let w = 1;
          while (u + w < uSize && mask[(u + w) + v * uSize] === blockType && !visited[(u + w) + v * uSize]) {
            w++;
          }

          let h = 1;
          let done = false;
          while (v + h < vSize && !done) {
            for (let k = 0; k < w; k++) {
              if (mask[(u + k) + (v + h) * uSize] !== blockType || visited[(u + k) + (v + h) * uSize]) {
                done = true;
                break;
              }
            }
            if (!done) h++;
          }

          for (let dv = 0; dv < h; dv++) {
            for (let du = 0; du < w; du++) {
              visited[(u + du) + (v + dv) * uSize] = 1;
            }
          }

          const basePos = [0, 0, 0];
          basePos[face.d] = d + (face.sign > 0 ? 1 : 0);
          basePos[face.u] = u;
          basePos[face.v] = v;

          const uDir = [0, 0, 0];
          const vDir = [0, 0, 0];
          uDir[face.u] = 1;
          vDir[face.v] = 1;

          const v0 = [basePos[0], basePos[1], basePos[2]];
          const v1 = [basePos[0] + w * uDir[0], basePos[1] + w * uDir[1], basePos[2] + w * uDir[2]];
          const v2 = [basePos[0] + w * uDir[0] + h * vDir[0], basePos[1] + w * uDir[1] + h * vDir[1], basePos[2] + w * uDir[2] + h * vDir[2]];
          const v3 = [basePos[0] + h * vDir[0], basePos[1] + h * vDir[1], basePos[2] + h * vDir[2]];

          const ao = [0, 0, 0, 0];
          const cornerUV = [[u, v], [u + w, v], [u + w, v + h], [u, v + h]];
          const cornerOffsets = [[-1, -1], [0, -1], [0, 0], [-1, 0]];

          for (let c = 0; c < 4; c++) {
            const cu = cornerUV[c][0];
            const cv = cornerUV[c][1];
            const ou = cornerOffsets[c][0];
            const ov = cornerOffsets[c][1];

            const s1Pos = [0, 0, 0];
            s1Pos[face.d] = d + (face.sign > 0 ? 0 : -1) + face.sign;
            s1Pos[face.u] = cu + ou;
            s1Pos[face.v] = cv;
            const s1 = isSolid(getBlock(chunkData, neighbors, s1Pos[0], s1Pos[1], s1Pos[2]));

            const s2Pos = [0, 0, 0];
            s2Pos[face.d] = d + (face.sign > 0 ? 0 : -1) + face.sign;
            s2Pos[face.u] = cu;
            s2Pos[face.v] = cv + ov;
            const s2 = isSolid(getBlock(chunkData, neighbors, s2Pos[0], s2Pos[1], s2Pos[2]));

            const cPos = [0, 0, 0];
            cPos[face.d] = d + (face.sign > 0 ? 0 : -1) + face.sign;
            cPos[face.u] = cu + ou;
            cPos[face.v] = cv + ov;
            const cr = isSolid(getBlock(chunkData, neighbors, cPos[0], cPos[1], cPos[2]));

            ao[c] = vertexAO(s1, s2, cr);
          }

          const color = getBlockColor(blockType, face.faceIdx);

          if (isWater) {
            const yOffset = face.faceIdx === 2 ? -0.1 : 0;
            for (let i = 0; i < 4; i++) {
              const vert = [v0, v1, v2, v3][i];
              waterPositions.push(vert[0], vert[1] + yOffset, vert[2]);
              waterNormals.push(face.normal[0], face.normal[1], face.normal[2]);
              const aoFactor = AO_CURVE[ao[i]];
              waterColors.push(color[0] * aoFactor, color[1] * aoFactor, color[2] * aoFactor);
            }
            if (ao[0] + ao[2] > ao[1] + ao[3]) {
              waterIndices.push(waterVertexCount + 1, waterVertexCount + 2, waterVertexCount + 3, waterVertexCount + 1, waterVertexCount + 3, waterVertexCount);
            } else {
              waterIndices.push(waterVertexCount, waterVertexCount + 1, waterVertexCount + 2, waterVertexCount, waterVertexCount + 2, waterVertexCount + 3);
            }
            waterVertexCount += 4;
          } else {
            for (let i = 0; i < 4; i++) {
              const vert = [v0, v1, v2, v3][i];
              positions.push(vert[0], vert[1], vert[2]);
              normals.push(face.normal[0], face.normal[1], face.normal[2]);
              const aoFactor = AO_CURVE[ao[i]];
              colors.push(color[0] * aoFactor, color[1] * aoFactor, color[2] * aoFactor);
            }
            if (ao[0] + ao[2] > ao[1] + ao[3]) {
              indices.push(vertexCount + 1, vertexCount + 2, vertexCount + 3, vertexCount + 1, vertexCount + 3, vertexCount);
            } else {
              indices.push(vertexCount, vertexCount + 1, vertexCount + 2, vertexCount, vertexCount + 2, vertexCount + 3);
            }
            vertexCount += 4;
          }
        }
      }
    }
  }

  if (vertexCount === 0 && waterVertexCount === 0) return null;

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    waterPositions: new Float32Array(waterPositions),
    waterNormals: new Float32Array(waterNormals),
    waterColors: new Float32Array(waterColors),
    waterIndices: new Uint32Array(waterIndices),
  };
}

// Worker message handler
self.onmessage = (e: MessageEvent) => {
  const { id, chunkData, neighbors, cx, cy, cz } = e.data;

  const data = new Uint8Array(chunkData);
  const neighborArrays: ChunkNeighbors = {};
  if (neighbors.px) neighborArrays.px = new Uint8Array(neighbors.px);
  if (neighbors.nx) neighborArrays.nx = new Uint8Array(neighbors.nx);
  if (neighbors.py) neighborArrays.py = new Uint8Array(neighbors.py);
  if (neighbors.ny) neighborArrays.ny = new Uint8Array(neighbors.ny);
  if (neighbors.pz) neighborArrays.pz = new Uint8Array(neighbors.pz);
  if (neighbors.nz) neighborArrays.nz = new Uint8Array(neighbors.nz);

  const result = meshChunkData(data, neighborArrays);

  if (!result) {
    (self as unknown as Worker).postMessage({ id, result: null });
    return;
  }

  // Transfer buffers for zero-copy performance
  const transferable = [
    result.positions.buffer,
    result.normals.buffer,
    result.colors.buffer,
    result.indices.buffer,
    result.waterPositions.buffer,
    result.waterNormals.buffer,
    result.waterColors.buffer,
    result.waterIndices.buffer,
  ];

  (self as unknown as Worker).postMessage({ id, result }, transferable);
};
