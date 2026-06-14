import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import db from "../config/db.js";

const router = express.Router();
const MAX_LIMIT = 50;
const EXTRACT_TIMEOUT_MS = 8000;
const EXTRACT_MAX_BYTES = 1024 * 1024;
const EXTRACT_MAX_REDIRECTS = 5;
const EXTRACT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const EXTRACT_RATE_LIMIT_MAX = 10;
const extractionRateLimits = new Map();
const VALID_CONFERENCE_STATUSES = new Set([
  "Interested",
  "Planning",
  "Submitted",
  "Accepted",
  "Attended",
  "Completed",
]);
const DEADLINE_STATUSES = new Set(["open", "closing_soon", "closed"]);
const DEADLINE_FILTERS = new Set(["week", "month", "past", "none"]);
const ROLE_ALIASES = {
  administrator: "admin",
  admin: "admin",
  prorektor: "prorector",
  prorector: "prorector",
  prorektorat: "prorector",
};

function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te menaxhuar konferencat." });
    return;
  }

  next();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeRole(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[\s_-]+/g, "");
  return ROLE_ALIASES[normalized] || normalized;
}

function canViewAllConferences(user) {
  return ["prorector", "admin"].includes(normalizeRole(user?.role));
}

function normalizeConferenceStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  return Array.from(VALID_CONFERENCE_STATUSES).find((status) => status.toLowerCase() === normalized) || "Interested";
}

function isKnownConferenceStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  return Array.from(VALID_CONFERENCE_STATUSES).some((status) => status.toLowerCase() === normalized);
}

function parsePagination(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 25, 1), MAX_LIMIT);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function isValidDateString(value) {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidWebsite(value) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateConferencePayload(body = {}) {
  const status = normalizeConferenceStatus(body.status);
  const values = {
    title: normalizeText(body.title),
    acronym: normalizeText(body.acronym),
    field: normalizeText(body.field),
    location: normalizeText(body.location),
    submission_deadline: normalizeText(body.submission_deadline),
    conference_date: normalizeText(body.conference_date),
    website: normalizeText(body.website),
    status,
  };
  const errors = [];

  if (body.status && !isKnownConferenceStatus(body.status)) {
    errors.push({ field: "status", message: "Statusi i konferences nuk eshte valid." });
  }

  if (!values.title) {
    errors.push({ field: "title", message: "Titulli i konferences eshte obligativ." });
  }

  if (values.title.length > 300) {
    errors.push({ field: "title", message: "Titulli i konferences eshte shume i gjate." });
  }

  if (!values.submission_deadline && values.status !== "Interested") {
    errors.push({ field: "submission_deadline", message: "Afati i aplikimit eshte obligativ." });
  }

  if (!isValidDateString(values.submission_deadline)) {
    errors.push({ field: "submission_deadline", message: "Afati i aplikimit nuk eshte valid." });
  }

  if (!isValidDateString(values.conference_date)) {
    errors.push({ field: "conference_date", message: "Data e konferences nuk eshte valide." });
  }

  if (!isValidWebsite(values.website)) {
    errors.push({ field: "website", message: "Web faqja duhet te jete URL valide http/https." });
  }

  return { values, errors };
}

function parseExternalUrl(input) {
  try {
    const url = new URL(normalizeText(input));

    if (!["http:", "https:"].includes(url.protocol)) {
      return { error: "URL duhet te jete http ose https." };
    }

    if (url.username || url.password) {
      return { error: "URL me kredenciale nuk lejohet." };
    }

    return { url };
  } catch {
    return { error: "URL nuk eshte valide." };
  }
}

function getExtractionRateLimitKey(req) {
  return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
}

function checkExtractionRateLimit(req) {
  const now = Date.now();
  const key = getExtractionRateLimitKey(req);
  const existing = extractionRateLimits.get(key) || [];
  const recent = existing.filter((timestamp) => now - timestamp < EXTRACT_RATE_LIMIT_WINDOW_MS);

  if (recent.length >= EXTRACT_RATE_LIMIT_MAX) {
    extractionRateLimits.set(key, recent);
    return {
      limited: true,
      retryAfterMs: EXTRACT_RATE_LIMIT_WINDOW_MS - (now - recent[0]),
    };
  }

  recent.push(now);
  extractionRateLimits.set(key, recent);

  if (extractionRateLimits.size > 1000) {
    for (const [entryKey, timestamps] of extractionRateLimits.entries()) {
      const active = timestamps.filter((timestamp) => now - timestamp < EXTRACT_RATE_LIMIT_WINDOW_MS);

      if (active.length) {
        extractionRateLimits.set(entryKey, active);
      } else {
        extractionRateLimits.delete(entryKey);
      }
    }
  }

  return { limited: false, retryAfterMs: 0 };
}

function isPrivateIp(address) {
  if (!address) return true;

  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) ||
      parts[0] === 0
    );
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    const ipv4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      (ipv4Mapped && isPrivateIp(ipv4Mapped[1]))
    );
  }

  return true;
}

