"use client";

import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { TEXT_COLORS, type TextColor } from "./map-types";

function inkOf(color?: TextColor) {
  return TEXT_COLORS[color ?? "black"];
}

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

function paintGround(title: string, lines: string[], color?: TextColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1024, 640);
  ctx.fillStyle = inkOf(color);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const hasTitle = title.trim().length > 0;
  const count = (hasTitle ? 1 : 0) + lines.length;
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
  if (hasTitle) {
    fit(title, 108, "800");
    ctx.fillText(title, 512, top);
  }
  lines.forEach((line, index) => {
    fit(line, hasTitle ? 64 : 78, "650");
    ctx.fillText(line, 512, top + (hasTitle ? index + 1 : index) * gap);
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
  color,
}: {
  title: string;
  lines: string[];
  position: [number, number, number];
  width?: number;
  height?: number;
  color?: TextColor;
}) {
  const body = lines.join("\n");
  const texture = useMemo(() => paintGround(title, body.split("\n"), color), [title, body, color]);

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

const CONTROLS_INK = "rgba(23, 23, 23, 0.8)";

function paintGroundControls(icon: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = 1040;
  canvas.height = 500;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "middle";

  const keyW = 150;
  const keyH = 108;
  const gap = 14;
  const iconH = 230;
  const iconW = iconH * (300 / 448);
  const caption = "ПКМ - ехать к курсору";
  ctx.font = "600 40px Segoe UI, sans-serif";
  const captionW = ctx.measureText(caption).width;

  const keysW = keyW * 3 + gap * 2;
  const left = 56;
  const keysRight = left + keysW;
  const iconCenter = keysRight + 28 + captionW / 2;
  const iconX = iconCenter - iconW / 2;
  const iconY = 128;
  const captionY = iconY + iconH + 42;
  const bottomY = captionY - keyH / 2;
  const topY = bottomY - 16 - keyH;
  const midX = left + keyW + gap;
  const contentRight = Math.max(iconX + iconW, iconCenter + captionW / 2);
  const contentCenter = (left + contentRight) / 2;

  ctx.fillStyle = "#171717";
  ctx.textAlign = "center";
  ctx.font = "600 64px Segoe UI, sans-serif";
  ctx.fillText("Управление", contentCenter, 68);

  const key = (x: number, y: number, label: string) => {
    ctx.beginPath();
    ctx.roundRect(x, y, keyW, keyH, 18);
    ctx.fillStyle = CONTROLS_INK;
    ctx.fill();
    ctx.fillStyle = "#fffdf8";
    ctx.font = "700 58px Segoe UI, sans-serif";
    ctx.fillText(label, x + keyW / 2, y + keyH / 2 + 2);
  };
  key(midX, topY, "↑");
  key(left, bottomY, "←");
  key(midX, bottomY, "↓");
  key(midX + keyW + gap, bottomY, "→");

  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.drawImage(icon, 106, 32, 300, 448, iconX, iconY, iconW, iconH);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#171717";
  ctx.font = "600 40px Segoe UI, sans-serif";
  ctx.fillText(caption, iconCenter, captionY);

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
  const [texture, setTexture] = useState<CanvasTexture | null>(null);

  useEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      setTexture(paintGroundControls(image));
    };
    image.src = "/controls/right-click.png";
    return () => {
      active = false;
    };
  }, []);

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

function paintFloor(lines: string[], aspect?: number, balanced = false, color?: TextColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = aspect ? Math.max(72, Math.round(1024 / aspect)) : 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = inkOf(color);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gap = lines.length === 1 ? 0 : balanced ? canvas.height * 0.42 : canvas.height / (lines.length + 0.5);
  const start = canvas.height / 2 - ((lines.length - 1) * gap) / 2;
  const maxWidth = canvas.width - 48;
  lines.forEach((line, index) => {
    const lead = index === 0 || balanced;
    let size =
      lines.length === 1
        ? Math.round(canvas.height * 0.78)
        : balanced
          ? Math.round(canvas.height * 0.34)
          : lead
            ? Math.round(canvas.height * 0.34)
            : Math.round(canvas.height * 0.22);
    ctx.font = `${lead ? "800" : "650"} ${size}px Segoe UI, sans-serif`;
    while (size > 28 && ctx.measureText(line).width > maxWidth) {
      size -= 2;
      ctx.font = `${lead ? "800" : "650"} ${size}px Segoe UI, sans-serif`;
    }
    ctx.fillText(line, canvas.width / 2, start + index * gap);
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
  fitted = false,
  balanced = false,
  color,
}: {
  lines: string[];
  position: [number, number, number];
  width?: number;
  height?: number;
  /** Draw the canvas at the plane's aspect so letters are not squashed. */
  fitted?: boolean;
  /** Give every line the same size. Used when a skill name is split in two. */
  balanced?: boolean;
  color?: TextColor;
}) {
  const body = lines.join("\n");
  const texture = useMemo(
    () => paintFloor(body.split("\n"), fitted ? width / height : undefined, balanced, color),
    [body, fitted, balanced, width, height, color],
  );

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
