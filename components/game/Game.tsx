"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import { CARS, type CarId } from "./cars";
import { Desert } from "./Desert";
import { useDriveInput, type Input } from "./input";
import { Vehicle } from "./Vehicle";

const CAMERA_HEIGHT = 6.3;
const CAMERA_BACK = 10;
const CAMERA_LOOK_AHEAD = 2.5;
const UP = new THREE.Vector3(0, 1, 0);

for (const car of CARS) useGLTF.preload(car.url);

function FollowCamera({ carRef }: { carRef: RefObject<THREE.Group | null> }) {
  "use no memo";
  const { camera } = useThree();
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
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

    desired.set(0, CAMERA_HEIGHT, -CAMERA_BACK).applyAxisAngle(UP, yaw).add(worldPos);
    const k = 1 - Math.exp(-5 * Math.min(delta, 0.05));
    camera.position.lerp(desired, k);
    look.set(
      worldPos.x + Math.sin(yaw) * CAMERA_LOOK_AHEAD,
      worldPos.y,
      worldPos.z + Math.cos(yaw) * CAMERA_LOOK_AHEAD,
    );
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
      shadow-camera-far={48}
      shadow-camera-left={-18}
      shadow-camera-right={18}
      shadow-camera-top={18}
      shadow-camera-bottom={-18}
    />
  );
}

function Scene({ url }: { url: string }) {
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
      <fog attach="fog" args={["#f6e2b8", 55, 140]} />
      <hemisphereLight args={["#fff6df", "#c9a56a", 0.75]} />
      <ambientLight intensity={0.25} />
      <FollowLight carRef={carRef} />
      <Physics gravity={[0, -12, 0]} timeStep={1 / 60} colliders={false}>
        <Desert groundRef={groundRef} />
        <Vehicle key={car.id} car={car} input={input} groundRef={groundRef} carRef={carRef} />
      </Physics>
      <FollowCamera carRef={carRef} />
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

  return (
    <div className="relative h-full w-full" onContextMenu={(event) => event.preventDefault()}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          fov: 38,
          near: 0.1,
          far: 280,
          position: [SPAWN_CAMERA.x, SPAWN_CAMERA.y, SPAWN_CAMERA.z],
        }}
      >
        <Scene url={car.url} />
      </Canvas>
      <Hud carId={carId} onSelect={setCarId} />
    </div>
  );
}

const SPAWN_CAMERA = { x: 0, y: CAMERA_HEIGHT, z: -8 - CAMERA_BACK };
