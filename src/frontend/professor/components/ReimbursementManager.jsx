import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, FileText, Landmark, Loader2, Plus, Save, Trash2, Upload, Wallet } from "lucide-react";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  REIMBURSEMENT_TYPES,
  getAttachmentChecklist,
  getReimbursementSchema,
  getReimbursementType,
  getRequiredFields,
  requiresBank,
} from "../../../../shared/reimbursementSchema.js";

const REQUEST_TYPES = REIMBURSEMENT_TYPES;

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  received: "Pranuar",
  in_review: "Ne shqyrtim",
  needs_correction: "Kthyer per korrigjim",
  committee_approved: "Aprovuar nga komisioni",
  approved: "Aprovuar final",
  rejected: "Refuzuar",
  paid: "Paguar",
};

const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const KOSOVO_BANKS = [
  { name: "Banka Kombetare Tregtare Kosove", swift: "NCBAXKPR", ibanCodes: ["1701", "17"], logoSrc: "/bank-logos/bkt.svg" },
  { name: "ProCredit Bank Kosovo", swift: "MBKOXKPR", ibanCodes: ["1101", "11"], logoSrc: "/bank-logos/procredit.png" },
  { name: "Raiffeisen Bank Kosovo", swift: "RBKOXKPR", ibanCodes: ["1503", "1212", "1201", "12"], logoSrc: "/bank-logos/raiffeisen.svg" },
  { name: "TEB Bank Kosovo", swift: "TEBKXKPR", ibanCodes: ["1501", "15"], logoSrc: "/bank-logos/teb.svg" },
  { name: "NLB Banka", swift: "NLPRXKPR", ibanCodes: ["1301", "13"], logoSrc: "/bank-logos/nlb.png" },
  { name: "Banka per Biznes", swift: "BPBXXKPR", ibanCodes: ["1601", "16"], logoSrc: "/bank-logos/bpb.svg" },
  { name: "Ziraat Bank Kosovo", swift: "TCZBXKPR", ibanCodes: ["1801", "18"], logoSrc: "/bank-logos/ziraat.svg" },
  { name: "Isbank Kosovo", swift: "ISBKXKPR", ibanCodes: ["1901", "19"], logoSrc: "/bank-logos/isbank.svg" },
  { name: "PriBank", swift: "PHHAXKPR", ibanCodes: ["2101", "21"], logoSrc: "/bank-logos/pribank.svg" },
  { name: "Economic Bank", swift: "EKOMXKPR", ibanCodes: ["1401", "14"], logoSrc: "/bank-logos/economic.jpg" },
];

const FORM_STEPS = [
  { id: "basic", label: "Te dhenat baze" },
  { id: "academic", label: "Te dhenat akademike" },
  { id: "financial", label: "Financat" },
  { id: "documents", label: "Dokumentet" },
];

const PARTICIPATION_OPTIONS = ["Prezantim", "Poster", "Pjesemarrje", "Keynote", "Panelist", "Kryesues"];
const YES_NO_OPTIONS = ["", "Po", "Jo"];
const SCOPUS_OPTIONS = ["", "Q1", "Q2", "Q3", "Q4", "Jo e indeksuar", "Nuk aplikohet"];
const SPEAKER_TYPE_OPTIONS = ["", "Kumtese", "Poster", "Jo"];
const FIELD_OPTIONS = {
  participation: PARTICIPATION_OPTIONS,
  yesNo: YES_NO_OPTIONS,
  scopus: SCOPUS_OPTIONS,
  speakerType: SPEAKER_TYPE_OPTIONS,
};

const CONFERENCE_UI_LABELS = {
  conferenceTitle: "Emërtimi i ngjarjes",
  location: "Vendi",
  conferenceDate: "Data",
  organizer: "Organizatori",
  invitationProgram: "Ftesa dhe programi",
  abstractTitle: "Abstrakti dhe titulli i punimit",
  coParticipant: "Bashkautorët",
  acceptanceConfirmation: "Konfirmimi i pranimit të punimit",
  authorsAffiliation: "Autorët e punimit (affiliation)",
  speakerWithPaperPoster: "Folës me kumtesë/poster",
  chairPanelist: "Kryesues/panelist",
  artisticSportEvent: "Ngjarje artistike/sportive",
  eventPublicationLink: "Linku i publikimit të ngjarjes",
};

const CONFERENCE_UI_PLACEHOLDERS = {
  invitationProgram: "Vendos URL ose përshkrim të ftesës/programit",
  abstractTitle: "Shkruaj titullin dhe abstraktin e punimit",
  acceptanceConfirmation: "Vendos URL ose shënim për konfirmimin e pranimit",
  authorsAffiliation: "Shkruaj autorët dhe përkatësinë institucionale",
  eventPublicationLink: "Vendos linkun e ngjarjes ose publikimit",
};

const COST_CATEGORY_OPTIONS = [
  { value: "materialCost", label: "Materiale 40%" },
  { value: "administrativeCost", label: "Administrative 30%" },
  { value: "personnelCost", label: "Personel 20%" },
  { value: "otherCosts", label: "Tjera 10%" },
];

const PUBLICATION_READ_ONLY_FIELDS = new Set([
  "doi",
  "publicationTitle",
  "publicationType",
  "venue",
  "journal",
  "publisher",
  "publicationDate",
  "publicationYear",
  "publicationLink",
  "mainAuthor",
  "correspondingAuthor",
  "coauthors",
  "affiliation",
  "indexingPlatform",
  "impactFactor",
  "scopusQuartile",
  "volume",
  "issue",
  "pages",
  "issn",
  "isbn",
  "abstract",
]);

const PUBLICATION_LABELS = {
  publicationTitle: "Titulli i punimit",
  mainAuthor: "Autori kryesor",
  publicationType: "Lloji i publikimit",
  venue: "Revista / Konferenca",
  publisher: "Botuesi",
  coauthors: "Bashkautorët",
  affiliation: "Përkatësia e autorit",
  volume: "Vëllimi",
  issue: "Numri i artikullit",
  pages: "Faqet",
  indexingPlatform: "Indeksimi në platformë",
  impactFactor: "Faktori i ndikimit (IF)",
  scopusQuartile: "Kuartili Scopus",
};

const PUBLICATION_TYPE_LABELS = {
  journal_article: "Artikull reviste",
  conference_paper: "Punim konference",
  book: "Libër / Kapitull",
  book_chapter: "Libër / Kapitull",
};

const EMPTY_TEAM_MEMBER = {
  name: "",
  scientificGrade: "",
  academicUnit: "",
  phone: "",
  email: "",
  specialization: "",
  contribution: "",
};

const EMPTY_WORK_PLAN_ITEM = {
  activity: "",
  deadline: "",
  responsiblePerson: "",
  expectedResult: "",
};

const EMPTY_COST_ITEM = {
  item: "",
  category: "materialCost",
  quantity: "",
  unitCost: "",
  totalCost: "",
  description: "",
};

const RETIRED_REASON_FIELD = "pur" + "pose";

const CONFERENCE_MANUAL_FIELDS = new Set([
  "conferenceTitle",
  "location",
  "conferenceDate",
  "organizer",
  "eventPublicationLink",
]);

const CONFERENCE_PAPER_FIELDS = new Set([
  "mainAuthor",
  "coParticipant",
  "abstractTitle",
  "authorsAffiliation",
]);

const DEFAULT_FORM_VALUES = {
  applicantName: "",
  applicantEmail: "",
  applicantFaculty: "",
  applicantDepartment: "",
  applicantOffice: "",
  applicantOrcidId: "",
  scientificTitle: "",
  academicTitle: "",
  amount: "",
  currency: "EUR",
  iban: "",
  bankApplicantName: "",
  bankName: "",
  bankNameOther: "",
  detectedBankCode: "",
  bankDetectedAutomatically: false,
  bankSelectionSource: "",
  bankAccountNumber: "",
  swiftCode: "",
  bankCountry: "Kosove",
  publicationId: "",
  doi: "",
  publicationTitle: "",
  publicationType: "",
  venue: "",
  journal: "",
  publisher: "",
  abstract: "",
  publicationYear: "",
  publicationFee: "",
  affiliation: "",
  indexingPlatform: "",
  impactFactor: "",
  scopusQuartile: "",
  acceptanceDate: "",
  publicationDate: "",
  publicationLink: "",
  volume: "",
  issue: "",
  pages: "",
  issn: "",
  isbn: "",
  uibmDatabaseEvidence: "",
  mainAuthor: "",
  correspondingAuthor: "",
  coauthors: "",
  publicationConferenceDetails: "",
  conferenceLink: "",
  conferenceLocation: "",
  conferencePresentationDate: "",
  conferenceId: "",
  conferenceTitle: "",
  location: "",
  conferenceDate: "",
  eventPlaceDate: "",
  organizer: "",
  invitationProgram: "",
  abstractTitle: "",
  acceptanceConfirmation: "",
  authorsAffiliation: "",
  speakerWithPaperPoster: "",
  coParticipant: "",
  chairPanelist: "",
  artisticSportEvent: "",
  eventPublicationLink: "",
  participationType: "Prezantim",
  registrationFee: "",
  travelCost: "",
  accommodationCost: "",
  projectTitle: "",
  projectCode: "",
  projectRole: "",
  projectPeriod: "",
  fundingBody: "",
  budgetLine: "",
  projectDurationMonths: "",
  applyingUnit: "",
  deanName: "",
  deanPlace: "",
  deanPhone: "",
  deanEmail: "",
  deanWebsite: "",
  projectDescription: "",
  projectKeywords: "",
  projectImpact: "",
  workPlan: "",
  totalProjectCost: "",
  requestedFromUibm: "",
  materialCost: "",
  administrativeCost: "",
  personnelCost: "",
  otherCosts: "",
  detailedCostDescription: "",
  documentChecklist: {},
};

function createDefaultTeamMembers() {
  return [{ ...EMPTY_TEAM_MEMBER }];
}

function createDefaultWorkPlanItems() {
  return [{ ...EMPTY_WORK_PLAN_ITEM }];
}

function createDefaultCostItems() {
  return [{ ...EMPTY_COST_ITEM }];
}

function pickFirstText(...values) {
  return values
    .map((value) => String(value ?? "").trim())
    .find(Boolean) || "";
}

