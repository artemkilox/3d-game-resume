"use client";

/* The vehicle loop writes forces, steering, and wheel quaternions every tick. */
/* eslint-disable react-hooks/immutability */

import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  CuboidCollider,
  RigidBody,
  interactionGroups,
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { DynamicRayCastVehicleController } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { WHEEL_ORDER, type CarConfig } from "./cars";
import type { Input } from "./input";
import { heightAt, SPAWN } from "./terrain";

const WHEEL_RADIUS = 0.3;
const SUSPENSION_REST = 0.18;
const MAX_SPEED = 13;
const MAX_REVERSE = 6;
const ENGINE = 48;
const MAX_STEER = 0.48;
const WHEEL_GROUPS = interactionGroups([1], [0]);
const OBSTACLE_GROUPS = interactionGroups([1], [2]);
const UP = new THREE.Vector3(0, 1, 0);
const AXLE = new THREE.Vector3(1, 0, 0);
const steerQuat = new THREE.Quaternion();
const spinQuat = new THREE.Quaternion();
const bodyQuat = new THREE.Quaternion();
const bodyEuler = new THREE.Euler(0, 0, 0, "YXZ");

const wheelIndex: Record<string, number> = {
  "wheel-front-left": 0,
  "wheel-front-right": 1,
  "wheel-back-left": 2,
  "wheel-back-right": 3,
};

function CarModel({
  url,
  vehicleRef,
  skidSpin,
}: {
  url: string;
  vehicleRef: RefObject<DynamicRayCastVehicleController | null>;
  skidSpin: RefObject<number>;
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
    const vehicle = vehicleRef.current;
    for (const wheel of wheels.current) {
      const index = wheelIndex[wheel.name];
      if (index === undefined) continue;
      const spin = (vehicle?.wheelRotation(index) ?? 0) + skidSpin.current;
      const steer = wheel.name.includes("front") ? (vehicle?.wheelSteering(index) ?? 0) : 0;
      steerQuat.setFromAxisAngle(UP, steer);
      spinQuat.setFromAxisAngle(AXLE, spin);
      wheel.quaternion.copy(steerQuat).multiply(spinQuat);
    }
  });

  return <primitive object={model} />;
}

function createVehicle(
  world: ReturnType<typeof useRapier>["world"],
  rapier: ReturnType<typeof useRapier>["rapier"],
  chassis: RapierRigidBody,
  car: CarConfig,
) {
  const vehicle = world.createVehicleController(chassis);
  vehicle.indexUpAxis = 1;
  vehicle.setIndexForwardAxis = 2;

  const direction = new rapier.Vector3(0, -1, 0);
  const axle = new rapier.Vector3(-1, 0, 0);
  for (const name of WHEEL_ORDER) {
    const [x, y, z] = car.wheels[name];
    vehicle.addWheel(
      new rapier.Vector3(x, y + SUSPENSION_REST, z),
      direction,
      axle,
      SUSPENSION_REST,
      WHEEL_RADIUS,
    );
  }

  for (let i = 0; i < vehicle.numWheels(); i += 1) {
    vehicle.setWheelSuspensionStiffness(i, 32);
    vehicle.setWheelSuspensionCompression(i, 4.2);
    vehicle.setWheelSuspensionRelaxation(i, 3.4);
    vehicle.setWheelMaxSuspensionTravel(i, 0.28);
    vehicle.setWheelMaxSuspensionForce(i, 5000);
    vehicle.setWheelFrictionSlip(i, 3.2);
    vehicle.setWheelSideFrictionStiffness(i, 0.8);
  }

  return vehicle;
}

function obstacleAhead(
  world: ReturnType<typeof useRapier>["world"],
  chassis: RapierRigidBody,
  dirX: number,
  dirZ: number,
) {
  const collider = chassis.collider(0);
  if (!collider) return null;
  return world.castShape(
    chassis.translation(),
    chassis.rotation(),
    { x: dirX, y: 0, z: dirZ },
    collider.shape,
    0.08,
    0.7,
    true,
    undefined,
    OBSTACLE_GROUPS,
    undefined,
    chassis,
  );
}

