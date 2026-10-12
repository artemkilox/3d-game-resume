import * as THREE from "three";

export const WORLD_SIZE = 260;

export const SPAWN = { x: 0, z: -8 };

type Hill = { x: number; z: number; height: number; sigma: number };

export type Oasis = {
  x: number;
  z: number;
  groundRadius: number;
  depth: number;
  sigma: number;
  waterRadius: number;
  palms: number[];
};

export const HILLS: Hill[] = [
  { x: 0, z: 28, height: 5.2, sigma: 9 },
  { x: -34, z: -14, height: 4.4, sigma: 11 },
  { x: 32, z: -30, height: 6, sigma: 12 },
];

export const OASES: Oasis[] = [
  {
    x: -22,
    z: 14,
    groundRadius: 12,
    depth: 0.55,
    sigma: 6.5,
    waterRadius: 3.4,
    palms: [15, 80, 150, 220, 290],
  },
  {
    x: 24,
    z: 6,
    groundRadius: 11,
    depth: 0.5,
    sigma: 6,
    waterRadius: 3.1,
    palms: [40, 110, 180, 250, 320],
  },
];

export const ROCKS: { x: number; z: number; radius: number; color: string }[] = [
  { x: 4.2, z: 10, radius: 1.15, color: "#8d7058" },
  { x: -3.2, z: 13.5, radius: 0.65, color: "#6f5846" },
  { x: 9, z: 18, radius: 0.8, color: "#a08468" },
  { x: -7, z: 7, radius: 0.9, color: "#7b624c" },
  { x: 14, z: -4, radius: 1.25, color: "#91745c" },
  { x: -12, z: -8, radius: 1.05, color: "#65503e" },
  { x: 1.5, z: 34, radius: 0.7, color: "#9a7d62" },
  { x: -4, z: 31, radius: 1, color: "#7d6450" },
  { x: 18, z: -16, radius: 0.85, color: "#8a6e56" },
  { x: -18, z: 20, radius: 0.55, color: "#a88b70" },
  { x: 6, z: -18, radius: 1.35, color: "#74604c" },
  { x: -1.5, z: 22, radius: 0.5, color: "#8f735b" },
];

function influence(x: number, z: number, originX: number, originZ: number, sigma: number) {
  const dx = x - originX;
  const dz = z - originZ;
  const value = Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
  return value < 1e-4 ? 0 : value;
}

export function heightAt(x: number, z: number) {
  let height = 0;
  for (const hill of HILLS) {
    height += hill.height * influence(x, z, hill.x, hill.z, hill.sigma);
  }
  for (const oasis of OASES) {
    height -= oasis.depth * influence(x, z, oasis.x, oasis.z, oasis.sigma);
  }
  return height;
}

export function palmPositions(oasis: Oasis): [number, number, number][] {
  const distance = oasis.waterRadius + 2.4;
  return oasis.palms.map((degrees) => {
    const angle = (degrees * Math.PI) / 180;
    const x = oasis.x + Math.cos(angle) * distance;
    const z = oasis.z + Math.sin(angle) * distance;
    return [x, heightAt(x, z), z];
  });
}

export function createDesertGeometry() {
  const segments = 80;
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const plain = new THREE.Color("#e3923a");
  const crest = new THREE.Color("#f6c84a");
  const slopeShade = new THREE.Color("#c86a22");
  const oasis = new THREE.Color("#2f8f3a");
  const color = new THREE.Color();
  const grid = segments + 1;

  for (let i = 0; i < position.count; i += 1) {
    position.setY(i, heightAt(position.getX(i), position.getZ(i)));
  }

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const height = position.getY(i);
    const ix = i % grid;
    const iz = Math.floor(i / grid);
    let slope = 0;
    if (ix > 0 && ix < segments) {
      slope = Math.max(slope, Math.abs(position.getY(i + 1) - position.getY(i - 1)));
    }
    if (iz > 0 && iz < segments) {
      slope = Math.max(slope, Math.abs(position.getY(i + grid) - position.getY(i - grid)));
    }

    const rise = THREE.MathUtils.smoothstep(height, 0.2, 2.4);
    color.copy(plain).lerp(crest, rise);
    color.lerp(slopeShade, THREE.MathUtils.clamp(slope / 0.7, 0, 1) * 0.55);
    for (const spot of OASES) {
      const distance = Math.hypot(x - spot.x, z - spot.z);
      const blend = 1 - THREE.MathUtils.smoothstep(distance, spot.groundRadius * 0.3, spot.groundRadius);
      color.lerp(oasis, blend);
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const normals = geometry.attributes.normal;
  let up = 0;
  for (let i = 0; i < normals.count; i += 1) up += normals.getY(i);
  const index = geometry.getIndex();
  if (up < 0 && index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      index.setX(i, index.getX(i + 1));
      index.setX(i + 1, a);
    }
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingSphere();
  position.needsUpdate = true;
  return geometry;
}

export function geometryToTrimesh(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!index) throw new Error("У сетки пустыни нет индексов");

  const vertices = new Float32Array(position.array);
  const indices = new Uint32Array(index.count);
  for (let i = 0; i < index.count; i += 1) indices[i] = index.getX(i);
  return { vertices, indices };
}
