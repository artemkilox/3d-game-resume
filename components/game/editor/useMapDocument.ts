"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ROAD_RISE, ROAD_WIDTH, TILE } from "../city/layout";
import { createDefaultMap } from "../city/default-map";
import type { MapEntity, MapFile, Vec3 } from "../city/map-types";
import type { EditorFocus, EditorView } from "./EditorController";
import { asset } from "@/lib/asset";

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function roundValue(value: unknown, key?: string): unknown {
  if (typeof value === "number") {
    const digits = key === "rotationY" || key === "scale" ? 5 : 3;
    return round(value, digits);
  }
  if (Array.isArray(value)) {
    const digits = key === "scale" ? 5 : 3;
    return value.map((item) => (typeof item === "number" ? round(item, digits) : roundValue(item)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entry]) => [entryKey, roundValue(entry, entryKey)]));
  }
  return value;
}

function createId() {
  return crypto.randomUUID();
}

type HistoryEntry = { map: MapFile; selectedId: string | null };

const HISTORY_LIMIT = 80;
const EDIT_COALESCE_MS = 700;

export function useMapDocument(viewRef: RefObject<EditorView>) {
  const [map, setMap] = useState<MapFile | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [focus, setFocus] = useState<EditorFocus | null>(null);
  const mapRef = useRef(map);
  const selectedRef = useRef(selectedId);
  const past = useRef<HistoryEntry[]>([]);
  const gesture = useRef<{ key: string; at: number } | null>(null);
  const clipboard = useRef<MapEntity | null>(null);
  const pasteStep = useRef(0);
  mapRef.current = map;
  selectedRef.current = selectedId;

  const remember = useCallback((key: string, coalesceMs: number) => {
    const now = performance.now();
    const open = gesture.current;
    if (open && open.key === key && (coalesceMs < 0 || now - open.at < coalesceMs)) {
      open.at = now;
      return;
    }
    const current = mapRef.current;
    if (!current) return;
    past.current.push({ map: structuredClone(current), selectedId: selectedRef.current });
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    gesture.current = { key, at: now };
  }, []);

  const endGesture = useCallback(() => {
    gesture.current = null;
  }, []);

  const undo = useCallback(() => {
    const entry = past.current.pop();
    if (!entry) return;
    gesture.current = null;
    setMap(entry.map);
    setSelectedId(entry.selectedId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(asset("/map.json"))
      .then((response) => {
        if (!response.ok) throw new Error("map");
        return response.json() as Promise<MapFile>;
      })
      .then((data) => {
        if (!cancelled) setMap(data);
      })
      .catch(() => {
        if (!cancelled) setMap(createDefaultMap());
      });
    if (process.env.NODE_ENV === "development") {
      fetch("/api/models")
        .then((response) => response.json() as Promise<string[]>)
        .then((urls) => {
          if (!cancelled && Array.isArray(urls)) setModels(urls);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const replace = useCallback((entity: MapEntity) => {
    remember(`edit:${entity.id}`, EDIT_COALESCE_MS);
    setMap((current) => {
      if (!current) return current;
      return {
        ...current,
        entities: current.entities.map((item) => (item.id === entity.id ? entity : item)),
      };
    });
  }, [remember]);

  const move = useCallback((id: string, x: number, z: number) => {
    const positionX = round(x, 2);
    const positionZ = round(z, 2);
    const current = mapRef.current?.entities.find((entity) => entity.id === id);
    if (current && current.position[0] === positionX && current.position[2] === positionZ) return;
    remember(`drag:${id}`, -1);
    setMap((currentMap) => {
      if (!currentMap) return currentMap;
      return {
        ...currentMap,
        entities: currentMap.entities.map((entity) => {
          if (entity.id !== id) return entity;
          const position: Vec3 = [positionX, entity.position[1], positionZ];
          return { ...entity, position };
        }),
      };
    });
  }, [remember]);

  const setHalf = useCallback((id: string, half: Vec3) => {
    const next: Vec3 = [round(half[0], 3), round(half[1], 3), round(half[2], 3)];
    setMap((current) => {
      if (!current) return current;
      return {
        ...current,
        entities: current.entities.map((entity) => {
          if (entity.id !== id || entity.kind !== "model" || entity.half) return entity;
          return { ...entity, half: next };
        }),
      };
    });
  }, []);

  const remove = useCallback((id: string) => {
    remember(`remove:${id}:${createId()}`, 0);
    setSelectedId((current) => (current === id ? null : current));
    setMap((current) => {
      if (!current) return current;
      return { ...current, entities: current.entities.filter((entity) => entity.id !== id) };
    });
  }, [remember]);

  const copySelection = useCallback(() => {
    const source = mapRef.current?.entities.find((entity) => entity.id === selectedRef.current);
    if (!source || source.kind === "character") return;
    clipboard.current = structuredClone(source);
    pasteStep.current = 0;
  }, []);

  const duplicate = useCallback(
    (id: string) => {
      const source = map?.entities.find((entity) => entity.id === id);
      if (!map || !source || source.kind === "character") return;
      remember(`duplicate:${id}:${createId()}`, 0);
      const position: Vec3 = [round(source.position[0] + 2, 2), source.position[1], source.position[2]];
      const copy: MapEntity = { ...source, id: createId(), name: `${source.name} копия`, position };
      setMap({ ...map, entities: [...map.entities, copy] });
      setSelectedId(copy.id);
    },
    [map, remember],
  );

  const insert = useCallback((entity: MapEntity) => {
    remember(`insert:${entity.id}`, 0);
    setMap((current) => {
      if (!current) return current;
      return { ...current, entities: [...current.entities, entity] };
    });
    setSelectedId(entity.id);
  }, [remember]);

  const paste = useCallback(() => {
    const source = clipboard.current;
    if (!source || source.kind === "character") return;
    pasteStep.current += 1;
    const position: Vec3 = [
      round(source.position[0] + pasteStep.current * 2, 2),
      source.position[1],
      source.position[2],
    ];
    const name = source.name.endsWith(" копия") ? source.name : `${source.name} копия`;
    insert({ ...source, id: createId(), name, position });
  }, [insert]);

  const here = useCallback(
    (y: number): Vec3 => [round(viewRef.current.x, 2), y, round(viewRef.current.z, 2)],
    [viewRef],
  );

  const addModel = useCallback(
    (url: string) => {
      const file = url.split("/").pop()?.replace(/\.glb$/i, "") ?? "Модель";
      const billboard = url.includes("billboard");
      const labeled = billboard || url.toLowerCase().includes("sign");
      insert({
        id: createId(),
        name: file,
        kind: "model",
        url,
        position: here(0),
        rotationY: 0,
        scale: billboard ? 0.012 : 1,
        outline: false,
        collider: "none",
        label: labeled ? "Текст" : undefined,
      });
    },
    [here, insert],
  );

  const addText = useCallback(() => {
    insert({
      id: createId(),
      name: "Новый текст",
      kind: "text",
      variant: "copy",
      title: "Новый текст",
      lines: ["Текст"],
      position: here(0.04),
      rotationY: 0,
      width: 10,
      height: 5,
    });
  }, [here, insert]);

  const addRoad = useCallback(
    (bend: boolean) => {
      const rise = ROAD_RISE / 0.02;
      insert(
        bend
          ? {
              id: createId(),
              name: "Поворот",
              kind: "road",
              url: "/models/roads/road-bend.glb",
              position: here(0.01),
              rotationY: 0,
              scale: [ROAD_WIDTH, rise, ROAD_WIDTH],
              ramps: false,
              bend: true,
            }
          : {
              id: createId(),
              name: "Дорога",
              kind: "road",
              url: "/models/roads/road-straight.glb",
              position: here(0),
              rotationY: 0,
              scale: [TILE, rise, ROAD_WIDTH],
              ramps: true,
              bend: false,
            },
      );
    },
    [here, insert],
  );

  const focusOn = useCallback(
    (id: string) => {
      const entity = map?.entities.find((item) => item.id === id);
      if (!entity) return;
      setSelectedId(id);
      setFocus({ token: Date.now(), x: entity.position[0], z: entity.position[2] });
    },
    [map],
  );

  const save = useCallback(async () => {
    if (!map) return;
    const rounded = roundValue(map) as MapFile;
    setStatus("Сохраняю…");
    try {
      const response = await fetch("/api/map", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rounded),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setStatus(body?.error ?? "Не удалось сохранить");
        return;
      }
      setMap(rounded);
      setStatus("Сохранено в public/map.json");
    } catch {
      setStatus("Не удалось сохранить");
    }
  }, [map]);

  return {
    map,
    models,
    selectedId,
    setSelectedId,
    status,
    focus,
    replace,
    move,
    setHalf,
    remove,
    duplicate,
    addModel,
    addText,
    addRoad,
    focusOn,
    save,
    undo,
    endGesture,
    copySelection,
    paste,
  };
}
