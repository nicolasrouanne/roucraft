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
  waterPositions: Float32Array;
  waterNormals: Float32Array;
  waterColors: Float32Array;
  waterIndices: Uint32Array;
}

// AO brightness levels: 0 = fully occluded, 3 = fully lit
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
  return BlockType.Air;
}

function isSolid(blockType: BlockType): boolean {
  return BLOCK_PROPERTIES[blockType]?.solid ?? false;
}

function getBlockColor(blockType: BlockType, faceIndex: number): [number, number, number] {
  const props = BLOCK_PROPERTIES[blockType];
  // faceIndex 2 = +Y (top), 3 = -Y (bottom)
  if (faceIndex === 2 && props.colorTop) return props.colorTop;
  if (faceIndex === 3 && props.colorBottom) return props.colorBottom;
  return props.color;
}

// Compute AO for a vertex based on 3 neighbors (side1, side2, corner)
function vertexAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0;
  return 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0));
}

// Face directions: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
// For each face, define the tangent (u) and bitangent (v) axes, plus the face normal direction.
// We iterate slices along the normal axis, and within each slice, sweep u and v.

interface FaceDef {
  // Axis indices: d=normal axis, u=tangent axis, v=bitangent axis
  d: number; // 0=x, 1=y, 2=z
  u: number;
  v: number;
  // Normal direction along d axis: +1 or -1
  sign: number;
  // Face index for color lookup (matches original: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z)
  faceIdx: number;
  // Normal vector
  normal: [number, number, number];
}

const FACE_DEFS: FaceDef[] = [
  // +X: slice along x, sweep z (u) and y (v)
  { d: 0, u: 2, v: 1, sign: 1, faceIdx: 0, normal: [1, 0, 0] },
  // -X: slice along x, sweep z (u) and y (v)
  { d: 0, u: 2, v: 1, sign: -1, faceIdx: 1, normal: [-1, 0, 0] },
  // +Y: slice along y, sweep x (u) and z (v)
  { d: 1, u: 0, v: 2, sign: 1, faceIdx: 2, normal: [0, 1, 0] },
  // -Y: slice along y, sweep x (u) and z (v)
  { d: 1, u: 0, v: 2, sign: -1, faceIdx: 3, normal: [0, -1, 0] },
  // +Z: slice along z, sweep x (u) and y (v)
  { d: 2, u: 0, v: 1, sign: 1, faceIdx: 4, normal: [0, 0, 1] },
  // -Z: slice along z, sweep x (u) and y (v)
  { d: 2, u: 0, v: 1, sign: -1, faceIdx: 5, normal: [0, 0, -1] },
];

// Sizes for each axis: x=CHUNK_SIZE, y=CHUNK_HEIGHT, z=CHUNK_SIZE
const AXIS_SIZE = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE];

// Check if a face should be visible (neighbor is air/transparent and not the same transparent block)
function shouldShowFace(blockType: BlockType, neighborType: BlockType): boolean {
  if (neighborType === BlockType.Air) return true;
  const neighborProps = BLOCK_PROPERTIES[neighborType];
  if (neighborProps.transparent && neighborType !== blockType) return true;
  return false;
}

