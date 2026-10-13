export type FittedBox = {
  center: [number, number, number];
  half: [number, number, number];
};

const box = (
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
): FittedBox => ({ center: [cx, cy, cz], half: [hx, hy, hz] });

const solid = (hx: number, hy: number, hz: number, cz = 0): FittedBox => box(0, hy, cz, hx, hy, hz);

/** Local boxes, before the entity scale. Empty space under a panel or canopy is left open. */
const BOXES: Record<string, FittedBox[]> = {
  "Sign by Zsky - 9UeVfOHm6k.glb": [
    box(-3.665, 0.71, 0, 0.4, 6.36, 0.55),
    box(3.665, 0.71, 0, 0.4, 6.36, 0.55),
  ],
  "billboard.glb": [
    box(0, 2.5, 0, 50, 17.5, 75),
    box(0, 187, 0, 33, 202, 33),
  ],
  "tree-large.glb": [
    box(0, 0.17, 0, 0.07, 0.17, 0.081),
    box(0, 0.549, 0, 0.105, 0.218, 0.121),
  ],
  "tree-small.glb": [
    box(0, 0.12, 0, 0.07, 0.12, 0.081),
    box(0, 0.384, 0, 0.105, 0.184, 0.121),
  ],
  "planter.glb": [solid(0.2, 0.089, 0.15)],
  "building-a.glb": [solid(0.442, 0.646, 0.47)],
  "building-b.glb": [solid(0.485, 0.646, 0.47)],
  "building-c.glb": [solid(0.442, 0.447, 0.545)],
  "building-d.glb": [solid(0.42, 0.646, 0.45)],
  "building-e.glb": [solid(0.82, 0.447, 0.504)],
  "building-f.glb": [solid(0.42, 0.847, 0.515)],
  "building-h.glb": [solid(0.442, 0.646, 0.504)],
  "building-i.glb": [solid(0.62, 0.84, 0.651)],
  "building-k.glb": [solid(1.042, 0.735, 0.471)],
  "building-skyscraper-a.glb": [solid(0.68, 1.44, 0.68)],
  "building-skyscraper-b.glb": [solid(0.68, 2.24, 0.68)],
  "building-skyscraper-c.glb": [solid(0.64, 2.04, 0.694)],
  "building-skyscraper-d.glb": [solid(0.64, 2.735, 0.694)],
  "building-skyscraper-e.glb": [solid(0.647, 2.04, 0.621)],
};

export function fittedBoxes(url: string) {
  const name = url.split("/").pop() ?? "";
  return BOXES[name] ?? null;
}
