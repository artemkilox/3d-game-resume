"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { ConvexHullCollider, CuboidCollider, RigidBody, interactionGroups, type RapierRigidBody } from "@react-three/rapier";
import { Box3, BufferGeometry, CanvasTexture, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Quaternion, Shape, SRGBColorSpace, Sprite, Vector3, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { attachOutline } from "../Outline";
import { ROAD_RAMP, ROAD_RISE } from "./layout";
import type { MapEntity, ModelEntity, Vec3 } from "./map-types";
import { driftDistance, driftPose, driftSkids } from "./drift-paths";
import { fittedBoxes } from "./model-colliders";
import { FloorText, GroundControls, GroundCopy } from "./Signs";

const LAYER_STEP = 0.16;

function stackedPosition(entity: { position: Vec3; layer?: number }): Vec3 {
  return [entity.position[0], entity.position[1] + (entity.layer ?? 0) * LAYER_STEP, entity.position[2]];
}

const MODELS = [
  "/models/roads/road-straight.glb",
  "/models/roads/road-bend.glb",
  "/models/commercial/building-k.glb",
  "/models/commercial/building-skyscraper-a.glb",
  "/models/commercial/building-skyscraper-b.glb",
  "/models/commercial/building-skyscraper-c.glb",
  "/models/commercial/building-skyscraper-d.glb",
  "/models/commercial/building-skyscraper-e.glb",
  "/models/people/character-male-d.glb",
  "/models/sedan-sports.glb",
  "/models/billboard.glb",
  "/models/Sign by Zsky - 9UeVfOHm6k.glb",
];

for (const url of MODELS) useGLTF.preload(url);

function measureHalf(object: Object3D): Vec3 | null {
  object.updateWorldMatrix(true, true);
  const root = object.parent ?? object;
  const inverse = new Matrix4().copy(root.matrixWorld).invert();
  const box = new Box3();
  const part = new Box3();
  let empty = true;
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (!bounds) return;
    part.copy(bounds).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
    if (empty) box.copy(part);
    else box.union(part);
    empty = false;
  });
  if (empty) return null;
  const size = box.getSize(new Vector3());
  return [Math.abs(size.x) / 2, Math.abs(size.y) / 2, Math.abs(size.z) / 2];
}

function StaticModel({
  url,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  outline = false,
  reportHalf,
}: {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  outline?: boolean;
  reportHalf?: (half: Vec3) => void;
}) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => scene.clone(true), [scene]);

  useLayoutEffect(() => {
    if (!outline) return;
    return attachOutline(object, 1.02);
  }, [object, outline]);

  useLayoutEffect(() => {
    if (!reportHalf) return;
    const half = measureHalf(object);
    if (half) reportHalf(half);
  }, [object, reportHalf]);

  return <primitive object={object} position={position} rotation={rotation} scale={scale} />;
}

function Host({ scale }: { scale: number }) {
  "use no memo";
  const { scene } = useGLTF("/models/people/character-male-d.glb");
  const right = useRef<Object3D>(null);
  const left = useRef<Object3D>(null);
  const head = useRef<Object3D>(null);
  const torso = useRef<Object3D>(null);

  useLayoutEffect(() => {
    scene.traverse((obj) => {
      if (obj.name === "arm-right") right.current = obj;
      if (obj.name === "arm-left") left.current = obj;
      if (obj.name === "head") head.current = obj;
      if (obj.name === "torso") torso.current = obj;
    });
  }, [scene]);

  useFrame(({ clock }) => {
    const wave = Math.sin(clock.elapsedTime * 10) * 0.14;
    if (torso.current) torso.current.rotation.set(0, 0, -0.12);
    if (right.current) right.current.rotation.set(0.2, -0.85, -1.22 + wave);
    if (left.current) left.current.rotation.set(0, 0, -1.2);
    if (head.current) head.current.rotation.set(0, 0, -0.42);
  });

  return <primitive object={scene} scale={scale} />;
}

function useSmokeTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const glow = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    glow.addColorStop(0, "rgba(90, 90, 90, 0.7)");
    glow.addColorStop(1, "rgba(90, 90, 90, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, []);

  useEffect(() => {
    return () => texture?.dispose();
  }, [texture]);

  return texture;
}

const DRIFT_COLOR = ["#3a74e0", "#37b85a", "#e23b3a"];

function tintBodyTexture(image: CanvasImageSource & { width: number; height: number }, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  const hex = Number.parseInt(color.slice(1), 16);
  const tr = (hex >> 16) & 255;
  const tg = (hex >> 8) & 255;
  const tb = hex & 255;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const paint = red > 170 && green < 150 && red > green + 45 && red > blue + 50;
    if (!paint) continue;
    const max = Math.max(red, green, blue);
    const shade = max / 255;
    data[index] = tr * shade;
    data[index + 1] = tg * shade;
    data[index + 2] = tb * shade;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function paintDriftModel(model: Object3D, color: string) {
  let tint: CanvasTexture | null = null;
  model.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || (mesh.name !== "body" && mesh.name !== "spoiler")) return;
    const source = mesh.material as MeshStandardMaterial;
    if (!tint && source.map?.image) {
      tint = tintBodyTexture(source.map.image, color);
      if (tint && source.map) {
        tint.flipY = source.map.flipY;
        tint.colorSpace = source.map.colorSpace;
      }
    }
    if (!tint) return;
    const material = source.clone();
    material.map = tint;
    material.color.set("#ffffff");
    mesh.material = material;
  });
}

function DriftCar({ route }: { route: number }) {
  "use no memo";
  const { scene } = useGLTF("/models/sedan-sports.glb");
  const model = useMemo(() => {
    const copy = scene.clone(true);
    paintDriftModel(copy, DRIFT_COLOR[route]);
    return copy;
  }, [route, scene]);
  const group = useRef<Group>(null);
  const puffs = useRef<Sprite[]>([]);
  const smokeTexture = useSmokeTexture();

  useFrame(({ clock }) => {
    const car = group.current;
    if (!car) return;
    const pose = driftPose(route, driftDistance(route, clock.elapsedTime));
    car.position.set(pose.x, ROAD_RISE + 0.02, pose.z);
    car.rotation.y = pose.yaw;
    puffs.current.forEach((puff, index) => {
      const age = (clock.elapsedTime * 1.4 + index * 0.17) % 1;
      puff.visible = pose.drift > 0.08;
      puff.position.set(index % 2 === 0 ? -0.28 : 0.28, 0.2 + age * 0.7, -0.85 - age * 0.9);
      puff.scale.setScalar(0.25 + age * 0.85);
      puff.material.opacity = 0.55 * (1 - age) * pose.drift;
    });
  });

  return (
    <group ref={group} scale={0.5}>
      <primitive object={model} />
      {smokeTexture
        ? Array.from({ length: 6 }, (_, index) => (
            <sprite
              key={index}
              ref={(node) => {
                if (node) puffs.current[index] = node;
              }}
            >
              <spriteMaterial map={smokeTexture} transparent depthWrite={false} opacity={0} />
            </sprite>
          ))
        : null}
    </group>
  );
}

