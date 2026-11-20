import { defineConfig } from "prisma/config";
import fs from "node:fs";
import path from "node:path";

// Prisma 7 tidak memuat .env otomatis — muat manual.
try {
  const envPath = path.resolve(process.cwd(), ".env");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    process.env[m[1]] ??= value;
  }
} catch {
  // .env tidak ada — andalkan environment asli
}

const url =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/aiviso";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url },
});
