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

function normalizeMetadataPublicationType(value) {
  const normalized = normalizeComparableText(value).replace(/\s+/g, "_");
  const typeMap = {
    article_journal: "journal_article",
    journal: "journal_article",
    journal_article: "journal_article",
    conference: "conference_paper",
    conference_paper: "conference_paper",
    conference_proceeding: "conference_paper",
    conference_proceedings: "conference_paper",
    paper_conference: "conference_paper",
    proceedings: "conference_paper",
    proceedings_article: "conference_paper",
    proceedings_series: "conference_paper",
    book: "book",
    book_chapter: "book",
    chapter: "book",
  };

  return typeMap[normalized] || normalizeText(value);
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

  return uniqueValues(values.map(normalizeIssn));
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

function normalizeCiteScoreValue(value, { allowZero = false } = {}) {
  const normalized = normalizeMetricValue(value);

  if (!normalized) {
    return "";
  }

  const numericValue = Number(normalized);

  if (Number.isFinite(numericValue) && numericValue === 0 && !allowZero) {
    return "";
  }

  return normalized;
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
  citeScoreVerified = false,
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
  const normalizedCiteScore = normalizeCiteScoreValue(citeScore, { allowZero: citeScoreVerified });

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
    citeScoreVerified: Boolean(citeScoreVerified && normalizedCiteScore),
    cite_score_verified: Boolean(citeScoreVerified && normalizedCiteScore),
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
          citeScore: normalizeCiteScoreValue(item?.citeScore || item?.cite_score || item?.citescore, { allowZero: Boolean(item?.citeScoreVerified ?? item?.cite_score_verified) }),
          cite_score: normalizeCiteScoreValue(item?.citeScore || item?.cite_score || item?.citescore, { allowZero: Boolean(item?.citeScoreVerified ?? item?.cite_score_verified) }),
          citeScoreVerified: Boolean(item?.citeScoreVerified ?? item?.cite_score_verified),
          cite_score_verified: Boolean(item?.citeScoreVerified ?? item?.cite_score_verified),
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
  const selectedFromLookup = Boolean(selected && ["verified", "historical"].includes(status));
  const verified = Boolean(selected && status === "verified");

  return {
    ...item,
    quartileVerified: verified,
    quartile_verified: verified,
    quartileSource: selectedFromLookup ? normalizeIndexingSourceKey(item.sourceKey || item.source_key || item.source) : "manual",
    quartile_source: selectedFromLookup ? normalizeIndexingSourceKey(item.sourceKey || item.source_key || item.source) : "manual",
    quartileVerificationStatus: selectedFromLookup ? status : status,
    quartile_verification_status: selectedFromLookup ? status : status,
    quartileSelectionReason: selectedFromLookup ? reason : reason || status,
    quartile_selection_reason: selectedFromLookup ? reason : reason || status,
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
    return { selected: null, status: "missing", reason: "no_quartile_rows" };
  }

  const yearCandidates = targetYear
    ? rowsWithQuartile.filter((item) => normalizeYear(item.year) === targetYear)
    : rowsWithQuartile;

  if (!targetYear || !yearCandidates.length) {
    const availableYearCandidates = rowsWithQuartile
      .map((item) => ({ ...item, normalizedYear: normalizeYear(item.year) }))
      .filter((item) => item.normalizedYear && (!targetYear || item.normalizedYear <= targetYear));
    const latestAvailableYear = availableYearCandidates.reduce(
      (latestYear, item) => Math.max(latestYear, item.normalizedYear),
      0
    );

    if (!latestAvailableYear) {
      return { selected: null, status: "missing", reason: targetYear ? "no_quartile_for_publication_year" : "publication_year_missing_no_historical_year" };
    }

    const latestCandidates = availableYearCandidates
      .filter((item) => item.normalizedYear === latestAvailableYear)
      .map(({ normalizedYear, ...item }) => item);
    const latestCategoryKeys = uniqueValues(latestCandidates.flatMap((item) => splitCategoryKeys(item.category)));
    const latestQuartiles = uniqueValues(latestCandidates.map((item) => normalizeQuartile(item.quartile)));

    if (!latestCategoryKeys.length) {
      return { selected: null, status: "manual_required", reason: "latest_available_category_missing" };
    }

    if (latestCategoryKeys.length > 1) {
      const primaryCandidates = latestCandidates.filter((item) => Boolean(item.primaryCategory || item.primary_category));

      if (primaryCandidates.length === 1) {
        return { selected: primaryCandidates[0], status: "historical", reason: "latest_available_primary_category_from_provider" };
      }

      return { selected: null, status: "manual_required", reason: "latest_available_multiple_categories_without_primary" };
    }

    if (latestQuartiles.length > 1) {
      return { selected: null, status: "manual_required", reason: "latest_available_conflicting_quartiles_for_category" };
    }

    return { selected: latestCandidates[0], status: "historical", reason: "latest_available_quartile" };
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
      citeScoreVerified: Boolean(row.citeScoreVerified || row.cite_score_verified),
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
  if (process.env.DOI_QUARTILE_DEBUG !== "true") {
    return;
  }

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
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#42;|&#x2a;|&ast;/gi, "*")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function hasText(value) {
  return normalizeText(value) !== "";
}

function nullWhenMissing(value, normalizer = normalizeText) {
  const normalized = normalizer(value);

  return normalized || null;
}

function sanitizeRepeatedConferenceAffiliations(authors = []) {
  const normalizedAuthors = (Array.isArray(authors) ? authors : []).map((author) => ({
    ...author,
    affiliation: nullWhenMissing(getAuthorAffiliation(author)),
  }));
  const affiliationCounts = normalizedAuthors.reduce((counts, author) => {
    const key = normalizeComparableText(author.affiliation);

    return key ? counts.set(key, (counts.get(key) || 0) + 1) : counts;
  }, new Map());

  return normalizedAuthors.map((author) => {
    const key = normalizeComparableText(author.affiliation);

    return key && affiliationCounts.get(key) > 1
      ? { ...author, affiliation: null }
      : author;
  });
}

function normalizeConferenceMissingMetadata(metadata = {}) {
  if (normalizeMetadataPublicationType(metadata.type) !== "conference_paper") {
    return metadata;
  }

  const authors = Array.isArray(metadata.authors)
    ? sanitizeRepeatedConferenceAffiliations(metadata.authors)
    : [];

  return {
    ...metadata,
    authors,
    abstract: nullWhenMissing(metadata.abstract, normalizeAbstractText),
    pages: nullWhenMissing(metadata.pages),
    issn: nullWhenMissing(metadata.issn),
    isbn: nullWhenMissing(metadata.isbn),
  };
}

function normalizeMetadataBoolean(value) {
  const text = normalizeComparableText(value);

  return value === true || value === 1 || ["true", "1", "yes", "y"].includes(text);
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

function isWeakConferenceAbstract(value) {
  const text = normalizeAbstractText(value);

  if (!text) {
    return false;
  }

  const sentenceCount = (text.match(/[.!?](?:\s|$)/g) || []).length;
  return text.length < 180 || sentenceCount < 2;
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
  const normalized = normalizeText(value)
    .replace(/^https?:\/\/orcid\.org\//i, "")
    .trim();

  return /^0000-0000-0000-0000$/.test(normalized) ? "" : normalized;
}

function normalizeAffiliations(value) {
  const values = Array.isArray(value) ? value : [value];

  return values
    .map((item) => normalizeText(
      item?.name
      || item?.affiliation
      || item?.institution
      || item?.organization
      || item?.display_name
      || item?.displayName
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

function buildMetadataFieldSources(metadata = {}) {
  const indexing = Array.isArray(metadata.indexing) ? metadata.indexing : [];
  const publicationType = normalizeMetadataPublicationType(metadata.type);
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
    authorAffiliation: createFieldSource(null),
    publicationType: createFieldSource(metadata.type),
    venue: createFieldSource(metadata.conferenceName || metadata.conference_name || metadata.container_title),
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

function getConferenceNameCandidates(source = {}) {
  if (!source || typeof source !== "object") {
    return [];
  }

  return [
    source.conferenceName,
    source.conference_name,
    source["conference-name"],
    source["conference-title"],
    source.conferenceTitle,
    source.conference_title,
    source.eventName,
    source.event_name,
    source["event-name"],
    source.eventTitle,
    source.event_title,
    source["event-title"],
    source.event?.name,
    source.event?.title,
    source.event?.subtitle,
    source.conference?.name,
    source.conference?.title,
    source.conference?.subtitle,
    source.proceedings?.name,
    source.proceedings?.title,
    source["proceedings-title"],
  ];
}

function normalizeConferenceName(data = {}) {
  const candidates = [
    ...getConferenceNameCandidates(data),
    ...getConferenceNameCandidates(data.raw_json),
    ...getConferenceNameCandidates(data.raw_json?._doi_org),
    ...getConferenceNameCandidates(data.raw_json?._crossref),
    ...getConferenceNameCandidates(data.raw_json?._publisher_html_metadata),
  ];

  for (const candidate of candidates) {
    const value = normalizeText(candidate);

    if (value) {
      return value;
    }
  }

  return "";
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
    source["conference-location"],
    source.conferenceLocation,
    source.conference_location,
    source["conference-place"],
    source.conferencePlace,
    source.conference_place,
    source["event-location"],
    source.eventLocation,
    source.event_location,
    source.address,
    source.city && source.country ? { city: source.city, country: source.country } : "",
    source.city,
    source.country,
    source.conference?.location,
    source.conference?.place,
    source.conference?.city && source.conference?.country ? { city: source.conference.city, country: source.conference.country } : "",
    source.conference?.city,
    source.conference?.country,
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
    data.published,
    data.issued,
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAuthorFullName(author = {}) {
  return normalizeText(
    author.fullName
    || author.full_name
    || author.name
    || [author.givenName || author.given_name || author.given, author.familyName || author.family_name || author.family].filter(Boolean).join(" ")
  );
}

function getAuthorAffiliation(author = {}) {
  return normalizeAffiliations(
    author.affiliation
    || author.affiliations
    || author.institution
    || author.organization
    || author.currentAffiliation
    || author.current_affiliation
  );
}

function normalizeAuthorMatchName(value = "") {
  return normalizeComparableText(value).replace(/\b[a-z]\b/g, "").replace(/\s+/g, " ").trim();
}

function getAuthorMatchKeys(author = {}) {
  const fullName = getAuthorFullName(author);
  const givenName = normalizeText(author.givenName || author.given_name || author.given);
  const familyName = normalizeText(author.familyName || author.family_name || author.family);
  const orcid = normalizeOrcid(author.orcid || author.ORCID);
  const keys = [
    normalizeAuthorMatchName(fullName),
    normalizeAuthorMatchName([givenName, familyName].filter(Boolean).join(" ")),
    normalizeAuthorMatchName([familyName, givenName].filter(Boolean).join(" ")),
    orcid ? `orcid:${orcid}` : "",
  ].filter(Boolean);

  return [...new Set(keys)];
}

function getAuthorInitials(author = {}) {
  const fullName = normalizeComparableText(getAuthorFullName(author));
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean);

  if (!parts.length) {
    return "";
  }

  return parts.map((part) => part[0].toUpperCase()).join(".");
}

function authorHasCorrespondingFlag(author = {}) {
  return normalizeMetadataBoolean(
    author.isCorrespondingAuthor
    ?? author.is_corresponding_author
    ?? author.correspondingAuthor
    ?? author.corresponding_author
    ?? author.isCorresponding
    ?? author.is_corresponding
    ?? author.corresponding
  );
}

function createCorrespondingLookup({
  status = "manual_required",
  source = "metadata",
  confidence = "",
  reason = "",
  names = [],
  url = "",
} = {}) {
  return {
    status,
    source,
    confidence,
    reason,
    names: uniqueValues(names),
    url: normalizeText(url),
  };
}

function getCorrespondingLookup(metadata = {}) {
  return metadata.raw_json?._corresponding_author_lookup || null;
}

function withCorrespondingLookup(metadata = {}, lookup = {}) {
  return {
    ...metadata,
    correspondingAuthorStatus: lookup.status,
    corresponding_author_status: lookup.status,
    correspondingAuthorSource: lookup.source,
    corresponding_author_source: lookup.source,
    correspondingAuthorConfidence: lookup.confidence,
    corresponding_author_confidence: lookup.confidence,
    correspondingAuthorReason: lookup.reason,
    corresponding_author_reason: lookup.reason,
    raw_json: {
      ...(metadata.raw_json || {}),
      _corresponding_author_lookup: lookup,
    },
  };
}

function matchAuthorIndexesByNames(authors = [], names = []) {
  const targetKeys = new Set(names.flatMap((name) => [normalizeAuthorMatchName(name), normalizeComparableText(name)]).filter(Boolean));
  const indexes = new Set();

  authors.forEach((author, index) => {
    const authorKeys = getAuthorMatchKeys(author);

    if (authorKeys.some((key) => targetKeys.has(key))) {
      indexes.add(index);
    }
  });

  return indexes;
}

function applyCorrespondingResolution(metadata = {}, lookup = {}) {
  const authors = Array.isArray(metadata.authors) ? metadata.authors : [];
  const matchedIndexes = lookup.status === "verified"
    ? matchAuthorIndexesByNames(authors, lookup.names || [])
    : new Set();
  const resolvedLookup = lookup.status === "verified" && !matchedIndexes.size
    ? createCorrespondingLookup({
        ...lookup,
        status: "manual_required",
        confidence: "",
        reason: lookup.reason ? `${lookup.reason}_not_matched` : "verified_names_not_matched",
      })
    : lookup;
  const nextAuthors = authors.map((author, index) => {
    const isCorrespondingAuthor = matchedIndexes.has(index) || (resolvedLookup.status !== "verified" && authorHasCorrespondingFlag(author));

    return {
      ...author,
      isCorrespondingAuthor,
      is_corresponding_author: isCorrespondingAuthor,
      correspondingAuthorSource: isCorrespondingAuthor ? resolvedLookup.source || author.correspondingAuthorSource || "" : author.correspondingAuthorSource || "",
      corresponding_author_source: isCorrespondingAuthor ? resolvedLookup.source || author.corresponding_author_source || "" : author.corresponding_author_source || "",
      correspondingAuthorConfidence: isCorrespondingAuthor ? resolvedLookup.confidence || author.correspondingAuthorConfidence || "" : author.correspondingAuthorConfidence || "",
      corresponding_author_confidence: isCorrespondingAuthor ? resolvedLookup.confidence || author.corresponding_author_confidence || "" : author.corresponding_author_confidence || "",
    };
  });

  return withCorrespondingLookup({ ...metadata, authors: nextAuthors }, resolvedLookup);
}

function isRepeatedConferenceAffiliation(authors = [], affiliation = "") {
  const comparableAffiliation = normalizeComparableText(affiliation);

  return Boolean(comparableAffiliation)
    && authors.filter((author) => normalizeComparableText(getAuthorAffiliation(author)) === comparableAffiliation).length > 1;
}

function mergeAuthorMetadata(primaryAuthors = [], fallbackAuthors = [], options = {}) {
  if (!Array.isArray(primaryAuthors) || !primaryAuthors.length) {
    return Array.isArray(fallbackAuthors) ? fallbackAuthors : [];
  }

  const normalizedFallbackAuthors = Array.isArray(fallbackAuthors) ? fallbackAuthors : [];

  if (!normalizedFallbackAuthors.length) {
    return primaryAuthors;
  }

  return primaryAuthors.map((author) => {
    const primaryKeys = new Set(getAuthorMatchKeys(author));
    const matchedFallbackAuthor = normalizedFallbackAuthors.find((fallbackAuthor) =>
      getAuthorMatchKeys(fallbackAuthor).some((key) => primaryKeys.has(key))
    );

    if (!matchedFallbackAuthor) {
      return author;
    }

    const primaryAffiliation = getAuthorAffiliation(author);
    const fallbackAffiliation = getAuthorAffiliation(matchedFallbackAuthor);
    const fallbackOrcid = normalizeOrcid(matchedFallbackAuthor.orcid || matchedFallbackAuthor.ORCID);
    const nextAuthor = {
      ...author,
    };

    const repeatedConferenceAffiliation = options.publicationType === "conference_paper"
      && isRepeatedConferenceAffiliation(primaryAuthors, primaryAffiliation)
      && normalizeComparableText(primaryAffiliation) !== normalizeComparableText(fallbackAffiliation);

    if ((!primaryAffiliation || repeatedConferenceAffiliation) && fallbackAffiliation) {
      nextAuthor.affiliation = fallbackAffiliation;
    }

    if (!normalizeOrcid(nextAuthor.orcid || nextAuthor.ORCID) && fallbackOrcid) {
      nextAuthor.orcid = fallbackOrcid;
    }

    if (authorHasCorrespondingFlag(matchedFallbackAuthor)) {
      nextAuthor.isCorrespondingAuthor = true;
      nextAuthor.is_corresponding_author = true;
      nextAuthor.correspondingAuthorSource = matchedFallbackAuthor.correspondingAuthorSource || matchedFallbackAuthor.corresponding_author_source || "metadata_flag";
      nextAuthor.corresponding_author_source = matchedFallbackAuthor.correspondingAuthorSource || matchedFallbackAuthor.corresponding_author_source || "metadata_flag";
      nextAuthor.correspondingAuthorConfidence = matchedFallbackAuthor.correspondingAuthorConfidence || matchedFallbackAuthor.corresponding_author_confidence || "verified";
      nextAuthor.corresponding_author_confidence = matchedFallbackAuthor.correspondingAuthorConfidence || matchedFallbackAuthor.corresponding_author_confidence || "verified";
    }

    return nextAuthor;
  });
}

function getMetadataCorrespondingLookup(metadata = {}) {
  const lookup = getCorrespondingLookup(metadata);

  if (lookup) {
    return lookup;
  }

  const correspondingAuthors = (Array.isArray(metadata.authors) ? metadata.authors : [])
    .filter(authorHasCorrespondingFlag)
    .map(getAuthorFullName)
    .filter(Boolean);

  return correspondingAuthors.length
    ? createCorrespondingLookup({
        status: "verified",
        source: "metadata_flag",
        confidence: "verified",
        reason: "author_metadata_flag",
        names: correspondingAuthors,
      })
    : null;
}

function mergeMetadata(primary, fallback) {
  if (!fallback) {
    return primary;
  }

  const primaryRaw = primary.raw_json || {};
  const fallbackRaw = fallback.raw_json || {};
  const mergedType = preferText(primary.type, fallback.type);
  const normalizedMergedType = normalizeMetadataPublicationType(mergedType);
  const authors = Array.isArray(primary.authors) && primary.authors.length
    ? mergeAuthorMetadata(primary.authors, fallback.authors, { publicationType: normalizedMergedType })
    : fallback.authors;
  const primaryLookup = getMetadataCorrespondingLookup({ ...primary, authors });
  const fallbackLookup = getMetadataCorrespondingLookup(fallback);
  const correspondingLookup = primaryLookup?.status === "verified" ? primaryLookup : fallbackLookup || primaryLookup;
  const mergedConferenceName = preferText(primary.conferenceName || primary.conference_name, fallback.conferenceName || fallback.conference_name);
  const mergedContainerTitle = normalizedMergedType === "conference_paper"
    ? preferText(mergedConferenceName, preferText(primary.container_title, fallback.container_title))
    : preferText(primary.container_title, fallback.container_title);

  const mergedMetadata = {
    ...primary,
    title: preferText(primary.title, fallback.title),
    authors,
    container_title: mergedContainerTitle,
    conferenceName: mergedConferenceName,
    conference_name: mergedConferenceName,
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
    type: mergedType,
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

  return correspondingLookup?.status === "verified"
    ? applyCorrespondingResolution(mergedMetadata, correspondingLookup)
    : mergedMetadata;
}

function normalizeUrlCandidate(value) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  if (/^doi:\s*10\./i.test(text)) {
    return `https://doi.org/${normalizeDoi(text)}`;
  }

  if (/^10\.\d{4,9}\//i.test(text)) {
    return `https://doi.org/${normalizeDoi(text)}`;
  }

  if (/^\/\//.test(text)) {
    return `https:${text}`;
  }

  return /^https?:\/\//i.test(text) ? text : "";
}

function getUrlHostname(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isMdpiUrl(value) {
  const hostname = getUrlHostname(value);

  return hostname === "mdpi.com" || hostname.endsWith(".mdpi.com");
}

function getMetadataArticleUrlCandidates(metadata = {}) {
  const raw = metadata.raw_json || {};
  const crossref = raw._crossref || {};
  const doiOrg = raw._doi_org || {};
  const openAlex = raw._openalex || {};
  const primaryLocation = openAlex.primary_location || {};
  const bestOaLocation = openAlex.best_oa_location || {};
  const locations = Array.isArray(openAlex.locations) ? openAlex.locations : [];
  const locationUrls = locations.flatMap((location) => [
    location?.landing_page_url,
    location?.pdf_url,
    location?.source?.homepage_url,
  ]);
  const doi = normalizeDoi(metadata.doi || raw.DOI || crossref.DOI || doiOrg.DOI);
  const candidates = [
    metadata.source_url,
    metadata.sourceUrl,
    raw.URL,
    raw.url,
    crossref.URL,
    crossref.url,
    doiOrg.URL,
    doiOrg.url,
    primaryLocation.landing_page_url,
    primaryLocation.pdf_url,
    bestOaLocation.landing_page_url,
    bestOaLocation.pdf_url,
    openAlex.id,
    ...locationUrls,
    doi ? `https://doi.org/${doi}` : "",
  ].map(normalizeUrlCandidate);

  return uniqueValues(candidates);
}

function isMdpiMetadata(metadata = {}, urlCandidates = getMetadataArticleUrlCandidates(metadata)) {
  const raw = metadata.raw_json || {};
  const openAlexSource = raw._openalex?.primary_location?.source || raw._openalex?.host_venue || {};
  const publisherText = [
    metadata.publisher,
    raw.publisher,
    raw._crossref?.publisher,
    raw._doi_org?.publisher,
    openAlexSource.publisher,
    openAlexSource.host_organization_name,
  ].map(normalizeComparableText).join(" ");

  return publisherText.includes("mdpi") || urlCandidates.some(isMdpiUrl);
}

function htmlToText(value) {
  return decodeHtmlEntities(String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|section|article|li|tr|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function getHtmlAttribute(tag, name) {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i");
  return decodeHtmlEntities(tag.match(pattern)?.[2] || "");
}

function extractMetaContents(html, names = []) {
  const normalizedNames = new Set(names.map(normalizeComparableText));
  const values = [];
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const key = normalizeComparableText(
      getHtmlAttribute(tag, "name")
      || getHtmlAttribute(tag, "property")
      || getHtmlAttribute(tag, "itemprop")
    );

    if (normalizedNames.has(key)) {
      values.push(getHtmlAttribute(tag, "content"));
    }
  }

  return uniqueValues(values.map(normalizeText).filter(Boolean));
}

function normalizePublisherDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  if (/^(?:19|20)\d{2}$/.test(text)) {
    return text;
  }

  const ymd = text.match(/\b((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (ymd && isValidMonth(Number(ymd[2])) && isValidDay(Number(ymd[3]))) {
    return `${ymd[1]}-${String(Number(ymd[2])).padStart(2, "0")}-${String(Number(ymd[3])).padStart(2, "0")}`;
  }

  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.]((?:19|20)\d{2})\b/);
  if (dmy && isValidMonth(Number(dmy[2])) && isValidDay(Number(dmy[1]))) {
    return `${dmy[3]}-${String(Number(dmy[2])).padStart(2, "0")}-${String(Number(dmy[1])).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime()) && normalizeYear(parsed.getUTCFullYear())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
  }

  const year = normalizeYear(text.match(/\b((?:19|20)\d{2})\b/)?.[1]);
  return year ? String(year) : "";
}

function extractHtmlAbstractSections(html) {
  const source = String(html || "");
  const sections = [];
  const classPattern = /<(?:section|div|article)\b[^>]*(?:class|id)=["'][^"']*abstract[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div|article)>/gi;
  const headingPattern = /<h[1-6]\b[^>]*>\s*(?:abstract|summary)\s*<\/h[1-6]>([\s\S]{0,7000}?)(?=<h[1-6]\b|<(?:section|div)\b[^>]*(?:class|id)=["'][^"']*(?:keywords|references|bibliography)[^"']*["']|$)/gi;
  let match;

  while ((match = classPattern.exec(source))) {
    sections.push(htmlToText(match[1]));
  }

  while ((match = headingPattern.exec(source))) {
    sections.push(htmlToText(match[1]));
  }

  return uniqueValues(sections.map(normalizeAbstractText).filter((item) => item.length >= 20));
}

function extractLabeledAbstractSections(html) {
  const text = htmlToText(html);
  const sections = [];
  const labelPattern = /\b(?:abstract|summary)\s*[:\-]\s*/gi;
  let match;

  while ((match = labelPattern.exec(text))) {
    const slice = text.slice(match.index + match[0].length, match.index + match[0].length + 5000);
    const endMatch = slice.search(/\b(?:references|bibliography|acknowledg(?:e)?ments?|keywords?|key\s+words?|doi|isbn|issn|citation)\b\s*[:\-]?/i);
    const candidate = normalizeAbstractText(endMatch > 40 ? slice.slice(0, endMatch) : slice);

    if (candidate.length >= 20) {
      sections.push(candidate);
    }
  }

  return uniqueValues(sections);
}

function selectBestAbstractCandidate(candidates = []) {
  const normalized = uniqueValues(candidates.map(normalizeAbstractText).filter(Boolean));

  return normalized
    .filter((item) => item.length >= 20)
    .sort((first, second) => second.length - first.length)[0] || "";
}

function collectPublisherJsonLdFields(value, fields = { abstracts: [], descriptions: [], names: [], locations: [], dates: [] }, context = "") {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPublisherJsonLdFields(item, fields, context));
    return fields;
  }

  if (!value || typeof value !== "object") {
    return fields;
  }

  const typeText = normalizeComparableText(value["@type"] || value.type);
  const nextContext = `${context} ${typeText}`.trim();
  const isConferenceContext = /\b(event|conference|symposium|workshop|congress|proceedings)\b/.test(nextContext);

  Object.entries(value).forEach(([key, item]) => {
    const normalizedKey = normalizeComparableText(key);

    if (typeof item === "string") {
      if (normalizedKey.includes("abstract")) {
        fields.abstracts.push(item);
      } else if (normalizedKey === "description") {
        fields.descriptions.push(item);
      } else if (isConferenceContext && ["name", "title", "headline"].includes(normalizedKey)) {
        fields.names.push(item);
      } else if (["datepublished", "datecreated", "datemodified", "uploaddate"].includes(normalizedKey.replace(/\s+/g, ""))) {
        fields.dates.push(item);
      } else if (
        (normalizedKey.includes("conference") && (normalizedKey.includes("location") || normalizedKey.includes("place")))
        || (normalizedKey.includes("location") && /\b(event|conference)\b/.test(nextContext))
      ) {
        fields.locations.push(item);
      }
    } else if (item && typeof item === "object") {
      if (
        (normalizedKey.includes("conference") && (normalizedKey.includes("location") || normalizedKey.includes("place")))
        || (normalizedKey.includes("location") && /\b(event|conference)\b/.test(nextContext))
      ) {
        fields.locations.push(normalizeLocationValue(item));
      }

      collectPublisherJsonLdFields(item, fields, `${nextContext} ${normalizedKey}`.trim());
    }
  });

  return fields;
}

function extractPublisherJsonLdFields(html) {
  const fields = { abstracts: [], descriptions: [], names: [], locations: [], dates: [] };
  const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(String(html || "")))) {
    const parsed = parseJsonLike(match[1]);

    if (parsed) {
      collectPublisherJsonLdFields(parsed, fields);
    }
  }

  return {
    abstracts: uniqueValues(fields.abstracts.map(normalizeAbstractText).filter(Boolean)),
    descriptions: uniqueValues(fields.descriptions.map(normalizeAbstractText).filter(Boolean)),
    names: uniqueValues(fields.names.map(normalizeText).filter(Boolean)),
    locations: uniqueValues(fields.locations.map(normalizeLocationValue).filter(Boolean)),
    dates: uniqueValues(fields.dates.map(normalizePublisherDate).filter(Boolean)),
  };
}

function extractPublisherConferenceFields(html, metadata = {}) {
  const jsonLd = extractPublisherJsonLdFields(html);
  const abstractMeta = extractMetaContents(html, [
    "citation_abstract",
    "dc.description",
    "dcterms.abstract",
    "abstract",
  ]).map(normalizeAbstractText);
  const descriptionMeta = extractMetaContents(html, [
    "description",
    "og:description",
    "twitter:description",
  ]).map(normalizeAbstractText);
  const locationMeta = extractMetaContents(html, [
    "citation_conference_location",
    "conference_location",
    "conference-place",
    "conference_place",
    "event_location",
    "event-location",
  ]).map(normalizeLocationValue);
  const nameMeta = extractMetaContents(html, [
    "citation_conference",
    "citation_conference_title",
    "citation_conference_name",
    "conference",
    "conference_name",
    "conference-name",
    "conference_title",
    "conference-title",
    "event_name",
    "event-name",
    "event_title",
    "event-title",
  ]).map(normalizeText);
  const dateMeta = extractMetaContents(html, [
    "citation_publication_date",
    "dc.date",
    "dcterms.issued",
    "article:published_time",
    "date",
  ]).map(normalizePublisherDate);
  const titleText = normalizeComparableText(metadata.title);
  const descriptionCandidates = [...jsonLd.descriptions, ...descriptionMeta]
    .filter((item) => item && normalizeComparableText(item) !== titleText);

  return {
    abstract: selectBestAbstractCandidate([
      ...abstractMeta,
      ...jsonLd.abstracts,
      ...extractHtmlAbstractSections(html),
      ...extractLabeledAbstractSections(html),
      ...descriptionCandidates,
    ]),
    conferenceName: uniqueValues([...nameMeta, ...jsonLd.names]).find(Boolean) || "",
    conferenceLocation: uniqueValues([...locationMeta, ...jsonLd.locations]).find(Boolean) || "",
    publishedDate: uniqueValues([...dateMeta, ...jsonLd.dates]).find(Boolean) || "",
  };
}

function getKnownAuthorName(author = {}) {
  return getAuthorFullName(author);
}

function createAuthorNameRegex(name) {
  const parts = normalizeText(name).split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return null;
  }

  return new RegExp(parts.map(escapeRegExp).join("\\s+"), "i");
}

function resolveKnownAuthorNames(names = [], authors = []) {
  const matchedIndexes = matchAuthorIndexesByNames(authors, names);

  return [...matchedIndexes]
    .map((index) => getKnownAuthorName(authors[index]))
    .filter(Boolean);
}

function extractMdpiAuthorTextBlocks(html) {
  const blocks = [];
  const source = String(html || "");
  const classPattern = /class=["'][^"']*(?:art-authors|author-list|authors-list|authors-links)[^"']*["']/gi;
  let match;

  while ((match = classPattern.exec(source))) {
    const slice = source.slice(Math.max(0, match.index - 500), match.index + 30000);
    const endIndex = slice.search(/class=["'][^"']*(?:art-affiliations|affiliations|art-abstract|abstract|art-keywords|keywords)[^"']*["']/i);
    blocks.push(htmlToText(endIndex > 1000 ? slice.slice(0, endIndex) : slice));
  }

  return uniqueValues(blocks).filter(Boolean);
}

function containsMdpiStarMarker(value) {
  return /(?:^|[\s,;(\[])(?:\*|\u2217|\u204e|\ufe61|\uff0a)(?:[\s,;)\]]|$)/.test(value);
}

function extractMdpiStarAuthorNames(html, authors = []) {
  const names = [];
  const knownAuthors = authors.filter((author) => getKnownAuthorName(author));

  for (const blockText of extractMdpiAuthorTextBlocks(html)) {
    const positions = knownAuthors
      .map((author) => {
        const name = getKnownAuthorName(author);
        const nameRegex = createAuthorNameRegex(name);
        const match = nameRegex ? blockText.match(nameRegex) : null;

        return match ? { name, index: match.index } : null;
      })
      .filter(Boolean)
      .sort((left, right) => left.index - right.index);

    positions.forEach((position, index) => {
      const nextPosition = positions[index + 1]?.index ?? blockText.length;
      const segment = blockText.slice(position.index, nextPosition);

      if (containsMdpiStarMarker(segment)) {
        names.push(position.name);
      }
    });
  }

  return uniqueValues(names);
}

function extractMdpiCorrespondenceTextBlocks(html) {
  const text = htmlToText(html);
  const blocks = [];
  const pattern = /\b(?:correspondence|corresponding author|authors? to whom correspondence should be addressed)\b/gi;
  let match;

  while ((match = pattern.exec(text))) {
    blocks.push(text.slice(match.index, match.index + 1600));
  }

  return uniqueValues(blocks).filter(Boolean);
}

function extractFullAuthorNamesFromText(text, authors = []) {
  return authors
    .map(getKnownAuthorName)
    .filter(Boolean)
    .filter((name) => {
      const regex = createAuthorNameRegex(name);
      return regex ? regex.test(text) : false;
    });
}

function normalizeInitials(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/\.$/, "");
}

function resolveInitialsToAuthorNames(initials = [], authors = []) {
  const names = [];

  for (const value of initials) {
    const target = normalizeInitials(value);
    const matches = authors.filter((author) => normalizeInitials(getAuthorInitials(author)) === target);

    if (target && matches.length === 1) {
      names.push(getKnownAuthorName(matches[0]));
    }
  }

  return uniqueValues(names);
}

function getAuthorComparableNameParts(author = {}) {
  const fullNameParts = normalizeComparableText(getKnownAuthorName(author)).split(/\s+/).filter(Boolean);
  const givenName = normalizeComparableText(author.givenName || author.given_name || fullNameParts[0]);
  const familyName = normalizeComparableText(author.familyName || author.family_name || fullNameParts[fullNameParts.length - 1]);

  return {
    givenName,
    familyName,
  };
}

function extractEmailAuthorNamesFromCorrespondenceBlock(text, authors = []) {
  const emails = [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]);
  const names = [];

  for (const email of emails) {
    const localTokens = normalizeComparableText(email.split("@")[0].replace(/[._+-]+/g, " ")).split(/\s+/).filter(Boolean);
    const localTokenSet = new Set(localTokens);
    const matches = authors.filter((author) => {
      const { givenName, familyName } = getAuthorComparableNameParts(author);

      return familyName.length >= 3
        && localTokenSet.has(familyName)
        && (
          givenName.length >= 3
            ? localTokenSet.has(givenName) || localTokenSet.has(givenName[0])
            : false
        );
    });

    if (matches.length === 1) {
      names.push(getKnownAuthorName(matches[0]));
    }
  }

  return uniqueValues(names);
}

function extractMdpiCorrespondenceBlockAuthorNames(html, authors = []) {
  const names = [];

  for (const blockText of extractMdpiCorrespondenceTextBlocks(html)) {
    names.push(...extractFullAuthorNamesFromText(blockText, authors));
    names.push(...extractEmailAuthorNamesFromCorrespondenceBlock(blockText, authors));
    names.push(...resolveInitialsToAuthorNames(
      [...blockText.matchAll(/\(([A-Z](?:\.[A-Z]){1,}\.?)\)/g)].map((match) => match[1]),
      authors
    ));
  }

  return uniqueValues(names);
}

function parseJsonLike(value) {
  try {
    return JSON.parse(decodeHtmlEntities(value));
  } catch {
    return null;
  }
}

function collectSchemaCorrespondingAuthorNames(value, names = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSchemaCorrespondingAuthorNames(item, names));
    return names;
  }

  if (!value || typeof value !== "object") {
    return names;
  }

  const objectName = normalizeText(value.name || [value.givenName, value.familyName].filter(Boolean).join(" "));
  const descriptorText = [
    value.roleName,
    value.role,
    value.description,
    value["@type"],
  ].map(normalizeComparableText).join(" ");
  const hasCorrespondingDescriptor = descriptorText.includes("corresponding");
  const hasCorrespondingBoolean = Object.entries(value).some(([key, item]) =>
    normalizeComparableText(key).includes("correspond") && normalizeMetadataBoolean(item)
  );

  if (objectName && (hasCorrespondingDescriptor || hasCorrespondingBoolean)) {
    names.push(objectName);
  }

  Object.entries(value).forEach(([key, item]) => {
    if (normalizeComparableText(key).includes("correspond")) {
      if (typeof item === "string") {
        names.push(item);
      } else {
        collectSchemaCorrespondingAuthorNames(item, names);
      }
    } else if (item && typeof item === "object") {
      collectSchemaCorrespondingAuthorNames(item, names);
    }
  });

  return names;
}

function extractMdpiSchemaCorrespondingAuthorNames(html, authors = []) {
  const names = [];
  const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(String(html || "")))) {
    const parsed = parseJsonLike(match[1]);

    if (parsed) {
      names.push(...collectSchemaCorrespondingAuthorNames(parsed, []));
    }
  }

  return uniqueValues(resolveKnownAuthorNames(names, authors));
}

function extractMdpiCorrespondingAuthorNames(html, authors = []) {
  const schemaNames = extractMdpiSchemaCorrespondingAuthorNames(html, authors);
  const starNames = resolveKnownAuthorNames(extractMdpiStarAuthorNames(html, authors), authors);
  const correspondenceNames = resolveKnownAuthorNames(extractMdpiCorrespondenceBlockAuthorNames(html, authors), authors);

  return {
    names: uniqueValues([...schemaNames, ...starNames, ...correspondenceNames]),
    reasons: [
      schemaNames.length ? "schema_markup" : "",
      starNames.length ? "author_star_marker" : "",
      correspondenceNames.length ? "correspondence_block" : "",
    ].filter(Boolean),
  };
}

async function fetchPublisherCorrespondingAuthorLookup(metadata = {}) {
  const authors = Array.isArray(metadata.authors) ? metadata.authors : [];
  const urlCandidates = getMetadataArticleUrlCandidates(metadata);

  if (!authors.length) {
    return createCorrespondingLookup({
      status: "manual_required",
      source: "publisher_html",
      reason: "no_authors_to_match",
    });
  }

  if (!isMdpiMetadata(metadata, urlCandidates)) {
    return createCorrespondingLookup({
      status: "manual_required",
      source: "metadata",
      reason: "publisher_html_not_supported",
    });
  }

  let lastManualLookup = createCorrespondingLookup({
    status: "manual_required",
    source: "publisher_html_mdpi",
    reason: "publisher_html_unavailable",
    url: urlCandidates[0] || "",
  });

  for (const url of urlCandidates) {
    try {
      const response = await fetchJson(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
        },
      });

      if (!response.ok) {
        continue;
      }

      const responseUrl = response.url || url;
      const contentType = response.headers.get("content-type") || "";

      if (contentType && !contentType.toLowerCase().includes("html")) {
        continue;
      }

      if (!isMdpiUrl(responseUrl) && !isMdpiMetadata(metadata, [responseUrl])) {
        continue;
      }

      const { names, reasons } = extractMdpiCorrespondingAuthorNames(await response.text(), authors);

      if (names.length) {
        return createCorrespondingLookup({
          status: "verified",
          source: "publisher_html_mdpi",
          confidence: "verified",
          reason: reasons.length ? `mdpi_${reasons.join("_")}` : "mdpi_corresponding_author_confirmed",
          names,
          url: responseUrl,
        });
      }

      lastManualLookup = createCorrespondingLookup({
        status: "manual_required",
        source: "publisher_html_mdpi",
        reason: "no_clear_corresponding_author",
        url: responseUrl,
      });
    } catch {
      lastManualLookup = createCorrespondingLookup({
        status: "manual_required",
        source: "publisher_html_mdpi",
        reason: "publisher_html_unavailable",
        url,
      });
    }
  }

  return lastManualLookup;
}

function getBestEventDateParts(data = {}) {
  const candidates = [
    data.event?.start,
    data.event?.end,
  ].map(getDateParts).filter((parts) => parts.length > 0);

  return candidates.find((parts) => normalizeYear(parts[0]) && isValidMonth(parts[1]) && isValidDay(parts[2]))
    || candidates.find((parts) => normalizeYear(parts[0]) && isValidMonth(parts[1]))
    || candidates.find((parts) => normalizeYear(parts[0]))
    || [];
}

function publicationDateMatchesConferenceEvent(metadata = {}) {
  const currentDate = normalizeText(metadata.published_date);

  if (!isFullDate(currentDate)) {
    return false;
  }

  const raw = metadata.raw_json || {};
  const eventDates = [
    raw,
    raw._doi_org,
    raw._crossref,
  ].map((item) => formatDateParts(getBestEventDateParts(item || {}))).filter(isFullDate);

  return eventDates.includes(currentDate);
}

function shouldTryPublisherConferenceMetadata(metadata = {}) {
  if (normalizeMetadataPublicationType(metadata.type) !== "conference_paper") {
    return false;
  }

  const raw = metadata.raw_json || {};

  if (raw._publisher_html_metadata?.attempted && raw._publisher_html_metadata?.version >= 3) {
    return false;
  }

  return !normalizeAbstractText(metadata.abstract)
    || isWeakConferenceAbstract(metadata.abstract)
    || !normalizeConferenceName(metadata)
    || !normalizeConferenceLocation(metadata)
    || !isFullDate(metadata.published_date)
    || publicationDateMatchesConferenceEvent(metadata);
}

async function enrichConferencePublisherMetadata(metadata = {}) {
  if (!shouldTryPublisherConferenceMetadata(metadata)) {
    return metadata;
  }

  const urlCandidates = getMetadataArticleUrlCandidates(metadata);
  let lastAttempt = {
    attempted: true,
    version: 3,
    status: "unavailable",
    url: urlCandidates[0] || "",
  };

  for (const url of urlCandidates) {
    try {
      const response = await fetchJson(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
        },
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType && !contentType.toLowerCase().includes("html")) {
        continue;
      }

      const fields = extractPublisherConferenceFields(await response.text(), metadata);
      const nextMetadata = { ...metadata };
      const found = [];

      if ((!normalizeAbstractText(nextMetadata.abstract) || isWeakConferenceAbstract(nextMetadata.abstract)) && fields.abstract) {
        nextMetadata.abstract = fields.abstract;
        found.push("abstract");
      }

      if (!normalizeConferenceLocation(nextMetadata) && fields.conferenceLocation) {
        nextMetadata.conferenceLocation = fields.conferenceLocation;
        nextMetadata.conference_location = fields.conferenceLocation;
        found.push("conference_location");
      }

      if (!normalizeConferenceName(nextMetadata) && fields.conferenceName) {
        nextMetadata.conferenceName = fields.conferenceName;
        nextMetadata.conference_name = fields.conferenceName;
        nextMetadata.container_title = fields.conferenceName;
        found.push("conference_name");
      }

      if (
        fields.publishedDate
        && (!isFullDate(nextMetadata.published_date) || publicationDateMatchesConferenceEvent(nextMetadata))
      ) {
        nextMetadata.published_date = fields.publishedDate;
        nextMetadata.year = normalizeYear(String(fields.publishedDate).slice(0, 4)) || nextMetadata.year;
        found.push("published_date");
      }

      lastAttempt = {
        attempted: true,
        version: 3,
        status: found.length ? "matched" : "no_fields_found",
        url: response.url || url,
        found,
        conferenceName: fields.conferenceName || "",
        conferenceLocation: fields.conferenceLocation || "",
      };

      nextMetadata.raw_json = {
        ...(nextMetadata.raw_json || {}),
        _publisher_html_metadata: lastAttempt,
      };

      if (found.length) {
        return nextMetadata;
      }
    } catch {
      lastAttempt = {
        attempted: true,
        version: 3,
        status: "unavailable",
        url,
      };
    }
  }

  return {
    ...metadata,
    raw_json: {
      ...(metadata.raw_json || {}),
      _publisher_html_metadata: lastAttempt,
    },
  };
}

async function enrichMetadataCorrespondingAuthors(metadata = {}) {
  const existingLookup = getCorrespondingLookup(metadata);

  if (existingLookup?.status === "verified" && existingLookup.source === "publisher_html_mdpi") {
    return applyCorrespondingResolution(metadata, existingLookup);
  }

  if (existingLookup?.status === "manual_required" && existingLookup.source === "publisher_html_mdpi") {
    return withCorrespondingLookup(metadata, existingLookup);
  }

  const publisherLookup = isMdpiMetadata(metadata)
    ? await fetchPublisherCorrespondingAuthorLookup(metadata)
    : null;

  if (publisherLookup?.status === "verified") {
    return applyCorrespondingResolution(metadata, publisherLookup);
  }

  if (existingLookup?.status === "verified") {
    return applyCorrespondingResolution(metadata, existingLookup);
  }

  if (existingLookup?.status === "manual_required" && !publisherLookup) {
    return withCorrespondingLookup(metadata, existingLookup);
  }

  const metadataLookup = getMetadataCorrespondingLookup(metadata);

  if (metadataLookup?.status === "verified") {
    return applyCorrespondingResolution(metadata, metadataLookup);
  }

  return withCorrespondingLookup(metadata, publisherLookup || existingLookup || createCorrespondingLookup({
    status: "manual_required",
    source: "metadata",
    reason: "no_corresponding_author_metadata",
  }));
}

function shouldRefreshCachedMetadata(metadata = {}) {
  const type = normalizeText(metadata.type);
  const hasCrossrefSnapshot = Boolean(metadata.raw_json?._crossref);
  const comparableType = normalizeMetadataPublicationType(type);
  const hasCachedIssn = hasText(metadata.issn) || hasText(getRawIdentifierValue(metadata.raw_json, "ISSN"));
  const hasCachedIsbn = hasText(metadata.isbn) || hasText(getRawIdentifierValue(metadata.raw_json, "ISBN"));
  const isConferenceType = comparableType === "conference_paper";

  if (isConferenceType && shouldTryPublisherConferenceMetadata(metadata)) {
    return true;
  }

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

  return isConferenceType && !isFullDate(metadata.published_date) && !hasCrossrefSnapshot;
}

function mapMetadata(data, doi) {
  const title = Array.isArray(data.title) ? data.title[0] || "" : data.title || "";
  const rawContainerTitle = Array.isArray(data["container-title"])
    ? data["container-title"][0] || ""
    : data["container-title"] || data.event?.name || "";
  const type = normalizeMetadataPublicationType(data.type);
  const conferenceName = normalizeConferenceName(data);
  const containerTitle = type === "conference_paper"
    ? conferenceName || rawContainerTitle
    : rawContainerTitle || conferenceName;
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
          isCorrespondingAuthor: normalizeMetadataBoolean(
            author.corresponding
            ?? author.isCorrespondingAuthor
            ?? author.is_corresponding_author
            ?? author["corresponding-author"]
            ?? author["is-corresponding-author"]
          ),
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
    conferenceName,
    conference_name: conferenceName,
    publisher: normalizeText(data.publisher),
    published_date: formatDateParts(dateParts),
    year: normalizeYear(dateParts[0]) || extractYearFromDoi(doi),
    volume: normalizeText(data.volume),
    issue: normalizeText(data.issue),
    pages: normalizeText(data.page),
    issn: Array.isArray(data.ISSN) ? normalizeText(data.ISSN[0]) : normalizeText(data.ISSN),
    isbn: Array.isArray(data.ISBN) ? normalizeText(data.ISBN[0]) : normalizeText(data.ISBN),
    type,
    abstract: normalizeAbstractText(data.abstract),
    source_url: normalizeText(data.URL) || `https://doi.org/${doi}`,
    raw_json: data,
  };
}

let publicationMetadataNullableSchemaReady = false;

async function ensurePublicationMetadataNullableSchema(db) {
  if (publicationMetadataNullableSchemaReady) {
    return;
  }

  await db.query(`
    alter table if exists publication_metadata alter column abstract drop not null;
    alter table if exists publication_metadata alter column abstract drop default;
    alter table if exists publication_metadata alter column pages drop not null;
    alter table if exists publication_metadata alter column pages drop default;
    alter table if exists publication_metadata alter column issn drop not null;
    alter table if exists publication_metadata alter column issn drop default;
    alter table if exists publication_metadata alter column isbn drop not null;
    alter table if exists publication_metadata alter column isbn drop default;
  `);

  publicationMetadataNullableSchemaReady = true;
}

async function hasPublicationMetadataIdentifierColumns(db) {
  await ensurePublicationMetadataNullableSchema(db);

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
  const conferenceName = normalizeConferenceName(metadata);

  metadata.conferenceLocation = conferenceLocation;
  metadata.conference_location = conferenceLocation;
  metadata.conferenceName = conferenceName;
  metadata.conference_name = conferenceName;

  if (normalizeMetadataPublicationType(metadata.type) === "conference_paper" && conferenceName) {
    metadata.container_title = conferenceName;
  }

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
        isCorrespondingAuthor: normalizeMetadataBoolean(authorship.is_corresponding || authorship.corresponding),
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
  const type = normalizeMetadataPublicationType(data.type_crossref || data.type);
  const conferenceName = type === "conference_paper"
    ? normalizeText(source.display_name || hostVenue.display_name)
    : "";

  return {
    doi,
    title: normalizeText(data.title || data.display_name),
    authors,
    container_title: conferenceName || normalizeText(source.display_name || hostVenue.display_name),
    conferenceLocation: "",
    conference_location: "",
    conferenceName,
    conference_name: conferenceName,
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
          citeScoreVerified: Boolean(citeScore),
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
          citeScoreVerified: Boolean(citeScore),
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
    citeScoreVerified: Boolean(row.citeScore || citeScore),
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
    citeScoreVerified: Boolean(row.citeScore || citeScore),
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
    citeScoreVerified: Boolean(row.citeScore || citeScore),
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
        citeScore: normalizeCiteScoreValue(cells.find((cell) => normalizeComparableText(cell).includes("citescore")) || ""),
      });
    }
  }

  return rows;
}

function parseJournalRankIndicators(html) {
  const indicatorsByYear = new Map();
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(String(html || "")))) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((cell) => decodeHtmlEntities(cell[1].replace(/<[^>]+>/g, " ")));
    const type = normalizeComparableText(cells[0]);
    const value = normalizeMetricValue(cells[1]);
    const year = normalizeYear(cells[2]);

    if (!type || !value || !year) {
      continue;
    }

    const current = indicatorsByYear.get(year) || { year };

    if (type.includes("citescore")) {
      current.citeScore = normalizeCiteScoreValue(value);
      current.cite_score = current.citeScore;
    } else if (type === "sjr" || type.includes("scimago")) {
      current.sjr = value;
    }

    indicatorsByYear.set(year, current);
  }

  return indicatorsByYear;
}

function mergeJournalRankIndicators(rows = [], indicatorsByYear = new Map()) {
  return rows.map((row) => ({
    ...row,
    ...(indicatorsByYear.get(normalizeYear(row.year)) || {}),
  }));
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
  let indicatorsByYear = new Map();

  try {
    const indicatorsResponse = await fetchJson(`${JOURNAL_RANK_BASE_URL}/ru/record-sources/indicators/${recordId}/?pagesize=100`, {
      headers: {
        Accept: "text/html",
        "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)",
      },
    });

    if (indicatorsResponse.ok) {
      indicatorsByYear = parseJournalRankIndicators(await indicatorsResponse.text());
    }
  } catch {
    indicatorsByYear = new Map();
  }

  return createIndexingBundle({
    provider: "journalrank",
    platform: "Scopus",
    source: "Journal Rank CiteScore",
    sourceKey: "scopus",
    rows: mergeJournalRankIndicators(rows, indicatorsByYear),
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
    .filter((item) => item?.quartile);

  const selectDominantCandidate = (candidates = []) => {
    const candidateGroups = new Map();

    candidates.forEach((candidate) => {
      const key = [
        normalizeQuartile(candidate.quartile),
        normalizeComparableText(candidate.category),
      ].join("|");
      const current = candidateGroups.get(key) || { candidate, count: 0 };
      current.count += 1;
      candidateGroups.set(key, current);
    });

    const sortedGroups = [...candidateGroups.values()].sort((first, second) => second.count - first.count);
    const [dominant, runnerUp] = sortedGroups;

    if (!dominant || (runnerUp && runnerUp.count === dominant.count)) {
      return null;
    }

    return dominant.candidate;
  };

  const mergeSelectedCandidates = (candidates, status, reason) => {
    const quartiles = uniqueValues(candidates.map((item) => item.quartile));
    const categories = uniqueValues(candidates.flatMap((item) => splitCategoryKeys(item.category)));

    if (quartiles.length > 1 || categories.length > 1) {
      const dominantCandidate = status === "historical" ? selectDominantCandidate(candidates) : null;

      if (!dominantCandidate) {
        return {
          indexing: items.map((item) => markQuartileSelection(item, false, "manual_required", "conflicting_provider_results")),
          selected: null,
          status: "manual_required",
          reason: "conflicting_provider_results",
        };
      }

      candidates = [dominantCandidate];
      reason = "historical_dominant_quartile";
    }

    const providerPriority = ["scopus", "scimago"];
    const selected = candidates
      .sort((first, second) => {
        const firstIndex = providerPriority.indexOf(normalizeIndexingSourceKey(first.sourceKey || first.source_key || first.source));
        const secondIndex = providerPriority.indexOf(normalizeIndexingSourceKey(second.sourceKey || second.source_key || second.source));

        return (firstIndex === -1 ? providerPriority.length : firstIndex)
          - (secondIndex === -1 ? providerPriority.length : secondIndex);
      })[0];

    return {
      indexing: items.map((item) => markQuartileSelection(
        item,
        sameIndexingCandidate(item, selected),
        status,
        reason
      )),
      selected,
      status,
      reason,
    };
  };

  const verifiedCandidates = selectedCandidates.filter((item) =>
    Boolean(item.quartileVerified || item.quartile_verified)
    || String(item.quartileVerificationStatus || item.quartile_verification_status).toLowerCase() === "verified"
  );

  if (verifiedCandidates.length) {
    return mergeSelectedCandidates(verifiedCandidates, "verified", "provider_results_agree");
  }

  const historicalCandidates = selectedCandidates.filter((item) =>
    String(item.quartileVerificationStatus || item.quartile_verification_status).toLowerCase() === "historical"
  );

  if (historicalCandidates.length) {
    return mergeSelectedCandidates(historicalCandidates, "historical", "historical_provider_results_agree");
  }

  if (!selectedCandidates.length) {
    const hasRejectedQuartile = items.some((item) => item.quartile);

    return {
      indexing: items.map((item) => markQuartileSelection(
        item,
        false,
        hasRejectedQuartile ? "manual_required" : "missing",
        hasRejectedQuartile ? "no_unambiguous_quartile" : "no_ranking_quartile_found"
      )),
      selected: null,
      status: hasRejectedQuartile ? "manual_required" : "missing",
      reason: hasRejectedQuartile ? "no_unambiguous_quartile" : "no_ranking_quartile_found",
    };
  }

  return {
    indexing: items.map((item) => markQuartileSelection(item, false, "manual_required", "no_unambiguous_quartile")),
    selected: null,
    status: "manual_required",
    reason: "no_unambiguous_quartile",
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
  const quartileStatus = normalizeText(indexingResolution.status || selectedQuartile?.quartileVerificationStatus || selectedQuartile?.quartile_verification_status || "").toLowerCase();
  const hasSelectedQuartile = Boolean(selectedQuartile && normalizeQuartile(selectedQuartile.quartile));
  const quartileVerified = Boolean(hasSelectedQuartile && quartileStatus === "verified");
  const quartileHistorical = Boolean(hasSelectedQuartile && quartileStatus === "historical");
  const quartile = hasSelectedQuartile ? normalizeQuartile(selectedQuartile.quartile) : "";
  const firstIndexing = selectedQuartile || indexing.find((item) => item?.indexingVerified || item?.source || item?.quartile || item?.category || item?.sjr || item?.citeScore) || {};
  const indexingVerified = Boolean(firstIndexing.indexingVerified || firstIndexing.indexing_verified);
  const indexingSource = indexingVerified || hasSelectedQuartile
    ? normalizeIndexingSourceKey(firstIndexing.indexingSource || firstIndexing.indexing_source || firstIndexing.sourceKey || firstIndexing.source_key || firstIndexing.source)
    : "manual";
  const quartileSource = hasSelectedQuartile
    ? normalizeIndexingSourceKey(selectedQuartile.quartileSource || selectedQuartile.quartile_source || selectedQuartile.sourceKey || selectedQuartile.source_key || selectedQuartile.source)
    : "manual";
  const quartileVerificationStatus = hasSelectedQuartile
    ? quartileStatus || (quartileVerified ? "verified" : "historical")
    : (["manual_required", "missing"].includes(indexingResolution.status) ? indexingResolution.status : "missing");
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
    quartileHistorical,
    quartile_historical: quartileHistorical,
    quartileSource,
    quartile_source: quartileSource,
    quartileVerificationStatus,
    quartile_verification_status: quartileVerificationStatus,
    quartileSelectionReason: indexingResolution.reason || "",
    quartile_selection_reason: indexingResolution.reason || "",
    indexingPlatform: indexingVerified ? firstIndexing.source || firstIndexing.platform || "" : "",
    indexing_platform: indexingVerified ? firstIndexing.source || firstIndexing.platform || "" : "",
    indexingCategory: hasSelectedQuartile ? firstIndexing.category || "" : "",
    indexing_category: hasSelectedQuartile ? firstIndexing.category || "" : "",
    indexingVerified,
    indexing_verified: indexingVerified,
    indexingSource,
    indexing_source: indexingSource,
    sjr: firstIndexing.sjr || "",
    citeScore: firstIndexing.citeScore || firstIndexing.cite_score || "",
    cite_score: firstIndexing.citeScore || firstIndexing.cite_score || "",
    citeScoreVerified: Boolean(firstIndexing.citeScoreVerified || firstIndexing.cite_score_verified),
    cite_score_verified: Boolean(firstIndexing.citeScoreVerified || firstIndexing.cite_score_verified),
    indexing,
  };

  const normalizedMetadata = normalizeConferenceMissingMetadata(enrichedMetadata);
  const fieldSources = buildMetadataFieldSources(normalizedMetadata);

  return {
    ...normalizedMetadata,
    fieldSources,
    field_sources: fieldSources,
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
    const conferenceEnriched = await enrichConferencePublisherMetadata(metadata);
    return enrichMetadataIndexing(await enrichMetadataCorrespondingAuthors(conferenceEnriched));
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
    const hadCorrespondingLookup = Boolean(getCorrespondingLookup(cached));
    const enrichedCorresponding = await enrichMetadataCorrespondingAuthors(cached);
    const metadata = await enrichMetadataIndexing(enrichedCorresponding);

    if (!hadCorrespondingLookup && getCorrespondingLookup(metadata)) {
      await upsertDoiMetadata(dbOrClient, metadata);
    }

    return { source: "cache", metadata };
  }

  const metadata = await fetchDoiMetadata(doi);
  await upsertDoiMetadata(dbOrClient, metadata);
  return { source: "api", metadata };
}