function skidGeometry() {
  const positions: number[] = [];
  const alphas: number[] = [];
  const indices: number[] = [];
  const y = ROAD_RISE + 0.045;
  const track = 0.15;
  const half = 0.03;
  for (const run of driftSkids()) {
    for (const side of [track, -track]) {
      const base = positions.length / 3;
      for (let index = 0; index < run.length; index += 1) {
        const prev = run[Math.max(0, index - 1)];
        const next = run[Math.min(run.length - 1, index + 1)];
        const dx = next.x - prev.x;
        const dz = next.z - prev.z;
        const length = Math.hypot(dx, dz) || 1;
        const sideX = dz / length;
        const sideZ = -dx / length;
        const centerX = run[index].x + sideX * side;
        const centerZ = run[index].z + sideZ * side;
        const fade = run[index].fade * 0.2;
        positions.push(
          centerX + sideX * half, y, centerZ + sideZ * half,
          centerX - sideX * half, y, centerZ - sideZ * half,
        );
        alphas.push(fade, fade);
      }
      for (let index = 0; index < run.length - 1; index += 1) {
        const vertex = base + index * 2;
        indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("alpha", new Float32BufferAttribute(alphas, 1));
  geometry.setIndex(indices);
  return geometry;
}

const skids = skidGeometry();

function DriftSkids() {
  return (
    <mesh geometry={skids} renderOrder={2}>
      <shaderMaterial
        transparent
        depthWrite={false}
        side={DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        toneMapped={false}
        vertexShader={`
          attribute float alpha;
          varying float vAlpha;
          void main() {
            vAlpha = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying float vAlpha;
          void main() {
            gl_FragColor = vec4(0.0, 0.0, 0.0, vAlpha);
          }
        `}
      />
    </mesh>
  );
}

function roundedIslandGeometry() {
  const width = 3.7;
  const depth = 1.95;
  const radius = 0.46;
  const shape = new Shape();
  const w = width / 2;
  const d = depth / 2;
  shape.moveTo(-w + radius, -d);
  shape.lineTo(w - radius, -d);
  shape.absarc(w - radius, -d + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(w, d - radius);
  shape.absarc(w - radius, d - radius, radius, 0, Math.PI / 2, false);
  shape.lineTo(-w + radius, d);
  shape.absarc(-w + radius, d - radius, radius, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w, -d + radius);
  shape.absarc(-w + radius, -d + radius, radius, Math.PI, (Math.PI * 3) / 2, false);
  const geometry = new ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 8 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function paintBillboard(image: CanvasImageSource, text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, 1024, 1024);
  ctx.fillStyle = "#171717";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = 900;
  let size = 96;
  ctx.font = `800 ${size}px Segoe UI, sans-serif`;
  while (size > 40 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `800 ${size}px Segoe UI, sans-serif`;
  }
  ctx.fillText(text, 514, 222);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

const ARROW_UP = "/signs/arrow-up.png";
const SIGN_ASPECT = 9.38128 / 4.87847;

function whiteArrow(image: HTMLImageElement) {
  const scratch = document.createElement("canvas");
  scratch.width = image.width;
  scratch.height = image.height;
  const ctx = scratch.getContext("2d");
  if (!ctx) return scratch;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, scratch.width, scratch.height);
  return scratch;
}

function paintRoadSign(arrow: HTMLImageElement, text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#1d5812";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (text) {
    const glyph = whiteArrow(arrow);
    const drawFace = (cx: number, cy: number) => {
      ctx.save();
      // The long edge of the board is vertical in the texture. Both faces read upright from outside.
      ctx.setTransform(0, 1 / SIGN_ASPECT, -1, 0, cx, cy);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let size = 120;
      const layout = () => {
        ctx.font = `700 ${size}px "Segoe UI", sans-serif`;
        const textW = ctx.measureText(text).width;
        const arrowH = size * 0.92;
        const arrowW = arrowH * (arrow.width / arrow.height);
        const gap = size * 0.28;
        return { textW, arrowH, arrowW, gap, total: textW + gap * 2 + arrowW * 2 };
      };
      let fitted = layout();
      while (size > 36 && (fitted.total > 420 || fitted.arrowH > 200)) {
        size -= 2;
        fitted = layout();
      }
      const { textW, arrowH, arrowW, gap, total } = fitted;
      const left = -total / 2;
      ctx.drawImage(glyph, left, -arrowH / 2, arrowW, arrowH);
      ctx.fillText(text, left + arrowW + gap + textW / 2, 2);
      ctx.drawImage(glyph, left + arrowW + gap + textW + gap, -arrowH / 2, arrowW, arrowH);
      ctx.restore();
    };
    drawFace(512, 128);
    drawFace(512, 640);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function RoadSign({
  url,
  scale,
  label,
  reportHalf,
}: {
  url: string;
  scale: number;
  label: string;
  reportHalf?: (half: Vec3) => void;
}) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const object = scene.clone(true);
    object.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return object;
  }, [scene]);
  const textureRef = useRef<CanvasTexture | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const texture = paintRoadSign(image, label);
      if (!texture) return;
      textureRef.current?.dispose();
      textureRef.current = texture;
      model.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          const standard = material as MeshStandardMaterial;
          if (!standard.name.toLowerCase().includes("green")) continue;
          standard.map = texture;
          standard.color.set("#ffffff");
          standard.needsUpdate = true;
        }
      });
    };
    image.src = ARROW_UP;
    return () => {
      cancelled = true;
    };
  }, [model, label]);

  useEffect(() => () => textureRef.current?.dispose(), []);

  useLayoutEffect(() => {
    if (!reportHalf) return;
    const half = measureHalf(model);
    if (half) reportHalf(half);
  }, [model, reportHalf]);

  return <primitive object={model} scale={scale} />;
}

