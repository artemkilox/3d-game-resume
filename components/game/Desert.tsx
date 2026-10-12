"use client";

import { useEffect, useMemo, type RefObject } from "react";
import { interactionGroups, useRapier } from "@react-three/rapier";
import type { Mesh } from "three";
import { createDesertGeometry, geometryToTrimesh } from "./terrain";

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

export function Desert({ groundRef }: { groundRef: RefObject<Mesh | null> }) {
  "use no memo";
  const geometry = useMemo(() => createDesertGeometry(), []);
  useTerrainCollider(geometry);

  return (
    <mesh ref={groundRef} geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
