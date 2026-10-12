import * as THREE from "three";
import { ROAD_RAMP, ROAD_WIDTH } from "./city/layout";

export const WORLD_SIZE = 260;

export const SPAWN = { x: 4, z: 0, yaw: -Math.PI / 2 };

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
  { x: -46, z: -24, height: 1.7, sigma: 9 },
  { x: -108, z: 30, height: 2.1, sigma: 10 },
];

export const OASES: Oasis[] = [];

export const ROCKS: { x: number; z: number; radius: number; color: string }[] = [];

function influence(x: number, z: number, originX: number, originZ: number, sigma: number) {
  const dx = x - originX;
  const dz = z - originZ;
  const value = Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
  return value < 1e-4 ? 0 : value;
}

const ROAD_CLEAR = ROAD_WIDTH / 2 + ROAD_RAMP + 4;

function sandBlocked(x: number, z: number) {
  const west = -80 - ROAD_CLEAR;
  const east = 16;
  if (Math.abs(z) <= ROAD_CLEAR && x <= east && x >= west) return true;
  if (Math.abs(z - 56) <= ROAD_CLEAR && x <= east && x >= west) return true;
  if (Math.abs(x + 80) <= ROAD_CLEAR && z >= -ROAD_CLEAR && z <= 56 + ROAD_CLEAR) return true;
  return false;
}

export function heightAt(x: number, z: number) {
  if (sandBlocked(x, z)) return 0;
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