function VehicleSimulation({
  car,
  input,
  groundRef,
  bodyRef,
  vehicleRef,
  skidSpin,
}: {
  car: CarConfig;
  input: RefObject<Input | null>;
  groundRef: RefObject<THREE.Mesh | null>;
  bodyRef: RefObject<RapierRigidBody | null>;
  vehicleRef: RefObject<DynamicRayCastVehicleController | null>;
  skidSpin: RefObject<number>;
}) {
  "use no memo";
  const { world, rapier } = useRapier();
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const steerState = useRef(0);

  useEffect(() => {
    return () => {
      const vehicle = vehicleRef.current;
      if (vehicle) world.removeVehicleController(vehicle);
      vehicleRef.current = null;
    };
  }, [vehicleRef, world]);

  useBeforePhysicsStep(() => {
    const chassis = bodyRef.current;
    const keys = input.current;
    if (!chassis || !keys) return;
    if (!vehicleRef.current) vehicleRef.current = createVehicle(world, rapier, chassis, car);
    const vehicle = vehicleRef.current;

    const dt = 1 / 60;
    const rotation = chassis.rotation();
    bodyQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);
    bodyEuler.setFromQuaternion(bodyQuat, "YXZ");
    const yaw = bodyEuler.y;
    const position = chassis.translation();
    const velocity = chassis.linvel();
    const speed = velocity.x * Math.sin(yaw) + velocity.z * Math.cos(yaw);

    let throttle = 0;
    if (keys.forward) throttle += 1;
    if (keys.back) throttle -= 1;

    let targetSteer = 0;
    if (keys.left) targetSteer += 1;
    if (keys.right) targetSteer -= 1;

    if (keys.pointer && targetSteer === 0 && groundRef.current) {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((keys.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((keys.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const point = raycaster.intersectObject(groundRef.current, false)[0]?.point;
      if (point) {
        hit.copy(point);
        const dx = hit.x - position.x;
        const dz = hit.z - position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 1.6) {
          if (!keys.back) throttle = Math.max(throttle, 1);
          const desired = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw));
          targetSteer = THREE.MathUtils.clamp(diff / 0.45, -1, 1);
        }
      }
    }

    steerState.current = THREE.MathUtils.damp(steerState.current, targetSteer, 12, dt);
    const steerAngle = steerState.current * MAX_STEER;
    vehicle.setWheelSteering(0, steerAngle);
    vehicle.setWheelSteering(1, steerAngle);

    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const castSign = throttle < 0 || speed < -0.35 ? -1 : 1;
    const obstacle = obstacleAhead(world, chassis, forwardX * castSign, forwardZ * castSign);
    const blocked = !!obstacle && obstacle.time_of_impact < 0.28;

    const skid = blocked && castSign > 0 && throttle > 0;
    let force = 0;
    let brake = 0.35;
    const reversing = (throttle > 0 && speed < -0.4) || (throttle < 0 && speed > 0.4);
    if (skid) {
      brake = 0;
    } else if (reversing) {
      brake = 1.8;
    } else if (throttle > 0 && speed < MAX_SPEED && !blocked) {
      force = ENGINE;
      brake = 0;
    } else if (throttle < 0 && speed > -MAX_REVERSE) {
      force = -ENGINE * 0.55;
      brake = 0;
    } else if (throttle === 0) {
      brake = 0.7;
    }

    vehicle.setWheelEngineForce(0, force * 0.65);
    vehicle.setWheelEngineForce(1, force * 0.65);
    vehicle.setWheelEngineForce(2, force);
    vehicle.setWheelEngineForce(3, force);
    for (let i = 0; i < vehicle.numWheels(); i += 1) vehicle.setWheelBrake(i, brake);

    vehicle.updateVehicle(dt, undefined, WHEEL_GROUPS, (collider) => {
      return collider.parent()?.handle !== chassis.handle;
    });

    if (blocked) {
      const vel = chassis.linvel();
      const along = vel.x * forwardX * castSign + vel.z * forwardZ * castSign;
      if (along > 0) {
        chassis.setLinvel(
          { x: vel.x - forwardX * castSign * along, y: vel.y, z: vel.z - forwardZ * castSign * along },
          true,
        );
      }
    }

    if (skid) {
      skidSpin.current += 16 * dt;
      const ang = chassis.angvel();
      chassis.setAngvel({ x: ang.x * 0.25, y: steerState.current * 1.6, z: ang.z * 0.25 }, true);
    }
  });

  return null;
}

export function Vehicle({
  car,
  input,
  groundRef,
  carRef,
}: {
  car: CarConfig;
  input: RefObject<Input | null>;
  groundRef: RefObject<THREE.Mesh | null>;
  carRef: RefObject<THREE.Group | null>;
}) {
  "use no memo";
  const vehicleRef = useRef<DynamicRayCastVehicleController | null>(null);
  const skidSpin = useRef(0);
  const bodyRef = useRef<RapierRigidBody>(null);
  const spawnY = heightAt(SPAWN.x, SPAWN.z) + 0.45;

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      position={[SPAWN.x, spawnY, SPAWN.z]}
      canSleep={false}
      ccd
      linearDamping={0.15}
      angularDamping={2.2}
    >
      <CuboidCollider
        args={car.chassis.half}
        position={car.chassis.center}
        mass={10}
        friction={0.7}
        restitution={0}
        collisionGroups={interactionGroups([1], [0, 2])}
      />
      <VehicleSimulation
        car={car}
        input={input}
        groundRef={groundRef}
        bodyRef={bodyRef}
        vehicleRef={vehicleRef}
        skidSpin={skidSpin}
      />
      <group ref={carRef}>
        <Suspense fallback={null}>
          <CarModel url={car.url} vehicleRef={vehicleRef} skidSpin={skidSpin} />
        </Suspense>
      </group>
    </RigidBody>
  );
}
