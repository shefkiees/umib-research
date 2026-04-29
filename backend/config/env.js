import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));
const candidateEnvPaths = [
  resolve(process.cwd(), ".env"),
  resolve(currentDir, "../.env"),
  resolve(currentDir, "../../.env")
];

candidateEnvPaths.forEach((envPath) => {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
});
