import "../config/env.js";
import { getAuthConfig } from "../config/authSession.js";

try {
  const config = getAuthConfig({ ...process.env, NODE_ENV: "production", ...(process.argv.includes("--vercel") ? { VERCEL: "1" } : {}) });
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for Google login.");
  }
  if (!process.env.CLIENT_URL || !process.env.GOOGLE_CALLBACK_URL) {
    throw new Error("Set explicit CLIENT_URL and GOOGLE_CALLBACK_URL before production rollout.");
  }
  console.log("PASS: production auth configuration is structurally valid; no secret values printed.");
  console.log(`Session limit: ${config.maxAge === 604800000 ? "7 days" : "less than 7 days"}; secure cookies enabled.`);
  console.log("Verify callback registration, trusted proxy header sanitization and real Google login in the target environment.");
} catch (error) {
  // Only controlled validation messages may be printed; URL/parser errors can contain input values.
  const safeMessage = /^(SESSION_|CLIENT_URL or|Authentication URLs|TRUSTED_PROXY|GOOGLE_CLIENT_ID|Set explicit)/.test(error.message)
    ? error.message : "Invalid authentication URL or configuration.";
  console.error(`FAIL: ${safeMessage}`);
  process.exitCode = 1;
}
