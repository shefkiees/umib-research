import React, { useEffect, useMemo, useState } from "react";
import { Download, FileText, Landmark, Loader2, Plus, Save, Search, Sparkles, Trash2, Upload, Wallet } from "lucide-react";
import { apiUrl } from "../../utils/api";

const REQUEST_TYPES = [
  {
    id: "publication",
    label: "F1 - Publikime shkencore",
    description: "Financim i publikimit shkencor.",
  },
  {
    id: "conference",
    label: "F2 - Konferenca dhe simpoziume",
    description: "Pjesemarrje, prezantim, poster ,aktivitet shkencor.",
  },
  {
    id: "project",
    label: "F3 - Projekte shkencore",
    description: "Projekt-propozim, ekip hulumtues, plan pune dhe buxhet.",
  },
];

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

const REQUIRED_FIELDS = {
  common: {
    applicantName: "Emri dhe mbiemri eshte obligativ.",
    applicantEmail: "Email-i eshte obligativ.",
    applicantFaculty: "Njesia akademike eshte obligative.",
    amount: "Shuma e kerkuar eshte obligative.",
    currency: "Valuta eshte obligative.",
    purpose: "Pershkrimi/arsyeja eshte obligative.",
    bankApplicantName: "Emri i aplikantit ne banke eshte obligativ.",
    bankName: "Emri i bankes eshte obligativ.",
    bankAccountNumber: "Numri i llogarise bankare/IBAN eshte obligativ.",
  },
  publication: {
    publicationTitle: "Titulli i punimit eshte obligativ.",
    mainAuthor: "Autori kryesor eshte obligativ.",
    affiliation: "Affiliation eshte obligativ.",
    journal: "Emri i revistes eshte obligativ.",
    publisher: "Shtepia botuese eshte obligative.",
    indexingPlatform: "Indeksimi ne platforme eshte obligativ.",
    publicationLink: "Linku i publikimit eshte obligativ.",
  },
  conference: {
    conferenceTitle: "Emertimi i ngjarjes eshte obligativ.",
    eventPlaceDate: "Vendi dhe data jane obligative.",
    organizer: "Organizatori eshte obligativ.",
    invitationProgram: "Ftesa/programi eshte obligativ.",
    abstractTitle: "Abstrakti dhe titulli i punimit jane obligative.",
    acceptanceConfirmation: "Konfirmimi i pranimit eshte obligativ.",
    participationType: "Lloji i pjesemarrjes eshte obligativ.",
  },
  project: {
    projectTitle: "Titulli i projektit eshte obligativ.",
    projectDurationMonths: "Kohezgjatja e projektit eshte obligative.",
    applyingUnit: "Njesia akademike aplikuese eshte obligative.",
    deanName: "Emri i dekanit eshte obligativ.",
    projectDescription: "Pershkrimi i projekt-propozimit eshte obligativ.",
    projectKeywords: "Fjalet kyce jane obligative.",
    projectImpact: "Ndikimi/arsyeshmeria e projektit eshte obligative.",
    workPlan: "Plani i punes eshte obligativ.",
    totalProjectCost: "Kosto totale e projektit eshte obligative.",
    requestedFromUibm: "Shuma e kerkuar nga UIBM eshte obligative.",
    detailedCostDescription: "Pershkrimi i detajuar i kostos eshte obligativ.",
  },
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

const EMPTY_TEAM_MEMBER = {
  name: "",
  scientificGrade: "",
  academicUnit: "",
  phone: "",
  email: "",
  specialization: "",
  contribution: "",
};

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
  expenseDate: "",
  invoiceNumber: "",
  iban: "",
  attachmentUrl: "",
  purpose: "",
  notes: "",
  bankApplicantName: "",
  bankName: "",
  bankNameOther: "",
  detectedBankCode: "",
  bankDetectedAutomatically: false,
  bankSelectionSource: "",
  bankAccountNumber: "",
  swiftCode: "",
  bankCountry: "Kosove",
  amountWords: "",
  publicationId: "",
  doi: "",
  publicationTitle: "",
  journal: "",
  publisher: "",
  publicationYear: "",
  publicationFee: "",
  affiliation: "",
  indexingPlatform: "",
  impactFactor: "",
  scopusQuartile: "",
  acceptanceDate: "",
  publicationDate: "",
  publicationLink: "",
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
};

