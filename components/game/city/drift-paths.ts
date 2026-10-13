type Point = [number, number];

export type DriftSample = {
  x: number;
  z: number;
  yaw: number;
  drift: number;
  distance: number;
};

export type SkidPoint = { x: number; z: number; fade: number };

const CORNER = 0.7;
const SLIDE = 1.05;
const APPROACH = 5.5;
const EXIT = 4;
const SLIDE_BLEND = 2.8;

function smoother(value: number) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerpAngle(from: number, to: number, t: number) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
}

/** Lane centers on the parking deck, relative to the drift entity. */
const X = {
  east: 19.67,
  gap01: 13.2,
  gap12: 6.6,
  gap23: 0,
  gap34: -6.6,
  gap45: -13.2,
  west: -19.57,
};

const Z = {
  north: 7.31,
  upper: 3.7,
  middle: 0,
  lower: -3.7,
  south: -7.59,
};

const ROUTES: Point[][] = [
  [
    [X.gap12, Z.north],
    [X.east, Z.north],
    [X.east, Z.middle],
    [X.gap12, Z.middle],
    [X.gap12, Z.south],
    [X.gap34, Z.south],
    [X.gap34, Z.upper],
    [X.gap12, Z.upper],
  ],
  [
    [X.gap34, Z.north],
    [X.gap34, Z.middle],
    [X.gap23, Z.middle],
    [X.gap23, Z.south],
    [X.west, Z.south],
    [X.west, Z.north],
  ],
  [
    [X.gap23, Z.north],
    [X.gap45, Z.north],
    [X.gap45, Z.middle],
    [X.west, Z.middle],
    [X.west, Z.south],
    [X.east, Z.south],
    [X.east, Z.lower],
    [X.gap01, Z.lower],
    [X.gap01, Z.middle],
    [X.gap23, Z.middle],
  ],
];

function buildSamples(points: Point[]) {
  const count = points.length;
  const joints = points.map((curr, index) => {
    const prev = points[(index + count - 1) % count];
    const next = points[(index + 1) % count];
    const vx = curr[0] - prev[0];
    const vz = curr[1] - prev[1];
    const wx = next[0] - curr[0];
    const wz = next[1] - curr[1];
    const vl = Math.hypot(vx, vz);
    const wl = Math.hypot(wx, wz);
    const vinx = vx / vl;
    const vinz = vz / vl;
    const voutx = wx / wl;
    const voutz = wz / wl;
    const crossY = vinz * voutx - vinx * voutz;
    const dot = vinx * voutx + vinz * voutz;
    const turn = Math.acos(Math.max(-1, Math.min(1, dot)));
    const radius = turn < 0.08 ? 0 : Math.min(CORNER, vl * 0.45, wl * 0.45);
    const right = crossY > 0;
    const inX = curr[0] - vinx * radius;
    const inZ = curr[1] - vinz * radius;
    const outX = curr[0] + voutx * radius;
    const outZ = curr[1] + voutz * radius;
    const sideX = right ? vinz : -vinz;
    const sideZ = right ? -vinx : vinx;
    return {
      inX,
      inZ,
      outX,
      outZ,
      cx: inX + sideX * radius,
      cz: inZ + sideZ * radius,
      radius,
      right,
    };
  });

  const raw: { x: number; z: number; slide: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const from = joints[index];
    const to = joints[(index + 1) % count];
    const length = Math.hypot(to.inX - from.outX, to.inZ - from.outZ);
    const steps = Math.max(1, Math.ceil(length / 0.2));
    const approachSlide = to.right ? SLIDE : -SLIDE;
    const exitSlide = from.right ? SLIDE : -SLIDE;
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const traveled = t * length;
      let slide = 0;
      if (from.radius > 0.01 && traveled < EXIT) slide += exitSlide * smoother(1 - traveled / EXIT);
      if (to.radius > 0.01 && length - traveled < APPROACH) {
        slide += approachSlide * smoother(1 - (length - traveled) / APPROACH);
      }
      raw.push({
        x: from.outX + (to.inX - from.outX) * t,
        z: from.outZ + (to.inZ - from.outZ) * t,
        slide: Math.max(-SLIDE, Math.min(SLIDE, slide)),
      });
    }
    if (to.radius < 0.01) continue;
    const start = Math.atan2(to.inX - to.cx, to.inZ - to.cz);
    let sweep = Math.atan2(to.outX - to.cx, to.outZ - to.cz) - start;
    if (to.right) while (sweep <= 0) sweep += Math.PI * 2;
    else while (sweep >= 0) sweep -= Math.PI * 2;
    const arcSteps = Math.max(2, Math.ceil((Math.abs(sweep) * to.radius) / 0.15));
    for (let step = 0; step < arcSteps; step += 1) {
      const angle = start + sweep * (step / arcSteps);
      raw.push({
        x: to.cx + Math.sin(angle) * to.radius,
        z: to.cz + Math.cos(angle) * to.radius,
        slide: approachSlide,
      });
    }
  }

  const slides = raw.map((point) => point.slide);
  const along = [0];
  for (let index = 1; index < raw.length; index += 1) {
    along.push(along[index - 1] + Math.hypot(raw[index].x - raw[index - 1].x, raw[index].z - raw[index - 1].z));
  }
  const loop = along[along.length - 1] + Math.hypot(raw[0].x - raw[raw.length - 1].x, raw[0].z - raw[raw.length - 1].z);
  for (let index = 0; index < raw.length; index += 1) {
    let weighted = 0;
    let weight = 0;
    for (let other = 0; other < raw.length; other += 1) {
      let gap = Math.abs(along[other] - along[index]);
      gap = Math.min(gap, loop - gap);
      if (gap > SLIDE_BLEND) continue;
      const influence = 1 - gap / SLIDE_BLEND;
      weighted += slides[other] * influence;
      weight += influence;
    }
    raw[index].slide = weighted / weight;
  }

  const samples: DriftSample[] = [];
  let distance = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const next = raw[(index + 1) % raw.length];
    const point = raw[index];
    if (index > 0) distance += Math.hypot(point.x - raw[index - 1].x, point.z - raw[index - 1].z);
    const dx = next.x - point.x;
    const dz = next.z - point.z;
    samples.push({
      x: point.x,
      z: point.z,
      yaw: Math.atan2(dx, dz) + point.slide,
      drift: Math.min(1, Math.abs(point.slide) / SLIDE),
      distance,
    });
  }
  return samples;
}

