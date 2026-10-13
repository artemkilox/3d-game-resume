import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const routes = ["app/api/map/route.ts", "app/api/models/route.ts"].map((file) => path.join(root, file));
const staticExport = 'export const dynamic = "force-static";\n\n';
const originals = new Map();

for (const file of routes) {
  const text = await readFile(file, "utf8");
  originals.set(file, text);
  if (!text.includes('export const dynamic')) await writeFile(file, staticExport + text);
}

let status = 1;
try {
  status = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, "build"], {
      cwd: root,
      env: { ...process.env, GITHUB_PAGES: "true" },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
} finally {
  for (const [file, text] of originals) await writeFile(file, text);
}

process.exit(status);
