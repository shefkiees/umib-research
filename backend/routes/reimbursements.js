import express from "express";
import db from "../config/db.js";
import {
  buildReimbursementDocx,
  buildReimbursementPdf,
  getReimbursementDocumentFilenames,
} from "../services/reimbursementDocument.service.js";
import {
  REIMBURSEMENT_TYPE_LABELS,
  getRequiredFields,
  requiresBank,
} from "../../shared/reimbursementSchema.js";
import { createNotification, sendEmailNotification } from "../services/notification.service.js";

const router = express.Router();

const REQUEST_TYPES = REIMBURSEMENT_TYPE_LABELS;

const VALID_REIMBURSEMENT_STATUSES = new Set([
  "draft",
  "submitted",
  "received",
  "in_review",
  "needs_correction",
  "committee_approved",
  "approved",
  "rejected",
  "paid",
]);

const VALID_METADATA_REVIEW_STATUSES = new Set(["unchecked", "in_review", "ok", "correction"]);

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  received: "Pranuar",
  in_review: "Ne shqyrtim",
  needs_correction: "Kthyer per korrigjim",
  committee_approved: "Aprovuar nga komisioni",
  approved: "Aprovuar",
  rejected: "Refuzuar",
  paid: "Paguar",
};

const COMMITTEE_APPROVAL_EVENT_NOTE = "Kërkesa u aprovua nga komisioni.";
const COMMITTEE_APPROVAL_EMAIL_SUBJECT = "Përditësim mbi kërkesën tuaj – UMIB";

const METADATA_REVIEW_STATUS_LABELS = {
  unchecked: "Pa kontrolluar",
  in_review: "Ne kontroll",
  ok: "Metadata OK",
  correction: "Kerkohet korrigjim",
};

const ROLE_LABELS = {
  professor: "Profesor",
  committee: "Komision",
  prorector: "Prorektor",
  admin: "Administrator",
};

const ROLE_ALIASES = {
  administrator: "admin",
  admin: "admin",
  committee: "committee",
  commission: "committee",
  komision: "committee",
  komisioni: "committee",
  prorektor: "prorector",
  prorector: "prorector",
  prorektorat: "prorector",
  professor: "professor",
  profesor: "professor",
};

const KOSOVO_BANKS = [
  { name: "Banka Kombetare Tregtare Kosove", swift: "NCBAXKPR", ibanCodes: ["1701", "17"] },
  { name: "ProCredit Bank Kosovo", swift: "MBKOXKPR", ibanCodes: ["1101", "11"] },
  { name: "Raiffeisen Bank Kosovo", swift: "RBKOXKPR", ibanCodes: ["1503", "1212", "1201", "12"] },
  { name: "TEB Bank Kosovo", swift: "TEBKXKPR", ibanCodes: ["1501", "15"] },
  { name: "NLB Banka", swift: "NLPRXKPR", ibanCodes: ["1301", "13"] },
  { name: "Banka per Biznes", swift: "BPBXXKPR", ibanCodes: ["1601", "16"] },
  { name: "Ziraat Bank Kosovo", swift: "TCZBXKPR", ibanCodes: ["1801", "18"] },
  { name: "Isbank Kosovo", swift: "ISBKXKPR", ibanCodes: ["1901", "19"] },
  { name: "PriBank", swift: "PHHAXKPR", ibanCodes: ["2101", "21"] },
  { name: "Economic Bank", swift: "EKOMXKPR", ibanCodes: ["1401", "14"] },
];

const COMMITTEE_REVIEW_STATUSES = ["submitted", "received", "in_review", "needs_correction"];
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_ATTACHMENT_DOCUMENT_TYPES = new Set([
  "article_pdf",
  "uibm_database_evidence",
  "acceptance_letter",
  "conference_program",
  "presentation_evidence",
  "financial_document",
  "other",
]);
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const CURRENCY_FALLBACK = "EUR";
const RETIRED_REASON_FIELD = "pur" + "pose";
const ATTACHMENTS_REQUIRED_MESSAGE =
  "Kërkesa nuk mund të dërgohet për shqyrtim sepse nuk janë ngarkuar dokumentet mbështetëse. Kërkesa është ruajtur si draft.";

const PUBLICATION_READ_ONLY_FORM_FIELDS = new Set([
  "doi",
  "publicationTitle",
  "publicationType",
  "venue",
  "journal",
  "publishedIn",
  "publisher",
  "publicationDate",
  "publicationYear",
  "publicationLink",
  "mainAuthor",
  "correspondingAuthor",
  "coauthors",
  "affiliation",
  "indexingPlatform",
  "indexingCategory",
  "impactFactor",
  "scopusQuartile",
  "volume",
  "issue",
  "pages",
  "issn",
  "isbn",
  "abstract",
  "authors",
  "indexing",
  "publicationAttachments",
]);


function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te derguar kerkese." });
    return;
  }

  next();
}

function canManageReimbursements(user) {
  return ["committee", "prorector", "admin"].includes(normalizeRole(user?.role));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeRole(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[\s_-]+/g, "");
  return ROLE_ALIASES[normalized] || normalized;
}

function normalizeMetadataReviewChecklist(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return Object.entries(source).reduce((checklist, [key, checked]) => {
    const normalizedKey = normalizeText(key);

    if (!normalizedKey) {
      return checklist;
    }

    return {
      ...checklist,
      [normalizedKey]: Boolean(checked),
    };
  }, {});
}

function getActorName(actor) {
  return actor?.displayName || actor?.name || actor?.full_name || actor?.email || null;
}

function normalizeCurrency(value) {
  const currency = normalizeText(value).toUpperCase();

  if (!currency) {
    return CURRENCY_FALLBACK;
  }

  return /^[A-Z]{3}$/.test(currency) ? currency : CURRENCY_FALLBACK;
}

function parseAmount(value) {
  const normalized = normalizeText(value).replace(",", ".");

  if (!normalized) {
    return null;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

function normalizeIban(value) {
  return normalizeText(value).replace(/\s+/g, "").toUpperCase();
}

function ibanMod97(iban) {
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;

  for (const char of rearranged) {
    const code = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;

    if (!/^\d+$/.test(code)) {
      return null;
    }

    for (const digit of code) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder;
}

function isValidIban(value) {
  const iban = normalizeIban(value);

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return false;
  }

  if (iban.length < 15 || iban.length > 34) {
    return false;
  }

  if (iban.startsWith("XK") && iban.length !== 20) {
    return false;
  }

  return ibanMod97(iban) === 1;
}

function isKosovoIban(value) {
  return normalizeIban(value).startsWith("XK");
}

function isValidKosovoIban(value) {
  const iban = normalizeIban(value);
  return iban.startsWith("XK") && isValidIban(iban);
}

function isValidLocalAccountNumber(value) {
  return /^\d{8,24}$/.test(normalizeIban(value));
}

function isValidBankAccountIdentifier(value) {
  const account = normalizeIban(value);

  if (isKosovoIban(account)) {
    return isValidKosovoIban(account);
  }

  return isValidLocalAccountNumber(account);
}

function getBankIdentifiersFromAccount(value) {
  const account = normalizeIban(value);

  if (isValidKosovoIban(account)) {
    return [account.slice(4, 8), account.slice(4, 6)].filter(Boolean);
  }

  if (!/^\d{4,24}$/.test(account)) {
    return [];
  }

  return [account.slice(0, 4), account.slice(0, 2)].filter(Boolean);
}

function detectKosovoBankFromIban(value) {
  const identifiers = getBankIdentifiersFromAccount(value);

  if (!identifiers.length) {
    return null;
  }

  return KOSOVO_BANKS.find((bank) => identifiers.some((code) => bank.ibanCodes.includes(code))) || null;
}

function isValidSwift(value) {
  const swift = normalizeText(value).toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift);
}

function normalizeBankingData(formData, amount, currency) {
  const detectedBank = detectKosovoBankFromIban(formData.bankAccountNumber);
  const detectedBankCode = detectedBank
    ? getBankIdentifiersFromAccount(formData.bankAccountNumber).find((code) => detectedBank.ibanCodes.includes(code)) || ""
    : "";
  const bankName = normalizeText(formData.bankName) === "Tjeter"
    ? normalizeText(formData.bankNameOther)
    : normalizeText(formData.bankName);
  const swift = normalizeText(formData.swiftCode).toUpperCase();
  const bankSelectionSource = normalizeText(formData.bankSelectionSource);

  return {
    amount,
    currency,
    applicantName: normalizeText(formData.bankApplicantName),
    bankName: bankName || detectedBank?.name || "",
    iban: normalizeIban(formData.bankAccountNumber || formData.iban),
    swift: swift || detectedBank?.swift || "",
    country: normalizeText(formData.bankCountry),
    detectedBankCode,
    bankDetectedAutomatically: Boolean(detectedBank && bankSelectionSource !== "manual" && (!bankName || bankName === detectedBank.name)),
  };
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    return value.some(hasMeaningfulValue);
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(hasMeaningfulValue);
  }

  return normalizeText(value) !== "";
}

function sanitizeJsonValue(value, depth = 0) {
  if (depth > 6) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item) => hasMeaningfulValue(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, item]) => {
      const sanitizedKey = normalizeText(key).replace(/[^\w-]/g, "");

      if (!sanitizedKey) {
        return acc;
      }

      const sanitizedValue = sanitizeJsonValue(item, depth + 1);
      acc[sanitizedKey] = sanitizedValue;
      return acc;
    }, {});
  }

  return null;
}

function sanitizeRequestData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  return sanitizeJsonValue(data) || {};
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalizeText(value);
  }

  return date.toISOString().slice(0, 10);
}

function formatDocumentDate(value) {
  return formatDate(value).replaceAll("-", "");
}

function getCurrentUserProfile(row) {
  return {
    id: row.id,
    name: row.full_name || row.email || "",
    email: row.email || "",
    role: row.role || "professor",
    faculty: row.faculty || "",
    department: row.department || "",
    office: row.office || "",
    academicTitle: row.academic_title || "",
    scientificTitle: row.scientific_title || "",
    orcidId: row.orcid_id || "",
  };
}

function buildEditableAutoFields(user, formData) {
  const profile = getCurrentUserProfile(user);

  return {
    ...profile,
    name: normalizeText(formData.applicantName) || profile.name,
    email: normalizeText(formData.applicantEmail) || profile.email,
    faculty: normalizeText(formData.applicantFaculty) || profile.faculty,
    department: normalizeText(formData.applicantDepartment) || profile.department,
    office: normalizeText(formData.applicantOffice) || profile.office,
    orcidId: normalizeText(formData.applicantOrcidId) || profile.orcidId,
  };
}

const APPLICANT_PROFILE_FORM_FIELDS = [
  "applicantName",
  "applicantEmail",
  "applicantFaculty",
  "applicantDepartment",
  "applicantOffice",
  "applicantOrcidId",
  "academicTitle",
  "scientificTitle",
];

const BANK_PROFILE_FORM_FIELDS = [
  "bankAccountId",
  "bankAccountLabel",
  "bankApplicantName",
  "bankName",
  "bankNameOther",
  "bankAccountNumber",
  "iban",
  "swiftCode",
  "bankCountry",
  "currency",
  "banking",
  "detectedBankCode",
  "bankDetectedAutomatically",
  "bankSelectionSource",
];

