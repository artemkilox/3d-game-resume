export type Vec3 = [number, number, number];

type Base = {
  id: string;
  name: string;
  position: Vec3;
  /** Radians around the vertical axis. */
  rotationY: number;
  /** Higher layers are drawn above lower ones. */
  layer?: number;
};

export type ModelEntity = Base & {
  kind: "model";
  url: string;
  scale: number;
  outline: boolean;
  collider: "none" | "building";
  /** Half extents of the obstacle box. Y is measured up from the feet. */
  half?: Vec3;
  /** Painted on the billboard face. */
  label?: string;
};

export type RoadEntity = Base & {
  kind: "road";
  url: string;
  scale: Vec3;
  ramps: boolean;
  bend: boolean;
};

export const TEXT_COLORS = {
  black: "#171717",
  white: "#ffffff",
  gray: "#8d8d8d",
} as const;

export type TextColor = keyof typeof TEXT_COLORS;

export type TextEntity = Base & {
  kind: "text";
  variant: "floor" | "copy";
  title: string;
  lines: string[];
  width: number;
  height: number;
  fitted?: boolean;
  balanced?: boolean;
  color?: TextColor;
};

export type ControlsEntity = Base & {
  kind: "controls";
  width: number;
  height: number;
};

export type ChevronEntity = Base & {
  kind: "chevron";
};

export type CharacterEntity = Base & {
  kind: "character";
  scale: number;
};

export type DeckEntity = Base & {
  kind: "deck";
  length: number;
  width: number;
};

export type CurbEntity = Base & {
  kind: "curb";
  size: Vec3;
};

export type IslandEntity = Base & {
  kind: "island";
  lines: string[];
};

export type DriftEntity = Base & {
  kind: "drift";
};

export type MapEntity =
  | ModelEntity
  | RoadEntity
  | TextEntity
  | ControlsEntity
  | ChevronEntity
  | CharacterEntity
  | DeckEntity
  | CurbEntity
  | IslandEntity
  | DriftEntity;

export type MapFile = {
  version: 1;
  entities: MapEntity[];
};
