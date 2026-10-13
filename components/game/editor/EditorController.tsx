"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3, type Object3D } from "three";
import type { MapEntity } from "../city/map-types";

const ELEVATION = (58 * Math.PI) / 180;

export type EditorView = { x: number; z: number };
export type EditorFocus = { token: number; x: number; z: number };

function mapIdOf(object: Object3D | null) {
  let current: Object3D | null = object;
  while (current) {
    const id = current.userData.mapId;
    if (typeof id === "string") return id;
    current = current.parent;
  }
  return null;
}

export function EditorController({
  active,
  entities,
  onSelect,
  onMove,
  onMoveEnd,
  viewRef,
  focus,
}: {
  active: boolean;
  entities: MapEntity[];
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
  onMoveEnd: () => void;
  viewRef: RefObject<EditorView>;
  focus: EditorFocus | null;
}) {
  "use no memo";
  const { camera, gl, scene } = useThree();
  const frame = useRef({ x: 0, z: 0, distance: 40, ready: false });
  const entitiesRef = useRef(entities);
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onMove);
  const onMoveEndRef = useRef(onMoveEnd);
  entitiesRef.current = entities;
  onSelectRef.current = onSelect;
  onMoveRef.current = onMove;
  onMoveEndRef.current = onMoveEnd;

  const ndc = useMemo(() => new Vector2(), []);
  const raycaster = useMemo(() => new Raycaster(), []);
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const hitPoint = useMemo(() => new Vector3(), []);

  const apply = () => {
    const { x, z, distance } = frame.current;
    const height = Math.sin(ELEVATION) * distance;
    const back = Math.cos(ELEVATION) * distance;
    camera.position.set(x, height, z - back);
    camera.lookAt(x, 0, z);
    viewRef.current.x = x;
    viewRef.current.z = z;
  };

  useFrame(() => {
    if (!active) {
      frame.current.ready = false;
      return;
    }
    if (!frame.current.ready) {
      const distance = Math.min(140, Math.max(16, camera.position.y / Math.sin(ELEVATION)));
      const back = Math.cos(ELEVATION) * distance;
      frame.current = { x: camera.position.x, z: camera.position.z + back, distance, ready: true };
    }
    apply();
  });

  useEffect(() => {
    if (!active || !focus) return;
    frame.current.x = focus.x;
    frame.current.z = focus.z;
    frame.current.ready = true;
  }, [active, focus]);

  useEffect(() => {
    if (!active) return;
    const canvas = gl.domElement;

    const aim = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
    };

    const groundAt = (y: number) => {
      plane.constant = -y;
      return raycaster.ray.intersectPlane(plane, hitPoint) ? hitPoint.clone() : null;
    };

    type Drag =
      | { kind: "move"; id: string; y: number; dx: number; dz: number }
      | { kind: "pan"; x: number; z: number };
    let drag: Drag | null = null;

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      aim(event);
      const hits = raycaster.intersectObjects(scene.children, true);
      const id = hits[0] ? mapIdOf(hits[0].object) : null;
      if (id) {
        const entity = entitiesRef.current.find((item) => item.id === id);
        onSelectRef.current(id);
        const point = entity ? groundAt(entity.position[1]) : null;
        if (entity && point) {
          drag = {
            kind: "move",
            id,
            y: entity.position[1],
            dx: entity.position[0] - point.x,
            dz: entity.position[2] - point.z,
          };
        }
        return;
      }
      onSelectRef.current(null);
      const point = groundAt(0);
      if (point) drag = { kind: "pan", x: point.x, z: point.z };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return;
      aim(event);
      if (drag.kind === "move") {
        const point = groundAt(drag.y);
        if (!point) return;
        onMoveRef.current(drag.id, point.x + drag.dx, point.z + drag.dz);
        return;
      }
      const point = groundAt(0);
      if (!point) return;
      frame.current.x += drag.x - point.x;
      frame.current.z += drag.z - point.z;
      const { x, z, distance } = frame.current;
      camera.position.set(x, Math.sin(ELEVATION) * distance, z - Math.cos(ELEVATION) * distance);
      camera.lookAt(x, 0, z);
      const next = groundAt(0);
      if (next) drag = { kind: "pan", x: next.x, z: next.z };
    };

    const onUp = () => {
      if (drag?.kind === "move") onMoveEndRef.current();
      drag = null;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1.08 : 0.92;
      frame.current.distance = Math.min(140, Math.max(14, frame.current.distance * factor));
      frame.current.ready = true;
    };

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [active, camera, gl, scene, ndc, raycaster, plane, hitPoint]);

  return null;
}