const BANK_PROFILE_REQUIRED_FIELDS = [
  "bankApplicantName",
  "bankName",
  "bankAccountNumber",
  "swiftCode",
];

function usesServerApplicantSnapshot(requestType) {
  return requestType === "publication" || requestType === "conference";
}

function stripApplicantProfileFields(formData) {
  const next = { ...(formData || {}) };
  APPLICANT_PROFILE_FORM_FIELDS.forEach((field) => {
    delete next[field];
  });
  return next;
}

function usesServerBankSnapshot(requestType) {
  return requestType === "publication" || requestType === "conference";
}

function stripBankProfileFields(formData) {
  const next = { ...(formData || {}) };
  const selectedBankAccountId = normalizeText(next.selectedBankAccountId || next.bankAccountId);

  BANK_PROFILE_FORM_FIELDS.forEach((field) => {
    delete next[field];
  });

  if (selectedBankAccountId) {
    next.selectedBankAccountId = selectedBankAccountId;
  }

  return next;
}

function mapBankAccountSnapshot(row = {}) {
  const accountId = normalizeText(row.id);

  return {
    selectedBankAccountId: accountId,
    bankAccountId: accountId,
    bankAccountLabel: normalizeText(row.label),
    bankApplicantName: normalizeText(row.bank_applicant_name),
    bankName: normalizeText(row.bank_name),
    bankAccountNumber: normalizeIban(row.bank_account_number || row.iban),
    iban: normalizeIban(row.iban || row.bank_account_number),
    swiftCode: normalizeText(row.swift_code).toUpperCase(),
    bankCountry: normalizeText(row.bank_country) || "Kosove",
    currency: normalizeCurrency(row.currency),
    bankSelectionSource: "profile",
  };
}

function getLegacyBankingSnapshot(fallbackData = {}) {
  const banking = fallbackData.banking && typeof fallbackData.banking === "object" && !Array.isArray(fallbackData.banking)
    ? fallbackData.banking
    : {};
  const snapshot = {
    selectedBankAccountId: normalizeText(fallbackData.selectedBankAccountId || fallbackData.bankAccountId),
    bankAccountId: normalizeText(fallbackData.bankAccountId || fallbackData.selectedBankAccountId),
    bankAccountLabel: normalizeText(fallbackData.bankAccountLabel),
    bankApplicantName: normalizeText(fallbackData.bankApplicantName || banking.applicantName),
    bankName: normalizeText(fallbackData.bankName || banking.bankName),
    bankAccountNumber: normalizeIban(fallbackData.bankAccountNumber || fallbackData.iban || banking.iban),
    iban: normalizeIban(fallbackData.iban || fallbackData.bankAccountNumber || banking.iban),
    swiftCode: normalizeText(fallbackData.swiftCode || banking.swift).toUpperCase(),
    bankCountry: normalizeText(fallbackData.bankCountry || banking.country) || "Kosove",
    currency: normalizeCurrency(fallbackData.currency || banking.currency),
    bankSelectionSource: normalizeText(fallbackData.bankSelectionSource) || "legacy",
  };

  return BANK_PROFILE_REQUIRED_FIELDS.every((field) => hasMeaningfulValue(snapshot[field])) ? snapshot : null;
}

async function selectProfileBankAccount(dbOrClient, userId, bankAccountId) {
  const requestedId = normalizeText(bankAccountId);
  const selectedId = parseOptionalUuid(bankAccountId);

  if (requestedId && !selectedId) {
    return null;
  }

  const whereClause = selectedId
    ? "and id = $2"
    : "and is_default = true";
  const params = selectedId ? [userId, selectedId] : [userId];
  const result = await dbOrClient.query(
    `select id, label, bank_applicant_name, bank_name, bank_account_number, iban,
            swift_code, bank_country, currency, is_default
     from user_bank_accounts
     where user_id = $1
       and archived_at is null
       ${whereClause}
     order by is_default desc, updated_at desc nulls last, created_at desc
     limit 1`,
    params
  );

  return result.rows[0] || null;
}

async function applyBankAccountSnapshot(dbOrClient, requestType, formData, userId, fallbackData = {}) {
  if (!usesServerBankSnapshot(requestType)) {
    return formData || {};
  }

  const strippedFormData = stripBankProfileFields(formData);
  const selectedBankAccountId = normalizeText(strippedFormData.selectedBankAccountId);
  const selectedBankAccount = selectedBankAccountId
    ? await selectProfileBankAccount(dbOrClient, userId, selectedBankAccountId)
    : null;
  const defaultBankAccount = selectedBankAccount || (!selectedBankAccountId
    ? await selectProfileBankAccount(dbOrClient, userId, "")
    : null);
  const legacySnapshot = getLegacyBankingSnapshot(fallbackData);
  const bankSnapshot = defaultBankAccount
    ? mapBankAccountSnapshot(defaultBankAccount)
    : legacySnapshot;

  if (!bankSnapshot) {
    return strippedFormData;
  }

  return {
    ...strippedFormData,
    ...bankSnapshot,
  };
}

function getBankAccountSnapshotValidationError(requestType, formData) {
  if (!usesServerBankSnapshot(requestType)) {
    return null;
  }

  const missingRequiredBankFields = BANK_PROFILE_REQUIRED_FIELDS
    .filter((field) => !hasMeaningfulValue(formData?.[field]));

  if (!missingRequiredBankFields.length) {
    return null;
  }

  return {
    field: "selectedBankAccountId",
    message: "Ju lutem shtoni një llogari bankare në profil para aplikimit.",
  };
}

function buildApplicantSnapshot(user, fallbackData = {}) {
  const profile = getCurrentUserProfile(user);

  return {
    applicantName: normalizeText(profile.name) || normalizeText(fallbackData.applicantName),
    applicantEmail: normalizeText(profile.email) || normalizeText(fallbackData.applicantEmail),
    applicantFaculty: normalizeText(profile.faculty) || normalizeText(fallbackData.applicantFaculty),
    applicantDepartment: normalizeText(profile.department) || normalizeText(fallbackData.applicantDepartment),
    applicantOffice: normalizeText(profile.office) || normalizeText(fallbackData.applicantOffice),
    applicantOrcidId: normalizeText(profile.orcidId) || normalizeText(fallbackData.applicantOrcidId),
    academicTitle: normalizeText(profile.academicTitle) || normalizeText(fallbackData.academicTitle),
    scientificTitle: normalizeText(profile.scientificTitle) || normalizeText(fallbackData.scientificTitle),
  };
}

function applyApplicantSnapshot(requestType, formData, user, fallbackData = {}) {
  if (!usesServerApplicantSnapshot(requestType)) {
    return formData || {};
  }

  return {
    ...stripApplicantProfileFields(formData),
    ...buildApplicantSnapshot(user, fallbackData),
  };
}

function getApplicantSnapshotValidationError(requestType, formData) {
  if (!usesServerApplicantSnapshot(requestType)) {
    return null;
  }

  const missingRequiredProfileFields = ["applicantName", "applicantEmail", "applicantFaculty"]
    .filter((field) => !hasMeaningfulValue(formData?.[field]));

  if (!missingRequiredProfileFields.length) {
    return null;
  }

  return {
    field: "profile",
    message: "Ju lutem plotesoni emrin, email-in dhe njesine akademike ne profil para aplikimit.",
  };
}

async function loadCurrentUser(userId) {
  const result = await db.query(
    `select id, google_id, orcid_id, email, full_name, role, faculty, department, office,
            academic_title, scientific_title
     from users
     where id = $1
     limit 1`,
    [userId]
  );

  return result.rows[0] || null;
}

function buildRequestTitle(requestType, data) {
  if (requestType === "publication") {
    return normalizeText(data.publicationTitle || data.doi) || REQUEST_TYPES.publication;
  }

  if (requestType === "conference") {
    return normalizeText(data.conferenceTitle || data.eventName) || REQUEST_TYPES.conference;
  }

  return normalizeText(data.projectTitle || data.projectCode) || REQUEST_TYPES.project;
}

