"use client";

/* Frame loop mutates positions, wheel rotations, and scratch vectors on purpose. */
/* eslint-disable react-hooks/immutability */

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CARS, type CarId } from "./cars";

const WHEEL_RADIUS = 0.3;
const MAX_SPEED = 16;
const MAX_REVERSE = 7;
const ACCEL = 22;
const BRAKE = 30;
const FRICTION = 12;
const TURN_RATE = 2.5;
const CAMERA_HEIGHT = 7;
const CAMERA_BACK = 10;
const CAMERA_LOOK_AHEAD = 2.5;
const UP = new THREE.Vector3(0, 1, 0);

type Input = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  pointer: boolean;
  clientX: number;
  clientY: number;
};

type DriveState = {
  yaw: number;
  speed: number;
  steer: number;
  wheelSpin: number;
};

for (const car of CARS) {
  useGLTF.preload(car.url);
}

function useDriveInput(input: RefObject<Input>) {
  useEffect(() => {
    const state = input.current;
    if (!state) return;

    const setKey = (event: KeyboardEvent, down: boolean) => {
      switch (event.code) {
        case "ArrowUp":
          state.forward = down;
          event.preventDefault();
          break;
        case "ArrowDown":
          state.back = down;
          event.preventDefault();
          break;
        case "ArrowLeft":
          state.left = down;
          event.preventDefault();
          break;
        case "ArrowRight":
          state.right = down;
          event.preventDefault();
          break;
        default:
          break;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => setKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => setKey(event, false);
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 2) state.pointer = true;
      state.clientX = event.clientX;
      state.clientY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.button === 2) state.pointer = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      state.clientX = event.clientX;
      state.clientY = event.clientY;
    };
    const onContextMenu = (event: Event) => event.preventDefault();
    const clear = () => {
      state.forward = false;
      state.back = false;
      state.left = false;
      state.right = false;
      state.pointer = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("blur", clear);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("blur", clear);
    };
  }, [input]);
}

function CarModel({
  url,
  drive,
}: {
  url: string;
  drive: RefObject<DriveState>;
}) {
  "use no memo";
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);
  const wheels = useRef<THREE.Object3D[]>([]);

  useEffect(() => {
    const found: THREE.Object3D[] = [];
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
      }
      if (obj.name.startsWith("wheel-")) found.push(obj);
    });
    wheels.current = found;
  }, [model]);

  useFrame(() => {
    const spin = drive.current?.wheelSpin ?? 0;
    const steer = drive.current?.steer ?? 0;
    for (const wheel of wheels.current) {
      wheel.rotation.x = spin;
      wheel.rotation.y = wheel.name.includes("front") ? steer * 0.4 : 0;
    }
  });

  return <primitive object={model} />;
}

function Drive({
  carRef,
  input,
  drive,
}: {
  carRef: RefObject<THREE.Group | null>;
  input: RefObject<Input | null>;
  drive: RefObject<DriveState>;
}) {
  "use no memo";
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const ground = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const car = carRef.current;
    const keys = input.current;
    const state = drive.current;
    if (!car || !keys || !state) return;

    const dt = Math.min(delta, 0.05);
    let throttle = 0;
    if (keys.forward) throttle += 1;
    if (keys.back) throttle -= 1;

    let steer = 0;
    if (keys.left) steer += 1;
    if (keys.right) steer -= 1;

    if (keys.pointer) {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((keys.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((keys.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const point = raycaster.ray.intersectPlane(ground, hit);
      if (point) {
        const dx = point.x - car.position.x;
        const dz = point.z - car.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1.4) {
          if (!keys.back) throttle = Math.max(throttle, 1);
          if (steer === 0) {
            const desired = Math.atan2(dx, dz);
            const diff = Math.atan2(
              Math.sin(desired - state.yaw),
              Math.cos(desired - state.yaw),
            );
            steer = THREE.MathUtils.clamp(diff * 2.8, -1, 1);
          }
        }
      }
    }

    if (throttle > 0) state.speed = Math.min(MAX_SPEED, state.speed + ACCEL * dt);
    else if (throttle < 0) state.speed = Math.max(-MAX_REVERSE, state.speed - BRAKE * dt);
    else state.speed = THREE.MathUtils.damp(state.speed, 0, FRICTION, dt);

    if (Math.abs(state.speed) > 0.2) {
      const grip = THREE.MathUtils.clamp(Math.abs(state.speed) / 6, 0.35, 1);
      state.yaw += steer * TURN_RATE * dt * Math.sign(state.speed) * grip;
    }

    state.steer = steer;
    car.position.x += Math.sin(state.yaw) * state.speed * dt;
    car.position.z += Math.cos(state.yaw) * state.speed * dt;
    car.rotation.y = state.yaw;
    state.wheelSpin += (state.speed * dt) / WHEEL_RADIUS;
  });

  return null;
}

function FollowCamera({
  carRef,
  drive,
}: {
  carRef: RefObject<THREE.Group | null>;
  drive: RefObject<DriveState>;
}) {
  "use no memo";
  const { camera } = useThree();
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const car = carRef.current;
    const state = drive.current;
    if (!car || !state) return;

    desired.set(0, CAMERA_HEIGHT, -CAMERA_BACK).applyAxisAngle(UP, state.yaw).add(car.position);
    const k = 1 - Math.exp(-5 * Math.min(delta, 0.05));
    camera.position.lerp(desired, k);
    look.set(
      car.position.x + Math.sin(state.yaw) * CAMERA_LOOK_AHEAD,
      0,
      car.position.z + Math.cos(state.yaw) * CAMERA_LOOK_AHEAD,
    );
    camera.lookAt(look);
  });

  return null;
}

function FollowLight({ carRef }: { carRef: RefObject<THREE.Group | null> }) {
  "use no memo";
  const light = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    const car = carRef.current;
    const sun = light.current;
    if (!car || !sun) return;
    sun.position.set(car.position.x + 12, 18, car.position.z + 6);
    sun.target.position.set(car.position.x, 0, car.position.z);
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
      shadow-camera-left={-16}
      shadow-camera-right={16}
      shadow-camera-top={16}
      shadow-camera-bottom={-16}
    />
  );
}

function Scene({ url }: { url: string }) {
  "use no memo";
  const carRef = useRef<THREE.Group>(null);
  const input = useRef<Input>({
    forward: false,
    back: false,
    left: false,
    right: false,
    pointer: false,
    clientX: 0,
    clientY: 0,
  });
  const drive = useRef<DriveState>({
    yaw: 0,
    speed: 0,
    steer: 0,
    wheelSpin: 0,
  });

  useDriveInput(input);

  return (
    <>
      <color attach="background" args={["#f6e2b8"]} />
      <fog attach="fog" args={["#f6e2b8", 30, 110]} />
      <hemisphereLight args={["#fff6df", "#c9a56a", 0.75]} />
      <ambientLight intensity={0.2} />
      <FollowLight carRef={carRef} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#e6c27a" roughness={1} metalness={0} />
      </mesh>
      <group ref={carRef}>
        <Suspense fallback={null}>
          <CarModel key={url} url={url} drive={drive} />
        </Suspense>
      </group>
      <Drive carRef={carRef} input={input} drive={drive} />
      <FollowCamera carRef={carRef} drive={drive} />
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
    <div
      className="relative h-full w-full"
      onContextMenu={(event) => event.preventDefault()}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          fov: 38,
          near: 0.1,
          far: 250,
          position: [0, CAMERA_HEIGHT, -CAMERA_BACK],
        }}
      >
        <Scene url={car.url} />
      </Canvas>
      <Hud carId={carId} onSelect={setCarId} />
    </div>
  );
}
