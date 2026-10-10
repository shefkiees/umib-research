import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { getAbsoluteUrlEnvValue } from "./urlConfig.js";

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function parseAuthUrl(value) {
  try { return new URL(value); }
  catch { throw new Error("Authentication URLs are invalid."); }
}

export function getAuthConfig(env = process.env) {
  const production = env.NODE_ENV === "production" || Boolean(env.VERCEL);
  const maxAge = Number(env.SESSION_MAX_AGE_MS || SEVEN_DAYS_MS);
  if (!Number.isSafeInteger(maxAge) || maxAge <= 0 || maxAge > SEVEN_DAYS_MS) {
    throw new Error("SESSION_MAX_AGE_MS must be positive and at most seven days.");
  }
  const secret = env.SESSION_SECRET || (production ? "" : randomBytes(32).toString("hex"));
  if (production && secret.trim().length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production.");
  }
  const callbackUrl = getAbsoluteUrlEnvValue(env.GOOGLE_CALLBACK_URL);
  const clientUrl = getAbsoluteUrlEnvValue(env.CLIENT_URL)
    || (callbackUrl ? parseAuthUrl(callbackUrl).origin : "")
    || (production ? "" : "http://localhost:5173");
  if (!clientUrl) throw new Error("CLIENT_URL or GOOGLE_CALLBACK_URL is required in production.");
  const googleCallbackUrl = callbackUrl || (production
    ? `${parseAuthUrl(clientUrl).origin}/api/auth/google/callback`
    : "http://localhost:5000/api/auth/google/callback");
  for (const value of [clientUrl, googleCallbackUrl]) {
    const url = parseAuthUrl(value);
    if (url.username || url.password || url.search || url.hash || (production && url.protocol !== "https:")) {
      throw new Error("Authentication URLs must be trusted HTTP(S) URLs, using HTTPS in production.");
    }
  }
  const configuredProxy = env.TRUSTED_PROXY;
  if (production && !env.VERCEL && !configuredProxy) {
    throw new Error("TRUSTED_PROXY must identify the HTTPS reverse proxy in production outside Vercel.");
  }
  const trustedProxy = configuredProxy
    ? configuredProxy.split(",").map((value) => value.trim()).filter(Boolean)
    : (env.VERCEL ? 1 : false);
  if (Array.isArray(trustedProxy)) {
    if (!trustedProxy.length) throw new Error("TRUSTED_PROXY must identify at least one trusted proxy.");
    for (const address of trustedProxy) {
      const [ip, prefix, extra] = address.split("/");
      const version = isIP(ip);
      const alias = ["loopback", "linklocal", "uniquelocal"].includes(address);
      if (!alias && (!version || extra !== undefined || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128))))) {
        throw new Error("TRUSTED_PROXY must contain trusted IP addresses, CIDRs or Express proxy aliases; trust-all is forbidden.");
      }
    }
  }
  return {
    production, secret, maxAge, clientUrl, googleCallbackUrl, trustedProxy,
    cookie: { httpOnly: true, secure: production, sameSite: production && parseAuthUrl(clientUrl).origin !== parseAuthUrl(googleCallbackUrl).origin ? "none" : "lax", path: "/", maxAge },
  };
}

export function enforceSessionLifetime(maxAge) {
  return (req, res, next) => {
    if (!req.session || (!req.session.passport?.user && !req.session.authExpiresAt)) return next();
    const startedAt = req.session.authenticatedAt;
    const storedDeadline = req.session.authExpiresAt;
    const validStart = Number.isSafeInteger(startedAt) && startedAt > 0 && startedAt <= Date.now();
    const validDeadline = Number.isSafeInteger(storedDeadline) && storedDeadline > 0;
    // Legacy cookies cannot establish when authentication actually happened.
    const deadline = validDeadline
      ? Math.min(storedDeadline, validStart ? startedAt + maxAge : Infinity)
      : (validStart ? startedAt + maxAge : NaN);
    if (!Number.isFinite(deadline) || deadline <= Date.now() || deadline > Date.now() + maxAge) {
      return req.session.regenerate((error) => {
        if (error) return next(error);
        res.clearCookie("connect.sid", { path: "/" });
        next();
      });
    }
    req.session.authExpiresAt = Math.min(deadline, Date.now() + maxAge);
    req.session.cookie.maxAge = req.session.authExpiresAt - Date.now();
    next();
  };
}

export function redirectAuthenticatedUser(req, res, clientUrl, dashboards) {
  if (!req.isAuthenticated?.() || !req.user?.id || req.user.status !== "active") return false;
  const route = dashboards[req.user.role];
  if (!route) {
    res.status(403).json({ error: "unsupported_role" });
    return true;
  }
  res.redirect(`${clientUrl}${route}`);
  return true;
}
