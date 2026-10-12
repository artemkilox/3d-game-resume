"use client";

import { useEffect, useRef, type RefObject } from "react";
import { MAP_CENTER, MAP_EXTENT, ROAD_POLYLINE } from "./city/layout";

export type CarPose = { x: number; z: number; yaw: number };

const PLACES = [
  { x: 12, z: 2, label: "Старт" },
  { x: -30, z: 14, label: "Стек" },
  { x: -66, z: 16, label: "Учёба" },
  { x: -64, z: 68, label: "1" },
  { x: -36, z: 68, label: "2" },
  { x: -8, z: 68, label: "3" },
  { x: 20, z: 62, label: "Связь" },
];

function project(x: number, z: number) {
  return {
    x: 50 - ((x - MAP_CENTER.x) / MAP_EXTENT) * 50,
    y: 50 - ((z - MAP_CENTER.z) / MAP_EXTENT) * 50,
  };
}

export function Minimap({ poseRef }: { poseRef: RefObject<CarPose> }) {
  const carRef = useRef<HTMLDivElement>(null);
  const road = ROAD_POLYLINE.map(([x, z]) => project(x, z));
  const roadPath = road.map((point) => `${point.x},${point.y}`).join(" ");

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const car = carRef.current;
      const pose = poseRef.current;
      if (car && pose) {
        const point = project(pose.x, pose.z);
        car.style.left = `${point.x}%`;
        car.style.top = `${point.y}%`;
        car.style.transform = `translate(-50%, -50%) rotate(${-pose.yaw}rad)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [poseRef]);

  return (
    <div className="pointer-events-none absolute bottom-4 left-4">
      <div
        className="relative h-44 w-44 overflow-hidden rounded-full border-2 border-stone-900/70 bg-[#e3923a] shadow-lg"
        aria-label="Миникарта"
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <polyline points={roadPath} fill="none" stroke="#5e646c" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {PLACES.map((place) => {
          const point = project(place.x, place.z);
          return (
            <span
              key={place.label}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] font-semibold text-stone-900"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              {place.label}
            </span>
          );
        })}
        <span className="absolute top-[9%] left-1/2 -translate-x-1/2 text-[10px] font-semibold text-stone-900/80">
          N
        </span>
        <div ref={carRef} className="absolute h-4 w-3">
          <svg viewBox="0 0 12 16" className="h-full w-full drop-shadow">
            <polygon points="6,0 12,16 6,11 0,16" fill="#e23b2f" stroke="#171717" strokeWidth="1.2" />
          </svg>
        </div>
      </div>
    </div>
  );
}
