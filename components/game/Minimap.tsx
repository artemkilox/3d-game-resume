"use client";

import { useEffect, useRef, type RefObject } from "react";
import { HILLS, OASES } from "./terrain";
import { POIS } from "./pois";

export type CarPose = { x: number; z: number; yaw: number };

const MAP = 176;
const EXTENT = 78;

function spot(x: number, z: number) {
  return {
    left: `${50 - (x / EXTENT) * 50}%`,
    top: `${50 - (z / EXTENT) * 50}%`,
  };
}

function diameter(worldRadius: number) {
  return `${(worldRadius / EXTENT) * 100}%`;
}

export function Minimap({ poseRef }: { poseRef: RefObject<CarPose> }) {
  const worldRef = useRef<HTMLDivElement>(null);
  const northRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const world = worldRef.current;
      const north = northRef.current;
      const pose = poseRef.current;
      if (world && pose) {
        const scale = MAP / (2 * EXTENT);
        const carX = MAP / 2 - pose.x * scale;
        const carY = MAP / 2 - pose.z * scale;
        world.style.transformOrigin = "0 0";
        world.style.transform = `translate(${MAP / 2}px, ${MAP / 2}px) rotate(${pose.yaw}rad) translate(${-carX}px, ${-carY}px)`;
      }
      if (north && pose) {
        const ahead = Math.cos(pose.yaw);
        const right = Math.sin(pose.yaw);
        north.style.left = `${50 + right * 42}%`;
        north.style.top = `${50 - ahead * 42}%`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [poseRef]);

  return (
    <div className="pointer-events-none absolute bottom-4 left-4">
      <div
        className="relative overflow-hidden rounded-full border-2 border-stone-900/70 bg-[#e3923a] shadow-lg"
        style={{ width: MAP, height: MAP }}
        aria-label="Миникарта"
      >
        <div ref={worldRef} className="absolute inset-0">
          {HILLS.map((hill) => (
            <span
              key={`${hill.x}:${hill.z}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f6c84a]/80"
              style={{ ...spot(hill.x, hill.z), width: diameter(hill.sigma * 2.2), height: diameter(hill.sigma * 2.2) }}
            />
          ))}
          {OASES.map((oasis) => (
            <span key={`${oasis.x}:${oasis.z}`}>
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2f8f3a]"
                style={{
                  ...spot(oasis.x, oasis.z),
                  width: diameter(oasis.groundRadius),
                  height: diameter(oasis.groundRadius),
                }}
              />
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2a8f9e]"
                style={{
                  ...spot(oasis.x, oasis.z),
                  width: diameter(oasis.waterRadius),
                  height: diameter(oasis.waterRadius),
                }}
              />
            </span>
          ))}
          {POIS.map((poi) => (
            <span
              key={poi.id}
              title={poi.label}
              className="absolute grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-stone-900 bg-white text-[9px] font-semibold leading-none text-stone-900"
              style={spot(poi.x, poi.z)}
            >
              {poi.id}
            </span>
          ))}
        </div>
        <span
          ref={northRef}
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold text-stone-900/80"
        >
          N
        </span>
        <div className="absolute top-1/2 left-1/2 h-4 w-3 -translate-x-1/2 -translate-y-1/2">
          <svg viewBox="0 0 12 16" className="h-full w-full drop-shadow">
            <polygon points="6,0 12,16 6,11 0,16" fill="#e23b2f" stroke="#171717" strokeWidth="1.2" />
          </svg>
        </div>
      </div>
    </div>
  );
}