function pickOrcidTitle(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => pickFirstText(item.roleTitle, item.title, item.position, item.role, item.degree, item.qualification))
    .find(Boolean) || "";
}

function stripMarkup(value) {
  if (!value) return "";

  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCoauthors(value) {
  const text = stripMarkup(value);

  if (!text) {
    return [];
  }

  const separator = text.includes(";") ? /;/ : /\r?\n|,/;

  return text
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePublicationType(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[-\s]+/g, "_");

  if (["book_chapter", "chapter"].includes(normalized)) {
    return "book";
  }

  return normalized;
}

function getPublicationTypeLabel(value) {
  return PUBLICATION_TYPE_LABELS[normalizePublicationType(value)] || "";
}

function cleanDisplayValue(value) {
  return stripMarkup(value);
}

function createDisplayField(label, value, options = {}) {
  const cleanValue = cleanDisplayValue(value);

  if (!cleanValue) {
    return null;
  }

  return {
    label,
    value: cleanValue,
    href: options.href || "",
  };
}

function createChipDisplayField(label, values) {
  const cleanValues = values
    .map(cleanDisplayValue)
    .filter(Boolean);

  if (!cleanValues.length) {
    return null;
  }

  return {
    label,
    value: cleanValues,
    variant: "chips",
  };
}

function createAuthorListDisplayField(label, values) {
  const cleanValues = values
    .map(cleanDisplayValue)
    .filter(Boolean);

  return createDisplayField(label, cleanValues.join(", "));
}

function getPublicationDisplaySections(form) {
  const publicationType = normalizePublicationType(form.publicationType);
  const typeLabel = getPublicationTypeLabel(form.publicationType);
  const baseFields = [
    createDisplayField("Titulli i publikimit", form.publicationTitle),
    createDisplayField("Lloji i publikimit", typeLabel),
    createDisplayField("DOI", form.doi, form.doi ? { href: `https://doi.org/${form.doi}` } : {}),
  ].filter(Boolean);
  const authorFields = [
    createDisplayField(publicationType === "book" ? "Autori" : "Autori kryesor", form.mainAuthor),
    createDisplayField("Përkatësia e autorëve", form.affiliation),
  ].filter(Boolean);

  if (publicationType === "conference_paper") {
    return [
      { title: "Informacion bazë", fields: baseFields },
      { title: "Autorët", fields: authorFields },
      {
        title: "Informacion bibliografik",
        fields: [
          createDisplayField("Emri i konferencës / Proceedings / Venue", form.venue || form.journal),
          createDisplayField("Botuesi", form.publisher),
          createDisplayField("ISBN", form.isbn),
          createDisplayField("ISSN", form.issn),
          createDisplayField("Data e publikimit", form.publicationDate || form.publicationYear),
          createDisplayField("Faqet", form.pages),
        ].filter(Boolean),
      },
      {
        title: "Indeksimi",
        fields: [
          createDisplayField("Platforma e indeksimit", form.indexingPlatform),
          createDisplayField("Quartile", form.scopusQuartile),
        ].filter(Boolean),
      },
    ].filter((section) => section.fields.length);
  }

  if (publicationType === "book") {
    return [
      { title: "Informacion bazë", fields: baseFields },
      { title: "Autorët", fields: authorFields },
      {
        title: "Informacion bibliografik",
        fields: [
          createDisplayField("Botuesi", form.publisher),
          createDisplayField("ISBN", form.isbn),
          createDisplayField("Data e publikimit", form.publicationDate || form.publicationYear),
          createDisplayField("Faqet", form.pages),
        ].filter(Boolean),
      },
    ].filter((section) => section.fields.length);
  }

  return [
    { title: "Informacion bazë", fields: baseFields },
    { title: "Autorët", fields: authorFields },
    {
      title: "Informacion bibliografik",
      fields: [
        createDisplayField("Revista", form.venue || form.journal),
        createDisplayField("Botuesi", form.publisher),
        createDisplayField("ISSN", form.issn),
        createDisplayField("Data e publikimit", form.publicationDate || form.publicationYear),
        createDisplayField("Vëllimi", form.volume),
        createDisplayField("Numri i artikullit", form.issue),
        createDisplayField("Faqet", form.pages),
      ].filter(Boolean),
    },
    {
      title: "Indeksimi dhe impact factor",
      fields: [
        createDisplayField("Platforma e indeksimit", form.indexingPlatform),
        createDisplayField("Impact Factor", form.impactFactor),
        createDisplayField("Quartile", form.scopusQuartile),
      ].filter(Boolean),
    },
  ].filter((section) => section.fields.length);
}

function getPublicationMetadataDisplaySection(form) {
  const publicationType = normalizePublicationType(form.publicationType);
  const typeLabel = getPublicationTypeLabel(form.publicationType);
  const coauthors = splitCoauthors(form.coauthors);
  const doiField = createDisplayField("DOI", form.doi, form.doi ? { href: `https://doi.org/${form.doi}` } : {});
  const commonStart = [
    createDisplayField("Titulli i publikimit", form.publicationTitle),
    createDisplayField("Lloji i publikimit", typeLabel),
    createDisplayField("Burimi i publikimit", form.venue || form.journal),
    createDisplayField("Shtëpia botuese", form.publisher),
    createDisplayField("Data e publikimit", form.publicationDate || form.publicationYear),
    createDisplayField("Faqet", form.pages),
    createDisplayField("ISSN", form.issn),
    createDisplayField("ISBN", form.isbn),
  ];

  if (publicationType === "book") {
    return {
      title: "",
      fields: [
        ...commonStart,
        createDisplayField("Autorët", form.mainAuthor),
        createAuthorListDisplayField("Bashkautorët", coauthors),
        doiField,
      ].filter(Boolean),
    };
  }

  if (publicationType === "conference_paper") {
    return {
      title: "",
      fields: [
        ...commonStart,
        createDisplayField("Autori kryesor", form.mainAuthor),
        createAuthorListDisplayField("Bashkautorët", coauthors),
        createDisplayField("Përkatësia e autorëve", form.affiliation),
        doiField,
        createDisplayField("Platforma e indeksimit", form.indexingPlatform),
        createDisplayField("Quartile", form.scopusQuartile),
      ].filter(Boolean),
    };
  }

  return {
    title: "",
    fields: [
      createDisplayField("Titulli i publikimit", form.publicationTitle),
      createDisplayField("Lloji i publikimit", typeLabel),
      createDisplayField("Burimi i publikimit", form.venue || form.journal),
      createDisplayField("Shtëpia botuese", form.publisher),
      createDisplayField("Data e publikimit", form.publicationDate || form.publicationYear),
      createDisplayField("Vëllimi", form.volume),
      createDisplayField("Numri i artikullit", form.issue),
      createDisplayField("Faqet", form.pages),
      createDisplayField("ISSN", form.issn),
      createDisplayField("ISBN", form.isbn),
      createDisplayField("Autori kryesor", form.mainAuthor),
      createAuthorListDisplayField("Bashkautorët", coauthors),
      createDisplayField("Përkatësia e autorëve", form.affiliation),
      doiField,
      createDisplayField("Platforma e indeksimit", form.indexingPlatform),
      createDisplayField("Impact Factor", form.impactFactor),
      createDisplayField("Quartile", form.scopusQuartile),
    ].filter(Boolean),
  };
}

function resolveProfile(contextProfile, profile) {
  const orcidEducations = Array.isArray(contextProfile?.orcidEducations)
    ? contextProfile.orcidEducations
    : Array.isArray(profile?.orcidEducations)
      ? profile.orcidEducations
      : [];
  const orcidEmployments = Array.isArray(contextProfile?.orcidEmployments)
    ? contextProfile.orcidEmployments
    : Array.isArray(profile?.orcidEmployments)
      ? profile.orcidEmployments
      : [];

  return {
    name: contextProfile?.name || profile?.name || "",
    email: contextProfile?.email || profile?.email || "",
    faculty: contextProfile?.faculty || profile?.faculty || "",
    department: contextProfile?.department || profile?.department || "",
    office: contextProfile?.office || profile?.office || "",
    orcidId: contextProfile?.orcidId || profile?.orcidId || "",
    scientificTitle: contextProfile?.scientificTitle || profile?.scientificTitle || pickOrcidTitle(orcidEducations),
    academicTitle: contextProfile?.academicTitle || profile?.academicTitle || pickOrcidTitle(orcidEmployments),
    orcidEducations,
    orcidEmployments,
  };
}

function getAutoFieldDefaults(profile) {
  return {
    applicantName: profile.name || "",
    applicantEmail: profile.email || "",
    applicantFaculty: profile.faculty || "",
    applicantDepartment: profile.department || "",
    applicantOffice: profile.office || "",
    applicantOrcidId: profile.orcidId || "",
    scientificTitle: profile.scientificTitle || "",
    academicTitle: profile.academicTitle || "",
    bankApplicantName: profile.name || "",
    applyingUnit: profile.faculty || "",
  };
}

function createDefaultForm(profile = {}) {
  return {
    ...DEFAULT_FORM_VALUES,
    ...getAutoFieldDefaults(profile),
    teamMembers: createDefaultTeamMembers(),
    workPlanItems: createDefaultWorkPlanItems(),
    costItems: createDefaultCostItems(),
    documentChecklist: {},
  };
}

function normalizeInputDate(value) {
  if (!value) {
    return "";
  }

  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function authorName(author = {}) {
  const safeAuthor = author || {};

  return String(
    safeAuthor.fullName
    || safeAuthor.full_name
    || [safeAuthor.givenName || safeAuthor.given_name, safeAuthor.familyName || safeAuthor.family_name].filter(Boolean).join(" ")
    || ""
  ).trim();
}

function authorAffiliation(author = {}) {
  return String((author || {}).affiliation || "").trim();
}

function getPublicationAuthorFields(publication, options = {}) {
  const authors = Array.isArray(publication?.authors) ? publication.authors : [];
  const coauthorSeparator = options.coauthorSeparator || "; ";
  const mainAuthor = authors.find((author) => author.isMainAuthor || author.is_main_author) || authors[0] || null;
  const correspondingAuthor = authors.find((author) => author.isCorrespondingAuthor || author.is_corresponding_author) || mainAuthor;
  const mainName = authorName(mainAuthor);
  const correspondingName = authorName(correspondingAuthor);
  const coauthors = authors
    .filter((author) => authorName(author) && authorName(author) !== mainName)
    .map(authorName)
    .join(coauthorSeparator);
  const affiliation = authorAffiliation(mainAuthor) || authorAffiliation(authors.find((author) => authorAffiliation(author)));

  return {
    mainAuthor: mainName,
    correspondingAuthor: correspondingName,
    coauthors,
    affiliation,
  };
}

function getPublicationAuthorAffiliations(publication) {
  const authors = Array.isArray(publication?.authors) ? publication.authors : [];
  const affiliations = authors
    .map((author) => {
      const name = authorName(author);
      const affiliation = authorAffiliation(author);

      return name && affiliation ? `${name} — ${affiliation}` : "";
    })
    .filter(Boolean);

  return affiliations.join("\n");
}

function getPublicationWorkSummary(publication) {
  const title = cleanDisplayValue(publication?.title);
  const abstract = cleanDisplayValue(publication?.abstract);

  return [
    title ? `Titulli: ${title}` : "",
    abstract ? `Abstrakti: ${abstract}` : "",
  ].filter(Boolean).join("\n\n");
}

function getPublicationDoiLink(publication) {
  const doi = cleanDisplayValue(publication?.doi);

  return doi ? `https://doi.org/${doi}` : "";
}

function getPublicationIndexingFields(publication) {
  const indexing = Array.isArray(publication?.indexing) ? publication.indexing : [];
  const indexingPlatform = indexing
    .map((item) => item.source || "")
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(", ");
  const impactFactor = indexing.find((item) => item.impactFactor || item.impact_factor)?.impactFactor
    || indexing.find((item) => item.impactFactor || item.impact_factor)?.impact_factor
    || "";
  const scopusQuartile = indexing.find((item) => item.quartile)?.quartile || "";

  return {
    indexingPlatform,
    impactFactor,
    scopusQuartile,
  };
}

function applyPublicationToForm(prev, publication) {
  if (!publication) {
    const next = { ...prev };
    PUBLICATION_READ_ONLY_FIELDS.forEach((field) => {
      next[field] = "";
    });
    return next;
  }

  const authors = getPublicationAuthorFields(publication);
  const indexing = getPublicationIndexingFields(publication);
  const venue = publication.venue || publication.journal || "";

  return {
    ...prev,
    publicationId: publication.id ? String(publication.id) : prev.publicationId,
    doi: publication.doi || "",
    publicationTitle: publication.title || "",
    publicationType: publication.publicationType || publication.publication_type || "",
    venue,
    journal: venue,
    publisher: publication.publisher || "",
    abstract: publication.abstract || "",
    publicationDate: normalizeInputDate(publication.publicationDate || publication.publication_date),
    publicationYear: publication.publicationYear || publication.publication_year || publication.year || "",
    publicationLink: publication.sourceUrl || publication.source_url || "",
    volume: publication.volume || "",
    issue: publication.issue || "",
    pages: publication.pages || "",
    issn: publication.issn || "",
    isbn: publication.isbn || "",
    mainAuthor: authors.mainAuthor,
    correspondingAuthor: authors.correspondingAuthor,
    coauthors: authors.coauthors,
    affiliation: authors.affiliation || "",
    indexingPlatform: indexing.indexingPlatform,
    impactFactor: indexing.impactFactor,
    scopusQuartile: indexing.scopusQuartile,
  };
}

function normalizeDate(value) {
  if (!value) {
    return "";
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

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.some(hasValue);
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(hasValue);
  }

  return String(value ?? "").trim() !== "";
}

function buildSubmitFormData(formData) {
  const nextFormData = { ...formData };
  delete nextFormData[RETIRED_REASON_FIELD];

  if (nextFormData.banking && typeof nextFormData.banking === "object" && !Array.isArray(nextFormData.banking)) {
    const nextBanking = { ...nextFormData.banking };
    delete nextBanking.description;
    nextFormData.banking = nextBanking;
  }

  return nextFormData;
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function formatNumericValue(value) {
  const number = toNumber(value);
  return number === null ? "" : String(Math.round(number * 100) / 100);
}

function hasCompleteWorkPlanItem(items) {
  return Array.isArray(items) && items.some((item) =>
    hasValue(item.activity)
    && hasValue(item.deadline)
    && hasValue(item.responsiblePerson)
    && hasValue(item.expectedResult)
  );
}

function hasCompleteCostItem(items) {
  return Array.isArray(items) && items.some((item) =>
    hasValue(item.item)
    && hasValue(item.quantity)
    && hasValue(item.unitCost)
    && hasValue(item.totalCost)
  );
}

function getProjectBudgetDistributionTotal(form) {
  return ["materialCost", "administrativeCost", "personnelCost", "otherCosts"]
    .map((field) => toNumber(form[field]) || 0)
    .reduce((total, value) => total + value, 0);
}

function normalizeIban(value) {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
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

function detectKosovoBankFromAccount(value) {
  const identifiers = getBankIdentifiersFromAccount(value);

  if (!identifiers.length) {
    return null;
  }

  return KOSOVO_BANKS.find((bank) => identifiers.some((code) => bank.ibanCodes.includes(code))) || null;
}

function getBankByName(name) {
  return KOSOVO_BANKS.find((bank) => bank.name === name) || null;
}

function isValidSwift(value) {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(value ?? "").trim().toUpperCase());
}

function formatMoneyPreview(amount, currency = "EUR") {
  const numericAmount = Number(String(amount ?? "").replace(",", "."));

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount) + ` ${currency || "EUR"}`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    };
    reader.onerror = () => reject(new Error(`Fajlli ${file.name} nuk u lexua.`));
    reader.readAsDataURL(file);
  });
}