function parseOptionalUuid(value) {
  const text = normalizeText(value);

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function parseOptionalInteger(value) {
  const text = normalizeText(value);

  if (!/^\d+$/.test(text)) {
    return null;
  }

  return Number(text);
}

function mapPublicationRow(row) {
  const authors = safeJsonArray(row.authors);
  const indexing = safeJsonArray(row.indexing);
  const venue = row.venue || row.container_title || "";

  return {
    id: row.id,
    doi: row.doi || "",
    title: row.title || "",
    abstract: row.abstract || "",
    publicationType: row.publication_type || row.publicationType || "",
    publication_type: row.publication_type || row.publicationType || "",
    venue,
    journal: venue,
    publishedIn: venue,
    published_in: venue,
    conferenceLocation: row.conference_location || row.conferenceLocation || "",
    conference_location: row.conference_location || row.conferenceLocation || "",
    publisher: row.publisher || "",
    publicationDate: formatDate(row.publication_date || row.publicationDate || row.published_date),
    publication_date: formatDate(row.publication_date || row.publicationDate || row.published_date),
    publicationYear: row.publication_year || row.year || "",
    publication_year: row.publication_year || row.year || "",
    status: row.status || "",
    sourceUrl: row.source_url || "",
    source_url: row.source_url || "",
    volume: row.volume || "",
    issue: row.issue || "",
    pages: row.pages || "",
    issn: row.issn || "",
    isbn: row.isbn || "",
    authors,
    indexing,
    identifiers: safeJsonArray(row.identifiers),
    evidenceLinks: safeJsonArray(row.evidence_links || row.evidenceLinks),
    evidence_links: safeJsonArray(row.evidence_links || row.evidenceLinks),
  };
}

let publicationContextSchemaCache = null;

async function hasPublicationContextColumns(dbOrClient) {
  if (publicationContextSchemaCache !== null) {
    return publicationContextSchemaCache;
  }

  const { rows } = await dbOrClient.query(
    `select count(*)::int as count
     from information_schema.columns
     where table_schema = current_schema()
       and table_name = 'publications'
       and column_name in (
         'abstract',
         'publication_type',
         'conference_location',
         'publisher',
         'publication_date',
         'source_url',
         'volume',
         'issue',
         'pages',
         'issn',
         'isbn'
       )`
  );
  const tableResult = await dbOrClient.query(
    `select count(*)::int as count
     from information_schema.tables
     where table_schema = current_schema()
       and table_name in ('publication_authors', 'publication_indexing', 'publication_identifiers', 'publication_attachments')`
  );

  publicationContextSchemaCache =
    Number(rows[0]?.count || 0) === 11
    && Number(tableResult.rows[0]?.count || 0) === 4;
  return publicationContextSchemaCache;
}

function mapConferenceRow(row) {
  return {
    id: row.id,
    title: row.title || "",
    acronym: row.acronym || "",
    field: row.field || "",
    location: row.location || "",
    submissionDeadline: formatDate(row.submission_deadline),
    conferenceDate: formatDate(row.conference_date),
    website: row.website || "",
  };
}

function safeJsonArray(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function authorDisplayName(author = {}) {
  const safeAuthor = author || {};

  return normalizeText(
    safeAuthor.fullName
    || safeAuthor.full_name
    || [safeAuthor.givenName || safeAuthor.given_name, safeAuthor.familyName || safeAuthor.family_name].filter(Boolean).join(" ")
  );
}

function authorAffiliation(author = {}) {
  return normalizeText((author || {}).affiliation);
}

function uniqueNonEmptyValues(values = []) {
  return values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index);
}

function buildPublicationWorkSummary(publication) {
  return [
    normalizeText(publication?.title),
    normalizeText(publication?.abstract),
  ].filter(Boolean).join("\n\n");
}

function getPublicationAuthorAffiliations(publication) {
  const authors = Array.isArray(publication?.authors) ? publication.authors : [];

  return authors
    .map((author) => {
      const name = authorDisplayName(author);
      const affiliation = authorAffiliation(author);

      return name && affiliation ? `${name} - ${affiliation}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildPublicationSourceLink(publication) {
  const sourceUrl = normalizeText(publication?.sourceUrl || publication?.source_url);
  const doi = normalizeText(publication?.doi);

  return sourceUrl || (doi ? `https://doi.org/${doi}` : "");
}

function publicationToReadOnlyRequestData(publication) {
  if (!publication) {
    return {};
  }

  const authors = Array.isArray(publication.authors) ? publication.authors : [];
  const mainAuthor = authors.find((author) => author.isMainAuthor || author.is_main_author) || authors[0] || null;
  const correspondingAuthor = authors.find((author) => author.isCorrespondingAuthor || author.is_corresponding_author) || mainAuthor;
  const mainAuthorName = authorDisplayName(mainAuthor);
  const coauthors = authors
    .filter((author) => {
      const name = authorDisplayName(author);
      return name && name !== mainAuthorName;
    })
    .map(authorDisplayName)
    .join("; ");
  const indexing = Array.isArray(publication.indexing) ? publication.indexing : [];
  const indexingPlatform = uniqueNonEmptyValues(indexing.map((item) => item.source || item.platform))
    .join(", ") || normalizeText(publication.indexingPlatform || publication.indexing_platform);
  const indexingCategory = indexing
    .map((item) => normalizeText(item.category))
    .find(Boolean) || normalizeText(publication.indexingCategory || publication.indexing_category);
  const firstImpactFactor = indexing.find((item) => hasMeaningfulValue(item.impactFactor || item.impact_factor));
  const firstQuartile = indexing.find((item) => hasMeaningfulValue(item.quartile));
  const firstCiteScore = indexing.find((item) => hasMeaningfulValue(item.citeScore || item.cite_score || item.citescore));
  const citeScore = normalizeText(
    firstQuartile?.citeScore
    || firstQuartile?.cite_score
    || firstQuartile?.citescore
    || firstCiteScore?.citeScore
    || firstCiteScore?.cite_score
    || firstCiteScore?.citescore
    || publication.citeScore
    || publication.cite_score
    || publication.citescore
  );
  const venue = normalizeText(publication.venue || publication.publishedIn || publication.published_in || publication.journal);
  const evidenceLinks = Array.isArray(publication.evidenceLinks || publication.evidence_links)
    ? (publication.evidenceLinks || publication.evidence_links)
    : [];
  const identifiers = Array.isArray(publication.identifiers) ? publication.identifiers : [];

  return {
    publicationId: publication.id ? String(publication.id) : "",
    doi: normalizeText(publication.doi),
    publicationTitle: normalizeText(publication.title),
    publicationType: normalizeText(publication.publicationType || publication.publication_type),
    venue,
    journal: venue,
    publishedIn: venue,
    conferenceLocation: normalizeText(publication.conferenceLocation || publication.conference_location),
    publisher: normalizeText(publication.publisher),
    publicationDate: formatDate(publication.publicationDate || publication.publication_date),
    publicationYear: normalizeText(publication.publicationYear || publication.publication_year || publication.year),
    publicationLink: normalizeText(publication.sourceUrl || publication.source_url),
    volume: normalizeText(publication.volume),
    issue: normalizeText(publication.issue),
    pages: normalizeText(publication.pages),
    issn: normalizeText(publication.issn),
    isbn: normalizeText(publication.isbn),
    abstract: normalizeText(publication.abstract),
    mainAuthor: mainAuthorName,
    correspondingAuthor: authorDisplayName(correspondingAuthor),
    coauthors,
    affiliation: authorAffiliation(mainAuthor) || authorAffiliation(authors.find((author) => authorAffiliation(author))),
    indexingPlatform,
    indexingCategory,
    impactFactor: normalizeText(firstImpactFactor?.impactFactor || firstImpactFactor?.impact_factor),
    scopusQuartile: normalizeText(firstQuartile?.quartile),
    ...(citeScore ? { citeScore } : {}),
    publicationIdentifiers: identifiers
      .map((item) => [item.type || item.identifier_type, item.value || item.identifier_value].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("; "),
    publicationAttachments: evidenceLinks
      .map((item) => item.url || item.fileUrl || item.file_url)
      .filter(Boolean)
      .join("; "),
  };
}

function publicationToConferenceRequestData(publication) {
  if (!publication) {
    return {};
  }

  const publicationData = publicationToReadOnlyRequestData(publication);

  return {
    publicationId: publicationData.publicationId,
    publicationTitle: publicationData.publicationTitle,
    doi: publicationData.doi,
    publicationType: publicationData.publicationType,
    venue: publicationData.venue,
    journal: publicationData.journal,
    publishedIn: publicationData.publishedIn,
    publisher: publicationData.publisher,
    publicationDate: publicationData.publicationDate,
    publicationYear: publicationData.publicationYear,
    publicationLink: publicationData.publicationLink,
    volume: publicationData.volume,
    issue: publicationData.issue,
    pages: publicationData.pages,
    issn: publicationData.issn,
    isbn: publicationData.isbn,
    abstract: publicationData.abstract,
    mainAuthor: publicationData.mainAuthor,
    coParticipant: publicationData.coauthors,
    authorsAffiliation: getPublicationAuthorAffiliations(publication) || publicationData.affiliation,
    correspondingAuthor: publicationData.correspondingAuthor,
    coauthors: publicationData.coauthors,
    affiliation: publicationData.affiliation,
    indexingPlatform: publicationData.indexingPlatform,
    indexingCategory: publicationData.indexingCategory,
    impactFactor: publicationData.impactFactor,
    scopusQuartile: publicationData.scopusQuartile,
    abstractTitle: buildPublicationWorkSummary(publication),
    eventPublicationLink: buildPublicationSourceLink(publication),
  };
}

function stripPublicationReadOnlyFields(formData) {
  return Object.entries(formData || {}).reduce((acc, [field, value]) => {
    if (!PUBLICATION_READ_ONLY_FORM_FIELDS.has(field)) {
      acc[field] = value;
    }

    return acc;
  }, {});
}

function mergePublicationReadOnlyData(requestData, publication) {
  if (!publication) {
    return requestData || {};
  }

  return {
    ...(requestData || {}),
    ...publicationToReadOnlyRequestData(publication),
  };
}

function mergeConferencePublicationData(requestData, publication) {
  if (!publication) {
    return requestData || {};
  }

  return {
    ...(requestData || {}),
    ...publicationToConferenceRequestData(publication),
  };
}

function shouldLinkPublicationForRequest(requestType) {
  return requestType === "publication" || requestType === "conference";
}

function mergeLinkedPublicationData(requestType, requestData, publication) {
  if (requestType === "conference") {
    return mergeConferencePublicationData(requestData, publication);
  }

  if (requestType === "publication") {
    return mergePublicationReadOnlyData(requestData, publication);
  }

  return requestData || {};
}

async function applyLinkedPublicationSnapshot(dbOrClient, ownerId, requestType, formData, options = {}) {
  if (!shouldLinkPublicationForRequest(requestType)) {
    return { formData: formData || {}, publication: null, error: null };
  }

  const requestedPublicationId = normalizeText(formData?.publicationId);
  const publicationId = parseOptionalUuid(requestedPublicationId);

  if (!requestedPublicationId) {
    return { formData: formData || {}, publication: null, error: null };
  }

  if (!publicationId) {
    return {
      formData: formData || {},
      publication: null,
      error: {
        status: 400,
        error: "invalid_publication_id",
        message: "Publikimi i zgjedhur nuk eshte valid.",
      },
    };
  }

  const publication = await selectPublicationForReimbursement(dbOrClient, ownerId, publicationId);

  if (!publication && (options.requireExisting || requestedPublicationId)) {
    return {
      formData: formData || {},
      publication: null,
      error: {
        status: 400,
        error: "publication_not_found",
        message: "Publikimi i zgjedhur nuk u gjet.",
      },
    };
  }

  return {
    formData: requestType === "conference"
      ? mergeConferencePublicationData(formData, publication)
      : formData || {},
    publication,
    error: null,
  };
}

async function selectPublicationForReimbursement(dbOrClient, ownerId, publicationId) {
  if (!publicationId) {
    return null;
  }

  const hasPublicationColumns = await hasPublicationContextColumns(dbOrClient);
  const result = hasPublicationColumns
    ? await dbOrClient.query(
        `select p.id, p.doi, p.title, p.abstract, p.publication_type, p.venue, p.conference_location,
                p.publisher, p.publication_date, p.publication_year, p.status,
                p.source_url, p.volume, p.issue, p.pages, p.issn, p.isbn,
                coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'id', pa.id,
                        'fullName', pa.full_name,
                        'givenName', pa.given_name,
                        'familyName', pa.family_name,
                        'orcid', pa.orcid,
                        'affiliation', pa.affiliation,
                        'isMainAuthor', pa.is_main_author,
                        'isCorrespondingAuthor', pa.is_corresponding_author,
                        'position', pa.position
                      )
                      order by pa.position asc, pa.created_at asc
                    )
                    from publication_authors pa
                    where pa.publication_id = p.id
                  ),
                  '[]'::json
                ) as authors,
                coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'id', pi.id,
                        'source', pi.source,
                        'platform', pi.source,
                        'category', pi.category,
                        'quartile', pi.quartile,
                        'impactFactor', pi.impact_factor,
                        'sjr', pi.sjr,
                        'citeScore', pi.cite_score,
                        'indexedUrl', pi.indexed_url
                      )
                      order by pi.created_at asc
                    )
                    from publication_indexing pi
                    where pi.publication_id = p.id
                  ),
                  '[]'::json
                ) as indexing
                ,
                coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'type', pii.identifier_type,
                        'value', pii.identifier_value
                      )
                      order by pii.identifier_type asc, pii.identifier_value asc
                    )
                    from publication_identifiers pii
                    where pii.publication_id = p.id
                  ),
                  '[]'::json
                ) as identifiers,
                coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'url', pat.file_url,
                        'label', pat.file_type,
                        'uploadedAt', pat.uploaded_at
                      )
                      order by pat.uploaded_at desc
                    )
                    from publication_attachments pat
                    where pat.publication_id = p.id
                  ),
                  '[]'::json
                ) as evidence_links
         from publications p
         where p.id = $1
           and ($2::uuid is null or p.owner_id = $2)
         limit 1`,
        [publicationId, ownerId || null]
      )
    : await dbOrClient.query(
        `select p.id, p.doi, p.title, p.venue, p.publication_year, p.status,
                m.container_title, m.publisher, m.published_date as publication_date,
                m.year, m.source_url, m.type as publication_type, m.abstract,
                m.volume, m.issue, m.pages, m.issn, m.isbn
         from publications p
         left join publication_metadata m on m.doi = p.doi
         where p.id = $1
           and ($2::uuid is null or p.owner_id = $2)
         limit 1`,
        [publicationId, ownerId || null]
      );

  return result.rows[0] ? mapPublicationRow(result.rows[0]) : null;
}

async function hydrateReimbursementRowForPublication(dbOrClient, row) {
  if (!row || !shouldLinkPublicationForRequest(row.request_type)) {
    return row;
  }

  const requestData = row.request_data || {};
  const publicationId = row.publication_id || parseOptionalUuid(requestData.publicationId);
  const publication = await selectPublicationForReimbursement(dbOrClient, row.owner_id, publicationId);

  if (!publication) {
    return row;
  }

  return {
    ...row,
    request_data: mergeLinkedPublicationData(row.request_type, requestData, publication),
  };
}

async function hydrateReimbursementRowsForPublication(dbOrClient, rows) {
  return Promise.all(rows.map((row) => hydrateReimbursementRowForPublication(dbOrClient, row)));
}

function normalizeStatusHistory(value) {
  return safeJsonArray(value).map((item) => ({
    id: item.id,
    previousStatus: item.previousStatus || item.previous_status || null,
    previousStatusLabel: STATUS_LABELS[item.previousStatus || item.previous_status] || "",
    status: item.status || "",
    statusLabel: STATUS_LABELS[item.status] || item.status || "",
    actorId: item.actorId || item.actor_id || null,
    actorRole: item.actorRole || item.actor_role || "",
    actorRoleLabel: ROLE_LABELS[item.actorRole || item.actor_role] || item.actorRole || item.actor_role || "",
    actorName: item.actorName || item.actor_name || "",
    note: item.note || "",
    createdAt: item.createdAt || item.created_at || null,
  }));
}

function normalizeAttachments(value) {
  return safeJsonArray(value).map((item) => ({
    id: item.id,
    filename: item.filename || "",
    mimeType: item.mimeType || item.mime_type || "",
    sizeBytes: Number(item.sizeBytes || item.size_bytes || 0),
    documentType: item.documentType || item.document_type || null,
    document_type: item.documentType || item.document_type || null,
    uploadedBy: item.uploadedBy || item.uploaded_by || null,
    createdAt: item.createdAt || item.created_at || null,
    downloadUrl: item.id ? `/api/reimbursements/${item.reimbursementId || item.reimbursement_id}/attachments/${item.id}` : "",
  }));
}

function mapReimbursementRow(row) {
  const requestData = row.request_data || {};

  return {
    id: row.id,
    ownerId: row.owner_id,
    owner: {
      id: row.owner_id,
      name: row.owner_name || "",
      email: row.owner_email || "",
      faculty: row.owner_faculty || "",
      department: row.owner_department || "",
    },
    requestType: row.request_type || requestData.requestType || "",
    requestTypeLabel: REQUEST_TYPES[row.request_type] || requestData.requestTypeLabel || row.request_type || "",
    title: row.title || "",
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    currency: row.currency || CURRENCY_FALLBACK,
    status: row.status || "submitted",
    statusLabel: STATUS_LABELS[row.status] || row.status || "",
    submittedAt: row.submitted_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    documentNumber: row.document_number || "",
    documentFilename: row.document_filename || "",
    documentDocxFilename: row.document_docx_filename || "",
    downloadUrl: `/api/reimbursements/${row.id}/pdf`,
    docxDownloadUrl: `/api/reimbursements/${row.id}/docx`,
    statusHistory: normalizeStatusHistory(row.status_history || []),
    attachments: normalizeAttachments(row.attachments || []),
    metadataReviewStatus: requestData.metadataReviewStatus || requestData.metadata_review_status || "unchecked",
    metadata_review_status: requestData.metadataReviewStatus || requestData.metadata_review_status || "unchecked",
    metadataReviewChecklist: requestData.metadataReviewChecklist || requestData.metadata_review_checklist || {},
    metadata_review_checklist: requestData.metadataReviewChecklist || requestData.metadata_review_checklist || {},
    metadataReviewComment: requestData.metadataReviewComment || requestData.metadata_review_comment || "",
    metadata_review_comment: requestData.metadataReviewComment || requestData.metadata_review_comment || "",
    reviewHistory: requestData.metadataReviewHistory || requestData.metadata_review_history || [],
    review_history: requestData.metadataReviewHistory || requestData.metadata_review_history || [],
    requestData,
  };
}

function buildHistorySelect(whereClause) {
  return `select r.id, r.owner_id, r.publication_id, r.conference_id,
                 r.title, r.amount, r.currency, r.status, r.request_type, r.request_data,
                 r.document_number, r.document_filename, r.document_docx_filename,
                 r.submitted_at, r.created_at, r.updated_at,
                 u.full_name as owner_name, u.email as owner_email, u.faculty as owner_faculty, u.department as owner_department,
                 coalesce(
                   (
                     select json_agg(
                       json_build_object(
                         'id', h.id,
                         'previousStatus', h.previous_status,
                         'status', h.status,
                         'actorId', h.actor_id,
                         'actorRole', coalesce(h.actor_role, actor.role),
                         'actorName', coalesce(h.actor_name, actor.full_name, actor.email),
                         'note', h.note,
                         'createdAt', h.created_at
                       )
                       order by h.created_at asc
                     )
                     from reimbursement_status_history h
                     left join users actor on actor.id = h.actor_id
                     where h.reimbursement_id = r.id
                   ),
                   '[]'::json
                 ) as status_history,
                 coalesce(
                   (
                     select json_agg(
                       json_build_object(
                         'id', a.id,
                         'reimbursementId', a.reimbursement_id,
                         'filename', a.filename,
                         'mimeType', a.mime_type,
                         'sizeBytes', a.size_bytes,
                         'documentType', a.document_type,
                         'document_type', a.document_type,
                         'uploadedBy', a.uploaded_by,
                         'createdAt', a.created_at
                       )
                       order by a.created_at desc
                     )
                     from reimbursement_attachments a
                     where a.reimbursement_id = r.id
                   ),
                   '[]'::json
                 ) as attachments
          from reimbursements r
          left join users u on u.id = r.owner_id
          ${whereClause}`;
}

async function selectReimbursementWithHistoryById(id, client = db) {
  const result = await client.query(
    `${buildHistorySelect("where r.id = $1")}
     limit 1`,
    [id]
  );

  return hydrateReimbursementRowForPublication(client, result.rows[0] || null);
}

async function countReimbursementAttachments(client, reimbursementId) {
  const result = await client.query(
    `select count(*)::int as count
     from reimbursement_attachments
     where reimbursement_id = $1`,
    [reimbursementId]
  );

  return Number(result.rows[0]?.count || 0);
}

async function canAccessReimbursement(row, user) {
  if (!row) {
    return false;
  }

  return row.owner_id === user?.id || canManageReimbursements(user);
}

function validateRequiredFields(formData, requiredFields) {
  return requiredFields
    .filter(([field]) => !hasMeaningfulValue(formData[field]))
    .map(([field, message]) => ({ field, message }));
}

function addValidationError(errors, field, message) {
  if (!errors.some((item) => item.field === field)) {
    errors.push({ field, message });
  }
}

function hasCompleteWorkPlanItem(items) {
  return Array.isArray(items) && items.some((item) =>
    hasMeaningfulValue(item?.activity)
    && hasMeaningfulValue(item?.deadline)
    && hasMeaningfulValue(item?.responsiblePerson)
    && hasMeaningfulValue(item?.expectedResult)
  );
}

function hasCompleteCostItem(items) {
  return Array.isArray(items) && items.some((item) =>
    hasMeaningfulValue(item?.item)
    && hasMeaningfulValue(item?.quantity)
    && hasMeaningfulValue(item?.unitCost)
    && hasMeaningfulValue(item?.totalCost)
  );
}

function parsePositiveNumber(value) {
  const amount = Number(normalizeText(value).replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function validateProjectBudget(formData, errors) {
  const requested = parsePositiveNumber(formData.requestedFromUibm);
  const fields = [
    ["materialCost", "Kosto materiale (40%) eshte obligative."],
    ["administrativeCost", "Kosto administrative (30%) eshte obligative."],
    ["personnelCost", "Kosto te personelit (20%) eshte obligative."],
    ["otherCosts", "Kostot e tjera (10%) jane obligative."],
  ];

  const values = fields.map(([field, message]) => {
    const amount = parsePositiveNumber(formData[field]);

    if (amount === null) {
      addValidationError(errors, field, message);
    }

    return amount || 0;
  });

  if (requested !== null && values.every((value) => value >= 0)) {
    const sum = values.reduce((total, value) => total + value, 0);

    if (Math.abs(sum - requested) > 0.01) {
      addValidationError(
        errors,
        "requestedFromUibm",
        "Ndarja 40/30/20/10 duhet te barazohet me shumen e kerkuar nga UIBM."
      );
    }
  }
}

function validateReimbursementPayload(requestType, formData, options = {}) {
  const errors = [];
  const amount = parseAmount(formData.amount);

  if (normalizeText(formData.amount) && amount === null) {
    errors.push({ field: "amount", message: "Shuma duhet te jete numer valid." });
  }

  if (options.asDraft) {
    return errors;
  }

  errors.push(...validateRequiredFields(formData, getRequiredFields(requestType)));

  if (amount === null || amount <= 0) {
    errors.push({ field: "amount", message: "Shuma e kerkuar duhet te jete numer pozitiv." });
  }

  if (requiresBank(requestType)) {
    if (!isValidBankAccountIdentifier(formData.bankAccountNumber || formData.iban)) {
      errors.push({
        field: "bankAccountNumber",
        message: "Shkruaj IBAN valid te Kosoves ose numer vendor numerik te llogarise.",
      });
    }

    const detectedBank = detectKosovoBankFromIban(formData.bankAccountNumber || formData.iban);

    for (let index = errors.length - 1; index >= 0; index -= 1) {
      if (errors[index].field === "bankName" && (detectedBank || !hasMeaningfulValue(formData.bankName))) {
        errors.splice(index, 1);
      }

      if (errors[index]?.field === "swiftCode" && detectedBank) {
        errors.splice(index, 1);
      }
    }

    if (!detectedBank && !hasMeaningfulValue(formData.bankName)) {
      errors.push({ field: "bankName", message: "Banka nuk u identifikua nga numri i llogarise." });
    }

    if (!isValidSwift(detectedBank?.swift || formData.swiftCode)) {
      errors.push({ field: "swiftCode", message: "SWIFT/BIC duhet te kete 8 ose 11 karaktere valide." });
    }
  }

  if (requestType === "project") {
    const teamMembers = Array.isArray(formData.teamMembers) ? formData.teamMembers : [];
    const hasTeamMember = teamMembers.some((member) =>
      hasMeaningfulValue(member?.name) && hasMeaningfulValue(member?.email)
    );

    if (!hasTeamMember) {
      errors.push({
        field: "teamMembers",
        message: "Shto se paku nje anetar te ekipit hulumtues me emer dhe email.",
      });
    }

    if (!hasCompleteWorkPlanItem(formData.workPlanItems)) {
      errors.push({ field: "workPlanItems", message: "Shto se paku nje aktivitet te plote ne planin e punes." });
    }

    if (!hasCompleteCostItem(formData.costItems)) {
      errors.push({ field: "costItems", message: "Shto se paku nje rresht te plote ne pershkrimin e kostos." });
    }

    validateProjectBudget(formData, errors);
  }

  return errors;
}

function buildRequestPayload(user, requestType, formData, linkedRecords = {}) {
  const writableFormData = requestType === "publication"
    ? stripPublicationReadOnlyFields(formData)
    : { ...formData };
  delete writableFormData.attachmentUrl;
  delete writableFormData.notes;
  delete writableFormData[RETIRED_REASON_FIELD];
  const publicationId = shouldLinkPublicationForRequest(requestType) ? parseOptionalUuid(formData.publicationId) : null;

  if (shouldLinkPublicationForRequest(requestType)) {
    writableFormData.publicationId = publicationId || "";
  }

  const autoFields = buildEditableAutoFields(user, formData);
  const amount = parseAmount(writableFormData.amount);
  const currency = normalizeCurrency(writableFormData.currency);
  const banking = normalizeBankingData(writableFormData, amount, currency);
  const requestData = {
    ...writableFormData,
    amount: amount === null ? normalizeText(writableFormData.amount) : String(amount),
    currency,
    bankApplicantName: banking.applicantName,
    bankName: banking.bankName,
    bankAccountNumber: banking.iban,
    iban: banking.iban,
    swiftCode: banking.swift,
    bankCountry: banking.country,
    banking,
    auto: autoFields,
    requestType,
    requestTypeLabel: REQUEST_TYPES[requestType],
  };
  const documentRequestData = mergeLinkedPublicationData(requestType, requestData, linkedRecords.publication);
  const storedRequestData = requestType === "conference" ? documentRequestData : requestData;
  const title = buildRequestTitle(requestType, documentRequestData);
  const conferenceId = requestType === "conference" ? parseOptionalInteger(formData.conferenceId) : null;

  return { requestData: storedRequestData, documentRequestData, title, amount, currency, publicationId, conferenceId };
}

function buildPreviewRow(user, requestType, payload) {
  const now = new Date().toISOString();

  return {
    id: "preview",
    owner_id: user.id,
    title: payload.title,
    amount: payload.amount,
    currency: payload.currency,
    status: "submitted",
    request_type: requestType,
    request_data: payload.documentRequestData || payload.requestData,
    document_number: `PREVIEW-${getCurrentUserProfile(user).id || "RIMBURSIM"}`,
    submitted_at: now,
    created_at: now,
  };
}

async function insertStatusHistory(client, reimbursementId, previousStatus, status, actor, note) {
  const actorRole = normalizeRole(actor?.role);

  await client.query(
    `insert into reimbursement_status_history
     (reimbursement_id, previous_status, status, actor_id, actor_role, actor_name, note)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      reimbursementId,
      previousStatus,
      status,
      actor?.id || null,
      actorRole || null,
      getActorName(actor),
      note || `Statusi u ndryshua ne ${STATUS_LABELS[status] || status}.`,
    ]
  );
}

async function notifyOwner(client, reimbursementId, ownerId, status, note) {
  if (!ownerId) {
    return;
  }

  await createNotification(client, {
    userId: ownerId,
    title: `Rimbursimi: ${STATUS_LABELS[status] || status}`,
    message: note || `Statusi i kerkeses suaj u ndryshua ne ${STATUS_LABELS[status] || status}.`,
    category: "Rimbursime",
    metadata: {
      reimbursementId,
      status,
    },
    sendEmail: false,
  });
}

function escapeHtml(value) {
  return normalizeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInstitutionalDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return formatDate(value) || formatDate(new Date());
  }

  return date.toLocaleDateString("sq-AL", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function buildCommitteeApprovalEmailHtml({ title, statusLabel, updatedAt, comment }) {
  const safeTitle = escapeHtml(title || "Kërkesa juaj");
  const safeStatus = escapeHtml(statusLabel || "Aprovuar");
  const safeUpdatedAt = escapeHtml(formatInstitutionalDate(updatedAt));
  const safeComment = escapeHtml(comment);

  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f4f7fb">
        <tr>
          <td align="center" style="padding:28px 16px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;background:#ffffff;border:1px solid #d9e2ef">
              <tr>
                <td style="padding:22px 28px;background:#153a63;color:#ffffff">
                  <p style="margin:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase">Universiteti i Mitrovicës "Isa Boletini"</p>
                  <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3">Përditësim mbi kërkesën tuaj</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:28px">
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6">I/e nderuar,</p>
                  <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Komisioni ka përditësuar statusin e kërkesës suaj në platformën UMIBRes.</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 20px">
                    <tr>
                      <td style="padding:10px 0;border-bottom:1px solid #e5ebf3;color:#536177;width:38%">Titulli i publikimit</td>
                      <td style="padding:10px 0;border-bottom:1px solid #e5ebf3;font-weight:700">${safeTitle}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;border-bottom:1px solid #e5ebf3;color:#536177">Statusi i ri</td>
                      <td style="padding:10px 0;border-bottom:1px solid #e5ebf3;font-weight:700">${safeStatus}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;border-bottom:1px solid #e5ebf3;color:#536177">Data e përditësimit</td>
                      <td style="padding:10px 0;border-bottom:1px solid #e5ebf3;font-weight:700">${safeUpdatedAt}</td>
                    </tr>
                  </table>
                  ${safeComment ? `<div style="margin:0 0 20px;padding:14px 16px;background:#f7f9fc;border-left:4px solid #153a63"><strong style="display:block;margin:0 0 6px">Koment institucional</strong><p style="margin:0;line-height:1.6">${safeComment}</p></div>` : ""}
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#536177">Ky është njoftim automatik nga UMIBRes. Për pyetje shtesë, ju lutemi kontaktoni njësinë përgjegjëse institucionale.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function sendCommitteeApprovalEmail({ to, title, statusLabel, updatedAt, comment }) {
  const messageParts = [
    `Titulli i publikimit: ${title || "Kërkesa juaj"}`,
    `Statusi i ri: ${statusLabel || "Aprovuar"}`,
    `Data e përditësimit: ${formatInstitutionalDate(updatedAt)}`,
  ];

  if (comment) {
    messageParts.push(`Koment institucional: ${comment}`);
  }

  return sendEmailNotification({
    to,
    title: COMMITTEE_APPROVAL_EMAIL_SUBJECT,
    message: messageParts.join("\n"),
    category: "UMIBRes",
    html: buildCommitteeApprovalEmailHtml({ title, statusLabel, updatedAt, comment }),
  });
}

async function createGeneratedDocuments(client, row) {
  const documentNumber =
    row.document_number || `RIM-${formatDocumentDate(row.submitted_at || row.created_at)}-${String(row.id).slice(0, 8).toUpperCase()}`;
  const hydratedRow = await hydrateReimbursementRowForPublication(client, row);
  const rowForDocuments = { ...hydratedRow, document_number: documentNumber };
  const filenames = getReimbursementDocumentFilenames(rowForDocuments);
  const [pdfBuffer, docxBuffer] = await Promise.all([
    buildReimbursementPdf(rowForDocuments),
    buildReimbursementDocx(rowForDocuments),
  ]);

  const updateResult = await client.query(
    `update reimbursements
     set document_number = $2,
         document_filename = $3,
         document_docx_filename = $4,
         generated_pdf = $5,
         generated_docx = $6,
         updated_at = now()
     where id = $1
     returning id, owner_id, publication_id, conference_id, title, amount, currency, status, request_type, request_data,
               document_number, document_filename, document_docx_filename, submitted_at, created_at, updated_at`,
    [row.id, documentNumber, filenames.pdf, filenames.docx, pdfBuffer, docxBuffer]
  );

  return updateResult.rows[0];
}

async function ensureGeneratedDocument(row, format) {
  const sourceRow = await hydrateReimbursementRowForPublication(db, row);
  const documentNumber =
    sourceRow.document_number || `RIM-${formatDocumentDate(sourceRow.submitted_at || sourceRow.created_at)}-${String(sourceRow.id).slice(0, 8).toUpperCase()}`;
  const filenames = getReimbursementDocumentFilenames({
    ...sourceRow,
    document_number: documentNumber,
  });

  if (format === "docx") {
    const filename = sourceRow.document_docx_filename || filenames.docx;
    const buffer = sourceRow.generated_docx || (await buildReimbursementDocx({ ...sourceRow, document_number: documentNumber }));

    if (!sourceRow.generated_docx || !sourceRow.document_docx_filename || !sourceRow.document_number) {
      await db.query(
        `update reimbursements
         set document_number = coalesce(document_number, $2),
             document_docx_filename = coalesce(document_docx_filename, $3),
             generated_docx = coalesce(generated_docx, $4),
             updated_at = now()
         where id = $1`,
        [sourceRow.id, documentNumber, filename, buffer]
      );
    }

    return { buffer, filename };
  }

  const filename = sourceRow.document_filename || filenames.pdf;
  const buffer = sourceRow.generated_pdf || (await buildReimbursementPdf({ ...sourceRow, document_number: documentNumber }));

  if (!sourceRow.generated_pdf || !sourceRow.document_filename || !sourceRow.document_number) {
    await db.query(
      `update reimbursements
       set document_number = coalesce(document_number, $2),
           document_filename = coalesce(document_filename, $3),
           generated_pdf = coalesce(generated_pdf, $4),
           updated_at = now()
       where id = $1`,
      [sourceRow.id, documentNumber, filename, buffer]
    );
  }

  return { buffer, filename };
}

function getListScopeWhere(user, scope) {
  const normalizedScope = normalizeText(scope);
  const role = normalizeRole(user?.role);

  if (role === "professor" || normalizedScope === "mine") {
    return {
      where: "where r.owner_id = $1",
      params: [user.id],
    };
  }

  if ((role === "committee" && (!normalizedScope || normalizedScope === "review")) || (role === "admin" && normalizedScope === "review")) {
    return {
      where: "where r.status = any($1::text[])",
      params: [COMMITTEE_REVIEW_STATUSES],
    };
  }

  if ((role === "prorector" && (!normalizedScope || normalizedScope === "final")) || (role === "admin" && normalizedScope === "final")) {
    return {
      where: `where r.status in ('committee_approved', 'approved', 'rejected', 'paid')
              and exists (
                select 1
                from reimbursement_status_history h
                where h.reimbursement_id = r.id and h.status = 'committee_approved'
              )`,
      params: [],
    };
  }

  if (role === "admin" || normalizedScope === "all") {
    return {
      where: "where r.status <> 'draft'",
      params: [],
    };
  }

  return {
    where: "where r.owner_id = $1",
    params: [user.id],
  };
}

function getAllowedStatuses(user, currentStatus) {
  const role = normalizeRole(user?.role);

  if (role === "admin") {
    return Array.from(VALID_REIMBURSEMENT_STATUSES).filter((status) => status !== "draft");
  }

  if (role === "committee" && COMMITTEE_REVIEW_STATUSES.includes(currentStatus)) {
    const statuses = ["received", "in_review", "needs_correction", "rejected"];

    if (["submitted", "in_review"].includes(currentStatus)) {
      statuses.push("approved");
    }

    return statuses;
  }

  if (role === "prorector" && currentStatus === "committee_approved") {
    return ["approved", "rejected"];
  }

  if (role === "prorector" && currentStatus === "approved") {
    return ["paid"];
  }

  return [];
}

function parseAttachmentFile(file) {
  const filename = normalizeText(file?.filename).replace(/[\\/]/g, "-");
  const mimeType = normalizeText(file?.mimeType || file?.type);
  const base64 = normalizeText(file?.base64).replace(/^data:[^;]+;base64,/, "");
  const documentType = normalizeText(file?.documentType || file?.document_type);

  if (!filename) {
    return { error: "Emri i fajllit mungon." };
  }

  if (documentType && !ALLOWED_ATTACHMENT_DOCUMENT_TYPES.has(documentType)) {
    return { error: `Tipi i dokumentit ${documentType} nuk eshte valid.` };
  }

  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    return { error: "Lejohen vetem PDF, JPG, PNG dhe DOCX." };
  }

  if (!base64) {
    return { error: `Fajlli ${filename} nuk ka permbajtje valide.` };
  }

  const content = Buffer.from(base64, "base64");

  if (!content.length || content.length > MAX_ATTACHMENT_SIZE_BYTES) {
    return { error: `Fajlli ${filename} duhet te jete deri ne 10MB.` };
  }

  return { filename, mimeType, content, sizeBytes: content.length, documentType: documentType || null };
}

router.get("/context", requireAuthenticatedUser, async (req, res) => {
  try {
    const user = await loadCurrentUser(req.user.id);

    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    const hasPublicationColumns = await hasPublicationContextColumns(db);
    const publicationsQuery = hasPublicationColumns
      ? `select p.id, p.doi, p.title, p.abstract, p.publication_type, p.venue, p.conference_location,
                p.publisher, p.publication_date, p.publication_year, p.status,
                p.source_url, p.volume, p.issue, p.pages, p.issn, p.isbn,
                coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'id', pa.id,
                        'fullName', pa.full_name,
                        'givenName', pa.given_name,
                        'familyName', pa.family_name,
                        'orcid', pa.orcid,
                        'affiliation', pa.affiliation,
                        'isMainAuthor', pa.is_main_author,
                        'isCorrespondingAuthor', pa.is_corresponding_author,
                        'position', pa.position
                      )
                      order by pa.position asc, pa.created_at asc
                    )
                    from publication_authors pa
                    where pa.publication_id = p.id
                  ),
                  '[]'::json
                ) as authors,
                coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'id', pi.id,
                        'source', pi.source,
                        'platform', pi.source,
                        'category', pi.category,
                        'quartile', pi.quartile,
                        'impactFactor', pi.impact_factor,
                        'sjr', pi.sjr,
                        'citeScore', pi.cite_score,
                        'indexedUrl', pi.indexed_url
                      )
                      order by pi.created_at asc
                    )
                    from publication_indexing pi
                    where pi.publication_id = p.id
                  ),
                  '[]'::json
                ) as indexing
                ,
                coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'type', pii.identifier_type,
                        'value', pii.identifier_value
                      )
                      order by pii.identifier_type asc, pii.identifier_value asc
                    )
                    from publication_identifiers pii
                    where pii.publication_id = p.id
                  ),
                  '[]'::json
                ) as identifiers,
                coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'url', pat.file_url,
                        'label', pat.file_type,
                        'uploadedAt', pat.uploaded_at
                      )
                      order by pat.uploaded_at desc
                    )
                    from publication_attachments pat
                    where pat.publication_id = p.id
                  ),
                  '[]'::json
                ) as evidence_links
         from publications p
         where p.owner_id = $1
         order by p.updated_at desc, p.created_at desc
         limit 100`
      : `select p.id, p.doi, p.title, p.venue, p.publication_year, p.status,
                m.container_title, m.publisher, m.published_date as publication_date,
                m.year, m.source_url, m.type as publication_type, m.abstract,
                m.volume, m.issue, m.pages, m.issn, m.isbn,
                coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'id', pa.id,
                        'fullName', pa.full_name,
                        'firstName', pa.given_name,
                        'lastName', pa.family_name,
                        'givenName', pa.given_name,
                        'familyName', pa.family_name,
                        'affiliation', pa.affiliation,
                        'isMainAuthor', pa.is_main_author,
                        'authorOrder', pa.author_order,
                        'position', pa.position
                      )
                      order by coalesce(nullif(pa.author_order, 0), pa.position), pa.created_at
                    )
                    from publication_authors pa
                    where pa.publication_id = p.id
                  ),
                  '[]'::json
                ) as authors
         from publications p
         left join publication_metadata m on m.doi = p.doi
         where p.owner_id = $1
         order by p.updated_at desc, p.created_at desc
         limit 100`;

    const [publicationsResult, conferencesResult] = await Promise.all([
      db.query(publicationsQuery, [req.user.id]),
      db.query(
        `select id, title, acronym, field, location, submission_deadline, conference_date, website
         from conferences
         where created_by = $1
         order by conference_date nulls last, created_at desc
         limit 100`,
        [req.user.id]
      ),
    ]);

    res.json({
      profile: getCurrentUserProfile(user),
      requestTypes: Object.entries(REQUEST_TYPES).map(([id, label]) => ({ id, label })),
      statuses: Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label })),
      publications: publicationsResult.rows.map(mapPublicationRow),
      conferences: conferencesResult.rows.map(mapConferenceRow),
    });
  } catch (error) {
    console.error("GET /api/reimbursements/context failed:", error);
    res.status(500).json({ error: "context_failed" });
  }
});

router.get("/stats/summary", requireAuthenticatedUser, async (req, res) => {
  try {
    const actor = (await loadCurrentUser(req.user.id)) || req.user;
    const scope = getListScopeWhere(actor, req.query.scope);
    const result = await db.query(
      `select
         count(*)::int as total,
         count(*) filter (where r.status in ('submitted', 'received', 'in_review', 'needs_correction', 'committee_approved'))::int as pending,
         count(*) filter (where r.status in ('committee_approved', 'approved', 'paid'))::int as approved,
         count(*) filter (where r.status = 'rejected')::int as rejected,
         count(*) filter (where r.status = 'paid')::int as paid,
         coalesce(sum(r.amount), 0)::numeric(12, 2) as total_amount
       from reimbursements r
       ${scope.where}`,
      scope.params
    );

    res.json({ data: result.rows[0] || {} });
  } catch (error) {
    console.error("GET /api/reimbursements/stats/summary failed:", error);
    res.status(500).json({ error: "stats_failed" });
  }
});

router.get("/", requireAuthenticatedUser, async (req, res) => {
  try {
    const actor = (await loadCurrentUser(req.user.id)) || req.user;
    const scope = getListScopeWhere(actor, req.query.scope);
    const { rows } = await db.query(
      `${buildHistorySelect(scope.where)}
       order by coalesce(r.submitted_at, r.created_at) desc`,
      scope.params
    );
    const hydratedRows = await hydrateReimbursementRowsForPublication(db, rows);

    res.json(hydratedRows.map(mapReimbursementRow));
  } catch (error) {
    console.error("GET /api/reimbursements failed:", error);
    res.status(500).json({ error: "list_failed" });
  }
});

router.post("/preview/:format", requireAuthenticatedUser, async (req, res) => {
  const requestType = normalizeText(req.body?.requestType);
  const format = normalizeText(req.params.format).toLowerCase();

  if (!REQUEST_TYPES[requestType] || !["pdf", "docx"].includes(format)) {
    res.status(400).json({ error: "invalid_preview", message: "Preview nuk eshte valid." });
    return;
  }

  try {
    const user = await loadCurrentUser(req.user.id);

    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    let formData = applyApplicantSnapshot(requestType, sanitizeRequestData(req.body?.formData), user);
    formData = await applyBankAccountSnapshot(db, requestType, formData, req.user.id);
    const linkedPublicationSnapshot = await applyLinkedPublicationSnapshot(db, req.user.id, requestType, formData, { requireExisting: requestType === "publication" });

    if (linkedPublicationSnapshot.error) {
      res.status(linkedPublicationSnapshot.error.status).json({
        error: linkedPublicationSnapshot.error.error,
        message: linkedPublicationSnapshot.error.message,
      });
      return;
    }

    formData = linkedPublicationSnapshot.formData;
    const profileValidationError = getApplicantSnapshotValidationError(requestType, formData);
    const bankValidationError = getBankAccountSnapshotValidationError(requestType, formData);
    const snapshotValidationErrors = [profileValidationError, bankValidationError].filter(Boolean);
    const validationErrors = snapshotValidationErrors.length
      ? snapshotValidationErrors
      : validateReimbursementPayload(requestType, formData, { asDraft: false });

    if (validationErrors.length) {
      res.status(400).json({
        error: "validation_failed",
        message: validationErrors[0].message,
        errors: validationErrors,
      });
      return;
    }

    const payload = buildRequestPayload(user, requestType, formData, { publication: linkedPublicationSnapshot.publication });
    const previewRow = buildPreviewRow(user, requestType, payload);
    const filenames = getReimbursementDocumentFilenames(previewRow);
    const buffer = format === "docx"
      ? await buildReimbursementDocx(previewRow)
      : await buildReimbursementPdf(previewRow);

    res.setHeader(
      "Content-Type",
      format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${format === "docx" ? filenames.docx : filenames.pdf}"`);
    res.send(buffer);
  } catch (error) {
    console.error("POST /api/reimbursements/preview/:format failed:", error);
    res.status(500).json({ error: "preview_failed" });
  }
});

