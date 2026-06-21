import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  Link2,
  MoreVertical,
  Pencil,
  RefreshCw,
  Send,
  Settings,
  ShieldX,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import ConferenceManager from "../components/ConferenceManager";
import ReimbursementManager from "../components/ReimbursementManager";
import PublicationForm, {
  createEmptyPublicationDraft,
  publicationToDraft,
} from "../components/PublicationForm";
import { apiUrl } from "../../utils/api";
import { sendPasswordResetEmail } from "../../utils/supabaseAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  detectKosovoBankFromAccount,
  KOSOVO_BANKS,
  maskBankAccount,
} from "../../../../shared/banking.js";
import {
  PUBLICATION_REVIEW_ROLE_VALUES,
  WEB_OF_SCIENCE_INDEX_VALUES,
} from "../../../../shared/publicationConstants.js";

import {
  professorProfile,
  profileMenuItems,
} from "../data/dashboardData";
import { FACULTY_DEPARTMENTS, FACULTY_OPTIONS } from "../data/academicUnits";
import "../styles/ProfessorDashboard.css";

const PUBLICATION_ERROR_MESSAGES = {
  duplicate_publication: "professor.dashboard.duplicatePublication",
  "Ky publikim ekziston tashme ne listen tuaj.": "professor.dashboard.duplicatePublication",
  "Ky publikim ekziston tashmë në listën tuaj.": "professor.dashboard.duplicatePublication",
};

const pickFirstText = (...values) =>
  values.find((value) => typeof value === "string" && value.trim())?.trim() || "";

const pickOrcidTitle = (items = []) => {
  const firstItem = Array.isArray(items) ? items.find(Boolean) : null;

  if (!firstItem) {
    return "";
  }

  return pickFirstText(firstItem.roleTitle, firstItem.title, firstItem.position, firstItem.department);
};

const PROFILE_PHOTO_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACADEMIC_TITLE_OPTIONS = [
  "Asistent",
  "Profesor Asistent",
  "Profesor i Asociuar",
  "Profesor i Rregullt",
];
const SCIENTIFIC_TITLE_OPTIONS = ["MSc", "PhD"];
const PROFILE_PHOTO_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_MAX_DATA_URL_LENGTH = 180000;
const PROFILE_PHOTO_RENDER_ATTEMPTS = [
  { size: 280, quality: 0.82 },
  { size: 220, quality: 0.74 },
  { size: 180, quality: 0.68 },
];

function getProfileInitials(profile = {}) {
  return String(profile.name || profile.email || "P")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("invalid_image"));
    };

    image.src = objectUrl;
  });
}

async function createProfilePhotoDataUrl(file) {
  if (!file) {
    return "";
  }

  if (!PROFILE_PHOTO_ALLOWED_TYPES.has(file.type)) {
    throw new Error("invalid_type");
  }

  if (file.size > PROFILE_PHOTO_MAX_SOURCE_BYTES) {
    throw new Error("too_large");
  }

  const image = await loadImageFromFile(file);
  const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceX = Math.max(0, ((image.naturalWidth || image.width) - sourceSize) / 2);
  const sourceY = Math.max(0, ((image.naturalHeight || image.height) - sourceSize) / 2);

  for (const attempt of PROFILE_PHOTO_RENDER_ATTEMPTS) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = attempt.size;
    canvas.height = attempt.size;

    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, attempt.size, attempt.size);

    const dataUrl = canvas.toDataURL("image/jpeg", attempt.quality);

    if (dataUrl.length <= PROFILE_PHOTO_MAX_DATA_URL_LENGTH) {
      return dataUrl;
    }
  }

  throw new Error("too_large");
}

const normalizeProfile = (user = {}) => {
  const orcidEducations = Array.isArray(user.orcidEducations) ? user.orcidEducations : [];
  const orcidEmployments = Array.isArray(user.orcidEmployments) ? user.orcidEmployments : [];
  const education = Array.isArray(user.education) ? user.education : orcidEducations;
  const profileOverrides = user.profileOverrides || user.profile_overrides || {};
  const profilePhotoUrl = user.profilePhotoUrl || user.profile_photo_url || user.avatarUrl || user.avatar_url || profileOverrides.profilePhotoUrl || profileOverrides.profile_photo_url || "";

  return {
    name: user.name || user.displayName || user.full_name || professorProfile.name || "Professor",
    role: user.role || professorProfile.role || "Professor",
    appRole: user.role || "professor",
    email: user.email || professorProfile.email,
    academicTitle: user.academicTitle || user.academic_title || professorProfile.academicTitle || pickOrcidTitle(orcidEmployments),
    scientificTitle: user.scientificTitle || user.scientific_title || professorProfile.scientificTitle || pickOrcidTitle(education),
    faculty: user.faculty || professorProfile.faculty,
    department: user.department || professorProfile.department,
    office: user.office || professorProfile.office,
    orcidId: user.orcidId || user.orcid_id || null,
    school: user.school || "",
    currentAffiliation: user.currentAffiliation || "",
    profilePhotoUrl,
    orcidProfile: user.orcidProfile || {},
    profileOverrides,
    education,
    orcidEducations,
    orcidEmployments,
    orcidLastSyncedAt: user.orcidLastSyncedAt || null,
  };
};

const formatAffiliation = (item = {}) => {
  const location = [item.city, item.region, item.country].filter(Boolean).join(", ");
  const dates = [item.startDate, item.endDate].filter(Boolean).join(" - ");

  return [item.organization, item.roleTitle, item.department, location, dates]
    .filter(Boolean)
    .join(" | ");
};

const DEFAULT_PROFESSOR_STATISTICS = {
  period: { range: "6m", months: 6, startMonth: null },
  summary: {
    publicationsTotal: 0,
    publicationsApproved: 0,
    publicationsInReview: 0,
    publicationsDraft: 0,
    citationsTotal: 0,
    citationSources: 0,
    citationsAvailable: false,
    conferencesTotal: 0,
    upcomingConferences: 0,
    reimbursementsTotal: 0,
    reimbursementsInReview: 0,
    reimbursementsApproved: 0,
    unreadNotifications: 0,
    requestedAmounts: [],
  },
  monthly: [],
  publicationsByStatus: [],
  reimbursementsByStatus: [],
  reimbursementsByType: [],
  generatedAt: null,
};

const MONTH_LABELS = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nen", "Dhj"];

const STATUS_LABELS = {
  draft: "Në draft",
  submitted: "Dorëzuar",
  received: "Pranuar",
  in_review: "Në shqyrtim",
  needs_correction: "Kërkon korrigjim",
  committee_approved: "Aprovuar nga komisioni",
  approved: "Aprovuar final",
  rejected: "Refuzuar",
  paid: "Paguar",
  unknown: "Pa status",
};

const PUBLICATION_TYPE_LABEL_KEYS = {
  journal_article: "professor.dashboard.publicationForm.journalArticle",
  conference_paper: "professor.dashboard.publicationForm.conferencePaper",
  book: "professor.dashboard.publicationForm.book",
};

const PUBLICATION_REVIEW_ROLES = new Set(PUBLICATION_REVIEW_ROLE_VALUES);
const PUBLICATION_LIST_PAGES = new Set([
  "Artikuj reviste",
  "Punime të konferencave",
  "Libra / Kapituj",
  "Te gjithe Artikujt",
  "Të gjitha publikimet",
  "Lista e Publikimeve",
]);

const getPublicationTypeFilterForPage = (page) => {
  if (page === "Artikuj reviste") {
    return "journal_article";
  }

  if (page === "Punime të konferencave") {
    return "conference_paper";
  }

  if (page === "Libra / Kapituj") {
    return "book";
  }

  return "";
};

const getPublicationPageTitle = (page) => (page === "Lista e Publikimeve" || page === "Të gjitha publikimet" ? "Te gjithe Artikujt" : page);

const supportsPublicationIndexing = (publicationType) => publicationType === "journal_article";

const isBookPublicationType = (publicationType) => publicationType === "book";

const normalizePublicationSubtype = (value) => {
  const normalized = String(value || "").toLowerCase().replace(/[-\s]+/g, "_");

  return normalized === "book_chapter" || normalized === "chapter" ? "book_chapter" : "";
};

const isBookChapterPublication = (publicationType, publicationSubtype) =>
  isBookPublicationType(publicationType) && normalizePublicationSubtype(publicationSubtype) === "book_chapter";

const hidesJournalFields = (publicationType) => publicationType === "book";

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().slice(0, 10);
};

const normalizeLooseBoolean = (value) => value === true || value === "true" || value === 1 || value === "1";

const normalizePublicationDateForPayload = (value) => {
  const text = String(value || "").trim();
  const dayMonthYear = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (dayMonthYear) {
    return `${dayMonthYear[3]}-${dayMonthYear[2]}-${dayMonthYear[1]}`;
  }

  return "";
};

const normalizeQuartileValue = (value) => {
  const match = String(value || "").trim().toUpperCase().match(/\bQ[1-4]\b/);

  return match?.[0] || "";
};

const normalizeIndexingPlatformValue = (value) => {
  const text = String(value || "").trim();
  const comparable = text.toLowerCase();

  if (!text) return "";
  if (comparable.includes("scopus") || comparable.includes("citescore")) return "Scopus";
  if (comparable.includes("web of science") || comparable.includes("clarivate")) return "Web of Science";
  if (["scie", "ssci", "ahci", "esci"].includes(comparable)) return "Web of Science";
  if (comparable === "other") return "Other";

  return text;
};

const splitIndexingPlatforms = (value) => {
  const values = Array.isArray(value) ? value : String(value || "").split(/\s*(?:,|;|\||\n)\s*/);
  const seen = new Set();
  const platforms = [];

  values.forEach((item) => {
    const platform = normalizeIndexingPlatformValue(item);
    const key = platform.toLowerCase();

    if (platform && !seen.has(key)) {
      seen.add(key);
      platforms.push(platform);
    }
  });

  return platforms;
};

const getSelectedIndexingPlatforms = (indexing = [], fallback = "") =>
  splitIndexingPlatforms([
    ...splitIndexingPlatforms(fallback),
    ...(Array.isArray(indexing) ? indexing.flatMap((item) => splitIndexingPlatforms(item?.source || item?.platform)) : []),
  ]);

const formatIndexingPlatforms = (platforms = []) => splitIndexingPlatforms(platforms).join(", ");

const normalizeWebOfScienceIndexValue = (value) => {
  const normalized = String(value || "").trim().toUpperCase();

  return WEB_OF_SCIENCE_INDEX_VALUES.includes(normalized) ? normalized : "";
};

const normalizeIndexingSourceKey = (value) => {
  const text = String(value || "").trim().toLowerCase();

  if (!text) return "manual";
  if (text.includes("scopus") || text.includes("citescore")) return "scopus";
  if (text.includes("scimago") || text.includes("sjr")) return "scimago";
  if (text.includes("doaj")) return "doaj";
  if (text.includes("openalex")) return "openalex";

  return ["scopus", "scimago", "doaj", "openalex", "manual"].includes(text) ? text : "manual";
};

const getIndexingYear = (item = {}) => {
  const year = Number.parseInt(item.year || item.indexing_year || item.coverYear || item.cover_year, 10);

  return Number.isFinite(year) ? year : 0;
};

const isSelectedQuartileIndexing = (item = {}) => {
  const status = String(item.quartileVerificationStatus || item.quartile_verification_status || "").toLowerCase();
  const source = normalizeIndexingSourceKey(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source);

  return Boolean(normalizeQuartileValue(item.quartile))
    && (
      normalizeLooseBoolean(item.quartileVerified ?? item.quartile_verified)
      || status === "verified"
      || status === "manual"
      || (status === "historical" && source !== "manual")
      || (!status && source !== "manual")
    );
};

const isDisplayableQuartileIndexing = isSelectedQuartileIndexing;

const getSelectedIndexingItem = (indexing = [], fallbackQuartile = "") => {
  const items = Array.isArray(indexing) ? indexing : [];
  const selected = items.find(isSelectedQuartileIndexing);

  if (selected) {
    return selected;
  }

  const fallback = normalizeQuartileValue(fallbackQuartile);
  const quartileMatches = fallback
    ? items.filter((item) => normalizeQuartileValue(item.quartile) === fallback)
    : items.filter((item) => normalizeQuartileValue(item.quartile));

  return quartileMatches
    .sort((first, second) => getIndexingYear(second) - getIndexingYear(first))
    .find((item) => item?.quartile || item?.sjr || item?.citeScore || item?.cite_score || item?.citescore || item?.impactFactor || item?.impact_factor)
    || items.find((item) => item?.source || item?.category || item?.quartile || item?.sjr || item?.citeScore || item?.cite_score || item?.citescore || item?.impactFactor || item?.impact_factor)
    || {};
};

const getIndexingCiteScore = (item = {}) => item.citeScore || item.cite_score || item.citescore || "";

const getDisplayableQuartile = (row = {}) =>
  normalizeQuartileValue(row.quartile) || normalizeQuartileValue(getSelectedIndexingItem(row.indexing, row.quartile).quartile);

