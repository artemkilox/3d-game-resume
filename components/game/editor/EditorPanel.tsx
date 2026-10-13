"use client";

import { useEffect, useMemo, useState } from "react";
import { TEXT_COLORS, type MapEntity, type TextColor } from "../city/map-types";

function degrees(radians: number) {
  return Math.round((radians * 180) / Math.PI);
}

export function EditorPanel({
  entities,
  selectedId,
  models,
  status,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
  onAddModel,
  onAddText,
  onAddRoad,
  onSave,
  onFocus,
  onClose,
  onUndo,
  onCopy,
  onPaste,
}: {
  entities: MapEntity[];
  selectedId: string | null;
  models: string[];
  status: string;
  onSelect: (id: string | null) => void;
  onChange: (entity: MapEntity) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddModel: (url: string) => void;
  onAddText: () => void;
  onAddRoad: (bend: boolean) => void;
  onSave: () => void;
  onFocus: (id: string) => void;
  onClose: () => void;
  onUndo: () => void;
  onCopy: () => void;
  onPaste: () => void;
}) {
  const selected = entities.find((entity) => entity.id === selectedId) ?? null;
  const [query, setQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entities;
    return entities.filter((entity) => entity.name.toLowerCase().includes(needle));
  }, [entities, query]);
  const modelChoices = useMemo(() => {
    const needle = modelQuery.trim().toLowerCase();
    return models.filter((url) => url.toLowerCase().includes(needle));
  }, [models, modelQuery]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyZ" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        onUndo();
        return;
      }
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && !typing) {
        if (event.code === "KeyC") {
          event.preventDefault();
          onCopy();
          return;
        }
        if (event.code === "KeyV") {
          event.preventDefault();
          onPaste();
          return;
        }
      }
      if (typing) return;
      if (event.code === "Escape") {
        if (selected) onSelect(null);
        else onClose();
        return;
      }
      if (!selected) return;
      if (event.code === "KeyQ") onChange({ ...selected, rotationY: selected.rotationY + Math.PI / 12 });
      if (event.code === "KeyE") onChange({ ...selected, rotationY: selected.rotationY - Math.PI / 12 });
      if (event.code === "Delete") onDelete(selected.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onChange, onDelete, onSelect, onClose, onUndo, onCopy, onPaste]);

  return (
    <aside className="pointer-events-auto absolute inset-y-0 right-0 z-10 flex w-80 flex-col gap-3 overflow-auto bg-white/95 p-4 text-sm text-stone-800 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Редактор карты</h2>
        <button type="button" className="rounded-full px-3 py-1 hover:bg-stone-100" onClick={onClose}>
          Закрыть
        </button>
      </div>
      <p className="leading-5 text-stone-500">
        Тяни объект левой кнопкой. Пустое место двигает камеру. Колёсико приближает. Q и E крутят. Ctrl+C копирует, Ctrl+V вставляет, Ctrl+Z отменяет.
      </p>
      <button type="button" className="rounded-full bg-stone-900 px-4 py-2 text-white" onClick={onSave}>
        Сохранить JSON
      </button>
      {status ? <p className="text-stone-600">{status}</p> : null}

      {selected ? (
        <SelectedFields
          entity={selected}
          onChange={onChange}
          onDelete={() => onDelete(selected.id)}
          onDuplicate={() => onDuplicate(selected.id)}
        />
      ) : (
        <p className="text-stone-500">Ничего не выбрано.</p>
      )}

      <div className="flex gap-2">
        <button type="button" className="rounded-full bg-stone-100 px-3 py-1" onClick={onAddText}>
          Текст
        </button>
        <button type="button" className="rounded-full bg-stone-100 px-3 py-1" onClick={() => onAddRoad(false)}>
          Дорога
        </button>
        <button type="button" className="rounded-full bg-stone-100 px-3 py-1" onClick={() => onAddRoad(true)}>
          Поворот
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-stone-500">Поставить модель</span>
        <input
          value={modelQuery}
          onChange={(event) => setModelQuery(event.target.value)}
          placeholder="поиск glb"
          className="mb-2 w-full rounded-xl border border-stone-200 px-3 py-2"
        />
        <div className="max-h-36 overflow-auto rounded-xl border border-stone-200">
          {modelChoices.map((url) => (
            <button
              key={url}
              type="button"
              className="block w-full truncate px-3 py-1.5 text-left hover:bg-stone-100"
              onClick={() => onAddModel(url)}
            >
              {url.replace("/models/", "")}
            </button>
          ))}
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-stone-500">Объекты на карте</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="поиск"
          className="mb-2 w-full rounded-xl border border-stone-200 px-3 py-2"
        />
      </label>
      <ul className="flex flex-col">
        {visible.map((entity) => (
          <li key={entity.id} className="flex items-center gap-2">
            <button
              type="button"
              className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-left ${
                entity.id === selectedId ? "bg-stone-900 text-white" : "hover:bg-stone-100"
              }`}
              onClick={() => onSelect(entity.id)}
            >
              {entity.name}
            </button>
            <button type="button" className="text-stone-500 hover:text-stone-900" onClick={() => onFocus(entity.id)}>
              к нему
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SelectedFields({
  entity,
  onChange,
  onDelete,
  onDuplicate,
}: {
  entity: MapEntity;
  onChange: (entity: MapEntity) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const setPosition = (axis: 0 | 1 | 2, value: number) => {
    const position: [number, number, number] = [...entity.position];
    position[axis] = value;
    onChange({ ...entity, position });
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-stone-50 p-3">
      <p className="font-medium">{entity.name}</p>
      <p className="text-stone-500">Поворот {degrees(entity.rotationY)}°</p>
      <div className="flex items-center gap-2">
        <span className="text-stone-500">Слой {entity.layer ?? 0}</span>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1"
          onClick={() => onChange({ ...entity, layer: Math.max(0, (entity.layer ?? 0) - 1) })}
        >
          Ниже
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1"
          onClick={() => onChange({ ...entity, layer: Math.min(12, (entity.layer ?? 0) + 1) })}
        >
          Выше
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1"
          onClick={() => onChange({ ...entity, rotationY: entity.rotationY + Math.PI / 12 })}
        >
          Q +15°
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1"
          onClick={() => onChange({ ...entity, rotationY: entity.rotationY - Math.PI / 12 })}
        >
          E −15°
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="X" value={entity.position[0]} onChange={(value) => setPosition(0, value)} />
        <NumberField label="Y" value={entity.position[1]} onChange={(value) => setPosition(1, value)} />
        <NumberField label="Z" value={entity.position[2]} onChange={(value) => setPosition(2, value)} />
      </div>
      {entity.kind === "model" || entity.kind === "character" ? (
        <NumberField label="Масштаб" value={entity.scale} onChange={(scale) => onChange({ ...entity, scale })} />
      ) : null}
      {entity.kind === "model" ? (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={entity.outline}
            onChange={(event) => onChange({ ...entity, outline: event.target.checked })}
          />
          Чёрный контур
        </label>
      ) : null}
      {entity.kind === "road" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Длина"
            value={entity.scale[0]}
            onChange={(length) => onChange({ ...entity, scale: [length, entity.scale[1], entity.scale[2]] })}
          />
          <NumberField
            label="Ширина"
            value={entity.scale[2]}
            onChange={(width) => onChange({ ...entity, scale: [entity.scale[0], entity.scale[1], width] })}
          />
        </div>
      ) : null}
      {entity.kind === "deck" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Длина" value={entity.length} onChange={(length) => onChange({ ...entity, length })} />
          <NumberField label="Ширина" value={entity.width} onChange={(width) => onChange({ ...entity, width })} />
        </div>
      ) : null}
      {entity.kind === "curb" ? (
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="Ширина"
            value={entity.size[0]}
            onChange={(value) => onChange({ ...entity, size: [value, entity.size[1], entity.size[2]] })}
          />
          <NumberField
            label="Высота"
            value={entity.size[1]}
            onChange={(value) => onChange({ ...entity, size: [entity.size[0], value, entity.size[2]] })}
          />
          <NumberField
            label="Глубина"
            value={entity.size[2]}
            onChange={(value) => onChange({ ...entity, size: [entity.size[0], entity.size[1], value] })}
          />
        </div>
      ) : null}
      {entity.kind === "text" || entity.kind === "controls" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Ширина" value={entity.width} onChange={(width) => onChange({ ...entity, width })} />
          <NumberField label="Высота" value={entity.height} onChange={(height) => onChange({ ...entity, height })} />
        </div>
      ) : null}
      {entity.kind === "model" &&
      (entity.url.includes("billboard") || entity.url.toLowerCase().includes("sign")) ? (
        <label className="block">
          Надпись
          <input
            value={entity.label ?? ""}
            onChange={(event) => onChange({ ...entity, label: event.target.value })}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
      ) : null}
      {entity.kind === "model" ? (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={entity.collider === "building"}
            onChange={(event) =>
              onChange({ ...entity, collider: event.target.checked ? "building" : "none", half: undefined })
            }
          />
          Препятствие для машины
        </label>
      ) : null}
      {entity.kind === "text" ? <TextFields entity={entity} onChange={onChange} /> : null}
      {entity.kind === "island" ? (
        <label className="block">
          Строки
          <textarea
            value={entity.lines.join("\n")}
            onChange={(event) =>
              onChange({ ...entity, lines: event.target.value.split("\n"), name: event.target.value.split("\n")[0] || entity.name })
            }
            rows={3}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
      ) : null}
      <div className="flex gap-2">
        {entity.kind === "character" ? null : (
          <button type="button" className="rounded-full bg-white px-3 py-1" onClick={onDuplicate}>
            Дублировать
          </button>
        )}
        <button type="button" className="rounded-full bg-white px-3 py-1 text-red-700" onClick={onDelete}>
          Удалить
        </button>
      </div>
    </div>
  );
}

function TextFields({
  entity,
  onChange,
}: {
  entity: Extract<MapEntity, { kind: "text" }>;
  onChange: (entity: MapEntity) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-stone-500">Цвет</span>
        {(Object.keys(TEXT_COLORS) as TextColor[]).map((name) => {
          const active = (entity.color ?? "black") === name;
          const label = { black: "Чёрный", white: "Белый", gray: "Серый" }[name];
          return (
            <button
              key={name}
              type="button"
              aria-label={label}
              title={label}
              className={`h-7 w-7 rounded-full border border-stone-300 ${active ? "ring-2 ring-stone-900 ring-offset-2" : ""}`}
              style={{ background: TEXT_COLORS[name] }}
              onClick={() => onChange({ ...entity, color: name })}
            />
          );
        })}
      </div>
      <label className="block">
        Заголовок
        <input
          value={entity.title}
          onChange={(event) => onChange({ ...entity, title: event.target.value, name: event.target.value || entity.name })}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="block">
        Строки
        <textarea
          value={entity.lines.join("\n")}
          onChange={(event) => onChange({ ...entity, lines: event.target.value.split("\n") })}
          rows={4}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
        />
      </label>
    </>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      {label}
      <input
        type="number"
        step="0.1"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
      />
    </label>
  );
}
