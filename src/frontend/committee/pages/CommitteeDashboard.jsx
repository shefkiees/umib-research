import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, Bell, CheckCircle2, CircleUserRound, Clock3, Database, Eye, FileText, GitCompareArrows, LogOut, Settings } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
} from "recharts";
import "../styles/CommitteeDashboard.css";
import CommitteeSidebar from "../components/CommitteeSidebar";
import CommitteeTopBar from "../components/CommitteeTopBar";
import CommitteeSettings from "./CommitteeSettings";
import ReimbursementReviewPanel from "../../common/ReimbursementReviewPanel";
import { apiUrl } from "../../utils/api";

const navLabels = ["Përmbledhje", "Dorëzimet në Pritje", "Shqyrtimi", "Metadata", "Vendimet", "Auditimi", "Raporte"];

const publicationStatusLabels = {
  draft: "Draft",
  submitted: "Në pritje",
  in_review: "Në shqyrtim",
  needs_correction: "Korrigjim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
};

const reimbursementStatusLabels = {
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

const publicationTypeLabels = {
  journal_article: "Artikull në Revistë Shkencore",
  conference_paper: "Punim Konference",
  book: "Libër",
  book_chapter: "Kapitull Libri",
};

const committeeChecklistStatuses = [
  "Pa kontrolluar",
  "Në rregull",
  "Korrigjuar nga Komisioni",
  "Kërkon korrigjim",
  "Nuk aplikohet",
];

const f1CommitteeChecklistGroups = [
  {
    title: "Verifikimi i Aplikantit",
    items: [
      "Emri dhe mbiemri",
      "Fakulteti",
      "Departamenti",
      "ORCID",
      "Thirrja akademike",
      "Thirrja shkencore",
    ],
  },
  {
    title: "Verifikimi i Publikimit",
    items: [
      "Titulli i artikullit",
      "Lloji i publikimit",
      "DOI",
      "Revista / Burimi i publikimit",
      "Data e publikimit",
      "Autori kryesor",
      "Autori korrespondent",
      "Bashkëautorët",
      "Affiliation UIBM",
    ],
  },
  {
    title: "Verifikimi i Indeksimit",
    items: [
      "ISSN / ISBN",
      "Platforma e indeksimit",
      "Kategoria e indeksimit",
      "Kuartili",
      "Impact Factor / CiteScore",
    ],
  },
  {
    title: "Verifikimi i Dokumenteve",
    items: [
      "Formulari F1 PDF",
      "Formulari F1 DOCX",
      "Artikulli i ngarkuar",
      "Dëshmia e regjistrimit në databazën UIBM",
      "Dokumentet shtesë",
    ],
  },
  {
    title: "Verifikimi Financiar",
    items: [
      "Emri në bankë",
      "Banka",
      "IBAN / Llogaria",
      "SWIFT",
      "Shuma e kërkuar",
    ],
  },
];

const f2CommitteeChecklistGroups = [
  {
    title: "Verifikimi i Aplikantit",
    items: [
      "Emri dhe mbiemri",
      "Fakulteti",
      "Departamenti",
      "ORCID",
      "Thirrja akademike",
      "Thirrja shkencore",
    ],
  },
  {
    title: "Verifikimi i Konferencës",
    items: [
      "Emri i konferencës / simpoziumit",
      "Organizatori",
      "Lokacioni",
      "Data e ngjarjes",
      "Faqja zyrtare / linku i ngjarjes",
    ],
  },
  {
    title: "Verifikimi i Punimit dhe Pjesëmarrjes",
    items: [
      "Titulli i punimit / abstraktit",
      "Abstrakti / prezantimi",
      "Autori kryesor",
      "Bashkëpjesëmarrësit",
      "Lloji i pjesëmarrjes",
      "Affiliation UIBM",
    ],
  },
  {
    title: "Verifikimi i Dokumenteve",
    items: [
      "Formulari F2 PDF",
      "Formulari F2 DOCX",
      "Programi i ngjarjes",
      "Letra e pranimit / ftesa",
      "Dëshmia e pranimit të abstraktit / punimit",
      "Dokumentet shtesë",
    ],
  },
  {
    title: "Verifikimi Financiar",
    items: [
      "Biletat e udhëtimit",
      "Faturat e biletave",
      "Fatura e akomodimit",
      "Fatura e regjistrimit",
      "Emri në bankë",
      "Banka",
      "IBAN / Llogaria",
      "SWIFT",
      "Shuma e kërkuar",
    ],
  },
];

const METADATA_REVIEW_STORAGE_KEY = "committeeMetadataReviewWorkflow";

const metadataReviewStatuses = {
  unchecked: {
    label: "Pa kontrolluar",
    description: "Publikimi nuk është hapur ende për kontroll metadata.",
    className: "is-neutral",
    Icon: Clock3,
  },
  in_review: {
    label: "Në kontroll",
    description: "Komisioni ka nisur kontrollin e metadata-s.",
    className: "is-info",
    Icon: Eye,
  },
  ok: {
    label: "Metadata OK",
    description: "Metadata është kontrolluar dhe është në rregull.",
    className: "is-ok",
    Icon: CheckCircle2,
  },
  correction: {
    label: "Kërkon korrigjim",
    description: "Publikimi kërkon korrigjim nga profesori.",
    className: "is-warning",
    Icon: AlertTriangle,
  },
};

const metadataReviewFilterOptions = [
  { value: "all", label: "Të gjitha" },
  { value: "issues", label: "Me mungesa" },
  { value: "missing-doi", label: "Pa DOI / link" },
  { value: "missing-uibm", label: "Pa perkatesi institucionale UIBM" },
  { value: "in_review", label: "Në kontroll" },
  { value: "ready", label: "Gati për aprovim" },
  { value: "correction", label: "Kërkon korrigjim" },
];

const metadataSortOptions = [
  { value: "priority", label: "Prioriteti" },
  { value: "newest", label: "Më të rejat" },
  { value: "ready", label: "Gati për aprovim" },
  { value: "title", label: "Titulli A-Z" },
];

const standardMetadataChecklistItems = [
  { key: "doiOk", label: "DOI OK" },
  { key: "titleMatches", label: "Titulli përputhet me dokumentin" },
  { key: "venueOk", label: "Journal / Konferenca OK" },
  { key: "authorsOk", label: "Autorët OK" },
  { key: "uibmOk", label: "Perkatesia institucionale UIBM OK" },
  { key: "documentsOk", label: "Dokumentet OK" },
];

const journalArticleMetadataChecklistItems = [
  { key: "doiOk", category: "Identifikimi", label: "DOI / link burimor", hint: "DOI ose linku burimor hap artikullin e sakte." },
  { key: "titleMatches", category: "Identifikimi", label: "Titulli perputhet", hint: "Titulli ne sistem perputhet me DOI-ne ose dokumentin." },
  { key: "journalNameOk", category: "Revista", label: "Emri i revistes", hint: "Revista eshte e shenuar qarte dhe perputhet me burimin." },
  { key: "publisherOk", category: "Revista", label: "Botuesi / publisher", hint: "Botuesi eshte i shenuar kur merret nga DOI ose dokumenti." },
  { key: "publicationDateOk", category: "Revista", label: "Viti / data e publikimit", hint: "Viti ose data e publikimit eshte e verifikueshme." },
  { key: "authorsOk", category: "Autoret", label: "Autoret dhe bashkautoret", hint: "Lista e autoreve eshte e plote dhe e lexueshme." },
  { key: "uibmOk", category: "Autoret", label: "Affiliation UIBM", hint: "Se paku nje autor lidhet me Universitetin Isa Boletini ne Mitrovice." },
  { key: "issnOk", category: "Bibliografia", label: "ISSN / eISSN", hint: "ISSN ose eISSN eshte i regjistruar kur ekziston ne metadata." },
  { key: "volumeIssuePagesOk", category: "Bibliografia", label: "Volume / issue / faqe", hint: "Te dhenat bibliografike jane te shenuara kur ekzistojne." },
  { key: "abstractOk", category: "Bibliografia", label: "Abstrakti", hint: "Abstrakti eshte i pranishem kur ofrohet nga burimi." },
  { key: "indexingOk", category: "Indeksimi", label: "Indeksimi i kontrolluar", hint: "Burimi i indeksimit eshte kontrolluar per artikullin." },
  { key: "quartileMetricsOk", category: "Indeksimi", label: "Quartile / SJR / CiteScore / Impakt", hint: "Metrikat ruhen vetem kur ekzistojne nga burim i besueshem." },
  { key: "documentsOk", category: "Dokumenti", label: "Dokumenti / linku hapet", hint: "Dokumenti ose linku mbeshtetes hapet per verifikim." },
];

const conferenceMetadataChecklistItems = [
  { key: "doiOk", category: "Identifikimi", label: "DOI / link i verifikueshem", hint: "DOI ose linku burimor hap materialin perkates." },
  { key: "titleMatches", category: "Identifikimi", label: "Emri i punimit / abstraktit", hint: "Titulli ne sistem perputhet me dokumentin." },
  { key: "form2Ok", category: "Aplikimi", label: "Formulari 2", hint: "Formulari 2 eshte i bashkangjitur." },
  { key: "abstractPresentationOk", category: "Aplikimi", label: "Prezantimi / abstrakti", hint: "Abstrakti ose prezantimi eshte i verifikueshem." },
  { key: "eventNameOk", category: "Ngjarja shkencore", label: "Emri i konferences", hint: "Emri i ngjarjes shkencore eshte i shenuar qarte." },
  { key: "eventDateOk", category: "Ngjarja shkencore", label: "Data dhe vendi i ngjarjes", hint: "Data, periudha ose lokacioni jane te verifikueshme." },
  { key: "presentationPurposeOk", category: "Ngjarja shkencore", label: "Qellimi i pjesemarrjes", hint: "Roli si prezantues, foles ose instruktor eshte i qarte." },
  { key: "programEvidenceOk", category: "Deshmite shkencore", label: "Programi i ngjarjes", hint: "Ekziston deshmi per programin e konferences." },
  { key: "acceptanceDocumentOk", category: "Deshmite shkencore", label: "Pranimi i punimit / abstraktit", hint: "Dokumenti i pranimit eshte i bashkangjitur." },
  { key: "invitationLetterOk", category: "Deshmite shkencore", label: "Letra e fteses / pranimit", hint: "Letra e fteses ose pranimit per prezantim ekziston." },
  { key: "uibmOk", category: "Deshmite shkencore", label: "Affiliation UIBM", hint: "Punimi lidhet me Universitetin Isa Boletini ne Mitrovice." },
  { key: "speakerInvitationOk", category: "Arsyetimi institucional", label: "Ftesa si foles / instruktor", hint: "Dokumenti e lidh kandidatin me rolin e folesit ose instruktorit." },
  { key: "benefitLetterOk", category: "Arsyetimi institucional", label: "Letra e perfitimit shkencor", hint: "Dekani ose shefi i departamentit e arsyeton perfitimin per UIBM." },
  { key: "deadlineOk", category: "Arsyetimi institucional", label: "Afati 1 muaj para ngjarjes", hint: "Kerkesa ne ZBN eshte dorezuar brenda afatit." },
  { key: "travelTicketsOk", category: "Shpenzimet", label: "Biletat e udhetimit", hint: "Biletat e udhetimit jane te bashkangjitura." },
  { key: "ticketInvoicesOk", category: "Shpenzimet", label: "Faturat e biletave", hint: "Faturat per biletat jane te dokumentuara." },
  { key: "accommodationInvoiceOk", category: "Shpenzimet", label: "Fatura e akomodimit", hint: "Akomodimi eshte i dokumentuar me fature." },
  { key: "registrationInvoiceOk", category: "Shpenzimet", label: "Fatura e regjistrimit", hint: "Pagesa e regjistrimit te ngjarjes shkencore eshte e dokumentuar." },
];

const correctionExamples = [
  "Mungon emri i revistes ose nuk perputhet me DOI.",
  "Mungon ISSN/eISSN ose te dhenat bibliografike.",
  "Mungon verifikimi i indeksimit / metrikave te revistes.",
  "Mungon Formulari 2 ose abstrakti/prezantimi.",
  "Mungon programi ose pranimi i punimit/abstraktit.",
  "Mungon letra e perfitimit shkencor per UIBM.",
  "Mungon deshmia e dorezimit ne ZBN ose afati 1 muaj para ngjarjes.",
  "Mungon data/vendi i ngjarjes shkencore ose qellimi i pjesemarrjes.",
  "Mungojne faturat ose dokumentet e shpenzimeve.",
  "Mungon perkatesia institucionale UIBM",
  "DOI nuk përputhet me titullin",
  "Journal nuk është i saktë",
  "Dokumenti i ngarkuar nuk është i plotë",
];

function normalizeCommitteeProfile(user = {}) {
  const displayName = user.name || user.displayName || user.full_name || user.fullName || user.email || "Komision";

  return {
    name: displayName,
    role: "Komision",
    systemRole: String(user.role || "").trim().toLowerCase(),
    email: user.email || "",
    unit: user.department || user.faculty || "Komision",
  };
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("sq-AL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getDateTimestamp(value) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getDecisionStatusClass(status) {
  if (["approved", "committee_approved", "ok", "paid"].includes(status)) {
    return "is-ok";
  }

  if (["rejected"].includes(status)) {
    return "is-danger";
  }

  if (["needs_correction", "correction"].includes(status)) {
    return "is-warning";
  }

  if (["received", "in_review"].includes(status)) {
    return "is-info";
  }

  return "is-neutral";
}

function getShortUnitLabel(value) {
  const text = String(value || "Pa njësi").trim();
  const knownUnits = [
    { pattern: /mekanike|kompjuterike|fimc/i, label: "FIMC" },
    { pattern: /teknologj.*ushqimore|ftu/i, label: "FTU" },
    { pattern: /gjeoshkenc|fg/i, label: "FG" },
    { pattern: /juridik|fj/i, label: "FJ" },
    { pattern: /ekonomik|fe/i, label: "FE" },
    { pattern: /edukim|fed/i, label: "FED" },
  ];
  const match = knownUnits.find((unit) => unit.pattern.test(text));

  if (match) {
    return match.label;
  }

  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 5)
    .toUpperCase() || "N/A";
}

function getRequestUnit(request = {}) {
  return request.owner?.faculty || request.owner?.department || "Pa njësi";
}

function getPublicationUnit(publication = {}) {
  const uibmAuthor = getPublicationAuthors(publication).find((author) => hasUibmAffiliation({ authors: [author] }));

  return uibmAuthor?.affiliation || publication.venue || publication.publisher || "Pa njësi";
}

function getRequestType(request = {}) {
  return request.requestType || request.requestData?.requestType || "";
}

function getPendingRequestTypeDisplay(request = {}) {
  const requestType = getRequestType(request);

  if (requestType === "publication") {
    return {
      badge: "F1",
      label: "Artikull Shkencor",
      className: "is-f1",
    };
  }

  if (requestType === "conference") {
    return {
      badge: "F2",
      label: "Konferencë / Simpozium",
      className: "is-f2",
    };
  }

  return {
    badge: requestType ? requestType.toUpperCase() : "-",
    label: request.requestTypeLabel || requestType || "-",
    className: "is-neutral",
  };
}

function splitMetadataNames(value) {
  return String(value || "")
    .split(/;|\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getReviewShellConfig(request = {}) {
  const requestType = getRequestType(request);

  if (requestType === "publication") {
    return {
      badge: "F1",
      title: "Shqyrtimi i Kërkesës për Artikull Shkencor (F1)",
      description: "Pamje vetëm për lexim për shqyrtimin fillestar të kërkesës për rimbursim.",
      typeLabel: "F1 / Artikull Shkencor / Publikim Shkencor",
      supported: true,
    };
  }

  if (requestType === "conference") {
    return {
      badge: "F2",
      title: "Shqyrtimi i Kërkesës për Konferencë dhe Simpozium (F2)",
      description: "Pamje vetëm për lexim për shqyrtimin fillestar të kërkesës për rimbursim.",
      typeLabel: "F2 / Konferencë dhe Simpozium",
      supported: true,
    };
  }

  return {
    badge: requestType ? requestType.toUpperCase() : "N/A",
    title: "Unsupported reimbursement review",
    description: "This first workflow step is currently available only for F1 and F2 requests.",
    typeLabel: request.requestTypeLabel || requestType || "-",
    supported: false,
  };
}

function getCommitteeDocumentUrl(url = "") {
  if (!url) {
    return "";
  }

  return apiUrl(url.replace(/^\/api/, ""));
}

function normalizeForSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getPublicationAuthors(publication) {
  return Array.isArray(publication?.authors) ? publication.authors : [];
}

function getAuthorName(author) {
  return author?.fullName || author?.full_name || author?.name || "";
}

function getAuthorAffiliation(author) {
  return author?.affiliation || "";
}

function hasUibmAffiliation(publication) {
  const text = getPublicationAuthors(publication)
    .map((author) => getAuthorAffiliation(author))
    .join(" ");

  return /uibm|isa boletini|universiteti.*mitrovic|university.*mitrovic/i.test(text);
}

function getMetadataStatus(publication) {
  if (publication.metadataVerified || publication.metadata_verified) return "Nga DOI";
  if (publication.doi) return "DOI pa verifikim";
  return "Manual";
}

function getPublicationTypeLabel(value) {
  return publicationTypeLabels[value] || value || "-";
}

function getPublicationStatusLabel(value) {
  return publicationStatusLabels[value] || value || "-";
}

function getMetadataItemStatusLabel(item = {}) {
  if (item.statusLabel || item.status_label) {
    return item.statusLabel || item.status_label;
  }

  if (item.sourceType === "reimbursement") {
    return reimbursementStatusLabels[item.status] || item.status || "-";
  }

  return getPublicationStatusLabel(item.status);
}

function getMetadataItemTypeLabel(item = {}) {
  return item.requestTypeLabel || item.request_type_label || getPublicationTypeLabel(item.publicationType || item.publication_type);
}

function getPublicationType(publication = {}) {
  return publication.publicationType || publication.publication_type || "";
}

function isConferencePublication(publication = {}) {
  return getPublicationType(publication) === "conference_paper";
}

function isJournalArticlePublication(publication = {}) {
  return getPublicationType(publication) === "journal_article";
}

function getMetadataChecklistItems(publication = {}) {
  if (isConferencePublication(publication)) {
    return conferenceMetadataChecklistItems;
  }

  if (isJournalArticlePublication(publication)) {
    return journalArticleMetadataChecklistItems;
  }

  return standardMetadataChecklistItems;
}

function getChecklistTypeLabel(publication = {}) {
  if (isConferencePublication(publication)) {
    return "Checklist konferenca";
  }

  if (isJournalArticlePublication(publication)) {
    return "Checklist artikull reviste";
  }

  return "Checklist standard";
}

function getPublicationEvidenceItems(publication = {}) {
  const evidence = Array.isArray(publication?.evidenceLinks) && publication.evidenceLinks.length
    ? publication.evidenceLinks
    : publication?.attachments || [];
  return Array.isArray(evidence) ? evidence : [];
}

function getPublicationEvidenceText(publication = {}) {
  return getPublicationEvidenceItems(publication)
    .map((item) => [
      item?.label,
      item?.description,
      item?.documentType,
      item?.document_type,
      item?.fileType,
      item?.file_type,
      item?.name,
      item?.fileName,
      item?.file_name,
      item?.url,
      item?.fileUrl,
      item?.file_url,
    ].filter(Boolean).join(" "))
    .join(" ");
}

function getPublicationIndexingItems(publication = {}) {
  return Array.isArray(publication.indexing) ? publication.indexing : [];
}

function hasIndexingEvidence(publication = {}) {
  return Boolean(
    publication.indexingPlatform
    || publication.indexing_platform
    || publication.indexingVerified
    || publication.indexing_verified
    || getPublicationIndexingItems(publication).some((item) =>
      item?.source
      || item?.platform
      || item?.category
      || item?.quartile
      || item?.sjr
      || item?.citeScore
      || item?.cite_score
      || item?.impactFactor
      || item?.impact_factor
    )
  );
}

function hasJournalMetricEvidence(publication = {}) {
  return Boolean(
    publication.quartile
    || publication.sjr
    || publication.citeScore
    || publication.cite_score
    || publication.impactFactor
    || publication.impact_factor
    || getPublicationIndexingItems(publication).some((item) =>
      item?.quartile
      || item?.sjr
      || item?.citeScore
      || item?.cite_score
      || item?.impactFactor
      || item?.impact_factor
    )
  );
}

function evidenceMatches(publication, patterns = []) {
  const evidenceText = normalizeForSearch(getPublicationEvidenceText(publication));
  return patterns.some((pattern) => normalizeForSearch(pattern).split("|").some((part) => part && evidenceText.includes(part)));
}

function getPublicationDocumentUrl(publication) {
  const evidence = getPublicationEvidenceItems(publication);
  const firstDocument = evidence.find((item) => item?.url || item?.fileUrl || item?.file_url);

  return firstDocument?.url || firstDocument?.fileUrl || firstDocument?.file_url || publication?.sourceUrl || publication?.source_url || "";
}

function hasMetadataIdentifier(publication = {}) {
  return Boolean(publication.doi || publication.sourceUrl || publication.source_url);
}

function getConferenceEventValue(publication = {}) {
  return publication.eventDate
    || publication.event_date
    || publication.conferenceLocation
    || publication.conference_location
    || publication.publicationDate
    || publication.publication_date
    || "";
}

function inferChecklistValue(publication, key) {
  const hasDocument = Boolean(getPublicationDocumentUrl(publication));

  switch (key) {
    case "doiOk":
      return Boolean(publication?.doi || publication?.sourceUrl || publication?.source_url);
    case "titleMatches":
      return Boolean(publication?.title);
    case "venueOk":
    case "eventNameOk":
      return Boolean(publication?.venue || publication?.publishedIn || publication?.published_in || publication?.publisher);
    case "journalNameOk":
      return Boolean(publication?.venue || publication?.publishedIn || publication?.published_in);
    case "publisherOk":
      return Boolean(publication?.publisher);
    case "publicationDateOk":
      return Boolean(publication?.publicationYear || publication?.publication_year || publication?.publicationDate || publication?.publication_date || publication?.year);
    case "eventDateOk":
      return Boolean(getConferenceEventValue(publication));
    case "presentationPurposeOk":
      return Boolean(publication?.presentationPurpose || publication?.presentation_purpose) || evidenceMatches(publication, ["qellim|purpose|prezantuese|presenter|prezantues"]);
    case "authorsOk":
      return getPublicationAuthors(publication).length > 0;
    case "uibmOk":
      return hasUibmAffiliation(publication);
    case "documentsOk":
      return hasDocument;
    case "issnOk":
      return Boolean(publication?.issn || publication?.eissn || publication?.eIssn);
    case "volumeIssuePagesOk":
      return Boolean(publication?.volume || publication?.issue || publication?.pages || publication?.pageStart || publication?.page_start || publication?.pageEnd || publication?.page_end);
    case "abstractOk":
      return Boolean(publication?.abstract);
    case "indexingOk":
      return hasIndexingEvidence(publication);
    case "quartileMetricsOk":
      return hasJournalMetricEvidence(publication);
    case "abstractPresentationOk":
      return Boolean(publication?.abstract) || evidenceMatches(publication, ["abstrakt|abstract|prezantim|presentation"]);
    case "form2Ok":
      return evidenceMatches(publication, ["formulari 2|form 2|f2"]);
    case "programEvidenceOk":
      return evidenceMatches(publication, ["program"]);
    case "acceptanceDocumentOk":
      return evidenceMatches(publication, ["pranim|acceptance|accepted"]);
    case "invitationLetterOk":
      return evidenceMatches(publication, ["ftes|invitation|invite"]);
    case "speakerInvitationOk":
      return evidenceMatches(publication, ["foles|speaker|instruktor|instructor"]);
    case "benefitLetterOk":
      return evidenceMatches(publication, ["perfitim|benefit|dekan|department|departament|shef"]);
    case "deadlineOk":
      return evidenceMatches(publication, ["zbn|afat|deadline|1 muaj|one month|60 dite|60 days"]);
    case "travelTicketsOk":
      return evidenceMatches(publication, ["bilet|ticket"]);
    case "ticketInvoicesOk":
      return evidenceMatches(publication, ["fature bilete|ticket invoice|invoice ticket"]);
    case "accommodationInvoiceOk":
      return evidenceMatches(publication, ["akomod|hotel|accommodation"]);
    case "registrationInvoiceOk":
      return evidenceMatches(publication, ["regjistrim|registration|fee"]);
    default:
      return false;
  }
}

const reimbursementDocumentTypeLabels = {
  article_pdf: "Punimi shkencor PDF",
  uibm_database_evidence: "Deshmia e regjistrimit ne databazen UIBM",
  acceptance_letter: "Letra e pranimit",
  conference_program: "Programi i konferences",
  presentation_evidence: "Deshmi prezantimi",
  financial_document: "Dokument financiar / fature",
  other: "Dokument tjeter",
};

function createMetadataEvidenceItem({ label, value, url, documentType, filename }) {
  const cleanLabel = String(label || "").trim();
  const cleanValue = String(value || "").trim();
  const cleanUrl = String(url || "").trim();
  const safeUrl = /^(https?:\/\/|\/api\/|\/reimbursements\/|\/publications\/)/i.test(cleanUrl) ? cleanUrl : "";

  if (!cleanValue && !safeUrl && !filename) {
    return null;
  }

  return {
    label: cleanLabel || reimbursementDocumentTypeLabels[documentType] || "Dokument",
    name: filename || cleanValue || cleanLabel || cleanUrl,
    description: cleanValue,
    documentType: documentType || null,
    document_type: documentType || null,
    url: safeUrl,
    fileUrl: safeUrl,
    file_url: safeUrl,
  };
}

function mapReimbursementAttachmentToEvidence(request, attachment = {}) {
  const documentType = attachment.documentType || attachment.document_type || "";
  const downloadUrl = attachment.downloadUrl || attachment.url || attachment.fileUrl || attachment.file_url
    || (attachment.id && request.id ? `/api/reimbursements/${request.id}/attachments/${attachment.id}` : "");

  return createMetadataEvidenceItem({
    label: reimbursementDocumentTypeLabels[documentType] || documentType || attachment.filename || "Dokument mbeshtetes",
    value: attachment.filename || documentType,
    url: downloadUrl,
    documentType,
    filename: attachment.filename || attachment.fileName || attachment.file_name || "",
  });
}

function mapReimbursementToMetadataItem(request = {}) {
  const requestType = getRequestType(request);

  if (!["publication", "conference"].includes(requestType)) {
    return null;
  }

  const data = request.requestData || {};
  const isConference = requestType === "conference";
  const ownerName = request.owner?.name || request.owner?.email || data.applicantName || "";
  const affiliation = data.affiliation
    || data.authorsAffiliation
    || data.applicantFaculty
    || request.owner?.faculty
    || request.owner?.department
    || "";
  const coauthorNames = splitMetadataNames(data.coauthors || data.coParticipant);
  const authors = [
    {
      fullName: data.mainAuthor || data.bankApplicantName || data.applicantName || ownerName,
      affiliation,
    },
    data.correspondingAuthor ? { fullName: data.correspondingAuthor, affiliation } : null,
    ...coauthorNames.map((name) => ({ fullName: name, affiliation })),
  ].filter((author) => author?.fullName);
  const title = isConference
    ? (data.abstractTitle || data.conferenceTitle || request.title || "Konference / simpozium")
    : (data.publicationTitle || data.title || request.title || "Artikull shkencor");
  const venue = isConference
    ? (data.conferenceTitle || data.eventName || data.organizer || "")
    : (data.venue || data.journal || data.publishedIn || data.published_in || data.publisher || "");
  const sourceUrl = data.publicationLink || data.conferenceLink || data.eventPublicationLink || data.sourceUrl || "";
  const eventValue = isConference
    ? [data.conferenceDate || data.eventPlaceDate, data.location || data.conferenceLocation].filter(Boolean).join(" / ")
    : (data.conferencePresentationDate || data.conferenceLocation || "");
  const presentationPurpose = [
    data.speakerWithPaperPoster,
    data.chairPanelist,
    data.artisticSportEvent,
    data.participationType,
  ].filter(Boolean).join(" / ");
  const formEvidenceLabel = isConference ? "Formulari 2 i rimbursimit" : "Formulari 1 i rimbursimit";
  const attachments = Array.isArray(request.attachments) ? request.attachments : [];
  const evidenceLinks = [
    createMetadataEvidenceItem({ label: formEvidenceLabel, value: `${formEvidenceLabel} PDF`, url: request.downloadUrl, documentType: "generated_pdf" }),
    createMetadataEvidenceItem({ label: formEvidenceLabel, value: `${formEvidenceLabel} DOCX`, url: request.docxDownloadUrl, documentType: "generated_docx" }),
    createMetadataEvidenceItem({ label: "DOI ose link i publikimit", value: data.publicationLink || data.doi, url: data.publicationLink, documentType: "publication_link" }),
    createMetadataEvidenceItem({ label: "Ftesa dhe programi", value: data.invitationProgram, url: data.invitationProgram, documentType: "conference_program" }),
    createMetadataEvidenceItem({ label: "Abstrakti / prezantimi", value: data.abstract || data.abstractTitle, documentType: "presentation_evidence" }),
    createMetadataEvidenceItem({ label: "Konfirmimi i pranimit", value: data.acceptanceConfirmation, url: data.acceptanceConfirmation, documentType: "acceptance_letter" }),
    createMetadataEvidenceItem({ label: "Deshmia e databazes UIBM", value: data.uibmDatabaseEvidence, url: data.uibmDatabaseEvidence, documentType: "uibm_database_evidence" }),
    ...attachments.map((attachment) => mapReimbursementAttachmentToEvidence(request, attachment)),
  ].filter(Boolean);
  const reviewChecklist = request.metadataReviewChecklist || request.metadata_review_checklist
    || data.metadataReviewChecklist || data.metadata_review_checklist || {};
  const reviewStatus = request.metadataReviewStatus || request.metadata_review_status
    || data.metadataReviewStatus || data.metadata_review_status || "unchecked";
  const reviewComment = request.metadataReviewComment || request.metadata_review_comment
    || data.metadataReviewComment || data.metadata_review_comment || "";
  const reviewHistory = request.reviewHistory || request.review_history
    || data.metadataReviewHistory || data.metadata_review_history || [];

  return {
    ...data,
    id: `reimbursement-${request.id}`,
    sourceType: "reimbursement",
    sourceLabel: "Rimbursim",
    reimbursementId: request.id,
    owner: request.owner,
    requestType,
    requestTypeLabel: request.requestTypeLabel || (isConference ? "Konference / Simpozium" : "Artikull shkencor"),
    title,
    doi: data.doi || "",
    venue,
    publisher: data.publisher || data.organizer || "",
    publicationType: isConference ? "conference_paper" : (data.publicationType || "journal_article"),
    publication_type: isConference ? "conference_paper" : (data.publicationType || "journal_article"),
    publicationDate: data.publicationDate || data.conferenceDate || data.conferencePresentationDate || request.submittedAt || request.createdAt || "",
    publication_date: data.publicationDate || data.conferenceDate || data.conferencePresentationDate || request.submittedAt || request.createdAt || "",
    publicationYear: data.publicationYear || "",
    publication_year: data.publicationYear || "",
    sourceUrl,
    source_url: sourceUrl,
    conferenceLocation: data.conferenceLocation || data.location || eventValue,
    conference_location: data.conferenceLocation || data.location || eventValue,
    eventDate: data.conferenceDate || data.conferencePresentationDate || data.eventPlaceDate || "",
    event_date: data.conferenceDate || data.conferencePresentationDate || data.eventPlaceDate || "",
    presentationPurpose,
    presentation_purpose: presentationPurpose,
    abstract: data.abstract || data.abstractTitle || "",
    volume: data.volume || "",
    issue: data.issue || "",
    pages: data.pages || "",
    issn: data.issn || "",
    isbn: data.isbn || "",
    indexingPlatform: data.indexingPlatform || "",
    indexingCategory: data.indexingCategory || "",
    impactFactor: data.impactFactor || "",
    scopusQuartile: data.scopusQuartile || "",
    authors,
    evidenceLinks,
    attachments: evidenceLinks,
    status: request.status,
    statusLabel: request.statusLabel || reimbursementStatusLabels[request.status] || request.status || "",
    status_label: request.statusLabel || reimbursementStatusLabels[request.status] || request.status || "",
    metadataSource: "rimbursim",
    metadata_source: "rimbursim",
    metadataVerified: false,
    metadata_verified: false,
    metadataReviewStatus: reviewStatus,
    metadata_review_status: reviewStatus,
    metadataReviewChecklist: reviewChecklist,
    metadata_review_checklist: reviewChecklist,
    metadataReviewComment: reviewComment,
    metadata_review_comment: reviewComment,
    reviewHistory,
    review_history: reviewHistory,
    documentNumber: request.documentNumber || "",
    amount: request.amount,
    currency: request.currency,
    submittedAt: request.submittedAt,
    submitted_at: request.submittedAt,
    updatedAt: request.updatedAt,
    updated_at: request.updatedAt,
    createdAt: request.createdAt,
    created_at: request.createdAt,
  };
}

function createDefaultChecklist(publication) {
  return getMetadataChecklistItems(publication).reduce((checklist, item) => ({
    ...checklist,
    [item.key]: inferChecklistValue(publication, item.key),
  }), {});
}

function createInitialReview(publication) {
  return {
    status: "unchecked",
    checklist: createDefaultChecklist(publication),
    comment: "",
    history: [],
  };
}

function getChecklistEvidenceText(publication = {}, key) {
  const sourceUrl = publication.sourceUrl || publication.source_url || "";
  const documentCount = getPublicationEvidenceItems(publication).length;
  const conferenceEvent = getConferenceEventValue(publication);
  const authors = getPublicationAuthors(publication);

  switch (key) {
    case "doiOk":
      if (publication.doi) return `DOI: ${publication.doi}`;
      if (sourceUrl) return "Link burimor i regjistruar";
      return "Mungon DOI ose linku burimor";
    case "titleMatches":
      return publication.title ? "Titulli është i regjistruar" : "Mungon titulli";
    case "venueOk":
    case "eventNameOk":
      return publication.venue || publication.publishedIn || publication.published_in
        ? `Burimi: ${publication.venue || publication.publishedIn || publication.published_in}`
        : "Mungon emri i journal/konferencës";
    case "journalNameOk":
      return publication.venue || publication.publishedIn || publication.published_in
        ? `Revista: ${publication.venue || publication.publishedIn || publication.published_in}`
        : "Mungon emri i revistës";
    case "publisherOk":
      return publication.publisher ? `Publisher: ${publication.publisher}` : "Publisher mungon";
    case "publicationDateOk":
      return publication.publicationYear || publication.publication_year || publication.publicationDate || publication.publication_date || publication.year
        ? `Data/viti: ${publication.publicationYear || publication.publication_year || formatDate(publication.publicationDate || publication.publication_date) || publication.year}`
        : "Mungon viti/data";
    case "eventDateOk":
      return conferenceEvent ? `Data/vendi: ${conferenceEvent}` : "Mungon data ose vendi i ngjarjes";
    case "presentationPurposeOk":
      return inferChecklistValue(publication, key) ? "Qëllimi/roli u gjet në metadata ose dokumente" : "Mungon qëllimi i pjesëmarrjes";
    case "authorsOk":
      return authors.length ? `${authors.length} autorë të regjistruar` : "Mungojnë autorët";
    case "uibmOk":
      return hasUibmAffiliation(publication) ? "Affiliation UIBM u gjet" : "Mungon affiliation UIBM";
    case "documentsOk":
      return documentCount ? `${documentCount} dokument/e mbështetëse` : "Mungon dokument mbështetës";
    case "issnOk":
      return publication.issn || publication.eissn || publication.eIssn ? `ISSN/eISSN: ${publication.issn || publication.eissn || publication.eIssn}` : "Mungon ISSN/eISSN";
    case "volumeIssuePagesOk":
      return publication.volume || publication.issue || publication.pages || publication.pageStart || publication.page_start || publication.pageEnd || publication.page_end
        ? [publication.volume ? `Vol. ${publication.volume}` : "", publication.issue ? `Issue ${publication.issue}` : "", publication.pages || publication.pageStart || publication.page_start ? `Faqe ${publication.pages || [publication.pageStart || publication.page_start, publication.pageEnd || publication.page_end].filter(Boolean).join("-")}` : ""].filter(Boolean).join(" | ")
        : "Mungojnë volume/issue/faqe";
    case "abstractOk":
    case "abstractPresentationOk":
      return publication.abstract ? "Abstrakti është i regjistruar" : inferChecklistValue(publication, key) ? "Dëshmi për abstrakt/prezantim u gjet në dokumente" : "Mungon abstrakti/prezantimi";
    case "indexingOk":
      return hasIndexingEvidence(publication) ? "Indeksimi ka të dhëna" : "Mungon dëshmia e indeksimit";
    case "quartileMetricsOk":
      return hasJournalMetricEvidence(publication) ? "Metrikat janë të regjistruara" : "Mungojnë quartile/SJR/CiteScore/Impakt";
    case "form2Ok":
      return inferChecklistValue(publication, key) ? "Formulari 2 u gjet në dokumente" : "Mungon Formulari 2";
    case "programEvidenceOk":
      return inferChecklistValue(publication, key) ? "Programi u gjet në dokumente" : "Mungon programi i ngjarjes";
    case "acceptanceDocumentOk":
      return inferChecklistValue(publication, key) ? "Pranimi u gjet në dokumente" : "Mungon dokumenti i pranimit";
    case "invitationLetterOk":
      return inferChecklistValue(publication, key) ? "Ftesa/pranimi për prezantim u gjet" : "Mungon ftesa ose pranimi";
    case "speakerInvitationOk":
      return inferChecklistValue(publication, key) ? "Roli folës/instruktor u gjet" : "Mungon dëshmia për rolin";
    case "benefitLetterOk":
      return inferChecklistValue(publication, key) ? "Letra e përfitimit u gjet" : "Mungon letra e përfitimit shkencor";
    case "deadlineOk":
      return inferChecklistValue(publication, key) ? "Afati/ZBN u gjet në dokumente" : "Mungon dëshmia për afatin/ZBN";
    case "travelTicketsOk":
      return inferChecklistValue(publication, key) ? "Biletat u gjetën" : "Mungojnë biletat";
    case "ticketInvoicesOk":
      return inferChecklistValue(publication, key) ? "Faturat e biletave u gjetën" : "Mungojnë faturat e biletave";
    case "accommodationInvoiceOk":
      return inferChecklistValue(publication, key) ? "Fatura e akomodimit u gjet" : "Mungon fatura e akomodimit";
    case "registrationInvoiceOk":
      return inferChecklistValue(publication, key) ? "Fatura e regjistrimit u gjet" : "Mungon fatura e regjistrimit";
    default:
      return inferChecklistValue(publication, key) ? "U gjet në metadata/dokumente" : "Nuk u gjet automatikisht";
  }
}

function getMetadataReviewInsights(publication = {}, review = createInitialReview(publication)) {
  const checklistItems = getMetadataChecklistItems(publication);
  const checklist = review?.checklist || createDefaultChecklist(publication);
  const autoChecklist = createDefaultChecklist(publication);
  const checkedItems = checklistItems.filter((item) => checklist[item.key]);
  const autoDetectedItems = checklistItems.filter((item) => autoChecklist[item.key]);
  const missingItems = checklistItems.filter((item) => !checklist[item.key]);
  const total = checklistItems.length || 1;
  const score = Math.round((checkedItems.length / total) * 100);
  const autoScore = Math.round((autoDetectedItems.length / total) * 100);

  return {
    score,
    autoScore,
    checked: checkedItems.length,
    autoDetected: autoDetectedItems.length,
    missing: missingItems.length,
    total: checklistItems.length,
    missingItems,
    isReady: missingItems.length === 0,
  };
}

function getMetadataPriorityScore(publication = {}, review = createInitialReview(publication)) {
  const insights = getMetadataReviewInsights(publication, review);
  let score = insights.missing * 12;

  if (!hasMetadataIdentifier(publication)) score += 22;
  if (!hasUibmAffiliation(publication)) score += 22;
  if (!getPublicationDocumentUrl(publication)) score += 14;
  if (review.status === "correction") score += 28;
  if (review.status === "in_review") score += 10;
  if (review.status === "ok") score -= 60;

  return score;
}

function getMetadataPriorityLabel(publication = {}, review = createInitialReview(publication)) {
  const priority = getMetadataPriorityScore(publication, review);

  if (review.status === "ok") {
    return { label: "Verifikuar", className: "is-low" };
  }

  if (priority >= 55) {
    return { label: "Prioritet i lartë", className: "is-high" };
  }

  if (priority >= 24) {
    return { label: "Duhet kontroll", className: "is-medium" };
  }

  return { label: "Afër aprovimit", className: "is-low" };
}

function buildMetadataCorrectionComment(publication, review) {
  const insights = getMetadataReviewInsights(publication, review);

  if (!insights.missingItems.length) {
    return "";
  }

  return `Ju lutem plotësoni/korrigjoni këto pika: ${insights.missingItems.map((item) => item.label).join(", ")}.`;
}

function mapMetadataReviewFromPublication(publication) {
  const checklist = publication?.metadataReviewChecklist || publication?.metadata_review_checklist || createDefaultChecklist(publication);
  const history = publication?.reviewHistory || publication?.review_history || [];

  return {
    status: publication?.metadataReviewStatus || publication?.metadata_review_status || "unchecked",
    checklist: { ...createDefaultChecklist(publication), ...checklist },
    comment: publication?.metadataReviewComment || publication?.metadata_review_comment || "",
    history: history.map((entry) => ({
      id: entry.id || `${entry.created_at || entry.createdAt}-${entry.status}`,
      actor: entry.actor_name || entry.actorName || "UMIBRes",
      status: entry.status || "unchecked",
      statusLabel: getReviewStatusConfig(entry.status).label,
      comment: entry.comment || "",
      checklist: entry.checklist || {},
      createdAt: entry.created_at || entry.createdAt,
    })),
  };
}

function getReviewCompleteness(review, publication) {
  const checklist = review?.checklist || createDefaultChecklist(publication);
  const checklistItems = getMetadataChecklistItems(publication);
  const checkedCount = checklistItems.filter((item) => checklist[item.key]).length;

  return {
    checkedCount,
    total: checklistItems.length,
    isComplete: checkedCount === checklistItems.length,
  };
}

function getReviewStatusConfig(status) {
  return metadataReviewStatuses[status] || metadataReviewStatuses.unchecked;
}

function formatReviewDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("sq-AL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function CommitteeDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("Përmbledhje");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [selectedReimbursementReview, setSelectedReimbursementReview] = useState(null);
  const [reviewRequests, setReviewRequests] = useState([]);
  const [isPendingSubmissionsLoading, setIsPendingSubmissionsLoading] = useState(true);
  const [pendingSubmissionsError, setPendingSubmissionsError] = useState("");
  const [metadataPublications, setMetadataPublications] = useState([]);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState("");
  const [selectedMetadataPublication, setSelectedMetadataPublication] = useState(null);
  const [metadataReviewFilter, setMetadataReviewFilter] = useState("all");
  const [metadataSort, setMetadataSort] = useState("priority");
  const [metadataReviews, setMetadataReviews] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(METADATA_REVIEW_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });
  const [correctionComment, setCorrectionComment] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [metadataDrawerMode, setMetadataDrawerMode] = useState("details");
  const [committeeProfile, setCommitteeProfile] = useState({
    name: "Komision",
    role: "Komision",
    systemRole: "",
    email: "",
    unit: "Komision",
  });
  const [committeeDraft, setCommitteeDraft] = useState({
    name: "Komision",
    role: "Komision",
    systemRole: "",
    email: "",
    unit: "Komision",
  });
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const normalizedQuery = normalizeForSearch(searchQuery.trim());

  useEffect(() => {
    let isMounted = true;

    const loadCommitteeProfile = async () => {
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
        const nextProfile = normalizeCommitteeProfile(data.user || {});

        if (isMounted) {
          setCommitteeProfile(nextProfile);
          setCommitteeDraft(nextProfile);
        }
      } catch (error) {
        console.error("Committee profile load failed:", error);
      }
    };

    loadCommitteeProfile();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadPendingSubmissions = async () => {
      setIsPendingSubmissionsLoading(true);
      setPendingSubmissionsError("");

      try {
        const response = await fetch(apiUrl("/reimbursements?scope=all"), {
          credentials: "include",
        });

        if (response.status === 401) {
          throw new Error("Sesioni nuk eshte aktiv.");
        }

        if (!response.ok) {
          throw new Error("Dorëzimet në pritje nuk u ngarkuan nga databaza.");
        }

        const data = await response.json();
        const rows = Array.isArray(data) ? data : [];

        if (isMounted) {
          setReviewRequests(rows);
          setPendingSubmissions(rows.filter((item) => item.status === "submitted"));
        }
      } catch (error) {
        if (isMounted) {
          setReviewRequests([]);
          setPendingSubmissions([]);
          setPendingSubmissionsError(error.message || "Dorëzimet në pritje nuk u ngarkuan.");
        }
      } finally {
        if (isMounted) {
          setIsPendingSubmissionsLoading(false);
        }
      }
    };

    loadPendingSubmissions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(METADATA_REVIEW_STORAGE_KEY, JSON.stringify(metadataReviews));
  }, [metadataReviews]);

  useEffect(() => {
    let isMounted = true;

    const loadMetadataPublications = async () => {
      setIsMetadataLoading(true);
      setMetadataError("");

      try {
        const response = await fetch(apiUrl("/publications?scope=review&limit=50"), {
          credentials: "include",
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "Metadata e publikimeve nuk u ngarkua.");
        }

        if (isMounted) {
          const rows = Array.isArray(data.data) ? data.data : [];
          setMetadataPublications(rows);
          setMetadataReviews((prev) => rows.reduce((reviews, publication) => ({
            ...reviews,
            [publication.id]: mapMetadataReviewFromPublication(publication),
          }), prev));
        }
      } catch (error) {
        if (isMounted) {
          setMetadataPublications([]);
          setMetadataError(error.message || "Metadata e publikimeve nuk u ngarkua.");
        }
      } finally {
        if (isMounted) {
          setIsMetadataLoading(false);
        }
      }
    };

    loadMetadataPublications();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPendingSubmissions = useMemo(() => {
    if (!normalizedQuery) {
      return pendingSubmissions;
    }

    return pendingSubmissions.filter((item) => {
      const row = [
        item.documentNumber,
        item.id,
        item.title,
        item.requestTypeLabel,
        item.owner?.name,
        item.owner?.email,
        item.owner?.faculty,
        item.owner?.department,
        item.statusLabel,
      ].filter(Boolean).join(" ").toLowerCase();

      return row.includes(normalizedQuery);
    });
  }, [normalizedQuery, pendingSubmissions]);

  const reimbursementMetadataItems = useMemo(() =>
    reviewRequests
      .map((request) => mapReimbursementToMetadataItem(request))
      .filter(Boolean),
  [reviewRequests]);

  const metadataQueueItems = useMemo(() => [
    ...metadataPublications.map((publication) => ({
      ...publication,
      sourceType: publication.sourceType || "publication",
      sourceLabel: publication.sourceLabel || "Publikim",
    })),
    ...reimbursementMetadataItems,
  ], [metadataPublications, reimbursementMetadataItems]);

  useEffect(() => {
    if (!reimbursementMetadataItems.length) {
      return;
    }

    setMetadataReviews((prev) => reimbursementMetadataItems.reduce((reviews, item) => ({
      ...reviews,
      [item.id]: mapMetadataReviewFromPublication(item),
    }), prev));
  }, [reimbursementMetadataItems]);

  const filteredMetadataPublications = useMemo(() => {
    const filteredByReview = metadataQueueItems.filter((item) => {
      const review = metadataReviews[item.id] || mapMetadataReviewFromPublication(item);
      const completeness = getReviewCompleteness(review, item);

      if (metadataReviewFilter === "issues") return !hasMetadataIdentifier(item) || !hasUibmAffiliation(item) || !completeness.isComplete;
      if (metadataReviewFilter === "missing-doi") return !hasMetadataIdentifier(item);
      if (metadataReviewFilter === "missing-uibm") return !hasUibmAffiliation(item);
      if (metadataReviewFilter === "in_review") return review.status === "in_review";
      if (metadataReviewFilter === "ready") return review.status === "ok" || completeness.isComplete;
      if (metadataReviewFilter === "correction") return review.status === "correction";
      return true;
    });

    const filteredBySearch = normalizedQuery
      ? filteredByReview.filter((item) => {
        const authorsText = getPublicationAuthors(item)
          .map((author) => `${getAuthorName(author)} ${getAuthorAffiliation(author)}`)
          .join(" ");
        const row = [
          item.title,
          item.doi,
          item.venue,
          item.publisher,
          item.publicationType,
          item.publication_type,
          item.requestTypeLabel,
          item.sourceLabel,
          item.publicationYear,
          item.publication_year,
          item.status,
          getMetadataItemStatusLabel(item),
          getMetadataStatus(item),
          item.owner?.name,
          item.owner?.email,
          item.owner?.faculty,
          authorsText,
        ].filter(Boolean).join(" ");

        return normalizeForSearch(row).includes(normalizedQuery);
      })
      : filteredByReview;

    return [...filteredBySearch].sort((first, second) => {
      const firstReview = metadataReviews[first.id] || mapMetadataReviewFromPublication(first);
      const secondReview = metadataReviews[second.id] || mapMetadataReviewFromPublication(second);

      if (metadataSort === "newest") {
        return getDateTimestamp(second.updatedAt || second.updated_at || second.createdAt || second.created_at || second.publicationDate || second.publication_date)
          - getDateTimestamp(first.updatedAt || first.updated_at || first.createdAt || first.created_at || first.publicationDate || first.publication_date);
      }

      if (metadataSort === "ready") {
        return getMetadataReviewInsights(second, secondReview).score - getMetadataReviewInsights(first, firstReview).score;
      }

      if (metadataSort === "title") {
        return String(first.title || "").localeCompare(String(second.title || ""), "sq");
      }

      return getMetadataPriorityScore(second, secondReview) - getMetadataPriorityScore(first, firstReview);
    });
  }, [metadataQueueItems, metadataReviewFilter, metadataReviews, metadataSort, normalizedQuery]);

  const metadataSummary = useMemo(() => {
    const reviewRows = metadataQueueItems.map((item) => {
      const review = metadataReviews[item.id] || mapMetadataReviewFromPublication(item);
      const completeness = getReviewCompleteness(review, item);
      const insights = getMetadataReviewInsights(item, review);

      return { item, review, completeness, insights };
    });
    const totalReadiness = reviewRows.reduce((total, row) => total + row.insights.score, 0);

    return {
      total: metadataQueueItems.length,
      verified: reviewRows.filter((row) => row.review.status === "ok").length,
      inReview: reviewRows.filter((row) => row.review.status === "in_review").length,
      correction: reviewRows.filter((row) => row.review.status === "correction").length,
      issues: reviewRows.filter((row) => !hasMetadataIdentifier(row.item) || !hasUibmAffiliation(row.item) || !row.completeness.isComplete).length,
      missingDoi: reviewRows.filter((row) => !hasMetadataIdentifier(row.item)).length,
      missingUibm: reviewRows.filter((row) => !hasUibmAffiliation(row.item)).length,
      averageReadiness: reviewRows.length ? Math.round(totalReadiness / reviewRows.length) : 0,
    };
  }, [metadataQueueItems, metadataReviews]);

  const metadataQueueHighlight = useMemo(() => filteredMetadataPublications.find((item) => {
    const review = metadataReviews[item.id] || mapMetadataReviewFromPublication(item);
    return review.status !== "ok";
  }) || filteredMetadataPublications[0] || null, [filteredMetadataPublications, metadataReviews]);

  const committeeUnitStats = useMemo(() => {
    const unitMap = new Map();

    const ensureUnit = (unitName) => {
      const department = unitName || "Pa njësi";
      const key = normalizeForSearch(department) || "pa-njesi";

      if (!unitMap.has(key)) {
        unitMap.set(key, {
          faculty: getShortUnitLabel(department),
          department,
          publikime: 0,
          projekte: 0,
          rimbursime: 0,
          korrigjime: 0,
        });
      }

      return unitMap.get(key);
    };

    reviewRequests.forEach((request) => {
      const unit = ensureUnit(getRequestUnit(request));
      unit.rimbursime += 1;

      if (getRequestType(request) === "project") {
        unit.projekte += 1;
      }

      if (request.status === "needs_correction") {
        unit.korrigjime += 1;
      }
    });

    metadataPublications.forEach((publication) => {
      const unit = ensureUnit(getPublicationUnit(publication));
      const review = metadataReviews[publication.id] || createInitialReview(publication);

      unit.publikime += 1;

      if (review.status === "correction") {
        unit.korrigjime += 1;
      }
    });

    return Array.from(unitMap.values()).sort((first, second) =>
      (second.publikime + second.rimbursime + second.projekte) - (first.publikime + first.rimbursime + first.projekte)
    );
  }, [metadataPublications, metadataReviews, reviewRequests]);

  const filteredFacultyStats = useMemo(() => {
    if (!normalizedQuery) {
      return committeeUnitStats;
    }

    return committeeUnitStats.filter((item) =>
      normalizeForSearch([
        item.faculty,
        item.department,
        item.publikime,
        item.projekte,
        item.rimbursime,
        item.korrigjime,
      ].join(" ")).includes(normalizedQuery)
    );
  }, [committeeUnitStats, normalizedQuery]);

  const committeeDecisionRows = useMemo(() => {
    const reimbursementRows = reviewRequests
      .filter((item) => item.status && item.status !== "submitted")
      .map((item) => ({
        id: item.documentNumber || item.id,
        title: item.title || item.requestTypeLabel || "Kerkese rimbursimi",
        category: item.requestTypeLabel || "Rimbursim",
        actor: item.owner?.name || item.owner?.email || "-",
        unit: item.owner?.faculty || item.owner?.department || "-",
        status: item.statusLabel || reimbursementStatusLabels[item.status] || item.status,
        statusKey: item.status,
        date: item.updatedAt || item.submittedAt || item.createdAt,
        source: "Rimbursim",
      }));

    const metadataRows = metadataQueueItems
      .map((item) => {
        const review = metadataReviews[item.id] || mapMetadataReviewFromPublication(item);
        const statusConfig = getReviewStatusConfig(review.status);
        const authors = getPublicationAuthors(item)
          .map((author) => getAuthorName(author))
          .filter(Boolean)
          .join(", ");

        return {
          id: item.id,
          title: item.title || item.doi || "Publikim pa titull",
          category: getMetadataItemTypeLabel(item),
          actor: item.sourceType === "reimbursement" ? (item.owner?.name || item.owner?.email || authors || "-") : (authors || "-"),
          unit: item.venue || item.publisher || "-",
          status: statusConfig.label,
          statusKey: review.status,
          date: item.updatedAt || item.updated_at || item.createdAt || item.created_at || item.publicationDate || item.publication_date,
          source: item.sourceType === "reimbursement" ? "Metadata / Rimbursim" : "Metadata",
        };
      })
      .filter((item) => item.statusKey !== "unchecked");

    const rows = [...reimbursementRows, ...metadataRows].sort((first, second) =>
      getDateTimestamp(second.date) - getDateTimestamp(first.date)
    );

    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((item) =>
      normalizeForSearch([
        item.id,
        item.title,
        item.category,
        item.actor,
        item.unit,
        item.status,
        item.source,
      ].filter(Boolean).join(" ")).includes(normalizedQuery)
    );
  }, [metadataQueueItems, metadataReviews, normalizedQuery, reviewRequests]);

  const decisionSummary = useMemo(() => ({
    total: committeeDecisionRows.length,
    inReview: committeeDecisionRows.filter((item) => ["received", "in_review"].includes(item.statusKey)).length,
    corrections: committeeDecisionRows.filter((item) => ["needs_correction", "correction"].includes(item.statusKey)).length,
    completed: committeeDecisionRows.filter((item) => ["approved", "committee_approved", "ok", "paid", "rejected"].includes(item.statusKey)).length,
  }), [committeeDecisionRows]);

  const dashboardSummary = useMemo(() => ({
    pending: pendingSubmissions.length,
    inReview: reviewRequests.filter((item) => ["received", "in_review"].includes(item.status)).length,
    corrections: reviewRequests.filter((item) => item.status === "needs_correction").length
      + metadataQueueItems.filter((item) =>
        item.sourceType !== "reimbursement"
        && (metadataReviews[item.id] || mapMetadataReviewFromPublication(item)).status === "correction"
      ).length,
    metadataIssues: metadataQueueItems.filter((item) => {
      const review = metadataReviews[item.id] || mapMetadataReviewFromPublication(item);
      const completeness = getReviewCompleteness(review, item);
      return !hasMetadataIdentifier(item) || !hasUibmAffiliation(item) || !completeness.isComplete || review.status === "correction";
    }).length,
  }), [metadataQueueItems, metadataReviews, pendingSubmissions.length, reviewRequests]);

  const recentDashboardRows = useMemo(() => {
    const activeRequests = reviewRequests
      .filter((item) => ["submitted", "received", "in_review", "needs_correction"].includes(item.status))
      .map((item) => ({
        id: item.documentNumber || item.id,
        title: item.title || item.requestTypeLabel || "Kerkese rimbursimi",
        type: item.requestTypeLabel || "Rimbursim",
        owner: item.owner?.name || item.owner?.email || "-",
        status: item.statusLabel || reimbursementStatusLabels[item.status] || item.status,
        statusKey: item.status,
        date: item.updatedAt || item.submittedAt || item.createdAt,
      }));

    const metadataIssues = metadataQueueItems
      .filter((item) => {
        const review = metadataReviews[item.id] || mapMetadataReviewFromPublication(item);
        const completeness = getReviewCompleteness(review, item);
        return !hasMetadataIdentifier(item) || !hasUibmAffiliation(item) || !completeness.isComplete || review.status === "correction";
      })
      .map((item) => {
        const review = metadataReviews[item.id] || mapMetadataReviewFromPublication(item);
        const statusConfig = getReviewStatusConfig(review.status);

        return {
          id: item.id,
          title: item.title || item.doi || "Publikim pa titull",
          type: getMetadataItemTypeLabel(item),
          owner: item.owner?.name || item.owner?.email || getPublicationAuthors(item).map((author) => getAuthorName(author)).filter(Boolean).join(", ") || "-",
          status: statusConfig.label,
          statusKey: review.status,
          date: item.updatedAt || item.updated_at || item.createdAt || item.created_at || item.publicationDate || item.publication_date,
        };
      });

    return [...activeRequests, ...metadataIssues]
      .sort((first, second) => getDateTimestamp(second.date) - getDateTimestamp(first.date))
      .slice(0, 6);
  }, [metadataQueueItems, metadataReviews, reviewRequests]);

  const generatedNotifications = useMemo(() => {
    const rows = [];

    if (pendingSubmissions.length > 0) {
      rows.push({
        id: "pending-submissions",
        category: "Dorëzime",
        title: `${pendingSubmissions.length} dorëzime në pritje`,
        description: "Ka kërkesa të reja që presin veprim nga komisioni.",
        createdAt: "Tani",
      });
    }

    if (dashboardSummary.metadataIssues > 0) {
      rows.push({
        id: "metadata-issues",
        category: "Metadata",
        title: `${dashboardSummary.metadataIssues} raste kërkojnë kontroll metadata`,
        description: "Kontrollo DOI, affiliation, dokumente dhe checklist para vendimit.",
        createdAt: "Tani",
      });
    }

    if (dashboardSummary.corrections > 0) {
      rows.push({
        id: "corrections",
        category: "Korrigjime",
        title: `${dashboardSummary.corrections} raste me korrigjim`,
        description: "Rastet e kthyera për korrigjim mbeten të dukshme në workflow.",
        createdAt: "Tani",
      });
    }

    return rows;
  }, [dashboardSummary.corrections, dashboardSummary.metadataIssues, pendingSubmissions.length]);

  useEffect(() => {
    setNotifications((prev) =>
      generatedNotifications.map((item) => {
        const previous = prev.find((notification) => notification.id === item.id);

        return {
          ...item,
          text: item.title,
          isRead: previous?.isRead || false,
        };
      })
    );
  }, [generatedNotifications]);

  const getReviewForPublication = (publication) =>
    metadataReviews[publication.id] || mapMetadataReviewFromPublication(publication);

  const auditRows = useMemo(() => {
    const reimbursementRows = reviewRequests.flatMap((request) => {
      const history = Array.isArray(request.statusHistory) && request.statusHistory.length
        ? request.statusHistory
        : [{
            id: `${request.id}-${request.status || "current"}`,
            status: request.status,
            statusLabel: request.statusLabel || reimbursementStatusLabels[request.status] || request.status,
            actorName: request.owner?.name || request.owner?.email || "Sistemi",
            actorRoleLabel: "Rimbursim",
            createdAt: request.updatedAt || request.submittedAt || request.createdAt,
            note: "",
          }];

      return history.map((entry) => ({
        id: `reimbursement-${request.id}-${entry.id || entry.status}-${entry.createdAt || ""}`,
        source: "Rimbursim",
        title: request.title || request.requestTypeLabel || request.documentNumber || request.id,
        status: entry.statusLabel || reimbursementStatusLabels[entry.status] || entry.status || "-",
        statusKey: entry.status || request.status,
        actor: [entry.actorRoleLabel || entry.actorRole, entry.actorName].filter(Boolean).join(" / ") || "-",
        note: entry.note || "",
        date: entry.createdAt || request.updatedAt || request.createdAt,
      }));
    });

    const metadataRows = metadataQueueItems.flatMap((publication) => {
      const review = getReviewForPublication(publication);
      const history = Array.isArray(review.history) && review.history.length
        ? review.history
        : review.status !== "unchecked"
          ? [{
              id: `${publication.id}-${review.status}`,
              status: review.status,
              statusLabel: getReviewStatusConfig(review.status).label,
              actor: "Komisioni",
              comment: review.comment,
              createdAt: publication.updatedAt || publication.updated_at || publication.createdAt || publication.created_at,
            }]
          : [];

      return history.map((entry) => ({
        id: `metadata-${publication.id}-${entry.id || entry.status}-${entry.createdAt || ""}`,
        source: "Metadata",
        title: publication.title || publication.doi || publication.id,
        status: entry.statusLabel || getReviewStatusConfig(entry.status).label,
        statusKey: entry.status,
        actor: entry.actor || "Komisioni",
        note: entry.comment || "",
        date: entry.createdAt || publication.updatedAt || publication.updated_at,
      }));
    });

    const rows = [...reimbursementRows, ...metadataRows]
      .sort((first, second) => getDateTimestamp(second.date) - getDateTimestamp(first.date));

    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((item) =>
      normalizeForSearch([
        item.source,
        item.title,
        item.status,
        item.actor,
        item.note,
      ].join(" ")).includes(normalizedQuery)
    );
  }, [getReviewForPublication, metadataQueueItems, normalizedQuery, reviewRequests]);

  const syncPendingSubmissionStatus = (updatedRequest) => {
    if (!updatedRequest?.id) {
      return;
    }

    setReviewRequests((prev) => {
      const exists = prev.some((item) => item.id === updatedRequest.id);

      if (!exists) {
        return [updatedRequest, ...prev];
      }

      return prev.map((item) => (item.id === updatedRequest.id ? updatedRequest : item));
    });

    setPendingSubmissions((prev) => {
      if (updatedRequest.status !== "submitted") {
        return prev.filter((item) => item.id !== updatedRequest.id);
      }

      return prev.map((item) => (item.id === updatedRequest.id ? updatedRequest : item));
    });
  };

  const openReimbursementReview = (request) => {
    setSelectedReimbursementReview(request);
    setActivePage("Dorëzimet në Pritje");
  };

  const closeReimbursementReview = () => {
    setSelectedReimbursementReview(null);
    setActivePage("Dorëzimet në Pritje");
  };

  const saveMetadataReview = (publication, updater) => {
    setMetadataReviews((prev) => {
      const current = prev[publication.id] || createInitialReview(publication);
      const nextReview = typeof updater === "function" ? updater(current) : updater;

      return {
        ...prev,
        [publication.id]: {
          ...current,
          ...nextReview,
        },
      };
    });
  };

  const addMetadataHistory = (publication, status, comment = "") => {
    const statusConfig = getReviewStatusConfig(status);
    const actor = committeeProfile.name || committeeProfile.email || "Komisioni";

    saveMetadataReview(publication, (current) => ({
      status,
      comment: comment || current.comment || "",
      history: [
        {
          id: `${Date.now()}-${status}`,
          actor,
          status,
          statusLabel: statusConfig.label,
          comment,
          createdAt: new Date().toISOString(),
        },
        ...(current.history || []),
      ],
    }));
  };

  const persistMetadataReviewDraft = async (publication, review, fallbackComment = "") => {
    try {
      await sendMetadataReview(publication, {
        status: review.status || "in_review",
        comment: review.comment || fallbackComment || "",
        checklist: review.checklist || createDefaultChecklist(publication),
      });
    } catch (error) {
      setCorrectionError(error.message || "Ndryshimet e checklist nuk u ruajten ne server.");
    }
  };

  const toggleChecklistItem = (publication, key) => {
    const current = getReviewForPublication(publication);
    const nextChecklist = {
      ...current.checklist,
      [key]: !current.checklist?.[key],
    };
    const nextIsComplete = getMetadataChecklistItems(publication).every((item) => nextChecklist[item.key]);
    const nextStatus = current.status === "unchecked" || (current.status === "ok" && !nextIsComplete)
      ? "in_review"
      : current.status;
    const nextReview = {
      checklist: nextChecklist,
      status: nextStatus,
      comment: current.comment || "",
      history: current.history || [],
    };

    saveMetadataReview(publication, nextReview);
    setCorrectionError("");
    persistMetadataReviewDraft(publication, nextReview);
  };

  const autoFillMetadataChecklist = (publication) => {
    const autoChecklist = createDefaultChecklist(publication);
    const current = getReviewForPublication(publication);
    const nextChecklist = getMetadataChecklistItems(publication).reduce((items, item) => ({
      ...items,
      [item.key]: Boolean(current.checklist?.[item.key] || autoChecklist[item.key]),
    }), {});
    const nextStatus = current.status === "unchecked" ? "in_review" : current.status;
    const nextReview = {
      checklist: nextChecklist,
      status: nextStatus,
      comment: current.comment || "",
      history: [
        {
          id: `${Date.now()}-autofill`,
          actor: committeeProfile.name || committeeProfile.email || "Komisioni",
          status: nextStatus,
          statusLabel: "Auto plotësim",
          comment: "Checklist u plotësua nga metadata dhe dokumentet e gjetura.",
          createdAt: new Date().toISOString(),
        },
        ...(current.history || []),
      ],
    };

    saveMetadataReview(publication, nextReview);
    setCorrectionError("");
    persistMetadataReviewDraft(publication, nextReview, "Checklist u plotesua nga metadata dhe dokumentet e gjetura.");
  };

  const fillSuggestedCorrectionComment = (publication) => {
    const review = getReviewForPublication(publication);
    const comment = buildMetadataCorrectionComment(publication, review);

    setCorrectionComment(comment);
    setCorrectionError("");
  };

  const openMetadataDrawer = (publication, mode = "details") => {
    const currentReview = getReviewForPublication(publication);

    setSelectedMetadataPublication(publication);
    setMetadataDrawerMode(mode);
    setCorrectionComment(currentReview.comment || "");
    setCorrectionError("");

    if (currentReview.status === "unchecked") {
      addMetadataHistory(publication, "in_review", "Kontrolli i metadata-s u hap nga Komisioni.");
      persistMetadataReviewDraft(publication, {
        ...currentReview,
        status: "in_review",
        checklist: currentReview.checklist || createDefaultChecklist(publication),
      }, "Kontrolli i metadata-s u hap nga Komisioni.");
    }
  };

  const syncMetadataReviewResponse = (publication, data) => {
    const updatedPublication = publication.sourceType === "reimbursement"
      ? (mapReimbursementToMetadataItem(data?.data) || publication)
      : (data?.data || publication);
    const nextReview = mapMetadataReviewFromPublication(updatedPublication);

    if (publication.sourceType === "reimbursement") {
      const updatedRequest = data?.data;

      if (updatedRequest?.id) {
        syncPendingSubmissionStatus(updatedRequest);
      }

      setSelectedMetadataPublication((current) =>
        current?.id === publication.id ? updatedPublication : current
      );
      setMetadataReviews((prev) => ({
        ...prev,
        [updatedPublication.id]: nextReview,
      }));
      setCorrectionComment(nextReview.comment || "");
      return;
    }

    setMetadataPublications((prev) =>
      prev.map((item) => (item.id === updatedPublication.id ? updatedPublication : item))
    );
    setSelectedMetadataPublication((current) =>
      current?.id === updatedPublication.id ? updatedPublication : current
    );
    setMetadataReviews((prev) => ({
      ...prev,
      [updatedPublication.id]: nextReview,
    }));
    setCorrectionComment(nextReview.comment || "");
  };

  const sendMetadataReview = async (publication, payload) => {
    const endpoint = publication.sourceType === "reimbursement"
      ? `/reimbursements/${publication.reimbursementId}/metadata-review`
      : `/publications/${publication.id}/metadata-review`;
    const response = await fetch(apiUrl(endpoint), {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Kontrolli i metadata-s nuk u ruajt.");
    }

    syncMetadataReviewResponse(publication, data);
    return data;
  };

  const markMetadataOk = async (publication) => {
    const review = getReviewForPublication(publication);
    const completeness = getReviewCompleteness(review, publication);

    if (!completeness.isComplete) {
      setCorrectionError("Checklist nuk është i plotë. Plotëso pikat që mungojnë ose kërko korrigjim.");
      setCorrectionComment((current) => current || buildMetadataCorrectionComment(publication, review));
      return;
    }

    try {
      setCorrectionError("");
      await sendMetadataReview(publication, {
        status: "ok",
        comment: "Metadata u verifikua si e plote.",
        checklist: review.checklist || createDefaultChecklist(publication),
      });
    } catch (error) {
      setCorrectionError(error.message || "Metadata nuk u ruajt.");
    }
  };

  const requestMetadataCorrection = async (publication) => {
    const review = getReviewForPublication(publication);
    const comment = correctionComment.trim() || buildMetadataCorrectionComment(publication, review);

    if (!comment) {
      setCorrectionError("Komenti eshte i detyrueshem per korrigjim.");
      return;
    }

    try {
      await sendMetadataReview(publication, {
        status: "correction",
        comment,
        checklist: review.checklist || createDefaultChecklist(publication),
      });
      setCorrectionComment(comment);
      setCorrectionError("");
    } catch (error) {
      setCorrectionError(error.message || "Korrigjimi nuk u dergua te profesori.");
    }
  };

  const openPublicationDocument = (publication) => {
    const documentUrl = getPublicationDocumentUrl(publication);

    if (documentUrl) {
      window.open(documentUrl, "_blank", "noopener,noreferrer");
    }
  };

  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const markNotificationAsRead = (id) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const profileMenuItems = [
    { id: "Njoftime", label: "Njoftime", icon: Bell },
    { id: "Edit Profile", label: "Edit Profile", icon: CircleUserRound },
    { id: "Settings", label: "Settings", icon: Settings },
    { id: "Logout", label: "Logout", icon: LogOut, tone: "danger" },
  ];

  const handleProfileAction = (actionId) => {
    const normalizedAction = String(actionId || "").trim().toLowerCase();

    if (normalizedAction === "njoftime" || normalizedAction === "notifications") {
      setActivePage("Njoftime");
      return;
    }

    if (normalizedAction === "edit profile" || normalizedAction === "edit-profile") {
      setCommitteeDraft(committeeProfile);
      setIsEditProfileOpen(true);
      return;
    }

    if (normalizedAction === "settings") {
      setActivePage("Settings");
      return;
    }

    if (normalizedAction === "logout") {
      fetch(apiUrl("/auth/logout"), {
        method: "POST",
        credentials: "include",
      }).finally(() => {
        localStorage.removeItem("authToken");
        sessionStorage.removeItem("authToken");
        navigate("/", { replace: true });
      });
      return;
    }
  };

  const handleCommitteeFieldChange = (field) => (event) => {
    setCommitteeDraft((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCommitteeSave = (event) => {
    event.preventDefault();
    setCommitteeProfile(committeeDraft);
    setIsEditProfileOpen(false);
  };

  const totals = useMemo(() => {
    return filteredFacultyStats.reduce(
      (acc, item) => {
        acc.publikime += item.publikime;
        acc.projekte += item.projekte;
        acc.rimbursime += item.rimbursime;
        acc.korrigjime += item.korrigjime;
        return acc;
      },
      { publikime: 0, projekte: 0, rimbursime: 0, korrigjime: 0 }
    );
  }, [filteredFacultyStats]);

  const renderSimpleTable = (title, description, columns, rows) => (
    <section className="committee-page-card committee-stats-only-card">
      <div className="committee-page-head">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="committee-table-wrap">
        <table className="committee-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={`${row.id}-${column.key}`}>{row[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="committee-empty">Nuk ka rezultate per kerkimin aktual.</p> : null}
    </section>
  );

  const renderOverview = () => (
    <div className="committee-overview">
      <section className="committee-overview-hero">
        <div>
          <span className="committee-hero-tag">Komisioni</span>
          <h2>Përmbledhje operative</h2>
          <p>Gjendja aktuale e dorëzimeve, metadata-s, vendimeve dhe rasteve që kërkojnë veprim.</p>
        </div>
        <div className="committee-overview-actions">
          <button type="button" className="committee-primary-btn" onClick={() => setActivePage("Shqyrtimi")}>
            <FileText size={18} />
            Shqyrto kërkesat
          </button>
          <button type="button" className="committee-secondary-btn" onClick={() => setActivePage("Metadata")}>
            <Database size={18} />
            Kontrollo metadata
          </button>
        </div>
      </section>

      <section className="committee-overview-stats">
        <button type="button" onClick={() => setActivePage("Dorëzimet në Pritje")}>
          <span>Dorëzime në pritje</span>
          <strong>{dashboardSummary.pending}</strong>
          <small>Kërkojnë pranim nga komisioni</small>
        </button>
        <button type="button" onClick={() => setActivePage("Shqyrtimi")}>
          <span>Në shqyrtim</span>
          <strong>{dashboardSummary.inReview}</strong>
          <small>Raste aktive në workflow</small>
        </button>
        <button type="button" onClick={() => setActivePage("Metadata")}>
          <span>Metadata me vëmendje</span>
          <strong>{dashboardSummary.metadataIssues}</strong>
          <small>DOI, UIBM ose checklist</small>
        </button>
        <button type="button" onClick={() => setActivePage("Vendimet")}>
          <span>Korrigjime</span>
          <strong>{dashboardSummary.corrections}</strong>
          <small>Të kthyera për plotësim</small>
        </button>
      </section>

      <section className="committee-overview-grid">
        <article className="committee-page-card committee-overview-chart">
          <div className="committee-page-head">
            <h3>Ngarkesa sipas njësive</h3>
            <p>Publikime, projekte dhe rimbursime nga të dhënat aktuale.</p>
          </div>
          {filteredFacultyStats.length ? (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={filteredFacultyStats.slice(0, 8)} barGap={8} margin={{ top: 16, right: 18, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                <XAxis dataKey="faculty" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(15, 23, 42, 0.05)" }} />
                <Legend wrapperStyle={{ paddingTop: "14px" }} />
                <Bar dataKey="publikime" name="Publikime" radius={[8, 8, 0, 0]} fill="#153a63" />
                <Bar dataKey="projekte" name="Projekte" radius={[8, 8, 0, 0]} fill="#2e6aa6" />
                <Bar dataKey="rimbursime" name="Rimbursime" radius={[8, 8, 0, 0]} fill="#c9a24f" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="committee-empty">Nuk ka ende të dhëna për raportim.</p>
          )}
        </article>

        <article className="committee-page-card committee-overview-queue">
          <div className="committee-page-head">
            <h3>Rastet prioritare</h3>
            <p>Rastet më të fundit që kërkojnë kontroll ose vendim.</p>
          </div>
          <div className="committee-priority-list">
            {recentDashboardRows.map((row) => (
              <div key={`${row.type}-${row.id}`} className="committee-priority-row">
                <div>
                  <strong>{row.title}</strong>
                  <span>{[row.type, row.owner].filter(Boolean).join(" • ")}</span>
                </div>
                <span className={`committee-decision-status ${getDecisionStatusClass(row.statusKey)}`}>
                  {row.status}
                </span>
              </div>
            ))}
          </div>
          {recentDashboardRows.length === 0 ? (
            <p className="committee-empty">Nuk ka raste urgjente për momentin.</p>
          ) : null}
        </article>
      </section>
    </div>
  );

  const renderReimbursementReviewShell = (request) => {
    const config = getReviewShellConfig(request);
    const requestData = request.requestData || {};
    const requestType = getRequestType(request);
    const amount = request.amount === null || request.amount === undefined || request.amount === ""
      ? "-"
      : `${request.amount} ${request.currency || "EUR"}`;
    const hasReviewValue = (value) => {
      if (Array.isArray(value)) {
        return value.some(hasReviewValue);
      }

      if (value && typeof value === "object") {
        return Object.values(value).some(hasReviewValue);
      }

      return value !== null && value !== undefined && String(value).trim() !== "";
    };
    const getFirstReviewValue = (...values) => values.find(hasReviewValue) || "";
    const isUrlValue = (value) => /^https?:\/\//i.test(String(value || "").trim());
    const normalizeDoi = (value) => String(value || "")
      .trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "")
      .trim();
    const doiValue = normalizeDoi(requestData.doi);
    const getPublicationLinkLabel = (value) => {
      if (!hasReviewValue(value)) {
        return "";
      }

      const normalizedLinkDoi = normalizeDoi(value);
      return doiValue && normalizedLinkDoi === doiValue ? "Hap DOI" : "Hap linkun";
    };
    const createReviewField = (label, value, options = {}) => ({
      label,
      value,
      displayValue: options.displayValue,
      href: options.href || (options.link && isUrlValue(value) ? String(value).trim() : ""),
      wide: Boolean(options.wide),
      format: options.format || "",
      alwaysShow: Boolean(options.alwaysShow),
    });
    const renderReviewValue = (field) => {
      const rawValue = field.format === "date" ? formatDate(field.value) : field.value;
      const value = hasReviewValue(field.displayValue) ? field.displayValue : (hasReviewValue(rawValue) ? rawValue : "-");

      if (field.href && hasReviewValue(field.href)) {
        return (
          <a href={field.href} target="_blank" rel="noreferrer">
            {value}
          </a>
        );
      }

      return Array.isArray(value) ? value.join(", ") : String(value);
    };
    const renderReviewSection = (title, fields, options = {}) => {
      const visibleFields = fields.filter((field) => field.alwaysShow || hasReviewValue(field.value));

      return (
        <section className={`committee-review-section ${options.placeholder ? "is-placeholder" : ""}`}>
          <div className="committee-review-section-head">
            <h4>{title}</h4>
            {options.note ? <span>{options.note}</span> : null}
          </div>
          {visibleFields.length ? (
            <dl className="committee-review-fields">
              {visibleFields.map((field) => (
                <div key={`${title}-${field.label}`} className={field.wide ? "is-wide" : ""}>
                  <dt>{field.label}</dt>
                  <dd>{renderReviewValue(field)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="committee-empty">{options.emptyText || "Nuk ka të dhëna të regjistruara për këtë seksion."}</p>
          )}
        </section>
      );
    };
    const renderCommitteeChecklist = () => {
      const checklistGroups = requestType === "conference" ? f2CommitteeChecklistGroups : f1CommitteeChecklistGroups;
      const totalItems = checklistGroups.reduce((total, group) => total + group.items.length, 0);
      const defaultStatus = committeeChecklistStatuses[0];
      const statusSummary = committeeChecklistStatuses.map((status) => ({
        status,
        count: status === defaultStatus ? totalItems : 0,
      }));

      return (
        <section className="committee-review-section committee-review-checklist-section">
          <div className="committee-review-section-head">
            <h4>Checklista e Komisionit</h4>
            <span>UI lokale / pa ruajtje</span>
          </div>

          <div className="committee-review-checklist-summary" aria-label="Përmbledhje e checklistës">
            <article>
              <span>Total items</span>
              <strong>{totalItems}</strong>
            </article>
            {statusSummary.map((item) => (
              <article key={item.status}>
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </article>
            ))}
          </div>

          <div className="committee-review-checklist-groups">
            {checklistGroups.map((group) => (
              <article className="committee-review-checklist-card" key={group.title}>
                <header>
                  <h5>{group.title}</h5>
                  <span>{group.items.length} pika</span>
                </header>
                <div className="committee-review-checklist-rows">
                  {group.items.map((label) => (
                    <div className="committee-review-checklist-row" key={`${group.title}-${label}`}>
                      <strong>{label}</strong>
                      <select value={defaultStatus} disabled aria-label={`Statusi për ${label}`}>
                        {committeeChecklistStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <span className="committee-review-checklist-note">Shënim / evidencë do të shtohet në hapin tjetër.</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      );
    };
    const supportingDocuments = [
      request.downloadUrl ? {
        id: "pdf",
        label: "PDF",
        filename: request.documentFilename || "rimbursim.pdf",
        url: request.downloadUrl,
      } : null,
      request.docxDownloadUrl ? {
        id: "docx",
        label: "DOCX",
        filename: request.documentDocxFilename || "rimbursim.docx",
        url: request.docxDownloadUrl,
      } : null,
      ...(Array.isArray(request.attachments) ? request.attachments.map((attachment) => ({
        id: attachment.id || attachment.filename || attachment.downloadUrl,
        label: attachment.documentType || attachment.document_type || "Dokument mbeshtetes",
        filename: attachment.filename || attachment.name || "Dokument",
        url: attachment.downloadUrl || `/api/reimbursements/${request.id}/attachments/${attachment.id}`,
      })) : []),
    ].filter((item) => item?.url);
    const applicantFields = [
      createReviewField("Emri dhe mbiemri", getFirstReviewValue(requestData.applicantName, request.owner?.name, request.owner?.email), { alwaysShow: true }),
      createReviewField("Email", getFirstReviewValue(requestData.applicantEmail, request.owner?.email), { alwaysShow: true }),
      createReviewField("Fakulteti", getFirstReviewValue(requestData.applicantFaculty, request.owner?.faculty), { alwaysShow: true }),
      createReviewField("Departamenti", getFirstReviewValue(requestData.applicantDepartment, request.owner?.department), { alwaysShow: true }),
      createReviewField("Zyra", requestData.applicantOffice),
      createReviewField("ORCID", requestData.applicantOrcidId),
      createReviewField("Thirrja akademike", requestData.academicTitle),
      createReviewField("Thirrja shkencore", requestData.scientificTitle),
    ];
    const bankingFields = [
      createReviewField("Emri në bankë", requestData.bankApplicantName),
      createReviewField("Banka", getFirstReviewValue(requestData.bankName, requestData.bankNameOther)),
      createReviewField("Numri i llogarisë / IBAN", getFirstReviewValue(requestData.bankAccountNumber, requestData.iban)),
      createReviewField("SWIFT", requestData.swiftCode),
      createReviewField("Vendi i bankës", requestData.bankCountry),
    ];
    const requestFields = [
      createReviewField("Numri i dokumentit", request.documentNumber, { alwaysShow: true }),
      createReviewField("Lloji i kërkesës", config.typeLabel, { alwaysShow: true }),
      createReviewField("Statusi", request.statusLabel || request.status, { alwaysShow: true }),
      createReviewField("Data e dorëzimit", request.submittedAt || request.createdAt, { format: "date", alwaysShow: true }),
      createReviewField("Shuma", amount, { alwaysShow: true }),
      createReviewField("Titulli", request.title || request.requestTypeLabel, { wide: true, alwaysShow: true }),
      ...bankingFields,
    ];
    const f1MetadataFields = [
      createReviewField("Titulli i publikimit", requestData.publicationTitle, { wide: true }),
      createReviewField("Lloji i publikimit", getPublicationTypeLabel(requestData.publicationType)),
      createReviewField("DOI", doiValue, { href: doiValue ? `https://doi.org/${doiValue}` : "" }),
      createReviewField("Publikuar në", getFirstReviewValue(requestData.venue, requestData.journal, requestData.publishedIn)),
      createReviewField("Shtëpia botuese", requestData.publisher),
      createReviewField("Data / viti i publikimit", getFirstReviewValue(requestData.publicationDate, requestData.publicationYear), { format: requestData.publicationDate ? "date" : "" }),
      createReviewField("Linku i publikimit", requestData.publicationLink, { link: true, wide: true, displayValue: getPublicationLinkLabel(requestData.publicationLink) }),
      createReviewField("Autori kryesor", requestData.mainAuthor),
      createReviewField("Autori korrespondent", requestData.correspondingAuthor),
      createReviewField("Bashkautorët", requestData.coauthors, { wide: true }),
      createReviewField("Affiliation", requestData.affiliation, { wide: true }),
      createReviewField("Abstrakti", requestData.abstract, { wide: true }),
      createReviewField("Vëllimi", requestData.volume),
      createReviewField("Issue", requestData.issue),
      createReviewField("Faqet", requestData.pages),
      createReviewField("ISSN", requestData.issn),
      createReviewField("ISBN", requestData.isbn),
      createReviewField("Indeksimi në platformë", requestData.indexingPlatform),
      createReviewField("Kategoria e indeksimit", requestData.indexingCategory),
      createReviewField("Impact Factor", requestData.impactFactor),
      createReviewField("Kuartili", requestData.scopusQuartile),
      createReviewField("Data e pranimit", requestData.acceptanceDate, { format: "date" }),
      createReviewField("Dëshmia në databazën UIBM", requestData.uibmDatabaseEvidence, { link: true, wide: true }),
    ];
    const f2MetadataFields = [
      createReviewField("Emërtimi i ngjarjes", requestData.conferenceTitle, { wide: true }),
      createReviewField("Vendi", requestData.location),
      createReviewField("Data e konferencës", requestData.conferenceDate, { format: "date" }),
      createReviewField("Vendi dhe data", requestData.eventPlaceDate),
      createReviewField("Organizatori", requestData.organizer, { wide: true }),
      createReviewField("Ftesa dhe programi", requestData.invitationProgram, { link: true, wide: true }),
      createReviewField("Abstrakti dhe titulli i punimit", requestData.abstractTitle, { wide: true }),
      createReviewField("Konfirmimi i pranimit", requestData.acceptanceConfirmation, { link: true, wide: true }),
      createReviewField("Autorët dhe affiliation", requestData.authorsAffiliation, { wide: true }),
      createReviewField("Autori kryesor", requestData.mainAuthor),
      createReviewField("Bashkëpjesëmarrësi", requestData.coParticipant, { wide: true }),
      createReviewField("Folës me kumtesë/poster", requestData.speakerWithPaperPoster),
      createReviewField("Kryesues/panelist", requestData.chairPanelist),
      createReviewField("Ngjarje artistike/sportive", requestData.artisticSportEvent),
      createReviewField("Linku i publikimit të ngjarjes", requestData.eventPublicationLink, { link: true, wide: true }),
    ];
    const metadataFields = requestType === "conference" ? f2MetadataFields : f1MetadataFields;

    return (
      <section className="committee-page-card committee-stats-only-card committee-review-shell">
        <div className="committee-review-shell-head">
          <div>
            <span className="committee-review-shell-badge">{config.badge}</span>
            <h3>{config.title}</h3>
            <p>{config.description}</p>
          </div>
          <button type="button" className="committee-settings-back" onClick={closeReimbursementReview}>
            Back
          </button>
        </div>

        {!config.supported ? (
          <p className="committee-empty" role="alert">
            Ky formular nuk ka ende shell shqyrtimi ne kete hap te workflow-it.
          </p>
        ) : null}

        {renderReviewSection("Të dhënat e aplikantit", applicantFields)}
        {renderReviewSection("Të dhënat e kërkesës", requestFields)}
        {renderReviewSection("Metadata akademike", metadataFields)}

        <section className="committee-review-section committee-review-shell-documents">
          <div className="committee-review-section-head">
            <h4>Dokumentet mbështetëse</h4>
          </div>
          {supportingDocuments.length ? (
            <div className="committee-review-shell-document-list">
              {supportingDocuments.map((document) => (
                <a
                  key={`${document.id}-${document.filename}`}
                  href={getCommitteeDocumentUrl(document.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="committee-review-shell-document"
                >
                  <FileText size={16} />
                  <span>{document.label}</span>
                  <strong>{document.filename}</strong>
                </a>
              ))}
            </div>
          ) : (
            <p className="committee-empty">Nuk ka dokumente mbështetëse të lidhura me këtë kërkesë.</p>
          )}
        </section>

        {config.supported ? renderCommitteeChecklist() : null}
        {renderReviewSection("Komentet e Komisionit", [], {
          placeholder: true,
          note: "Placeholder",
          emptyText: "Komentet do të aktivizohen pasi të shtohet procesi i vlerësimit.",
        })}
        {renderReviewSection("Vendimi", [], {
          placeholder: true,
          note: "Placeholder",
          emptyText: "Vendimi final do të aktivizohet pas implementimit të checklistës dhe rregullave të aprovimit.",
        })}
      </section>
    );
  };

  const renderPendingSubmissions = () => selectedReimbursementReview ? renderReimbursementReviewShell(selectedReimbursementReview) : (
    <section className="committee-page-card committee-stats-only-card">
      <div className="committee-page-head">
        <h3>Dorëzimet në Pritje</h3>
        <p>Kërkesat e dërguara nga profesorët që ende nuk janë marrë në shqyrtim nga Komisioni.</p>
      </div>

      {isPendingSubmissionsLoading ? (
        <p className="committee-empty">Duke ngarkuar dorëzimet në pritje...</p>
      ) : pendingSubmissionsError ? (
        <p className="committee-empty" role="alert">{pendingSubmissionsError}</p>
      ) : (
        <>
          <div className="committee-table-wrap">
            <table className="committee-table">
              <thead>
                <tr>
                  <th>ID / Dokumenti</th>
                  <th>Titulli / Lloji</th>
                  <th>Lloji i Kërkesës</th>
                  <th>Aplikanti</th>
                  <th>Njësia akademike</th>
                  <th>Data e dorëzimit</th>
                  <th>Statusi</th>
                  <th>Veprimi</th>
                </tr>
              </thead>
              <tbody>
                {filteredPendingSubmissions.map((row) => {
                  const typeDisplay = getPendingRequestTypeDisplay(row);

                  return (
                    <tr key={row.id}>
                      <td>{row.documentNumber || row.id}</td>
                      <td>{row.title || row.requestTypeLabel || "-"}</td>
                      <td>
                        <span className={`committee-request-type-badge ${typeDisplay.className}`}>
                          <strong>{typeDisplay.badge}</strong>
                          <span>{typeDisplay.label}</span>
                        </span>
                      </td>
                      <td>{row.owner?.name || row.owner?.email || "-"}</td>
                      <td>{row.owner?.faculty || row.owner?.department || "-"}</td>
                      <td>{formatDate(row.submittedAt || row.createdAt)}</td>
                      <td>{row.statusLabel || row.status || "-"}</td>
                      <td>
                        <button type="button" className="committee-details-btn" onClick={() => openReimbursementReview(row)}>
                          Shqyrto
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredPendingSubmissions.length === 0 ? (
            <p className="committee-empty">Nuk ka dorëzime në pritje për momentin.</p>
          ) : null}
        </>
      )}
    </section>
  );

  const renderMetadata = () => (
    <section className="committee-page-card committee-stats-only-card committee-metadata-section">
      <div className="committee-page-head committee-metadata-head">
        <div className="committee-metadata-title-block">
          <span className="committee-api-chip">Të dhëna reale</span>
          <h3>Qendra e Verifikimit të Metadatave</h3>
          <p>Workflow profesional për kontrollin akademik të DOI, autorëve, affiliation UIBM, burimeve dhe dokumenteve mbështetëse.</p>
        </div>
        {metadataQueueHighlight ? (() => {
          const highlightReview = getReviewForPublication(metadataQueueHighlight);
          const highlightPriority = getMetadataPriorityLabel(metadataQueueHighlight, highlightReview);
          const highlightInsights = getMetadataReviewInsights(metadataQueueHighlight, highlightReview);

          return (
            <aside className="committee-metadata-focus-card">
              <span>Rasti prioritar</span>
              <strong>{metadataQueueHighlight.title || metadataQueueHighlight.doi || "Publikim pa titull"}</strong>
              <div>
                <small className={highlightPriority.className}>{highlightPriority.label}</small>
                <small>{highlightInsights.score}% gati</small>
              </div>
              <button type="button" onClick={() => openMetadataDrawer(metadataQueueHighlight, "details")}>
                Hape kontrollin
              </button>
            </aside>
          );
        })() : null}
      </div>

      <div className="committee-metadata-summary">
        <article>
          <span>Total raste</span>
          <strong>{metadataSummary.total}</strong>
        </article>
        <article>
          <span>Metadata OK</span>
          <strong>{metadataSummary.verified}</strong>
        </article>
        <article>
          <span>Në kontroll</span>
          <strong>{metadataSummary.inReview}</strong>
        </article>
        <article>
          <span>Korrigjim</span>
          <strong>{metadataSummary.correction}</strong>
        </article>
        <article>
          <span>Me mungesa</span>
          <strong>{metadataSummary.issues}</strong>
        </article>
        <article className="committee-metadata-readiness-card">
          <span>Gatishmëria mesatare</span>
          <strong>{metadataSummary.averageReadiness}%</strong>
          <div className="committee-metadata-summary-progress" aria-hidden="true">
            <i style={{ width: `${metadataSummary.averageReadiness}%` }} />
          </div>
        </article>
      </div>

      <div className="committee-metadata-workbench">
        <label className="committee-metadata-search">
          <span>Kërko në metadata</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Titull, DOI, autor, journal, status..."
          />
        </label>
        <div className="committee-metadata-chip-group" aria-label="Filtro queue">
          {metadataReviewFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={metadataReviewFilter === option.value ? "is-active" : ""}
              onClick={() => setMetadataReviewFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="committee-metadata-filter">
          <span>Rendit sipas</span>
          <select value={metadataSort} onChange={(event) => setMetadataSort(event.target.value)}>
            {metadataSortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="committee-metadata-results-bar">
        <span><strong>{filteredMetadataPublications.length}</strong> raste në listën aktuale</span>
        <span>Pa DOI/link: <strong>{metadataSummary.missingDoi}</strong></span>
        <span>Pa UIBM: <strong>{metadataSummary.missingUibm}</strong></span>
      </div>

      {metadataError ? <p className="committee-empty" role="alert">{metadataError}</p> : null}

      {isMetadataLoading ? (
        <div className="committee-metadata-skeleton" aria-label="Duke ngarkuar metadata">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <div className="committee-table-wrap committee-metadata-table-wrap">
          <table className="committee-table committee-metadata-table">
            <thead>
              <tr>
                <th>Publikimi</th>
                <th>DOI</th>
                <th>Burimi</th>
                <th>Autoret / perkatesia institucionale</th>
                <th>Metadata</th>
                <th>Review</th>
                <th>Veprimet</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetadataPublications.map((item) => {
                const authors = getPublicationAuthors(item);
                const firstAuthor = authors[0];
                const hasUibm = hasUibmAffiliation(item);
                const review = getReviewForPublication(item);
                const reviewStatus = getReviewStatusConfig(review.status);
                const ReviewIcon = reviewStatus.Icon;
                const completeness = getReviewCompleteness(review, item);
                const insights = getMetadataReviewInsights(item, review);
                const documentUrl = getPublicationDocumentUrl(item);
                const priority = getMetadataPriorityLabel(item, review);

                return (
                  <tr key={item.id} className={priority.className === "is-high" ? "is-priority" : ""}>
                    <td>
                      <span className={`committee-metadata-source-chip ${item.sourceType === "reimbursement" ? "is-reimbursement" : ""}`}>
                        {item.sourceLabel || "Publikim"}
                      </span>
                      <strong className="committee-metadata-title">{item.title || "Pa titull"}</strong>
                      <span className="committee-metadata-muted">{getMetadataItemTypeLabel(item)}</span>
                      <span className={`committee-metadata-priority ${priority.className}`}>{priority.label}</span>
                    </td>
                    <td>
                      {item.doi ? (
                        <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noreferrer">{item.doi}</a>
                      ) : item.sourceUrl || item.source_url ? (
                        <a href={item.sourceUrl || item.source_url} target="_blank" rel="noreferrer">Link burimor</a>
                      ) : (
                        <span className="committee-metadata-warning">Mungon</span>
                      )}
                    </td>
                    <td>
                      <strong>{item.venue || item.publisher || "-"}</strong>
                      <span className="committee-metadata-muted">{item.publicationYear || item.publication_year || formatDate(item.publicationDate || item.publication_date)}</span>
                    </td>
                    <td>
                      <strong>{item.sourceType === "reimbursement" ? (item.owner?.name || item.owner?.email || getAuthorName(firstAuthor) || "-") : (getAuthorName(firstAuthor) || "-")}</strong>
                      <span className={hasUibm ? "committee-metadata-ok" : "committee-metadata-warning"}>
                        {hasUibm ? "Perkatesia institucionale UIBM OK" : "Perkatesia institucionale UIBM mungon"}
                      </span>
                    </td>
                    <td>
                      <span className={`committee-metadata-badge ${item.metadataVerified || item.metadata_verified ? "is-ok" : "is-warning"}`}>
                        {getMetadataStatus(item)}
                      </span>
                      <span className="committee-metadata-muted">{getMetadataItemStatusLabel(item)}</span>
                    </td>
                    <td>
                      <span className={`committee-review-badge ${reviewStatus.className}`} title={reviewStatus.description}>
                        <ReviewIcon size={14} />
                        {reviewStatus.label}
                      </span>
                      <span className="committee-metadata-muted">{getChecklistTypeLabel(item)}</span>
                      <span className="committee-metadata-muted">{completeness.checkedCount}/{completeness.total} checklist</span>
                      <span className={`committee-readiness-chip ${insights.isReady ? "is-ready" : "is-missing"}`}>
                        {insights.score}% gati
                      </span>
                    </td>
                    <td>
                      <div className="committee-metadata-actions">
                        <button type="button" className="committee-details-btn" onClick={() => autoFillMetadataChecklist(item)} disabled={insights.isReady}>
                          <CheckCircle2 size={14} />
                          Auto
                        </button>
                        <button type="button" className="committee-details-btn" onClick={() => openMetadataDrawer(item, "details")}>
                          <Eye size={14} />
                          Detaje
                        </button>
                        <button type="button" className="committee-details-btn" onClick={() => openMetadataDrawer(item, "compare")}>
                          <GitCompareArrows size={14} />
                          Krahaso
                        </button>
                        <button type="button" className="committee-details-btn" onClick={() => openPublicationDocument(item)} disabled={!documentUrl}>
                          <FileText size={14} />
                          Dokument
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isMetadataLoading && !metadataError && filteredMetadataPublications.length === 0 ? (
        <div className="committee-metadata-empty">
          <strong>Nuk ka raste per filtrin aktual.</strong>
          <span>Ndrysho filtrin ose kerko me titull, DOI, aplikues, autor apo status.</span>
        </div>
      ) : null}

      {selectedMetadataPublication ? (() => {
        const selectedReview = getReviewForPublication(selectedMetadataPublication);
        const selectedStatus = getReviewStatusConfig(selectedReview.status);
        const SelectedIcon = selectedStatus.Icon;
        const selectedCompleteness = getReviewCompleteness(selectedReview, selectedMetadataPublication);
        const selectedInsights = getMetadataReviewInsights(selectedMetadataPublication, selectedReview);
        const selectedDocumentUrl = getPublicationDocumentUrl(selectedMetadataPublication);
        const selectedAuthors = getPublicationAuthors(selectedMetadataPublication);
        const selectedEvidenceItems = getPublicationEvidenceItems(selectedMetadataPublication);
        const selectedChecklistItems = getMetadataChecklistItems(selectedMetadataPublication);
        const groupedChecklistItems = selectedChecklistItems.reduce((groups, item) => {
          const category = item.category || "Kontrolli baze";
          return {
            ...groups,
            [category]: [...(groups[category] || []), item],
          };
        }, {});
        const failedChecklistItems = selectedChecklistItems.filter((checkItem) => !selectedReview.checklist?.[checkItem.key]);
        const visibleHistory = (selectedReview.history || [])
          .filter((entry, index, history) => {
            const previous = history[index - 1];
            return !previous || previous.status !== entry.status || previous.comment !== entry.comment;
          })
          .slice(0, 3);

        return (
          <div className="committee-metadata-drawer-backdrop" role="presentation" onClick={() => setSelectedMetadataPublication(null)}>
            <aside className="committee-metadata-drawer" role="dialog" aria-label="Detajet e metadatave" onClick={(event) => event.stopPropagation()}>
              <div className="committee-review-hero">
                <div className="committee-review-hero-main">
                  <span className={`committee-review-badge ${selectedStatus.className}`} title={selectedStatus.description}>
                    <SelectedIcon size={14} />
                    {selectedStatus.label}
                  </span>
                  <h4>{selectedMetadataPublication.title || "Pa titull"}</h4>
                  <p>{selectedMetadataPublication.doi || selectedMetadataPublication.sourceUrl || selectedMetadataPublication.source_url || "Pa DOI / link"}</p>
                </div>
                <button type="button" onClick={() => setSelectedMetadataPublication(null)} aria-label="Mbyll detajet">x</button>
              </div>

              <div className="committee-review-quick-summary">
                <span>Statusi: <strong>{getMetadataItemStatusLabel(selectedMetadataPublication)}</strong></span>
                <span>Checklist: <strong>{selectedCompleteness.checkedCount}/{selectedCompleteness.total}</strong></span>
                <span>Tipi: <strong>{getChecklistTypeLabel(selectedMetadataPublication)}</strong></span>
                <span>UIBM: <strong className={hasUibmAffiliation(selectedMetadataPublication) ? "is-ok" : "is-warning"}>
                  {hasUibmAffiliation(selectedMetadataPublication) ? "OK" : "Mungon"}
                </strong></span>
              </div>

              <section className="committee-ai-review-card">
                <div className="committee-ai-score">
                  <strong>{selectedInsights.score}%</strong>
                  <span>{selectedInsights.isReady ? "Gati për verifikim" : "Kërkon plotësim"}</span>
                </div>
                <div className="committee-ai-progress" aria-hidden="true">
                  <span style={{ width: `${selectedInsights.score}%` }} />
                </div>
                <div className="committee-ai-metrics">
                  <span>Auto: <strong>{selectedInsights.autoDetected}/{selectedInsights.total}</strong></span>
                  <span>Mungojnë: <strong>{selectedInsights.missing}</strong></span>
                  <span>Checklist: <strong>{selectedInsights.checked}/{selectedInsights.total}</strong></span>
                </div>
                <div className="committee-ai-actions">
                  <button type="button" onClick={() => autoFillMetadataChecklist(selectedMetadataPublication)}>
                    Auto plotëso
                  </button>
                  <button type="button" onClick={() => fillSuggestedCorrectionComment(selectedMetadataPublication)} disabled={selectedInsights.missing === 0}>
                    Sugjero korrigjim
                  </button>
                </div>
              </section>

              <section className="committee-review-panel">
                <div className="committee-review-panel-head">
                  <h5>Checklist e Verifikimit</h5>
                  <span className={selectedCompleteness.isComplete ? "is-complete" : ""}>
                    {selectedCompleteness.isComplete ? "Gati per aprovim" : "Ne kontroll"}
                  </span>
                </div>
                <div className="committee-checklist-groups">
                  {Object.entries(groupedChecklistItems).map(([category, items]) => (
                    <div key={category} className="committee-checklist-group">
                      <div className="committee-checklist-category">
                        <strong>{category}</strong>
                        <span>{items.filter((checkItem) => selectedReview.checklist?.[checkItem.key]).length}/{items.length}</span>
                      </div>
                      <div className="committee-checklist-grid">
                        {items.map((checkItem) => {
                          const isChecked = Boolean(selectedReview.checklist?.[checkItem.key]);
                          const isAutoDetected = inferChecklistValue(selectedMetadataPublication, checkItem.key);

                          return (
                            <label key={checkItem.key} className={`committee-check-item ${isChecked ? "is-checked" : ""}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleChecklistItem(selectedMetadataPublication, checkItem.key)}
                              />
                              <span className="committee-checkmark"><CheckCircle2 size={14} /></span>
                              <span className="committee-check-copy">
                                <strong>{checkItem.label}</strong>
                                <small className={isAutoDetected ? "is-detected" : "is-missing"}>
                                  {getChecklistEvidenceText(selectedMetadataPublication, checkItem.key)}
                                </small>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {failedChecklistItems.length ? (
                  <p className="committee-checklist-note">
                    Pika qe kerkojne vemendje: {failedChecklistItems.map((item) => item.label).join(", ")}
                  </p>
                ) : null}
              </section>

              <section className="committee-review-panel committee-correction-panel">
                <div className="committee-correction-head">
                  <h5>Koment per korrigjim</h5>
                  <button type="button" onClick={() => fillSuggestedCorrectionComment(selectedMetadataPublication)} disabled={selectedInsights.missing === 0}>
                    Nga mungesat
                  </button>
                </div>
                <textarea
                  value={correctionComment}
                  onChange={(event) => {
                    setCorrectionComment(event.target.value);
                    setCorrectionError("");
                  }}
                  placeholder="Shkruaj arsyen para se te kerkosh korrigjim..."
                />
                <div className="committee-correction-examples">
                  {correctionExamples.map((example) => (
                    <button
                      type="button"
                      key={example}
                      className={correctionComment === example ? "is-selected" : ""}
                      onClick={() => setCorrectionComment(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                {correctionError ? <p className="committee-review-error" role="alert">{correctionError}</p> : null}
              </section>

              <section className="committee-review-panel committee-metadata-compact-panel">
                <h5>Metadata</h5>
                <dl className="committee-metadata-detail-grid">
                  <div><dt>Tipi</dt><dd>{getMetadataItemTypeLabel(selectedMetadataPublication)}</dd></div>
                  <div><dt>Journal / Konferenca</dt><dd>{selectedMetadataPublication.venue || "-"}</dd></div>
                  <div><dt>Vendi i konferences</dt><dd>{selectedMetadataPublication.conferenceLocation || selectedMetadataPublication.conference_location || "-"}</dd></div>
                  <div><dt>Data/vendi i ngjarjes</dt><dd>{getConferenceEventValue(selectedMetadataPublication) || "-"}</dd></div>
                  <div><dt>Qëllimi / roli</dt><dd>{selectedMetadataPublication.presentationPurpose || selectedMetadataPublication.presentation_purpose || "-"}</dd></div>
                  <div><dt>Publisher</dt><dd>{selectedMetadataPublication.publisher || "-"}</dd></div>
                  <div><dt>Viti</dt><dd>{selectedMetadataPublication.publicationYear || selectedMetadataPublication.publication_year || formatDate(selectedMetadataPublication.publicationDate || selectedMetadataPublication.publication_date)}</dd></div>
                  <div><dt>Link burimor</dt><dd>{selectedMetadataPublication.sourceUrl || selectedMetadataPublication.source_url || "-"}</dd></div>
                  <div><dt>Dokumente</dt><dd>{getPublicationEvidenceItems(selectedMetadataPublication).length}</dd></div>
                  <div><dt>Burimi</dt><dd>{selectedMetadataPublication.metadataSource || selectedMetadataPublication.metadata_source || "manual"}</dd></div>
                  <div><dt>Metadata</dt><dd>{getMetadataStatus(selectedMetadataPublication)}</dd></div>
                  <div><dt>Autoret</dt><dd>{selectedAuthors.map((author, index) => getAuthorName(author) || `Autori ${index + 1}`).join(", ") || "-"}</dd></div>
                  <div><dt>Perkatesia institucionale UIBM</dt><dd>{hasUibmAffiliation(selectedMetadataPublication) ? "Po" : "Jo"}</dd></div>
                </dl>
              </section>

              <section className="committee-review-panel committee-metadata-documents-panel">
                <div className="committee-review-panel-head">
                  <h5>Dokumentet</h5>
                  <span>{selectedEvidenceItems.length} evidenca</span>
                </div>
                {selectedEvidenceItems.length ? (
                  <div className="committee-metadata-document-list">
                    {selectedEvidenceItems.map((document, index) => {
                      const documentUrl = document.url || document.fileUrl || document.file_url;
                      const documentLabel = document.label || document.name || document.filename || `Dokument ${index + 1}`;

                      return documentUrl ? (
                        <button
                          type="button"
                          key={`${documentLabel}-${index}`}
                          onClick={() => window.open(documentUrl, "_blank", "noopener,noreferrer")}
                        >
                          <FileText size={15} />
                          <span>
                            <strong>{documentLabel}</strong>
                            <small>{document.name || document.description || "Hap dokumentin"}</small>
                          </span>
                        </button>
                      ) : (
                        <span className="committee-metadata-document-note" key={`${documentLabel}-${index}`}>
                          <FileText size={15} />
                          <span>
                            <strong>{documentLabel}</strong>
                            <small>{document.name || document.description || "Evidencë tekstuale nga formulari"}</small>
                          </span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="committee-history-empty">Nuk ka dokumente ose evidenca te lidhura me kete rast.</p>
                )}
              </section>

              {metadataDrawerMode === "compare" ? (
                <section className="committee-review-panel committee-document-panel">
                  <h5>Dokumenti i ngarkuar</h5>
                  {selectedDocumentUrl ? (
                    <iframe title="Dokumenti i publikimit" src={selectedDocumentUrl} />
                  ) : (
                    <div className="committee-document-empty">
                      <FileText size={20} />
                      <strong>Nuk ka dokument te lidhur.</strong>
                      <span>Kontrollo metadata-n e regjistruar dhe kerko dokument shtese nese duhet.</span>
                    </div>
                  )}
                </section>
              ) : null}

              <section className="committee-review-history">
                <div className="committee-history-head">
                  <h5>Historik kontrolli</h5>
                  {selectedReview.history?.length ? <span>{selectedReview.history.length} veprime</span> : null}
                </div>
                {visibleHistory.length ? (
                  visibleHistory.map((entry) => (
                    <article key={entry.id}>
                      <span className={`committee-review-dot ${getReviewStatusConfig(entry.status).className}`} />
                      <div>
                        <strong>{entry.statusLabel}</strong>
                        <p>{entry.comment || "Pa koment shtese."}</p>
                        <small>{entry.actor} - {formatReviewDate(entry.createdAt)}</small>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="committee-history-empty">Ende nuk ka veprime ne kete kontroll.</p>
                )}
              </section>

              <div className="committee-review-action-bar">
                <button
                  type="button"
                  className="is-primary"
                  onClick={() => markMetadataOk(selectedMetadataPublication)}
                  disabled={!selectedCompleteness.isComplete}
                >
                  <CheckCircle2 size={16} />
                  Metadata OK
                </button>
                <button type="button" className="is-warning" onClick={() => requestMetadataCorrection(selectedMetadataPublication)}>
                  <AlertTriangle size={16} />
                  Kerko korrigjim
                </button>
                <button type="button" onClick={() => openPublicationDocument(selectedMetadataPublication)} disabled={!selectedDocumentUrl}>
                  <FileText size={16} />
                  Shiko dokumentin
                </button>
                <button type="button" onClick={() => setMetadataDrawerMode((mode) => (mode === "compare" ? "details" : "compare"))}>
                  <GitCompareArrows size={16} />
                  {metadataDrawerMode === "compare" ? "Fsheh dokumentin" : "Krahaso metadata"}
                </button>
              </div>
            </aside>
          </div>
        );
      })() : null}
    </section>
  );

  const renderDecisions = () => (
    <section className="committee-page-card committee-stats-only-card committee-decisions-section">
      <div className="committee-page-head committee-decisions-head">
        <div>
          <h3>Vendimet e komisionit</h3>
          <p>Statuset reale nga rimbursimet dhe kontrolli i metadata-s se publikimeve.</p>
        </div>
        <span className="committee-api-chip">Te dhena reale</span>
      </div>

      <div className="committee-decision-summary">
        <article>
          <span>Gjithsej</span>
          <strong>{decisionSummary.total}</strong>
        </article>
        <article>
          <span>Ne shqyrtim</span>
          <strong>{decisionSummary.inReview}</strong>
        </article>
        <article>
          <span>Korrigjime</span>
          <strong>{decisionSummary.corrections}</strong>
        </article>
        <article>
          <span>Te mbyllura</span>
          <strong>{decisionSummary.completed}</strong>
        </article>
      </div>

      <div className="committee-table-wrap">
        <table className="committee-table committee-decisions-table">
          <thead>
            <tr>
              <th>Burimi</th>
              <th>Rasti</th>
              <th>Aplikanti / autoret</th>
              <th>Njesia / burimi akademik</th>
              <th>Statusi</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {committeeDecisionRows.map((row) => (
              <tr key={`${row.source}-${row.id}`}>
                <td>
                  <span className="committee-decision-source">{row.source}</span>
                  <span className="committee-metadata-muted">{row.category}</span>
                </td>
                <td>
                  <strong className="committee-metadata-title">{row.title}</strong>
                  <span className="committee-metadata-muted">{row.id}</span>
                </td>
                <td>{row.actor}</td>
                <td>{row.unit}</td>
                <td>
                  <span className={`committee-decision-status ${getDecisionStatusClass(row.statusKey)}`}>
                    {row.status}
                  </span>
                </td>
                <td>{formatDate(row.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {committeeDecisionRows.length === 0 ? (
        <div className="committee-metadata-empty">
          <strong>Nuk ka vendime per filtrin aktual.</strong>
          <span>Vendimet shfaqen sapo komisioni pranon, shqyrton, kerkon korrigjim ose verifikon metadata.</span>
        </div>
      ) : null}
    </section>
  );

  const renderAudit = () => (
    <section className="committee-page-card committee-stats-only-card committee-audit-section">
      <div className="committee-page-head committee-decisions-head">
        <div>
          <h3>Auditimi i komisionit</h3>
          <p>Historiku i veprimeve nga rimbursimet dhe kontrolli i metadata-s.</p>
        </div>
        <span className="committee-api-chip">Historik real</span>
      </div>

      <div className="committee-table-wrap">
        <table className="committee-table committee-audit-table">
          <thead>
            <tr>
              <th>Burimi</th>
              <th>Rasti</th>
              <th>Veprimi</th>
              <th>Aktori</th>
              <th>Komenti</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className="committee-decision-source">{row.source}</span>
                </td>
                <td>
                  <strong className="committee-metadata-title">{row.title}</strong>
                </td>
                <td>
                  <span className={`committee-decision-status ${getDecisionStatusClass(row.statusKey)}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.actor}</td>
                <td>{row.note || "-"}</td>
                <td>{formatReviewDate(row.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {auditRows.length === 0 ? (
        <div className="committee-metadata-empty">
          <strong>Nuk ka historik për filtrin aktual.</strong>
          <span>Veprimet shfaqen pasi komisioni pranon, shqyrton, aprovon ose kërkon korrigjim.</span>
        </div>
      ) : null}
    </section>
  );

  const renderStatistics = () => (
    <section className="committee-page-card committee-stats-only-card">
      <div className="committee-page-head committee-stats-head">
        <div className="committee-stats-title-wrap">
          <span className="committee-stats-icon">
            <BarChart3 size={20} />
          </span>
          <div>
            <h3>Raporte sipas njësive akademike</h3>
            <p>Pamje krahasuese nga publikimet, projektet, rimbursimet dhe korrigjimet aktuale.</p>
          </div>
        </div>
        <span className="committee-api-chip">Të dhëna reale</span>
      </div>

      <div className="committee-chart-wrap">
        {filteredFacultyStats.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filteredFacultyStats} barGap={8} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
              <XAxis dataKey="faculty" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Bar dataKey="publikime" name="Publikime" radius={[8, 8, 0, 0]} fill="#153a63" />
              <Bar dataKey="projekte" name="Projekte" radius={[8, 8, 0, 0]} fill="#2e6aa6" />
              <Bar dataKey="rimbursime" name="Rimbursime" radius={[8, 8, 0, 0]} fill="#c9a24f" />
              <Bar dataKey="korrigjime" name="Korrigjime" radius={[8, 8, 0, 0]} fill="#b45309" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="committee-empty">Nuk ka ende të dhëna për raportim.</p>
        )}
      </div>

      <div className="committee-summary-grid">
        <article className="committee-summary-card">
          <span>Publikime Totale</span>
          <strong>{totals.publikime}</strong>
        </article>
        <article className="committee-summary-card">
          <span>Projekte Aktive</span>
          <strong>{totals.projekte}</strong>
        </article>
        <article className="committee-summary-card">
          <span>Rimbursime</span>
          <strong>{totals.rimbursime}</strong>
        </article>
        <article className="committee-summary-card">
          <span>Korrigjime</span>
          <strong>{totals.korrigjime}</strong>
        </article>
      </div>

      <div className="committee-table-wrap committee-dept-table-wrap">
        <table className="committee-table">
          <thead>
            <tr>
              <th>Fakulteti</th>
              <th>Departamenti</th>
              <th>Publikime</th>
              <th>Projekte</th>
              <th>Rimbursime</th>
              <th>Korrigjime</th>
            </tr>
          </thead>
          <tbody>
            {filteredFacultyStats.map((item) => (
              <tr key={item.faculty}>
                <td>{item.faculty}</td>
                <td>{item.department}</td>
                <td>{item.publikime}</td>
                <td>{item.projekte}</td>
                <td>{item.rimbursime}</td>
                <td>{item.korrigjime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredFacultyStats.length === 0 ? <p className="committee-empty">Nuk ka rezultate për kërkimin aktual.</p> : null}
    </section>
  );

  let resultCount = recentDashboardRows.length;
  let content = renderOverview();

  if (activePage === "Dorëzimet në Pritje") {
    resultCount = filteredPendingSubmissions.length;
    content = renderPendingSubmissions();
  }

  if (activePage === "Shqyrtimi") {
    resultCount = 0;
    content = (
      <ReimbursementReviewPanel
        role="committee"
        scope="review"
        searchQuery={searchQuery}
        title="Shqyrtimi i rimbursimeve"
        description="Kerkesat reale nga databaza per pranim, shqyrtim, korrigjim, aprovim ose refuzim nga komisioni."
        showReviewFilters
        canApprove={committeeProfile.systemRole === "committee"}
        onStatusUpdated={syncPendingSubmissionStatus}
      />
    );
  }

  if (activePage === "Metadata") {
    resultCount = filteredMetadataPublications.length;
    content = renderMetadata();
  }

  if (activePage === "Vendimet") {
    resultCount = committeeDecisionRows.length;
    content = renderDecisions();
  }

  if (activePage === "Auditimi") {
    resultCount = auditRows.length;
    content = renderAudit();
  }

  if (activePage === "Raporte") {
    resultCount = filteredFacultyStats.length;
    content = renderStatistics();
  }

  if (activePage === "Njoftime") {
    resultCount = notifications.length;
    content = (
      <section className="committee-page-card committee-stats-only-card">
        <div className="committee-page-head committee-settings-head">
          <div>
            <h3>Njoftime</h3>
            <p>Shiko njoftimet e fundit te komisionit dhe statusin e tyre.</p>
          </div>
          <button
            className="committee-settings-back"
            type="button"
            onClick={markAllNotificationsAsRead}
            disabled={unreadNotifications === 0}
          >
            Sheno te gjitha si te lexuara
          </button>
        </div>
        <div className="committee-notification-list-detailed">
          {notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`committee-notification-card ${item.isRead ? "is-read" : "is-unread"}`}
              onClick={() => markNotificationAsRead(item.id)}
            >
              <div className="committee-notification-card-meta">
                <span className="committee-notification-pill">{item.category || "Njoftim"}</span>
                <span>{item.createdAt}</span>
              </div>
              <h4>{item.title || item.text}</h4>
              <p>{item.description || item.text}</p>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (activePage === "Settings") {
    content = <CommitteeSettings onBack={() => setActivePage("Përmbledhje")} />;
  }

  return (
    <div className="committee-layout">
      <CommitteeSidebar activePage={activePage} onNavigate={setActivePage} navLabels={navLabels} />

      <div className="committee-main">
        <CommitteeTopBar
          activePage={activePage}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          resultCount={resultCount}
          notificationCount={unreadNotifications}
          notifications={notifications}
          onMarkAllRead={markAllNotificationsAsRead}
          onNotificationRead={markNotificationAsRead}
          onProfileAction={handleProfileAction}
          profileMenuItems={profileMenuItems}
          profile={committeeProfile}
        />
        <div className="committee-content">{content}</div>
      </div>

      {isEditProfileOpen ? (
        <div className="committee-modal-overlay" role="dialog" aria-modal="true">
          <div className="committee-modal">
            <div className="committee-modal-header">
              <div>
                <h3 className="committee-modal-title">Edit Profile</h3>
                <p className="committee-modal-subtitle">Përditësoni informacionin bazë të komisionit.</p>
              </div>
              <button
                className="committee-modal-close"
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                aria-label="Mbyll"
              >
                ×
              </button>
            </div>
            <form className="committee-modal-form" onSubmit={handleCommitteeSave}>
              <div className="committee-form-grid">
                <label className="committee-form-field">
                  <span>Emri</span>
                  <input value={committeeDraft.name} onChange={handleCommitteeFieldChange("name")} />
                </label>
                <label className="committee-form-field">
                  <span>Roli</span>
                  <input value={committeeDraft.role} onChange={handleCommitteeFieldChange("role")} />
                </label>
                <label className="committee-form-field">
                  <span>Email</span>
                  <input type="email" value={committeeDraft.email} onChange={handleCommitteeFieldChange("email")} />
                </label>
                <label className="committee-form-field">
                  <span>Njësia</span>
                  <input value={committeeDraft.unit} onChange={handleCommitteeFieldChange("unit")} />
                </label>
              </div>
              <div className="committee-modal-actions">
                <button type="button" className="committee-btn-secondary" onClick={() => setIsEditProfileOpen(false)}>
                  Anulo
                </button>
                <button type="submit" className="committee-btn-primary">
                  Ruaj ndryshimet
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
