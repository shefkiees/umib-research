import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import db from "../config/db.js";

const router = express.Router();
const MAX_LIMIT = 50;
const EXTRACT_TIMEOUT_MS = 8000;
const EXTRACT_MAX_BYTES = 1024 * 1024;
const VALID_CONFERENCE_STATUSES = new Set([
  "Interested",
  "Planning",
  "Submitted",
  "Accepted",
  "Attended",
  "Completed",
]);
const DEADLINE_STATUSES = new Set(["open", "closing_soon", "closed"]);

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

function isPrivateIp(address) {
  if (!address) return true;

  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 0
    );
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }

  return true;
}

async function assertPublicUrl(url) {
  const host = url.hostname.toLowerCase();

  if (["localhost", "local"].includes(host) || host.endsWith(".local") || host.endsWith(".internal")) {
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
    const response = await fetch(url.href, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "UMIBres conference metadata extractor",
      },
    });

    if (!response.ok) {
      throw new Error(`Faqja ktheu status ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType && !contentType.toLowerCase().includes("html")) {
      throw new Error("URL nuk ktheu faqe HTML.");
    }

    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("Faqja nuk mund te lexohet.");
    }

    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      received += value.byteLength;

      if (received > EXTRACT_MAX_BYTES) {
        throw new Error("Faqja eshte shume e madhe per ekstraktim.");
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(received);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new TextDecoder("utf-8").decode(bytes);
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
  const parsed = parseExternalUrl(req.body?.url);

  if (parsed.error) {
    res.status(400).json({ error: "invalid_url", message: parsed.error });
    return;
  }

  const privateUrlError = await assertPublicUrl(parsed.url);

  if (privateUrlError) {
    res.status(400).json({ error: "blocked_url", message: privateUrlError });
    return;
  }

  try {
    const html = await fetchHtml(parsed.url);
    res.json(buildExtraction(html, parsed.url.href));
  } catch (error) {
    console.error("POST /api/conferences/extract failed:", error);
    res.status(422).json({
      error: "extract_failed",
      message: error.message || "Metadata nuk mund te nxirret.",
      data: {
        website: parsed.url.href,
        status: "Interested",
      },
      missingFields: ["title", "submission_deadline", "conference_date", "location"],
      confidence: "low",
      warnings: ["Metadata extraction failed. You can complete the form manually."],
      sourceUrl: parsed.url.href,
    });
  }
});

/* GET professor conferences */
router.get("/", requireAuthenticatedUser, async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const q = normalizeText(req.query.q || req.query.search);
  const status = normalizeText(req.query.status);
  const filters = ["created_by = $1"];
  const params = [req.user.id];

  if (q) {
    params.push(`%${q}%`);
    filters.push(`(title ilike $${params.length} or acronym ilike $${params.length} or field ilike $${params.length} or location ilike $${params.length} or website ilike $${params.length} or status ilike $${params.length})`);
  }

  if (status) {
    if (DEADLINE_STATUSES.has(status)) {
      if (status === "closed") {
        filters.push("submission_deadline < current_date");
      } else if (status === "closing_soon") {
        filters.push("submission_deadline >= current_date and submission_deadline <= current_date + interval '7 days'");
      } else {
        filters.push("submission_deadline > current_date + interval '7 days'");
      }
    } else if (isKnownConferenceStatus(status)) {
      params.push(normalizeConferenceStatus(status));
      filters.push(`status = $${params.length}`);
    } else {
      res.status(400).json({ error: "invalid_status", message: "Statusi i konferences nuk eshte valid." });
      return;
    }
  }

  const whereClause = filters.join(" and ");

  try {
    const dataParams = [...params, limit, offset];
    const limitParam = dataParams.length - 1;
    const offsetParam = dataParams.length;
    const [listResult, countResult] = await Promise.all([
      db.query(
        `select id, title, acronym, field, location, submission_deadline, conference_date, website, status, created_by, created_at, updated_at
       from conferences
       where ${whereClause}
       order by submission_deadline nulls last, created_at desc
       limit $${limitParam} offset $${offsetParam}`,
        dataParams
      ),
      db.query(
        `select count(*)::int as total
         from conferences
         where ${whereClause}`,
        params
      ),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      data: listResult.rows,
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
