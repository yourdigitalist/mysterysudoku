import { readFileSync } from "node:fs";

export interface ThemeFootprint {
  w: number;
  h: number;
}

export interface ThemeObjectDef {
  type: string;
  label: string;
  blocking: boolean;
  emoji: string;
  color?: string;
  borderColor?: string;
  footprints: ThemeFootprint[];
  allowedFloors?: string[];
}

export interface ThemeFloorDef {
  type: string;
  color: string;
  pattern?: string;
}

export interface ThemeRoomType {
  id: string;
  floor: string;
  names: string[];
  /** Object types this room type may place, generator picks a plausible subset per room. */
  objects: string[];
}

export interface Theme {
  id: string;
  characterRoleNames: { target: string; answer: string };
  floors: ThemeFloorDef[];
  objects: ThemeObjectDef[];
  roomTypes: ThemeRoomType[];
  characterNaming: string;
  /** Themed given names per alphabet letter, e.g. characterNames.A = ["Agatha", "Adrian", ...].
   * The generator draws one per character id (docs/decisions.md: alphabetical ids, victim last). */
  characterNames: Record<string, string[]>;
  clueTemplates: Record<string, string>;
  article: string;
}

export function loadTheme(path: string): Theme {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return raw as Theme;
}

export function objectBlockingMap(theme: Theme): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const obj of theme.objects) map[obj.type] = obj.blocking;
  return map;
}

export function objectDef(theme: Theme, type: string): ThemeObjectDef {
  const def = theme.objects.find((o) => o.type === type);
  if (!def) throw new Error(`Unknown object type in theme: ${type}`);
  return def;
}
