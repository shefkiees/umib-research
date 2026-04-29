import "../config/env.js";

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import db, { checkDbConnection } from "../config/db.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../db/schema.sql");

async function applySchema() {
  const connected = await checkDbConnection();

  if (!connected) {
    process.exitCode = 1;
    return;
  }

  const schema = await readFile(schemaPath, "utf8");
  await db.query(schema);
  await db.end();

  console.log("Database schema applied.");
}

applySchema().catch(async (error) => {
  console.error("Applying database schema failed:", error);
  await db.end().catch(() => {});
  process.exitCode = 1;
});
