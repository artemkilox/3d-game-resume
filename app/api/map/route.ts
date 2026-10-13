import { readFile, writeFile } from "fs/promises";
import path from "path";
import { createDefaultMap } from "@/components/game/city/default-map";
import type { MapFile } from "@/components/game/city/map-types";

const file = path.join(process.cwd(), "public", "map.json");

export async function GET() {
  try {
    const text = await readFile(file, "utf8");
    return Response.json(JSON.parse(text) as MapFile);
  } catch {
    const map = createDefaultMap();
    await writeFile(file, JSON.stringify(map, null, 2));
    return Response.json(map);
  }
}

export async function PUT(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Карта сохраняется только в локальном сервере." }, { status: 403 });
  }
  const body = (await request.json()) as MapFile;
  if (!body || body.version !== 1 || !Array.isArray(body.entities)) {
    return Response.json({ error: "Некорректный файл карты." }, { status: 400 });
  }
  await writeFile(file, JSON.stringify(body, null, 2));
  return Response.json({ ok: true });
}
