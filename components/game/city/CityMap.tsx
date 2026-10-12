"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { CuboidCollider, RigidBody, interactionGroups } from "@react-three/rapier";
import { CanvasTexture, DoubleSide, Shape, SRGBColorSpace, Sprite, type Group, type Material, type Mesh, type Object3D } from "three";
import { attachOutline } from "../Outline";
import { ARROWS, BUILDINGS, PARKING, ROADS, SKILL_ISLANDS, TREES } from "./layout";
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
  "/models/suburban/tree-large.glb",
  "/models/suburban/tree-small.glb",
  "/models/people/character-male-d.glb",
  "/models/sedan.glb",
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
    if (url.includes("/roads/")) {
      object.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[];
        for (const material of materials) {
          material.polygonOffset = true;
          material.polygonOffsetFactor = 1;
          material.polygonOffsetUnits = 1;
        }
      });
    }
    if (!outline) return;
    return attachOutline(object, 1.02);
  }, [object, outline, url]);

  return <primitive object={object} position={position} rotation={rotation} scale={scale} />;
}

function Host() {
  "use no memo";
  const { scene } = useGLTF("/models/people/character-male-d.glb");
  const arm = useRef<Object3D>(null);

  useLayoutEffect(() => {
    scene.traverse((obj) => {
      if (obj.name === "arm-right") arm.current = obj;
    });
    return attachOutline(scene, 1.03);
  }, [scene]);

  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.z = -1.15 + Math.sin(clock.elapsedTime * 6) * 0.45;
  });

  return <primitive object={scene} position={[-5.6, 0, 5.2]} rotation={[0, Math.PI, 0]} scale={2.3} />;
}

function loopPose(t: number) {
  const hw = 11;
  const hh = 5.6;
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
    car.position.set(pose.x, 0.02, pose.z);
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

function Parking() {
  const columns = [-9, -3, 3, 9];
  const rows = [-2.3, 2.3];

  return (
    <group position={[PARKING.x, 0, PARKING.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
        <planeGeometry args={[28, 15]} />
        <meshStandardMaterial color="#5e646c" roughness={1} />
      </mesh>
      {SKILL_ISLANDS.map((label, index) => {
        const x = columns[index % 4];
        const z = rows[Math.floor(index / 4)];
        return (
          <group key={label} position={[x, 0, z]}>
            <mesh position={[0, 0.1, 0]} receiveShadow>
              <boxGeometry args={[4.4, 0.16, 2.15]} />
              <meshStandardMaterial color="#f4efe4" roughness={1} />
            </mesh>
            <FloorText lines={[label]} position={[0, 0.2, 0]} width={4.1} height={1.85} />
          </group>
        );
      })}
      <GroundCopy title="Стек" lines={["Навыки на островках"]} position={[0, 0.05, 8.4]} width={8} height={3.2} />
      <DriftCar offset={0} />
      <DriftCar offset={0.33} />
      <DriftCar offset={0.66} />
    </group>
  );
}

export function CityColliders() {
  return (
    <group>
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
  return (
    <group position={position} rotation={[-Math.PI / 2, yaw, 0]}>
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
        <StaticModel key={`${road.url}:${index}`} url={road.url} position={road.position} rotation={road.rotation} scale={road.scale} />
      ))}
      {ARROWS.map((arrow, index) => (
        <RoadChevrons key={index} position={arrow.position} yaw={arrow.yaw} />
      ))}
      {TREES.map((tree, index) => (
        <StaticModel key={`${tree.position.join(":")}:${index}`} url={tree.url} position={tree.position} scale={tree.scale} outline />
      ))}
      {BUILDINGS.map((building) => (
        <StaticModel key={building.url + building.position.join(":")} url={building.url} position={building.position} scale={building.scale} outline />
      ))}
      <FloorText
        lines={["АРТЁМ ЧЕРНЫХ", "Frontend · React / TypeScript"]}
        position={[4.2, 0.04, -7]}
        width={14}
        height={6}
      />
      <GroundControls position={[11, 0.04, 6.2]} width={9} height={6.3} />
      <GroundCopy
        title="Обо мне"
        lines={["React / TypeScript, 3,5 года", "Middle+: скорость и realtime", "Удалённая полная занятость"]}
        position={[1.5, 0.04, 6.2]}
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
