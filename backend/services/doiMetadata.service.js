const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;
const DOI_LOOKUP_TIMEOUT_MS = 10000;
const SCOPUS_SEARCH_API_URL = "https://api.elsevier.com/content/search/scopus";
const SCOPUS_SERIAL_TITLE_API_URL = "https://api.elsevier.com/content/serial/title/issn";
const SCOPUS_SERIAL_TITLE_SEARCH_API_URL = "https://api.elsevier.com/content/serial/title";
const JOURNAL_RANK_BASE_URL = "https://journalrank.rcsi.science";
const SCIMAGO_BASE_URL = "https://www.scimagojr.com";
const OPENALEX_WORKS_API_URL = "https://api.openalex.org/works";
const OPENALEX_SOURCES_API_URL = "https://api.openalex.org/sources";
const DOAJ_JOURNALS_API_URL = "https://doaj.org/api/search/journals";
const CROSSREF_JOURNALS_API_URL = "https://api.crossref.org/journals";

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

function firstTextValue(value) {
  const values = Array.isArray(value) ? value : [value];
  return normalizeText(values.find((item) => normalizeText(item)) || "");
}

function getRawIdentifierValue(raw = {}, key) {
  const upperKey = key.toUpperCase();
  const lowerKey = key.toLowerCase();
  const candidates = [
    raw[upperKey],
    raw[lowerKey],
    raw._crossref?.[upperKey],
    raw._crossref?.[lowerKey],
    raw._doi_org?.[upperKey],
    raw._doi_org?.[lowerKey],
  ];

  for (const candidate of candidates) {
    const value = firstTextValue(candidate);

    if (value) {
      return value;
    }
  }

  return "";
}

function formatIssn(value) {
  const normalized = normalizeIssn(value);

  return normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized;
}

