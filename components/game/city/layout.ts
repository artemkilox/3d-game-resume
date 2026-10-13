export const TILE = 4;
export const ROAD_RISE = 0.14;
export const CAR_WIDTH = 1.2;
export const ROAD_WIDTH = 6.4;
export const ROAD_RAMP = 1.25;

export const MAP_CENTER = { x: -30.33, z: -15.9 };
export const MAP_EXTENT = 64;

export const ROAD_POLYLINE: [number, number][] = [
  [13.67, -43.9],
  [-78.33, -43.9],
  [-78.33, 12.1],
  [15.67, 12.1],
];

type Piece = { url: string; position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] };

const STRAIGHT = "/models/roads/road-straight.glb";
const BEND = "/models/roads/road-bend.glb";
const BEND_SCALE: [number, number, number] = [ROAD_WIDTH, ROAD_RISE / 0.02, ROAD_WIDTH];

function range(from: number, to: number, step: number) {
  const values: number[] = [];
  const dir = Math.sign(to - from) || 1;
  for (let value = from; dir > 0 ? value <= to + 0.01 : value >= to - 0.01; value += step * dir) {
    values.push(Math.round(value * 10) / 10);
  }
  return values;
}

const Y_SCALE = ROAD_RISE / 0.02;
const BEND_X = -80;
const BEND_HALF = ROAD_WIDTH / 2;

function span(from: number, to: number) {
  const dir = Math.sign(to - from) || 1;
  const pieces: { center: number; length: number }[] = [];
  let cursor = from;
  while ((to - (cursor + dir * TILE)) * dir >= -0.01) {
    pieces.push({ center: cursor + (dir * TILE) / 2, length: TILE });
    cursor += dir * TILE;
  }
  const remain = Math.abs(to - cursor);
  if (remain > 0.05) pieces.push({ center: (cursor + to) / 2, length: Math.round(remain * 100) / 100 });
  return pieces;
}

function straightX(z: number, from: number, to: number): Piece[] {
  return span(from, to).map((piece) => ({
    url: STRAIGHT,
    position: [piece.center, 0, z] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [piece.length, Y_SCALE, ROAD_WIDTH] as [number, number, number],
  }));
}

function straightZ(x: number, from: number, to: number): Piece[] {
  return span(from, to).map((piece) => ({
    url: STRAIGHT,
    position: [x, 0, piece.center] as [number, number, number],
    rotation: [0, Math.PI / 2, 0] as [number, number, number],
    scale: [piece.length, Y_SCALE, ROAD_WIDTH] as [number, number, number],
  }));
}

export const ROADS: Piece[] = [
  ...straightX(0, 14, BEND_X + BEND_HALF),
  {
    url: BEND,
    position: [BEND_X, 0.01, 0],
    rotation: [0, Math.PI / 2, 0],
    scale: BEND_SCALE,
  },
  ...straightZ(BEND_X, BEND_HALF, 56 - BEND_HALF),
  {
    url: BEND,
    position: [BEND_X, 0.01, 56],
    rotation: [0, Math.PI, 0],
    scale: BEND_SCALE,
  },
  ...straightX(56, BEND_X + BEND_HALF, 14),
];

export const ARROWS: { position: [number, number, number]; yaw: number }[] = [
  ...range(8, -72, 8).map((x) => ({ position: [x, ROAD_RISE + 0.02, 0] as [number, number, number], yaw: Math.PI })),
  ...range(8, 48, 8).map((z) => ({ position: [-80, ROAD_RISE + 0.02, z] as [number, number, number], yaw: -Math.PI / 2 })),
  ...range(-72, 8, 8).map((x) => ({ position: [x, ROAD_RISE + 0.02, 56] as [number, number, number], yaw: 0 })),
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

export const PARKING = { x: -30, z: 17 };

export const CAMERA_ZONES: { x: number; z: number; radius: number; focus: [number, number] }[] = [
  { x: 5.67, z: -43.9, radius: 14, focus: [6.67, -38.9] },
  { x: -28.33, z: -43.9, radius: 18, focus: [-28.33, -26.9] },
  { x: -64.33, z: -43.9, radius: 16, focus: [-64.33, -30.9] },
  { x: -62.33, z: 12.1, radius: 16, focus: [-62.33, 22.1] },
  { x: -34.33, z: 12.1, radius: 15, focus: [-34.33, 22.1] },
  { x: -6.33, z: 12.1, radius: 15, focus: [-6.33, 22.1] },
  { x: 13.67, z: 12.1, radius: 14, focus: [19.67, 18.1] },
];

export const SKILL_ISLANDS = [
  "React",
  "TypeScript",
  "Next.js",
  "JavaScript",
  "Redux Toolkit",
  "React Router",
  "CSS-modules",
  "SCSS",
  "Tailwind",
  "Styled Components",
  "Vite",
  "Webpack",
  "Node.js",
  "Express",
  "REST",
  "PostgreSQL",
  "WebSocket",
  "Jest",
  "Testing Library",
  "Git",
  "GitHub Actions",
  "Figma",
];
