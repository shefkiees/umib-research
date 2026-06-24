const WEB_OF_SCIENCE_AMOUNT = 1000;

const WEB_OF_SCIENCE_RULES = Object.freeze({
  SCIE: "web_of_science_scie",
  SSCI: "web_of_science_ssci",
  AHCI: "web_of_science_ahci",
  ESCI: "web_of_science_esci",
});

const SCOPUS_RULES = Object.freeze({
  Q1: { amount: 800, reason: "scopus_q1" },
  Q2: { amount: 600, reason: "scopus_q2" },
  Q3: { amount: 400, reason: "scopus_q3" },
  Q4: { amount: 300, reason: "scopus_q4" },
});

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeToken(value) {
  return normalizeText(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizePlatformValue(value) {
  return normalizeText(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeWebOfScienceIndex(value) {
  const match = normalizeText(value).toUpperCase().match(/\b(SCIE|SSCI|AHCI|ESCI)\b/);
  return match?.[1] || "";
}

function normalizeQuartile(value) {
  const match = normalizeText(value).toUpperCase().match(/\bQ[1-4]\b/);
  return match?.[0] || "";
}

function isPlatform(value, platform) {
  const normalized = normalizePlatformValue(value);
  const compact = normalized.replace(/\s+/g, "");

  if (platform === "scopus") {
    return normalized.includes("scopus")
      || normalized.includes("citescore")
      || normalized.includes("cite score")
      || normalized.includes("journal rank citescore");
  }

  return normalized.includes("web of science")
    || compact.includes("webofscience")
    || normalized.includes("wos")
    || normalized.includes("clarivate");
}

function getIndexingPlatformValue(item = {}) {
  return [
    item.source,
    item.platform,
    item.sourceKey,
    item.source_key,
  ].filter(Boolean).join(" ");
}

function getIndexingItems(metadata) {
  return Array.isArray(metadata?.indexing) ? metadata.indexing.filter(Boolean) : [];
}

function getWebOfScienceIndex(metadata, indexingItems) {
  const directIndex = normalizeWebOfScienceIndex(
    metadata?.webOfScienceIndex || metadata?.web_of_science_index
  );

  if (directIndex) {
    return directIndex;
  }

  const itemIndex = indexingItems
    .filter((item) => isPlatform(getIndexingPlatformValue(item), "web_of_science"))
    .map((item) => normalizeWebOfScienceIndex(
      item.webOfScienceIndex || item.web_of_science_index || item.category
    ))
    .find(Boolean);

  if (itemIndex) {
    return itemIndex;
  }

  const platform = metadata?.indexingPlatform || metadata?.indexing_platform;
  return isPlatform(platform, "web_of_science")
    ? normalizeWebOfScienceIndex(metadata?.indexingCategory || metadata?.indexing_category)
    : "";
}

function getScopusQuartile(metadata, indexingItems) {
  const scopusItem = indexingItems.find((item) => {
    const platform = getIndexingPlatformValue(item);
    return isPlatform(platform, "scopus") && normalizeQuartile(item.quartile);
  });

  if (scopusItem) {
    return normalizeQuartile(scopusItem.quartile);
  }

  const platform = metadata?.indexingPlatform || metadata?.indexing_platform
    || metadata?.indexingSource || metadata?.indexing_source;

  if (!isPlatform(platform, "scopus")) {
    return "";
  }

  return normalizeQuartile(
    metadata?.scopusQuartile || metadata?.scopus_quartile || metadata?.quartile
  );
}

function getPublicationType(metadata) {
  return normalizeToken(metadata?.publicationType || metadata?.publication_type || metadata?.type);
}

function getPublicationSubtype(metadata) {
  const raw = metadata?.raw_json || {};
  return normalizeToken(
    metadata?.publicationSubtype
    || metadata?.publication_subtype
    || metadata?.subtype
    || raw.publicationSubtype
    || raw.publication_subtype
    || raw.subtype
    || raw.type
  );
}

function resolved(amount, reason) {
  return { amount, reason, unresolvedReason: null };
}

function unresolved(unresolvedReason) {
  return { amount: null, reason: null, unresolvedReason };
}

/**
 * Calculates the university financing amount for an F1 publication.
 * This function has no side effects and does not apply to F2 or F3 requests.
 */
export function calculateF1PublicationAmount(metadata = {}) {
  const indexingItems = getIndexingItems(metadata);
  const webOfScienceIndex = getWebOfScienceIndex(metadata, indexingItems);
  const webOfScienceReason = WEB_OF_SCIENCE_RULES[webOfScienceIndex];

  if (webOfScienceReason) {
    return resolved(WEB_OF_SCIENCE_AMOUNT, webOfScienceReason);
  }

  const scopusQuartile = getScopusQuartile(metadata, indexingItems);
  const scopusRule = SCOPUS_RULES[scopusQuartile];

  if (scopusRule) {
    return resolved(scopusRule.amount, scopusRule.reason);
  }

  const publicationType = getPublicationType(metadata);
  const publicationSubtype = getPublicationSubtype(metadata);
  const isBookChapter = [publicationType, publicationSubtype].some((value) =>
    value === "book_chapter" || value === "chapter"
  );

  if (isBookChapter) {
    return resolved(200, "book_chapter");
  }

  if (publicationType === "book") {
    return resolved(600, "book");
  }

  return unresolved("no_matching_financing_rule");
}
