"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { ConvexHullCollider, CuboidCollider, RigidBody, interactionGroups } from "@react-three/rapier";
import { CanvasTexture, DoubleSide, ExtrudeGeometry, Quaternion, Shape, SRGBColorSpace, Sprite, Vector3, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { attachOutline } from "../Outline";
import { ARROWS, BUILDINGS, PARKING, ROAD_RAMP, ROAD_RISE, ROAD_WIDTH, ROADS, SKILL_ISLANDS, TILE } from "./layout";
import { FloorText, GroundControls, GroundCopy } from "./Signs";

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

function StaticModel({
  url,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  outline = false,
}: {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  outline?: boolean;
}) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => scene.clone(true), [scene]);

  useLayoutEffect(() => {
    if (!outline) return;
    return attachOutline(object, 1.02);
  }, [object, outline]);

  return <primitive object={object} position={position} rotation={rotation} scale={scale} />;
}

function Host() {
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

  return <primitive object={scene} position={[-5.2, 0, 11.5]} rotation={[0, Math.PI - 0.7, 0]} scale={2.3} />;
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

const LOT_LENGTH = 48;
const LOT_WIDTH = 22;
const CURB_WIDTH = 0.38;
const CURB_HEIGHT = ROAD_RISE + 0.12;

function skillLines(label: string) {
  const words = label.split(" ");
  return words.length > 1 ? [words[0], words.slice(1).join(" ")] : [label];
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

function ParkingCurbs({ length, width }: { length: number; width: number }) {
  const w = CURB_WIDTH;
  const h = CURB_HEIGHT;
  return (
    <group>
      {[1, -1].map((dir) => (
        <mesh key={`z${dir}`} position={[0, h / 2, (width / 2 + w / 2) * dir]} castShadow receiveShadow>
          <boxGeometry args={[length + w * 2, h, w]} />
          <meshStandardMaterial color="#f7f4ee" roughness={0.85} />
        </mesh>
      ))}
      {[1, -1].map((dir) => (
        <mesh key={`x${dir}`} position={[(length / 2 + w / 2) * dir, h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h, width]} />
          <meshStandardMaterial color="#f7f4ee" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function paintBillboard(image: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, 1024, 1024);
  const text = "Технологический стек";
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

function StackBillboard() {
  const { scene } = useGLTF("/models/billboard.glb");
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      mesh.material = (mesh.material as MeshStandardMaterial).clone();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  useLayoutEffect(() => {
    let texture: CanvasTexture | null = null;
    model.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as MeshStandardMaterial;
      if (texture) {
        material.map = texture;
        material.needsUpdate = true;
        return;
      }
      const image = material.map?.image as CanvasImageSource | undefined;
      if (!image) return;
      texture = paintBillboard(image);
      if (!texture) return;
      material.map = texture;
      material.needsUpdate = true;
    });
    return () => texture?.dispose();
  }, [model]);

  const scale = 0.012;
  return (
    <primitive
      object={model}
      position={[21, 15 * scale, -LOT_WIDTH / 2 - 0.85]}
      rotation={[0, Math.PI / 2, 0]}
      scale={scale}
    />
  );
}

function Parking() {
  const island = useMemo(() => roundedIslandGeometry(), []);
  useEffect(() => {
    return () => island.dispose();
  }, [island]);

  const columns = [-16.5, -9.9, -3.3, 3.3, 9.9, 16.5];
  const rows = [-5.55, -1.85, 1.85, 5.55];

  return (
    <group position={[PARKING.x, 0, PARKING.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_RISE + 0.01, 0]} receiveShadow>
        <planeGeometry args={[LOT_LENGTH, LOT_WIDTH]} />
        <meshStandardMaterial color="#5e646c" roughness={1} />
      </mesh>
      <ParkingCurbs length={LOT_LENGTH} width={LOT_WIDTH} />
      {SKILL_ISLANDS.map((label, index) => {
        const row = Math.floor(index / columns.length);
        const rowCount = Math.min(columns.length, SKILL_ISLANDS.length - row * columns.length);
        const rowStart = (columns.length - rowCount) / 2;
        const x = columns[rowStart + (index % columns.length)];
        const z = rows[row];
        return (
          <group key={label} position={[x, 0, z]}>
            <mesh geometry={island} position={[0, ROAD_RISE, 0]} receiveShadow>
              <meshStandardMaterial color="#f4efe4" roughness={1} />
            </mesh>
            <FloorText
              lines={skillLines(label)}
              position={[0, ROAD_RISE + 0.18, 0]}
              width={3.15}
              height={1.45}
              fitted
              balanced
            />
          </group>
        );
      })}
      <StackBillboard />
      <DriftCar offset={0} />
      <DriftCar offset={0.33} />
      <DriftCar offset={0.66} />
    </group>
  );
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

export function CityColliders() {
  return (
    <group>
      {ROADS.map((road) => {
        const bend = road.url.includes("bend");
        return (
          <RigidBody
            key={road.position.join(":")}
            type="fixed"
            colliders={false}
            position={road.position}
            rotation={road.rotation}
          >
            <ConvexHullCollider
              args={[roadHull(road.scale[0], road.scale[2], bend)]}
              friction={1.2}
              collisionGroups={interactionGroups([0], [1])}
            />
          </RigidBody>
        );
      })}
      <RigidBody type="fixed" colliders={false} position={[PARKING.x, 0, PARKING.z]}>
        <ConvexHullCollider
          args={[deckHull(LOT_LENGTH, LOT_WIDTH, ROAD_RISE)]}
          friction={1.2}
          collisionGroups={interactionGroups([0], [1])}
        />
        {[1, -1].map((dir) => (
          <CuboidCollider
            key={`z${dir}`}
            args={[(LOT_LENGTH + CURB_WIDTH * 2) / 2, CURB_HEIGHT / 2, CURB_WIDTH / 2]}
            position={[0, CURB_HEIGHT / 2, (LOT_WIDTH / 2 + CURB_WIDTH / 2) * dir]}
            friction={0.4}
            collisionGroups={interactionGroups([0], [1])}
          />
        ))}
        {[1, -1].map((dir) => (
          <CuboidCollider
            key={`x${dir}`}
            args={[CURB_WIDTH / 2, CURB_HEIGHT / 2, LOT_WIDTH / 2]}
            position={[(LOT_LENGTH / 2 + CURB_WIDTH / 2) * dir, CURB_HEIGHT / 2, 0]}
            friction={0.4}
            collisionGroups={interactionGroups([0], [1])}
          />
        ))}
      </RigidBody>
      {BUILDINGS.map((building) => (
        <RigidBody
          key={building.url + building.position.join(":")}
          type="fixed"
          colliders={false}
          position={[building.position[0], building.half[1], building.position[2]]}
        >
          <CuboidCollider args={building.half} friction={0.3} collisionGroups={interactionGroups([2], [1])} />
        </RigidBody>
      ))}
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

export function CityScene() {
  return (
    <group>
      {ROADS.map((road, index) => (
        <group key={`${road.url}:${index}`} position={road.position} rotation={road.rotation}>
          <StaticModel url={road.url} position={[0, 0, 0]} scale={road.scale} />
          {road.url.includes("straight") ? <RoadRamps length={road.scale[0]} width={road.scale[2]} /> : null}
        </group>
      ))}
      {ARROWS.map((arrow, index) => (
        <RoadChevrons key={index} position={arrow.position} yaw={arrow.yaw} />
      ))}
      {BUILDINGS.map((building) => (
        <StaticModel key={building.url + building.position.join(":")} url={building.url} position={building.position} scale={building.scale} outline />
      ))}
      <FloorText
        lines={["Двигайтесь дальше, чтобы узнать больше обо мне"]}
        position={[4.2, 0.04, -5.45]}
        width={16}
        height={1.7}
        fitted
      />
      <GroundControls position={[14.8, 0.04, 8.6]} width={9.6} height={4.62} />
      <GroundCopy
        title=""
        lines={["Привет, я Черных Артём", "Middle Frontend-разработчик", "React / Next.js / TypeScript"]}
        position={[1.5, 0.04, 8.6]}
        width={11}
        height={6}
      />
      <Host />
      <Parking />
      <GroundCopy
        title="Образование"
        lines={["МИСиС, Старый Оскол, 2023", "Информационные системы и технологии", "Английский — C1"]}
        position={[-66, 0.04, 10]}
        width={12}
        height={6.4}
      />
      <GroundCopy
        title="ИндевЛабс"
        lines={["март 2022 — август 2024", "JWT, 2FA и роли", "TypeScript, 200+ файлов", "Таблицы и платежи на фронте"]}
        position={[-64, 0.04, 63]}
        width={12}
        height={7}
      />
      <GroundCopy
        title="Бизнесмакет"
        lines={["июнь 2023 — декабрь 2025", "Свет, звук и видео по WebSocket", "Redux и PostgreSQL", "Экраны под сенсор"]}
        position={[-36, 0.04, 63]}
        width={12}
        height={7}
      />
      <GroundCopy
        title="Пушкин"
        lines={["август 2024 — август 2026", "Ведущий разработчик", "Загрузка 3 с → 1,2 с", "UI-kit, LMS, CI/CD"]}
        position={[-8, 0.04, 63]}
        width={12}
        height={7}
      />
      <GroundCopy
        title="Контакты"
        lines={["+7 980 392-42-61", "@ArtemChernykh001", "artemchernykh001@yandex.ru", "Реутов · офис, гибрид, удалённо"]}
        position={[18, 0.04, 62]}
        width={12}
        height={7}
      />
    </group>
  );
}
