import { readdir } from "fs/promises";
import path from "path";

async function glbFiles(dir: string, root: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return glbFiles(full, root);
      if (!entry.name.toLowerCase().endsWith(".glb")) return [];
      const relative = path.relative(root, full).split(path.sep).join("/");
      return [`/models/${relative}`];
    }),
  );
  return files.flat();
}

export async function GET() {
  const root = path.join(process.cwd(), "public", "models");
  const urls = (await glbFiles(root, root)).sort();
  return Response.json(urls);
}
