"use client";

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import { CARS, type CarId } from "./cars";
import { Desert } from "./Desert";
import { Minimap, type CarPose } from "./Minimap";
import { Pois } from "./Pois";
import { SceneOutline } from "./Outline";
import { useDriveInput, type Input } from "./input";
import { SPAWN } from "./terrain";
import { Vehicle } from "./Vehicle";

const ISO_ELEVATION = (48 * Math.PI) / 180;
const CAMERA_DISTANCE = 18;
const CAMERA_HEIGHT = Math.sin(ISO_ELEVATION) * CAMERA_DISTANCE;
const CAMERA_BACK = Math.cos(ISO_ELEVATION) * CAMERA_DISTANCE;
const CAMERA_LOOK_AHEAD = 0.8;
const VIEW_HEIGHT = 12;

for (const car of CARS) useGLTF.preload(car.url);

function FollowCamera({
  carRef,
  poseRef,
}: {
  carRef: RefObject<THREE.Group | null>;
  poseRef: RefObject<CarPose>;
}) {
  "use no memo";
  const { camera, size } = useThree();
  const desired = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    const ortho = camera as THREE.OrthographicCamera;
    if (!ortho.isOrthographicCamera) return;
    ortho.manual = true;
    const aspect = size.width / Math.max(size.height, 1);
    const half = VIEW_HEIGHT / 2;
    ortho.top = half;
    ortho.bottom = -half;
    ortho.left = -half * aspect;
    ortho.right = half * aspect;
    ortho.near = 0.1;
    ortho.far = 180;
    ortho.zoom = 1;
    ortho.updateProjectionMatrix();
  }, [camera, size]);
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
    poseRef.current.x = worldPos.x;
    poseRef.current.z = worldPos.z;
    poseRef.current.yaw = yaw;

    desired.set(worldPos.x, worldPos.y + CAMERA_HEIGHT, worldPos.z - CAMERA_BACK);
    const k = 1 - Math.exp(-5 * Math.min(delta, 0.05));
    camera.position.lerp(desired, k);
    look.set(worldPos.x, worldPos.y, worldPos.z + CAMERA_LOOK_AHEAD);
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
      <fog attach="fog" args={["#f6e2b8", 55, 140]} />
      <hemisphereLight args={["#fff6df", "#c9a56a", 0.75]} />
      <ambientLight intensity={0.25} />
      <FollowLight carRef={carRef} />
      <Physics gravity={[0, -12, 0]} timeStep={1 / 60} colliders={false}>
        <Desert groundRef={groundRef} />
        <Vehicle key={car.id} car={car} input={input} groundRef={groundRef} carRef={carRef} />
      </Physics>
      <Pois />
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
  const poseRef = useRef<CarPose>({ x: SPAWN.x, z: SPAWN.z, yaw: 0 });

  return (
    <div className="relative h-full w-full" onContextMenu={(event) => event.preventDefault()}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        orthographic
        camera={{
          near: 0.1,
          far: 180,
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

const SPAWN_CAMERA = { x: 0, y: CAMERA_HEIGHT, z: -8 - CAMERA_BACK };
