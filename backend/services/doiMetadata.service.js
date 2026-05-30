const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;
const DOI_LOOKUP_TIMEOUT_MS = 10000;
const SCOPUS_SERIAL_TITLE_API_URL = "https://api.elsevier.com/content/serial/title/issn";
const JOURNAL_RANK_BASE_URL = "https://journalrank.rcsi.science";

export class DoiLookupError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = "DoiLookupError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeDoi(input) {
  if (!input) {
    return "";
  }

  try {
    return decodeURIComponent(String(input))
      .trim()
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "")
      .split(/[?#]/)[0]
      .replace(/[.,;:]+$/g, "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}

export function isValidDoi(value) {
  return DOI_PATTERN.test(value);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeComparableText(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIssn(value) {
  return normalizeText(value).replace(/[^0-9x]/gi, "").toUpperCase();
}

function getMetadataIssns(metadata = {}) {
  const raw = metadata.raw_json || {};
  const values = [
    metadata.issn,
    raw.ISSN,
    raw.issn,
  ].flatMap((value) => (Array.isArray(value) ? value : [value]));

  return values.map(normalizeIssn).filter(Boolean);
}

function normalizeQuartile(value) {
  const match = normalizeText(value).toUpperCase().match(/\bQ[1-4]\b/);

  return match?.[0] || "";
}

function quartileRank(value) {
  const quartile = normalizeQuartile(value);

  return quartile ? Number(quartile.slice(1)) : Number.POSITIVE_INFINITY;
}

function decodeHtmlEntities(value) {
  return normalizeText(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function hasText(value) {
  return normalizeText(value) !== "";
}

export function normalizeAbstractText(value) {
  return normalizeText(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeYear(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const year = Number(value);
  const currentYear = new Date().getUTCFullYear() + 1;
  return Number.isInteger(year) && year >= 1900 && year <= currentYear ? year : null;
}

function normalizeOrcid(value) {
  return normalizeText(value)
    .replace(/^https?:\/\/orcid\.org\//i, "")
    .trim();
}

function normalizeAffiliations(value) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => normalizeText(item?.name || item))
    .filter(Boolean)
    .join("; ");
}

function getDateParts(value) {
  const parts = value?.["date-parts"]?.[0];

  return Array.isArray(parts)
    ? parts.map((part) => Number(part)).filter((part) => Number.isInteger(part))
    : [];
}

function isValidMonth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function isValidDay(value) {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

function formatDateParts(parts) {
  const year = normalizeYear(parts[0]);

  if (!year) {
    return "";
  }

  if (isValidMonth(parts[1]) && isValidDay(parts[2])) {
    return `${year}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
  }

  if (isValidMonth(parts[1])) {
    return `${year}-${String(parts[1]).padStart(2, "0")}`;
  }

  return String(year);
}

function isFullDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizeText(value));
}

function getBestPublicationDateParts(data) {
  const candidates = [
    data["published-print"],
    data["published-online"],
    data.issued,
    data.event?.start,
    data.event?.end,
  ].map(getDateParts).filter((parts) => parts.length > 0);

  return candidates.find((parts) => normalizeYear(parts[0]) && isValidMonth(parts[1]) && isValidDay(parts[2]))
    || candidates.find((parts) => normalizeYear(parts[0]) && isValidMonth(parts[1]))
    || candidates.find((parts) => normalizeYear(parts[0]))
    || [];
}

function extractYearFromDoi(doi) {
  const match = normalizeText(doi).match(/(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/);

  return normalizeYear(match?.[1]);
}

function preferText(primary, fallback) {
  return hasText(primary) ? primary : fallback;
}

function mergeMetadata(primary, fallback) {
  if (!fallback) {
    return primary;
  }

  return {
    ...primary,
    title: preferText(primary.title, fallback.title),
    authors: Array.isArray(primary.authors) && primary.authors.length ? primary.authors : fallback.authors,
    container_title: preferText(primary.container_title, fallback.container_title),
    publisher: preferText(primary.publisher, fallback.publisher),
    published_date: isFullDate(fallback.published_date) && !isFullDate(primary.published_date)
      ? fallback.published_date
      : preferText(primary.published_date, fallback.published_date),
    year: primary.year || fallback.year,
    volume: preferText(primary.volume, fallback.volume),
    issue: preferText(primary.issue, fallback.issue),
    pages: preferText(primary.pages, fallback.pages),
    issn: preferText(primary.issn, fallback.issn),
    isbn: preferText(primary.isbn, fallback.isbn),
    type: preferText(primary.type, fallback.type),
    abstract: preferText(primary.abstract, fallback.abstract),
    source_url: preferText(primary.source_url, fallback.source_url),
    raw_json: {
      ...(primary.raw_json || {}),
      _doi_org: primary.raw_json || {},
      _crossref: fallback.raw_json || {},
    },
  };
}

function shouldResolveQuartileForType(type) {
  const normalized = normalizeComparableText(type).replace(/\s+/g, "_");

  return [
    "article_journal",
    "journal_article",
    "proceedings_article",
    "conference_paper",
    "book_chapter",
    "chapter",
    "book",
  ].includes(normalized);
}

function shouldRefreshCachedMetadata(metadata = {}) {
  const type = normalizeText(metadata.type);
  const hasCrossrefSnapshot = Boolean(metadata.raw_json?._crossref);

  return type === "proceedings-article" && !isFullDate(metadata.published_date) && !hasCrossrefSnapshot;
}

function mapMetadata(data, doi) {
  const title = Array.isArray(data.title) ? data.title[0] || "" : data.title || "";
  const containerTitle = Array.isArray(data["container-title"])
    ? data["container-title"][0] || ""
    : data["container-title"] || data.event?.name || "";
  const authors = Array.isArray(data.author)
    ? data.author
      .map((author, index) => {
        const fullName = [author.given, author.family].filter(Boolean).join(" ").trim() || normalizeText(author.name);

        return {
          fullName,
          givenName: normalizeText(author.given),
          familyName: normalizeText(author.family),
          orcid: normalizeOrcid(author.ORCID || author.orcid),
          affiliation: normalizeAffiliations(author.affiliation),
          isMainAuthor: index === 0,
          isCorrespondingAuthor: false,
          position: index + 1,
        };
      })
      .filter((author) => author.fullName || author.orcid || author.affiliation)
    : [];
  const dateParts = getBestPublicationDateParts(data);

  return {
    doi,
    title: normalizeText(title),
    authors,
    container_title: normalizeText(containerTitle),
    publisher: normalizeText(data.publisher),
    published_date: formatDateParts(dateParts),
    year: normalizeYear(dateParts[0]) || extractYearFromDoi(doi),
    volume: normalizeText(data.volume),
    issue: normalizeText(data.issue),
    pages: normalizeText(data.page),
    issn: Array.isArray(data.ISSN) ? normalizeText(data.ISSN[0]) : normalizeText(data.ISSN),
    isbn: Array.isArray(data.ISBN) ? normalizeText(data.ISBN[0]) : normalizeText(data.ISBN),
    type: normalizeText(data.type),
    abstract: normalizeAbstractText(data.abstract),
    source_url: normalizeText(data.URL) || `https://doi.org/${doi}`,
    raw_json: data,
  };
}

async function hasPublicationMetadataIdentifierColumns(db) {
  const { rows } = await db.query(
    `select count(*)::int as count
     from information_schema.columns
     where table_schema = current_schema()
       and table_name = 'publication_metadata'
       and column_name in ('issn', 'isbn')`
  );

  return Number(rows[0]?.count || 0) === 2;
}

export async function getCachedDoiMetadata(db, doi) {
  const hasIdentifierColumns = await hasPublicationMetadataIdentifierColumns(db);
  const identifierColumns = hasIdentifierColumns ? ", issn, isbn" : "";

  const { rows } = await db.query(
    `select doi, title, authors, container_title, publisher, published_date, year,
            volume, issue, pages${identifierColumns}, type, abstract, source_url, raw_json, created_at, updated_at
     from publication_metadata
     where doi = $1
     limit 1`,
    [doi]
  );

  if (!rows[0]) {
    return null;
  }

  return { issn: "", isbn: "", ...rows[0], abstract: normalizeAbstractText(rows[0].abstract) };
}

export async function upsertDoiMetadata(dbOrClient, metadata) {
  const hasIdentifierColumns = await hasPublicationMetadataIdentifierColumns(dbOrClient);

  if (hasIdentifierColumns) {
    await dbOrClient.query(
      `insert into publication_metadata
       (doi, title, authors, container_title, publisher, published_date, year, volume, issue, pages, issn, isbn, type, abstract, source_url, raw_json)
       values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)
       on conflict (doi) do update set
         title = excluded.title,
         authors = excluded.authors,
         container_title = excluded.container_title,
         publisher = excluded.publisher,
         published_date = excluded.published_date,
         year = excluded.year,
         volume = excluded.volume,
         issue = excluded.issue,
         pages = excluded.pages,
         issn = excluded.issn,
         isbn = excluded.isbn,
         type = excluded.type,
         abstract = excluded.abstract,
         source_url = excluded.source_url,
         raw_json = excluded.raw_json,
         updated_at = now()`,
      [
        metadata.doi,
        metadata.title,
        JSON.stringify(Array.isArray(metadata.authors) ? metadata.authors : []),
        metadata.container_title,
        metadata.publisher,
        metadata.published_date,
        metadata.year,
        metadata.volume,
        metadata.issue,
        metadata.pages,
        metadata.issn,
        metadata.isbn,
        metadata.type,
        metadata.abstract,
        metadata.source_url,
        JSON.stringify(metadata.raw_json || {}),
      ]
    );
    return;
  }

  await dbOrClient.query(
    `insert into publication_metadata
     (doi, title, authors, container_title, publisher, published_date, year, volume, issue, pages, type, abstract, source_url, raw_json)
     values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
     on conflict (doi) do update set
       title = excluded.title,
       authors = excluded.authors,
       container_title = excluded.container_title,
       publisher = excluded.publisher,
       published_date = excluded.published_date,
       year = excluded.year,
       volume = excluded.volume,
       issue = excluded.issue,
       pages = excluded.pages,
       type = excluded.type,
       abstract = excluded.abstract,
       source_url = excluded.source_url,
       raw_json = excluded.raw_json,
       updated_at = now()`,
    [
      metadata.doi,
      metadata.title,
      JSON.stringify(Array.isArray(metadata.authors) ? metadata.authors : []),
      metadata.container_title,
      metadata.publisher,
      metadata.published_date,
      metadata.year,
      metadata.volume,
      metadata.issue,
      metadata.pages,
      metadata.type,
      metadata.abstract,
      metadata.source_url,
      JSON.stringify(metadata.raw_json || {}),
    ]
  );
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOI_LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchFromDoiOrg(doi) {
  const response = await fetchJson(`https://doi.org/${encodeURIComponent(doi)}`, {
    headers: {
      Accept: "application/vnd.citationstyles.csl+json",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (response.status === 404) {
    throw new DoiLookupError("doi_not_found", "Metadata per kete DOI nuk u gjet.", 404);
  }

  if (!response.ok) {
    throw new DoiLookupError("external_lookup_failed", "Sherbimi i DOI nuk u pergjigj me sukses.", 502);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType && !contentType.toLowerCase().includes("json")) {
    throw new DoiLookupError("external_lookup_failed", "Sherbimi i DOI nuk ktheu metadata valide.", 502);
  }

  return mapMetadata(await response.json(), doi);
}

async function fetchFromCrossref(doi) {
  const response = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (response.status === 404) {
    throw new DoiLookupError("doi_not_found", "Metadata per kete DOI nuk u gjet.", 404);
  }

  if (!response.ok) {
    throw new DoiLookupError("external_lookup_failed", "Crossref nuk u pergjigj me sukses.", 502);
  }

  const data = await response.json();

  if (!data.message) {
    throw new DoiLookupError("external_lookup_failed", "Crossref nuk ktheu metadata valide.", 502);
  }

  return mapMetadata(data.message, doi);
}

function getScopusApiKey() {
  return normalizeText(process.env.SCOPUS_API_KEY || process.env.ELSEVIER_API_KEY);
}

function getScopusInstToken() {
  return normalizeText(process.env.SCOPUS_INST_TOKEN || process.env.ELSEVIER_INST_TOKEN);
}

function getScopusHeaders() {
  const headers = {
    Accept: "application/json",
    "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    "X-ELS-APIKey": getScopusApiKey(),
  };
  const instToken = getScopusInstToken();

  if (instToken) {
    headers["X-ELS-Insttoken"] = instToken;
  }

  return headers;
}

function walkValues(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkValues(item, visitor));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    visitor(key, entryValue);
    walkValues(entryValue, visitor);
  });
}

function getBestQuartileFromScopusResponse(data) {
  let quartile = "";
  let highestPercentile = null;

  walkValues(data, (key, value) => {
    const normalizedKey = normalizeComparableText(key);

    if (!quartile && normalizedKey.includes("quartile")) {
      quartile = normalizeQuartile(value);
    }

    if (normalizedKey.includes("percentile")) {
      const percentile = Number(String(value).replace(",", "."));

      if (Number.isFinite(percentile)) {
        highestPercentile = highestPercentile === null ? percentile : Math.max(highestPercentile, percentile);
      }
    }
  });

  if (quartile) {
    return quartile;
  }

  if (highestPercentile === null) {
    return "";
  }

  if (highestPercentile >= 75) return "Q1";
  if (highestPercentile >= 50) return "Q2";
  if (highestPercentile >= 25) return "Q3";
  return "Q4";
}

async function fetchScopusIndexingByIssn(issn) {
  const apiKey = getScopusApiKey();
  const normalizedIssn = normalizeIssn(issn);

  if (!apiKey || !normalizedIssn) {
    return null;
  }

  const response = await fetchJson(`${SCOPUS_SERIAL_TITLE_API_URL}/${encodeURIComponent(normalizedIssn)}?view=CITESCORE`, {
    headers: getScopusHeaders(),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  const quartile = getBestQuartileFromScopusResponse(data);

  return quartile
    ? {
        source: "Scopus CiteScore",
        quartile,
        impactFactor: "",
        indexedUrl: "",
      }
    : null;
}

function parseJournalRankRecordId(html, issn) {
  const normalizedIssn = normalizeIssn(issn);

  if (!normalizedIssn || !normalizeIssn(html).includes(normalizedIssn)) {
    return "";
  }

  const match = normalizeText(html).match(/\/ru\/record-sources\/details\/(\d+)\//i);
  return match?.[1] || "";
}

function parseJournalRankQuartiles(html) {
  const rows = [];
  const rowPattern = /<tr\b[^>]*data-id=["']?CiteScore["']?[^>]*data-value=["']?(Q[1-4])["']?[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html))) {
    const quartile = normalizeQuartile(rowMatch[1]);
    const cells = [...rowMatch[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((cell) => decodeHtmlEntities(cell[1].replace(/<[^>]+>/g, " ")));
    const year = normalizeYear(cells[2]);

    if (quartile) {
      rows.push({
        source: "Journal Rank CiteScore",
        quartile,
        year,
        subject: cells[1] || "",
      });
    }
  }

  return rows;
}

function pickBestJournalRankQuartile(rows, publicationYear) {
  if (!rows.length) {
    return null;
  }

  const validRows = rows.filter((row) => row.quartile);
  const targetYear = normalizeYear(publicationYear);
  const yearRows = targetYear ? validRows.filter((row) => row.year === targetYear) : [];
  const latestYear = Math.max(...validRows.map((row) => row.year || 0));
  const candidates = yearRows.length
    ? yearRows
    : validRows.filter((row) => row.year === latestYear);

  return (candidates.length ? candidates : validRows)
    .sort((a, b) => quartileRank(a.quartile) - quartileRank(b.quartile))[0] || null;
}

async function fetchJournalRankIndexingByIssn(issn, publicationYear) {
  const normalizedIssn = normalizeIssn(issn);

  if (!normalizedIssn) {
    return null;
  }

  const searchResponse = await fetchJson(`${JOURNAL_RANK_BASE_URL}/ru/record-sources/?s=${encodeURIComponent(issn)}`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (!searchResponse.ok) {
    return null;
  }

  const recordId = parseJournalRankRecordId(await searchResponse.text(), issn);

  if (!recordId) {
    return null;
  }

  const quartilesUrl = `${JOURNAL_RANK_BASE_URL}/ru/record-sources/quartiles/${recordId}/?TypeId=CiteScore&pagesize=100`;
  const quartilesResponse = await fetchJson(quartilesUrl, {
    headers: {
      Accept: "text/html",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (!quartilesResponse.ok) {
    return null;
  }

  const best = pickBestJournalRankQuartile(
    parseJournalRankQuartiles(await quartilesResponse.text()),
    publicationYear
  );

  return best?.quartile
    ? {
        source: best.year ? `${best.source} ${best.year}` : best.source,
        quartile: best.quartile,
        impactFactor: "",
        indexedUrl: quartilesUrl,
      }
    : null;
}

async function resolveScopusIndexing(metadata = {}) {
  if (!shouldResolveQuartileForType(metadata.type)) {
    return [];
  }

  for (const issn of getMetadataIssns(metadata)) {
    try {
      const indexing = await fetchScopusIndexingByIssn(issn)
        || await fetchJournalRankIndexingByIssn(issn, metadata.year);

      if (indexing?.quartile) {
        return [indexing];
      }
    } catch (error) {
      console.warn("quartile_lookup_failed", {
        doi: metadata.doi,
        issn,
        message: error.message,
      });
    }
  }

  return [];
}

async function enrichMetadataIndexing(metadata = {}) {
  const indexing = await resolveScopusIndexing(metadata);
  const quartile = indexing.find((item) => normalizeQuartile(item?.quartile))?.quartile || "";

  return {
    ...metadata,
    quartile,
    indexing,
  };
}

export async function fetchDoiMetadata(doi) {
  const normalizedDoi = normalizeDoi(doi);

  if (!normalizedDoi || !isValidDoi(normalizedDoi)) {
    throw new DoiLookupError("invalid_doi", "DOI nuk eshte valid.", 400);
  }

  const errors = [];
  let metadata = null;

  for (const fetcher of [fetchFromDoiOrg, fetchFromCrossref]) {
    try {
      const nextMetadata = await fetcher(normalizedDoi);
      metadata = metadata ? mergeMetadata(metadata, nextMetadata) : nextMetadata;
    } catch (error) {
      errors.push(error);
    }
  }

  if (metadata) {
    return enrichMetadataIndexing(metadata);
  }

  if (errors.every((error) => error instanceof DoiLookupError && error.code === "doi_not_found")) {
    throw new DoiLookupError("doi_not_found", "Metadata per kete DOI nuk u gjet.", 404);
  }

  if (errors.some((error) => error.name === "AbortError")) {
    throw new DoiLookupError("external_lookup_failed", "Kerkesa per DOI tejkaloi kohen e pritjes.", 504);
  }

  throw new DoiLookupError("external_lookup_failed", "Metadata per kete DOI nuk mund te merret tani.", 502);
}

export async function getVerifiedDoiMetadata(dbOrClient, doi) {
  const cached = await getCachedDoiMetadata(dbOrClient, doi);

  if (cached && !shouldRefreshCachedMetadata(cached)) {
    return { source: "cache", metadata: await enrichMetadataIndexing(cached) };
  }

  const metadata = await fetchDoiMetadata(doi);
  await upsertDoiMetadata(dbOrClient, metadata);
  return { source: "api", metadata };
}
