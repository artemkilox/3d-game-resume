"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import { CARS, type CarId } from "./cars";
import { Desert } from "./Desert";
import { Minimap, type CarPose } from "./Minimap";
import { CityColliders, CityScene } from "./city/CityMap";
import { SceneOutline } from "./Outline";
import { useDriveInput, type Input } from "./input";
import { CAMERA_ZONES } from "./city/layout";
import { SPAWN } from "./terrain";
import { Vehicle } from "./Vehicle";

const CAMERA_FOV = 32;
const ISO_ELEVATION = (30 * Math.PI) / 180;
const CAMERA_DISTANCE = 120;
const CAMERA_HEIGHT = Math.sin(ISO_ELEVATION) * CAMERA_DISTANCE;
const CAMERA_BACK = Math.cos(ISO_ELEVATION) * CAMERA_DISTANCE;

for (const car of CARS) useGLTF.preload(car.url);

function FollowCamera({
  carRef,
  poseRef,
}: {
  carRef: RefObject<THREE.Group | null>;
  poseRef: RefObject<CarPose>;
}) {
  "use no memo";
  const { camera } = useThree();
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const framed = useRef({ x: SPAWN.x, z: SPAWN.z, distance: CAMERA_DISTANCE });
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const worldQuat = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useFrame((_, delta) => {
    const car = carRef.current;
    if (!car) return;

    car.getWorldPosition(worldPos);
    car.getWorldQuaternion(worldQuat);
    euler.setFromQuaternion(worldQuat, "YXZ");
    const yaw = euler.y;
    poseRef.current.x = worldPos.x;
    poseRef.current.z = worldPos.z;
    poseRef.current.yaw = yaw;

    let focusX = worldPos.x;
    let focusZ = worldPos.z;
    let distance = CAMERA_DISTANCE;
    let pull = 0;
    for (const zone of CAMERA_ZONES) {
      const dx = worldPos.x - zone.x;
      const dz = worldPos.z - zone.z;
      const away = Math.hypot(dx, dz);
      const t = 1 - THREE.MathUtils.smoothstep(away, zone.radius * 0.4, zone.radius);
      if (t > pull) {
        pull = t;
        focusX = zone.focus[0];
        focusZ = zone.focus[1];
        const separation = Math.hypot(focusX - worldPos.x, focusZ - worldPos.z);
        const tan = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
        const halfWanted = Math.max(16, separation * 0.95);
        distance = halfWanted / tan;
      }
    }

    const aimX = worldPos.x + (focusX - worldPos.x) * pull * 0.82;
    const aimZ = worldPos.z + (focusZ - worldPos.z) * pull * 0.82;
    const aimDistance = THREE.MathUtils.lerp(CAMERA_DISTANCE, distance, pull);
    const blend = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    framed.current.x = THREE.MathUtils.lerp(framed.current.x, aimX, blend);
    framed.current.z = THREE.MathUtils.lerp(framed.current.z, aimZ, blend);
    framed.current.distance = THREE.MathUtils.lerp(framed.current.distance, aimDistance, blend);

    const height = Math.sin(ISO_ELEVATION) * framed.current.distance;
    const back = Math.cos(ISO_ELEVATION) * framed.current.distance;
    desired.set(framed.current.x, worldPos.y + height, framed.current.z - back);
    const k = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    camera.position.lerp(desired, k);
    look.set(framed.current.x, worldPos.y, framed.current.z);
    camera.lookAt(look);
  });

  return null;
}

function FollowLight({ carRef }: { carRef: RefObject<THREE.Group | null> }) {
  "use no memo";
  const light = useRef<THREE.DirectionalLight>(null);
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const car = carRef.current;
    const sun = light.current;
    if (!car || !sun) return;
    car.getWorldPosition(worldPos);
    sun.position.set(worldPos.x + 12, worldPos.y + 18, worldPos.z + 6);
    sun.target.position.set(worldPos.x, worldPos.y, worldPos.z);
    sun.target.updateMatrixWorld();
  });

  return (
    <directionalLight
      ref={light}
      intensity={1.8}
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-bias={-0.0008}
      shadow-camera-near={2}
      shadow-camera-far={90}
      shadow-camera-left={-40}
      shadow-camera-right={40}
      shadow-camera-top={40}
      shadow-camera-bottom={-40}
    />
  );
}

function Scene({ url, poseRef }: { url: string; poseRef: RefObject<CarPose> }) {
  "use no memo";
  const car = CARS.find((item) => item.url === url) ?? CARS[0];
  const carRef = useRef<THREE.Group>(null);
  const groundRef = useRef<THREE.Mesh>(null);
  const input = useRef<Input>({
    forward: false,
    back: false,
    left: false,
    right: false,
    pointer: false,
    clientX: 0,
    clientY: 0,
  });

  useDriveInput(input);

  return (
    <>
      <color attach="background" args={["#f6e2b8"]} />
      <fog attach="fog" args={["#f6e2b8", 90, 260]} />
      <hemisphereLight args={["#fff6df", "#c9a56a", 0.75]} />
      <ambientLight intensity={0.25} />
      <FollowLight carRef={carRef} />
      <Physics gravity={[0, -12, 0]} timeStep={1 / 60} colliders={false}>
        <Desert groundRef={groundRef} />
        <CityColliders />
        <Vehicle key={car.id} car={car} input={input} groundRef={groundRef} carRef={carRef} />
      </Physics>
      <CityScene />
      <FollowCamera carRef={carRef} poseRef={poseRef} />
      <SceneOutline />
    </>
  );
}

function Hud({
  carId,
  onSelect,
}: {
  carId: CarId;
  onSelect: (id: CarId) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
      <div className="pointer-events-auto flex gap-2">
        {CARS.map((car) => {
          const active = car.id === carId;
          return (
            <button
              key={car.id}
              type="button"
              onClick={() => onSelect(car.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium shadow-sm ${
                active
                  ? "bg-stone-900 text-white"
                  : "bg-white/85 text-stone-800 hover:bg-white"
              }`}
            >
              {car.label}
            </button>
          );
        })}
      </div>
      <p className="max-w-xs rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-stone-800 shadow-sm">
        Стрелки: вперёд, поворот, назад.
        <br />
        Правая кнопка мыши: ехать к курсору.
      </p>
    </div>
  );
}

export default function Game() {
  "use no memo";
  const [carId, setCarId] = useState<CarId>("race");
  const car = CARS.find((item) => item.id === carId) ?? CARS[0];
  const poseRef = useRef<CarPose>({ x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw });

  return (
    <div className="relative h-full w-full" onContextMenu={(event) => event.preventDefault()}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          fov: CAMERA_FOV,
          near: 0.5,
          far: 600,
          position: [SPAWN_CAMERA.x, SPAWN_CAMERA.y, SPAWN_CAMERA.z],
        }}
      >
        <Scene url={car.url} poseRef={poseRef} />
      </Canvas>
      <Hud carId={carId} onSelect={setCarId} />
      <Minimap poseRef={poseRef} />
    </div>
  );
}

const SPAWN_CAMERA = { x: SPAWN.x, y: CAMERA_HEIGHT, z: SPAWN.z - CAMERA_BACK };
