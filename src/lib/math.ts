import { Vector3 } from '../types';

export const add = (a: Vector3, b: Vector3): Vector3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vector3, b: Vector3): Vector3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vector3, s: number): Vector3 => [a[0] * s, a[1] * s, a[2] * s];
export const cross = (a: Vector3, b: Vector3): Vector3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const dot = (a: Vector3, b: Vector3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const normalize = (a: Vector3): Vector3 => {
  const len = Math.sqrt(dot(a, a));
  return len === 0 ? [0, 0, 0] : [a[0] / len, a[1] / len, a[2] / len];
};
export const len = (a: Vector3): number => Math.sqrt(dot(a, a));

// Ray-Sphere Intersection for CPU side logic (cursor picking)
export const intersectSphere = (
  ro: Vector3,
  rd: Vector3,
  center: Vector3,
  radius: number
): number | null => {
  const oc = sub(ro, center);
  const b = dot(oc, rd);
  const c = dot(oc, oc) - radius * radius;
  const h = b * b - c;
  if (h < 0.0) return null;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -b + Math.sqrt(h) > 0 ? -b + Math.sqrt(h) : null;
};

// 3D DDA Algorithm for CPU side Voxel picking
export const intersectVoxels = (
  ro: Vector3,
  rd: Vector3,
  grid: Uint8Array,
  gridSize: number
): { pos: Vector3; normal: Vector3; voxelId: number; t: number } | null => {
  
  let x = Math.floor(ro[0]);
  let y = Math.floor(ro[1]);
  let z = Math.floor(ro[2]);

  const stepX = rd[0] > 0 ? 1 : -1;
  const stepY = rd[1] > 0 ? 1 : -1;
  const stepZ = rd[2] > 0 ? 1 : -1;

  const deltaDistX = Math.abs(1 / rd[0]);
  const deltaDistY = Math.abs(1 / rd[1]);
  const deltaDistZ = Math.abs(1 / rd[2]);

  // Calculate initial sideDist
  let sideDistX = (rd[0] > 0 ? x + 1 - ro[0] : ro[0] - x) * deltaDistX;
  let sideDistY = (rd[1] > 0 ? y + 1 - ro[1] : ro[1] - y) * deltaDistY;
  let sideDistZ = (rd[2] > 0 ? z + 1 - ro[2] : ro[2] - z) * deltaDistZ;

  let normal: Vector3 = [0, 0, 0];
  let dist = 0;
  const maxSteps = gridSize * 2; // Limit ray distance

  for (let i = 0; i < maxSteps; i++) {
    // Check bounds
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize || z < 0 || z >= gridSize) {
       // If we exit bounds, we stop.
       // But we continue if we are outside trying to get inside?
       // For simplicity, just break if we are far out.
       if (dist > gridSize * 1.5) break;
    } else {
       const idx = x + y * gridSize + z * gridSize * gridSize;
       const voxel = grid[idx];
       if (voxel > 0) {
         return { pos: [x, y, z], normal, voxelId: voxel, t: dist };
       }
    }

    if (sideDistX < sideDistY) {
      if (sideDistX < sideDistZ) {
        dist = sideDistX;
        sideDistX += deltaDistX;
        x += stepX;
        normal = [-stepX, 0, 0];
      } else {
        dist = sideDistZ;
        sideDistZ += deltaDistZ;
        z += stepZ;
        normal = [0, 0, -stepZ];
      }
    } else {
      if (sideDistY < sideDistZ) {
        dist = sideDistY;
        sideDistY += deltaDistY;
        y += stepY;
        normal = [0, -stepY, 0];
      } else {
        dist = sideDistZ;
        sideDistZ += deltaDistZ;
        z += stepZ;
        normal = [0, 0, -stepZ];
      }
    }
  }
  return null;
};