router.post("/", requireAuthenticatedUser, async (req, res) => {
  const requestType = normalizeText(req.body?.requestType);

  if (!REQUEST_TYPES[requestType]) {
    res.status(400).json({ error: "invalid_request_type", message: "Lloji i kerkeses nuk eshte valid." });
    return;
  }

  const action = normalizeText(req.body?.action || req.body?.status || "submit");
  const asDraft = action === "draft";
  const requiresAttachmentBeforeSubmit = !asDraft;

  const user = await loadCurrentUser(req.user.id);

  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  let formData = applyApplicantSnapshot(requestType, sanitizeRequestData(req.body?.formData), user);
  formData = await applyBankAccountSnapshot(db, requestType, formData, req.user.id);
  const linkedPublicationSnapshot = await applyLinkedPublicationSnapshot(db, req.user.id, requestType, formData, { requireExisting: requestType === "publication" && !asDraft });

  if (linkedPublicationSnapshot.error) {
    res.status(linkedPublicationSnapshot.error.status).json({
      error: linkedPublicationSnapshot.error.error,
      message: linkedPublicationSnapshot.error.message,
    });
    return;
  }

  formData = linkedPublicationSnapshot.formData;
  const profileValidationError = asDraft ? null : getApplicantSnapshotValidationError(requestType, formData);
  const bankValidationError = getBankAccountSnapshotValidationError(requestType, formData);
  const snapshotValidationErrors = [profileValidationError, bankValidationError].filter(Boolean);
  const validationErrors = snapshotValidationErrors.length
    ? snapshotValidationErrors
    : validateReimbursementPayload(requestType, formData, { asDraft });

  if (validationErrors.length) {
    res.status(400).json({
      error: "validation_failed",
      message: validationErrors[0].message,
      errors: validationErrors,
    });
    return;
  }

  const status = "draft";
  const client = await db.connect();

  try {
    await client.query("begin");

    const payload = buildRequestPayload(user, requestType, formData, { publication: linkedPublicationSnapshot.publication });

    const insertResult = await client.query(
      `insert into reimbursements
       (owner_id, publication_id, conference_id, title, amount, currency, status, request_type, request_data, submitted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, case when $7 = 'submitted' then now() else null end)
       returning id, owner_id, title, amount, currency, status, request_type, request_data,
                 publication_id, conference_id,
                 document_number, document_filename, document_docx_filename, submitted_at, created_at, updated_at`,
      [
        req.user.id,
        payload.publicationId,
        payload.conferenceId,
        payload.title,
        payload.amount,
        payload.currency,
        status,
        requestType,
        JSON.stringify(payload.requestData),
      ]
    );

    const withDocuments = await createGeneratedDocuments(client, insertResult.rows[0]);
    await insertStatusHistory(
      client,
      withDocuments.id,
      null,
      status,
      req.user,
      "Kerkesa u ruajt si draft."
    );

    const rowWithHistory = await selectReimbursementWithHistoryById(withDocuments.id, client);

    await client.query("commit");

    res.status(201).json({
      data: mapReimbursementRow(rowWithHistory),
      message: requiresAttachmentBeforeSubmit ? ATTACHMENTS_REQUIRED_MESSAGE : undefined,
    });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("POST /api/reimbursements failed:", error);
    res.status(500).json({ error: "create_failed" });
  } finally {
    client.release();
  }
});