export function meshChunk(
  chunkData: Uint8Array,
  neighbors: ChunkNeighbors,
  cx: number,
  cy: number,
  cz: number,
): MeshData | null {
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

  const sizeD = AXIS_SIZE;

  for (const face of FACE_DEFS) {
    const dSize = sizeD[face.d];
    const uSize = sizeD[face.u];
    const vSize = sizeD[face.v];
    const mask = new Int32Array(uSize * vSize); // stores block type (or 0 for no face)

    for (let d = 0; d < dSize; d++) {
      // Build the mask for this slice
      for (let v = 0; v < vSize; v++) {
        for (let u = 0; u < uSize; u++) {
          // Compute block coordinates
          const pos = [0, 0, 0];
          pos[face.d] = d;
          pos[face.u] = u;
          pos[face.v] = v;

          const blockType = chunkData[blockIndex(pos[0], pos[1], pos[2])] as BlockType;

          if (blockType === BlockType.Air) {
            mask[u + v * uSize] = 0;
            continue;
          }

          // Check neighbor in the normal direction
          const nPos = [pos[0], pos[1], pos[2]];
          nPos[face.d] += face.sign;
          const neighborType = getBlock(chunkData, neighbors, nPos[0], nPos[1], nPos[2]);

          if (shouldShowFace(blockType, neighborType)) {
            mask[u + v * uSize] = blockType;
          } else {
            mask[u + v * uSize] = 0;
          }
        }
      }

      // Greedy merge the mask
      const visited = new Uint8Array(uSize * vSize);

      for (let v = 0; v < vSize; v++) {
        for (let u = 0; u < uSize; u++) {
          const idx = u + v * uSize;
          if (visited[idx] || mask[idx] === 0) continue;

          const blockType = mask[idx] as BlockType;
          const isWater = blockType === BlockType.Water;

          // Extend width along u
          let w = 1;
          while (u + w < uSize && mask[(u + w) + v * uSize] === blockType && !visited[(u + w) + v * uSize]) {
            w++;
          }

          // Extend height along v
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

          // Mark as visited
          for (let dv = 0; dv < h; dv++) {
            for (let du = 0; du < w; du++) {
              visited[(u + du) + (v + dv) * uSize] = 1;
            }
          }

          // Emit the quad
          // Corner positions in block space
          const basePos = [0, 0, 0];
          basePos[face.d] = d + (face.sign > 0 ? 1 : 0);
          basePos[face.u] = u;
          basePos[face.v] = v;

          // uDir and vDir are unit vectors along u and v axes
          const uDir = [0, 0, 0];
          const vDir = [0, 0, 0];
          uDir[face.u] = 1;
          vDir[face.v] = 1;

          // 4 corners of the quad:
          // v0 = base
          // v1 = base + w*uDir
          // v2 = base + w*uDir + h*vDir
          // v3 = base + h*vDir
          const v0 = [basePos[0], basePos[1], basePos[2]];
          const v1 = [basePos[0] + w * uDir[0], basePos[1] + w * uDir[1], basePos[2] + w * uDir[2]];
          const v2 = [basePos[0] + w * uDir[0] + h * vDir[0], basePos[1] + w * uDir[1] + h * vDir[1], basePos[2] + w * uDir[2] + h * vDir[2]];
          const v3 = [basePos[0] + h * vDir[0], basePos[1] + h * vDir[1], basePos[2] + h * vDir[2]];

          // Compute AO for each corner vertex
          // We need to check neighbors in a coordinate system relative to the face
          const ao = [0, 0, 0, 0];

          // For AO, check the 3 neighbors at each corner (side1, side2, corner) in the plane perpendicular to the face normal
          // We sample blocks around the face vertex positions in the chunk data
          // For each corner, we look at blocks adjacent to the face at that corner

          // Corner 0: (u, v) = (u, v)
          // Corner 1: (u, v) = (u+w, v)
          // Corner 2: (u, v) = (u+w, v+h)
          // Corner 3: (u, v) = (u, v+h)
          const cornerUV = [
            [u, v],
            [u + w, v],
            [u + w, v + h],
            [u, v + h],
          ];

          // For each corner, the AO neighbors:
          // side1 is block at (corner_u + uOffset, corner_v, d) offset
          // side2 is block at (corner_u, corner_v + vOffset, d) offset
          // corner block at (corner_u + uOffset, corner_v + vOffset, d)
          // The offsets depend on which corner:
          //   corner0 (u,v): u-1, v-1
          //   corner1 (u+w,v): u+0, v-1 (i.e. the block at u+w is to the right)
          //   corner2 (u+w,v+h): u+0, v+0
          //   corner3 (u,v+h): u-1, v+0
          const cornerOffsets = [
            [-1, -1], // corner 0: both sides are at u-1, v-1
            [0, -1],  // corner 1
            [0, 0],   // corner 2
            [-1, 0],  // corner 3
          ];

          for (let c = 0; c < 4; c++) {
            const cu = cornerUV[c][0];
            const cv = cornerUV[c][1];
            const ou = cornerOffsets[c][0];
            const ov = cornerOffsets[c][1];

            // side1: offset along u
            const s1Pos = [0, 0, 0];
            s1Pos[face.d] = d;
            s1Pos[face.u] = cu + ou;
            s1Pos[face.v] = cv;
            const s1 = isSolid(getBlock(chunkData, neighbors, s1Pos[0], s1Pos[1], s1Pos[2]));

            // side2: offset along v
            const s2Pos = [0, 0, 0];
            s2Pos[face.d] = d;
            s2Pos[face.u] = cu;
            s2Pos[face.v] = cv + ov;
            const s2 = isSolid(getBlock(chunkData, neighbors, s2Pos[0], s2Pos[1], s2Pos[2]));

            // corner: offset along both u and v
            const cPos = [0, 0, 0];
            cPos[face.d] = d;
            cPos[face.u] = cu + ou;
            cPos[face.v] = cv + ov;
            const cr = isSolid(getBlock(chunkData, neighbors, cPos[0], cPos[1], cPos[2]));

            ao[c] = vertexAO(s1, s2, cr);
          }

          const color = getBlockColor(blockType, face.faceIdx);

          if (isWater) {
            // Water goes into separate buffers
            const yOffset = face.faceIdx === 2 ? -0.1 : 0; // lower top face slightly

            for (let i = 0; i < 4; i++) {
              const vert = [v0, v1, v2, v3][i];
              waterPositions.push(vert[0], vert[1] + yOffset, vert[2]);
              waterNormals.push(face.normal[0], face.normal[1], face.normal[2]);
              const aoFactor = AO_CURVE[ao[i]];
              waterColors.push(color[0] * aoFactor, color[1] * aoFactor, color[2] * aoFactor);
            }

            // AO-aware quad triangulation: flip diagonal if needed
            if (ao[0] + ao[2] > ao[1] + ao[3]) {
              // Flip: triangles 1-2-3, 1-3-0
              waterIndices.push(
                waterVertexCount + 1, waterVertexCount + 2, waterVertexCount + 3,
                waterVertexCount + 1, waterVertexCount + 3, waterVertexCount,
              );
            } else {
              // Normal: triangles 0-1-2, 0-2-3
              waterIndices.push(
                waterVertexCount, waterVertexCount + 1, waterVertexCount + 2,
                waterVertexCount, waterVertexCount + 2, waterVertexCount + 3,
              );
            }
            waterVertexCount += 4;
          } else {
            // Opaque geometry
            for (let i = 0; i < 4; i++) {
              const vert = [v0, v1, v2, v3][i];
              positions.push(vert[0], vert[1], vert[2]);
              normals.push(face.normal[0], face.normal[1], face.normal[2]);
              const aoFactor = AO_CURVE[ao[i]];
              colors.push(color[0] * aoFactor, color[1] * aoFactor, color[2] * aoFactor);
            }

            // AO-aware quad triangulation: flip diagonal if needed
            if (ao[0] + ao[2] > ao[1] + ao[3]) {
              indices.push(
                vertexCount + 1, vertexCount + 2, vertexCount + 3,
                vertexCount + 1, vertexCount + 3, vertexCount,
              );
            } else {
              indices.push(
                vertexCount, vertexCount + 1, vertexCount + 2,
                vertexCount, vertexCount + 2, vertexCount + 3,
              );
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