function StackBillboard({
  scale,
  label,
  reportHalf,
}: {
  scale: number;
  label: string;
  reportHalf?: (half: Vec3) => void;
}) {
  const { scene } = useGLTF("/models/billboard.glb");
  const model = useMemo(() => {
    const object = scene.clone(true);
    let source: CanvasImageSource | null = null;
    object.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const material = (mesh.material as MeshStandardMaterial).clone();
      if (!source && material.map?.image) source = material.map.image as CanvasImageSource;
      mesh.material = material;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return { object, source };
  }, [scene]);

  useLayoutEffect(() => {
    if (!model.source) return;
    const texture = paintBillboard(model.source, label);
    if (!texture) return;
    model.object.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as MeshStandardMaterial;
      material.map = texture;
      material.needsUpdate = true;
    });
    return () => texture.dispose();
  }, [model, label]);

  useLayoutEffect(() => {
    if (!reportHalf) return;
    const half = measureHalf(model.object);
    if (half) reportHalf(half);
  }, [model, reportHalf]);

  return <primitive object={model.object} scale={scale} />;
}

function deckHull(length: number, width: number, rise: number) {
  const hl = length / 2;
  const hw = width / 2;
  return [-hl, 0, -hw, hl, 0, -hw, hl, 0, hw, -hl, 0, hw, -hl, rise, -hw, hl, rise, -hw, hl, rise, hw, -hl, rise, hw];
}

function roadHull(length: number, width: number, ends: boolean) {
  const hl = length / 2;
  const hw = width / 2;
  const ramp = ROAD_RAMP;
  const rise = ROAD_RISE;
  const x0 = ends ? hl + ramp : hl;
  const points = [
    [-x0, 0, -(hw + ramp)],
    [x0, 0, -(hw + ramp)],
    [x0, 0, hw + ramp],
    [-x0, 0, hw + ramp],
    [-hl, rise, -hw],
    [hl, rise, -hw],
    [hl, rise, hw],
    [-hl, rise, hw],
  ];
  return points.flat();
}

