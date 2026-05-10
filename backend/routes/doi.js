import express from "express";
import db from "../config/db.js";
import {
  DoiLookupError,
  getVerifiedDoiMetadata,
  isValidDoi,
  normalizeDoi,
} from "../services/doiMetadata.service.js";

const router = express.Router();
const DOI_LOOKUP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DOI_LOOKUP_RATE_LIMIT_MAX = 30;
const doiLookupRateLimits = new Map();

function getRateLimitKey(req) {
  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
}

function checkRateLimit(req) {
  const now = Date.now();
  const key = getRateLimitKey(req);
  const existing = doiLookupRateLimits.get(key) || [];
  const recent = existing.filter((timestamp) => now - timestamp < DOI_LOOKUP_RATE_LIMIT_WINDOW_MS);

  if (recent.length >= DOI_LOOKUP_RATE_LIMIT_MAX) {
    doiLookupRateLimits.set(key, recent);
    return {
      limited: true,
      retryAfterMs: DOI_LOOKUP_RATE_LIMIT_WINDOW_MS - (now - recent[0]),
    };
  }

  recent.push(now);
  doiLookupRateLimits.set(key, recent);

  if (doiLookupRateLimits.size > 1000) {
    for (const [entryKey, timestamps] of doiLookupRateLimits.entries()) {
      const active = timestamps.filter((timestamp) => now - timestamp < DOI_LOOKUP_RATE_LIMIT_WINDOW_MS);

      if (active.length) {
        doiLookupRateLimits.set(entryKey, active);
      } else {
        doiLookupRateLimits.delete(entryKey);
      }
    }
  }

  return { limited: false, retryAfterMs: 0 };
}

function sendDoiError(res, status, error, message) {
  res.status(status).json({ error, message });
}

router.get("/:doi", async (req, res) => {
  const rateLimit = checkRateLimit(req);

  if (rateLimit.limited) {
    const retryAfterSeconds = Math.max(Math.ceil(rateLimit.retryAfterMs / 1000), 1);
    res.set("Retry-After", String(retryAfterSeconds));
    sendDoiError(res, 429, "rate_limited", "Keni bere shume kerkesa per DOI. Provoni perseri me vone.");
    return;
  }

  const doi = normalizeDoi(req.params.doi);

  if (!doi || !isValidDoi(doi)) {
    sendDoiError(res, 400, "invalid_doi", "DOI nuk eshte valid.");
    return;
  }

  try {
    const { source, metadata } = await getVerifiedDoiMetadata(db, doi);
    res.json({ source, data: metadata });
  } catch (error) {
    if (error instanceof DoiLookupError) {
      sendDoiError(res, error.status, error.code, error.message);
      return;
    }

    console.error("GET /api/doi/:doi failed:", error);
    sendDoiError(res, 500, "doi_lookup_failed", "Metadata per kete DOI nuk mund te merret tani.");
  }
});

export default router;