function createDefaultTeamMembers() {
  return [{ ...EMPTY_TEAM_MEMBER }];
}

function resolveProfile(contextProfile, profile) {
  return {
    name: contextProfile?.name || profile?.name || "",
    email: contextProfile?.email || profile?.email || "",
    faculty: contextProfile?.faculty || profile?.faculty || "",
    department: contextProfile?.department || profile?.department || "",
    office: contextProfile?.office || profile?.office || "",
    orcidId: contextProfile?.orcidId || profile?.orcidId || "",
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
    bankApplicantName: profile.name || "",
    applyingUnit: profile.faculty || "",
    affiliation: profile.faculty || "",
  };
}

function createDefaultForm(profile = {}) {
  return {
    ...DEFAULT_FORM_VALUES,
    ...getAutoFieldDefaults(profile),
    teamMembers: createDefaultTeamMembers(),
  };
}

function applyPublicationToForm(prev, publication) {
  if (!publication) {
    return prev;
  }

  return {
    ...prev,
    publicationId: publication.id ? String(publication.id) : prev.publicationId,
    doi: publication.doi || prev.doi,
    publicationTitle: publication.title || prev.publicationTitle,
    journal: publication.venue || prev.journal,
    publisher: publication.publisher || prev.publisher,
    publicationYear: publication.publicationYear || prev.publicationYear,
    publicationLink: publication.sourceUrl || prev.publicationLink,
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

export default function ReimbursementManager({ profile, searchQuery = "", fallbackRows = [] }) {
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
  const [isDoiLoading, setIsDoiLoading] = useState(false);
  const [downloadingDocument, setDownloadingDocument] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingRequest, setEditingRequest] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasHydratedAutoFields, setHasHydratedAutoFields] = useState(false);
  const [hasHydratedPublicationFields, setHasHydratedPublicationFields] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const effectiveProfile = useMemo(
    () => resolveProfile(context.profile, profile),
    [context.profile, profile]
  );

  const selectedTypeConfig = REQUEST_TYPES.find((item) => item.id === selectedType) || REQUEST_TYPES[0];
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
        && isAccountNumberValid
        && hasValue(form.bankName)
        && isValidSwift(form.swiftCode),
      documents: selectedFiles.length > 0 || hasValue(form.attachmentUrl),
    };
  }, [form, isAccountNumberValid, selectedFiles.length, selectedType]);

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
      bankApplicantName: prev.bankApplicantName || defaults.bankApplicantName,
      applyingUnit: prev.applyingUnit || defaults.applyingUnit,
      affiliation: prev.affiliation || defaults.affiliation,
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
  }, [detectedBank, normalizedAccount]);

  const handleFieldChange = (field) => (event) => {
    const nextValue = event.target.value;

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

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    setError("");
    setSuccess(null);
  };

  const handlePublicationSelect = (event) => {
    const publicationId = event.target.value;
    const selectedPublication = context.publications.find((item) => String(item.id) === publicationId);

    setForm((prev) => applyPublicationToForm({ ...prev, publicationId }, selectedPublication));
  };

  const handleConferenceSelect = (event) => {
    const conferenceId = event.target.value;
    const selectedConference = context.conferences.find((item) => String(item.id) === conferenceId);
    const placeDate = [selectedConference?.location, selectedConference?.conferenceDate].filter(Boolean).join(" / ");

    setForm((prev) => ({
      ...prev,
      conferenceId,
      conferenceTitle: selectedConference?.title || prev.conferenceTitle,
      location: selectedConference?.location || prev.location,
      conferenceDate: selectedConference?.conferenceDate || prev.conferenceDate,
      eventPlaceDate: placeDate || prev.eventPlaceDate,
      eventPublicationLink: selectedConference?.website || prev.eventPublicationLink,
    }));
  };

  const handleDoiLookup = async () => {
    if (!form.doi.trim()) {
      setError("Shkruani DOI per te marre metadata.");
      return;
    }

    setIsDoiLoading(true);
    setError("");

    try {
      const response = await fetch(apiUrl(`/doi/${encodeURIComponent(form.doi.trim())}`));
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Metadata per DOI nuk u gjeten.");
      }

      const metadata = result.data || {};

      setForm((prev) => ({
        ...prev,
        publicationTitle: metadata.title || prev.publicationTitle,
        journal: metadata.container_title || prev.journal,
        publisher: metadata.publisher || prev.publisher,
        publicationYear: metadata.year || prev.publicationYear,
        publicationLink: metadata.source_url || prev.publicationLink,
      }));
    } catch (lookupError) {
      setError(lookupError.message || "DOI lookup deshtoi.");
    } finally {
      setIsDoiLoading(false);
    }
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

    const required = {
      ...REQUIRED_FIELDS.common,
      ...(REQUIRED_FIELDS[selectedType] || {}),
    };

    Object.entries(required).forEach(([field, message]) => {
      if (!hasValue(form[field])) {
        nextErrors[field] = message;
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

    const submittedAccount = form.bankAccountNumber || form.iban;

    if (submittedAccount && !isValidBankAccountIdentifier(submittedAccount)) {
      nextErrors.bankAccountNumber = "IBAN nuk është valid. Kontrollo numrin e llogarisë bankare.";
    }

    if (submittedAccount && nextErrors.bankAccountNumber) {
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
          formData: form,
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
      amountWords: request.requestData?.amountWords || banking.amountInWords || "",
      bankApplicantName: request.requestData?.bankApplicantName || banking.applicantName || "",
      bankName: request.requestData?.bankName || banking.bankName || "",
      bankNameOther: request.requestData?.bankNameOther || "",
      detectedBankCode: request.requestData?.detectedBankCode || banking.detectedBankCode || "",
      bankDetectedAutomatically: Boolean(request.requestData?.bankDetectedAutomatically || banking.bankDetectedAutomatically),
      bankAccountNumber: request.requestData?.bankAccountNumber || banking.iban || "",
      iban: request.requestData?.iban || banking.iban || "",
      swiftCode: request.requestData?.swiftCode || banking.swift || "",
      bankCountry: request.requestData?.bankCountry || banking.country || "Kosove",
      invoiceNumber: request.requestData?.invoiceNumber || banking.invoiceNumber || "",
      expenseDate: request.requestData?.expenseDate || banking.expenseDate || "",
      attachmentUrl: request.requestData?.attachmentUrl || banking.documentLink || "",
      purpose: request.requestData?.purpose || banking.description || "",
      notes: request.requestData?.notes || banking.notes || "",
      teamMembers: Array.isArray(request.requestData?.teamMembers) && request.requestData.teamMembers.length
        ? request.requestData.teamMembers
        : createDefaultTeamMembers(),
    };

    setSelectedType(nextType);
    setForm(nextForm);
    setEditingRequest(request);
    setSelectedFiles([]);
    setFieldErrors({});
    setError("");
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setForm(createDefaultForm(effectiveProfile));
    setSelectedFiles([]);
    setFieldErrors({});
    setError("");
  };

  const renderInput = (label, field, options = {}) => {
    const className = options.wide ? "reimbursement-field reimbursement-wide" : "reimbursement-field";
    const fieldError = fieldErrors[field];

    if (options.type === "textarea") {
      return (
        <label className={className}>
          <span>{label}</span>
          <textarea
            value={form[field]}
            onChange={handleFieldChange(field)}
            rows={options.rows || 3}
            required={options.required}
            placeholder={options.placeholder}
          />
          {fieldError ? <small className="reimbursement-field-error">{fieldError}</small> : null}
        </label>
      );
    }

    if (options.type === "select") {
      return (
        <label className={className}>
          <span>{label}</span>
          <select value={form[field]} onChange={handleFieldChange(field)} required={options.required}>
            {(options.options || []).map((option) => (
              <option key={option} value={option}>
                {option || "Zgjidh"}
              </option>
            ))}
          </select>
          {fieldError ? <small className="reimbursement-field-error">{fieldError}</small> : null}
        </label>
      );
    }

    return (
      <label className={className}>
        <span>{label}</span>
        <input
          type={options.type || "text"}
          value={form[field]}
          onChange={handleFieldChange(field)}
          required={options.required}
          inputMode={options.inputMode}
          placeholder={options.placeholder}
          min={options.min}
          step={options.step}
        />
        {fieldError ? <small className="reimbursement-field-error">{fieldError}</small> : null}
      </label>
    );
  };

  const renderAutoField = (label, field, type = "text") => (
    <label className="reimbursement-field">
      <span>{label}</span>
      <input type={type} value={form[field]} onChange={handleFieldChange(field)} placeholder="Nuk ka te dhena" />
    </label>
  );

  const renderApplicantFields = () => (
    <div className="reimbursement-form-grid">
      {renderAutoField("Emri dhe mbiemri", "applicantName")}
      {renderAutoField("Email", "applicantEmail", "email")}
      {renderAutoField("Njesia akademike", "applicantFaculty")}
      {renderAutoField("Departamenti", "applicantDepartment")}
      {renderAutoField("Zyra", "applicantOffice")}
      {renderAutoField("ORCID iD", "applicantOrcidId")}
      {renderInput("Thirrja shkencore", "scientificTitle")}
      {renderInput("Thirrja akademike", "academicTitle")}
    </div>
  );

  const renderPublicationFields = () => (
    <div className="reimbursement-form-grid">
      {context.publications.length ? (
        <label className="reimbursement-field reimbursement-wide">
          <span>Publikim nga databaza</span>
          <select value={form.publicationId} onChange={handlePublicationSelect}>
            <option value="">Zgjidh publikim te ruajtur</option>
            {context.publications.map((publication) => (
              <option key={publication.id} value={publication.id}>
                {publication.title || publication.doi || "Publikim pa titull"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="reimbursement-info reimbursement-wide">
          Publikimet e importuara nga ORCID/DOI shfaqen ketu. Nese publikimi mungon, perdor DOI lookup dhe ploteso fushat manualisht.
        </div>
      )}

      <label className="reimbursement-field reimbursement-doi-field">
        <span>DOI</span>
        <div className="reimbursement-inline-control">
          <input value={form.doi} onChange={handleFieldChange("doi")} placeholder="10.xxxx/xxxxx" />
          <button type="button" onClick={handleDoiLookup} disabled={isDoiLoading}>
            {isDoiLoading ? <Loader2 size={16} className="reimbursement-spin" /> : <Search size={16} />}
            Merr metadata
          </button>
        </div>
      </label>

      {renderInput("Autor kryesor", "mainAuthor")}
      {renderInput("Autor korrespondent", "correspondingAuthor")}
      {renderInput("Bashkautoret", "coauthors", { wide: true, placeholder: "Ndaji me presje ose rreshta" })}
      {renderInput("Perkatesia e autorit (affiliation)", "affiliation", { wide: true })}
      {renderInput("Titulli i punimit", "publicationTitle", { wide: true, required: true })}
      {renderInput("Emri i revistes", "journal")}
      {renderInput("Shtepia botuese", "publisher")}
      {renderInput("Indeksim ne platforme", "indexingPlatform", { placeholder: "Scopus, Web of Science, DOAJ..." })}
      {renderInput("Impact faktori (IF)", "impactFactor")}
      {renderInput("Scopus (Q1-Q4)", "scopusQuartile", { type: "select", options: SCOPUS_OPTIONS })}
      {renderInput("Data e pranimit", "acceptanceDate", { type: "date" })}
      {renderInput("Data e publikimit", "publicationDate", { type: "date" })}
      {renderInput("Linku i publikimit", "publicationLink", { wide: true, placeholder: "https://..." })}
      {renderInput("Deshmia e regjistrimit ne databazen UIBM", "uibmDatabaseEvidence", { wide: true, placeholder: "URL ose shenim" })}
      {renderInput("Detajet e konferences/simpoziumit (nese aplikohet)", "publicationConferenceDetails", { wide: true })}
      {renderInput("Linku i konferences", "conferenceLink", { placeholder: "https://..." })}
      {renderInput("Vendi i konferences", "conferenceLocation")}
      {renderInput("Data e prezantimit", "conferencePresentationDate", { type: "date" })}
      {renderInput("Tarifa e publikimit", "publicationFee", { placeholder: "p.sh. 450 EUR" })}
    </div>
  );

  const renderConferenceFields = () => (
    <div className="reimbursement-form-grid">
      {context.conferences.length ? (
        <label className="reimbursement-field reimbursement-wide">
          <span>Konference nga databaza</span>
          <select value={form.conferenceId} onChange={handleConferenceSelect}>
            <option value="">Zgjidh konference/simpozium</option>
            {context.conferences.map((conference) => (
              <option key={conference.id} value={conference.id}>
                {[conference.title, conference.location, conference.conferenceDate].filter(Boolean).join(" | ")}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {renderInput("Autori kryesor", "mainAuthor")}
      {renderInput("Bashkepjesemarresi", "coParticipant")}
      {renderInput("Emertimi i ngjarjes", "conferenceTitle", { wide: true, required: true })}
      {renderInput("Vendi dhe data", "eventPlaceDate", { placeholder: "p.sh. Tirane, 12.06.2026" })}
      {renderInput("Lokacioni", "location")}
      {renderInput("Data e eventit", "conferenceDate", { type: "date" })}
      {renderInput("Organizatori", "organizer", { wide: true })}
      {renderInput("Ftesa dhe programi", "invitationProgram", { wide: true, placeholder: "URL ose pershkrim" })}
      {renderInput("Abstrakti dhe titulli i punimit", "abstractTitle", { wide: true, type: "textarea", rows: 3 })}
      {renderInput("Konfirmimi i pranimit te punimit", "acceptanceConfirmation", { wide: true, placeholder: "URL ose shenim" })}
      {renderInput("Autoret e punimit (affiliation)", "authorsAffiliation", { wide: true })}
      {renderInput("Foles me kumtese/poster", "speakerWithPaperPoster", { type: "select", options: ["", "Kumtese", "Poster", "Jo"] })}
      {renderInput("Lloji i pjesemarrjes", "participationType", { type: "select", options: PARTICIPATION_OPTIONS })}
      {renderInput("Kryesues/panelist", "chairPanelist", { type: "select", options: YES_NO_OPTIONS })}
      {renderInput("Ngjarje artistike/sportive", "artisticSportEvent", { type: "select", options: YES_NO_OPTIONS })}
      {renderInput("Linku i publikimit te ngjarjes", "eventPublicationLink", { wide: true, placeholder: "https://..." })}
      {renderInput("Kosto regjistrimi", "registrationFee", { placeholder: "p.sh. 220 EUR" })}
      {renderInput("Kosto udhetimi", "travelCost", { placeholder: "p.sh. 180 EUR" })}
      {renderInput("Kosto akomodimi", "accommodationCost", { placeholder: "p.sh. 300 EUR" })}
    </div>
  );

  const renderTeamMember = (member, index) => (
    <div className="reimbursement-team-card" key={`team-member-${index}`}>
      <div className="reimbursement-team-head">
        <strong>Anetari {index + 1}</strong>
        <button type="button" onClick={() => removeTeamMember(index)} aria-label="Largo anetarin">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="reimbursement-form-grid">
        <label className="reimbursement-field">
          <span>Emri dhe mbiemri</span>
          <input value={member.name} onChange={handleTeamMemberChange(index, "name")} />
        </label>
        <label className="reimbursement-field">
          <span>Grada/thirrja shkencore</span>
          <input value={member.scientificGrade} onChange={handleTeamMemberChange(index, "scientificGrade")} />
        </label>
        <label className="reimbursement-field">
          <span>Njesia akademike</span>
          <input value={member.academicUnit} onChange={handleTeamMemberChange(index, "academicUnit")} />
        </label>
        <label className="reimbursement-field">
          <span>Telefoni</span>
          <input value={member.phone} onChange={handleTeamMemberChange(index, "phone")} />
        </label>
        <label className="reimbursement-field">
          <span>Email</span>
          <input type="email" value={member.email} onChange={handleTeamMemberChange(index, "email")} />
        </label>
        <label className="reimbursement-field">
          <span>Specializimi</span>
          <input value={member.specialization} onChange={handleTeamMemberChange(index, "specialization")} />
        </label>
        <label className="reimbursement-field reimbursement-wide">
          <span>Kontributi ne projekt</span>
          <textarea value={member.contribution} onChange={handleTeamMemberChange(index, "contribution")} rows={2} />
        </label>
      </div>
    </div>
  );

  const renderProjectFields = () => (
    <div className="reimbursement-form-grid">
      {renderInput("Titulli i projektit", "projectTitle", { wide: true, required: true })}
      {renderInput("Kohezgjatja e projektit (ne muaj)", "projectDurationMonths", { inputMode: "numeric" })}
      {renderInput("Njesia akademike e UIBM-se qe aplikon", "applyingUnit")}
      {renderInput("Emri i dekanit", "deanName")}
      {renderInput("Vendi", "deanPlace")}
      {renderInput("Numri i telefonit", "deanPhone")}
      {renderInput("Email adresa", "deanEmail", { type: "email" })}
      {renderInput("Faqja e internetit/rrjeti social", "deanWebsite", { placeholder: "https://..." })}

      <div className="reimbursement-wide reimbursement-subsection">
        <div className="reimbursement-subsection-head">
          <strong>Ekipi hulumtues</strong>
          <button type="button" onClick={addTeamMember}>
            <Plus size={15} />
            Shto anetar
          </button>
        </div>
        <div className="reimbursement-team-grid">
          {form.teamMembers.map(renderTeamMember)}
        </div>
        {fieldErrors.teamMembers ? <small className="reimbursement-field-error">{fieldErrors.teamMembers}</small> : null}
      </div>

      {renderInput("Pershkrimi i projekt-propozimit dhe plani i hulumtimit", "projectDescription", {
        wide: true,
        type: "textarea",
        rows: 4,
      })}
      {renderInput("Fjale kyce per projektin", "projectKeywords", { wide: true })}
      {renderInput("Ndikimi dhe arsyeshmeria e projektit", "projectImpact", { wide: true, type: "textarea", rows: 3 })}
      {renderInput("Plani i punes dhe afatet kohore", "workPlan", { wide: true, type: "textarea", rows: 3 })}
      {renderInput("Kosto totale e projektit (EUR)", "totalProjectCost", { inputMode: "decimal" })}
      {renderInput("Shuma e kerkuar nga UIBM (EUR)", "requestedFromUibm", { inputMode: "decimal" })}
      {renderInput("Kosto materiale (40%)", "materialCost", { inputMode: "decimal" })}
      {renderInput("Kosto administrative (30%)", "administrativeCost", { inputMode: "decimal" })}
      {renderInput("Kosto te personelit (20%)", "personnelCost", { inputMode: "decimal" })}
      {renderInput("Kostot e tjera (10%)", "otherCosts", { inputMode: "decimal" })}
      {renderInput("Pershkrimi i detajuar i kostos", "detailedCostDescription", { wide: true, type: "textarea", rows: 3 })}
      {renderInput("Kodi / Thirrja", "projectCode")}
      {renderInput("Roli ne projekt", "projectRole", { placeholder: "p.sh. PI, bashkepunetor" })}
      {renderInput("Periudha", "projectPeriod", { placeholder: "p.sh. Jan 2026 - Qer 2026" })}
      {renderInput("Institucioni / Financuesi", "fundingBody")}
      {renderInput("Linja buxhetore", "budgetLine", { wide: true })}
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
          <span>Shuma e kerkuar</span>
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
          {amountPreview ? <small className="reimbursement-helper">Totali: {amountPreview}</small> : null}
          {fieldErrors.amount ? <small className="reimbursement-field-error">{fieldErrors.amount}</small> : null}
        </label>

        {renderInput("Valuta", "currency", { type: "select", options: ["EUR", "USD", "CHF"], required: true })}
        {renderInput("Shuma me fjale", "amountWords", { wide: true, placeholder: "p.sh. Nje mije e dyqind euro" })}
        {renderInput("Emri dhe mbiemri i aplikantit", "bankApplicantName")}

        <label className="reimbursement-field">
          <span>Numri i llogarise bankare / IBAN</span>
          <input
            value={form.bankAccountNumber}
            onChange={handleFieldChange("bankAccountNumber")}
            placeholder="Numri vendor ose XK..."
            autoComplete="off"
          />
          {fieldErrors.bankAccountNumber ? <small className="reimbursement-field-error">{fieldErrors.bankAccountNumber}</small> : null}
        </label>

        <div className="reimbursement-field reimbursement-bank-result">
          <span>Emri i bankes</span>
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
            <div className="reimbursement-bank-placeholder">Shkruaj numrin e llogarise</div>
          )}
          {fieldErrors.bankName ? <small className="reimbursement-field-error">{fieldErrors.bankName}</small> : null}
        </div>

        <label className="reimbursement-field">
          <span>SWIFT/BIC kodi</span>
          <input
            value={form.swiftCode}
            readOnly
            placeholder="Plotesohet automatikisht"
            className={visualBank ? "reimbursement-autofill-input" : ""}
          />
          {fieldErrors.swiftCode ? <small className="reimbursement-field-error">{fieldErrors.swiftCode}</small> : null}
        </label>

        {renderInput("Vendi", "bankCountry")}
        {renderInput("Data e shpenzimit", "expenseDate", { type: "date" })}
        {renderInput("Numri i fatures", "invoiceNumber")}
        {renderInput("Link dokumentesh", "attachmentUrl", { placeholder: "URL e fatures ose dokumenteve" })}
        {renderInput("Pershkrimi / Arsyeja", "purpose", { wide: true, type: "textarea", rows: 3, required: true })}
        {renderInput("Shenime shtese", "notes", { wide: true, type: "textarea", rows: 3 })}
      </div>
    </div>
  );

  const renderAttachmentUpload = () => (
    <div className="reimbursement-upload-box">
      <label className="reimbursement-upload-label">
        <span>Dokumente mbeshtetese</span>
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
        <p>Lejohen PDF, JPG, PNG dhe DOCX. Fajllat ruhen me kerkesen dhe shihen nga komisioni/prorektori.</p>
      )}
    </div>
  );

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
              <strong>{item.statusLabel || STATUS_LABELS[item.status] || item.status}</strong>
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
            {downloadingDocument === `${request.id}-${attachment.id}` ? "Duke shkarkuar..." : attachment.filename}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="reimbursement-flow">
      <article className="prof-card reimbursement-flow-card">
        <div className="reimbursement-flow-header">
          <div>
            <h3>{editingRequest ? "Edito kerkesen" : "Kerkese e re per financim"}</h3>
            {editingRequest ? <p>Po punon ne kerkesen {editingRequest.documentNumber || editingRequest.title}.</p> : null}
          </div>
          {editingRequest ? (
            <button type="button" className="reimbursement-download-btn" onClick={handleCancelEdit}>
              Anulo editimin
            </button>
          ) : null}
        </div>

        <form className="reimbursement-form" onSubmit={handleSubmit}>
          <div className="reimbursement-stepper" aria-label="Hapat e formularit te rimbursimit">
            {FORM_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`reimbursement-step ${stepStates[step.id] ? "is-complete" : ""}`}
              >
                <span>{stepStates[step.id] ? "OK" : index + 1}</span>
                <strong>{step.label}</strong>
              </div>
            ))}
          </div>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <Sparkles size={18} />
              <div>
                <h4>Te dhenat baze</h4>
                <p>Zgjidh llojin e kerkeses dhe verifiko te dhenat e aplikuesit para dergimit.</p>
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
                  <strong>{type.label}</strong>
                  <span>{type.description}</span>
                </button>
              ))}
            </div>

            {isLoadingContext ? (
              <div className="reimbursement-loading">
                <Loader2 size={18} className="reimbursement-spin" />
                Duke ngarkuar te dhenat automatike...
              </div>
            ) : (
              renderApplicantFields()
            )}
          </section>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <FileText size={18} />
              <div>
                <h4>Te dhenat akademike</h4>
                <p>{selectedTypeConfig.label}: fushat shfaqen sipas formularit zyrtar perkates.</p>
              </div>
            </div>

            {renderTypeFields()}
          </section>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <Wallet size={18} />
              <div>
                <h4>Te dhenat financiare/bankare</h4>
                <p>IBAN, banka, SWIFT dhe shuma validohen para dergimit final.</p>
              </div>
            </div>

            {renderFinanceFields()}
          </section>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <Upload size={18} />
              <div>
                <h4>Dokumentet mbeshtetese</h4>
                <p>Ngarko dokumentet zyrtare ose vendos nje link mbeshtetes per shqyrtim.</p>
              </div>
            </div>

            {renderAttachmentUpload()}
          </section>

          <div className="reimbursement-action-bar">
            <div className="reimbursement-action-feedback">
              {error ? <p className="reimbursement-message error" role="alert">{error}</p> : null}
              {success ? (
                <div className="reimbursement-message success">
                  <span>
                    {success.status === "draft"
                      ? "Draft-i u ruajt ne databaze."
                      : "Kerkesa u ruajt ne databaze dhe dokumentet u gjeneruan."}
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
                {isSubmitting ? "Duke ruajtur..." : "Ruaje si draft"}
              </button>
              <button type="submit" className="prof-btn-primary" disabled={isSubmitting || isLoadingContext}>
                <Upload size={16} />
                {isSubmitting ? "Duke derguar..." : "Dergo per shqyrtim"}
              </button>
            </div>
          </div>
        </form>
      </article>

      <article className="prof-card reimbursement-list-card">
        <div className="prof-card-header">
          <div>
            <h3>Rimbursimet e derguara</h3>
            <p>Kerkesat e ruajtura ne databaze me historikun e statusit dhe dokumentet perkatese.</p>
          </div>
        </div>

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
                    {[request.requestTypeLabel, formatAmount(request), normalizeDate(request.submittedAt || request.createdAt)]
                      .filter(Boolean)
                      .join(" | ")}
                  </p>
                  {request.statusHistory?.length ? (
                    <p className="reimbursement-history-line">
                      Historiku i fundit: {getLatestHistoryLabel(request.statusHistory)}
                    </p>
                  ) : null}
                  {renderAttachments(request)}
                  {renderStatusTimeline(request.statusHistory)}
                </div>
                <div className="reimbursement-request-actions">
                  <span className={`status-badge ${String(request.status).toLowerCase().replace(/\s+/g, "-")}`}>
                    {request.statusLabel || STATUS_LABELS[request.status] || request.status}
                  </span>
                  {!request.isLegacy ? (
                    <>
                      {["draft", "needs_correction"].includes(request.status) ? (
                        <button
                          type="button"
                          className="reimbursement-download-btn"
                          onClick={() => handleEditRequest(request)}
                        >
                          Edito
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="reimbursement-download-btn"
                        onClick={() => handleDownloadDocument(request, "pdf")}
                        disabled={downloadingDocument === `${request.id}-pdf`}
                      >
                        <Download size={16} />
                        {downloadingDocument === `${request.id}-pdf` ? "PDF..." : "PDF"}
                      </button>
                      <button
                        type="button"
                        className="reimbursement-download-btn"
                        onClick={() => handleDownloadDocument(request, "docx")}
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
              Nuk ka ende kerkesa rimbursimi per kete profesor.
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