function formatBytes(value) {
  const size = Number(value || 0);

  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAmount(request) {
  if (request.amount === null || request.amount === undefined || request.amount === "") {
    return "Pa shume";
  }

  if (typeof request.amount === "string" && !request.currency) {
    return request.amount;
  }

  return `${request.amount} ${request.currency || "EUR"}`;
}

function normalizeLegacyRows(rows) {
  return rows.map((row, index) => ({
    id: `legacy-${index}-${row.request}`,
    title: row.request,
    requestTypeLabel: "Historik",
    amount: row.amount,
    currency: "",
    submittedAt: row.submitted,
    status: row.status,
    isLegacy: true,
  }));
}

function getLatestHistoryLabel(history = []) {
  const latest = history[history.length - 1];

  if (!latest) {
    return "";
  }

  const label = STATUS_LABELS[latest.status] || latest.status || "";
  const date = normalizeDate(latest.createdAt);

  return [label, date].filter(Boolean).join(" | ");
}

function ReimbursementHistoryList({
  r,
  tx,
  visibleRequests,
  downloadingDocument,
  error,
  onDownloadDocument,
  onEditRequest,
  renderAttachments,
  renderStatusTimeline,
}) {
  return (
    <article className="prof-card reimbursement-list-card">
      <div className="prof-card-header">
        <div>
          <h3>{r.sentTitle}</h3>
          <p>{r.sentDescription}</p>
        </div>
      </div>

      {error ? <p className="reimbursement-message error" role="alert">{tx(error)}</p> : null}

      <div className="prof-list reimbursement-request-list">
        {visibleRequests.length ? (
          visibleRequests.map((request) => (
            <div className="prof-list-item reimbursement-request-item" key={request.id}>
              <div className="prof-list-icon">
                <Wallet size={20} />
              </div>
              <div className="prof-list-content">
                <h4>{request.title}</h4>
                <p>
                  {[tx(request.requestTypeLabel), formatAmount(request), normalizeDate(request.submittedAt || request.createdAt)]
                    .filter(Boolean)
                    .join(" | ")}
                </p>
                {request.statusHistory?.length ? (
                  <p className="reimbursement-history-line">
                    {r.latestHistory}: {tx(getLatestHistoryLabel(request.statusHistory))}
                  </p>
                ) : null}
                {renderAttachments(request)}
                {renderStatusTimeline(request.statusHistory)}
              </div>
              <div className="reimbursement-request-actions">
                <span className={`status-badge ${String(request.status).toLowerCase().replace(/\s+/g, "-")}`}>
                  {tx(request.statusLabel || STATUS_LABELS[request.status] || request.status)}
                </span>
                {!request.isLegacy ? (
                  <>
                    {["draft", "needs_correction"].includes(request.status) ? (
                      <button
                        type="button"
                        className="reimbursement-download-btn"
                        onClick={() => onEditRequest(request)}
                      >
                        {r.edit}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="reimbursement-download-btn"
                      onClick={() => onDownloadDocument(request, "pdf")}
                      disabled={downloadingDocument === `${request.id}-pdf`}
                    >
                      <Download size={16} />
                      {downloadingDocument === `${request.id}-pdf` ? "PDF..." : "PDF"}
                    </button>
                    <button
                      type="button"
                      className="reimbursement-download-btn"
                      onClick={() => onDownloadDocument(request, "docx")}
                      disabled={downloadingDocument === `${request.id}-docx`}
                    >
                      <Download size={16} />
                      {downloadingDocument === `${request.id}-docx` ? "DOCX..." : "DOCX"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="reimbursement-empty">
            {r.empty}
          </div>
        )}
      </div>
    </article>
  );
}

export default function ReimbursementManager({ profile, searchQuery = "", fallbackRows = [], view = "create", onNavigate }) {
  const { t, tx } = useLanguage();
  const r = t("professor.reimbursements");
  const [selectedType, setSelectedType] = useState("publication");
  const [form, setForm] = useState(() => createDefaultForm());
  const [context, setContext] = useState({
    profile: null,
    publications: [],
    conferences: [],
  });
  const [requests, setRequests] = useState([]);
  const [hasLoadedRequests, setHasLoadedRequests] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingDocument, setDownloadingDocument] = useState("");
  const [previewingDocument, setPreviewingDocument] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingRequest, setEditingRequest] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const [hasHydratedAutoFields, setHasHydratedAutoFields] = useState(false);
  const [hasHydratedPublicationFields, setHasHydratedPublicationFields] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const effectiveProfile = useMemo(
    () => resolveProfile(context.profile, profile),
    [context.profile, profile]
  );

  const selectedTypeConfig = getReimbursementType(selectedType);
  const selectedTypeSchema = getReimbursementSchema(selectedType);
  const selectedAttachmentChecklist = getAttachmentChecklist(selectedType);
  const bankRequired = requiresBank(selectedType);
  const normalizedAccount = useMemo(() => normalizeIban(form.bankAccountNumber || form.iban), [form.bankAccountNumber, form.iban]);
  const isAccountNumberValid = useMemo(() => isValidBankAccountIdentifier(normalizedAccount), [normalizedAccount]);
  const detectedBank = useMemo(() => detectKosovoBankFromAccount(normalizedAccount), [normalizedAccount]);
  const selectedBank = useMemo(() => getBankByName(form.bankName), [form.bankName]);
  const visualBank = selectedBank || detectedBank;
  const amountPreview = useMemo(() => formatMoneyPreview(form.amount, form.currency), [form.amount, form.currency]);
  const stepStates = useMemo(() => {
    const academicMainField = selectedType === "conference"
      ? "conferenceTitle"
      : selectedType === "project"
        ? "projectTitle"
        : "publicationTitle";

    return {
      basic: hasValue(form.applicantName) && hasValue(form.applicantEmail) && hasValue(form.applicantFaculty),
      academic: hasValue(form[academicMainField]),
      financial:
        Number(String(form.amount || "").replace(",", ".")) > 0
        && (
          bankRequired
            ? isAccountNumberValid && hasValue(form.bankName) && isValidSwift(form.swiftCode)
            : hasValue(form.requestedFromUibm) && hasCompleteCostItem(form.costItems)
        ),
      documents: selectedAttachmentChecklist
        .filter((item) => item.required)
        .every((item) => Boolean(form.documentChecklist?.[item.id])),
    };
  }, [bankRequired, form, isAccountNumberValid, selectedAttachmentChecklist, selectedType]);

  const visibleRequests = useMemo(() => {
    const rows = hasLoadedRequests ? requests : normalizeLegacyRows(fallbackRows);
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) =>
      `${row.title} ${row.requestTypeLabel} ${row.amount} ${row.currency} ${row.status} ${row.submittedAt}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [fallbackRows, hasLoadedRequests, requests, searchQuery]);

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      setIsLoadingContext(true);

      try {
        const response = await fetch(apiUrl("/reimbursements/context"), {
          credentials: "include",
        });

        if (response.status === 401) {
          throw new Error("Sesioni nuk eshte aktiv. Kyquni me Google per te derguar rimbursim.");
        }

        if (!response.ok) {
          throw new Error("Te dhenat automatike nuk u ngarkuan.");
        }

        const data = await response.json();

        if (isMounted) {
          setContext({
            profile: data.profile || null,
            publications: Array.isArray(data.publications) ? data.publications : [],
            conferences: Array.isArray(data.conferences) ? data.conferences : [],
          });
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "Nuk u ngarkua konteksti i rimbursimeve.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingContext(false);
        }
      }
    }

    async function loadRequests() {
      try {
        const response = await fetch(apiUrl("/reimbursements"), {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (isMounted) {
          setRequests(Array.isArray(data) ? data : []);
          setHasLoadedRequests(true);
        }
      } catch {
        if (isMounted) {
          setHasLoadedRequests(false);
        }
      }
    }

    loadContext();
    loadRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingContext || hasHydratedAutoFields) {
      return;
    }

    const defaults = getAutoFieldDefaults(effectiveProfile);
    const hasAnyProfileValue = Object.values(defaults).some(Boolean);

    if (!hasAnyProfileValue) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      applicantName: prev.applicantName || defaults.applicantName,
      applicantEmail: prev.applicantEmail || defaults.applicantEmail,
      applicantFaculty: prev.applicantFaculty || defaults.applicantFaculty,
      applicantDepartment: prev.applicantDepartment || defaults.applicantDepartment,
      applicantOffice: prev.applicantOffice || defaults.applicantOffice,
      applicantOrcidId: prev.applicantOrcidId || defaults.applicantOrcidId,
      scientificTitle: prev.scientificTitle || defaults.scientificTitle,
      academicTitle: prev.academicTitle || defaults.academicTitle,
      bankApplicantName: prev.bankApplicantName || defaults.bankApplicantName,
      applyingUnit: prev.applyingUnit || defaults.applyingUnit,
    }));
    setHasHydratedAutoFields(true);
  }, [effectiveProfile, hasHydratedAutoFields, isLoadingContext]);

  useEffect(() => {
    if (
      isLoadingContext ||
      hasHydratedPublicationFields ||
      selectedType !== "publication" ||
      context.publications.length === 0
    ) {
      return;
    }

    setForm((prev) => {
      if (prev.publicationId || prev.doi || prev.publicationTitle) {
        return prev;
      }

      return applyPublicationToForm(prev, context.publications[0]);
    });
    setHasHydratedPublicationFields(true);
  }, [context.publications, hasHydratedPublicationFields, isLoadingContext, selectedType]);

  useEffect(() => {
    setForm((prev) => {
      if (!bankRequired) {
        return prev.bankName || prev.swiftCode || prev.bankDetectedAutomatically || prev.detectedBankCode || prev.bankSelectionSource
          ? {
              ...prev,
              bankName: "",
              swiftCode: "",
              detectedBankCode: "",
              bankDetectedAutomatically: false,
              bankSelectionSource: "",
            }
          : prev;
      }

      if (!normalizedAccount) {
        return prev.bankName || prev.swiftCode || prev.bankDetectedAutomatically || prev.detectedBankCode || prev.bankSelectionSource
          ? {
              ...prev,
              bankName: "",
              swiftCode: "",
              detectedBankCode: "",
              bankDetectedAutomatically: false,
              bankSelectionSource: "",
            }
          : prev;
      }

      if (!detectedBank) {
        return prev.bankName || prev.swiftCode || prev.bankDetectedAutomatically || prev.detectedBankCode || prev.bankSelectionSource
          ? {
              ...prev,
              bankName: "",
              swiftCode: "",
              detectedBankCode: "",
              bankDetectedAutomatically: false,
              bankSelectionSource: "",
            }
          : prev;
      }

      const detectedCode = getBankIdentifiersFromAccount(normalizedAccount).find((code) => detectedBank.ibanCodes.includes(code)) || "";

      if (
        prev.bankName === detectedBank.name
        && prev.swiftCode === detectedBank.swift
        && prev.detectedBankCode === detectedCode
        && prev.bankDetectedAutomatically
        && prev.bankSelectionSource === "auto"
      ) {
        return prev;
      }

      return {
        ...prev,
        bankName: detectedBank.name,
        swiftCode: detectedBank.swift || prev.swiftCode,
        detectedBankCode: detectedCode,
        bankDetectedAutomatically: true,
        bankSelectionSource: "auto",
      };
    });
    setFieldErrors((prev) => {
      if (!prev.bankName && !prev.bankAccountNumber && !prev.swiftCode) {
        return prev;
      }

      return {
        ...prev,
        bankName: detectedBank ? "" : prev.bankName,
        bankAccountNumber: "",
        swiftCode: detectedBank ? "" : prev.swiftCode,
      };
    });
  }, [bankRequired, detectedBank, normalizedAccount]);

  const handleFieldChange = (field) => (event) => {
    const nextValue = event.target.value;

    if (selectedType === "publication" && PUBLICATION_READ_ONLY_FIELDS.has(field)) {
      return;
    }

    setForm((prev) => {
      const nextForm = { ...prev, [field]: nextValue };

      if (field === "bankAccountNumber") {
        nextForm.bankAccountNumber = normalizeIban(nextValue);
        nextForm.iban = nextForm.bankAccountNumber;
      }

      if (field === "swiftCode") {
        nextForm.swiftCode = nextValue.toUpperCase();
      }

      if (field === "bankName") {
        const selectedBank = getBankByName(nextValue);
        nextForm.bankSelectionSource = nextValue ? "manual" : "";
        nextForm.bankDetectedAutomatically = false;
        nextForm.detectedBankCode = "";
        nextForm.swiftCode = selectedBank?.swift || "";
      }

      return nextForm;
    });
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleTeamMemberChange = (index, field) => (event) => {
    setForm((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [field]: event.target.value } : member
      ),
    }));
  };

  const handleWorkPlanItemChange = (index, field) => (event) => {
    const value = event.target.value;

    setForm((prev) => ({
      ...prev,
      workPlanItems: (prev.workPlanItems || createDefaultWorkPlanItems()).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
    setFieldErrors((prev) => ({ ...prev, workPlanItems: "" }));
  };

  const handleCostItemChange = (index, field) => (event) => {
    const value = event.target.value;

    setForm((prev) => ({
      ...prev,
      costItems: (prev.costItems || createDefaultCostItems()).map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextItem = { ...item, [field]: value };
        const quantity = field === "quantity" ? value : nextItem.quantity;
        const unitCost = field === "unitCost" ? value : nextItem.unitCost;
        const quantityNumber = toNumber(quantity);
        const unitCostNumber = toNumber(unitCost);

        if (quantityNumber !== null && unitCostNumber !== null) {
          nextItem.totalCost = formatNumericValue(quantityNumber * unitCostNumber);
        }

        return nextItem;
      }),
    }));
    setFieldErrors((prev) => ({ ...prev, costItems: "" }));
  };

  const handleDocumentChecklistChange = (id) => (event) => {
    setForm((prev) => ({
      ...prev,
      documentChecklist: {
        ...(prev.documentChecklist || {}),
        [id]: event.target.checked,
      },
    }));
    setFieldErrors((prev) => ({ ...prev, [`documentChecklist.${id}`]: "" }));
  };

  const addTeamMember = () => {
    setForm((prev) => ({
      ...prev,
      teamMembers: [...prev.teamMembers, { ...EMPTY_TEAM_MEMBER }],
    }));
  };

  const removeTeamMember = (index) => {
    setForm((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.length > 1
        ? prev.teamMembers.filter((_, memberIndex) => memberIndex !== index)
        : createDefaultTeamMembers(),
    }));
  };

  const addWorkPlanItem = () => {
    setForm((prev) => ({
      ...prev,
      workPlanItems: [...(prev.workPlanItems || []), { ...EMPTY_WORK_PLAN_ITEM }],
    }));
  };

  const removeWorkPlanItem = (index) => {
    setForm((prev) => ({
      ...prev,
      workPlanItems: (prev.workPlanItems || []).length > 1
        ? prev.workPlanItems.filter((_, itemIndex) => itemIndex !== index)
        : createDefaultWorkPlanItems(),
    }));
  };

  const addCostItem = () => {
    setForm((prev) => ({
      ...prev,
      costItems: [...(prev.costItems || []), { ...EMPTY_COST_ITEM }],
    }));
  };

  const removeCostItem = (index) => {
    setForm((prev) => ({
      ...prev,
      costItems: (prev.costItems || []).length > 1
        ? prev.costItems.filter((_, itemIndex) => itemIndex !== index)
        : createDefaultCostItems(),
    }));
  };

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    setForm((prev) => ({
      ...prev,
      documentChecklist: {},
    }));
    setIsAbstractExpanded(false);
    setFieldErrors({});
    setError("");
    setSuccess(null);
  };

  const handlePublicationSelect = (event) => {
    const publicationId = event.target.value;
    const selectedPublication = context.publications.find((item) => String(item.id) === publicationId);

    setForm((prev) => applyPublicationToForm({ ...prev, publicationId }, selectedPublication));
    setIsAbstractExpanded(false);
    setFieldErrors((prev) => ({ ...prev, publicationId: "" }));
  };

  const handleConferencePublicationSelect = (event) => {
    const publicationId = event.target.value;
    const selectedPublication = context.publications.find((item) => String(item.id) === publicationId);

    if (!selectedPublication) {
      setForm((prev) => ({ ...prev, publicationId }));
      return;
    }

    const authors = getPublicationAuthorFields(selectedPublication, { coauthorSeparator: ", " });
    const affiliations = getPublicationAuthorAffiliations(selectedPublication);

    setForm((prev) => ({
      ...prev,
      publicationId,
      mainAuthor: authors.mainAuthor,
      coParticipant: authors.coauthors,
      abstractTitle: getPublicationWorkSummary(selectedPublication),
      authorsAffiliation: affiliations,
      eventPublicationLink: getPublicationDoiLink(selectedPublication),
    }));
  };

  const validateForm = (action) => {
    const nextErrors = {};

    if (action === "draft") {
      if (form.amount && Number.isNaN(Number(String(form.amount).replace(",", ".")))) {
        nextErrors.amount = "Shuma duhet te jete numer valid.";
      }

      setFieldErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    }

    getRequiredFields(selectedType).forEach(([field, message]) => {
      if (!hasValue(form[field])) {
        nextErrors[field] = message;
      }
    });

    selectedAttachmentChecklist
      .filter((item) => item.required)
      .forEach((item) => {
        if (!form.documentChecklist?.[item.id]) {
          nextErrors[`documentChecklist.${item.id}`] = `Konfirmo dokumentin mbeshtetes: ${item.label}.`;
        }
      });

    if (selectedType === "project") {
      const hasTeamMember = form.teamMembers?.some((member) => hasValue(member.name) && hasValue(member.email));

      if (!hasTeamMember) {
        nextErrors.teamMembers = "Shto se paku nje anetar me emer dhe email.";
      }
    }

    if (form.amount && Number.isNaN(Number(String(form.amount).replace(",", ".")))) {
      nextErrors.amount = "Shuma duhet te jete numer valid.";
    }

    if (!form.amount || Number(String(form.amount).replace(",", ".")) <= 0) {
      nextErrors.amount = "Shuma e kerkuar duhet te jete numer pozitiv.";
    }

    if (bankRequired) {
      const submittedAccount = form.bankAccountNumber || form.iban;

      if (submittedAccount && !isValidBankAccountIdentifier(submittedAccount)) {
        nextErrors.bankAccountNumber = "Shkruaj IBAN valid te Kosoves ose numer vendor numerik te llogarise.";
      }

      const submittedDetectedBank = detectKosovoBankFromAccount(submittedAccount);

      if (submittedDetectedBank) {
        delete nextErrors.bankName;
        delete nextErrors.swiftCode;
      } else if (!hasValue(form.bankName)) {
        nextErrors.bankName = "Banka nuk u identifikua nga numri i llogarise.";
      }

      if (!isValidSwift(submittedDetectedBank?.swift || form.swiftCode)) {
        nextErrors.swiftCode = "SWIFT/BIC duhet te kete 8 ose 11 karaktere valide.";
      }
    }

    if (selectedType === "project") {
      if (!hasCompleteWorkPlanItem(form.workPlanItems)) {
        nextErrors.workPlanItems = "Shto se paku nje aktivitet te plote ne planin e punes.";
      }

      if (!hasCompleteCostItem(form.costItems)) {
        nextErrors.costItems = "Shto se paku nje rresht te plote ne pershkrimin e kostos.";
      }

      const requested = toNumber(form.requestedFromUibm);
      const budgetTotal = getProjectBudgetDistributionTotal(form);

      ["materialCost", "administrativeCost", "personnelCost", "otherCosts"].forEach((field) => {
        if (toNumber(form[field]) === null) {
          nextErrors[field] = "Kjo fushe buxhetore eshte obligative.";
        }
      });

      if (requested !== null && Math.abs(budgetTotal - requested) > 0.01) {
        nextErrors.requestedFromUibm = "Ndarja 40/30/20/10 duhet te barazohet me shumen e kerkuar nga UIBM.";
      }
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const uploadSelectedFiles = async (requestId) => {
    if (!selectedFiles.length) {
      return null;
    }

    const files = await Promise.all(
      selectedFiles.map(async (file) => ({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        base64: await readFileAsBase64(file),
      }))
    );
    const response = await fetch(apiUrl(`/reimbursements/${requestId}/attachments`), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Dokumentet mbeshtetese nuk u ngarkuan.");
    }

    return result.data;
  };

  const submitRequest = async (action) => {
    if (!validateForm(action)) {
      setError("Ploteso fushat obligative para dergimit.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess(null);

    try {
      const requestUrl = editingRequest
        ? apiUrl(`/reimbursements/${editingRequest.id}`)
        : apiUrl("/reimbursements");
      const response = await fetch(requestUrl, {
        method: editingRequest ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: selectedType,
          formData: buildSubmitFormData(form),
          action,
        }),
      });
      const result = await response.json();

      if (response.status === 401) {
        throw new Error("Sesioni ka skaduar. Kyquni perseri me Google.");
      }

      if (!response.ok) {
        if (Array.isArray(result.errors)) {
          setFieldErrors(result.errors.reduce((acc, item) => ({ ...acc, [item.field]: item.message }), {}));
        }
        throw new Error(result.message || "Kerkesa nuk u ruajt.");
      }

      const withAttachments = await uploadSelectedFiles(result.data.id);
      const savedRequest = withAttachments || result.data;

      setRequests((prev) => [savedRequest, ...prev.filter((item) => item.id !== savedRequest.id)]);
      setHasLoadedRequests(true);
      setSuccess(savedRequest);
      setForm(createDefaultForm(effectiveProfile));
      setSelectedFiles([]);
      setEditingRequest(null);
      setHasHydratedAutoFields(true);
    } catch (submitError) {
      setError(submitError.message || "Ndodhi nje gabim gjate dergimit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submitRequest("submit");
  };

  const handleSaveDraft = () => {
    submitRequest("draft");
  };

  const handleDownloadDocument = async (request, format) => {
    if (request.isLegacy) {
      return;
    }

    const downloadKey = `${request.id}-${format}`;
    setDownloadingDocument(downloadKey);
    setError("");

    try {
      const response = await fetch(apiUrl(`/reimbursements/${request.id}/${format}`), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`${format.toUpperCase()} nuk u shkarkua.`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        format === "docx"
          ? request.documentDocxFilename || `${request.documentNumber || "rimbursim"}.docx`
          : request.documentFilename || `${request.documentNumber || "rimbursim"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message || `Shkarkimi i ${format.toUpperCase()} deshtoi.`);
    } finally {
      setDownloadingDocument("");
    }
  };

  const handlePreviewDocument = async (format) => {
    if (!validateForm("submit")) {
      setError("Ploteso fushat obligative para preview.");
      return;
    }

    setPreviewingDocument(format);
    setError("");

    try {
      const response = await fetch(apiUrl(`/reimbursements/preview/${format}`), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: selectedType,
          formData: form,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));

        if (Array.isArray(result.errors)) {
          setFieldErrors(result.errors.reduce((acc, item) => ({ ...acc, [item.field]: item.message }), {}));
        }

        throw new Error(result.message || `${format.toUpperCase()} preview nuk u krijua.`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `preview-${selectedType}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (previewError) {
      setError(previewError.message || r.previewFailed);
    } finally {
      setPreviewingDocument("");
    }
  };

  const handleDownloadAttachment = async (request, attachment) => {
    if (!attachment?.id) {
      return;
    }

    const downloadKey = `${request.id}-${attachment.id}`;
    setDownloadingDocument(downloadKey);
    setError("");

    try {
      const response = await fetch(apiUrl(`/reimbursements/${request.id}/attachments/${attachment.id}`), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Dokumenti mbeshtetes nuk u shkarkua.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename || "dokument";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message || "Shkarkimi i dokumentit deshtoi.");
    } finally {
      setDownloadingDocument("");
    }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter((file) => ALLOWED_ATTACHMENT_TYPES.includes(file.type));

    if (validFiles.length !== files.length) {
      setError("Lejohen vetem PDF, JPG, PNG dhe DOCX.");
    }

    setSelectedFiles(validFiles.slice(0, 5));
  };

  const handleEditRequest = (request) => {
    const nextType = request.requestType || "publication";
    const banking = request.requestData?.banking || {};
    const nextForm = {
      ...createDefaultForm(effectiveProfile),
      ...(request.requestData || {}),
      amount: request.requestData?.amount || banking.amount || "",
      currency: request.requestData?.currency || banking.currency || "EUR",
      bankApplicantName: request.requestData?.bankApplicantName || banking.applicantName || "",
      bankName: request.requestData?.bankName || banking.bankName || "",
      bankNameOther: request.requestData?.bankNameOther || "",
      detectedBankCode: request.requestData?.detectedBankCode || banking.detectedBankCode || "",
      bankDetectedAutomatically: Boolean(request.requestData?.bankDetectedAutomatically || banking.bankDetectedAutomatically),
      bankAccountNumber: request.requestData?.bankAccountNumber || banking.iban || "",
      iban: request.requestData?.iban || banking.iban || "",
      swiftCode: request.requestData?.swiftCode || banking.swift || "",
      bankCountry: request.requestData?.bankCountry || banking.country || "Kosove",
      teamMembers: Array.isArray(request.requestData?.teamMembers) && request.requestData.teamMembers.length
        ? request.requestData.teamMembers
        : createDefaultTeamMembers(),
      workPlanItems: Array.isArray(request.requestData?.workPlanItems) && request.requestData.workPlanItems.length
        ? request.requestData.workPlanItems
        : createDefaultWorkPlanItems(),
      costItems: Array.isArray(request.requestData?.costItems) && request.requestData.costItems.length
        ? request.requestData.costItems
        : createDefaultCostItems(),
      documentChecklist: request.requestData?.documentChecklist && typeof request.requestData.documentChecklist === "object"
        ? request.requestData.documentChecklist
        : {},
    };

    setSelectedType(nextType);
    setForm(nextForm);
    setEditingRequest(request);
    setSelectedFiles([]);
    setFieldErrors({});
    setIsAbstractExpanded(false);
    setError("");
    setSuccess(null);
    onNavigate?.("Rimbursime");
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setForm(createDefaultForm(effectiveProfile));
    setSelectedFiles([]);
    setFieldErrors({});
    setIsAbstractExpanded(false);
    setError("");
  };

  const renderInput = (label, field, options = {}) => {
    const className = [
      "reimbursement-field",
      options.wide ? "reimbursement-wide" : "",
      options.readOnly ? "reimbursement-readonly-field" : "",
    ].filter(Boolean).join(" ");
    const fieldError = fieldErrors[field];
    const displayLabel = selectedType === "publication"
      ? (PUBLICATION_LABELS[field] || label)
      : selectedType === "conference"
        ? (CONFERENCE_UI_LABELS[field] || label)
        : label;
    const displayPlaceholder = selectedType === "conference"
      ? (CONFERENCE_UI_PLACEHOLDERS[field] || options.placeholder)
      : options.placeholder;

    if (selectedType === "publication" && field === "mainAuthor") {
      const author = stripMarkup(form.mainAuthor);

      return (
        <div className={`${className} reimbursement-author-field`}>
          <span>{tx(displayLabel)}</span>
          <div className="reimbursement-main-author">
            <strong>{author || t("common.noData")}</strong>
            <small>Autori kryesor</small>
          </div>
          {fieldError ? <small className="reimbursement-field-error">{tx(fieldError)}</small> : null}
        </div>
      );
    }

    if (selectedType === "publication" && field === "coauthors") {
      const coauthors = splitCoauthors(form.coauthors);

      return (
        <div className={`${className} reimbursement-coauthors-field`}>
          <span>{tx(displayLabel)}</span>
          <div className="reimbursement-coauthor-list">
            {coauthors.length ? coauthors.map((author) => (
              <span className="reimbursement-coauthor-chip" key={author}>{author}</span>
            )) : <span className="reimbursement-muted-value">{t("common.noData")}</span>}
          </div>
          {fieldError ? <small className="reimbursement-field-error">{tx(fieldError)}</small> : null}
        </div>
      );
    }

    if (selectedType === "publication" && field === "abstract") {
      const abstractText = stripMarkup(form.abstract);
      const hasLongAbstract = abstractText.length > 260 || abstractText.split(/\r?\n/).length > 3;

      return (
        <div className={`${className} reimbursement-abstract-field`}>
          <span>{tx(displayLabel)}</span>
          <div className={`reimbursement-abstract-box ${isAbstractExpanded ? "expanded" : ""}`}>
            {abstractText || t("common.noData")}
          </div>
          {hasLongAbstract ? (
            <button
              type="button"
              className="reimbursement-abstract-toggle"
              onClick={() => setIsAbstractExpanded((current) => !current)}
            >
              {isAbstractExpanded ? "Shfaq më pak" : "Shfaq më shumë"}
            </button>
          ) : null}
          {fieldError ? <small className="reimbursement-field-error">{tx(fieldError)}</small> : null}
        </div>
      );
    }

    if (options.type === "textarea") {
      return (
        <label className={className}>
          <span>{tx(displayLabel)}</span>
          <textarea
            value={form[field]}
            onChange={handleFieldChange(field)}
            rows={options.rows || 3}
            required={options.required}
            placeholder={tx(displayPlaceholder)}
            readOnly={options.readOnly}
            aria-readonly={options.readOnly || undefined}
          />
          {fieldError ? <small className="reimbursement-field-error">{tx(fieldError)}</small> : null}
        </label>
      );
    }

    if (options.type === "select") {
      return (
        <label className={className}>
          <span>{tx(displayLabel)}</span>
          <select
            value={form[field]}
            onChange={handleFieldChange(field)}
            required={options.required}
            disabled={options.readOnly}
            aria-readonly={options.readOnly || undefined}
          >
            {(options.options || []).map((option) => (
              <option key={option} value={option}>
                {tx(option) || r.choose}
              </option>
            ))}
          </select>
          {fieldError ? <small className="reimbursement-field-error">{tx(fieldError)}</small> : null}
        </label>
      );
    }

    return (
      <label className={className}>
        <span>{tx(displayLabel)}</span>
        <input
          type={options.type || "text"}
          value={form[field]}
          onChange={handleFieldChange(field)}
          required={options.required}
          inputMode={options.inputMode}
          placeholder={tx(displayPlaceholder)}
          min={options.min}
          step={options.step}
          readOnly={options.readOnly}
          aria-readonly={options.readOnly || undefined}
        />
        {fieldError ? <small className="reimbursement-field-error">{tx(fieldError)}</small> : null}
      </label>
    );
  };

  const renderAutoField = (label, field, type = "text") => (
    <label className="reimbursement-field">
      <span>{tx(label)}</span>
      <input type={type} value={form[field]} onChange={handleFieldChange(field)} placeholder={t("common.noData")} />
      {fieldErrors[field] ? <small className="reimbursement-field-error">{tx(fieldErrors[field])}</small> : null}
    </label>
  );

  const renderSchemaField = (fieldConfig) => {
    const isPublicationReadOnly = selectedType === "publication"
      && (fieldConfig.source === "publication" || PUBLICATION_READ_ONLY_FIELDS.has(fieldConfig.field));
    const conferenceFieldConfig = selectedType === "conference" && fieldConfig.field === "authorsAffiliation"
      ? { ...fieldConfig, type: "textarea", rows: 3 }
      : fieldConfig;

    return (
      <React.Fragment key={fieldConfig.field}>
        {renderInput(tx(conferenceFieldConfig.label), conferenceFieldConfig.field, {
          ...conferenceFieldConfig,
          readOnly: Boolean(fieldConfig.readOnly || isPublicationReadOnly),
          options: conferenceFieldConfig.options || FIELD_OPTIONS[conferenceFieldConfig.optionsKey] || [],
          placeholder: tx(conferenceFieldConfig.placeholder),
        })}
      </React.Fragment>
    );
  };

  const getSectionFields = (sectionId) =>
    selectedTypeSchema.sections.find((section) => section.id === sectionId)?.fields || [];

  const renderPublicationDisplayField = (field) => (
    <div className="reimbursement-publication-info-row" key={`${field.label}-${field.value}`}>
      <span>{field.label}</span>
      {field.variant === "chips" ? (
        <div className="reimbursement-coauthor-list reimbursement-publication-inline-chips">
          {field.value.map((item) => (
            <span className="reimbursement-coauthor-chip" key={item}>{item}</span>
          ))}
        </div>
      ) : field.href ? (
        <a href={field.href} target="_blank" rel="noreferrer">{field.value}</a>
      ) : (
        <strong>{field.value}</strong>
      )}
    </div>
  );

  const renderPublicationDisplaySection = (section) => (
    <section className="reimbursement-publication-display-card reimbursement-wide" key={section.title}>
      {section.title ? <h5>{section.title}</h5> : null}
      <div className="reimbursement-publication-info-grid">
        {section.fields.map(renderPublicationDisplayField)}
      </div>
    </section>
  );

  const renderPublicationAuthors = () => {
    const mainAuthor = cleanDisplayValue(form.mainAuthor);
    const coauthors = splitCoauthors(form.coauthors);
    const authorSection = {
      title: "Autorët",
      fields: [
        createDisplayField(normalizePublicationType(form.publicationType) === "book" ? "Autori" : "Autori kryesor", mainAuthor),
        createAuthorListDisplayField("Bashkautorët", coauthors),
      ].filter(Boolean),
    };

    if (!mainAuthor && !coauthors.length) {
      return null;
    }

    return renderPublicationDisplaySection(authorSection);
  };

  const renderPublicationAbstract = () => {
    const abstractText = cleanDisplayValue(form.abstract);
    const hasLongAbstract = abstractText.length > 260 || abstractText.split(/\r?\n/).length > 3;

    if (!abstractText) {
      return null;
    }

    return (
      <section className="reimbursement-publication-display-card reimbursement-publication-abstract-group reimbursement-wide">
        <h5>Abstrakti</h5>
        <div className={`reimbursement-abstract-box ${isAbstractExpanded ? "expanded" : ""}`}>
          {abstractText}
        </div>
        {hasLongAbstract ? (
          <button
            type="button"
            className="reimbursement-abstract-toggle"
            onClick={() => setIsAbstractExpanded((current) => !current)}
          >
            {isAbstractExpanded ? "Shfaq më pak" : "Shfaq më shumë"}
          </button>
        ) : null}
      </section>
    );
  };

  const renderPublicationReadOnlyDetails = () => {
    const metadataSection = getPublicationMetadataDisplaySection(form);

    if (form.publicationId && metadataSection.fields.length) {
      return (
        <>
          {renderPublicationDisplaySection(metadataSection)}
          {renderPublicationAbstract()}
        </>
      );
    }

    if (!form.publicationId) {
      return null;
    }

    const sections = getPublicationDisplaySections(form).filter((section) => section.title !== "Autorët");
    const [primarySection, ...remainingSections] = sections;

    return (
      <>
        {primarySection ? renderPublicationDisplaySection(primarySection) : null}
        {renderPublicationAuthors()}
        {remainingSections.map(renderPublicationDisplaySection)}
        {renderPublicationAbstract()}
      </>
    );
  };

  const renderApplicantFields = () => (
    <div className="reimbursement-form-grid">
      {renderAutoField("Emri dhe mbiemri", "applicantName")}
      {renderAutoField("Email", "applicantEmail", "email")}
      {renderAutoField("Njesia akademike", "applicantFaculty")}
      {renderAutoField("Departamenti", "applicantDepartment")}
      {renderAutoField("ORCID iD", "applicantOrcidId")}
      {renderInput("Thirrja shkencore", "scientificTitle")}
      {renderInput("Thirrja akademike", "academicTitle")}
    </div>
  );

  const renderPublicationFields = () => (
    <div className="reimbursement-form-grid">
      {context.publications.length ? (
        <label className="reimbursement-field reimbursement-wide">
          <span>{r.choosePublication}</span>
          <select value={form.publicationId} onChange={handlePublicationSelect}>
            <option value="">{r.choosePublication}</option>
            {context.publications.map((publication) => (
              <option key={publication.id} value={publication.id}>
                {publication.title || publication.doi || r.publicationWithoutTitle}
              </option>
            ))}
          </select>
          {fieldErrors.publicationId ? <small className="reimbursement-field-error">{tx(fieldErrors.publicationId)}</small> : null}
        </label>
      ) : (
        <div className="reimbursement-info reimbursement-wide">
          {r.noSavedPublication}
          {fieldErrors.publicationId ? <small className="reimbursement-field-error">{tx(fieldErrors.publicationId)}</small> : null}
        </div>
      )}

      {renderPublicationReadOnlyDetails()}
    </div>
  );

  const renderConferenceFields = () => {
    const conferenceDetailFields = getSectionFields("conferenceDetails");
    const manualConferenceFields = conferenceDetailFields.filter((fieldConfig) => CONFERENCE_MANUAL_FIELDS.has(fieldConfig.field));
    const allPaperParticipationFields = [
      ...getSectionFields("participants"),
      ...conferenceDetailFields.filter((fieldConfig) => !CONFERENCE_MANUAL_FIELDS.has(fieldConfig.field)),
    ];
    const paperFields = allPaperParticipationFields.filter((fieldConfig) => CONFERENCE_PAPER_FIELDS.has(fieldConfig.field));
    const participationFields = allPaperParticipationFields.filter((fieldConfig) => !CONFERENCE_PAPER_FIELDS.has(fieldConfig.field));

    return (
      <div className="reimbursement-form-grid">
        {context.publications.length ? (
          <label className="reimbursement-field reimbursement-wide">
            <span>Zgjidh publikimin</span>
            <select value={form.publicationId} onChange={handleConferencePublicationSelect}>
              <option value="">Zgjidh publikimin</option>
              {context.publications.map((publication) => (
                <option key={publication.id} value={publication.id}>
                  {publication.title || publication.doi || r.publicationWithoutTitle}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {paperFields.map(renderSchemaField)}

        {manualConferenceFields.map(renderSchemaField)}

        {participationFields.map(renderSchemaField)}
      </div>
    );
  };

  const renderTeamMember = (member, index) => (
    <div className="reimbursement-team-card" key={`team-member-${index}`}>
      <div className="reimbursement-team-head">
        <strong>{t("professor.reimbursements.member", { index: index + 1 })}</strong>
        <button type="button" onClick={() => removeTeamMember(index)} aria-label={r.removeMember}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="reimbursement-form-grid">
        <label className="reimbursement-field">
          <span>{r.name}</span>
          <input value={member.name} onChange={handleTeamMemberChange(index, "name")} />
        </label>
        <label className="reimbursement-field">
          <span>{r.scientificGrade}</span>
          <input value={member.scientificGrade} onChange={handleTeamMemberChange(index, "scientificGrade")} />
        </label>
        <label className="reimbursement-field">
          <span>{r.academicUnit}</span>
          <input value={member.academicUnit} onChange={handleTeamMemberChange(index, "academicUnit")} />
        </label>
        <label className="reimbursement-field">
          <span>{r.phone}</span>
          <input value={member.phone} onChange={handleTeamMemberChange(index, "phone")} />
        </label>
        <label className="reimbursement-field">
          <span>Email</span>
          <input type="email" value={member.email} onChange={handleTeamMemberChange(index, "email")} />
        </label>
        <label className="reimbursement-field">
          <span>{r.specialization}</span>
          <input value={member.specialization} onChange={handleTeamMemberChange(index, "specialization")} />
        </label>
        <label className="reimbursement-field reimbursement-wide">
          <span>{r.contribution}</span>
          <textarea value={member.contribution} onChange={handleTeamMemberChange(index, "contribution")} rows={2} />
        </label>
      </div>
    </div>
  );

  const renderWorkPlanItem = (item, index) => (
    <div className="reimbursement-table-card" key={`work-plan-${index}`}>
      <div className="reimbursement-team-head">
        <strong>{r.activity} {index + 1}</strong>
        <button type="button" onClick={() => removeWorkPlanItem(index)} aria-label={r.removeActivity}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="reimbursement-form-grid">
        <label className="reimbursement-field reimbursement-wide">
          <span>{r.activity}</span>
          <input value={item.activity} onChange={handleWorkPlanItemChange(index, "activity")} />
        </label>
        <label className="reimbursement-field">
          <span>{r.deadline}</span>
          <input type="date" value={item.deadline} onChange={handleWorkPlanItemChange(index, "deadline")} />
        </label>
        <label className="reimbursement-field">
          <span>{r.responsiblePerson}</span>
          <input value={item.responsiblePerson} onChange={handleWorkPlanItemChange(index, "responsiblePerson")} />
        </label>
        <label className="reimbursement-field reimbursement-wide">
          <span>{r.expectedResult}</span>
          <input value={item.expectedResult} onChange={handleWorkPlanItemChange(index, "expectedResult")} />
        </label>
      </div>
    </div>
  );

  const renderCostItem = (item, index) => (
    <div className="reimbursement-table-card" key={`cost-item-${index}`}>
      <div className="reimbursement-team-head">
        <strong>{r.addCost} {index + 1}</strong>
        <button type="button" onClick={() => removeCostItem(index)} aria-label={r.removeCost}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="reimbursement-form-grid">
        <label className="reimbursement-field reimbursement-wide">
          <span>{r.item}</span>
          <input value={item.item} onChange={handleCostItemChange(index, "item")} />
        </label>
        <label className="reimbursement-field">
          <span>{r.category}</span>
          <select value={item.category || "materialCost"} onChange={handleCostItemChange(index, "category")}>
            {COST_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{tx(option.label)}</option>
            ))}
          </select>
        </label>
        <label className="reimbursement-field">
          <span>{r.quantity}</span>
          <input inputMode="decimal" value={item.quantity} onChange={handleCostItemChange(index, "quantity")} />
        </label>
        <label className="reimbursement-field">
          <span>{r.unitCost}</span>
          <input inputMode="decimal" value={item.unitCost} onChange={handleCostItemChange(index, "unitCost")} />
        </label>
        <label className="reimbursement-field">
          <span>{r.total}</span>
          <input inputMode="decimal" value={item.totalCost} onChange={handleCostItemChange(index, "totalCost")} />
        </label>
        <label className="reimbursement-field reimbursement-wide">
          <span>{r.description}</span>
          <input value={item.description} onChange={handleCostItemChange(index, "description")} />
        </label>
      </div>
    </div>
  );

  const renderProjectFields = () => (
    <div className="reimbursement-form-grid">
      {getSectionFields("administration").map(renderSchemaField)}

      <div className="reimbursement-wide reimbursement-subsection">
        <div className="reimbursement-subsection-head">
          <strong>{r.teamMembers}</strong>
          <button type="button" onClick={addTeamMember}>
            <Plus size={15} />
            {r.addMember}
          </button>
        </div>
        <div className="reimbursement-team-grid">
          {form.teamMembers.map(renderTeamMember)}
        </div>
        {fieldErrors.teamMembers ? <small className="reimbursement-field-error">{tx(fieldErrors.teamMembers)}</small> : null}
      </div>

      {getSectionFields("projectInfo").map(renderSchemaField)}

      <div className="reimbursement-wide reimbursement-subsection">
        <div className="reimbursement-subsection-head">
          <strong>{r.workPlan}</strong>
          <button type="button" onClick={addWorkPlanItem}>
            <Plus size={15} />
            {r.addActivity}
          </button>
        </div>
        <div className="reimbursement-team-grid">
          {(form.workPlanItems || createDefaultWorkPlanItems()).map(renderWorkPlanItem)}
        </div>
        {fieldErrors.workPlanItems ? <small className="reimbursement-field-error">{tx(fieldErrors.workPlanItems)}</small> : null}
      </div>

      {getSectionFields("budget").map(renderSchemaField)}

      <div className="reimbursement-wide reimbursement-budget-total">
        <span>{r.budgetDistribution}</span>
        <strong>{formatMoneyPreview(getProjectBudgetDistributionTotal(form), form.currency)}</strong>
        {fieldErrors.requestedFromUibm ? <small className="reimbursement-field-error">{tx(fieldErrors.requestedFromUibm)}</small> : null}
      </div>

      <div className="reimbursement-wide reimbursement-subsection">
        <div className="reimbursement-subsection-head">
          <strong>{r.costDescription}</strong>
          <button type="button" onClick={addCostItem}>
            <Plus size={15} />
            {r.addCost}
          </button>
        </div>
        <div className="reimbursement-team-grid">
          {(form.costItems || createDefaultCostItems()).map(renderCostItem)}
        </div>
        {fieldErrors.costItems ? <small className="reimbursement-field-error">{tx(fieldErrors.costItems)}</small> : null}
      </div>

      {getSectionFields("metadata").map(renderSchemaField)}
    </div>
  );

  const renderTypeFields = () => {
    if (selectedType === "conference") {
      return renderConferenceFields();
    }

    if (selectedType === "project") {
      return renderProjectFields();
    }

    return renderPublicationFields();
  };

  const renderFinanceFields = () => (
    <div className="reimbursement-bank-panel">
      <div className="reimbursement-bank-grid">
        <label className="reimbursement-field">
          <span>{r.amount}</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={form.amount}
            onChange={handleFieldChange("amount")}
            required
            placeholder="0.00"
          />
          {amountPreview ? <small className="reimbursement-helper">{r.total}: {amountPreview}</small> : null}
          {fieldErrors.amount ? <small className="reimbursement-field-error">{tx(fieldErrors.amount)}</small> : null}
        </label>

        {renderInput(r.currency, "currency", { type: "select", options: ["EUR", "USD", "CHF"], required: true })}

        {bankRequired ? (
          <>
            {renderInput(r.bankApplicantName, "bankApplicantName", { required: true })}

            <label className="reimbursement-field">
              <span>{r.bankAccount}</span>
              <input
                value={form.bankAccountNumber}
                onChange={handleFieldChange("bankAccountNumber")}
                placeholder={r.bankAccountPlaceholder}
                autoComplete="off"
              />
              {fieldErrors.bankAccountNumber ? <small className="reimbursement-field-error">{tx(fieldErrors.bankAccountNumber)}</small> : null}
            </label>

            <div className="reimbursement-field reimbursement-bank-result">
              <span>{r.bankName}</span>
              {visualBank ? (
                <div className="reimbursement-detected-bank" aria-live="polite">
                  <span className="reimbursement-bank-logo">
                    {visualBank.logoSrc ? (
                      <img src={visualBank.logoSrc} alt={`${visualBank.name} logo`} />
                    ) : (
                      <Landmark size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{visualBank.name}</strong>
                    <small>{visualBank.swift}</small>
                  </span>
                </div>
              ) : (
                <div className="reimbursement-bank-placeholder">{r.writeAccount}</div>
              )}
              {fieldErrors.bankName ? <small className="reimbursement-field-error">{tx(fieldErrors.bankName)}</small> : null}
            </div>

            <label className="reimbursement-field">
              <span>{r.swift}</span>
              <input
                value={form.swiftCode}
                readOnly
                placeholder={r.autofill}
                className={visualBank ? "reimbursement-autofill-input" : ""}
              />
              {fieldErrors.swiftCode ? <small className="reimbursement-field-error">{tx(fieldErrors.swiftCode)}</small> : null}
            </label>

            {renderInput(r.country, "bankCountry")}
          </>
        ) : null}
      </div>
    </div>
  );

  const renderAttachmentUpload = () => {
    const completedRequired = selectedAttachmentChecklist
      .filter((item) => item.required)
      .filter((item) => form.documentChecklist?.[item.id]).length;
    const requiredTotal = selectedAttachmentChecklist.filter((item) => item.required).length;

    return (
      <div className="reimbursement-upload-box">
        <div className="reimbursement-checklist-head">
          <strong>{r.checklistLabel}</strong>
          <span>{t("professor.reimbursements.requiredCount", { done: completedRequired, total: requiredTotal })}</span>
        </div>

        <div className="reimbursement-document-checklist">
          {selectedAttachmentChecklist.map((item) => (
            <label key={item.id} className="reimbursement-check-item">
              <input
                type="checkbox"
                checked={Boolean(form.documentChecklist?.[item.id])}
                onChange={handleDocumentChecklistChange(item.id)}
              />
              <span>
                {tx(item.label)}
                {item.required ? <small>{t("common.required")}</small> : <small>{t("common.optional")}</small>}
                {fieldErrors[`documentChecklist.${item.id}`] ? (
                  <small className="reimbursement-field-error">{tx(fieldErrors[`documentChecklist.${item.id}`])}</small>
                ) : null}
              </span>
            </label>
          ))}
        </div>

        <label className="reimbursement-upload-label">
          <span>{r.uploadFiles}</span>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
          />
        </label>
        {selectedFiles.length ? (
          <div className="reimbursement-file-list">
            {selectedFiles.map((file) => (
              <span key={`${file.name}-${file.size}`}>
                {file.name} {formatBytes(file.size) ? `(${formatBytes(file.size)})` : ""}
              </span>
            ))}
          </div>
        ) : (
          <p>{r.fileTypes}</p>
        )}
      </div>
    );
  };

  const renderStatusTimeline = (history = []) => {
    if (!history.length) {
      return null;
    }

    return (
      <div className="reimbursement-timeline">
        {history.map((item) => (
          <div className="reimbursement-timeline-item" key={item.id || `${item.status}-${item.createdAt}`}>
            <span className="reimbursement-timeline-dot" />
            <div>
              <strong>{tx(item.statusLabel || STATUS_LABELS[item.status] || item.status)}</strong>
              <p>
                {[normalizeDate(item.createdAt), item.actorRoleLabel || item.actorRole, item.actorName]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
              {item.note ? <p>{item.note}</p> : null}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAttachments = (request) => {
    if (!request.attachments?.length) {
      return null;
    }

    return (
      <div className="reimbursement-attachment-list">
        {request.attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => handleDownloadAttachment(request, attachment)}
            disabled={downloadingDocument === `${request.id}-${attachment.id}`}
          >
            <Download size={14} />
            {downloadingDocument === `${request.id}-${attachment.id}` ? r.downloading : attachment.filename}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="reimbursement-flow">
      {view === "create" ? (
        <article className="prof-card reimbursement-flow-card">
        <div className="reimbursement-flow-header">
          <div>
            <h3>{editingRequest ? r.titleEdit : r.titleNew}</h3>
            {editingRequest ? <p>{t("professor.reimbursements.editingDescription", { title: editingRequest.documentNumber || editingRequest.title })}</p> : null}
          </div>
          {editingRequest ? (
            <button type="button" className="reimbursement-download-btn" onClick={handleCancelEdit}>
              {r.cancelEdit}
            </button>
          ) : null}
        </div>

        <form className="reimbursement-form" onSubmit={handleSubmit}>
          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <BookOpen size={18} />
              <div>
                <h4>{r.basicTitle}</h4>
                <p>{r.basicDescription}</p>
              </div>
            </div>

            <div className="reimbursement-type-grid">
              {REQUEST_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`reimbursement-type-card ${selectedType === type.id ? "active" : ""}`}
                  onClick={() => handleTypeSelect(type.id)}
                >
                  <strong>{tx(type.label)}</strong>
                  <span>{tx(type.description)}</span>
                </button>
              ))}
            </div>

            {isLoadingContext ? (
              <div className="reimbursement-loading">
                <Loader2 size={18} className="reimbursement-spin" />
                {r.loadingContext}
              </div>
            ) : (
              renderApplicantFields()
            )}
          </section>

          <section className="reimbursement-section">
            {selectedType === "publication" ? null : (
              <div className="reimbursement-section-head">
                <FileText size={18} />
                <div>
                  <h4>
                    {selectedType === "conference"
                      ? "Detajet e konferencës, simpoziumit ose aktivitetit"
                      : r.academicTitle}
                  </h4>
                  <p>{t("professor.reimbursements.academicDescription", { type: tx(selectedTypeConfig.label) })}</p>
                </div>
              </div>
            )}

            {renderTypeFields()}
          </section>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <Wallet size={18} />
              <div>
                <h4>
                  {selectedType === "conference"
                    ? "Të dhënat bankare të përfituesit"
                    : bankRequired ? r.financeBankTitle : r.financeTitle}
                </h4>
                <p>{bankRequired ? r.financeBankDescription : r.financeDescription}</p>
              </div>
            </div>

            {renderFinanceFields()}
          </section>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <Upload size={18} />
              <div>
                <h4>{r.documentsTitle}</h4>
                <p>{r.documentsDescription}</p>
              </div>
            </div>

            {renderAttachmentUpload()}
          </section>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <FileText size={18} />
              <div>
                <h4>{r.reviewTitle}</h4>
                <p>{r.reviewDescription}</p>
              </div>
            </div>
            <div className="reimbursement-review-panel">
              <span><strong>{r.form}:</strong> {selectedTypeConfig.code} - {tx(selectedTypeConfig.requestLabel)}</span>
              <span><strong>{r.amount}:</strong> {amountPreview || r.noAmount}</span>
              <span><strong>{r.bank}:</strong> {bankRequired ? visualBank?.name || r.noBank : r.bankNotRequired}</span>
              <div className="reimbursement-preview-actions">
                <button
                  type="button"
                  className="prof-btn-secondary"
                  onClick={() => handlePreviewDocument("docx")}
                  disabled={previewingDocument === "docx" || isSubmitting}
                >
                  <FileText size={16} />
                  {previewingDocument === "docx" ? r.generatingDocx : r.previewDocx}
                </button>
                <button
                  type="button"
                  className="prof-btn-secondary"
                  onClick={() => handlePreviewDocument("pdf")}
                  disabled={previewingDocument === "pdf" || isSubmitting}
                >
                  <FileText size={16} />
                  {previewingDocument === "pdf" ? r.generatingPdf : r.previewPdf}
                </button>
              </div>
            </div>
          </section>

          <div className="reimbursement-action-bar">
            <div className="reimbursement-action-feedback">
              {error ? <p className="reimbursement-message error" role="alert">{tx(error)}</p> : null}
              {success ? (
                <div className="reimbursement-message success">
                  <span>
                    {success.status === "draft"
                      ? r.draftSaved
                      : r.requestSaved}
                  </span>
                  <div className="reimbursement-message-actions">
                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(success, "pdf")}
                      disabled={downloadingDocument === `${success.id}-pdf`}
                    >
                      {downloadingDocument === `${success.id}-pdf` ? "PDF..." : "PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(success, "docx")}
                      disabled={downloadingDocument === `${success.id}-docx`}
                    >
                      {downloadingDocument === `${success.id}-docx` ? "DOCX..." : "DOCX"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="reimbursement-actions">
              <button type="button" className="prof-btn-secondary" onClick={handleSaveDraft} disabled={isSubmitting || isLoadingContext}>
                <Save size={16} />
                {isSubmitting ? r.saving : r.saveDraft}
              </button>
              <button type="submit" className="prof-btn-primary" disabled={isSubmitting || isLoadingContext}>
                <Upload size={16} />
                {isSubmitting ? r.submitting : r.submit}
              </button>
            </div>
          </div>
        </form>
        </article>
      ) : null}

      {view === "history" ? (
        <ReimbursementHistoryList
          r={r}
          tx={tx}
          visibleRequests={visibleRequests}
          downloadingDocument={downloadingDocument}
          error={error}
          onDownloadDocument={handleDownloadDocument}
          onEditRequest={handleEditRequest}
          renderAttachments={renderAttachments}
          renderStatusTimeline={renderStatusTimeline}
        />
      ) : null}
    </div>
  );
}