router.put("/:id", requireAuthenticatedUser, async (req, res) => {
  const requestType = normalizeText(req.body?.requestType);

  if (!REQUEST_TYPES[requestType]) {
    res.status(400).json({ error: "invalid_request_type", message: "Lloji i kerkeses nuk eshte valid." });
    return;
  }

  const action = normalizeText(req.body?.action || "draft");
  const isSubmit = action === "submit";

  const user = await loadCurrentUser(req.user.id);

  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const currentResult = await client.query(
      `select id, owner_id, status, request_data
       from reimbursements
       where id = $1
       for update`,
      [req.params.id]
    );

    const current = currentResult.rows[0];

    if (!current || current.owner_id !== req.user.id) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (!["draft", "needs_correction"].includes(current.status)) {
      await client.query("rollback");
      res.status(409).json({
        error: "not_editable",
        message: "Kerkesa mund te editohet vetem kur eshte draft ose e kthyer per korrigjim.",
      });
      return;
    }

    let formData = applyApplicantSnapshot(requestType, sanitizeRequestData(req.body?.formData), user, current.request_data || {});
    formData = await applyBankAccountSnapshot(client, requestType, formData, req.user.id, current.request_data || {});
    const linkedPublicationSnapshot = await applyLinkedPublicationSnapshot(client, req.user.id, requestType, formData, { requireExisting: requestType === "publication" && isSubmit });

    if (linkedPublicationSnapshot.error) {
      await client.query("rollback");
      res.status(linkedPublicationSnapshot.error.status).json({
        error: linkedPublicationSnapshot.error.error,
        message: linkedPublicationSnapshot.error.message,
      });
      return;
    }

    formData = linkedPublicationSnapshot.formData;
    const profileValidationError = isSubmit ? getApplicantSnapshotValidationError(requestType, formData) : null;
    const bankValidationError = getBankAccountSnapshotValidationError(requestType, formData);
    const snapshotValidationErrors = [profileValidationError, bankValidationError].filter(Boolean);
    const validationErrors = snapshotValidationErrors.length
      ? snapshotValidationErrors
      : validateReimbursementPayload(requestType, formData, { asDraft: !isSubmit });

    if (validationErrors.length) {
      await client.query("rollback");
      res.status(400).json({
        error: "validation_failed",
        message: validationErrors[0].message,
        errors: validationErrors,
      });
      return;
    }

    const attachmentCount = isSubmit ? await countReimbursementAttachments(client, current.id) : 0;
    const blockedSubmit = isSubmit && attachmentCount === 0;
    const nextStatus = isSubmit && !blockedSubmit
      ? "submitted"
      : current.status === "needs_correction" ? "needs_correction" : "draft";
    const payload = buildRequestPayload(user, requestType, formData, { publication: linkedPublicationSnapshot.publication });
    const updateResult = await client.query(
      `update reimbursements
       set publication_id = $2,
           conference_id = $3,
           title = $4,
           amount = $5,
           currency = $6,
           request_type = $7,
           request_data = $8::jsonb,
           status = $9,
           submitted_at = case when $9 = 'submitted' then coalesce(submitted_at, now()) else submitted_at end,
           updated_at = now()
       where id = $1
       returning id, owner_id, title, amount, currency, status, request_type, request_data,
                 publication_id, conference_id,
                 document_number, document_filename, document_docx_filename, submitted_at, created_at, updated_at`,
      [
        current.id,
        payload.publicationId,
        payload.conferenceId,
        payload.title,
        payload.amount,
        payload.currency,
        requestType,
        JSON.stringify(payload.requestData),
        nextStatus,
      ]
    );

    const withDocuments = await createGeneratedDocuments(client, updateResult.rows[0]);

    if (isSubmit && !blockedSubmit && current.status !== "submitted") {
      await insertStatusHistory(
        client,
        current.id,
        current.status,
        "submitted",
        req.user,
        "Kerkesa u dergua per shqyrtim."
      );
    }

    const rowWithHistory = await selectReimbursementWithHistoryById(withDocuments.id, client);

    await client.query("commit");

    res.json({
      data: mapReimbursementRow(rowWithHistory),
      message: blockedSubmit ? ATTACHMENTS_REQUIRED_MESSAGE : undefined,
    });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("PUT /api/reimbursements/:id failed:", error);
    res.status(500).json({ error: "update_failed" });
  } finally {
    client.release();
  }
});