function RoadRamps({ length, width }: { length: number; width: number }) {
  const ramp = ROAD_RAMP;
  const angle = Math.atan2(ROAD_RISE, ramp);
  const slope = Math.hypot(ramp, ROAD_RISE);
  const side = width / 2 + ramp / 2;
  return (
    <group>
      {[1, -1].map((dir) => (
        <mesh key={dir} position={[0, ROAD_RISE / 2, side * dir]} rotation={[angle * dir, 0, 0]} receiveShadow>
          <boxGeometry args={[length, 0.05, slope]} />
          <meshStandardMaterial color="#6a7078" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

const SLANT_PROFILE: [number, number][] = [
  [-1, 0.02],
  [-0.8, 0.029],
  [-0.6, 0.069],
  [-0.4, 0.113],
  [-0.2, 0.2],
  [0, 0.28],
  [0.2, 0.38],
  [0.4, 0.435],
  [0.6, 0.475],
  [0.8, 0.512],
  [1, 0.52],
];

function FittedModel({ url, scale }: { url: string; scale: number }) {
  const boxes = fittedBoxes(url) ?? [];
  return (
    <>
      {boxes.map((item, index) => (
        <CuboidCollider
          key={index}
          args={[item.half[0] * scale, item.half[1] * scale, item.half[2] * scale]}
          position={[item.center[0] * scale, item.center[1] * scale, item.center[2] * scale]}
          friction={0.4}
          collisionGroups={interactionGroups([2], [1])}
        />
      ))}
    </>
  );
}

function SlantSurface({ scale }: { scale: number }) {
  return (
    <>
      {SLANT_PROFILE.slice(0, -1).map(([x0, h0], index) => {
        const [x1, h1] = SLANT_PROFILE[index + 1];
        const y0 = h0 * scale;
        const y1 = h1 * scale;
        const dx = (x1 - x0) * scale;
        const dy = y1 - y0;
        const length = Math.hypot(dx, dy) + 0.4;
        const angle = Math.atan2(dy, dx);
        return (
          <CuboidCollider
            key={index}
            args={[length / 2, 0.08, scale * 0.48]}
            position={[((x0 + x1) / 2) * scale, (y0 + y1) / 2 - 0.08, 0]}
            rotation={[0, 0, angle]}
            friction={1.2}
            collisionGroups={interactionGroups([0], [1])}
          />
        );
      })}
    </>
  );
}

const UP_AXIS = new Vector3(0, 1, 0);

function DriftObstacles({ position, rotationY }: { position: Vec3; rotationY: number }) {
  "use no memo";
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const turn = useMemo(() => new Quaternion(), []);

  useFrame(({ clock }) => {
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    [0, 1, 2].forEach((route) => {
      const body = bodies.current[route];
      if (!body) return;
      const pose = driftPose(route, driftDistance(route, clock.elapsedTime));
      const x = position[0] + pose.x * cos + pose.z * sin;
      const z = position[2] - pose.x * sin + pose.z * cos;
      turn.setFromAxisAngle(UP_AXIS, pose.yaw + rotationY);
      body.setNextKinematicTranslation({ x, y: position[1] + ROAD_RISE + 0.4, z });
      body.setNextKinematicRotation({ x: turn.x, y: turn.y, z: turn.z, w: turn.w });
    });
  });

  return (
    <>
      {[0, 1, 2].map((index) => (
        <RigidBody
          key={index}
          ref={(body) => {
            bodies.current[index] = body;
          }}
          type="kinematicPosition"
          colliders={false}
          position={position}
        >
          <CuboidCollider args={[0.34, 0.28, 0.58]} collisionGroups={interactionGroups([2], [1])} friction={0.4} />
        </RigidBody>
      ))}
    </>
  );
}

export function CityColliders({ entities }: { entities: MapEntity[] }) {
  return (
    <group>
      {entities.map((entity) => {
        if (entity.kind === "road") {
          return (
            <RigidBody
              key={entity.id}
              type="fixed"
              colliders={false}
              position={stackedPosition(entity)}
              rotation={[0, entity.rotationY, 0]}
            >
              <ConvexHullCollider
                args={[roadHull(entity.scale[0], entity.scale[2], entity.bend)]}
                friction={1.2}
                collisionGroups={interactionGroups([0], [1])}
              />
            </RigidBody>
          );
        }
        if (entity.kind === "deck") {
          return (
            <RigidBody
              key={entity.id}
              type="fixed"
              colliders={false}
              position={stackedPosition(entity)}
              rotation={[0, entity.rotationY, 0]}
            >
              <ConvexHullCollider
                args={[deckHull(entity.length, entity.width, ROAD_RISE)]}
                friction={1.2}
                collisionGroups={interactionGroups([0], [1])}
              />
            </RigidBody>
          );
        }
        if (entity.kind === "curb") {
          return (
            <RigidBody
              key={entity.id}
              type="fixed"
              colliders={false}
              position={stackedPosition(entity)}
              rotation={[0, entity.rotationY, 0]}
            >
              <CuboidCollider
                args={[entity.size[0] / 2, entity.size[1] / 2, entity.size[2] / 2]}
                friction={0.4}
                collisionGroups={interactionGroups([0], [1])}
              />
            </RigidBody>
          );
        }
        if (entity.kind === "model" && entity.collider === "building" && fittedBoxes(entity.url)) {
          return (
            <RigidBody
              key={entity.id}
              type="fixed"
              colliders={false}
              position={stackedPosition(entity)}
              rotation={[0, entity.rotationY, 0]}
            >
              <FittedModel url={entity.url} scale={entity.scale} />
            </RigidBody>
          );
        }
        if (entity.kind === "model" && entity.url.includes("road-slant-curve")) {
          return (
            <RigidBody
              key={entity.id}
              type="fixed"
              colliders={false}
              position={stackedPosition(entity)}
              rotation={[0, entity.rotationY, 0]}
            >
              <SlantSurface scale={entity.scale} />
            </RigidBody>
          );
        }
        if (entity.kind === "model" && entity.collider === "building" && entity.half) {
          const hy = Math.max(entity.half[1], 0.4);
          return (
            <RigidBody
              key={entity.id}
              type="fixed"
              colliders={false}
              position={[entity.position[0], stackedPosition(entity)[1] + hy, entity.position[2]]}
              rotation={[0, entity.rotationY, 0]}
            >
              <CuboidCollider
                args={[entity.half[0], hy, entity.half[2]]}
                friction={0.3}
                collisionGroups={interactionGroups([2], [1])}
              />
            </RigidBody>
          );
        }
        if (entity.kind === "character") {
          const hx = 0.384 * entity.scale;
          const hy = 0.361 * entity.scale;
          const hz = 0.172 * entity.scale;
          return (
            <RigidBody
              key={entity.id}
              type="fixed"
              colliders={false}
              position={[entity.position[0], stackedPosition(entity)[1] + hy, entity.position[2]]}
              rotation={[0, entity.rotationY, 0]}
            >
              <CuboidCollider args={[hx, hy, hz]} friction={0.4} collisionGroups={interactionGroups([2], [1])} />
            </RigidBody>
          );
        }
        if (entity.kind === "island") {
          return (
            <RigidBody
              key={entity.id}
              type="fixed"
              colliders={false}
              position={stackedPosition(entity)}
              rotation={[0, entity.rotationY, 0]}
            >
              <CuboidCollider
                args={[1.85, 0.45, 0.98]}
                position={[0, ROAD_RISE + 0.45, 0]}
                friction={0.4}
                collisionGroups={interactionGroups([2], [1])}
              />
            </RigidBody>
          );
        }
        if (entity.kind === "drift") {
          return <DriftObstacles key={entity.id} position={entity.position} rotationY={entity.rotationY} />;
        }
        return null;
      })}
    </group>
  );
}

const CHEVRON = new Shape();
CHEVRON.moveTo(0.46, 0);
CHEVRON.lineTo(-0.08, 0.36);
CHEVRON.lineTo(-0.28, 0.22);
CHEVRON.lineTo(0.08, 0);
CHEVRON.lineTo(-0.28, -0.22);
CHEVRON.lineTo(-0.08, -0.36);
CHEVRON.closePath();

function RoadChevrons({ position, yaw }: { position: [number, number, number]; yaw: number }) {
  const group = useRef<Group>(null);

  useLayoutEffect(() => {
    const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
    group.current?.quaternion.copy(turn.multiply(tilt));
  }, [yaw]);

  return (
    <group ref={group} position={position}>
      {[-0.95, 0, 0.95].map((offset) => (
        <mesh key={offset} position={[offset, 0, 0]}>
          <shapeGeometry args={[CHEVRON]} />
          <meshBasicMaterial color="#f7f4ee" side={DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Selectable({
  entity,
  selected,
  children,
}: {
  entity: MapEntity;
  selected: boolean;
  children: ReactNode;
}) {
  return (
    <group position={stackedPosition(entity)} rotation={[0, entity.rotationY, 0]} userData={{ mapId: entity.id }}>
      {children}
      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
          <ringGeometry args={[1.15, 1.4, 28]} />
          <meshBasicMaterial color="#e23b2f" toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function ModelBody({ entity, onHalf }: { entity: ModelEntity; onHalf?: (id: string, half: Vec3) => void }) {
  const report = useCallback(
    (half: Vec3) => {
      onHalf?.(entity.id, half);
    },
    [entity.id, onHalf],
  );
  const reportHalf = entity.collider === "building" && !entity.half ? report : undefined;
  if (entity.label && entity.url.includes("billboard")) {
    return <StackBillboard scale={entity.scale} label={entity.label} reportHalf={reportHalf} />;
  }
  if (entity.url.toLowerCase().includes("sign")) {
    return <RoadSign url={entity.url} scale={entity.scale} label={entity.label ?? ""} reportHalf={reportHalf} />;
  }
  return (
    <StaticModel
      url={entity.url}
      position={[0, 0, 0]}
      scale={entity.scale}
      outline={entity.outline}
      reportHalf={reportHalf}
    />
  );
}

function EntityBody({
  entity,
  island,
  onHalf,
}: {
  entity: MapEntity;
  island: ExtrudeGeometry;
  onHalf?: (id: string, half: Vec3) => void;
}) {
  switch (entity.kind) {
    case "model":
      return <ModelBody entity={entity} onHalf={onHalf} />;
    case "road":
      return (
        <>
          <StaticModel url={entity.url} position={[0, 0, 0]} scale={entity.scale} />
          {entity.ramps ? <RoadRamps length={entity.scale[0]} width={entity.scale[2]} /> : null}
        </>
      );
    case "text":
      return entity.variant === "floor" ? (
        <FloorText
          lines={entity.lines}
          position={[0, 0, 0]}
          width={entity.width}
          height={entity.height}
          fitted={entity.fitted}
          balanced={entity.balanced}
          color={entity.color}
        />
      ) : (
        <GroundCopy
          title={entity.title}
          lines={entity.lines}
          position={[0, 0, 0]}
          width={entity.width}
          height={entity.height}
          color={entity.color}
        />
      );
    case "controls":
      return <GroundControls position={[0, 0, 0]} width={entity.width} height={entity.height} />;
    case "chevron":
      return <RoadChevrons position={[0, 0, 0]} yaw={0} />;
    case "character":
      return <Host scale={entity.scale} />;
    case "deck":
      return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_RISE + 0.01, 0]} receiveShadow>
          <planeGeometry args={[entity.length, entity.width]} />
          <meshStandardMaterial color="#5e646c" roughness={1} />
        </mesh>
      );
    case "curb":
      return (
        <mesh castShadow receiveShadow>
          <boxGeometry args={entity.size} />
          <meshStandardMaterial color="#f7f4ee" roughness={0.85} />
        </mesh>
      );
    case "island":
      return (
        <>
          <mesh geometry={island} position={[0, ROAD_RISE, 0]} receiveShadow>
            <meshStandardMaterial color="#f4efe4" roughness={1} />
          </mesh>
          <FloorText lines={entity.lines} position={[0, ROAD_RISE + 0.18, 0]} width={3.15} height={1.45} fitted balanced />
        </>
      );
    case "drift":
      return (
        <>
          <DriftSkids />
          <DriftCar route={0} />
          <DriftCar route={1} />
          <DriftCar route={2} />
        </>
      );
    default:
      return null;
  }
}

export function CityScene({
  entities,
  selectedId,
  onHalf,
}: {
  entities: MapEntity[];
  selectedId: string | null;
  onHalf?: (id: string, half: Vec3) => void;
}) {
  const island = useMemo(() => roundedIslandGeometry(), []);
  const ordered = useMemo(
    () => [...entities].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0)),
    [entities],
  );
  useEffect(() => {
    return () => island.dispose();
  }, [island]);

  return (
    <group>
      {ordered.map((entity) => (
        <Selectable key={entity.id} entity={entity} selected={entity.id === selectedId}>
          <EntityBody entity={entity} island={island} onHalf={onHalf} />
        </Selectable>
      ))}
    </group>
  );
}