async function assertPublicUrl(url) {
  const host = url.hostname.toLowerCase();

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    return "URL duhet te jete http ose https dhe pa kredenciale.";
  }

  if (
    ["localhost", "local"].includes(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".localdomain") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".corp") ||
    host.endsWith(".home") ||
    (!net.isIP(host) && !host.includes("."))
  ) {
    return "URL lokale/private nuk lejohen.";
  }

  if (net.isIP(host) && isPrivateIp(host)) {
    return "URL lokale/private nuk lejohen.";
  }

  try {
    const addresses = await dns.lookup(host, { all: true, verbatim: true });

    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
      return "URL lokale/private nuk lejohen.";
    }
  } catch {
    return "Host nuk mund te verifikohet.";
  }

  return "";
}

function sanitizeUrlForLog(value) {
  if (!value) {
    return "";
  }

  try {
    const url = value instanceof URL ? new URL(value.href) : new URL(String(value));
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "[invalid-url]";
  }
}

function logExtractionAttempt({ req, originalUrl, finalUrl = "", success, reason = "" }) {
  const details = {
    userId: req.user?.id || null,
    originalUrl: sanitizeUrlForLog(originalUrl),
    finalUrl: sanitizeUrlForLog(finalUrl),
    success,
    reason,
  };

  if (success) {
    console.info("conference_metadata_extract", details);
  } else {
    console.warn("conference_metadata_extract", details);
  }
}

class ExtractionError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
    this.status = status;
  }
}

function buildExtractionErrorResponse({ code = "extract_failed", message, website }) {
  return {
    error: code,
    message: message || "Metadata nuk mund te nxirret. Plotesoni te dhenat manualisht.",
    data: {
      website: website || "",
      status: "Interested",
    },
    missingFields: ["title", "submission_deadline", "conference_date", "location"],
    confidence: "low",
    warnings: ["Metadata extraction failed. You can complete the form manually."],
    sourceUrl: website || "",
  };
}

function decodeHtml(value) {
  return normalizeText(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  );
}

function extractFirst(pattern, value) {
  const match = value.match(pattern);
  return match ? decodeHtml(match[1] || match[2] || "") : "";
}

function extractMeta(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return extractFirst(
    new RegExp(`<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escapedName}["'][^>]*>`, "i"),
    html
  );
}

function normalizeExtractedDate(value) {
  const text = normalizeText(value);
  const iso = text.match(/\b(20\d{2}|19\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);

  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  }

  const named = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-3]?\d),?\s+(20\d{2}|19\d{2})\b/i);

  if (named) {
    const month = new Date(`${named[1]} 1, 2000`).getMonth() + 1;
    return `${named[3]}-${String(month).padStart(2, "0")}-${String(named[2]).padStart(2, "0")}`;
  }

  return "";
}

function findContextDate(text, keywords) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).slice(0, 220);
  const candidate = sentences.find((sentence) => {
    const lower = sentence.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword)) && normalizeExtractedDate(sentence);
  });

  return candidate ? normalizeExtractedDate(candidate) : "";
}

