import { ARROWS, BUILDINGS, PARKING, ROADS, SKILL_ISLANDS, ROAD_RISE } from "./layout";
import type { MapEntity, MapFile } from "./map-types";

const LOT_LENGTH = 48;
const LOT_WIDTH = 22;
const CURB_WIDTH = 0.38;
const CURB_HEIGHT = ROAD_RISE + 0.12;

function skillLines(label: string) {
  const words = label.split(" ");
  return words.length > 1 ? [words[0]!, words.slice(1).join(" ")] : [label];
}

function fileName(url: string) {
  const file = url.split("/").pop() ?? url;
  return file.replace(/\.glb$/i, "");
}

export function createDefaultMap(): MapFile {
  const entities: MapEntity[] = [];

  ROADS.forEach((road, index) => {
    const bend = road.url.includes("bend");
    entities.push({
      id: `road-${index}`,
      name: bend ? "Поворот" : "Дорога",
      kind: "road",
      url: road.url,
      position: [road.position[0], road.position[1], road.position[2]],
      rotationY: road.rotation[1],
      scale: [road.scale[0], road.scale[1], road.scale[2]],
      ramps: road.url.includes("straight"),
      bend,
    });
  });

  ARROWS.forEach((arrow, index) => {
    entities.push({
      id: `arrow-${index}`,
      name: "Стрелка",
      kind: "chevron",
      position: [arrow.position[0], arrow.position[1], arrow.position[2]],
      rotationY: arrow.yaw,
    });
  });

  BUILDINGS.forEach((building, index) => {
    entities.push({
      id: `building-${index}`,
      name: fileName(building.url),
      kind: "model",
      url: building.url,
      position: [building.position[0], building.position[1], building.position[2]],
      rotationY: 0,
      scale: building.scale,
      outline: true,
      collider: "building",
      half: [building.half[0], building.half[1], building.half[2]],
    });
  });

  const copy = (
    id: string,
    name: string,
    title: string,
    lines: string[],
    position: [number, number, number],
    width: number,
    height: number,
  ) => {
    entities.push({
      id,
      name,
      kind: "text",
      variant: "copy",
      title,
      lines,
      position,
      rotationY: 0,
      width,
      height,
    });
  };

  entities.push({
    id: "text-continue",
    name: "Продолжение",
    kind: "text",
    variant: "floor",
    title: "",
    lines: ["Двигайтесь дальше, чтобы узнать больше обо мне"],
    position: [4.2, 0.04, -5.45],
    rotationY: 0,
    width: 16,
    height: 1.7,
    fitted: true,
  });

  entities.push({
    id: "controls",
    name: "Управление",
    kind: "controls",
    position: [14.8, 0.04, 8.6],
    rotationY: 0,
    width: 9.6,
    height: 4.62,
  });

  copy(
    "text-about",
    "Обо мне",
    "",
    ["Привет, я Черных Артём", "Middle Frontend-разработчик", "React / Next.js / TypeScript"],
    [1.5, 0.04, 8.6],
    11,
    6,
  );
  copy(
    "text-education",
    "Образование",
    "Образование",
    ["МИСиС, Старый Оскол, 2023", "Информационные системы и технологии", "Английский — C1"],
    [-66, 0.04, 10],
    12,
    6.4,
  );
  copy(
    "text-indevlabs",
    "ИндевЛабс",
    "ИндевЛабс",
    ["март 2022 — август 2024", "JWT, 2FA и роли", "TypeScript, 200+ файлов", "Таблицы и платежи на фронте"],
    [-64, 0.04, 63],
    12,
    7,
  );
  copy(
    "text-businessmaket",
    "Бизнесмакет",
    "Бизнесмакет",
    ["июнь 2023 — декабрь 2025", "Свет, звук и видео по WebSocket", "Redux и PostgreSQL", "Экраны под сенсор"],
    [-36, 0.04, 63],
    12,
    7,
  );
  copy(
    "text-pushkin",
    "Пушкин",
    "Пушкин",
    ["август 2024 — август 2026", "Ведущий разработчик", "Загрузка 3 с → 1,2 с", "UI-kit, LMS, CI/CD"],
    [-8, 0.04, 63],
    12,
    7,
  );
  copy(
    "text-contacts",
    "Контакты",
    "Контакты",
    ["+7 980 392-42-61", "@ArtemChernykh001", "artemchernykh001@yandex.ru", "Реутов · офис, гибрид, удалённо"],
    [18, 0.04, 62],
    12,
    7,
  );

  entities.push({
    id: "character",
    name: "Персонаж",
    kind: "character",
    position: [-5.2, 0, 11.5],
    rotationY: Math.PI - 0.7,
    scale: 2.3,
  });

  entities.push({
    id: "deck",
    name: "Парковка",
    kind: "deck",
    position: [PARKING.x, 0, PARKING.z],
    rotationY: 0,
    length: LOT_LENGTH,
    width: LOT_WIDTH,
  });

  const curb = (id: string, position: [number, number, number], size: [number, number, number]) => {
    entities.push({
      id,
      name: "Бордюр",
      kind: "curb",
      position,
      rotationY: 0,
      size,
    });
  };
  const halfW = LOT_WIDTH / 2 + CURB_WIDTH / 2;
  const halfL = LOT_LENGTH / 2 + CURB_WIDTH / 2;
  curb("curb-north", [PARKING.x, CURB_HEIGHT / 2, PARKING.z + halfW], [LOT_LENGTH + CURB_WIDTH * 2, CURB_HEIGHT, CURB_WIDTH]);
  curb("curb-south", [PARKING.x, CURB_HEIGHT / 2, PARKING.z - halfW], [LOT_LENGTH + CURB_WIDTH * 2, CURB_HEIGHT, CURB_WIDTH]);
  curb("curb-east", [PARKING.x + halfL, CURB_HEIGHT / 2, PARKING.z], [CURB_WIDTH, CURB_HEIGHT, LOT_WIDTH]);
  curb("curb-west", [PARKING.x - halfL, CURB_HEIGHT / 2, PARKING.z], [CURB_WIDTH, CURB_HEIGHT, LOT_WIDTH]);

  const columns = [-16.5, -9.9, -3.3, 3.3, 9.9, 16.5];
  const rows = [-5.55, -1.85, 1.85, 5.55];
  SKILL_ISLANDS.forEach((label, index) => {
    const row = Math.floor(index / columns.length);
    const rowCount = Math.min(columns.length, SKILL_ISLANDS.length - row * columns.length);
    const rowStart = (columns.length - rowCount) / 2;
    const x = columns[rowStart + (index % columns.length)] ?? 0;
    const z = rows[row] ?? 0;
    entities.push({
      id: `island-${index}`,
      name: label,
      kind: "island",
      lines: skillLines(label),
      position: [PARKING.x + x, 0, PARKING.z + z],
      rotationY: 0,
    });
  });

  const billboardScale = 0.012;
  entities.push({
    id: "billboard",
    name: "Билборд",
    kind: "model",
    url: "/models/billboard.glb",
    position: [PARKING.x + 21, 15 * billboardScale, PARKING.z - LOT_WIDTH / 2 - 0.85],
    rotationY: Math.PI / 2,
    scale: billboardScale,
    outline: false,
    collider: "none",
    label: "Технологический стек",
  });

  entities.push({
    id: "drift",
    name: "Машины на парковке",
    kind: "drift",
    position: [PARKING.x, 0, PARKING.z],
    rotationY: 0,
  });

  return { version: 1, entities };
}
