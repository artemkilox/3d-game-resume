"use client";

import { useEffect, useMemo, type RefObject } from "react";
import { CylinderCollider, RigidBody, interactionGroups, useRapier } from "@react-three/rapier";
import type { Mesh } from "three";
import {
  OASES,
  ROCKS,
  createDesertGeometry,
  geometryToTrimesh,
  heightAt,
  palmPositions,
  type Oasis,
} from "./terrain";

function useTerrainCollider(geometry: ReturnType<typeof createDesertGeometry>) {
  const { world, rapier } = useRapier();
  const data = useMemo(() => geometryToTrimesh(geometry), [geometry]);

  useEffect(() => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
    const desc = rapier.ColliderDesc.trimesh(data.vertices, data.indices);
    desc.setFriction(1.2);
    desc.setRestitution(0);
    desc.setCollisionGroups(interactionGroups([0], [1]));
    world.createCollider(desc, body);
    return () => {
      if (world.getRigidBody(body.handle)) world.removeRigidBody(body);
    };
  }, [data, rapier, world]);
}

function Palm({ position }: { position: [number, number, number] }) {
  const trunk = 2.3;
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false} position={[0, trunk / 2, 0]}>
        <CylinderCollider args={[trunk / 2, 0.22]} friction={0.9} collisionGroups={interactionGroups([2], [1])} />
      </RigidBody>
      <mesh position={[0, trunk / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, trunk, 6]} />
        <meshStandardMaterial color="#7a4b2a" roughness={1} />
      </mesh>
      <mesh position={[0, trunk + 0.2, 0]} castShadow>
        <coneGeometry args={[1.05, 1.45, 7]} />
        <meshStandardMaterial color="#2f7d45" roughness={1} />
      </mesh>
    </group>
  );
}

function OasisSpot({ oasis }: { oasis: Oasis }) {
  const palms = useMemo(() => palmPositions(oasis), [oasis]);
  const waterY = heightAt(oasis.x, oasis.z) + 0.04;

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[oasis.x, waterY, oasis.z]}>
        <circleGeometry args={[oasis.waterRadius, 28]} />
        <meshStandardMaterial color="#2a8f9e" roughness={0.2} metalness={0.05} />
      </mesh>
      {palms.map((position) => (
        <Palm key={position.join(":")} position={position} />
      ))}
    </group>
  );
}

export function Desert({ groundRef }: { groundRef: RefObject<Mesh | null> }) {
  "use no memo";
  const geometry = useMemo(() => createDesertGeometry(), []);
  useTerrainCollider(geometry);

  return (
    <group>
      <mesh ref={groundRef} geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>
      {ROCKS.map((rock) => {
        const y = heightAt(rock.x, rock.z) + rock.radius * 0.35;
        return (
          <RigidBody
            key={`${rock.x}:${rock.z}`}
            type="fixed"
            colliders={false}
            position={[rock.x, y, rock.z]}
          >
            <CylinderCollider
              args={[rock.radius, rock.radius * 0.88]}
              friction={1}
              collisionGroups={interactionGroups([2], [1])}
            />
            <mesh castShadow receiveShadow>
              <icosahedronGeometry args={[rock.radius, 0]} />
              <meshStandardMaterial color={rock.color} flatShading roughness={1} />
            </mesh>
          </RigidBody>
        );
      })}
      {OASES.map((oasis) => (
        <OasisSpot key={`${oasis.x}:${oasis.z}`} oasis={oasis} />
      ))}
    </group>
  );
}