function extractJsonLd(html, warnings) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  for (const block of blocks.slice(0, 5)) {
    try {
      const parsed = JSON.parse(decodeHtml(block[1]));
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const graphItems = items.flatMap((item) => Array.isArray(item?.["@graph"]) ? item["@graph"] : [item]);
      const event = graphItems.find((item) => {
        const type = Array.isArray(item?.["@type"]) ? item["@type"].join(" ") : item?.["@type"];
        return /event|conference/i.test(type || "");
      });

      if (event) {
        return event;
      }
    } catch {
      warnings.push("JSON-LD u gjet, por nuk mund te lexohej.");
    }
  }

  return null;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);

  try {
    let currentUrl = new URL(url.href);
    let response;

    for (let redirectCount = 0; redirectCount <= EXTRACT_MAX_REDIRECTS; redirectCount += 1) {
      const privateUrlError = await assertPublicUrl(currentUrl);

      if (privateUrlError) {
        throw new ExtractionError("blocked_url", privateUrlError, 400);
      }

      try {
        response = await fetch(currentUrl.href, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "UMIBres conference metadata extractor",
          },
        });
      } catch (error) {
        if (error.name === "AbortError") {
          throw new ExtractionError("extract_timeout", "Faqja nuk u pergjigj ne kohe.");
        }

        throw new ExtractionError("extract_unavailable", "Faqja nuk mund te lexohet.");
      }

      if (![301, 302, 303, 307, 308].includes(response.status)) {
        break;
      }

      const location = response.headers.get("location");

      if (!location) {
        throw new ExtractionError("extract_failed", "Redirect nuk ishte valid.");
      }

      const nextUrl = new URL(location, currentUrl);
      const privateRedirectError = await assertPublicUrl(nextUrl);

      if (privateRedirectError) {
        throw new ExtractionError("blocked_url", privateRedirectError, 400);
      }

      currentUrl = nextUrl;
      response = null;
    }

    if (!response) {
      throw new ExtractionError("too_many_redirects", "URL beri shume redirect-e.");
    }

    const resolvedUrl = new URL(response.url || currentUrl.href);
    const finalUrlError = await assertPublicUrl(resolvedUrl);

    if (finalUrlError) {
      throw new ExtractionError("blocked_url", finalUrlError, 400);
    }

    if (!response.ok) {
      throw new ExtractionError("extract_failed", "Faqja nuk ktheu pergjigje te suksesshme.");
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType && !contentType.toLowerCase().includes("html")) {
      throw new ExtractionError("not_html", "URL nuk ktheu faqe HTML.");
    }

    const reader = response.body?.getReader();

    if (!reader) {
      throw new ExtractionError("extract_failed", "Faqja nuk mund te lexohet.");
    }

    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      received += value.byteLength;

      if (received > EXTRACT_MAX_BYTES) {
        throw new ExtractionError("response_too_large", "Faqja eshte shume e madhe per ekstraktim.");
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(received);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return {
      html: new TextDecoder("utf-8").decode(bytes),
      finalUrl: resolvedUrl.href,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildExtraction(html, sourceUrl) {
  const warnings = [];
  const visibleText = stripHtml(html);
  const jsonLd = extractJsonLd(html, warnings);
  const title = extractMeta(html, "og:title") || extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const description = extractMeta(html, "description") || extractMeta(html, "og:description");
  const jsonLocation = typeof jsonLd?.location === "string"
    ? jsonLd.location
    : [jsonLd?.location?.name, jsonLd?.location?.address?.addressLocality, jsonLd?.location?.address?.addressCountry].filter(Boolean).join(", ");
  const data = {
    title: title || description.split(".")[0] || "",
    acronym: extractFirst(/\(([A-Z][A-Z0-9-]{2,12})\)/, title) || extractFirst(/\b([A-Z][A-Z0-9-]{2,12})\s+20\d{2}\b/, title),
    field: extractFirst(/\b(?:topics|scope|field|track)\s*[:\-]\s*([^.!?\n]{3,100})/i, visibleText),
    location: jsonLocation || extractFirst(/\b(?:location|venue|place)\s*[:\-]\s*([^.!?\n]{3,120})/i, visibleText),
    submission_deadline: findContextDate(visibleText, ["submission deadline", "paper deadline", "abstract deadline", "deadline", "cfp"]),
    conference_date: normalizeExtractedDate(jsonLd?.startDate || "") || findContextDate(visibleText, ["conference date", "event date", "starts", "held on", "takes place"]),
    website: sourceUrl,
    status: "Interested",
  };
  const requiredFields = ["title", "submission_deadline", "conference_date", "location"];
  const missingFields = requiredFields.filter((fieldName) => !data[fieldName]);
  const foundCount = Object.entries(data).filter(([key, value]) => key !== "status" && Boolean(value)).length;
  const confidence = foundCount >= 5 ? "high" : foundCount >= 3 ? "medium" : "low";

  if (!jsonLd) {
    warnings.push("Nuk u gjet JSON-LD i perdorshem.");
  }

  if (missingFields.length) {
    warnings.push("Disa fusha duhet te plotesohen manualisht.");
  }

  return {
    data,
    missingFields,
    confidence,
    warnings,
    sourceUrl,
  };
}

router.post("/extract", requireAuthenticatedUser, async (req, res) => {
  const rateLimit = checkExtractionRateLimit(req);

  if (rateLimit.limited) {
    const retryAfterSeconds = Math.max(Math.ceil(rateLimit.retryAfterMs / 1000), 1);
    res.set("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      error: "rate_limited",
      message: "Keni bere shume kerkesa per ekstraktim. Provoni perseri me vone.",
    });
    logExtractionAttempt({
      req,
      originalUrl: req.body?.url,
      success: false,
      reason: "rate_limited",
    });
    return;
  }

  const parsed = parseExternalUrl(req.body?.url);
  let finalUrl = "";

  if (parsed.error) {
    res.status(400).json(buildExtractionErrorResponse({
      code: "invalid_url",
      message: parsed.error,
      website: normalizeText(req.body?.url),
    }));
    logExtractionAttempt({
      req,
      originalUrl: req.body?.url,
      success: false,
      reason: "invalid_url",
    });
    return;
  }

  const privateUrlError = await assertPublicUrl(parsed.url);

  if (privateUrlError) {
    res.status(400).json(buildExtractionErrorResponse({
      code: "blocked_url",
      message: privateUrlError,
      website: parsed.url.href,
    }));
    logExtractionAttempt({
      req,
      originalUrl: parsed.url.href,
      success: false,
      reason: "blocked_url",
    });
    return;
  }

  try {
    const result = await fetchHtml(parsed.url);
    finalUrl = result.finalUrl;
    res.json(buildExtraction(result.html, parsed.url.href));
    logExtractionAttempt({
      req,
      originalUrl: parsed.url.href,
      finalUrl,
      success: true,
    });
  } catch (error) {
    const code = error instanceof ExtractionError ? error.code : "extract_failed";
    const status = error instanceof ExtractionError ? error.status : 422;
    const message = error instanceof ExtractionError
      ? error.message
      : "Metadata nuk mund te nxirret. Plotesoni te dhenat manualisht.";

    logExtractionAttempt({
      req,
      originalUrl: parsed.url.href,
      finalUrl,
      success: false,
      reason: code,
    });
    res.status(status).json(buildExtractionErrorResponse({
      code,
      message,
      website: finalUrl || parsed.url.href,
    }));
  }
});

/* GET professor conferences */
router.get("/", requireAuthenticatedUser, async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const q = normalizeText(req.query.q || req.query.search);
  const status = normalizeText(req.query.status);
  const deadline = normalizeText(req.query.deadline);
  const scope = normalizeText(req.query.scope).toLowerCase();
  const isAllScope = scope === "all";
  const filters = [];
  const params = [];

  if (isAllScope && !canViewAllConferences(req.user)) {
    res.status(403).json({ error: "forbidden", message: "Nuk keni leje per te pare te gjitha konferencat." });
    return;
  }

  if (!isAllScope) {
    params.push(req.user.id);
    filters.push(`c.created_by = $${params.length}`);
  }

  if (q) {
    params.push(`%${q}%`);
    filters.push(`(c.title ilike $${params.length} or c.acronym ilike $${params.length} or c.field ilike $${params.length} or c.location ilike $${params.length} or c.website ilike $${params.length} or c.status ilike $${params.length} or u.full_name ilike $${params.length} or u.faculty ilike $${params.length} or u.department ilike $${params.length})`);
  }

  if (status && status !== "all") {
    if (DEADLINE_STATUSES.has(status)) {
      if (status === "closed") {
        filters.push("c.submission_deadline < current_date");
      } else if (status === "closing_soon") {
        filters.push("c.submission_deadline >= current_date and c.submission_deadline <= current_date + interval '7 days'");
      } else {
        filters.push("c.submission_deadline > current_date + interval '7 days'");
      }
    } else if (isKnownConferenceStatus(status)) {
      params.push(normalizeConferenceStatus(status));
      filters.push(`c.status = $${params.length}`);
    } else {
      res.status(400).json({ error: "invalid_status", message: "Statusi i konferences nuk eshte valid." });
      return;
    }
  }

  if (deadline && deadline !== "all") {
    if (!DEADLINE_FILTERS.has(deadline)) {
      res.status(400).json({ error: "invalid_deadline", message: "Filtri i afatit nuk eshte valid." });
      return;
    }

    if (deadline === "week") {
      filters.push("c.submission_deadline >= current_date and c.submission_deadline <= current_date + interval '7 days'");
    } else if (deadline === "month") {
      filters.push("c.submission_deadline >= current_date and c.submission_deadline <= current_date + interval '1 month'");
    } else if (deadline === "past") {
      filters.push("c.submission_deadline < current_date");
    } else if (deadline === "none") {
      filters.push("c.submission_deadline is null");
    }
  }

  const whereClause = filters.length ? filters.join(" and ") : "true";

  try {
    const dataParams = [...params, limit, offset];
    const limitParam = dataParams.length - 1;
    const offsetParam = dataParams.length;
    const [listResult, countResult] = await Promise.all([
      db.query(
        `select c.id, c.title, c.acronym, c.field, c.location, c.submission_deadline, c.conference_date, c.website, c.status, c.created_by, c.created_at, c.updated_at,
                u.full_name as owner_name, u.email as owner_email, u.faculty as owner_faculty, u.department as owner_department
       from conferences c
       left join users u on u.id = c.created_by
       where ${whereClause}
       order by c.submission_deadline nulls last, c.created_at desc
       limit $${limitParam} offset $${offsetParam}`,
        dataParams
      ),
      db.query(
        `select count(*)::int as total
         from conferences c
         left join users u on u.id = c.created_by
         where ${whereClause}`,
        params
      ),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      data: listResult.rows.map((row) => ({
        id: row.id,
        title: row.title || "",
        acronym: row.acronym || "",
        field: row.field || "",
        location: row.location || "",
        submissionDeadline: row.submission_deadline || null,
        submission_deadline: row.submission_deadline || null,
        conferenceDate: row.conference_date || null,
        conference_date: row.conference_date || null,
        website: row.website || "",
        status: row.status || "Interested",
        createdBy: row.created_by || null,
        created_by: row.created_by || null,
        createdAt: row.created_at || null,
        created_at: row.created_at || null,
        updatedAt: row.updated_at || null,
        updated_at: row.updated_at || null,
        owner: {
          id: row.created_by || null,
          name: row.owner_name || "",
          email: row.owner_email || "",
          faculty: row.owner_faculty || "",
          department: row.owner_department || "",
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});


/* ADD conference */
router.post("/", requireAuthenticatedUser, async (req, res) => {
  const { values, errors } = validateConferencePayload(req.body);

  if (errors.length) {
    res.status(400).json({ error: "validation_failed", message: errors[0].message, errors });
    return;
  }

  try {
    const { rows } = await db.query(
      `insert into conferences
      (title, acronym, field, location, submission_deadline, conference_date, website, status, created_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning id, title, acronym, field, location, submission_deadline, conference_date, website, status, created_by, created_at, updated_at`,
      [
        values.title,
        values.acronym || null,
        values.field || null,
        values.location || null,
        values.submission_deadline || null,
        values.conference_date || null,
        values.website || null,
        values.status,
        req.user.id
      ]
    );

    res.status(201).json({
      message: "Conference added",
      data: rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Insert failed"
    });
  }
});

router.put("/:id", requireAuthenticatedUser, async (req, res) => {
  const { values, errors } = validateConferencePayload(req.body);

  if (errors.length) {
    res.status(400).json({ error: "validation_failed", message: errors[0].message, errors });
    return;
  }

  try {
    const { rows } = await db.query(
      `update conferences
       set title = $3,
           acronym = $4,
           field = $5,
           location = $6,
           submission_deadline = $7,
           conference_date = $8,
           website = $9,
           status = $10,
           updated_at = now()
       where id = $1 and created_by = $2
       returning id, title, acronym, field, location, submission_deadline, conference_date, website, status, created_by, created_at, updated_at`,
      [
        req.params.id,
        req.user.id,
        values.title,
        values.acronym || null,
        values.field || null,
        values.location || null,
        values.submission_deadline || null,
        values.conference_date || null,
        values.website || null,
        values.status,
      ]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "not_found", message: "Konferenca nuk u gjet." });
      return;
    }

    res.json({ message: "Conference updated", data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});


/* DELETE conference */
router.delete("/:id", requireAuthenticatedUser, async (req, res) => {
  try {
    const result = await db.query(
      "delete from conferences where id = $1 and created_by = $2 returning id",
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Conference not found" });
      return;
    }

    res.json({
      message: "Deleted"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Delete failed"
    });
  }
});

export default router;
