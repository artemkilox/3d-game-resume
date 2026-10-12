"use client";

import { useEffect, useMemo } from "react";
import { Billboard } from "@react-three/drei";
import { BackSide, CanvasTexture, SRGBColorSpace } from "three";
import { POIS, type Poi } from "./pois";
import { heightAt } from "./terrain";

function makeLabelTexture(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.roundRect(16, 28, 992, 200, 52);
  ctx.fillStyle = "rgba(255, 252, 245, 0.94)";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#171717";
  ctx.stroke();
  ctx.fillStyle = "#171717";
  ctx.font = "600 84px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 4);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function Label({ text }: { text: string }) {
  const texture = useMemo(() => makeLabelTexture(text), [text]);

  useEffect(() => {
    return () => texture?.dispose();
  }, [texture]);

  if (!texture) return null;

  return (
    <Billboard position={[0, 3.2, 0]}>
      <mesh>
        <planeGeometry args={[3.6, 0.9]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

function Marker({ poi }: { poi: Poi }) {
  const y = heightAt(poi.x, poi.z);

  return (
    <group position={[poi.x, y, poi.z]}>
      <mesh rotation-x={Math.PI / 2} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.62, 0.86, 24]} />
        <meshBasicMaterial color="#171717" toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.66, 0.82, 24]} />
        <meshStandardMaterial color="#f4efe4" roughness={1} />
      </mesh>
      <mesh position={[0, 1.15, 0]} scale={[1.4, 1.012, 1.4]}>
        <cylinderGeometry args={[0.07, 0.09, 2.2, 6]} />
        <meshBasicMaterial color="#171717" side={BackSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 2.2, 6]} />
        <meshStandardMaterial color="#f7f3ea" roughness={1} />
      </mesh>
      <mesh position={[0, 2.45, 0]} scale={1.08}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshBasicMaterial color="#171717" side={BackSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.45, 0]} castShadow>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color="#e23b2f" roughness={0.45} />
      </mesh>
      <Label text={poi.label} />
    </group>
  );
}

export function Pois() {
  return (
    <group>
      {POIS.map((poi) => (
        <Marker key={poi.id} poi={poi} />
      ))}
    </group>
  );
}