const COURSES = ROUTES.map((points) => {
  const samples = buildSamples(points);
  const last = samples[samples.length - 1];
  const first = samples[0];
  return { samples, length: last.distance + Math.hypot(first.x - last.x, first.z - last.z) };
});

export function driftPose(route: number, distance: number) {
  const course = COURSES[route];
  const { samples } = course;
  const wrapped = ((distance % course.length) + course.length) % course.length;
  const last = samples[samples.length - 1];
  if (wrapped >= last.distance) {
    const span = course.length - last.distance || 1;
    const t = (wrapped - last.distance) / span;
    return {
      x: last.x + (samples[0].x - last.x) * t,
      z: last.z + (samples[0].z - last.z) * t,
      yaw: lerpAngle(last.yaw, samples[0].yaw, t),
      drift: last.drift + (samples[0].drift - last.drift) * t,
    };
  }
  let low = 1;
  let high = samples.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (samples[mid].distance < wrapped) low = mid + 1;
    else high = mid;
  }
  const next = samples[low];
  const prev = samples[low - 1];
  const span = next.distance - prev.distance || 1;
  const t = (wrapped - prev.distance) / span;
  return {
    x: prev.x + (next.x - prev.x) * t,
    z: prev.z + (next.z - prev.z) * t,
    yaw: lerpAngle(prev.yaw, next.yaw, t),
    drift: prev.drift + (next.drift - prev.drift) * t,
  };
}

export function driftSkids() {
  const runs: SkidPoint[][] = [];
  for (const course of COURSES) {
    let current: DriftSample[] = [];
    const flush = () => {
      if (current.length < 2) {
        current = [];
        return;
      }
      const start = current[0].distance;
      const span = current[current.length - 1].distance - start || 1;
      runs.push(
        current.map((point) => {
          const along = point.distance - start;
          const edge = Math.min(along, span - along);
          return { x: point.x, z: point.z, fade: Math.min(1, edge / 0.5) };
        }),
      );
      current = [];
    };
    for (const sample of course.samples) {
      if (sample.drift < 0.2) {
        flush();
        continue;
      }
      const previous = current[current.length - 1];
      if (previous && sample.distance - previous.distance > 1.2) flush();
      current.push(sample);
    }
    flush();
  }
  return runs;
}

const PACE = 9;
const PHASE = [0, 0, 0.36];
const PERIOD = COURSES[2].length / PACE;

export function driftDistance(route: number, elapsed: number) {
  const lap = (elapsed / PERIOD + PHASE[route]) % 1;
  return lap * COURSES[route].length;
}