const mapPublicationRow = (row = {}) => {
  const publicationType = row.publicationType || row.publication_type || "";
  const publicationSubtype = normalizePublicationSubtype(row.publicationSubtype || row.publication_subtype);
  const isBookChapter = isBookChapterPublication(publicationType, publicationSubtype);
  const hasIndexing = supportsPublicationIndexing(publicationType);
  const hideJournalSpecificFields = hidesJournalFields(publicationType);
  const hideVolumeField = isBookPublicationType(publicationType) && !isBookChapter;
  const indexing = hasIndexing && Array.isArray(row.indexing) ? row.indexing : [];
  const selectedIndexing = getSelectedIndexingItem(indexing, row.quartile);
  const selectedVerifiedIndexing = indexing.find((item) => normalizeLooseBoolean(item?.quartileVerified ?? item?.quartile_verified)) || selectedIndexing;
  const impactFactorIndexing = indexing.find((item) => item?.impactFactor || item?.impact_factor) || {};

  return {
    id: row.id || row.doi || row.title,
    doi: row.doi || "",
    title: row.title || "Pa titull",
    abstract: row.abstract || "",
    publicationType,
    publicationSubtype,
    publication_subtype: publicationSubtype,
    journal: row.venue || row.publisher || "Pa reviste/konference",
    venue: row.venue || "",
    publishedIn: row.publishedIn || row.published_in || row.venue || "",
    conferenceLocation: row.conferenceLocation || row.conference_location || "",
    conference_location: row.conferenceLocation || row.conference_location || "",
    conferenceCity: row.conferenceCity || row.conference_city || "",
    conference_city: row.conference_city || row.conferenceCity || "",
    conferenceCountry: row.conferenceCountry || row.conference_country || "",
    conference_country: row.conference_country || row.conferenceCountry || "",
    conferenceFormat: row.conferenceFormat || row.conference_format || "",
    conference_format: row.conference_format || row.conferenceFormat || "",
    presentationType: row.presentationType || row.presentation_type || "",
    presentation_type: row.presentation_type || row.presentationType || "",
    publisher: row.publisher || "",
    editors: Array.isArray(row.editors) ? row.editors : [],
    bookSeriesTitle: row.bookSeriesTitle || row.book_series_title || row.seriesTitle || row.series_title || "",
    edition: row.edition || "",
    proceedingsTitle: row.proceedingsTitle || row.proceedings_title || "",
    eventDate: row.eventDate || row.event_date || "",
    publicationDate: isBookPublicationType(publicationType) && !isBookChapter ? "" : row.publicationDate || row.publication_date || "",
    year: isBookPublicationType(publicationType) && !isBookChapter ? "" : row.publicationYear || row.publication_year || "",
    publicationYear: isBookPublicationType(publicationType) && !isBookChapter ? "" : row.publicationYear || row.publication_year || "",
    status: row.status || "draft",
    sourceUrl: row.sourceUrl || row.source_url || "",
    volume: hideVolumeField ? "" : row.volume || "",
    issue: hideJournalSpecificFields ? "" : row.issue || "",
    pages: publicationType === "conference_paper" ? "" : row.pages || "",
    pageStart: row.pageStart || row.page_start || row.pagesStart || row.pages_start || "",
    pageEnd: row.pageEnd || row.page_end || row.pagesEnd || row.pages_end || "",
    issn: hideJournalSpecificFields ? "" : row.issn || "",
    eIssn: publicationType === "journal_article" ? row.eIssn || row.e_issn || row.eissn || "" : "",
    e_issn: publicationType === "journal_article" ? row.e_issn || row.eIssn || row.eissn || "" : "",
    isbn: publicationType === "journal_article" ? "" : row.isbn || "",
    quartile: hasIndexing ? getDisplayableQuartile({ ...row, indexing }) : "",
    indexingPlatform: hasIndexing ? row.indexingPlatform || row.indexing_platform || selectedIndexing.source || indexing.find((item) => item?.source)?.source || "" : "",
    indexingCategory: hasIndexing ? row.indexingCategory || row.indexing_category || selectedIndexing.category || indexing.find((item) => item?.category)?.category || "" : "",
    indexingVerified: hasIndexing && normalizeLooseBoolean(row.indexingVerified ?? row.indexing_verified),
    indexingSource: hasIndexing ? row.indexingSource || row.indexing_source || selectedIndexing.sourceKey || selectedIndexing.source_key || "manual" : "manual",
    sjr: hasIndexing ? row.sjr || selectedIndexing.sjr || "" : "",
    impactFactor: hasIndexing ? row.impactFactor || row.impact_factor || selectedIndexing.impactFactor || selectedIndexing.impact_factor || impactFactorIndexing.impactFactor || impactFactorIndexing.impact_factor || "" : "",
    impact_factor: hasIndexing ? row.impact_factor || row.impactFactor || selectedIndexing.impact_factor || selectedIndexing.impactFactor || impactFactorIndexing.impact_factor || impactFactorIndexing.impactFactor || "" : "",
    citeScore: hasIndexing ? row.citeScore || row.cite_score || getIndexingCiteScore(selectedIndexing) : "",
    quartileVerified: hasIndexing && normalizeLooseBoolean(row.quartileVerified ?? row.quartile_verified ?? selectedVerifiedIndexing.quartileVerified ?? selectedVerifiedIndexing.quartile_verified),
    quartileSource: hasIndexing ? row.quartileSource || row.quartile_source || selectedIndexing.quartileSource || selectedIndexing.quartile_source || selectedIndexing.sourceKey || selectedIndexing.source_key || "manual" : "manual",
    quartileVerificationStatus: hasIndexing ? row.quartileVerificationStatus || row.quartile_verification_status || selectedIndexing.quartileVerificationStatus || selectedIndexing.quartile_verification_status || "empty" : "empty",
    authors: Array.isArray(row.authors) ? row.authors : [],
    indexing,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    evidenceLinks: Array.isArray(row.evidenceLinks || row.evidence_links)
      ? (row.evidenceLinks || row.evidence_links)
      : Array.isArray(row.attachments) ? row.attachments : [],
    identifiers: Array.isArray(row.identifiers) ? row.identifiers : [],
    metadataSource: row.metadataSource || row.metadata_source || "manual",
    metadataVerified: normalizeLooseBoolean(row.metadataVerified ?? row.metadata_verified),
    externalMetadataId: row.externalMetadataId || row.external_metadata_id || "",
    fieldSources: row.fieldSources || row.field_sources || {},
    metadataReviewStatus: row.metadataReviewStatus || row.metadata_review_status || "unchecked",
    metadataReviewChecklist: row.metadataReviewChecklist || row.metadata_review_checklist || {},
    metadataReviewComment: row.metadataReviewComment || row.metadata_review_comment || "",
    reviewHistory: Array.isArray(row.reviewHistory || row.review_history) ? (row.reviewHistory || row.review_history) : [],
    revisionRequestedAt: row.revisionRequestedAt || row.revision_requested_at || null,
    resubmittedAt: row.resubmittedAt || row.resubmitted_at || null,
    createdAt: row.createdAt || row.created_at || null,
  };
};

const getPublicationAuthorSearchText = (authors = []) =>
  (Array.isArray(authors) ? authors : [])
    .map((author) => {
      if (typeof author === "string") {
        return author;
      }

      return [
        author?.fullName,
        author?.full_name,
        author?.name,
        author?.givenName,
        author?.given_name,
        author?.familyName,
        author?.family_name,
        author?.orcid,
        author?.affiliation,
      ].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" ");

const getPublicationSearchText = (row = {}) => [
  row.title,
  row.doi,
  row.journal,
  row.venue,
  row.publisher,
  row.proceedingsTitle,
  row.proceedings_title,
  row.eventDate,
  row.event_date,
  row.publicationType,
  row.publicationYear,
  row.year,
  row.status,
  row.pages,
  row.volume,
  row.issue,
  row.issn,
  row.eIssn,
  row.e_issn,
  row.isbn,
  row.quartile,
  row.indexingPlatform,
  row.indexingCategory,
  row.indexingSource,
  row.sjr,
  row.citeScore,
  getPublicationAuthorSearchText(row.authors),
].filter(Boolean).join(" ").toLowerCase();

const formatPublicationAuthorSummary = (authors = []) => {
  const names = (Array.isArray(authors) ? authors : [])
    .map((author) => (typeof author === "string" ? author : author?.fullName || author?.full_name || author?.name))
    .filter(Boolean);

  if (!names.length) {
    return "Pa autorë të regjistruar";
  }

  if (names.length <= 2) {
    return names.join(", ");
  }

  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
};

const getPublicationPrimaryAuthorName = (authors = []) => {
  const firstAuthor = (Array.isArray(authors) ? authors : []).find(Boolean);

  if (!firstAuthor) {
    return "";
  }

  return typeof firstAuthor === "string"
    ? firstAuthor
    : firstAuthor.fullName || firstAuthor.full_name || firstAuthor.name || "";
};

const getPublicationQuartileValue = (row = {}) =>
  row.quartile || row.indexing?.find?.((item) => item?.quartile)?.quartile || "";

const getPublicationQuartileRank = (row = {}) => {
  const value = String(getPublicationQuartileValue(row)).trim().toUpperCase();
  const ranks = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

  return ranks[value] || 5;
};

const mapNotificationRow = (row = {}) => ({
  id: row.id,
  userId: row.user_id || row.userId || null,
  title: row.title || "",
  message: row.message || "",
  category: row.category || "",
  metadata: row.metadata || {},
  isRead: Boolean(row.is_read ?? row.isRead),
  createdAt: formatDate(row.created_at || row.createdAt),
});

const normalizeStatisticsPayload = (payload = {}) => ({
  ...DEFAULT_PROFESSOR_STATISTICS,
  ...payload,
  period: {
    ...DEFAULT_PROFESSOR_STATISTICS.period,
    ...(payload.period || {}),
  },
  summary: {
    ...DEFAULT_PROFESSOR_STATISTICS.summary,
    ...(payload.summary || {}),
    requestedAmounts: Array.isArray(payload.summary?.requestedAmounts)
      ? payload.summary.requestedAmounts
      : [],
  },
  monthly: Array.isArray(payload.monthly) ? payload.monthly : [],
  publicationsByStatus: Array.isArray(payload.publicationsByStatus) ? payload.publicationsByStatus : [],
  reimbursementsByStatus: Array.isArray(payload.reimbursementsByStatus) ? payload.reimbursementsByStatus : [],
  reimbursementsByType: Array.isArray(payload.reimbursementsByType) ? payload.reimbursementsByType : [],
});

const formatMonthLabel = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value || "");
  }

  return MONTH_LABELS[date.getUTCMonth()] || String(value || "");
};

const formatAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
};

const formatRequestedAmounts = (amounts = []) => {
  if (!amounts.length) {
    return "0 EUR";
  }

  return amounts
    .filter((item) => Number(item.requested) > 0)
    .map((item) => `${formatAmount(item.requested)} ${item.currency || "EUR"}`)
    .join(" / ") || "0 EUR";
};

const createEmptyBankAccountDraft = () => ({
  id: "",
  label: "",
  bankApplicantName: "",
  bankName: "",
  bankAccountNumber: "",
  iban: "",
  swiftCode: "",
  bankCountry: "Kosovë",
  currency: "EUR",
  isDefault: false,
});

const PROFILE_KOSOVO_BANKS = [
  // Verify these identifiers against official BQK/CBK bank code sources before expanding or changing them.
  { code: "17", name: "Banka Kombëtare Tregtare Kosovë", swift: "NCBAXKPR" },
  { code: "11", name: "ProCredit Bank Kosovo", swift: "MBKOXKPR" },
  { code: "12", name: "Raiffeisen Bank Kosovo", swift: "RBKOXKPR" },
  { code: "15", name: "TEB Bank Kosovo", swift: "TEBKXKPR" },
  { code: "13", name: "NLB Banka", swift: "NLPRXKPR" },
  { code: "16", name: "Banka për Biznes", swift: "BPBXXKPR" },
  { code: "18", name: "Ziraat Bank Kosovo", swift: "TCZBXKPR" },
  { code: "19", name: "İşbank Kosovo", swift: "ISBKXKPR" },
  { code: "21", name: "PriBank", swift: "PHHAXKPR" },
  { code: "14", name: "Banka Ekonomike", swift: "EKOMXKPR" },
];

const normalizeBankIdentifier = (value = "") =>
  String(value || "").replace(/\s+/g, "").toUpperCase();

const getKosovoIbanBankIdentifier = (value = "") => {
  const account = normalizeBankIdentifier(value);

  if (!/^XK\d{2}[A-Z0-9]{2,}$/.test(account)) {
    return "";
  }

  return account.slice(4, 6);
};

const detectProfileKosovoBank = (value = "") => {
  return detectKosovoBankFromAccount(value);
};

const maskBankAccountNumber = (value = "") => {
  return maskBankAccount(value);
};

const buildBankAccountLabel = ({ bankName = "", bankAccountNumber = "", iban = "" } = {}) => {
  const displayName = String(bankName || "").trim() || "Llogari bankare";
  const maskedIdentifier = maskBankAccount(iban || bankAccountNumber);

  return [displayName, maskedIdentifier].filter(Boolean).join(" - ");
};

const normalizeBankNameForLogo = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const PROFILE_BANK_LOGO_ALIASES = {
  bkt: "NCBAXKPR",
  bktkosovo: "NCBAXKPR",
  bankakombetaretregtarekosove: "NCBAXKPR",
  procredit: "MBKOXKPR",
  procreditbank: "MBKOXKPR",
  procreditbankkosovo: "MBKOXKPR",
  raiffeisen: "RBKOXKPR",
  raiffeisenbank: "RBKOXKPR",
  raiffeisenbankkosovo: "RBKOXKPR",
  teb: "TEBKXKPR",
  tebbank: "TEBKXKPR",
  tebbankkosovo: "TEBKXKPR",
  nlb: "NLPRXKPR",
  nlbbanka: "NLPRXKPR",
  bankaperbiznes: "BPBXXKPR",
  bpb: "BPBXXKPR",
  bpbbank: "BPBXXKPR",
  ziraat: "TCZBXKPR",
  ziraatbank: "TCZBXKPR",
  ziraatbankkosovo: "TCZBXKPR",
  isbank: "ISBKXKPR",
  isbankkosovo: "ISBKXKPR",
  pribank: "PHHAXKPR",
  economic: "EKOMXKPR",
  economicbank: "EKOMXKPR",
  bankaekonomike: "EKOMXKPR",
};

const PROFILE_BANK_DISPLAY_NAMES_BY_SWIFT = {
  NCBAXKPR: {
    sq: "Banka Kombëtare Tregtare",
    en: "BKT Kosovo",
  },
  MBKOXKPR: {
    sq: "ProCredit Bank",
    en: "ProCredit Bank",
  },
  RBKOXKPR: {
    sq: "Raiffeisen Bank",
    en: "Raiffeisen Bank",
  },
  TEBKXKPR: {
    sq: "TEB Bank",
    en: "TEB Bank",
  },
  NLPRXKPR: {
    sq: "NLB Banka",
    en: "NLB Banka",
  },
  BPBXXKPR: {
    sq: "Banka për Biznes",
    en: "BPB",
  },
  TCZBXKPR: {
    sq: "Ziraat Bank",
    en: "Ziraat Bank",
  },
  ISBKXKPR: {
    sq: "İşbank",
    en: "Isbank",
  },
  PHHAXKPR: {
    sq: "PriBank",
    en: "PriBank",
  },
  EKOMXKPR: {
    sq: "Banka Ekonomike",
    en: "Economic Bank",
  },
};

const getProfileBankBySavedName = (bankName = "") => {
  const normalizedName = normalizeBankNameForLogo(bankName);

  if (!normalizedName) {
    return null;
  }

  const exactBank = KOSOVO_BANKS.find((bank) => normalizeBankNameForLogo(bank.name) === normalizedName);

  if (exactBank) {
    return exactBank;
  }

  const aliasSwift = PROFILE_BANK_LOGO_ALIASES[normalizedName];

  return aliasSwift ? KOSOVO_BANKS.find((bank) => bank.swift === aliasSwift) || null : null;
};

const getProfileBankCardLogoBank = (account = {}) =>
  getProfileBankBySavedName(account.bankName)
  || detectKosovoBankFromAccount(account.iban || account.bankAccountNumber);

const getLocalizedProfileBankDisplayName = (bankName = "", language = "sq") => {
  const savedBankName = String(bankName || "").trim();
  const matchedBank = getProfileBankBySavedName(savedBankName);
  const displayNames = matchedBank ? PROFILE_BANK_DISPLAY_NAMES_BY_SWIFT[matchedBank.swift] : null;

  return displayNames?.[language === "en" ? "en" : "sq"] || savedBankName;
};

const shouldShowLocalizedProfileBankDraftName = (bankName = "", detectedBank = null) => {
  const savedBank = getProfileBankBySavedName(bankName);

  return Boolean(savedBank && detectedBank && savedBank.swift === detectedBank.swift);
};

const STATISTIC_METRIC_KEYS = ["publikime", "citime", "konferenca", "rimbursime"];

const DEFAULT_PROFESSOR_SYSTEM_PREFERENCES = {
  emailNotifications: true,
};

const PASSWORD_RESET_TOAST_DURATION_MS = 2500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hasStatisticMetricData = (rows = []) =>
  rows.some((row) =>
    STATISTIC_METRIC_KEYS.some((key) => Number(row[key] || 0) > 0)
  );