function getMetadataIssns(metadata = {}) {
  const raw = metadata.raw_json || {};
  const crossref = raw._crossref || {};
  const openAlexSource = raw._openalex?.primary_location?.source || raw._openalex?.host_venue || {};
  const issnTypeValues = [
    raw["issn-type"],
    raw["ISSN-type"],
    crossref["issn-type"],
    crossref["ISSN-type"],
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((item) => item?.value || item?.issn || item)
    .filter(Boolean);
  const values = [
    metadata.issn,
    metadata.eissn,
    metadata.eIssn,
    raw.ISSN,
    raw.issn,
    raw.eISSN,
    raw.eissn,
    raw.EISSN,
    crossref.ISSN,
    crossref.issn,
    openAlexSource.issn,
    openAlexSource.issn_l,
    ...issnTypeValues,
  ].flatMap((value) => (Array.isArray(value) ? value : [value]));

  return values.map(normalizeIssn).filter(Boolean);
}

function uniqueValues(values = []) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function normalizeQuartile(value) {
  const match = normalizeText(value).toUpperCase().match(/\bQ[1-4]\b/);

  return match?.[0] || "";
}

function normalizeMetricValue(value) {
  const text = normalizeText(value);
  const match = text.match(/\b\d+(?:[.,]\d+)?\b/);

  return match ? match[0].replace(",", ".") : "";
}

function normalizeIndexingSourceKey(value) {
  const comparable = normalizeComparableText(value);

  if (!comparable) return "manual";
  if (comparable.includes("scopus") || comparable.includes("citescore") || comparable.includes("journal rank")) return "scopus";
  if (comparable.includes("scimago") || comparable.includes("sjr")) return "scimago";
  if (comparable.includes("doaj")) return "doaj";
  if (comparable.includes("openalex")) return "openalex";

  return "manual";
}

function normalizeIndexingPlatform(value, sourceKey = "") {
  const comparable = normalizeComparableText(value);
  const normalizedSource = normalizeIndexingSourceKey(sourceKey || value);

  if (normalizedSource === "scopus") return "Scopus";
  if (normalizedSource === "scimago") return "SCImago";
  if (normalizedSource === "doaj") return "DOAJ";
  if (normalizedSource === "openalex") return "OpenAlex";
  if (comparable.includes("web of science") || comparable.includes("clarivate")) return "Web of Science";
  if (["scie", "ssci", "ahci"].includes(comparable)) return comparable.toUpperCase();
  if (comparable === "other") return "Other";

  return normalizeText(value);
}

function createIndexingResult({
  platform = "",
  source = "",
  sourceKey = "",
  category = "",
  quartile = "",
  sjr = "",
  citeScore = "",
  impactFactor = "",
  indexedUrl = "",
  year = null,
  primaryCategory = false,
} = {}) {
  const normalizedSourceKey = normalizeIndexingSourceKey(sourceKey || source || platform);
  const normalizedPlatform = normalizeIndexingPlatform(platform || source, normalizedSourceKey);

  if (!normalizedPlatform || normalizedSourceKey === "manual") {
    return null;
  }

  const normalizedQuartile = normalizeQuartile(quartile);
  const normalizedSjr = normalizeMetricValue(sjr);
  const normalizedCiteScore = normalizeMetricValue(citeScore);

  return {
    source: normalizedPlatform,
    platform: normalizedPlatform,
    sourceKey: normalizedSourceKey,
    source_key: normalizedSourceKey,
    category: normalizeText(category),
    quartile: normalizedQuartile,
    sjr: normalizedSjr,
    citeScore: normalizedCiteScore,
    cite_score: normalizedCiteScore,
    citescore: normalizedCiteScore,
    impactFactor: normalizeText(impactFactor),
    impact_factor: normalizeText(impactFactor),
    indexedUrl: normalizeText(indexedUrl),
    indexed_url: normalizeText(indexedUrl),
    year: normalizeYear(year),
    primaryCategory: Boolean(primaryCategory),
    primary_category: Boolean(primaryCategory),
    quartileVerified: false,
    quartile_verified: false,
    quartileSource: "manual",
    quartile_source: "manual",
    quartileVerificationStatus: normalizedQuartile ? "manual_required" : "empty",
    quartile_verification_status: normalizedQuartile ? "manual_required" : "empty",
    quartileSelectionReason: normalizedQuartile ? "not_selected" : "no_quartile",
    quartile_selection_reason: normalizedQuartile ? "not_selected" : "no_quartile",
    indexingVerified: true,
    indexing_verified: true,
    indexingSource: normalizedSourceKey,
    indexing_source: normalizedSourceKey,
  };
}

function getCachedIndexing(metadata = {}) {
  const indexing = metadata.raw_json?._indexing;

  return Array.isArray(indexing)
    ? indexing
        .map((item) => ({
          source: normalizeIndexingPlatform(item?.source || item?.platform, item?.sourceKey || item?.source_key || item?.indexingSource || item?.indexing_source),
          platform: normalizeIndexingPlatform(item?.platform || item?.source, item?.sourceKey || item?.source_key || item?.indexingSource || item?.indexing_source),
          sourceKey: normalizeIndexingSourceKey(item?.sourceKey || item?.source_key || item?.indexingSource || item?.indexing_source || item?.source),
          source_key: normalizeIndexingSourceKey(item?.sourceKey || item?.source_key || item?.indexingSource || item?.indexing_source || item?.source),
          category: normalizeText(item?.category),
          quartile: normalizeQuartile(item?.quartile),
          impactFactor: normalizeText(item?.impactFactor || item?.impact_factor),
          sjr: normalizeMetricValue(item?.sjr),
          citeScore: normalizeMetricValue(item?.citeScore || item?.cite_score || item?.citescore),
          cite_score: normalizeMetricValue(item?.citeScore || item?.cite_score || item?.citescore),
          indexedUrl: normalizeText(item?.indexedUrl || item?.indexed_url),
          indexed_url: normalizeText(item?.indexedUrl || item?.indexed_url),
          year: normalizeYear(item?.year),
          primaryCategory: Boolean(item?.primaryCategory ?? item?.primary_category),
          primary_category: Boolean(item?.primaryCategory ?? item?.primary_category),
          quartileVerified: Boolean(item?.quartileVerified ?? item?.quartile_verified),
          quartile_verified: Boolean(item?.quartileVerified ?? item?.quartile_verified),
          quartileSource: normalizeIndexingSourceKey(item?.quartileSource || item?.quartile_source),
          quartile_source: normalizeIndexingSourceKey(item?.quartileSource || item?.quartile_source),
          quartileVerificationStatus: normalizeText(item?.quartileVerificationStatus || item?.quartile_verification_status || (item?.quartile ? "manual_required" : "empty")),
          quartile_verification_status: normalizeText(item?.quartileVerificationStatus || item?.quartile_verification_status || (item?.quartile ? "manual_required" : "empty")),
          quartileSelectionReason: normalizeText(item?.quartileSelectionReason || item?.quartile_selection_reason),
          quartile_selection_reason: normalizeText(item?.quartileSelectionReason || item?.quartile_selection_reason),
          indexingVerified: Boolean(item?.indexingVerified ?? item?.indexing_verified),
          indexing_verified: Boolean(item?.indexingVerified ?? item?.indexing_verified),
          indexingSource: normalizeIndexingSourceKey(item?.indexingSource || item?.indexing_source || item?.sourceKey || item?.source_key || item?.source),
          indexing_source: normalizeIndexingSourceKey(item?.indexingSource || item?.indexing_source || item?.sourceKey || item?.source_key || item?.source),
        }))
        .filter((item) => item.source || item.category || item.quartile || item.impactFactor || item.sjr || item.citeScore || item.indexedUrl)
    : [];
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function normalizeCategory(value) {
  const text = normalizeText(value);

  if (!text || normalizeQuartile(text) || normalizeYear(text) || normalizeMetricValue(text) === text) {
    return "";
  }

  return text;
}

function uniqueIndexingItems(items = []) {
  const seen = new Set();
  const uniqueItems = [];

  for (const item of items) {
    const key = [
      item.sourceKey || item.source_key || item.source,
      item.category || "",
      item.quartile || "",
      item.year || "",
      item.indexedUrl || item.indexed_url || "",
    ].join("|").toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

function splitCategoryKeys(category = "") {
  return normalizeText(category)
    .split(/[;,|]/)
    .map(normalizeComparableText)
    .filter(Boolean);
}

function markQuartileSelection(item, selected, status, reason) {
  return {
    ...item,
    quartileVerified: Boolean(selected),
    quartile_verified: Boolean(selected),
    quartileSource: selected ? normalizeIndexingSourceKey(item.sourceKey || item.source_key || item.source) : "manual",
    quartile_source: selected ? normalizeIndexingSourceKey(item.sourceKey || item.source_key || item.source) : "manual",
    quartileVerificationStatus: selected ? "verified" : status,
    quartile_verification_status: selected ? "verified" : status,
    quartileSelectionReason: selected ? reason : reason || status,
    quartile_selection_reason: selected ? reason : reason || status,
  };
}

function sameIndexingCandidate(first = {}, second = {}) {
  return normalizeIndexingSourceKey(first.sourceKey || first.source_key || first.source) === normalizeIndexingSourceKey(second.sourceKey || second.source_key || second.source)
    && normalizeComparableText(first.category) === normalizeComparableText(second.category)
    && normalizeQuartile(first.quartile) === normalizeQuartile(second.quartile)
    && (first.year || "") === (second.year || "");
}

function selectQuartileCandidate(items = [], publicationYear) {
  const rowsWithQuartile = items.filter((item) => normalizeQuartile(item.quartile));
  const targetYear = normalizeYear(publicationYear);

  if (!rowsWithQuartile.length) {
    return { selected: null, status: "manual_required", reason: "no_verified_quartile_rows" };
  }

  if (!targetYear) {
    return { selected: null, status: "manual_required", reason: "publication_year_missing" };
  }

  const yearCandidates = targetYear
    ? rowsWithQuartile.filter((item) => normalizeYear(item.year) === targetYear)
    : rowsWithQuartile;

  if (targetYear && !yearCandidates.length) {
    return { selected: null, status: "manual_required", reason: "no_quartile_for_publication_year" };
  }

  const candidates = yearCandidates;
  const categoryKeys = uniqueValues(candidates.flatMap((item) => splitCategoryKeys(item.category)));

  if (!categoryKeys.length) {
    return { selected: null, status: "manual_required", reason: "category_missing" };
  }

  if (categoryKeys.length > 1) {
    const primaryCandidates = candidates.filter((item) => Boolean(item.primaryCategory || item.primary_category));

    if (primaryCandidates.length === 1) {
      return { selected: primaryCandidates[0], status: "verified", reason: "primary_category_from_provider" };
    }

    return { selected: null, status: "manual_required", reason: "multiple_categories_without_primary" };
  }

  const quartiles = uniqueValues(candidates.map((item) => normalizeQuartile(item.quartile)));

  if (quartiles.length > 1) {
    return { selected: null, status: "manual_required", reason: "conflicting_quartiles_for_category" };
  }

  return { selected: candidates[0], status: "verified", reason: targetYear ? "single_category_year_match" : "single_category_no_publication_year" };
}

function createIndexingBundle({ provider, platform, source, sourceKey, rows = [], publicationYear, indexedUrl = "" } = {}) {
  const items = uniqueIndexingItems(rows
    .map((row) => createIndexingResult({
      platform,
      source: row.source || source,
      sourceKey: row.sourceKey || sourceKey,
      category: row.category || row.subject,
      quartile: row.quartile,
      sjr: row.sjr,
      citeScore: row.citeScore || row.cite_score,
      impactFactor: row.impactFactor || row.impact_factor,
      indexedUrl: row.indexedUrl || indexedUrl,
      year: row.year,
      primaryCategory: Boolean(row.primaryCategory || row.primary_category),
    }))
    .filter(Boolean));
  const selection = selectQuartileCandidate(items, publicationYear);
  const markedItems = items.map((item) => markQuartileSelection(
    item,
    selection.selected && sameIndexingCandidate(item, selection.selected),
    selection.status,
    selection.reason
  ));

  return {
    provider,
    status: selection.status,
    reason: selection.reason,
    selected: selection.selected
      ? markedItems.find((item) => sameIndexingCandidate(item, selection.selected)) || null
      : null,
    items: markedItems,
  };
}

function summarizeIndexingItems(items = []) {
  return {
    categoriesFound: uniqueValues(items.map((item) => item.category).filter(Boolean)),
    quartilesFound: uniqueValues(items.map((item) => item.quartile).filter(Boolean)),
  };
}

function logQuartileLookup(context, provider, bundle, reason = "") {
  const items = bundle?.items || [];
  const selected = bundle?.selected || null;
  const summary = summarizeIndexingItems(items);

  console.info("quartile_lookup_debug", {
    doi: context.doi || "",
    journalTitle: context.journalTitle || "",
    issn: context.issns || [],
    provider,
    year: context.year || null,
    categoriesFound: summary.categoriesFound,
    quartilesFound: summary.quartilesFound,
    selectedCategory: selected?.category || "",
    selectedQuartile: selected?.quartile || "",
    reason: reason || bundle?.reason || "not_selected",
  });
}

function createQuartileLookupContext(metadata = {}) {
  return {
    doi: metadata.doi || "",
    journalTitle: metadata.container_title || "",
    issns: getMetadataIssns(metadata),
    year: normalizeYear(metadata.year),
  };
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
  const values = Array.isArray(value) ? value : [value];

  return values
    .map((item) => normalizeText(
      item?.name
      || item?.affiliation
      || item?.institution
      || item?.organization
      || item?.value
      || item
    ))
    .filter(Boolean)
    .join("; ");
}

function createFieldSource(value, sourceWhenPresent = "api") {
  const normalizedValue = Array.isArray(value)
    ? value.filter(Boolean)
    : normalizeText(value);

  return {
    value: normalizedValue,
    source: Array.isArray(normalizedValue) ? normalizedValue.length ? sourceWhenPresent : "empty" : normalizedValue ? sourceWhenPresent : "empty",
  };
}

function getFirstAuthorAffiliation(authors = []) {
  return (Array.isArray(authors) ? authors : [])
    .map((author) => normalizeAffiliations(author?.affiliation || author?.affiliations || author?.institution || author?.organization))
    .find(Boolean) || "";
}

function buildMetadataFieldSources(metadata = {}) {
  const indexing = Array.isArray(metadata.indexing) ? metadata.indexing : [];
  const firstIndexing = indexing.find((item) => item?.source || item?.category || item?.quartile || item?.impactFactor || item?.impact_factor || item?.sjr || item?.citeScore || item?.cite_score) || {};
  const firstImpactFactor = firstIndexing.impactFactor || firstIndexing.impact_factor || "";
  const firstSjr = firstIndexing.sjr || "";
  const firstCiteScore = firstIndexing.citeScore || firstIndexing.cite_score || firstIndexing.citescore || "";
  const indexingFieldSource = metadata.indexingVerified || metadata.indexing_verified || firstIndexing.indexingVerified || firstIndexing.indexing_verified
    ? "lookup"
    : "manual";
  const quartileFieldSource = metadata.quartileVerified || metadata.quartile_verified || firstIndexing.quartileVerified || firstIndexing.quartile_verified
    ? "lookup"
    : "manual";

  return {
    doi: createFieldSource(metadata.doi),
    title: createFieldSource(metadata.title),
    authors: createFieldSource(Array.isArray(metadata.authors) ? metadata.authors.map((author) => author?.fullName || author?.full_name || author?.name).filter(Boolean) : []),
    authorAffiliation: createFieldSource(getFirstAuthorAffiliation(metadata.authors)),
    publicationType: createFieldSource(metadata.type),
    venue: createFieldSource(metadata.container_title),
    publisher: createFieldSource(metadata.publisher),
    publicationDate: createFieldSource(metadata.published_date),
    publicationYear: createFieldSource(metadata.year),
    sourceUrl: createFieldSource(metadata.source_url),
    volume: createFieldSource(metadata.volume),
    issue: createFieldSource(metadata.issue),
    pages: createFieldSource(metadata.pages),
    issn: createFieldSource(metadata.issn || getRawIdentifierValue(metadata.raw_json, "ISSN")),
    isbn: createFieldSource(metadata.isbn || getRawIdentifierValue(metadata.raw_json, "ISBN")),
    abstract: createFieldSource(metadata.abstract),
    conferenceLocation: createFieldSource(metadata.conferenceLocation || metadata.conference_location),
    indexingPlatform: createFieldSource(firstIndexing.source, indexingFieldSource),
    indexingCategory: createFieldSource(metadata.indexingCategory || metadata.indexing_category || (quartileFieldSource === "lookup" ? firstIndexing.category : ""), quartileFieldSource),
    quartile: createFieldSource(metadata.quartile || (quartileFieldSource === "lookup" ? firstIndexing.quartile : ""), quartileFieldSource),
    sjr: createFieldSource(firstSjr, indexingFieldSource),
    citeScore: createFieldSource(firstCiteScore, indexingFieldSource),
    impactFactor: createFieldSource(firstImpactFactor, indexingFieldSource),
  };
}

function normalizeLocationValue(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeLocationValue(item);

      if (normalized) {
        return normalized;
      }
    }

    return "";
  }

  if (value && typeof value === "object") {
    const namedValue = normalizeText(value.name || value.label || value.value);
    const city = normalizeLocationValue(value.city);
    const country = normalizeLocationValue(value.country);

    if (namedValue) {
      return namedValue;
    }

    if (city && country) {
      return `${city}, ${country}`;
    }

    return normalizeLocationValue(value.location)
      || normalizeLocationValue(value.place)
      || city
      || country;
  }

  return normalizeText(value);
}

function getLocationCandidates(source = {}) {
  if (!source || typeof source !== "object") {
    return [];
  }

  return [
    source.location,
    source.place,
    source["venue-location"],
    source.venueLocation,
    source.venue_location,
    source.city && source.country ? { city: source.city, country: source.country } : "",
    source.city,
    source.country,
    source.venue?.location,
    source.venue?.place,
    source.venue?.city && source.venue?.country ? { city: source.venue.city, country: source.venue.country } : "",
    source.venue?.city,
    source.venue?.country,
  ];
}

function normalizeConferenceLocation(data = {}) {
  const candidates = [
    ...getLocationCandidates(data.event),
    ...getLocationCandidates(data),
    ...getLocationCandidates(data.raw_json),
    ...getLocationCandidates(data.raw_json?._doi_org),
    ...getLocationCandidates(data.raw_json?._crossref),
  ];

  for (const candidate of candidates) {
    const value = normalizeLocationValue(candidate);

    if (value) {
      return value;
    }
  }

  return "";
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

  const primaryRaw = primary.raw_json || {};
  const fallbackRaw = fallback.raw_json || {};

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
    conferenceLocation: preferText(primary.conferenceLocation, fallback.conferenceLocation),
    conference_location: preferText(primary.conference_location, fallback.conference_location),
    type: preferText(primary.type, fallback.type),
    abstract: preferText(primary.abstract, fallback.abstract),
    source_url: preferText(primary.source_url, fallback.source_url),
    raw_json: {
      ...fallbackRaw,
      ...primaryRaw,
      _doi_org: primaryRaw._doi_org || fallbackRaw._doi_org || {},
      _crossref: primaryRaw._crossref || fallbackRaw._crossref || {},
      _openalex: primaryRaw._openalex || fallbackRaw._openalex || {},
    },
  };
}

function shouldRefreshCachedMetadata(metadata = {}) {
  const type = normalizeText(metadata.type);
  const hasCrossrefSnapshot = Boolean(metadata.raw_json?._crossref);
  const comparableType = normalizeComparableText(type).replace(/\s+/g, "_");
  const hasCachedIssn = hasText(metadata.issn) || hasText(getRawIdentifierValue(metadata.raw_json, "ISSN"));
  const hasCachedIsbn = hasText(metadata.isbn) || hasText(getRawIdentifierValue(metadata.raw_json, "ISBN"));
  const isConferenceType = ["proceedings_article", "conference_paper"].includes(comparableType);

  if (!hasCrossrefSnapshot) {
    if (["journal_article", "article_journal"].includes(comparableType) && !hasCachedIssn) {
      return true;
    }

    if (isConferenceType && !normalizeConferenceLocation(metadata)) {
      return true;
    }

    if (["book", "book_chapter", "chapter", "reference_book"].includes(comparableType) && !hasCachedIsbn) {
      return true;
    }
  }

  return type === "proceedings-article" && !isFullDate(metadata.published_date) && !hasCrossrefSnapshot;
}

function mapMetadata(data, doi) {
  const title = Array.isArray(data.title) ? data.title[0] || "" : data.title || "";
  const containerTitle = Array.isArray(data["container-title"])
    ? data["container-title"][0] || ""
    : data["container-title"] || data.event?.name || "";
  const conferenceLocation = normalizeConferenceLocation(data);
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
    conferenceLocation,
    conference_location: conferenceLocation,
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

  const metadata = {
    issn: "",
    isbn: "",
    ...rows[0],
    abstract: normalizeAbstractText(rows[0].abstract),
  };
  const conferenceLocation = normalizeConferenceLocation(metadata);

  metadata.conferenceLocation = conferenceLocation;
  metadata.conference_location = conferenceLocation;

  if (!hasIdentifierColumns) {
    return metadata;
  }

  const rawIssn = getRawIdentifierValue(metadata.raw_json, "ISSN");
  const rawIsbn = getRawIdentifierValue(metadata.raw_json, "ISBN");
  const nextIssn = hasText(metadata.issn) ? metadata.issn : rawIssn;
  const nextIsbn = hasText(metadata.isbn) ? metadata.isbn : rawIsbn;

  if (nextIssn !== metadata.issn || nextIsbn !== metadata.isbn) {
    await db.query(
      `update publication_metadata
       set issn = $2,
           isbn = $3,
           updated_at = now()
       where doi = $1`,
      [doi, nextIssn, nextIsbn]
    );

    metadata.issn = nextIssn;
    metadata.isbn = nextIsbn;
  }

  return metadata;
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

  const metadata = mapMetadata(await response.json(), doi);

  return {
    ...metadata,
    raw_json: {
      ...(metadata.raw_json || {}),
      _doi_org: metadata.raw_json || {},
    },
  };
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

  const metadata = mapMetadata(data.message, doi);

  return {
    ...metadata,
    raw_json: {
      ...(metadata.raw_json || {}),
      _crossref: metadata.raw_json || {},
    },
  };
}

function mapOpenAlexWork(data = {}, doi) {
  const primaryLocation = data.primary_location || {};
  const source = primaryLocation.source || {};
  const hostVenue = data.host_venue || {};
  const authorships = Array.isArray(data.authorships) ? data.authorships : [];
  const authors = authorships
    .map((authorship, index) => {
      const author = authorship.author || {};

      return {
        fullName: normalizeText(author.display_name),
        givenName: "",
        familyName: "",
        orcid: normalizeOrcid(author.orcid),
        affiliation: normalizeAffiliations(authorship.institutions?.map((institution) => institution.display_name)),
        isMainAuthor: index === 0,
        position: index + 1,
      };
    })
    .filter((author) => author.fullName || author.orcid || author.affiliation);
  const issnValues = uniqueValues([
    source.issn,
    source.issn_l,
    hostVenue.issn,
    hostVenue.issn_l,
  ].flatMap((value) => (Array.isArray(value) ? value : [value])));
  const type = normalizeText(data.type_crossref || data.type);

  return {
    doi,
    title: normalizeText(data.title || data.display_name),
    authors,
    container_title: normalizeText(source.display_name || hostVenue.display_name),
    conferenceLocation: "",
    conference_location: "",
    publisher: normalizeText(source.host_organization_name || hostVenue.publisher),
    published_date: normalizeText(data.publication_date),
    year: normalizeYear(data.publication_year),
    volume: "",
    issue: "",
    pages: "",
    issn: issnValues[0] || "",
    isbn: "",
    type,
    abstract: "",
    source_url: normalizeText(primaryLocation.landing_page_url || data.id),
    raw_json: {
      _openalex: data,
    },
  };
}

async function fetchFromOpenAlex(doi) {
  const response = await fetchJson(`${OPENALEX_WORKS_API_URL}/doi:${encodeURIComponent(doi)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (response.status === 404) {
    throw new DoiLookupError("doi_not_found", "Metadata per kete DOI nuk u gjet.", 404);
  }

  if (!response.ok) {
    throw new DoiLookupError("external_lookup_failed", "OpenAlex nuk u pergjigj me sukses.", 502);
  }

  return mapOpenAlexWork(await response.json(), doi);
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

function getScopusIssnsFromResponse(data) {
  const values = [];

  walkValues(data, (key, value) => {
    const normalizedKey = normalizeComparableText(key);

    if (normalizedKey.includes("issn")) {
      values.push(...(Array.isArray(value) ? value : [value]));
    }
  });

  return uniqueValues(values.map(normalizeIssn).filter((value) => value.length === 8));
}

function getScopusSourceTitlesFromResponse(data) {
  const values = [];

  walkValues(data, (key, value) => {
    const normalizedKey = normalizeComparableText(key);

    if (
      normalizedKey === "prism publicationname"
      || normalizedKey === "publicationname"
      || normalizedKey === "source title"
      || normalizedKey === "sourcetitle"
    ) {
      values.push(...(Array.isArray(value) ? value : [value]));
    }
  });

  return uniqueValues(values);
}

function hasScopusResults(data) {
  const serialEntries = data?.["serial-metadata-response"]?.entry;
  const searchEntries = data?.["search-results"]?.entry;
  const entries = [
    ...(Array.isArray(serialEntries) ? serialEntries : serialEntries ? [serialEntries] : []),
    ...(Array.isArray(searchEntries) ? searchEntries : searchEntries ? [searchEntries] : []),
  ];

  return entries.length > 0;
}

function getFirstMatchingValue(data, predicate) {
  let result = "";

  walkValues(data, (key, value) => {
    if (result || value === null || value === undefined || typeof value === "object") {
      return;
    }

    if (predicate(normalizeComparableText(key), value)) {
      result = normalizeText(value);
    }
  });

  return result;
}

function getBestCiteScoreFromResponse(data) {
  return getFirstMatchingValue(data, (key, value) =>
    key.includes("citescore") && normalizeMetricValue(value)
  );
}

function getObjectQuartile(object = {}) {
  for (const [key, value] of Object.entries(object)) {
    if (value && typeof value === "object") {
      continue;
    }

    if (normalizeComparableText(key).includes("quartile")) {
      const quartile = normalizeQuartile(value);

      if (quartile) {
        return quartile;
      }
    }
  }

  return "";
}

function getCategoryFromValue(value) {
  if (Array.isArray(value)) {
    return uniqueValues(value.map(getCategoryFromValue)).join("; ");
  }

  if (value && typeof value === "object") {
    return normalizeCategory(
      value.$
      || value._
      || value.name
      || value.display_name
      || value.displayName
      || value.subject
      || value.category
      || value["@name"]
      || value["@abbrev"]
    );
  }

  return normalizeCategory(value);
}

function getObjectCategories(object = {}) {
  const categories = [];

  for (const [key, value] of Object.entries(object)) {
    const normalizedKey = normalizeComparableText(key);

    if (
      normalizedKey.includes("subject area")
      || normalizedKey.includes("subjectarea")
      || normalizedKey === "subject"
      || normalizedKey.includes("category")
    ) {
      categories.push(...toArray(value).map(getCategoryFromValue));
    }
  }

  return uniqueValues(categories);
}

function getObjectYear(object = {}) {
  return normalizeYear(
    object["@year"]
    || object.year
    || object.citeScoreYear
    || object.citescoreYear
    || object.coverYear
  );
}

function hasPrimaryCategoryFlag(object = {}) {
  if (!object || typeof object !== "object") {
    return false;
  }

  return Object.entries(object).some(([key, value]) => {
    const normalizedKey = normalizeComparableText(key);
    const normalizedValue = normalizeComparableText(value);

    return normalizedKey.includes("primary")
      && ["true", "1", "yes", "primary"].includes(normalizedValue);
  });
}

function walkObjects(value, visitor, context = {}) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkObjects(item, visitor, context));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const year = getObjectYear(value) || context.year || null;
  const nextContext = { ...context, year };
  visitor(value, nextContext);

  Object.values(value).forEach((entryValue) => walkObjects(entryValue, visitor, nextContext));
}

function getScopusQuartileRows(data) {
  const rows = [];

  walkObjects(data, (object, context) => {
    const directQuartile = getObjectQuartile(object);
    const directCategories = getObjectCategories(object);
    const citeScore = getBestCiteScoreFromResponse(object);
    const primaryCategory = hasPrimaryCategoryFlag(object);

    if (directQuartile && directCategories.length) {
      directCategories.forEach((category) => {
        rows.push({
          source: "Scopus CiteScore",
          category,
          quartile: directQuartile,
          citeScore,
          year: context.year,
          primaryCategory,
        });
      });
    }

    const rankItems = [
      ...toArray(object.citeScoreSubjectRank),
      ...toArray(object.citescoreSubjectRank),
      ...toArray(object.subjectRank),
    ];
    const areaItems = [
      ...toArray(object.citeScoreSubjectArea),
      ...toArray(object.citescoreSubjectArea),
      ...toArray(object.subjectArea),
      ...toArray(object.subject_area),
    ];

    rankItems.forEach((rankItem, index) => {
      const quartile = getObjectQuartile(rankItem);

      if (!quartile) {
        return;
      }

      const categories = uniqueValues([
        ...getObjectCategories(rankItem),
        getCategoryFromValue(areaItems[index]),
      ]);

      categories.forEach((category) => {
        rows.push({
          source: "Scopus CiteScore",
          category,
          quartile,
          citeScore,
          year: context.year,
          primaryCategory: primaryCategory || hasPrimaryCategoryFlag(rankItem) || hasPrimaryCategoryFlag(areaItems[index] || {}),
        });
      });
    });
  });

  return rows;
}

async function fetchScopusIndexingByTitle(title, publicationYear) {
  const apiKey = getScopusApiKey();
  const normalizedTitle = normalizeText(title);

  if (!apiKey || !normalizedTitle) {
    return null;
  }

  const url = new URL(SCOPUS_SERIAL_TITLE_SEARCH_API_URL);
  url.searchParams.set("title", normalizedTitle);
  url.searchParams.set("view", "CITESCORE");

  const response = await fetchJson(url.toString(), {
    headers: getScopusHeaders(),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!hasScopusResults(data)) {
    return null;
  }

  const citeScore = getBestCiteScoreFromResponse(data);
  const rows = getScopusQuartileRows(data).map((row) => ({
    ...row,
    citeScore: row.citeScore || citeScore,
  }));

  return createIndexingBundle({
    provider: "scopus_title",
    platform: "Scopus",
    source: "Scopus CiteScore",
    sourceKey: "scopus",
    rows,
    publicationYear,
    indexedUrl: url.toString(),
  });
}

async function fetchScopusIndexingByIssn(issn, publicationYear) {
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
  if (!hasScopusResults(data)) {
    return null;
  }

  const citeScore = getBestCiteScoreFromResponse(data);
  const rows = getScopusQuartileRows(data).map((row) => ({
    ...row,
    citeScore: row.citeScore || citeScore,
  }));

  return createIndexingBundle({
    provider: "scopus_issn",
    platform: "Scopus",
    source: "Scopus CiteScore",
    sourceKey: "scopus",
    rows,
    publicationYear,
    indexedUrl: `${SCOPUS_SERIAL_TITLE_API_URL}/${encodeURIComponent(normalizedIssn)}?view=CITESCORE`,
  });
}

async function fetchScopusIndexingByDoi(metadata = {}) {
  const apiKey = getScopusApiKey();
  const doi = normalizeDoi(metadata.doi);

  if (!apiKey || !doi) {
    return null;
  }

  const url = new URL(SCOPUS_SEARCH_API_URL);
  url.searchParams.set("query", `DOI(${doi})`);
  url.searchParams.set("view", "COMPLETE");

  const response = await fetchJson(url.toString(), {
    headers: getScopusHeaders(),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!hasScopusResults(data)) {
    return null;
  }

  const citeScore = getBestCiteScoreFromResponse(data);
  const rows = getScopusQuartileRows(data).map((row) => ({
    ...row,
    citeScore: row.citeScore || citeScore,
  }));

  if (rows.length) {
    return createIndexingBundle({
      provider: "scopus_doi",
      platform: "Scopus",
      source: "Scopus CiteScore",
      sourceKey: "scopus",
      rows,
      publicationYear: metadata.year,
      indexedUrl: url.toString(),
    });
  }

  const issns = uniqueValues([...getMetadataIssns(metadata), ...getScopusIssnsFromResponse(data)]);

  for (const issn of issns) {
    const indexing = await fetchScopusIndexingByIssn(issn, metadata.year);

    if (indexing?.selected?.quartile) {
      return indexing;
    }
  }

  const titles = uniqueValues([
    metadata.container_title,
    ...getScopusSourceTitlesFromResponse(data),
  ]);

  for (const title of titles) {
    const indexing = await fetchScopusIndexingByTitle(title, metadata.year);

    if (indexing?.selected?.quartile) {
      return indexing;
    }
  }

  return null;
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
        category: cells[1] || "",
        citeScore: normalizeMetricValue(cells.find((cell) => normalizeComparableText(cell).includes("citescore")) || ""),
      });
    }
  }

  return rows;
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

  const rows = parseJournalRankQuartiles(await quartilesResponse.text());

  return createIndexingBundle({
    provider: "journalrank",
    platform: "Scopus",
    source: "Journal Rank CiteScore",
    sourceKey: "scopus",
    rows,
    publicationYear,
    indexedUrl: quartilesUrl,
  });
}

function parseScimagoSearchResult(html) {
  const normalized = normalizeText(html);
  const hrefMatch = normalized.match(/href=["']([^"']*journalsearch\.php\?q=\d+[^"']*)["']/i);

  if (!hrefMatch) {
    return null;
  }

  const href = decodeHtmlEntities(hrefMatch[1]);
  const indexedUrl = href.startsWith("http") ? href : `${SCIMAGO_BASE_URL}/${href.replace(/^\/+/, "")}`;
  const nearby = normalized.slice(Math.max(hrefMatch.index - 1500, 0), hrefMatch.index + 3000);
  const quartile = normalizeQuartile(nearby);
  const sjr = normalizeMetricValue(nearby.match(/\bSJR\b[\s\S]{0,120}?(\d+(?:[.,]\d+)?)/i)?.[1]);

  return {
    quartile,
    sjr,
    indexedUrl,
  };
}

function extractScimagoCategory(html) {
  const categoryLinks = [...normalizeText(html).matchAll(/<a\b[^>]*href=["'][^"']*journalsearch\.php\?category=[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ")))
    .filter(Boolean);
  const areaLinks = [...normalizeText(html).matchAll(/<a\b[^>]*href=["'][^"']*journalsearch\.php\?area=[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ")))
    .filter(Boolean);

  return uniqueValues([...categoryLinks, ...areaLinks]).slice(0, 3).join("; ");
}

function extractScimagoCategoryFromCells(cells = []) {
  return cells
    .map((cell) => normalizeCategory(cell))
    .find((cell) =>
      cell
      && !/^SJR$/i.test(cell)
      && !/^H\s*index$/i.test(cell)
      && !/^Year$/i.test(cell)
      && !/^Quartile$/i.test(cell)
      && !normalizeQuartile(cell)
      && !normalizeYear(cell)
      && !/^\d+(?:[.,]\d+)?$/.test(cell)
    ) || "";
}

function parseScimagoQuartiles(html) {
  const rows = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html))) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((cell) => decodeHtmlEntities(cell[1].replace(/<[^>]+>/g, " ")));
    const rowText = cells.join(" ");
    const quartile = normalizeQuartile(rowText);
    const year = normalizeYear(cells.find((cell) => /^(?:19|20)\d{2}$/.test(normalizeText(cell))));

    if (quartile) {
      const sjr = normalizeMetricValue(cells[1]);
      const category = extractScimagoCategoryFromCells(cells);

      rows.push({
        source: "SCImago SJR",
        category,
        quartile,
        year,
        sjr,
      });
    }
  }

  return rows;
}

async function fetchScimagoIndexingByIssn(issn, publicationYear) {
  const formattedIssn = formatIssn(issn);

  if (!formattedIssn) {
    return null;
  }

  const searchResponse = await fetchJson(`${SCIMAGO_BASE_URL}/journalsearch.php?q=${encodeURIComponent(formattedIssn)}&tip=iss`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (!searchResponse.ok) {
    return null;
  }

  const searchResult = parseScimagoSearchResult(await searchResponse.text());

  if (!searchResult?.indexedUrl) {
    return null;
  }

  const detailsResponse = await fetchJson(searchResult.indexedUrl, {
    headers: {
      Accept: "text/html",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (!detailsResponse.ok) {
    return null;
  }

  const detailsHtml = await detailsResponse.text();
  const fallbackCategory = extractScimagoCategory(detailsHtml);
  const rows = parseScimagoQuartiles(detailsHtml).map((row) => ({
    ...row,
    category: row.category || fallbackCategory,
    sjr: row.sjr || searchResult.sjr,
  }));

  return createIndexingBundle({
    provider: "scimago",
    platform: "SCImago",
    source: "SCImago SJR",
    sourceKey: "scimago",
    rows,
    publicationYear,
    indexedUrl: searchResult.indexedUrl,
  });
}

function sourceTitleMatches(inputTitle, sourceTitle) {
  const input = normalizeComparableText(inputTitle);
  const source = normalizeComparableText(sourceTitle);

  if (!input || !source) {
    return false;
  }

  return input === source
    || (input.length >= 10 && source.includes(input))
    || (source.length >= 10 && input.includes(source));
}

function getOpenAlexCategory(source = {}) {
  const concepts = Array.isArray(source.x_concepts) ? source.x_concepts : [];
  const bestConcept = concepts
    .filter((concept) => normalizeText(concept?.display_name))
    .sort((first, second) => Number(second.score || 0) - Number(first.score || 0))[0];

  return normalizeText(bestConcept?.display_name);
}

function mapOpenAlexSourceToIndexing(source = {}, indexedUrl = "") {
  const displayName = normalizeText(source.display_name);

  if (!displayName && !source.id) {
    return null;
  }

  return createIndexingResult({
    platform: "OpenAlex",
    source: "OpenAlex",
    sourceKey: "openalex",
    category: getOpenAlexCategory(source),
    indexedUrl: indexedUrl || source.id || "",
  });
}

async function fetchOpenAlexIndexingByIssn(issn) {
  const formattedIssn = formatIssn(issn);

  if (!formattedIssn) {
    return null;
  }

  const response = await fetchJson(`${OPENALEX_SOURCES_API_URL}/issn:${encodeURIComponent(formattedIssn)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (!response.ok) {
    return null;
  }

  return mapOpenAlexSourceToIndexing(await response.json().catch(() => null), response.url);
}

async function fetchOpenAlexIndexingByTitle(title) {
  const normalizedTitle = normalizeText(title);

  if (!normalizedTitle) {
    return null;
  }

  const url = new URL(OPENALEX_SOURCES_API_URL);
  url.searchParams.set("search", normalizedTitle);
  url.searchParams.set("per-page", "5");

  const response = await fetchJson(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  const source = (Array.isArray(data?.results) ? data.results : [])
    .find((item) => sourceTitleMatches(normalizedTitle, item?.display_name));

  return source ? mapOpenAlexSourceToIndexing(source, url.toString()) : null;
}

function mapDoajJournalToIndexing(journal = {}, indexedUrl = "") {
  const bibjson = journal.bibjson || {};
  const title = normalizeText(bibjson.title || journal.title);

  if (!title) {
    return null;
  }

  const subjects = Array.isArray(bibjson.subject)
    ? bibjson.subject.map((item) => item?.term || item?.code || item).filter(Boolean)
    : [];

  return createIndexingResult({
    platform: "DOAJ",
    source: "DOAJ",
    sourceKey: "doaj",
    category: uniqueValues(subjects).slice(0, 3).join("; "),
    indexedUrl: indexedUrl || journal.id || "",
  });
}

async function fetchDoajIndexingByQuery(query, titleForMatch = "") {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return null;
  }

  const response = await fetchJson(`${DOAJ_JOURNALS_API_URL}/${encodeURIComponent(normalizedQuery)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  const results = Array.isArray(data?.results) ? data.results : [];
  const journal = titleForMatch
    ? results.find((item) => sourceTitleMatches(titleForMatch, item?.bibjson?.title || item?.title))
    : results[0];

  return journal ? mapDoajJournalToIndexing(journal, response.url) : null;
}

async function fetchDoajIndexingByIssn(issn) {
  const formattedIssn = formatIssn(issn);

  return formattedIssn ? fetchDoajIndexingByQuery(`issn:${formattedIssn}`) : null;
}

async function fetchDoajIndexingByTitle(title) {
  const normalizedTitle = normalizeText(title);

  return normalizedTitle ? fetchDoajIndexingByQuery(`bibjson.title:${normalizedTitle}`, normalizedTitle) : null;
}

async function fetchCrossrefJournalTitleByIssn(issn) {
  const formattedIssn = formatIssn(issn);

  if (!formattedIssn) {
    return "";
  }

  const response = await fetchJson(`${CROSSREF_JOURNALS_API_URL}/${encodeURIComponent(formattedIssn)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
    },
  });

  if (!response.ok) {
    return "";
  }

  const data = await response.json().catch(() => null);
  return normalizeText(data?.message?.title);
}

function mergeIndexingBundles(bundles = [], helperItems = []) {
  const items = uniqueIndexingItems([
    ...bundles.flatMap((bundle) => bundle?.items || []),
    ...helperItems,
  ]);
  const selectedCandidates = bundles
    .map((bundle) => bundle?.selected)
    .filter((item) => item?.quartileVerified && item?.quartile);

  if (!selectedCandidates.length) {
    return {
      indexing: items.map((item) => markQuartileSelection(item, false, "manual_required", "no_unambiguous_verified_quartile")),
      selected: null,
      status: items.some((item) => item.quartile) ? "manual_required" : "empty",
      reason: items.some((item) => item.quartile) ? "no_unambiguous_verified_quartile" : "no_ranking_quartile_found",
    };
  }

  const quartiles = uniqueValues(selectedCandidates.map((item) => item.quartile));
  const categories = uniqueValues(selectedCandidates.flatMap((item) => splitCategoryKeys(item.category)));

  if (quartiles.length > 1 || categories.length > 1) {
    return {
      indexing: items.map((item) => markQuartileSelection(item, false, "manual_required", "conflicting_provider_results")),
      selected: null,
      status: "manual_required",
      reason: "conflicting_provider_results",
    };
  }

  const providerPriority = ["scopus", "scimago"];
  const selected = selectedCandidates
    .sort((first, second) =>
      providerPriority.indexOf(normalizeIndexingSourceKey(first.sourceKey || first.source_key || first.source))
      - providerPriority.indexOf(normalizeIndexingSourceKey(second.sourceKey || second.source_key || second.source))
    )[0];

  return {
    indexing: items.map((item) => markQuartileSelection(
      item,
      sameIndexingCandidate(item, selected),
      "verified",
      "provider_results_agree"
    )),
    selected,
    status: "verified",
    reason: "provider_results_agree",
  };
}

async function resolveIndexingMetadata(metadata = {}) {
  const cachedIndexing = getCachedIndexing(metadata);
  const cachedSelected = cachedIndexing.find((item) => item.quartileVerified || item.quartile_verified);

  if (cachedSelected) {
    return {
      indexing: cachedIndexing,
      selected: cachedSelected,
      status: "verified",
      reason: "cached_verified_quartile",
    };
  }
  const context = createQuartileLookupContext(metadata);
  const bundles = [];
  const helperItems = [];
  const titles = uniqueValues([
    metadata.container_title,
    metadata.raw_json?._openalex?.primary_location?.source?.display_name,
    metadata.raw_json?._openalex?.host_venue?.display_name,
  ]);

  const addBundle = (provider, bundle, reason = "") => {
    if (!bundle) {
      logQuartileLookup(context, provider, { items: [], selected: null, reason: reason || "no_result" }, reason || "no_result");
      return;
    }

    bundles.push(bundle);
    logQuartileLookup(context, provider, bundle, reason || bundle.reason);
  };

  try {
    addBundle("scopus_doi", await fetchScopusIndexingByDoi(metadata));
  } catch (error) {
    console.warn("quartile_lookup_failed", {
      doi: metadata.doi,
      source: "scopus_doi",
      message: error.message,
    });
  }

  for (const issn of context.issns) {
    for (const [provider, fetcher] of [
      ["scopus_issn", () => fetchScopusIndexingByIssn(issn, metadata.year)],
      ["journalrank", () => fetchJournalRankIndexingByIssn(issn, metadata.year)],
      ["scimago", () => fetchScimagoIndexingByIssn(issn, metadata.year)],
    ]) {
      try {
        addBundle(provider, await fetcher(), issn);
      } catch (error) {
        console.warn("quartile_lookup_failed", {
          doi: metadata.doi,
          issn,
          source: provider,
          message: error.message,
        });
      }
    }

    try {
      const crossrefTitle = await fetchCrossrefJournalTitleByIssn(issn);
      if (crossrefTitle) {
        titles.push(crossrefTitle);
      }
    } catch (error) {
      console.warn("journal_metadata_lookup_failed", {
        doi: metadata.doi,
        issn,
        source: "crossref_journal",
        message: error.message,
      });
    }
  }

  for (const title of uniqueValues(titles)) {
    try {
      addBundle("scopus_title", await fetchScopusIndexingByTitle(title, metadata.year), title);
    } catch (error) {
      console.warn("indexing_title_lookup_failed", {
        doi: metadata.doi,
        title,
        message: error.message,
      });
    }

    for (const [provider, fetcher] of [
      ["openalex_helper", () => fetchOpenAlexIndexingByTitle(title)],
      ["doaj_helper", () => fetchDoajIndexingByTitle(title)],
    ]) {
      try {
        const helper = await fetcher();

        if (helper) {
          const helperItem = markQuartileSelection(helper, false, "manual_required", `${provider}_is_not_final_quartile_source`);
          helperItems.push(helperItem);
          logQuartileLookup(context, provider, { items: [helperItem], selected: null, reason: `${provider}_is_not_final_quartile_source` });
        }
      } catch (error) {
        console.warn("indexing_helper_lookup_failed", {
          doi: metadata.doi,
          title,
          source: provider,
          message: error.message,
        });
      }
    }
  }

  for (const issn of context.issns) {
    for (const [provider, fetcher] of [
      ["openalex_helper", () => fetchOpenAlexIndexingByIssn(issn)],
      ["doaj_helper", () => fetchDoajIndexingByIssn(issn)],
    ]) {
      try {
        const helper = await fetcher();

        if (helper) {
          const helperItem = markQuartileSelection(helper, false, "manual_required", `${provider}_is_not_final_quartile_source`);
          helperItems.push(helperItem);
          logQuartileLookup(context, provider, { items: [helperItem], selected: null, reason: `${provider}_is_not_final_quartile_source` });
        }
      } catch (error) {
        console.warn("indexing_helper_lookup_failed", {
          doi: metadata.doi,
          issn,
          source: provider,
          message: error.message,
        });
      }
    }
  }

  const result = mergeIndexingBundles(bundles, helperItems);
  logQuartileLookup(context, "final_selection", { items: result.indexing, selected: result.selected, reason: result.reason }, result.reason);

  return result;
}

async function enrichMetadataIndexing(metadata = {}) {
  const indexingResolution = await resolveIndexingMetadata(metadata);
  const indexing = indexingResolution.indexing || [];
  const selectedQuartile = indexingResolution.selected || null;
  const quartileVerified = Boolean(selectedQuartile?.quartileVerified || selectedQuartile?.quartile_verified);
  const quartile = quartileVerified ? normalizeQuartile(selectedQuartile.quartile) : "";
  const firstIndexing = selectedQuartile || indexing.find((item) => item?.indexingVerified || item?.source || item?.quartile || item?.category || item?.sjr || item?.citeScore) || {};
  const indexingVerified = Boolean(firstIndexing.indexingVerified || firstIndexing.indexing_verified);
  const indexingSource = indexingVerified
    ? normalizeIndexingSourceKey(firstIndexing.indexingSource || firstIndexing.indexing_source || firstIndexing.sourceKey || firstIndexing.source_key || firstIndexing.source)
    : "manual";
  const quartileSource = quartileVerified
    ? normalizeIndexingSourceKey(selectedQuartile.quartileSource || selectedQuartile.quartile_source || selectedQuartile.sourceKey || selectedQuartile.source_key || selectedQuartile.source)
    : "manual";
  const enrichedMetadata = {
    ...metadata,
    raw_json: {
      ...(metadata.raw_json || {}),
      _indexing: indexing,
      _quartile_lookup: {
        status: indexingResolution.status,
        reason: indexingResolution.reason,
        selectedCategory: selectedQuartile?.category || "",
        selectedQuartile: quartile,
        selectedSource: quartileSource,
      },
    },
    quartile,
    quartileVerified,
    quartile_verified: quartileVerified,
    quartileSource,
    quartile_source: quartileSource,
    quartileVerificationStatus: quartileVerified ? "verified" : (indexingResolution.status || "manual_required"),
    quartile_verification_status: quartileVerified ? "verified" : (indexingResolution.status || "manual_required"),
    quartileSelectionReason: indexingResolution.reason || "",
    quartile_selection_reason: indexingResolution.reason || "",
    indexingPlatform: indexingVerified ? firstIndexing.source || firstIndexing.platform || "" : "",
    indexing_platform: indexingVerified ? firstIndexing.source || firstIndexing.platform || "" : "",
    indexingCategory: quartileVerified ? firstIndexing.category || "" : "",
    indexing_category: quartileVerified ? firstIndexing.category || "" : "",
    indexingVerified,
    indexing_verified: indexingVerified,
    indexingSource,
    indexing_source: indexingSource,
    sjr: firstIndexing.sjr || "",
    citeScore: firstIndexing.citeScore || firstIndexing.cite_score || "",
    cite_score: firstIndexing.citeScore || firstIndexing.cite_score || "",
    indexing,
  };

  return {
    ...enrichedMetadata,
    fieldSources: buildMetadataFieldSources(enrichedMetadata),
    field_sources: buildMetadataFieldSources(enrichedMetadata),
  };
}

export async function fetchDoiMetadata(doi) {
  const normalizedDoi = normalizeDoi(doi);

  if (!normalizedDoi || !isValidDoi(normalizedDoi)) {
    throw new DoiLookupError("invalid_doi", "DOI nuk eshte valid.", 400);
  }

  const errors = [];
  let metadata = null;

  for (const fetcher of [fetchFromDoiOrg, fetchFromCrossref, fetchFromOpenAlex]) {
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
