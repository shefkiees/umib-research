import "../config/env.js";

import db from "../config/db.js";
import { syncMissingSupabaseAuthUsers } from "../services/supabaseAuthSync.service.js";

function hasFlag(name) {
  return process.argv.includes(name);
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));

  return arg ? arg.slice(prefix.length) : "";
}

async function main() {
  const dryRun = !hasFlag("--apply");
  const mode = getArgValue("--mode") || "invite";
  const rolesArg = getArgValue("--roles");
  const roles = rolesArg ? rolesArg.split(",").map((role) => role.trim()).filter(Boolean) : undefined;

  const summary = await syncMissingSupabaseAuthUsers({
    dryRun,
    mode,
    roles,
  });

  console.log(JSON.stringify({
    dryRun: summary.dryRun,
    mode: summary.mode,
    redirectTo: summary.redirectTo,
    scanned: summary.scanned,
    created: summary.created,
    skipped: summary.skipped,
    failed: summary.failed,
    results: summary.results,
  }, null, 2));
}

main().catch((error) => {
  console.error("Supabase Auth sync failed:", {
    message: error?.message,
    code: error?.code,
    status: error?.status,
  });
  process.exitCode = 1;
}).finally(async () => {
  await db.end().catch(() => {});
});
