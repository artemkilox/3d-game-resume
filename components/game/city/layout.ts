export const TILE = 4;

export const MAP_CENTER = { x: -32, z: 28 };
export const MAP_EXTENT = 64;

export const ROAD_POLYLINE: [number, number][] = [
  [12, 0],
  [-80, 0],
  [-80, 56],
  [14, 56],
];

type Piece = { url: string; position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] };

const STRAIGHT = "/models/roads/road-straight.glb";
const BEND = "/models/roads/road-bend.glb";

function range(from: number, to: number, step: number) {
  const values: number[] = [];
  const dir = Math.sign(to - from) || 1;
  for (let value = from; dir > 0 ? value <= to + 0.01 : value >= to - 0.01; value += step * dir) {
    values.push(Math.round(value * 10) / 10);
  }
  return values;
}

export const ROADS: Piece[] = [
  ...range(12, -76, 4).map((x) => ({
    url: STRAIGHT,
    position: [x, 0.004, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [TILE, 1, TILE] as [number, number, number],
  })),
  {
    url: BEND,
    position: [-80, 0.004, 0],
    rotation: [0, Math.PI / 2, 0],
    scale: [TILE, 1, TILE],
  },
  ...range(4, 52, 4).map((z) => ({
    url: STRAIGHT,
    position: [-80, 0.004, z] as [number, number, number],
    rotation: [0, Math.PI / 2, 0] as [number, number, number],
    scale: [TILE, 1, TILE] as [number, number, number],
  })),
  {
    url: BEND,
    position: [-80, 0.004, 56],
    rotation: [0, Math.PI, 0],
    scale: [TILE, 1, TILE],
  },
  ...range(-76, 12, 4).map((x) => ({
    url: STRAIGHT,
    position: [x, 0.004, 56] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [TILE, 1, TILE] as [number, number, number],
  })),
];

export const ARROWS: { position: [number, number, number]; yaw: number }[] = [
  ...range(8, -72, 8).map((x) => ({ position: [x, 0.03, 0] as [number, number, number], yaw: Math.PI })),
  ...range(8, 48, 8).map((z) => ({ position: [-80, 0.03, z] as [number, number, number], yaw: -Math.PI / 2 })),
  ...range(-72, 8, 8).map((x) => ({ position: [x, 0.03, 56] as [number, number, number], yaw: 0 })),
];

type Tree = { url: string; position: [number, number, number]; scale: number };

function treesAlong(
  axis: "x" | "z",
  fixed: number,
  from: number,
  to: number,
  scale: number,
): Tree[] {
  const url = scale > 3 ? "/models/suburban/tree-large.glb" : "/models/suburban/tree-small.glb";
  return range(from, to, 8).map((value) => ({
    url,
    position: axis === "x" ? [value, 0, fixed] : [fixed, 0, value],
    scale,
  }));
}

export const TREES: Tree[] = [
  ...treesAlong("x", -6, 0, -72, 3.2),
  ...treesAlong("x", 6, 8, -4, 2.2),
  ...treesAlong("x", 6, -56, -72, 3.2),
  ...treesAlong("z", -88, 8, 48, 3.2),
  ...treesAlong("z", -72, 28, 48, 2.2),
  ...treesAlong("x", 50, -72, 8, 3.2),
];

export const BUILDINGS: {
  url: string;
  position: [number, number, number];
  scale: number;
  half: [number, number, number];
}[] = [
  {
    url: "/models/commercial/building-k.glb",
    position: [-66, 0, 18],
    scale: 2,
    half: [1.042 * 2, 1.47, 0.471 * 2],
  },
  {
    url: "/models/commercial/building-skyscraper-a.glb",
    position: [-70, 0, 70],
    scale: 1.7,
    half: [0.68 * 1.7, 1.44 * 1.7, 0.68 * 1.7],
  },
  {
    url: "/models/commercial/building-skyscraper-b.glb",
    position: [-58, 0, 70],
    scale: 1.7,
    half: [0.68 * 1.7, 1.5 * 1.7, 0.68 * 1.7],
  },
  {
    url: "/models/commercial/building-skyscraper-b.glb",
    position: [-42, 0, 70],
    scale: 1.7,
    half: [0.68 * 1.7, 1.5 * 1.7, 0.68 * 1.7],
  },
  {
    url: "/models/commercial/building-skyscraper-c.glb",
    position: [-30, 0, 70],
    scale: 1.7,
    half: [0.68 * 1.7, 1.6 * 1.7, 0.68 * 1.7],
  },
  {
    url: "/models/commercial/building-skyscraper-d.glb",
    position: [-14, 0, 70],
    scale: 1.7,
    half: [0.66 * 1.7, 1.8 * 1.7, 0.66 * 1.7],
  },
  {
    url: "/models/commercial/building-skyscraper-e.glb",
    position: [-2, 0, 70],
    scale: 1.7,
    half: [0.65 * 1.7, 2.04 * 1.7, 0.62 * 1.7],
  },
];

export const PARKING = { x: -30, z: 14 };

export const CAMERA_ZONES: { x: number; z: number; radius: number; focus: [number, number] }[] = [
  { x: 4, z: 0, radius: 14, focus: [5, 5] },
  { x: -30, z: 0, radius: 18, focus: [-30, 14] },
  { x: -66, z: 0, radius: 16, focus: [-66, 13] },
  { x: -64, z: 56, radius: 16, focus: [-64, 66] },
  { x: -36, z: 56, radius: 15, focus: [-36, 66] },
  { x: -8, z: 56, radius: 15, focus: [-8, 66] },
  { x: 12, z: 56, radius: 14, focus: [18, 62] },
];

export const SKILL_ISLANDS = [
  "React",
  "TypeScript",
  "Next.js",
  "Redux Toolkit",
  "Node.js",
  "PostgreSQL",
  "WebSocket",
  "GitHub Actions",
];
