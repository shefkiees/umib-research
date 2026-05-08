import React, { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Plus, Search, Sparkles, Trash2, Wallet } from "lucide-react";
import { apiUrl } from "../../utils/api";

const REQUEST_TYPES = [
  {
    id: "publication",
    label: "F1 - Publikime shkencore",
    description: "Financim i publikimit shkencor sipas Formularit 1.",
  },
  {
    id: "conference",
    label: "F2 - Konferenca dhe simpoziume",
    description: "Pjesemarrje, prezantim, poster, panel ose aktivitet shkencor.",
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
  approved: "Aprovuar",
  rejected: "Refuzuar",
  paid: "Paguar",
};

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
  const [hasHydratedAutoFields, setHasHydratedAutoFields] = useState(false);
  const [hasHydratedPublicationFields, setHasHydratedPublicationFields] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const effectiveProfile = useMemo(
    () => resolveProfile(context.profile, profile),
    [context.profile, profile]
  );

  const selectedTypeConfig = REQUEST_TYPES.find((item) => item.id === selectedType) || REQUEST_TYPES[0];

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

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess(null);

    try {
      const response = await fetch(apiUrl("/reimbursements"), {
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
      const result = await response.json();

      if (response.status === 401) {
        throw new Error("Sesioni ka skaduar. Kyquni perseri me Google.");
      }

      if (!response.ok) {
        throw new Error(result.message || "Kerkesa nuk u ruajt.");
      }

      setRequests((prev) => [result.data, ...prev.filter((item) => item.id !== result.data.id)]);
      setHasLoadedRequests(true);
      setSuccess(result.data);
      setForm(createDefaultForm(effectiveProfile));
      setHasHydratedAutoFields(true);
    } catch (submitError) {
      setError(submitError.message || "Ndodhi nje gabim gjate dergimit.");
    } finally {
      setIsSubmitting(false);
    }
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

  const renderInput = (label, field, options = {}) => {
    const className = options.wide ? "reimbursement-field reimbursement-wide" : "reimbursement-field";

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
        />
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
    <div className="reimbursement-form-grid">
      {renderInput("Shuma e kerkuar", "amount", { inputMode: "decimal", required: true })}
      {renderInput("Valuta", "currency", { type: "select", options: ["EUR", "USD", "CHF"], required: true })}
      {renderInput("Shuma me fjale", "amountWords", { wide: true, placeholder: "p.sh. Nje mije e dyqind euro" })}
      {renderInput("Emri dhe mbiemri i aplikantit", "bankApplicantName")}
      {renderInput("Emri i bankes", "bankName")}
      {renderInput("Numri i llogarise bankare / IBAN", "bankAccountNumber", { placeholder: "IBAN ose numer llogarie" })}
      {renderInput("SWIFT kodi", "swiftCode")}
      {renderInput("Vendi", "bankCountry")}
      {renderInput("Data e shpenzimit", "expenseDate", { type: "date" })}
      {renderInput("Numri i fatures", "invoiceNumber")}
      {renderInput("IBAN / Llogaria bankare (legacy)", "iban")}
      {renderInput("Link dokumentesh", "attachmentUrl", { placeholder: "URL e fatures ose dokumenteve" })}
      {renderInput("Pershkrimi / Arsyeja", "purpose", { wide: true, type: "textarea", rows: 3, required: true })}
      {renderInput("Shenime shtese", "notes", { wide: true, type: "textarea", rows: 3 })}
    </div>
  );

  return (
    <div className="reimbursement-flow">
      <article className="prof-card reimbursement-flow-card">
        <div className="reimbursement-flow-header">
          <h3>Kerkese e re per financim</h3>
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

        <form className="reimbursement-form" onSubmit={handleSubmit}>
          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <Sparkles size={18} />
              <div>
                <h4>Te dhenat e aplikuesit</h4>
                <p>Keto merren nga profili dhe mund te plotesohen para dergimit.</p>
              </div>
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
                <h4>{selectedTypeConfig.label}</h4>
                <p>Fushat jane zgjeruar sipas formularit zyrtar per kete lloj kerkese.</p>
              </div>
            </div>

            {renderTypeFields()}
          </section>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <Wallet size={18} />
              <div>
                <h4>Te dhenat bankare dhe financiare</h4>
                <p>Keto fusha ruhen ne request_data dhe futen ne PDF/DOCX.</p>
              </div>
            </div>

            {renderFinanceFields()}
          </section>

          {error ? <p className="reimbursement-message error" role="alert">{error}</p> : null}
          {success ? (
            <div className="reimbursement-message success">
              <span>Kerkesa u ruajt ne databaze dhe dokumentet u gjeneruan.</span>
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

          <div className="reimbursement-actions">
            <button type="submit" className="prof-btn-primary" disabled={isSubmitting || isLoadingContext}>
              {isSubmitting ? "Duke derguar..." : "Submit kerkesen"}
            </button>
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
                    {[request.requestTypeLabel, formatAmount(request), normalizeDate(request.submittedAt)]
                      .filter(Boolean)
                      .join(" | ")}
                  </p>
                  {request.statusHistory?.length ? (
                    <p className="reimbursement-history-line">
                      Historiku i fundit: {getLatestHistoryLabel(request.statusHistory)}
                    </p>
                  ) : null}
                </div>
                <div className="reimbursement-request-actions">
                  <span className={`status-badge ${String(request.status).toLowerCase().replace(/\s+/g, "-")}`}>
                    {request.statusLabel || STATUS_LABELS[request.status] || request.status}
                  </span>
                  {!request.isLegacy ? (
                    <>
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