router.post("/:id/submit", requireAuthenticatedUser, async (req, res) => {
  const client = await db.connect();

  try {
    await client.query("begin");

    const currentResult = await client.query(
      `select id, owner_id, status, request_type, request_data, title, amount, currency,
              publication_id, conference_id,
              document_number, document_filename, document_docx_filename, submitted_at, created_at, updated_at
       from reimbursements
       where id = $1
       for update`,
      [req.params.id]
    );
    const current = currentResult.rows[0];

    if (!current || current.owner_id !== req.user.id) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (!["draft", "needs_correction"].includes(current.status)) {
      await client.query("rollback");
      res.status(409).json({
        error: "not_submittable",
        message: "Kerkesa mund te dorezohet vetem kur eshte draft ose e kthyer per korrigjim.",
      });
      return;
    }

    const user = await loadCurrentUser(req.user.id);

    if (!user) {
      await client.query("rollback");
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    let requestData = applyApplicantSnapshot(current.request_type, current.request_data || {}, user, current.request_data || {});
    requestData = await applyBankAccountSnapshot(client, current.request_type, requestData, req.user.id, current.request_data || {});
    const linkedPublicationSnapshot = await applyLinkedPublicationSnapshot(client, req.user.id, current.request_type, requestData, { requireExisting: current.request_type === "publication" });

    if (linkedPublicationSnapshot.error) {
      await client.query("rollback");
      res.status(linkedPublicationSnapshot.error.status).json({
        error: linkedPublicationSnapshot.error.error,
        message: linkedPublicationSnapshot.error.message,
      });
      return;
    }

    requestData = current.request_type === "conference"
      ? linkedPublicationSnapshot.formData
      : requestData;
    const profileValidationError = getApplicantSnapshotValidationError(current.request_type, requestData);
    const bankValidationError = getBankAccountSnapshotValidationError(current.request_type, requestData);
    const snapshotValidationErrors = [profileValidationError, bankValidationError].filter(Boolean);
    const validationErrors = snapshotValidationErrors.length
      ? snapshotValidationErrors
      : validateReimbursementPayload(current.request_type, requestData, { asDraft: false });

    if (validationErrors.length) {
      await client.query("rollback");
      res.status(400).json({
        error: "validation_failed",
        message: validationErrors[0].message,
        errors: validationErrors,
      });
      return;
    }

    const attachmentCount = await countReimbursementAttachments(client, current.id);

    if (attachmentCount === 0) {
      await client.query("rollback");
      res.status(400).json({
        error: "attachments_required",
        message: ATTACHMENTS_REQUIRED_MESSAGE,
      });
      return;
    }

    const updateResult = await client.query(
      `update reimbursements
       set status = 'submitted',
           request_data = $2::jsonb,
           submitted_at = coalesce(submitted_at, now()),
           updated_at = now()
       where id = $1
       returning id, owner_id, title, amount, currency, status, request_type, request_data,
                 publication_id, conference_id,
                 document_number, document_filename, document_docx_filename, submitted_at, created_at, updated_at`,
      [current.id, JSON.stringify(requestData)]
    );

    const withDocuments = await createGeneratedDocuments(client, updateResult.rows[0]);
    await insertStatusHistory(client, current.id, current.status, "submitted", req.user, "Kerkesa u dergua per shqyrtim.");

    const rowWithHistory = await selectReimbursementWithHistoryById(withDocuments.id, client);

    await client.query("commit");

    res.json({ data: mapReimbursementRow(rowWithHistory) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("POST /api/reimbursements/:id/submit failed:", error);
    res.status(500).json({ error: "submit_failed" });
  } finally {
    client.release();
  }
});

router.get("/:id/history", requireAuthenticatedUser, async (req, res) => {
  try {
    const row = await selectReimbursementWithHistoryById(req.params.id);

    if (!(await canAccessReimbursement(row, req.user))) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: normalizeStatusHistory(row.status_history || []) });
  } catch (error) {
    console.error("GET /api/reimbursements/:id/history failed:", error);
    res.status(500).json({ error: "history_failed" });
  }
});

router.patch("/:id/metadata-review", requireAuthenticatedUser, async (req, res) => {
  const actor = await loadCurrentUser(req.user.id);

  if (!actor || !canManageReimbursements(actor)) {
    res.status(403).json({ error: "forbidden", message: "Vetem komisioni, prorektori ose admini mund te kontrolloje metadata." });
    return;
  }

  const status = normalizeText(req.body?.status || req.body?.metadataReviewStatus || req.body?.metadata_review_status);
  const comment = normalizeText(req.body?.comment || req.body?.metadataReviewComment || req.body?.metadata_review_comment);
  const checklist = normalizeMetadataReviewChecklist(req.body?.checklist || req.body?.metadataReviewChecklist || req.body?.metadata_review_checklist);

  if (!VALID_METADATA_REVIEW_STATUSES.has(status)) {
    res.status(400).json({ error: "invalid_metadata_review_status", message: "Statusi i metadata-s nuk eshte valid." });
    return;
  }

  if (status === "correction" && !comment) {
    res.status(400).json({ error: "comment_required", message: "Komenti eshte i detyrueshem per korrigjim." });
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const currentResult = await client.query(
      `select id, owner_id, title, status, request_type, request_data
       from reimbursements
       where id = $1
       for update`,
      [req.params.id]
    );

    if (currentResult.rows.length === 0) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found", message: "Rimbursimi nuk u gjet." });
      return;
    }

    const current = currentResult.rows[0];
    const requestData = current.request_data || {};
    const previousStatus = requestData.metadataReviewStatus || requestData.metadata_review_status || "unchecked";
    const previousHistory = Array.isArray(requestData.metadataReviewHistory || requestData.metadata_review_history)
      ? (requestData.metadataReviewHistory || requestData.metadata_review_history)
      : [];
    const historyEntry = {
      id: `${Date.now()}-${status}`,
      previousStatus,
      previous_status: previousStatus,
      status,
      statusLabel: METADATA_REVIEW_STATUS_LABELS[status] || status,
      status_label: METADATA_REVIEW_STATUS_LABELS[status] || status,
      actorId: req.user.id,
      actor_id: req.user.id,
      actorRole: normalizeRole(actor.role),
      actor_role: normalizeRole(actor.role),
      actorName: getActorName(actor),
      actor_name: getActorName(actor),
      comment,
      checklist,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    const nextHistory = [historyEntry, ...previousHistory].slice(0, 50);
    const nextRequestData = {
      ...requestData,
      metadataReviewStatus: status,
      metadata_review_status: status,
      metadataReviewChecklist: checklist,
      metadata_review_checklist: checklist,
      metadataReviewComment: comment,
      metadata_review_comment: comment,
      metadataReviewHistory: nextHistory,
      metadata_review_history: nextHistory,
    };
    const nextReimbursementStatus = status === "correction" ? "needs_correction" : current.status;

    await client.query(
      `update reimbursements
       set request_data = $2::jsonb,
           status = $3,
           updated_at = now()
       where id = $1`,
      [current.id, JSON.stringify(nextRequestData), nextReimbursementStatus]
    );

    if (status === "correction") {
      await insertStatusHistory(client, current.id, current.status, "needs_correction", actor, comment);
      await notifyOwner(client, current.id, current.owner_id, "needs_correction", comment);
    }

    const rowWithHistory = await selectReimbursementWithHistoryById(current.id, client);

    await client.query("commit");
    res.json({ data: mapReimbursementRow(rowWithHistory) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("PATCH /api/reimbursements/:id/metadata-review failed:", error);
    res.status(500).json({ error: "metadata_review_failed", message: "Kontrolli i metadata-s nuk u ruajt." });
  } finally {
    client.release();
  }
});

router.patch("/:id/status", requireAuthenticatedUser, async (req, res) => {
  const actor = await loadCurrentUser(req.user.id);

  if (!actor || !canManageReimbursements(actor)) {
    res.status(403).json({ error: "forbidden", message: "Vetem komisioni, prorektori ose admini mund te ndryshoje statusin." });
    return;
  }

  const nextStatus = normalizeText(req.body?.status);
  const note = normalizeText(req.body?.note);

  if (!VALID_REIMBURSEMENT_STATUSES.has(nextStatus) || nextStatus === "draft") {
    res.status(400).json({ error: "invalid_status", message: "Statusi i zgjedhur nuk eshte valid." });
    return;
  }

  if (["rejected", "needs_correction"].includes(nextStatus) && !note) {
    res.status(400).json({
      error: "note_required",
      message: "Komenti institucional eshte obligativ per refuzim ose kthim per korrigjim.",
    });
    return;
  }

  const client = await db.connect();
  let responsePayload = null;

  try {
    await client.query("begin");

    const currentResult = await client.query(
      `select id, owner_id, status
       from reimbursements
       where id = $1
       for update`,
      [req.params.id]
    );

    if (currentResult.rows.length === 0) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found" });
      return;
    }

    const current = currentResult.rows[0];
    const actorRole = normalizeRole(actor.role);

    if (nextStatus === "approved" && ["submitted", "in_review"].includes(current.status) && actorRole !== "committee") {
      await client.query("rollback");
      res.status(403).json({
        error: "committee_approval_forbidden",
        message: "Vetëm komisioni mund ta aprovojë këtë kërkesë.",
      });
      return;
    }

    const allowedStatuses = getAllowedStatuses(actor, current.status);

    if (!allowedStatuses.includes(nextStatus)) {
      await client.query("rollback");
      res.status(403).json({
        error: "transition_forbidden",
        message: "Ky veprim nuk lejohet per rolin/statusin aktual.",
      });
      return;
    }

    await client.query(
      `update reimbursements
       set status = $2,
           updated_at = now()
       where id = $1`,
      [current.id, nextStatus]
    );

    const isCommitteeApproval =
      nextStatus === "approved"
      && ["submitted", "in_review"].includes(current.status)
      && actorRole === "committee";
    const historyNote = isCommitteeApproval
      ? COMMITTEE_APPROVAL_EVENT_NOTE
      : note || `Statusi u ndryshua ne ${STATUS_LABELS[nextStatus] || nextStatus}.`;

    await insertStatusHistory(client, current.id, current.status, nextStatus, actor, historyNote);
    await notifyOwner(client, current.id, current.owner_id, nextStatus, historyNote);

    const rowWithHistory = await selectReimbursementWithHistoryById(current.id, client);
    responsePayload = mapReimbursementRow(rowWithHistory);

    await client.query("commit");

    let email = { sent: false, skipped: true };

    if (isCommitteeApproval) {
      try {
        const emailResult = await sendCommitteeApprovalEmail({
          to: responsePayload.owner?.email,
          title: responsePayload.title,
          statusLabel: responsePayload.statusLabel,
          updatedAt: responsePayload.updatedAt || new Date(),
          comment: note,
        });

        email = {
          sent: !emailResult?.skipped,
          skipped: Boolean(emailResult?.skipped),
        };

        if (emailResult?.skipped) {
          email.error = "email_not_sent";
        }
      } catch (emailError) {
        email = {
          sent: false,
          skipped: false,
          error: "email_send_failed",
        };
        console.warn("committee_approval_email_failed", {
          reimbursementId: current.id,
          ownerId: current.owner_id,
          message: emailError.message,
        });
      }
    }

    res.json({ data: responsePayload, email });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("PATCH /api/reimbursements/:id/status failed:", error);
    res.status(500).json({ error: "status_update_failed" });
  } finally {
    client.release();
  }
});

router.post("/:id/attachments", requireAuthenticatedUser, async (req, res) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : [];

  if (!files.length) {
    res.status(400).json({ error: "no_files", message: "Zgjidh se paku nje fajll per upload." });
    return;
  }

  if (files.length > 5) {
    res.status(400).json({ error: "too_many_files", message: "Maksimum 5 fajlla per nje upload." });
    return;
  }

  const parsedFiles = [];

  for (const file of files) {
    const parsed = parseAttachmentFile(file);

    if (parsed.error) {
      res.status(400).json({ error: "invalid_file", message: parsed.error });
      return;
    }

    parsedFiles.push(parsed);
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const currentResult = await client.query(
      `select id, owner_id, status
       from reimbursements
       where id = $1
       for update`,
      [req.params.id]
    );
    const current = currentResult.rows[0];

    if (!(await canAccessReimbursement(current, req.user))) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (current.owner_id !== req.user.id && !canManageReimbursements(req.user)) {
      await client.query("rollback");
      res.status(403).json({ error: "forbidden" });
      return;
    }

    for (const file of parsedFiles) {
      await client.query(
        `insert into reimbursement_attachments
         (reimbursement_id, uploaded_by, filename, mime_type, size_bytes, content, document_type)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [current.id, req.user.id, file.filename, file.mimeType, file.sizeBytes, file.content, file.documentType]
      );
    }

    const rowWithHistory = await selectReimbursementWithHistoryById(current.id, client);

    await client.query("commit");

    res.status(201).json({ data: mapReimbursementRow(rowWithHistory) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("POST /api/reimbursements/:id/attachments failed:", error);
    res.status(500).json({ error: "attachment_upload_failed" });
  } finally {
    client.release();
  }
});

router.get("/:id/attachments/:attachmentId", requireAuthenticatedUser, async (req, res) => {
  try {
    const row = await selectReimbursementWithHistoryById(req.params.id);

    if (!(await canAccessReimbursement(row, req.user))) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const result = await db.query(
      `select id, filename, mime_type, content
       from reimbursement_attachments
       where reimbursement_id = $1 and id = $2
       limit 1`,
      [req.params.id, req.params.attachmentId]
    );
    const attachment = result.rows[0];

    if (!attachment) {
      res.status(404).json({ error: "attachment_not_found" });
      return;
    }

    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader("Content-Disposition", `attachment; filename="${attachment.filename}"`);
    res.send(Buffer.isBuffer(attachment.content) ? attachment.content : Buffer.from(attachment.content));
  } catch (error) {
    console.error("GET /api/reimbursements/:id/attachments/:attachmentId failed:", error);
    res.status(500).json({ error: "attachment_download_failed" });
  }
});

router.get("/:id/pdf", requireAuthenticatedUser, async (req, res) => {
  try {
    const { rows } = await db.query(
      `select id, owner_id, title, amount, currency, status, request_type, request_data,
              publication_id, conference_id,
              document_number, document_filename, document_docx_filename, generated_pdf,
              submitted_at, created_at
       from reimbursements
       where id = $1
       limit 1`,
      [req.params.id]
    );

    const row = await hydrateReimbursementRowForPublication(db, rows[0] || null);

    if (!(await canAccessReimbursement(row, req.user))) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const { buffer, filename } = await ensureGeneratedDocument(row, "pdf");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename || "rimbursim.pdf"}"`);
    res.send(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  } catch (error) {
    console.error("GET /api/reimbursements/:id/pdf failed:", error);
    res.status(500).json({ error: "pdf_failed" });
  }
});

router.get("/:id/docx", requireAuthenticatedUser, async (req, res) => {
  try {
    const { rows } = await db.query(
      `select id, owner_id, title, amount, currency, status, request_type, request_data,
              publication_id, conference_id,
              document_number, document_filename, document_docx_filename, generated_docx,
              submitted_at, created_at
       from reimbursements
       where id = $1
       limit 1`,
      [req.params.id]
    );

    const row = await hydrateReimbursementRowForPublication(db, rows[0] || null);

    if (!(await canAccessReimbursement(row, req.user))) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const { buffer, filename } = await ensureGeneratedDocument(row, "docx");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename || "rimbursim.docx"}"`);
    res.send(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  } catch (error) {
    console.error("GET /api/reimbursements/:id/docx failed:", error);
    res.status(500).json({ error: "docx_failed" });
  }
});

export default router;
