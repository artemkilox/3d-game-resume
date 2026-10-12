"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

function paintSign(title: string, lines: string[], width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(16, 16, width - 32, height - 32, 36);
  ctx.fillStyle = "rgba(255, 252, 245, 0.94)";
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#171717";
  ctx.stroke();

  ctx.fillStyle = "#171717";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = width - 120;
  const fit = (text: string, size: number, weight: string) => {
    let next = size;
    ctx.font = `${weight} ${next}px Segoe UI, sans-serif`;
    while (next > 28 && ctx.measureText(text).width > maxWidth) {
      next -= 2;
      ctx.font = `${weight} ${next}px Segoe UI, sans-serif`;
    }
  };
  fit(title, 68, "700");
  ctx.fillText(title, width / 2, 100);
  lines.forEach((line, index) => {
    fit(line, 42, "600");
    ctx.fillText(line, width / 2, 190 + index * 58);
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function paintGround(title: string, lines: string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1024, 640);
  ctx.fillStyle = "#171717";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const count = 1 + lines.length;
  const gap = 640 / (count + 0.35);
  const top = (640 - gap * (count - 1)) / 2;
  const fit = (text: string, size: number, weight: string) => {
    let next = size;
    ctx.font = `${weight} ${next}px Segoe UI, sans-serif`;
    while (next > 28 && ctx.measureText(text).width > 980) {
      next -= 2;
      ctx.font = `${weight} ${next}px Segoe UI, sans-serif`;
    }
  };
  fit(title, 108, "800");
  ctx.fillText(title, 512, top);
  lines.forEach((line, index) => {
    fit(line, 64, "650");
    ctx.fillText(line, 512, top + (index + 1) * gap);
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function GroundCopy({
  title,
  lines,
  position,
  width = 10,
  height = 6,
}: {
  title: string;
  lines: string[];
  position: [number, number, number];
  width?: number;
  height?: number;
}) {
  const body = lines.join("\n");
  const texture = useMemo(() => paintGround(title, body.split("\n")), [title, body]);

  useEffect(() => {
    return () => texture?.dispose();
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, Math.PI]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function paintGroundControls() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1024, 720);
  ctx.fillStyle = "#171717";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 78px Segoe UI, sans-serif";
  ctx.fillText("Управление", 512, 80);

  const key = (x: number, y: number, label: string) => {
    ctx.beginPath();
    ctx.roundRect(x, y, 120, 90, 16);
    ctx.fillStyle = "#171717";
    ctx.fill();
    ctx.fillStyle = "#fffdf8";
    ctx.font = "700 54px Segoe UI, sans-serif";
    ctx.fillText(label, x + 60, y + 48);
  };

  key(392, 150, "↑");
  key(260, 260, "←");
  key(392, 260, "↓");
  key(524, 260, "→");

  ctx.beginPath();
  ctx.roundRect(720, 160, 140, 200, 26);
  ctx.fillStyle = "#171717";
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(792, 174, 54, 112, 12);
  ctx.fillStyle = "#e23b2f";
  ctx.fill();

  ctx.fillStyle = "#171717";
  ctx.font = "650 40px Segoe UI, sans-serif";
  ctx.fillText("правая кнопка — ехать к курсору", 512, 460);
  ctx.font = "600 36px Segoe UI, sans-serif";
  ctx.fillText("стрелки: газ, поворот, назад", 512, 530);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function GroundControls({
  position,
  width = 8,
  height = 5.6,
}: {
  position: [number, number, number];
  width?: number;
  height?: number;
}) {
  const texture = useMemo(() => paintGroundControls(), []);

  useEffect(() => {
    return () => texture?.dispose();
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, Math.PI]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

export function Board({
  title,
  lines,
  position,
  width = 6.4,
  height = 3.6,
}: {
  title: string;
  lines: string[];
  position: [number, number, number];
  width?: number;
  height?: number;
}) {
  const body = lines.join("\n");
  const texture = useMemo(
    () => paintSign(title, body.split("\n"), 1024, Math.round(1024 * (height / width))),
    [title, body, width, height],
  );

  useEffect(() => {
    return () => texture?.dispose();
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh position={[position[0], height / 2 + 0.2, position[2]]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function paintFloor(lines: string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1024, 512);
  ctx.fillStyle = "#171717";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gap = lines.length === 1 ? 0 : 150;
  const start = 256 - ((lines.length - 1) * gap) / 2;
  lines.forEach((line, index) => {
    let size = index === 0 ? (lines.length === 1 ? 220 : 120) : 72;
    ctx.font = `${index === 0 ? "800" : "650"} ${size}px Segoe UI, sans-serif`;
    while (size > 36 && ctx.measureText(line).width > 980) {
      size -= 4;
      ctx.font = `${index === 0 ? "800" : "650"} ${size}px Segoe UI, sans-serif`;
    }
    ctx.fillText(line, 512, start + index * gap);
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function FloorText({
  lines,
  position,
  width = 10,
  height = 5,
}: {
  lines: string[];
  position: [number, number, number];
  width?: number;
  height?: number;
}) {
  const body = lines.join("\n");
  const texture = useMemo(() => paintFloor(body.split("\n")), [body]);

  useEffect(() => {
    return () => texture?.dispose();
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, Math.PI]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function paintControls() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, 1024, 720);
  ctx.beginPath();
  ctx.roundRect(16, 16, 992, 688, 40);
  ctx.fillStyle = "rgba(255, 252, 245, 0.94)";
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#171717";
  ctx.stroke();

  ctx.fillStyle = "#171717";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 78px Segoe UI, sans-serif";
  ctx.fillText("Управление", 512, 100);

  const key = (x: number, y: number, label: string) => {
    ctx.beginPath();
    ctx.roundRect(x, y, 120, 90, 16);
    ctx.fillStyle = "#171717";
    ctx.fill();
    ctx.fillStyle = "#fffdf8";
    ctx.font = "700 54px Segoe UI, sans-serif";
    ctx.fillText(label, x + 60, y + 48);
  };

  key(452, 180, "↑");
  key(320, 290, "←");
  key(452, 290, "↓");
  key(584, 290, "→");

  ctx.beginPath();
  ctx.roundRect(700, 200, 150, 210, 28);
  ctx.fillStyle = "#171717";
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(778, 214, 58, 120, 12);
  ctx.fillStyle = "#e23b2f";
  ctx.fill();
  ctx.fillStyle = "#171717";
  ctx.font = "600 40px Segoe UI, sans-serif";
  ctx.fillText("правая кнопка", 512, 470);
  ctx.fillText("ехать к курсору", 512, 530);
  ctx.font = "500 34px Segoe UI, sans-serif";
  ctx.fillText("стрелки: газ, поворот, назад", 512, 610);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function ControlsBoard({ position }: { position: [number, number, number] }) {
  const texture = useMemo(() => paintControls(), []);
  const width = 4.2;
  const height = 2.95;

  useEffect(() => {
    return () => texture?.dispose();
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh position={[position[0], height / 2 + 0.2, position[2]]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}
