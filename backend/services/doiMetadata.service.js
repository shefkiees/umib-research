const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;
const DOI_LOOKUP_TIMEOUT_MS = 10000;

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

export function normalizeYear(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const year = Number(value);
  const currentYear = new Date().getUTCFullYear() + 1;
  return Number.isInteger(year) && year >= 1900 && year <= currentYear ? year : null;
}

function mapMetadata(data, doi) {
  const title = Array.isArray(data.title) ? data.title[0] || "" : data.title || "";
  const containerTitle = Array.isArray(data["container-title"])
    ? data["container-title"][0] || ""
    : data["container-title"] || "";
  const authors = Array.isArray(data.author)
    ? data.author.map((author) => [author.given, author.family].filter(Boolean).join(" ").trim()).filter(Boolean)
    : [];
  const dateParts = data.issued?.["date-parts"]?.[0] || [];

  return {
    doi,
    title: normalizeText(title),
    authors,
    container_title: normalizeText(containerTitle),
    publisher: normalizeText(data.publisher),
    published_date: dateParts.length ? dateParts.join("-") : "",
    year: normalizeYear(dateParts[0]),
    volume: normalizeText(data.volume),
    issue: normalizeText(data.issue),
    pages: normalizeText(data.page),
    issn: Array.isArray(data.ISSN) ? normalizeText(data.ISSN[0]) : normalizeText(data.ISSN),
    isbn: Array.isArray(data.ISBN) ? normalizeText(data.ISBN[0]) : normalizeText(data.ISBN),
    type: normalizeText(data.type),
    abstract: normalizeText(data.abstract),
    source_url: normalizeText(data.URL) || `https://doi.org/${doi}`,
    raw_json: data,
  };
}

export async function getCachedDoiMetadata(db, doi) {
  const { rows } = await db.query(
    `select doi, title, authors, container_title, publisher, published_date, year,
            volume, issue, pages, issn, isbn, type, abstract, source_url, raw_json, created_at, updated_at
     from publication_metadata
     where doi = $1
     limit 1`,
    [doi]
  );

  return rows[0] || null;
}

export async function upsertDoiMetadata(dbOrClient, metadata) {
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
}

export async function fetchDoiMetadata(doi) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOI_LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
      headers: {
        Accept: "application/vnd.citationstyles.csl+json",
        "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
      },
      signal: controller.signal,
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
  } catch (error) {
    if (error instanceof DoiLookupError) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new DoiLookupError("external_lookup_failed", "Kerkesa per DOI tejkaloi kohen e pritjes.", 504);
    }

    throw new DoiLookupError("external_lookup_failed", "Metadata per kete DOI nuk mund te merret tani.", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getVerifiedDoiMetadata(dbOrClient, doi) {
  const cached = await getCachedDoiMetadata(dbOrClient, doi);

  if (cached) {
    return { source: "cache", metadata: cached };
  }

  const metadata = await fetchDoiMetadata(doi);
  await upsertDoiMetadata(dbOrClient, metadata);
  return { source: "api", metadata };
}