export default function ProfessorDashboard() {
  const navigate = useNavigate();
  const { language, setLanguage, t, tx } = useLanguage();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orcidStatus = params.get("orcid");

    if (!orcidStatus) return;

    if (orcidStatus === "connected") {
      alert("ORCID u lidh me sukses!");
    } else if (orcidStatus === "user_not_found") {
      alert("User nuk u gjet në databazë.");
    } else {
      alert("Ndodhi një gabim gjatë lidhjes me ORCID.");
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);


  const [activePage, setActivePage] = useState("Statistika");
  const [reimbursementTypeTarget, setReimbursementTypeTarget] = useState({ type: "", requestId: 0 });
  const [activeReimbursementType, setActiveReimbursementType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [periodRange, setPeriodRange] = useState("6m");
  const [profile, setProfile] = useState(professorProfile);
  const [statisticsData, setStatisticsData] = useState(DEFAULT_PROFESSOR_STATISTICS);
  const [isStatisticsLoading, setIsStatisticsLoading] = useState(true);
  const [statisticsError, setStatisticsError] = useState("");
  const [publications, setPublications] = useState([]);
  const [isPublicationsLoading, setIsPublicationsLoading] = useState(true);
  const [publicationsError, setPublicationsError] = useState("");
  const [publicationsPage, setPublicationsPage] = useState(1);
  const [publicationsPagination, setPublicationsPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [editingPublicationId, setEditingPublicationId] = useState("");
  const [publicationDraft, setPublicationDraft] = useState(createEmptyPublicationDraft);
  const [manualPublicationDraft, setManualPublicationDraft] = useState(createEmptyPublicationDraft);
  const [publicationActionId, setPublicationActionId] = useState("");
  const [publicationSuccessToast, setPublicationSuccessToast] = useState("");
  const [focusedPublicationId, setFocusedPublicationId] = useState("");
  const [publicationSort, setPublicationSort] = useState({ key: "", direction: "asc" });
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(professorProfile);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [isBankAccountsLoading, setIsBankAccountsLoading] = useState(false);
  const [bankAccountsError, setBankAccountsError] = useState("");
  const [bankAccountDraft, setBankAccountDraft] = useState(createEmptyBankAccountDraft);
  const [editingBankAccountId, setEditingBankAccountId] = useState("");
  const [bankAccountActionId, setBankAccountActionId] = useState("");
  const [isBankAccountSaving, setIsBankAccountSaving] = useState(false);
  const [bankAccountDeleteTarget, setBankAccountDeleteTarget] = useState(null);
  const bankAccountDeleteCancelRef = useRef(null);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [passwordResetEmail, setPasswordResetEmail] = useState("");
  const [isPasswordResetSending, setIsPasswordResetSending] = useState(false);
  const [passwordResetToast, setPasswordResetToast] = useState("");
  const [passwordResetError, setPasswordResetError] = useState("");
  const [hasAuthenticatedSession, setHasAuthenticatedSession] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [systemPreferences, setSystemPreferences] = useState(DEFAULT_PROFESSOR_SYSTEM_PREFERENCES);
  const [systemPreferencesMessage, setSystemPreferencesMessage] = useState("");

  const settingsText = t("professor.settings");
  const departmentOptions = FACULTY_DEPARTMENTS[profileDraft.faculty] || [];
  const hasLegacyFaculty = Boolean(profileDraft.faculty && !FACULTY_OPTIONS.includes(profileDraft.faculty));
  const hasLegacyDepartment = Boolean(
    profileDraft.department && !departmentOptions.includes(profileDraft.department)
  );
  const detectedProfileBank = useMemo(
    () => detectKosovoBankFromAccount(bankAccountDraft.bankAccountNumber || bankAccountDraft.iban),
    [bankAccountDraft.bankAccountNumber, bankAccountDraft.iban]
  );
  const bankAccountDraftDisplayName = useMemo(
    () => shouldShowLocalizedProfileBankDraftName(bankAccountDraft.bankName, detectedProfileBank)
      ? getLocalizedProfileBankDisplayName(bankAccountDraft.bankName, language)
      : bankAccountDraft.bankName,
    [bankAccountDraft.bankName, detectedProfileBank, language]
  );

  const translatedProfileMenuItems = useMemo(
    () =>
      profileMenuItems.map((item) => {
        const translatedLabels = {
          EditProfile: t("topbar.menuEditProfile"),
          OrcidConnect: t("topbar.menuOrcidConnect"),
          Njoftime: t("topbar.menuNotifications"),
          Settings: t("topbar.menuSettings"),
          Integrime: t("topbar.menuIntegrations"),
          Logout: t("topbar.menuLogout"),
        };

        return {
          ...item,
          label: translatedLabels[item.id] || item.label,
        };
      }),
    [t]
  );

  const updateSystemPreference = useCallback(async (field, value) => {
    const next = { ...systemPreferences, [field]: value };

    setSystemPreferences(next);

    if (field === "language") {
      setLanguage(value);
      setSystemPreferencesMessage(t("professor.settings.preferencesSaved"));
      return;
    }

    if (field === "emailNotifications") {
      try {
        const response = await fetch(apiUrl("/notifications/preferences"), {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ emailNotifications: value }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("preferences_update_failed");
        }

        setSystemPreferences((prev) => ({
          ...prev,
          emailNotifications: Boolean(data.emailNotifications),
        }));
        setSystemPreferencesMessage(t("professor.settings.preferencesSaved"));
        return;
      } catch (error) {
        console.error("Preferences save failed:", error);
        setSystemPreferences(systemPreferences);
        setSystemPreferencesMessage(t("professor.settings.preferencesSaveError"));
        return;
      }
    }

    setSystemPreferencesMessage(t("professor.settings.preferencesSaved"));
  }, [setLanguage, systemPreferences, t]);

  useEffect(() => {
    if (!systemPreferencesMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setSystemPreferencesMessage(""), 2500);

    return () => window.clearTimeout(timeout);
  }, [systemPreferencesMessage]);

  useEffect(() => {
    if (!passwordResetToast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setPasswordResetToast(""), PASSWORD_RESET_TOAST_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [passwordResetToast]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const response = await fetch(apiUrl("/auth/me"), {
          credentials: "include",
        });

        if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        }

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const nextProfile = normalizeProfile(data.user);

        if (isMounted) {
          setProfile(nextProfile);
          setProfileDraft(nextProfile);
          setHasAuthenticatedSession(true);
        }
      } catch (error) {
        console.error("Profile load failed:", error);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const loadNotifications = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setIsNotificationsLoading(true);
    }
    setNotificationsError("");

    try {
      const response = await fetch(apiUrl("/notifications"), {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("notifications_load_failed");
      }

      const data = await response.json();
      setNotifications(Array.isArray(data) ? data.map(mapNotificationRow) : []);
    } catch (error) {
      console.error("Notifications load failed:", error);
      setNotifications([]);
      setNotificationsError("Notifications could not be loaded. Please try again.");
    } finally {
      if (showLoading) {
        setIsNotificationsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!hasAuthenticatedSession) {
      return undefined;
    }

    loadNotifications();
    const interval = window.setInterval(() => {
      loadNotifications({ showLoading: false });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [hasAuthenticatedSession, loadNotifications]);

  useEffect(() => {
    if (!hasAuthenticatedSession) {
      return undefined;
    }

    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const response = await fetch(apiUrl("/notifications/preferences"), {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("preferences_load_failed");
        }

        const data = await response.json();

        if (isMounted) {
          setSystemPreferences((prev) => ({
            ...prev,
            emailNotifications: Boolean(data.emailNotifications),
          }));
        }
      } catch (error) {
        console.error("Preferences load failed:", error);
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [hasAuthenticatedSession]);

  useEffect(() => {
    let isMounted = true;

    const loadStatistics = async () => {
      setIsStatisticsLoading(true);
      setStatisticsError("");

      try {
        const response = await fetch(apiUrl(`/professor/stats?range=${periodRange}`), {
          credentials: "include",
        });

        if (response.status === 401) {
          throw new Error("stats_unauthorized");
        }

        if (!response.ok) {
          throw new Error("stats_load_failed");
        }

        const data = await response.json();

        if (isMounted) {
          setStatisticsData(normalizeStatisticsPayload(data));
        }
      } catch (error) {
        console.error("Statistics load failed:", error);

        if (isMounted) {
          setStatisticsError(
            error.message === "stats_unauthorized"
              ? "professor.dashboard.statsUnauthorized"
              : "professor.dashboard.statsLoadError"
          );
          setStatisticsData(DEFAULT_PROFESSOR_STATISTICS);
        }
      } finally {
        if (isMounted) {
          setIsStatisticsLoading(false);
        }
      }
    };

    loadStatistics();

    return () => {
      isMounted = false;
    };
  }, [navigate, periodRange]);

  const activePublicationTypeFilter = getPublicationTypeFilterForPage(activePage);

  useEffect(() => {
    setPublicationsPage(1);
  }, [activePublicationTypeFilter, searchQuery]);

  const loadPublications = useCallback(async ({ page = publicationsPage, query = searchQuery } = {}) => {
    setIsPublicationsLoading(true);
    setPublicationsError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
      });
      const trimmedQuery = query.trim();

      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      }

      if (activePublicationTypeFilter) {
        params.set("publicationType", activePublicationTypeFilter);
      }

      const response = await fetch(apiUrl(`/publications?${params.toString()}`), {
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error("publications_unauthorized");
      }

      if (!response.ok) {
        throw new Error(data.message || "publications_load_failed");
      }

      const rows = Array.isArray(data) ? data : data.data;

      setPublications(Array.isArray(rows) ? rows.map(mapPublicationRow) : []);
      setPublicationsPagination({
        page: data.pagination?.page || page,
        limit: data.pagination?.limit || 25,
        total: data.pagination?.total || (Array.isArray(rows) ? rows.length : 0),
        totalPages: data.pagination?.totalPages || 1,
      });
    } catch (error) {
      console.error("Publications load failed:", error);

      setPublications([]);
      setPublicationsError(
        error.message === "publications_unauthorized"
          ? "professor.dashboard.publicationsUnauthorized"
          : error.message || "professor.dashboard.publicationsLoadError"
      );
    } finally {
      setIsPublicationsLoading(false);
    }
  }, [activePublicationTypeFilter, publicationsPage, searchQuery]);

  useEffect(() => {
    loadPublications({ page: publicationsPage, query: searchQuery });
  }, [loadPublications, publicationsPage, searchQuery]);

  const pageTitleMap = {
    Statistika: t("navigation.statistics"),
    Publikime: t("navigation.publications"),
    "Lista e Publikimeve": "Te gjithe Artikujt",
    "Artikuj reviste": "Artikuj reviste",
    "Punime të konferencave": "Punime të konferencave",
    "Libra / Kapituj": "Libra / Kapituj",
    "Te gjithe Artikujt": "Te gjithe Artikujt",
    "Të gjitha publikimet": "Te gjithe Artikujt",
    Konferenca: t("navigation.conferences"),
    Rimbursime: t("navigation.reimbursements"),
    "Historiku i Rimbursimeve": t("navigation.reimbursementHistory"),
    Njoftime: t("navigation.notifications"),
    Settings: t("navigation.settings"),
    Integrime: t("navigation.integrations"),
  };
  const pageTitle = pageTitleMap[activePage] || activePage;
  const searchPlaceholder = activePage === "Statistika"
    ? t("topbar.statisticsSearchPlaceholder")
    : t("topbar.searchPlaceholder");
  const getStatusLabel = useCallback((status) => tx(STATUS_LABELS[status] || status), [tx]);
  const formatUiMessage = useCallback(
    (message) => {
      const normalizedMessage = String(message || "").trim();
      const mappedMessage = PUBLICATION_ERROR_MESSAGES[normalizedMessage];

      if (mappedMessage) {
        return t(mappedMessage);
      }

      const looksLikeTranslationKey = /^[a-z][\w-]*(\.[\w-]+)+$/i.test(normalizedMessage);

      return looksLikeTranslationKey ? t(normalizedMessage) : tx(normalizedMessage);
    },
    [t, tx]
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;
  const canReviewPublications = PUBLICATION_REVIEW_ROLES.has(String(profile.appRole || "").toLowerCase());

  const filteredPublications = useMemo(() => {
    if (!normalizedQuery) {
      return publications;
    }

    return publications.filter((row) => getPublicationSearchText(row).includes(normalizedQuery));
  }, [normalizedQuery, publications]);

  const sortedPublications = useMemo(() => {
    if (!publicationSort.key) {
      return filteredPublications;
    }

    const direction = publicationSort.direction === "desc" ? -1 : 1;

    return [...filteredPublications].sort((first, second) => {
      let result = 0;

      if (publicationSort.key === "title") {
        result = String(first.title || "").localeCompare(String(second.title || ""), "sq", { sensitivity: "base" });
      } else if (publicationSort.key === "authors") {
        result = getPublicationPrimaryAuthorName(first.authors).localeCompare(
          getPublicationPrimaryAuthorName(second.authors),
          "sq",
          { sensitivity: "base" }
        );
      } else if (publicationSort.key === "year") {
        result = (Number(first.year) || 0) - (Number(second.year) || 0);
      } else if (publicationSort.key === "quartile") {
        result = getPublicationQuartileRank(first) - getPublicationQuartileRank(second);
      } else if (publicationSort.key === "type") {
        result = String(first.publicationType || "").localeCompare(String(second.publicationType || ""), "sq", { sensitivity: "base" });
      } else if (publicationSort.key === "venue") {
        result = String(first.publishedIn || first.published_in || first.venue || first.journal || "").localeCompare(
          String(second.publishedIn || second.published_in || second.venue || second.journal || ""),
          "sq",
          { sensitivity: "base" }
        );
      } else if (publicationSort.key === "status") {
        result = String(first.status || "").localeCompare(String(second.status || ""), "sq", { sensitivity: "base" });
      }

      return result * direction;
    });
  }, [filteredPublications, publicationSort]);

  const publicationSearchResults = useMemo(() => {
    if (activePage === "Statistika" || !normalizedQuery) {
      return [];
    }

    const publicationResults = sortedPublications.slice(0, 5).map((row) => ({
      id: row.id,
      title: row.title,
      meta: [
        t("navigation.publicationList"),
        formatPublicationAuthorSummary(row.authors),
        row.year,
      ].filter(Boolean).join(" | "),
      publication: row,
    }));

    const pageResults = [
      {
        id: "search-publications-page",
        title: "Te gjithe Artikujt",
        meta: t("topbar.searchPageShortcut"),
        page: "Te gjithe Artikujt",
      },
      {
        id: "search-conferences-page",
        title: t("navigation.conferences"),
        meta: t("topbar.searchPageShortcut"),
        page: "Konferenca",
      },
      {
        id: "search-reimbursements-page",
        title: t("navigation.reimbursements"),
        meta: t("topbar.searchPageShortcut"),
        page: "Rimbursime",
      },
    ].filter((item) => item.page !== activePage);

    return [...publicationResults, ...pageResults].slice(0, 8);
  }, [activePage, normalizedQuery, sortedPublications, t]);

  const openPublicationSearchResult = (item) => {
    if (item?.page) {
      setActivePage(item.page);
      setFocusedPublicationId("");
      if (PUBLICATION_LIST_PAGES.has(item.page)) {
        setPublicationsPage(1);
      }
      return;
    }

    const publication = item?.publication;

    if (!publication) {
      return;
    }

    setActivePage("Publikime");
    startPublicationEdit(publication);
    setFocusedPublicationId(publication.id);

    window.setTimeout(() => {
      document.getElementById("publication-edit-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  const buildPublicationPayload = (draft = {}) => {
    const payload = { ...draft };
    const authors = Array.isArray(draft.authors) ? draft.authors : [];
    const publicationType = draft.publicationType || draft.publication_type;
    const publicationSubtype = normalizePublicationSubtype(draft.publicationSubtype || draft.publication_subtype);
    const isConferencePaper = publicationType === "conference_paper";
    const isBookPublication = isBookPublicationType(publicationType);
    const isBookChapter = isBookChapterPublication(publicationType, publicationSubtype);
    const supportsIndexing = supportsPublicationIndexing(publicationType);
    const draftIndexing = supportsIndexing && Array.isArray(draft.indexing) ? draft.indexing : [];
    const selectedIndexing = getSelectedIndexingItem(draftIndexing, draft.quartile);
    const authorAffiliation = null;
    const indexingPlatforms = supportsIndexing ? getSelectedIndexingPlatforms(draftIndexing, draft.indexingPlatform || draft.indexing_platform || selectedIndexing.source || "") : [];
    const indexingPlatform = supportsIndexing ? formatIndexingPlatforms(indexingPlatforms) : "";
    const scopusIndexing = draftIndexing.find((item) => normalizeIndexingPlatformValue(item?.source || item?.platform) === "Scopus") || selectedIndexing;
    const webOfScienceIndexing = draftIndexing.find((item) => normalizeIndexingPlatformValue(item?.source || item?.platform) === "Web of Science") || selectedIndexing;
    const hasScopusIndexing = indexingPlatforms.includes("Scopus");
    const hasWebOfScienceIndexing = indexingPlatforms.includes("Web of Science");
    const customIndexingPlatform = supportsIndexing && indexingPlatforms.includes("Other") ? String(draft.customIndexingPlatform || draft.custom_indexing_platform || "").trim() : "";
    const webOfScienceIndex = supportsIndexing && hasWebOfScienceIndexing ? normalizeWebOfScienceIndexValue(draft.webOfScienceIndex || draft.web_of_science_index || webOfScienceIndexing.webOfScienceIndex || webOfScienceIndexing.web_of_science_index || webOfScienceIndexing.category || "") : "";
    const indexingCategory = webOfScienceIndex;
    const publicationDate = isBookPublication && !isBookChapter ? "" : normalizePublicationDateForPayload(draft.publicationDate || draft.publication_date);
    const acceptanceDate = publicationType === "journal_article" ? normalizePublicationDateForPayload(draft.acceptanceDate || draft.acceptance_date) : "";
    const quartile = supportsIndexing && hasScopusIndexing ? normalizeQuartileValue(draft.quartile || scopusIndexing.quartile || "") : "";
    const sjr = supportsIndexing && hasScopusIndexing ? draft.sjr || scopusIndexing.sjr || "" : "";
    const citeScore = supportsIndexing && hasScopusIndexing ? draft.citeScore || draft.cite_score || getIndexingCiteScore(scopusIndexing) : "";
    const impactFactor = supportsIndexing && hasWebOfScienceIndexing ? draft.impactFactor || draft.impact_factor || webOfScienceIndexing.impactFactor || webOfScienceIndexing.impact_factor || "" : "";
    const quartileVerificationStatus = supportsIndexing ? draft.quartileVerificationStatus || draft.quartile_verification_status || scopusIndexing.quartileVerificationStatus || scopusIndexing.quartile_verification_status || (quartile ? "manual" : "empty") : "empty";
    const normalizedQuartileVerificationStatus = String(quartileVerificationStatus || "").toLowerCase();
    const quartileVerified = supportsIndexing && normalizeLooseBoolean(draft.quartileVerified ?? draft.quartile_verified ?? scopusIndexing.quartileVerified ?? scopusIndexing.quartile_verified);
    const quartileFromLookup = quartileVerified || normalizedQuartileVerificationStatus === "historical" || normalizedQuartileVerificationStatus === "verified";
    const quartileSource = quartileFromLookup
      ? draft.quartileSource || draft.quartile_source || scopusIndexing.quartileSource || scopusIndexing.quartile_source || scopusIndexing.sourceKey || scopusIndexing.source_key || "manual"
      : "manual";
    const indexingVerified = supportsIndexing && normalizeLooseBoolean(draft.indexingVerified ?? draft.indexing_verified);
    const indexingSource = indexingVerified || quartileFromLookup
      ? draft.indexingSource || draft.indexing_source || selectedIndexing.sourceKey || selectedIndexing.source_key || "manual"
      : "manual";
    const publishedIn = draft.venue || draft.publishedIn || draft.published_in || "";
    const conferenceCity = isConferencePaper ? draft.conferenceCity || draft.conference_city || "" : "";
    const conferenceCountry = isConferencePaper ? draft.conferenceCountry || draft.conference_country || "" : "";
    const conferenceLocation = isConferencePaper
      ? [conferenceCity, conferenceCountry].map((part) => String(part || "").trim()).filter(Boolean).join(", ")
      : "";
    const resolvedMainAuthorIndex = 0;
    const correspondingAuthorIndex = authors.findIndex((author) =>
      normalizeLooseBoolean(author?.isCorrespondingAuthor ?? author?.is_corresponding_author)
    );
    const presenterIndex = authors.findIndex((author) =>
      normalizeLooseBoolean(author?.isPresenter ?? author?.is_presenter)
    );
    const normalizedAuthors = authors.map((author, index) => {
      const authorPayload = { ...(author || {}) };
      const isPresenter = isConferencePaper && presenterIndex >= 0 && index === presenterIndex;
      const isCorrespondingAuthor = !isConferencePaper && correspondingAuthorIndex >= 0 && index === correspondingAuthorIndex;

      delete authorPayload.isCorrespondingAuthor;
      delete authorPayload.is_corresponding_author;
      delete authorPayload.correspondingAuthor;
      delete authorPayload.corresponding_author;
      delete authorPayload.isPresenter;
      delete authorPayload.is_presenter;
      delete authorPayload.presenter;
      delete authorPayload.orcidSource;
      delete authorPayload.orcid_source;
      delete authorPayload.affiliationSource;
      delete authorPayload.affiliation_source;

      return {
        ...authorPayload,
        affiliation: authorPayload.affiliation || "",
        isMainAuthor: index === resolvedMainAuthorIndex,
        is_main_author: index === resolvedMainAuthorIndex,
        isCorrespondingAuthor,
        is_corresponding_author: isCorrespondingAuthor,
        isPresenter,
        is_presenter: isPresenter,
      };
    });
    const indexing = indexingPlatforms.length
      ? indexingPlatforms.map((platform) => {
        const item = draftIndexing.find((entry) => normalizeIndexingPlatformValue(entry?.source || entry?.platform) === platform) || {};
        const isScopus = platform === "Scopus";
        const isWebOfScience = platform === "Web of Science";

        return {
          ...item,
          source: platform,
          platform,
          sourceKey: item.sourceKey || item.source_key || indexingSource,
          source_key: item.source_key || item.sourceKey || indexingSource,
          category: isWebOfScience ? indexingCategory : "",
          webOfScienceIndex: isWebOfScience ? webOfScienceIndex : "",
          web_of_science_index: isWebOfScience ? webOfScienceIndex : "",
          quartile: isScopus ? quartile : "",
          quartileVerified: isScopus && normalizeLooseBoolean(item.quartileVerified ?? item.quartile_verified ?? quartileVerified),
          quartile_verified: isScopus && normalizeLooseBoolean(item.quartileVerified ?? item.quartile_verified ?? quartileVerified),
          quartileSource: isScopus ? quartileSource : "manual",
          quartile_source: isScopus ? quartileSource : "manual",
          quartileVerificationStatus: isScopus ? quartileVerificationStatus : "empty",
          quartile_verification_status: isScopus ? quartileVerificationStatus : "empty",
          quartileSelectionReason: isScopus ? item.quartileSelectionReason || item.quartile_selection_reason || "" : "",
          quartile_selection_reason: isScopus ? item.quartileSelectionReason || item.quartile_selection_reason || "" : "",
          sjr: isScopus ? sjr : "",
          citeScore: isScopus ? citeScore : "",
          impactFactor: isWebOfScience ? impactFactor : "",
          impact_factor: isWebOfScience ? impactFactor : "",
        };
      })
      : [];

    delete payload.attachments;
    delete payload.evidenceLinks;
    delete payload.evidence_links;
    delete payload.identifiers;
    delete payload.correspondingAuthor;
    delete payload.corresponding_author;

    return {
      ...payload,
      venue: publishedIn,
      publishedIn,
      published_in: publishedIn,
      publicationSubtype,
      publication_subtype: publicationSubtype,
      conferenceLocation,
      conference_location: conferenceLocation,
      conferenceCity,
      conference_city: conferenceCity,
      conferenceCountry,
      conference_country: conferenceCountry,
      conferenceFormat: isConferencePaper ? draft.conferenceFormat || draft.conference_format || "" : "",
      conference_format: isConferencePaper ? draft.conferenceFormat || draft.conference_format || "" : "",
      presentationType: isConferencePaper ? draft.presentationType || draft.presentation_type || "" : "",
      presentation_type: isConferencePaper ? draft.presentationType || draft.presentation_type || "" : "",
      publisher: draft.publisher || "",
      acceptanceDate,
      acceptance_date: acceptanceDate,
      publicationDate,
      publication_date: publicationDate,
      publicationYear: isBookPublication && !isBookChapter ? "" : draft.publicationYear || draft.publication_year || "",
      publication_year: isBookPublication && !isBookChapter ? "" : draft.publicationYear || draft.publication_year || "",
      proceedingsTitle: isConferencePaper ? draft.proceedingsTitle || draft.proceedings_title || "" : "",
      proceedings_title: isConferencePaper ? draft.proceedingsTitle || draft.proceedings_title || "" : "",
      eventDate: isConferencePaper ? draft.eventDate || draft.event_date || "" : "",
      event_date: isConferencePaper ? draft.eventDate || draft.event_date || "" : "",
      pageStart: "",
      page_start: "",
      pageEnd: "",
      page_end: "",
      volume: isConferencePaper || (isBookPublication && !isBookChapter) ? "" : draft.volume || "",
      issue: isConferencePaper || isBookPublication ? "" : draft.issue || "",
      pages: isConferencePaper ? "" : draft.pages || "",
      issn: isConferencePaper || isBookPublication ? "" : draft.issn || "",
      eIssn: publicationType === "journal_article" ? draft.eIssn || draft.e_issn || "" : "",
      e_issn: publicationType === "journal_article" ? draft.e_issn || draft.eIssn || "" : "",
      isbn: publicationType === "journal_article" || isConferencePaper ? "" : draft.isbn || "",
      status: draft.status === "needs_correction" ? "draft" : draft.status,
      authors: normalizedAuthors,
      authorAffiliation,
      author_affiliation: authorAffiliation,
      indexingPlatform,
      indexing_platform: indexingPlatform,
      customIndexingPlatform,
      custom_indexing_platform: customIndexingPlatform,
      webOfScienceIndex,
      web_of_science_index: webOfScienceIndex,
      indexingCategory,
      indexing_category: indexingCategory,
      indexingVerified,
      indexing_verified: indexingVerified,
      indexingSource,
      indexing_source: indexingSource,
      indexing,
      quartile,
      quartileVerified,
      quartile_verified: quartileVerified,
      quartileSource,
      quartile_source: quartileSource,
      quartileVerificationStatus,
      quartile_verification_status: quartileVerificationStatus,
      sjr,
      citeScore,
      cite_score: citeScore,
      impactFactor,
      impact_factor: impactFactor,
    };
  };

  const openPublicationEditForm = (publication) => {
    startPublicationEdit(publication);
    setFocusedPublicationId(publication.id);
    setActivePage("Publikime");

    window.setTimeout(() => {
      document.getElementById("publication-edit-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  const statisticsChartData = useMemo(() => {
    return statisticsData.monthly.map((row) => ({
      ...row,
      month: formatMonthLabel(row.month),
      rawMonth: row.month,
    }));
  }, [statisticsData.monthly]);

  const filteredStatisticsChartData = useMemo(() => {
    if (!normalizedQuery) {
      return statisticsChartData;
    }

    return statisticsChartData.filter((row) =>
      `${row.month} ${row.publikime} ${row.citime} ${row.konferenca} ${row.rimbursime}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, statisticsChartData]);
  const hasStatisticsChartData = useMemo(
    () => hasStatisticMetricData(statisticsChartData),
    [statisticsChartData]
  );
  const hasFilteredStatisticsChartData = useMemo(
    () => hasStatisticMetricData(filteredStatisticsChartData),
    [filteredStatisticsChartData]
  );

  const handleDashboardNavigate = (destination) => {
    if (destination && typeof destination === "object") {
      const reimbursementType = destination.reimbursementType || "";

      setReimbursementTypeTarget((prev) => ({
        type: reimbursementType,
        requestId: prev.requestId + 1,
      }));
      setActiveReimbursementType(reimbursementType);
      setActivePage(destination.page || "Statistika");
      return;
    }

    if (destination === "Rimbursime") {
      setReimbursementTypeTarget((prev) => ({ type: "publication", requestId: prev.requestId + 1 }));
      setActiveReimbursementType("");
    } else {
      setReimbursementTypeTarget((prev) => ({ type: "", requestId: prev.requestId + 1 }));
      setActiveReimbursementType("");
    }

    setActivePage(destination);
  };

  const handleMenuAction = (action) => {
    const normalizedAction = String(action || "").trim().toLowerCase();

    if (normalizedAction === "logout") {
      handleLogout();
      return;
    }

    if (normalizedAction === "editprofile" || normalizedAction === "edit-profile") {
      setProfileDraft(profile);
      setProfileError("");
      setProfilePhotoError("");
      setIsEditProfileOpen(true);
      return;
    }

    if (normalizedAction === "orcidconnect" || normalizedAction === "orcid-connect") {
      window.location.href = apiUrl("/orcid/connect");
      return;
    }

    if (normalizedAction === "settings") {
      handleDashboardNavigate("Settings");
      return;
    }

    if (normalizedAction === "integrime") {
      handleDashboardNavigate("Integrime");
      return;
    }

    if (normalizedAction === "njoftime" || normalizedAction === "notifications") {
      handleDashboardNavigate("Njoftime");
      return;
    }

    handleDashboardNavigate(action);
  };

  const handleProfileFieldChange = (field) => (event) => {
    setProfileDraft((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleProfileFacultyChange = (event) => {
    const faculty = event.target.value;
    const departments = FACULTY_DEPARTMENTS[faculty] || [];
    const department = departments.length === 1 ? departments[0] : "";
    setProfileDraft((prev) => ({ ...prev, faculty, department }));
  };

  const getProfilePhotoErrorMessage = (error) => {
    const code = error?.message || "";

    if (code === "invalid_type") {
      return settingsText.profilePhotoInvalidType;
    }

    if (code === "too_large") {
      return settingsText.profilePhotoTooLarge;
    }

    return settingsText.profilePhotoLoadError;
  };

  const handleProfilePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setProfilePhotoError("");

    try {
      const profilePhotoUrl = await createProfilePhotoDataUrl(file);

      setProfileDraft((prev) => ({
        ...prev,
        profilePhotoUrl,
      }));
    } catch (error) {
      console.error("Profile photo load failed:", error);
      setProfilePhotoError(getProfilePhotoErrorMessage(error));
    }
  };

  const handleProfilePhotoRemove = () => {
    setProfilePhotoError("");
    setProfileDraft((prev) => ({
      ...prev,
      profilePhotoUrl: "",
    }));
  };

  const handleProfileEducationFieldChange = (index, field) => (event) => {
    const value = event.target.value;

    setProfileDraft((prev) => ({
      ...prev,
      school: index === 0 && field === "organization" ? value : prev.school,
      education: (Array.isArray(prev.education) ? prev.education : []).map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      )),
    }));
  };

  const addProfileEducationEntry = () => {
    setProfileDraft((prev) => ({
      ...prev,
      education: [
        ...(Array.isArray(prev.education) ? prev.education : []),
        {
          organization: "",
          department: "",
          roleTitle: "",
          startDate: "",
          endDate: "",
          city: "",
          region: "",
          country: "",
        },
      ],
    }));
  };

  const renderProfileEducationEntry = (item = {}, index) => {
    return (
      <div className="prof-education-entry" key={`education-${item.putCode || index}`}>
        <div className="prof-education-entry-grid">
          <label className="prof-form-field">
            <span>{settingsText.educationInstitution}</span>
            <input value={item.organization || ""} onChange={handleProfileEducationFieldChange(index, "organization")} placeholder={settingsText.educationInstitutionPlaceholder} />
          </label>
          <label className="prof-form-field">
            <span>{settingsText.educationDepartment}</span>
            <input value={item.department || ""} onChange={handleProfileEducationFieldChange(index, "department")} placeholder={settingsText.educationDepartmentPlaceholder} />
          </label>
          <label className="prof-form-field">
            <span>{settingsText.educationProgram}</span>
            <input value={item.roleTitle || ""} onChange={handleProfileEducationFieldChange(index, "roleTitle")} placeholder={settingsText.educationProgramPlaceholder} />
          </label>
          <label className="prof-form-field">
            <span>{settingsText.educationStartDate}</span>
            <input value={item.startDate || ""} onChange={handleProfileEducationFieldChange(index, "startDate")} placeholder={settingsText.educationStartDatePlaceholder} />
          </label>
          <label className="prof-form-field">
            <span>{settingsText.educationEndDate}</span>
            <input value={item.endDate || ""} onChange={handleProfileEducationFieldChange(index, "endDate")} placeholder={settingsText.educationEndDatePlaceholder} />
          </label>
          <div className="prof-form-field prof-education-location-field">
            <span>{settingsText.educationLocation}</span>
            <div className="prof-education-location-grid">
              <input value={item.city || ""} onChange={handleProfileEducationFieldChange(index, "city")} placeholder={settingsText.educationCityPlaceholder} />
              <input value={item.region || ""} onChange={handleProfileEducationFieldChange(index, "region")} placeholder={settingsText.educationRegionPlaceholder} />
              <input value={item.country || ""} onChange={handleProfileEducationFieldChange(index, "country")} placeholder={settingsText.educationCountryPlaceholder} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const loadBankAccounts = useCallback(async () => {
    setIsBankAccountsLoading(true);
    setBankAccountsError("");

    try {
      const response = await fetch(apiUrl("/auth/me/bank-accounts"), {
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "bank_accounts_load_failed");
      }

      setBankAccounts(Array.isArray(data.bankAccounts) ? data.bankAccounts : []);
    } catch (error) {
      console.error("Bank accounts load failed:", error);
      setBankAccountsError(settingsText.bankAccountLoadError);
      setBankAccounts([]);
    } finally {
      setIsBankAccountsLoading(false);
    }
  }, [navigate, settingsText.bankAccountLoadError]);

  useEffect(() => {
    if (isEditProfileOpen) {
      loadBankAccounts();
    }
  }, [isEditProfileOpen, loadBankAccounts]);

  const resetBankAccountDraft = () => {
    setBankAccountDraft(createEmptyBankAccountDraft());
    setEditingBankAccountId("");
  };

  const handleBankAccountDraftChange = (field) => (event) => {
    const value = field === "isDefault" ? event.target.checked : event.target.value;

    setBankAccountDraft((prev) => ({
      ...prev,
      [field]: field === "swiftCode" || field === "currency" ? String(value).toUpperCase() : value,
      ...(field === "bankAccountNumber"
        ? (() => {
            const detectedBank = detectKosovoBankFromAccount(value);

            return {
              iban: value,
              ...(detectedBank
                ? {
                    bankName: detectedBank.name,
                    swiftCode: detectedBank.swift || prev.swiftCode,
                  }
                : {}),
            };
          })()
        : {}),
    }));
  };

  const startBankAccountEdit = (account) => {
    setEditingBankAccountId(account.id);
    setBankAccountDraft({
      id: account.id || "",
      label: account.label || "",
      bankApplicantName: account.bankApplicantName || "",
      bankName: account.bankName || "",
      bankAccountNumber: account.bankAccountNumber || account.iban || "",
      iban: account.iban || account.bankAccountNumber || "",
      swiftCode: account.swiftCode || "",
      bankCountry: account.bankCountry === "Kosove" ? "Kosovë" : account.bankCountry || "Kosovë",
      currency: account.currency || "EUR",
      isDefault: Boolean(account.isDefault),
    });
  };

  const handleBankAccountSave = async () => {
    const accountId = editingBankAccountId;
    setBankAccountActionId(accountId || "new");
    setIsBankAccountSaving(true);
    setBankAccountsError("");
    const accountIdentifier = String(bankAccountDraft.bankAccountNumber || bankAccountDraft.iban || "").trim();
    const bankAccountPayload = {
      ...bankAccountDraft,
      label: buildBankAccountLabel({
        bankName: bankAccountDraft.bankName,
        bankAccountNumber: accountIdentifier,
        iban: accountIdentifier,
      }),
      bankApplicantName: profileDraft.name || profile.name || "",
      bankAccountNumber: accountIdentifier,
      iban: accountIdentifier,
      currency: accountId ? bankAccountDraft.currency || "EUR" : "EUR",
      bankCountry: bankAccountDraft.bankCountry || "Kosovë",
    };

    try {
      const response = await fetch(
        apiUrl(accountId ? `/auth/me/bank-accounts/${accountId}` : "/auth/me/bank-accounts"),
        {
          method: accountId ? "PUT" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bankAccountPayload),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        const message = data.errors?.[0]?.message || data.message || settingsText.bankAccountSaveError;
        throw new Error(message);
      }

      resetBankAccountDraft();
      await loadBankAccounts();
    } catch (error) {
      console.error("Bank account save failed:", error);
      setBankAccountsError(error.message || settingsText.bankAccountSaveError);
    } finally {
      setIsBankAccountSaving(false);
      setBankAccountActionId("");
    }
  };

  const closeBankAccountDeleteModal = useCallback(() => {
    if (bankAccountActionId) {
      return;
    }

    setBankAccountDeleteTarget(null);
  }, [bankAccountActionId]);

  useEffect(() => {
    if (!bankAccountDeleteTarget) {
      return undefined;
    }

    bankAccountDeleteCancelRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeBankAccountDeleteModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bankAccountDeleteTarget, closeBankAccountDeleteModal]);

  const requestBankAccountDelete = (account) => {
    setBankAccountDeleteTarget(account);
  };

  const handleBankAccountDelete = async () => {
    const accountId = bankAccountDeleteTarget?.id;

    if (!accountId) {
      return;
    }

    setBankAccountActionId(accountId);
    setBankAccountsError("");

    try {
      const response = await fetch(apiUrl(`/auth/me/bank-accounts/${accountId}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || settingsText.bankAccountSaveError);
      }

      if (editingBankAccountId === accountId) {
        resetBankAccountDraft();
      }

      setBankAccountDeleteTarget(null);
      await loadBankAccounts();
    } catch (error) {
      console.error("Bank account delete failed:", error);
      setBankAccountsError(error.message || settingsText.bankAccountSaveError);
    } finally {
      setBankAccountActionId("");
    }
  };

  const handleBankAccountSetDefault = async (accountId) => {
    setBankAccountActionId(accountId);
    setBankAccountsError("");

    try {
      const response = await fetch(apiUrl(`/auth/me/bank-accounts/${accountId}/default`), {
        method: "PATCH",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || settingsText.bankAccountSaveError);
      }

      await loadBankAccounts();
    } catch (error) {
      console.error("Bank account default update failed:", error);
      setBankAccountsError(error.message || settingsText.bankAccountSaveError);
    } finally {
      setBankAccountActionId("");
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setIsProfileSaving(true);
    setProfileError("");

    try {
      const response = await fetch(apiUrl("/auth/me"), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profileDraft.name,
          faculty: profileDraft.faculty,
          department: profileDraft.department,
          office: profileDraft.office,
          academicTitle: profileDraft.academicTitle,
          scientificTitle: profileDraft.scientificTitle,
          currentAffiliation: profileDraft.currentAffiliation,
          profilePhotoUrl: profileDraft.profilePhotoUrl || "",
          education: Array.isArray(profileDraft.education) ? profileDraft.education : [],
        }),
      });

      if (response.status === 401) {
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error("profile_save_failed");
      }

      const data = await response.json();
      const nextProfile = normalizeProfile(data.user);

      setProfile(nextProfile);
      setProfileDraft(nextProfile);
      setProfilePhotoError("");
      setIsEditProfileOpen(false);
    } catch (error) {
      console.error("Profile save failed:", error);
      setProfileError("profile_save_failed");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const openPasswordResetModal = () => {
    setPasswordResetEmail(profile.email || "");
    setPasswordResetError("");
    setIsPasswordResetOpen(true);
  };

  const getPasswordResetErrorMessage = (error) => {
    const rawMessage = String(error?.message || "");
    const message = rawMessage.toLowerCase();
    const code = String(error?.code || "").toLowerCase();
    const status = Number(error?.status || 0);

    if (rawMessage === "supabase_not_configured") {
      return settingsText.supabaseNotConfigured;
    }

    if (rawMessage === "invalid_redirect_url" || message.includes("redirect") || message.includes("url")) {
      return settingsText.invalidRedirectUrl;
    }

    if (status === 429 || code.includes("rate") || message.includes("rate") || message.includes("too many")) {
      return settingsText.resetRateLimited;
    }

    if (message.includes("invalid email") || message.includes("email address") || message.includes("valid email")) {
      return settingsText.emailInvalid;
    }

    if (status === 404 || code.includes("not_found") || message.includes("not found") || message.includes("user not found")) {
      return settingsText.authUserNotFound;
    }

    if (message.includes("smtp") || message.includes("provider") || message.includes("email") || message.includes("send")) {
      return settingsText.resetProviderError;
    }

    return rawMessage || settingsText.resetLinkError;
  };

  const handlePasswordResetSubmit = async (event) => {
    event.preventDefault();
    setPasswordResetError("");

    const trimmedEmail = passwordResetEmail.trim();

    if (!trimmedEmail) {
      setPasswordResetError(settingsText.emailRequired);
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setPasswordResetError(settingsText.emailInvalid);
      return;
    }

    if (profile.email && trimmedEmail.toLowerCase() !== profile.email.toLowerCase()) {
      setPasswordResetError(settingsText.emailMustMatchAccount);
      return;
    }

    setIsPasswordResetSending(true);

    try {
      await sendPasswordResetEmail(trimmedEmail);
      setPasswordResetToast(settingsText.resetLinkSent);
      setPasswordResetEmail("");
      setIsPasswordResetOpen(false);
    } catch (error) {
      setPasswordResetError(getPasswordResetErrorMessage(error));
    } finally {
      setIsPasswordResetSending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
      navigate("/", { replace: true });
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (unreadNotifications === 0 || notifications.length === 0) {
      return;
    }

    setNotificationsError("");

    try {
      const response = await fetch(apiUrl("/notifications/read-all"), {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("notifications_read_all_failed");
      }

      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      console.error("Mark all notifications as read failed:", error);
      setNotificationsError("Notifications could not be marked as read. Please try again.");
    }
  };

  const markNotificationAsRead = async (id) => {
    const notification = notifications.find((item) => item.id === id);

    if (!notification || notification.isRead) {
      return;
    }

    setNotificationsError("");

    try {
      const response = await fetch(apiUrl(`/notifications/${id}/read`), {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("notification_read_failed");
      }

      const data = await response.json();
      const updatedNotification = mapNotificationRow(data);

      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updatedNotification, isRead: true } : item))
      );
    } catch (error) {
      console.error("Mark notification as read failed:", error);
      setNotificationsError("Notification could not be marked as read. Please try again.");
    }
  };

  const startPublicationEdit = (publication) => {
    setEditingPublicationId(publication.id);
    setPublicationDraft(publicationToDraft(publication));
    setPublicationsError("");
  };

  const cancelPublicationEdit = () => {
    setEditingPublicationId("");
    setPublicationDraft(createEmptyPublicationDraft());
  };

  const cancelPublicationEditAndReturn = () => {
    cancelPublicationEdit();
    setActivePage("Te gjithe Artikujt");
  };

  const resetManualPublicationDraft = () => {
    setManualPublicationDraft(createEmptyPublicationDraft());
  };

  const saveManualPublication = async () => {
    setPublicationActionId("manual");
    setPublicationsError("");
    setPublicationSuccessToast("");

    try {
      const response = await fetch(apiUrl("/publications"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPublicationPayload(manualPublicationDraft)),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || t("professor.dashboard.publicationSaveError"));
      }

      resetManualPublicationDraft();
      setPublicationsPage(1);
      await loadPublications({ page: 1, query: searchQuery });
      setPublicationSuccessToast("Artikulli u ruajt me sukses");
    } catch (error) {
      setPublicationsError(error.message || t("professor.dashboard.publicationSaveError"));
    } finally {
      setPublicationActionId("");
    }
  };

  const savePublicationEdit = async (id) => {
    setPublicationActionId(id);
    setPublicationsError("");
    setPublicationSuccessToast("");

    try {
      const response = await fetch(apiUrl(`/publications/${id}`), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPublicationPayload(publicationDraft)),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || t("professor.dashboard.publicationSaveError"));
      }

      cancelPublicationEdit();
      setActivePage("Te gjithe Artikujt");
      await loadPublications({ page: publicationsPage, query: searchQuery });
      setPublicationSuccessToast("Artikulli u ruajt me sukses");
    } catch (error) {
      setPublicationsError(error.message || t("professor.dashboard.publicationSaveError"));
    } finally {
      setPublicationActionId("");
    }
  };

  const resubmitPublication = async (id) => {
    setPublicationActionId(id);
    setPublicationsError("");

    try {
      const response = await fetch(apiUrl(`/publications/${id}/resubmit`), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: "Publikimi u ridergua pas korrigjimit." }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Artikulli nuk u ridërgua.");
      }

      cancelPublicationEdit();
      await Promise.all([
        loadPublications({ page: publicationsPage, query: searchQuery }),
        loadNotifications(),
      ]);
    } catch (error) {
      setPublicationsError(error.message || "Artikulli nuk u ridërgua.");
    } finally {
      setPublicationActionId("");
    }
  };

  const deletePublication = async (id) => {
    const confirmed = window.confirm(t("professor.dashboard.confirmDeletePublication"));

    if (!confirmed) {
      return;
    }

    setPublicationActionId(id);
    setPublicationsError("");

    try {
      const response = await fetch(apiUrl(`/publications/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || t("professor.dashboard.publicationDeleteError"));
      }

      if (editingPublicationId === id) {
        cancelPublicationEdit();
      }

      await loadPublications({ page: publicationsPage, query: searchQuery });
    } catch (error) {
      setPublicationsError(error.message || t("professor.dashboard.publicationDeleteError"));
    } finally {
      setPublicationActionId("");
    }
  };

  const renderStatus = (value) => {
    const statusValue = String(value || "unknown");
    const statusClass = statusValue.toLowerCase().replace(/\s+/g, "-");

    return <span className={`status-badge ${statusClass}`}>{getStatusLabel(statusValue)}</span>;
  };


  const renderOverview = () => {
    const summary = statisticsData.summary;
    const quickStats = [
      {
        label: t("professor.dashboard.activePublications"),
        value: summary.publicationsTotal,
        change: t("professor.dashboard.approvedInReview", {
          approved: summary.publicationsApproved,
          review: summary.publicationsInReview,
        }),
        icon: <BookOpen size={22} />,
      },
      {
        label: t("professor.dashboard.plannedConferences"),
        value: summary.conferencesTotal,
        change: t("professor.dashboard.upcomingCount", { count: summary.upcomingConferences }),
        icon: <CalendarDays size={22} />,
      },
      {
        label: t("professor.dashboard.reimbursementsInProcess"),
        value: summary.reimbursementsInReview,
        change: t("professor.dashboard.approvedTotal", {
          approved: summary.reimbursementsApproved,
          total: summary.reimbursementsTotal,
        }),
        icon: <Wallet size={22} />,
      },
      {
        label: "ORCID",
        value: profile.orcidId ? 1 : 0,
        change: profile.orcidId ? t("professor.dashboard.orcidConnected") : t("common.notConnected"),
        icon: <Link2 size={22} />,
      },
    ];

    const quickActions = [
      { title: t("professor.dashboard.registerPublication"), icon: <BookOpen size={20} />, page: "Publikime" },
      { title: t("professor.dashboard.submitReimbursement"), icon: <Wallet size={20} />, page: "Rimbursime" },
      { title: t("professor.dashboard.planConference"), icon: <CalendarDays size={20} />, page: "Konferenca" },
      { title: t("professor.dashboard.updateProfileAction"), icon: <Settings size={20} />, page: "Settings" },
    ];

    const latestPublications = publications.slice(0, 3).map((item) => ({
      id: item.id,
      icon: <BookOpen size={20} />,
      title: item.title,
      description: [tx(item.journal), item.year].filter(Boolean).join(" | ") || t("professor.dashboard.publicationFromSupabase"),
      time: formatDate(item.createdAt),
    }));

    return (
      <>
        <section className="prof-hero">
          <div>
            <span className="prof-badge">{t("professor.dashboard.heroBadge")}</span>
            <h2>{t("professor.dashboard.greeting", { name: profile.name })}</h2>
            <p>{t("professor.dashboard.heroDescription")}</p>
          </div>
          <div className="prof-hero-actions">
            <button className="primary-btn" type="button" onClick={() => setActivePage("Publikime")}>
              {t("professor.dashboard.managePublications")}
            </button>
            <button className="secondary-btn" type="button" onClick={() => setActivePage("Statistika")}>
              {t("professor.dashboard.viewStats")}
            </button>
          </div>
        </section>

        <section>
          <h3 className="prof-section-title">{t("professor.dashboard.quickView")}</h3>
          <div className="prof-stats-grid">
            {quickStats.map((stat) => (
              <article key={stat.label} className="prof-stat-card">
                <div className="prof-stat-top">
                  <div>
                    <span className="prof-stat-title">{stat.label}</span>
                    <h3>{stat.value}</h3>
                    <p className="prof-stat-change">{stat.change}</p>
                  </div>
                  <div className="prof-stat-icon">{stat.icon}</div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="prof-grid-two">
          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>{t("professor.dashboard.recentActivity")}</h3>
                <p>{t("professor.dashboard.recentActivityDescription")}</p>
              </div>
            </div>
            <div className="prof-list">
              {latestPublications.length ? (
                latestPublications.map((item) => (
                  <div className="prof-list-item" key={item.id}>
                    <div className="prof-list-icon">{item.icon}</div>
                    <div className="prof-list-content">
                      <h4>{item.title}</h4>
                      <p>{item.description}</p>
                    </div>
                    <span className="prof-list-time">{item.time}</span>
                  </div>
                ))
              ) : (
                <div className="prof-stats-empty">
                  {isPublicationsLoading ? t("common.loading") : t("professor.dashboard.noData")}
                </div>
              )}
            </div>
          </article>

          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>{t("professor.dashboard.quickActions")}</h3>
                <p>{t("professor.dashboard.quickActionsDescription")}</p>
              </div>
            </div>
            <div className="prof-quick-grid">
              {quickActions.map((item) => (
                <button
                  key={item.title}
                  className="prof-quick-item"
                  type="button"
                  onClick={() => setActivePage(item.page)}
                >
                  <div className="prof-quick-icon">{item.icon}</div>
                  <h4>{item.title}</h4>
                </button>
              ))}
            </div>
          </article>
        </section>
      </>
    );
  };

  const renderListSection = (title, description, rows, rowKey, formatter, emptyText = t("professor.dashboard.noData")) => (
    <article className="prof-card">
      <div className="prof-card-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="prof-list">
        {rows.length ? (
          rows.map((row) => (
            <div className="prof-list-item" key={row[rowKey]}>
              <div className="prof-list-icon">{formatter.icon}</div>
              <div className="prof-list-content">
                <h4>{formatter.title(row)}</h4>
                <p>{formatter.description(row)}</p>
              </div>
              <div>{formatter.actions ? formatter.actions(row) : renderStatus(formatter.status(row))}</div>
            </div>
          ))
        ) : (
          <div className="prof-stats-empty">{emptyText}</div>
        )}
      </div>
    </article>
  );

  const renderStatistics = () => {
    const summary = statisticsData.summary;
    const statCards = [
      {
        label: t("professor.dashboard.totalPublicationsCard"),
        value: summary.publicationsTotal,
        change: t("professor.dashboard.approvedInReview", {
          approved: summary.publicationsApproved,
          review: summary.publicationsInReview,
        }),
        icon: <BookOpen size={22} />,
      },
      {
        label: t("professor.dashboard.totalConferencesCard"),
        value: summary.conferencesTotal,
        change: "",
        icon: <CalendarDays size={22} />,
      },
      {
        label: t("professor.dashboard.totalReimbursementsCard"),
        value: summary.reimbursementsTotal,
        change: t("professor.dashboard.requestedAmountChange", {
          amount: formatRequestedAmounts(summary.requestedAmounts),
        }),
        icon: <Wallet size={22} />,
      },
    ];

    return (
      <div className="prof-statistics-layout">
        {statisticsError ? (
          <div className="prof-stats-message error" role="alert">
            {formatUiMessage(statisticsError)}
          </div>
        ) : null}

        <section className="prof-stats-grid">
          {statCards.map((stat) => (
            <article key={stat.label} className="prof-stat-card">
              <div className="prof-stat-top">
                <div>
                  <span className="prof-stat-title">{stat.label}</span>
                  <h3>{isStatisticsLoading ? "..." : stat.value}</h3>
                  {stat.change ? <p className="prof-stat-change">{stat.change}</p> : null}
                </div>
                <div className="prof-stat-icon">{stat.icon}</div>
              </div>
            </article>
          ))}
        </section>

        <article className="prof-card prof-stat-chart-card">
          <div className="prof-card-header">
            <div>
              <h3>{t("professor.dashboard.academicStatistics")}</h3>
            </div>
            <div className="prof-filter-wrap">
              <label htmlFor="prof-period-filter">{t("professor.dashboard.period")}</label>
              <select
                id="prof-period-filter"
                className="prof-filter-select"
                value={periodRange}
                onChange={(event) => setPeriodRange(event.target.value)}
              >
                <option value="1m">{t("professor.dashboard.periodOneMonth")}</option>
                <option value="2m">{t("professor.dashboard.periodTwoMonths")}</option>
                <option value="6m">{t("professor.dashboard.periodSixMonths")}</option>
                <option value="12m">{t("professor.dashboard.periodTwelveMonths")}</option>
              </select>
            </div>
          </div>

          {isStatisticsLoading ? (
            <div className="prof-stats-empty">
              <RefreshCw size={18} className="prof-stats-spin" />
              {statisticsData.generatedAt ? t("professor.dashboard.updatingStatistics") : t("professor.dashboard.loadingStatistics")}
            </div>
          ) : statisticsError ? (
            <div className="prof-stats-empty">
              {t("professor.dashboard.statisticsUnavailable")}
            </div>
          ) : normalizedQuery && hasStatisticsChartData && !hasFilteredStatisticsChartData ? (
            <div className="prof-stats-empty">
              {t("professor.dashboard.noSearchResults")}
            </div>
          ) : hasFilteredStatisticsChartData ? (
            <div className="prof-stat-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredStatisticsChartData} barGap={10}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="publikime" name={t("professor.dashboard.publications")} radius={[8, 8, 0, 0]} fill="#153a63" />
                  <Bar dataKey="citime" name={t("professor.dashboard.citations")} radius={[8, 8, 0, 0]} fill="#2e6aa6" />
                  <Bar dataKey="konferenca" name={t("professor.dashboard.conferences")} radius={[8, 8, 0, 0]} fill="#7aa7d3" />
                  <Bar dataKey="rimbursime" name={t("professor.dashboard.reimbursements")} radius={[8, 8, 0, 0]} fill="#c9a24f" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="prof-stats-empty">
              {t("professor.dashboard.noStatsData")}
            </div>
          )}
        </article>

      </div>
    );
  };

  const renderPublicationTitle = (row) => {
    return row.title;
  };

  const getPublicationTypeLabel = (row = {}) => {
    const type = row.publicationType || row.publication_type;

    return type ? t(PUBLICATION_TYPE_LABEL_KEYS[type] || type) : t("common.noData");
  };

  const getPublicationVenueSummary = (row = {}) =>
    row.publishedIn || row.published_in || row.venue || row.journal || t("common.noData");

  const getPublicationYearSummary = (row = {}) => {
    const year = row.publicationYear || row.publication_year || row.year;

    if (year) {
      return year;
    }

    const date = row.publicationDate || row.publication_date;
    const parsedYear = date ? new Date(date).getFullYear() : null;

    if (parsedYear && !Number.isNaN(parsedYear)) {
      return parsedYear;
    }

    const datePrefix = String(date || "").match(/^\d{4}/)?.[0];

    return datePrefix || t("professor.dashboard.noYear");
  };

  const renderPublicationTitleCell = (row = {}) => (
    <div className="publication-title-cell">
      <h4>{renderPublicationTitle(row)}</h4>
      {renderRevisionNotice(row)}
    </div>
  );

  const renderPublicationTextCell = (value, className = "") => (
    <span className={`publication-list-value ${className}`.trim()}>
      {value || "—"}
    </span>
  );

  const formatPublicationAuthors = (authors = []) => {
    const names = authors
      .map((author) => (typeof author === "string" ? author : author.fullName || author.full_name || author.name))
      .filter(Boolean);

    if (!names.length) {
      return t("professor.dashboard.noAuthorsRegistered");
    }

    return (
      <span className="publication-authors-compact" title={names.join(", ")}>
        <span>{names[0]}</span>
        {names.length > 1 ? (
          <span className="publication-author-more-badge">+{names.length - 1} bashkautorë</span>
        ) : null}
      </span>
    );
  };

  const togglePublicationSort = (key) => {
    setPublicationSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "year" ? "desc" : "asc",
      };
    });
  };

  const renderPublicationSortHeader = (key, label) => {
    const isActive = publicationSort.key === key;
    const isAscending = publicationSort.direction === "asc";
    const SortIcon = isActive ? (isAscending ? ChevronUp : ChevronDown) : ChevronsUpDown;

    return (
      <button
        type="button"
        className={`publication-sort-header ${isActive ? "active" : ""}`}
        onClick={() => togglePublicationSort(key)}
        aria-sort={isActive ? (isAscending ? "ascending" : "descending") : "none"}
      >
        <span>{label}</span>
        <SortIcon size={13} aria-hidden="true" />
      </button>
    );
  };

  const getRevisionIssues = (row = {}) => {
    const checklist = row.metadataReviewChecklist || {};
    const labels = {
      doiOk: "DOI",
      titleMatches: "Titulli",
      venueOk: "Journal / Konferenca",
      authorsOk: "Autoret",
      uibmOk: "Perkatesia institucionale UIBM",
      documentsOk: "Dokumentet",
    };

    return Object.entries(labels)
      .filter(([key]) => checklist[key] === false)
      .map(([, label]) => label);
  };

  const renderRevisionNotice = (row = {}) => {
    if (row.status !== "needs_correction" && row.metadataReviewStatus !== "correction") {
      return null;
    }

    const issues = getRevisionIssues(row);

    return (
      <div
        className="publication-revision-badges"
        aria-label={row.metadataReviewComment || "Artikulli kerkon korrigjim"}
        title={row.metadataReviewComment || "Komisioni ka kerkuar perditesim te metadata-s."}
      >
        <span className="publication-revision-badge publication-revision-badge--warning">
          <AlertTriangle size={12} aria-hidden="true" />
          Korrigjim
        </span>
        {issues.map((issue) => (
          <span className="publication-revision-badge" key={issue}>{issue}</span>
        ))}
      </div>
    );
  };

  const renderPublicationActions = (row) => {
    const needsRevision = row.status === "needs_correction" || row.metadataReviewStatus === "correction";
    const editLabel = t("common.edit");
    const deleteLabel = t("common.delete");
    const resubmitLabel = "Ridërgo";
    const renderActionButtons = () => (
      <>
        <button
          type="button"
          className="publication-action-btn publication-action-btn--secondary"
          onClick={() => openPublicationEditForm(row)}
          aria-label={editLabel}
          title={editLabel}
        >
          <Pencil size={15} aria-hidden="true" />
          <span>{editLabel}</span>
        </button>
        <button
          type="button"
          className="publication-action-btn publication-action-btn--danger"
          onClick={() => deletePublication(row.id)}
          disabled={publicationActionId === row.id}
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <Trash2 size={15} aria-hidden="true" />
          <span>{deleteLabel}</span>
        </button>
        {needsRevision ? (
          <button
            type="button"
            className="publication-action-btn publication-action-btn--review"
            onClick={() => openPublicationEditForm(row)}
            disabled={publicationActionId === row.id}
            aria-label={resubmitLabel}
            title={resubmitLabel}
          >
            <Send size={15} aria-hidden="true" />
            <span>{resubmitLabel}</span>
          </button>
        ) : null}
      </>
    );

    return (
      <div className="publication-row-actions">
        <div className="publication-actions-inline" aria-label={t("professor.dashboard.actionsColumn")}>
          {renderActionButtons()}
        </div>
        <details className="publication-actions-menu">
          <summary aria-label={t("professor.dashboard.actionsColumn")} title={t("professor.dashboard.actionsColumn")}>
            <MoreVertical size={16} aria-hidden="true" />
          </summary>
          <div className="publication-actions-menu-list">
            {renderActionButtons()}
          </div>
        </details>
      </div>
    );
  };

  const renderPublicationsSection = () => (
    <article className="prof-card publication-registry-card">
      <div className="prof-card-header publication-registry-header">
        <div>
          <h3>{getPublicationPageTitle(activePage)}</h3>
        </div>
      </div>

      {publicationsError ? (
        <div className="prof-stats-message publication-error-alert" role="alert">{formatUiMessage(publicationsError)}</div>
      ) : null}

      {isPublicationsLoading ? (
        <div className="prof-stats-empty">
          <RefreshCw size={18} className="prof-stats-spin" />
          {t("common.loading")}
        </div>
      ) : filteredPublications.length ? (
        <div className="publication-table" role="table" aria-label={t("professor.dashboard.publicationRegistryTitle")}>
          <div className="publication-table-head" role="row">
            <span>{t("professor.dashboard.publicationNumberColumn")}</span>
            {renderPublicationSortHeader("title", t("professor.dashboard.publicationColumn"))}
            {renderPublicationSortHeader("authors", t("professor.dashboard.authorsColumn"))}
            {renderPublicationSortHeader("type", t("professor.dashboard.publicationTypeColumn"))}
            {renderPublicationSortHeader("venue", t("professor.dashboard.publishedInColumn"))}
            {renderPublicationSortHeader("year", t("professor.dashboard.yearColumn"))}
            <span>{t("professor.dashboard.actionsColumn")}</span>
          </div>
          {sortedPublications.map((row, index) => (
            <div
              className={`publication-table-row ${focusedPublicationId === row.id ? "is-focused" : ""}`}
              id={`publication-row-${row.id}`}
              role="row"
              key={row.id}
            >
              <div className="publication-number-cell" aria-label={t("professor.dashboard.publicationNumberColumn")}>
                {index + 1}
              </div>
              <div className="publication-meta-cell">
                <span className="publication-mobile-label">{t("professor.dashboard.publicationColumn")}</span>
                {renderPublicationTitleCell(row)}
              </div>
              <div className="publication-meta-cell">
                <span className="publication-mobile-label">{t("professor.dashboard.authorsColumn")}</span>
                {formatPublicationAuthors(row.authors)}
              </div>
              <div className="publication-meta-cell">
                <span className="publication-mobile-label">{t("professor.dashboard.publicationTypeColumn")}</span>
                {renderPublicationTextCell(getPublicationTypeLabel(row))}
              </div>
              <div className="publication-meta-cell">
                <span className="publication-mobile-label">{t("professor.dashboard.publishedInColumn")}</span>
                {renderPublicationTextCell(getPublicationVenueSummary(row), "publication-list-value--venue")}
              </div>
              <div className="publication-meta-cell">
                <span className="publication-mobile-label">{t("professor.dashboard.yearColumn")}</span>
                {renderPublicationTextCell(getPublicationYearSummary(row))}
              </div>
              <div className="publication-meta-cell publication-actions-cell">
                <span className="publication-mobile-label">{t("professor.dashboard.actionsColumn")}</span>
                {renderPublicationActions(row)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="prof-stats-empty publication-list-empty" aria-label={t("professor.dashboard.noData")}>—</div>
      )}
    </article>
  );

  const renderPublicationPagination = () => (
    publicationsPagination.totalPages > 1 ? (
      <div className="publication-pagination">
        <button
          type="button"
          className="prof-btn-secondary"
          onClick={() => setPublicationsPage((page) => Math.max(page - 1, 1))}
          disabled={publicationsPagination.page <= 1 || isPublicationsLoading}
        >
          {t("common.back")}
        </button>
        <span className="publication-page-count">
          {t("professor.dashboard.pageOf", {
            page: publicationsPagination.page,
            total: publicationsPagination.totalPages,
          })}
        </span>
        <button
          type="button"
          className="prof-btn-secondary"
          onClick={() => setPublicationsPage((page) => Math.min(page + 1, publicationsPagination.totalPages))}
          disabled={publicationsPagination.page >= publicationsPagination.totalPages || isPublicationsLoading}
        >
          {t("common.next")}
        </button>
      </div>
    ) : null
  );

  const renderContent = () => {
    switch (activePage) {
      case "Overview":
        return renderOverview();
      case "Publikime":
        return (
          <section className="publications-page-shell">
            {editingPublicationId ? (
              <article className="prof-card publication-form-card publication-edit-page-card" id="publication-edit-form">
                <div className="publication-edit-page-header">
                  <button
                    type="button"
                    className="prof-btn-secondary publication-edit-back-btn"
                    onClick={cancelPublicationEditAndReturn}
                    disabled={publicationActionId === editingPublicationId}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t("common.back")}
                  </button>
                  <div className="publication-edit-heading">
                    <span className="publication-edit-kicker">{getPublicationTypeLabel(publicationDraft)}</span>
                    <h3>{t("professor.dashboard.editPublicationTitle")}</h3>
                    <p>{publicationDraft.title || t("professor.dashboard.editPublicationDescription")}</p>
                  </div>
                </div>
                {renderRevisionNotice(publications.find((item) => item.id === editingPublicationId) || publicationDraft)}
                <PublicationForm
                  value={publicationDraft}
                  onChange={setPublicationDraft}
                  onSubmit={() => savePublicationEdit(editingPublicationId)}
                  onCancel={cancelPublicationEditAndReturn}
                  submitLabel={t("professor.dashboard.saveChanges")}
                  submitting={publicationActionId === editingPublicationId}
                  mode="edit"
                  canReview={canReviewPublications}
                  currentUserAuthor={{
                    name: profile.name,
                    orcid: profile.orcidId,
                    affiliation: profile.currentAffiliation || profile.faculty,
                  }}
                />
              </article>
            ) : (
              <article className="prof-card publication-form-card">
                <div className="prof-card-header">
                  <div>
                    <h3>{t("professor.dashboard.addPublicationTitle")}</h3>
                  </div>
                </div>

                <PublicationForm
                  value={manualPublicationDraft}
                  onChange={setManualPublicationDraft}
                  onSubmit={saveManualPublication}
                  submitLabel={t("professor.dashboard.savePublication")}
                  submitting={publicationActionId === "manual"}
                  canReview={canReviewPublications}
                  currentUserAuthor={{
                    name: profile.name,
                    orcid: profile.orcidId,
                    affiliation: profile.currentAffiliation || profile.faculty,
                  }}
                />
              </article>
            )}
          </section>
        );

      case "Artikuj reviste":
      case "Punime të konferencave":
      case "Libra / Kapituj":
      case "Te gjithe Artikujt":
      case "Të gjitha publikimet":
      case "Lista e Publikimeve":
        return (
          <section className="publications-page-shell">
            {renderPublicationsSection()}
            {renderPublicationPagination()}
          </section>
        );

      case "Konferenca":
        return (
          <>
            <article className="prof-card" style={{ marginBottom: "20px" }}>
              <div className="prof-card-header">
                <div>
                  <h3>{t("professor.dashboard.addConferenceTitle")}</h3>
                  <p>{t("professor.dashboard.addConferenceDescription")}</p>
                </div>
              </div>

              <ConferenceManager searchQuery={searchQuery} />
            </article>
          </>
        );

      case "Rimbursime":
        if (activeReimbursementType === "conference") {
          return (
            <section className="prof-card reimbursement-coming-soon" aria-labelledby="reimbursement-f2-title">
              <div className="reimbursement-coming-soon-content">
                <h2 id="reimbursement-f2-title">Në zhvillim</h2>
                <p>
                  Moduli për Konferenca dhe Simpoziume (F2) është aktualisht në proces zhvillimi dhe do të jetë i disponueshëm së shpejti.
                </p>
              </div>
            </section>
          );
        }

        return (
          <ReimbursementManager
            profile={profile}
            searchQuery={searchQuery}
            view="create"
            reimbursementTypeTarget={reimbursementTypeTarget}
            onTypeChange={setActiveReimbursementType}
            onNavigate={handleDashboardNavigate}
          />
        );

      case "Historiku i Rimbursimeve":
        return (
          <ReimbursementManager
            profile={profile}
            searchQuery={searchQuery}
            view="history"
            onNavigate={handleDashboardNavigate}
          />
        );

      case "Statistika":
        return renderStatistics();

      case "Integrime":
        return (
          <article className="prof-card">
            <div className="prof-integration-header">
              <div>
                <h3>{t("professor.dashboard.integrationsTitle")}</h3>
                <p>{t("professor.dashboard.integrationsDescription")}</p>
              </div>
              <button type="button" className="prof-integration-manage-btn" onClick={() => setActivePage("Settings")}>
                {t("professor.dashboard.manage")}
              </button>
            </div>
            <div className="prof-integration-list">
              <article className="prof-integration-item">
                <div className={`prof-integration-mark ${profile.orcidId ? "connected" : "not-connected"}`}>
                  {profile.orcidId ? <CheckCircle2 size={22} /> : <ShieldX size={22} />}
                </div>
                <div className="prof-integration-copy">
                  <h4>ORCID</h4>
                  <p>{profile.orcidId || t("professor.dashboard.noIntegrationData")}</p>
                </div>
                <span className={`status-badge ${profile.orcidId ? "connected" : "not-connected"}`}>
                  {profile.orcidId ? t("common.connected") : t("common.notConnected")}
                </span>
              </article>
            </div>
          </article>
        );

      case "Njoftime":
        return (
          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>{t("topbar.notificationsTitle")}</h3>
                <p>{t("professor.dashboard.notificationsDescription")}</p>
              </div>
              <button
                type="button"
                className="prof-integration-manage-btn"
                onClick={markAllNotificationsAsRead}
                disabled={unreadNotifications === 0 || notifications.length === 0}
              >
                {t("topbar.markAllReadPage")}
              </button>
            </div>
            <div className="prof-notification-list">
              {notificationsError ? (
                <div className="prof-stats-empty" role="alert">{formatUiMessage(notificationsError)}</div>
              ) : isNotificationsLoading ? (
                <div className="prof-stats-empty">
                  <RefreshCw size={18} className="prof-stats-spin" />
                  {t("professor.dashboard.loadingNotifications")}
                </div>
              ) : notifications.length ? (
                notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`prof-notification-item ${item.isRead ? "neutral" : "info"}`}
                    onClick={() => markNotificationAsRead(item.id)}
                  >
                    <div className="prof-notification-item-head">
                      <span className="prof-notification-pill">{item.category || t("topbar.notificationsAriaLabel")}</span>
                      <span>{item.createdAt}</span>
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.message}</p>
                  </button>
                ))
              ) : (
                <div className="prof-stats-empty">{t("topbar.emptyNotifications")}</div>
              )}
            </div>
          </article>
        );

      case "Settings":
        return (
          <div className="prorector-table-section">
            <h2>{settingsText.pageTitle}</h2>
            <p>{settingsText.pageDescription}</p>

            <div className="prorector-settings-grid">
              {/* Card: Profile information */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <Settings size={20} />
                  </div>
                  <h3>{settingsText.profileTitle}</h3>
                </div>
                <div className="prorector-settings-list">
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.fullName}</span>
                    <strong className="prorector-settings-value">{profile.name}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.academicTitle}</span>
                    <strong className="prorector-settings-value">{profile.role}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.emailAddress}</span>
                    <strong className="prorector-settings-value">{profile.email}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.orcidId}</span>
                    <strong className="prorector-settings-value">{profile.orcidId || settingsText.notConnected}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.orcidSchool}</span>
                    <strong className="prorector-settings-value">{profile.school || settingsText.noPublicData}</strong>
                  </div>
                  <button className="prorector-settings-edit-btn" onClick={() => handleMenuAction("EditProfile")}>
                    {settingsText.updateProfile}
                  </button>
                </div>
              </article>

              {/* Card: System preferences */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <BookOpen size={20} />
                  </div>
                  <h3>{settingsText.systemTitle}</h3>
                </div>
                <div className="prorector-settings-options">
                  <div className="prorector-settings-option-item">
                    <div className="prorector-settings-option-info">
                      <span className="prorector-settings-label">{settingsText.emailLabel}</span>
                      <p className="prorector-settings-subtext">{settingsText.emailSubtext}</p>
                      <p className="prorector-settings-subtext">
                        {systemPreferences.emailNotifications
                          ? settingsText.enabledStatus
                          : settingsText.disabledStatus}
                      </p>
                    </div>
                    <label className="prorector-switch">
                      <input
                        type="checkbox"
                        checked={systemPreferences.emailNotifications}
                        aria-label={settingsText.emailLabel}
                        onChange={(event) => updateSystemPreference("emailNotifications", event.target.checked)}
                      />
                      <span className="prorector-slider"></span>
                    </label>
                  </div>

                  <div className="prorector-settings-option-item">
                    <div className="prorector-settings-option-info">
                      <span className="prorector-settings-label">{settingsText.languageLabel}</span>
                      <p className="prorector-settings-subtext">{settingsText.languageSubtext}</p>
                    </div>
                    <select
                      className="prorector-settings-select"
                      value={language}
                      aria-label={settingsText.languageLabel}
                      onChange={(event) => updateSystemPreference("language", event.target.value)}
                    >
                      <option value="sq">{settingsText.albanian}</option>
                      <option value="en">{settingsText.english}</option>
                    </select>
                  </div>
                  {systemPreferencesMessage ? (
                    <p className="prorector-settings-subtext" role="status" aria-live="polite">
                      {systemPreferencesMessage}
                    </p>
                  ) : null}
                </div>
              </article>

              {/* Card: Security */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <ShieldX size={20} />
                  </div>
                  <h3>{settingsText.securityTitle}</h3>
                </div>
                <div className="prorector-settings-list">
                  <p className="prorector-settings-subtext">{settingsText.securityDescription}</p>
                  <button
                    type="button"
                    className="prorector-settings-action-btn"
                    onClick={openPasswordResetModal}
                  >
                    {settingsText.changePassword}
                  </button>
                </div>
              </article>

              {/* Card: API and integrations */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <Link2 size={20} />
                  </div>
                  <h3>{settingsText.integrationsTitle}</h3>
                </div>
                <div className="prorector-settings-list">
                  <p className="prorector-settings-subtext">{settingsText.integrationsDescription}</p>
                  <button
                    type="button"
                    className="prorector-settings-action-btn"
                    onClick={() => {
                      window.location.href = apiUrl("/orcid/connect");
                    }}
                  >
                    {profile.orcidId ? settingsText.refreshOrcid : settingsText.connectOrcid}
                  </button>
                  <button className="prorector-settings-action-btn" onClick={() => setActivePage("Integrime")}>
                    {settingsText.viewIntegrations}
                  </button>
                </div>
              </article>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="prof-layout">
      <Sidebar
        activePage={activePage}
        activeReimbursementType={activeReimbursementType}
        onNavigate={handleDashboardNavigate}
        onLogout={handleLogout}
      />

      <div className="prof-main">
        <TopBar
          activePage={pageTitle}
          profile={profile}
          menuItems={translatedProfileMenuItems}
          notificationCount={unreadNotifications}
          onMenuAction={handleMenuAction}
          searchQuery={searchQuery}
          onSearchChange={(nextQuery) => {
            setSearchQuery(nextQuery);
            setFocusedPublicationId("");
          }}
          searchResults={publicationSearchResults}
          onSearchResultSelect={openPublicationSearchResult}
          notifications={notifications}
          onMarkAllRead={markAllNotificationsAsRead}
          onNotificationAction={markNotificationAsRead}
          onNotificationsOpen={() => loadNotifications({ showLoading: false })}
          searchPlaceholder={searchPlaceholder}
          notificationsAriaLabel={t("topbar.notificationsAriaLabel")}
          notificationsTitle={t("topbar.notificationsTitle")}
          unreadLabel={t("topbar.unreadLabel")}
          markAllReadLabel={t("topbar.markAllRead")}
          emptyNotificationsLabel={t("topbar.emptyNotifications")}
          profileDialogLabel={t("topbar.profileDialog")}
        />

        <div className="prof-content">{renderContent()}</div>
      </div>

      {passwordResetToast ? (
        <div className="prof-toast success" role="status" aria-live="polite">
          {passwordResetToast}
        </div>
      ) : null}

      {publicationSuccessToast ? (
        <div className="publication-save-alert-overlay publication-save-alert-overlay--success" role="dialog" aria-modal="true" aria-live="polite">
          <div className="publication-save-alert publication-save-alert--success">
            <p>{publicationSuccessToast}</p>
            <button type="button" onClick={() => setPublicationSuccessToast("")}>
              Mbyll
            </button>
          </div>
        </div>
      ) : null}

      {activePage === "Publikime" && publicationsError ? (
        <div className="publication-save-alert-overlay" role="alertdialog" aria-modal="true" aria-live="assertive">
          <div className="publication-save-alert">
            <p>{formatUiMessage(publicationsError)}</p>
            <button type="button" onClick={() => setPublicationsError("")}>
              Mbyll
            </button>
          </div>
        </div>
      ) : null}

      {isEditProfileOpen ? (
        <div className="prof-modal-overlay prof-profile-edit-overlay" role="dialog" aria-modal="true">
          <div className="prof-modal prof-profile-edit-modal">
            <div className="prof-modal-header">
              <div>
                <h3 className="prof-modal-title">{settingsText.editProfileTitle}</h3>
                <p className="prof-modal-subtitle">{settingsText.editProfileSubtitle}</p>
              </div>
              <button
                className="prof-modal-close"
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                aria-label={settingsText.closeModal}
              >
                ×
              </button>
            </div>
            <form className="prof-modal-form" onSubmit={handleProfileSave}>
              <p className="prof-modal-note">
                {settingsText.profileNote}
              </p>
              <section className="prof-profile-photo-editor">
                <div className="prof-profile-photo-preview" aria-hidden="true">
                  {profileDraft.profilePhotoUrl ? (
                    <img src={profileDraft.profilePhotoUrl} alt="" />
                  ) : (
                    <span>{getProfileInitials(profileDraft)}</span>
                  )}
                </div>
                <div className="prof-profile-photo-content">
                  <h4>{settingsText.profilePhotoTitle}</h4>
                  <div className="prof-profile-photo-actions">
                    <label className="prof-profile-photo-upload-btn">
                      <Camera size={16} />
                      <span>{settingsText.profilePhotoUpload}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleProfilePhotoChange}
                      />
                    </label>
                    {profileDraft.profilePhotoUrl ? (
                      <button type="button" className="prof-profile-photo-remove-btn" onClick={handleProfilePhotoRemove}>
                        <Trash2 size={15} />
                        <span>{settingsText.profilePhotoRemove}</span>
                      </button>
                    ) : null}
                  </div>
                  {profilePhotoError ? <p className="prof-profile-photo-error" role="alert">{profilePhotoError}</p> : null}
                </div>
              </section>
              <div className="prof-form-grid">
                <label className="prof-form-field">
                  <span>{settingsText.nameAndSurname}</span>
                  <input value={profileDraft.name} readOnly aria-readonly="true" />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.role}</span>
                  <input value={profileDraft.role} readOnly aria-readonly="true" />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.email}</span>
                  <input type="email" value={profileDraft.email} readOnly aria-readonly="true" />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.orcidId}</span>
                  <input value={profileDraft.orcidId || settingsText.notConnected} readOnly aria-readonly="true" />
                </label>
                <label className="prof-form-field prof-profile-unit-field">
                  <span>{settingsText.faculty}</span>
                  <select value={profileDraft.faculty} onChange={handleProfileFacultyChange}>
                    <option value="">{settingsText.facultySelectPlaceholder}</option>
                    {hasLegacyFaculty ? (
                      <option value={profileDraft.faculty}>{profileDraft.faculty}</option>
                    ) : null}
                    {FACULTY_OPTIONS.map((faculty) => (
                      <option key={faculty} value={faculty}>{faculty}</option>
                    ))}
                  </select>
                </label>
                <label className="prof-form-field prof-profile-unit-field">
                  <span>{settingsText.department}</span>
                  <select
                    value={profileDraft.department}
                    onChange={handleProfileFieldChange("department")}
                    disabled={!profileDraft.faculty}
                  >
                    <option value="">{settingsText.departmentSelectPlaceholder}</option>
                    {hasLegacyDepartment ? (
                      <option value={profileDraft.department}>{profileDraft.department}</option>
                    ) : null}
                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.academicTitle}</span>
                  <select value={profileDraft.academicTitle} onChange={handleProfileFieldChange("academicTitle")}>
                    {ACADEMIC_TITLE_OPTIONS.map((title) => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.scientificTitle}</span>
                  <select value={profileDraft.scientificTitle} onChange={handleProfileFieldChange("scientificTitle")}>
                    {SCIENTIFIC_TITLE_OPTIONS.map((title) => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="prof-orcid-details">
                  {profileDraft.orcidProfile?.biography || profileDraft.orcidProfile?.keywords?.length || profileDraft.orcidProfile?.researcherUrls?.length ? (
                    <div>
                      <h4>{settingsText.orcidDetails}</h4>
                      {profileDraft.orcidProfile?.biography ? <p>{profileDraft.orcidProfile.biography}</p> : null}
                      {profileDraft.orcidProfile?.keywords?.length ? (
                        <p>{settingsText.keywords}: {profileDraft.orcidProfile.keywords.slice(0, 8).join(", ")}</p>
                      ) : null}
                      {profileDraft.orcidProfile?.researcherUrls?.slice(0, 3).map((item) => (
                        <p key={`url-${item.url || item.name}`}>{[item.name, item.url].filter(Boolean).join(" | ")}</p>
                      ))}
                    </div>
                  ) : null}
                  {Array.isArray(profileDraft.education) && profileDraft.education.length ? (
                    <div>
                      <h4>{settingsText.orcidEducation}</h4>
                      <div className="prof-education-list">
                        {profileDraft.education.map(renderProfileEducationEntry)}
                      </div>
                      <button type="button" className="prof-orcid-add-btn" onClick={addProfileEducationEntry}>
                        {settingsText.addEducation}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h4>{settingsText.orcidEducation}</h4>
                      <p className="prof-orcid-empty">{settingsText.educationEmpty}</p>
                      <button type="button" className="prof-orcid-add-btn" onClick={addProfileEducationEntry}>
                        {settingsText.addEducation}
                      </button>
                    </div>
                  )}
                  {profileDraft.orcidEmployments.length ? (
                    <div>
                      <h4>{settingsText.orcidEmployment}</h4>
                      {profileDraft.orcidEmployments.slice(0, 3).map((item) => (
                        <p key={`employment-${item.putCode || formatAffiliation(item)}`}>{formatAffiliation(item)}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              <section className="prof-bank-accounts-section">
                <div className="prof-bank-accounts-header">
                  <div>
                    <h4>{settingsText.bankAccountsTitle}</h4>
                    <p>{settingsText.bankAccountsDescription}</p>
                  </div>
                </div>
                {bankAccountsError ? (
                  <p className="prof-modal-error" role="alert">{bankAccountsError}</p>
                ) : isBankAccountsLoading ? (
                  <p className="prof-bank-empty">{t("common.loading")}</p>
                ) : bankAccounts.length ? (
                  <div className="prof-bank-account-list">
                    {bankAccounts.map((account) => {
                      const cardBank = getProfileBankCardLogoBank(account);
                      const bankDisplayName = getLocalizedProfileBankDisplayName(account.bankName, language);

                      return (
                        <article className="prof-bank-account-card" key={account.id}>
                          {cardBank?.logoSrc ? (
                            <span className="prof-bank-account-logo">
                              <img src={cardBank.logoSrc} alt={`${cardBank.name} logo`} />
                            </span>
                          ) : null}
                          <div className="prof-bank-account-main">
                            <div className="prof-bank-account-title-row">
                              <strong>{bankDisplayName || settingsText.bankAccountsTitle}</strong>
                              {account.isDefault ? <span className="prof-bank-default-badge">{settingsText.bankDefaultBadge}</span> : null}
                            </div>
                            <p>{[maskBankAccount(account.iban || account.bankAccountNumber), account.swiftCode, account.currency].filter(Boolean).join(" | ")}</p>
                          </div>
                          <div className="prof-bank-account-card-actions">
                            {!account.isDefault ? (
                              <button
                                type="button"
                                className="prof-bank-text-btn"
                                onClick={() => handleBankAccountSetDefault(account.id)}
                                disabled={bankAccountActionId === account.id}
                              >
                                {settingsText.bankSetDefault}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="prof-bank-text-btn"
                              onClick={() => startBankAccountEdit(account)}
                              disabled={bankAccountActionId === account.id}
                            >
                              {settingsText.bankEdit}
                            </button>
                            <button
                              type="button"
                              className="prof-bank-danger-btn"
                              onClick={() => requestBankAccountDelete(account)}
                              disabled={bankAccountActionId === account.id}
                            >
                              {settingsText.bankDelete}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="prof-bank-empty">{settingsText.bankAccountsEmpty}</p>
                )}
                <div className="prof-bank-account-form">
                  <h5>{editingBankAccountId ? settingsText.bankAccountEditTitle : settingsText.bankAccountAddTitle}</h5>
                  <div className="prof-bank-account-grid">
                    <label className="prof-form-field">
                      <span>{settingsText.bankAccountNumber}</span>
                      <input value={bankAccountDraft.bankAccountNumber} onChange={handleBankAccountDraftChange("bankAccountNumber")} />
                      {detectedProfileBank ? (
                        <small className="prof-bank-detected-message">{settingsText.bankAutoDetected}</small>
                      ) : null}
                    </label>
                    <label className="prof-form-field">
                      <span>{settingsText.bankName}</span>
                      <input value={bankAccountDraftDisplayName} onChange={handleBankAccountDraftChange("bankName")} />
                    </label>
                    <label className="prof-form-field">
                      <span>{settingsText.bankSwift}</span>
                      <input value={bankAccountDraft.swiftCode} onChange={handleBankAccountDraftChange("swiftCode")} />
                    </label>
                    <label className="prof-form-field">
                      <span>{settingsText.bankCountry}</span>
                      <input value={bankAccountDraft.bankCountry} onChange={handleBankAccountDraftChange("bankCountry")} />
                    </label>
                  </div>
                  <label className="prof-bank-default-toggle">
                    <input type="checkbox" checked={bankAccountDraft.isDefault} onChange={handleBankAccountDraftChange("isDefault")} />
                    <span>{settingsText.bankDefault}</span>
                  </label>
                  <div className="prof-bank-form-actions">
                    {editingBankAccountId ? (
                      <button type="button" className="prof-btn-secondary" onClick={resetBankAccountDraft} disabled={Boolean(bankAccountActionId)}>
                        {settingsText.bankCancelEdit}
                      </button>
                    ) : null}
                    <button type="button" className="prof-btn-primary" onClick={handleBankAccountSave} disabled={Boolean(bankAccountActionId)}>
                      {isBankAccountSaving ? settingsText.saving : editingBankAccountId ? settingsText.bankUpdate : settingsText.bankSave}
                    </button>
                  </div>
                </div>
              </section>
              {profileError ? <p className="prof-modal-error" role="alert">{settingsText.profileSaveError}</p> : null}
              {!profileDraft.orcidId ? (
                <button type="button" className="prof-orcid-link-btn" onClick={() => handleMenuAction("OrcidConnect")}>
                  {settingsText.linkOrcidForAutofill}
                </button>
              ) : null}
              <div className="prof-modal-actions">
                <button type="button" className="prof-btn-secondary" onClick={() => setIsEditProfileOpen(false)} disabled={isProfileSaving}>
                  {settingsText.cancel}
                </button>
                <button type="submit" className="prof-btn-primary" disabled={isProfileSaving}>
                  {isProfileSaving ? settingsText.saving : settingsText.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {bankAccountDeleteTarget ? (
        <div
          className="prof-modal-overlay prof-bank-delete-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bank-delete-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeBankAccountDeleteModal();
            }
          }}
        >
          <div className="prof-modal prof-bank-delete-modal">
            <div className="prof-bank-delete-icon" aria-hidden="true">
              <AlertTriangle size={22} />
            </div>
            <div className="prof-bank-delete-content">
              <h3 className="prof-modal-title" id="bank-delete-title">{settingsText.bankDeleteTitle}</h3>
              <p className="prof-modal-subtitle">{settingsText.bankDeleteMessage}</p>
              <div className="prof-bank-delete-summary">
                <p>
                  <span>{settingsText.bankName}</span>
                  <strong>{getLocalizedProfileBankDisplayName(bankAccountDeleteTarget.bankName, language) || "-"}</strong>
                </p>
                <p>
                  <span>{settingsText.bankAccountNumber}</span>
                  <strong>{maskBankAccount(bankAccountDeleteTarget.iban || bankAccountDeleteTarget.bankAccountNumber) || "-"}</strong>
                </p>
              </div>
              {bankAccountDeleteTarget.isDefault ? (
                <p className="prof-bank-delete-warning">{settingsText.bankDeleteDefaultWarning}</p>
              ) : null}
              <div className="prof-modal-actions prof-bank-delete-actions">
                <button
                  type="button"
                  className="prof-btn-secondary"
                  onClick={closeBankAccountDeleteModal}
                  disabled={Boolean(bankAccountActionId)}
                  ref={bankAccountDeleteCancelRef}
                >
                  {settingsText.cancel}
                </button>
                <button
                  type="button"
                  className="prof-btn-danger"
                  onClick={handleBankAccountDelete}
                  disabled={Boolean(bankAccountActionId)}
                >
                  {bankAccountActionId === bankAccountDeleteTarget.id ? settingsText.saving : settingsText.bankDeleteConfirmAction}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isPasswordResetOpen ? (
        <div className="prof-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
          <div className="prof-modal prof-password-reset-modal">
            <div className="prof-modal-header">
              <div>
                <h3 className="prof-modal-title" id="password-reset-title">{settingsText.changePassword}</h3>
                <p className="prof-modal-subtitle">{settingsText.changePasswordSubtitle}</p>
              </div>
              <button
                className="prof-modal-close"
                type="button"
                onClick={() => setIsPasswordResetOpen(false)}
                aria-label={settingsText.closeModal}
                disabled={isPasswordResetSending}
              >
                ×
              </button>
            </div>

            <form className="prof-modal-form" onSubmit={handlePasswordResetSubmit}>
              <label className="prof-form-field">
                <span>{settingsText.enterEmail}</span>
                <input
                  type="email"
                  value={passwordResetEmail}
                  autoComplete="email"
                  onChange={(event) => setPasswordResetEmail(event.target.value)}
                  disabled={isPasswordResetSending}
                  required
                />
              </label>

              {passwordResetError ? <p className="prof-modal-error" role="alert">{passwordResetError}</p> : null}
              <div className="prof-modal-actions">
                <button
                  type="button"
                  className="prof-btn-secondary"
                  onClick={() => setIsPasswordResetOpen(false)}
                  disabled={isPasswordResetSending}
                >
                  {settingsText.cancel}
                </button>
                <button
                  type="submit"
                  className="prof-btn-primary"
                  disabled={isPasswordResetSending || !passwordResetEmail.trim()}
                >
                  {isPasswordResetSending ? settingsText.sendingResetLink : settingsText.sendResetLink}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
