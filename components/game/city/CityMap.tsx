"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { ConvexHullCollider, CuboidCollider, RigidBody, interactionGroups } from "@react-three/rapier";
import { Box3, CanvasTexture, DoubleSide, ExtrudeGeometry, Matrix4, Quaternion, Shape, SRGBColorSpace, Sprite, Vector3, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { attachOutline } from "../Outline";
import { ROAD_RAMP, ROAD_RISE } from "./layout";
import type { MapEntity, ModelEntity, Vec3 } from "./map-types";
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
  "/models/sedan.glb",
  "/models/billboard.glb",
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
    const wave = Math.sin(clock.elapsedTime * 5) * 0.14;
    if (torso.current) torso.current.rotation.set(0, 0, -0.12);
    if (right.current) right.current.rotation.set(0.2, -0.85, -1.22 + wave);
    if (left.current) left.current.rotation.set(0, 0, -1.2);
    if (head.current) head.current.rotation.set(0, 0, -0.42);
  });

  return <primitive object={scene} scale={scale} />;
}

function loopPose(t: number) {
  const hw = 20.6;
  const hh = 8.6;
  const radius = 2.8;
  const lenX = 2 * (hw - radius);
  const lenZ = 2 * (hh - radius);
  const arc = (Math.PI * radius) / 2;
  const segs = [
    { len: lenX, kind: "bottom" },
    { len: arc, kind: "br" },
    { len: lenZ, kind: "right" },
    { len: arc, kind: "tr" },
    { len: lenX, kind: "top" },
    { len: arc, kind: "tl" },
    { len: lenZ, kind: "left" },
    { len: arc, kind: "bl" },
  ];
  const total = segs.reduce((sum, seg) => sum + seg.len, 0);
  let dist = ((t % 1) + 1) % 1 * total;
  let kind = "bottom";
  let local = 0;
  for (const seg of segs) {
    if (dist <= seg.len) {
      kind = seg.kind;
      local = seg.len === 0 ? 0 : dist / seg.len;
      break;
    }
    dist -= seg.len;
  }

  const x1 = hw - radius;
  const z1 = hh - radius;
  let x = 0;
  let z = 0;
  let yaw = 0;
  let drifting = false;

  if (kind === "bottom") {
    x = -x1 + local * lenX;
    z = -hh;
    yaw = Math.PI / 2;
  } else if (kind === "right") {
    x = hw;
    z = -z1 + local * lenZ;
    yaw = 0;
  } else if (kind === "top") {
    x = x1 - local * lenX;
    z = hh;
    yaw = -Math.PI / 2;
  } else if (kind === "left") {
    x = -hw;
    z = z1 - local * lenZ;
    yaw = Math.PI;
  } else {
    drifting = true;
    const theta =
      kind === "br" ? -Math.PI / 2 + local * (Math.PI / 2) :
      kind === "tr" ? local * (Math.PI / 2) :
      kind === "tl" ? Math.PI / 2 + local * (Math.PI / 2) :
      Math.PI + local * (Math.PI / 2);
    const cx = kind === "br" || kind === "tr" ? x1 : -x1;
    const cz = kind === "br" || kind === "bl" ? -z1 : z1;
    x = cx + radius * Math.cos(theta);
    z = cz + radius * Math.sin(theta);
    const dx = -Math.sin(theta);
    const dz = Math.cos(theta);
    yaw = Math.atan2(dx, dz);
    yaw += kind === "tl" || kind === "bl" ? -1.05 : 1.05;
  }

  return { x, z, yaw, drifting };
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

function DriftCar({ offset }: { offset: number }) {
  "use no memo";
  const { scene } = useGLTF("/models/sedan.glb");
  const model = useMemo(() => scene.clone(true), [scene]);
  const group = useRef<Group>(null);
  const puffs = useRef<Sprite[]>([]);
  const smokeTexture = useSmokeTexture();

  useFrame(({ clock }) => {
    const car = group.current;
    if (!car) return;
    const pose = loopPose(clock.elapsedTime * 0.15 + offset);
    car.position.set(pose.x, ROAD_RISE + 0.02, pose.z);
    car.rotation.y = pose.yaw;
    puffs.current.forEach((puff, index) => {
      const age = (clock.elapsedTime * 1.4 + index * 0.17) % 1;
      puff.visible = pose.drifting;
      puff.position.set(index % 2 === 0 ? -0.28 : 0.28, 0.2 + age * 0.7, -0.85 - age * 0.9);
      puff.scale.setScalar(0.25 + age * 0.85);
      puff.material.opacity = pose.drifting ? 0.55 * (1 - age) : 0;
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
        if (entity.kind === "model" && entity.collider === "building" && entity.half) {
          return (
            <RigidBody
              key={entity.id}
              type="fixed"
              colliders={false}
              position={[entity.position[0], stackedPosition(entity)[1] + entity.half[1], entity.position[2]]}
              rotation={[0, entity.rotationY, 0]}
            >
              <CuboidCollider args={entity.half} friction={0.3} collisionGroups={interactionGroups([2], [1])} />
            </RigidBody>
          );
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
          <DriftCar offset={0} />
          <DriftCar offset={0.33} />
          <DriftCar offset={0.66} />
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
