import React, { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Search, Sparkles, Wallet } from "lucide-react";
import { apiUrl } from "../../utils/api";

const REQUEST_TYPES = [
  {
    id: "publication",
    label: "Financim publikimi shkencor",
    description: "Per tarifa publikimi, DOI, revista ose conference proceedings.",
  },
  {
    id: "conference",
    label: "Financim pjesemarrjeje ne konference/simpozium",
    description: "Per regjistrim, udhetim, akomodim dhe pjesemarrje shkencore.",
  },
  {
    id: "project",
    label: "Financim projekti shkencor",
    description: "Per kosto projekti, thirrje, linja buxhetore dhe aktivitete kerkimore.",
  },
];

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  in_review: "Ne shqyrtim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
  paid: "Paguar",
};

const DEFAULT_FORM = {
  applicantName: "",
  applicantEmail: "",
  applicantFaculty: "",
  applicantDepartment: "",
  applicantOffice: "",
  applicantOrcidId: "",
  amount: "",
  currency: "EUR",
  expenseDate: "",
  invoiceNumber: "",
  iban: "",
  attachmentUrl: "",
  purpose: "",
  notes: "",
  publicationId: "",
  doi: "",
  publicationTitle: "",
  journal: "",
  publisher: "",
  publicationYear: "",
  publicationFee: "",
  conferenceId: "",
  conferenceTitle: "",
  location: "",
  conferenceDate: "",
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
};

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
  };
}

function createDefaultForm(profile) {
  return {
    ...DEFAULT_FORM,
    ...getAutoFieldDefaults(profile),
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

export default function ReimbursementManager({ profile, searchQuery = "", fallbackRows = [] }) {
  const [selectedType, setSelectedType] = useState("publication");
  const [form, setForm] = useState(DEFAULT_FORM);
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
  const [downloadingId, setDownloadingId] = useState("");
  const [hasHydratedAutoFields, setHasHydratedAutoFields] = useState(false);
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
    }));
    setHasHydratedAutoFields(true);
  }, [effectiveProfile, hasHydratedAutoFields, isLoadingContext]);

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    setError("");
    setSuccess(null);
  };

  const handlePublicationSelect = (event) => {
    const publicationId = event.target.value;
    const selectedPublication = context.publications.find((item) => String(item.id) === publicationId);

    setForm((prev) => ({
      ...prev,
      publicationId,
      doi: selectedPublication?.doi || prev.doi,
      publicationTitle: selectedPublication?.title || prev.publicationTitle,
      journal: selectedPublication?.venue || prev.journal,
      publisher: selectedPublication?.publisher || prev.publisher,
      publicationYear: selectedPublication?.publicationYear || prev.publicationYear,
    }));
  };

  const handleConferenceSelect = (event) => {
    const conferenceId = event.target.value;
    const selectedConference = context.conferences.find((item) => String(item.id) === conferenceId);

    setForm((prev) => ({
      ...prev,
      conferenceId,
      conferenceTitle: selectedConference?.title || prev.conferenceTitle,
      location: selectedConference?.location || prev.location,
      conferenceDate: selectedConference?.conferenceDate || prev.conferenceDate,
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

  const handleDownloadPdf = async (request) => {
    if (request.isLegacy) {
      return;
    }

    setDownloadingId(request.id);
    setError("");

    try {
      const response = await fetch(apiUrl(`/reimbursements/${request.id}/pdf`), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("PDF nuk u shkarkua.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = request.documentFilename || `${request.documentNumber || "rimbursim"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message || "Shkarkimi i PDF deshtoi.");
    } finally {
      setDownloadingId("");
    }
  };

  const renderAutoField = (label, field, type = "text") => (
    <label className="reimbursement-field">
      <span>{label}</span>
      <input type={type} value={form[field]} onChange={handleFieldChange(field)} placeholder="Nuk ka te dhena" />
    </label>
  );

  const renderPublicationFields = () => (
    <div className="reimbursement-form-grid">
      {context.publications.length ? (
        <label className="reimbursement-field reimbursement-wide">
          <span>Publikim nga Supabase</span>
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
          Publikimet e importuara nga ORCID/DOI do te shfaqen ketu. Nese publikimi mungon, perdor DOI lookup dhe ploteso fushat manualisht.
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

      <label className="reimbursement-field reimbursement-wide">
        <span>Titulli i publikimit</span>
        <input value={form.publicationTitle} onChange={handleFieldChange("publicationTitle")} required />
      </label>

      <label className="reimbursement-field">
        <span>Revista / Konferenca</span>
        <input value={form.journal} onChange={handleFieldChange("journal")} />
      </label>

      <label className="reimbursement-field">
        <span>Botuesi</span>
        <input value={form.publisher} onChange={handleFieldChange("publisher")} />
      </label>

      <label className="reimbursement-field">
        <span>Viti</span>
        <input value={form.publicationYear} onChange={handleFieldChange("publicationYear")} />
      </label>

      <label className="reimbursement-field">
        <span>Tarifa e publikimit</span>
        <input value={form.publicationFee} onChange={handleFieldChange("publicationFee")} placeholder="p.sh. 450 EUR" />
      </label>
    </div>
  );

  const renderConferenceFields = () => (
    <div className="reimbursement-form-grid">
      {context.conferences.length ? (
        <label className="reimbursement-field reimbursement-wide">
          <span>Konference nga Supabase</span>
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

      <label className="reimbursement-field reimbursement-wide">
        <span>Emri i konferences/simpoziumit</span>
        <input value={form.conferenceTitle} onChange={handleFieldChange("conferenceTitle")} required />
      </label>

      <label className="reimbursement-field">
        <span>Lokacioni</span>
        <input value={form.location} onChange={handleFieldChange("location")} />
      </label>

      <label className="reimbursement-field">
        <span>Data e eventit</span>
        <input type="date" value={form.conferenceDate} onChange={handleFieldChange("conferenceDate")} />
      </label>

      <label className="reimbursement-field">
        <span>Lloji i pjesemarrjes</span>
        <select value={form.participationType} onChange={handleFieldChange("participationType")}>
          <option>Prezantim</option>
          <option>Poster</option>
          <option>Pjesemarrje</option>
          <option>Keynote</option>
        </select>
      </label>

      <label className="reimbursement-field">
        <span>Kosto regjistrimi</span>
        <input value={form.registrationFee} onChange={handleFieldChange("registrationFee")} placeholder="p.sh. 220 EUR" />
      </label>

      <label className="reimbursement-field">
        <span>Kosto udhetimi</span>
        <input value={form.travelCost} onChange={handleFieldChange("travelCost")} placeholder="p.sh. 180 EUR" />
      </label>

      <label className="reimbursement-field">
        <span>Kosto akomodimi</span>
        <input value={form.accommodationCost} onChange={handleFieldChange("accommodationCost")} placeholder="p.sh. 300 EUR" />
      </label>
    </div>
  );

  const renderProjectFields = () => (
    <div className="reimbursement-form-grid">
      <label className="reimbursement-field reimbursement-wide">
        <span>Titulli i projektit shkencor</span>
        <input value={form.projectTitle} onChange={handleFieldChange("projectTitle")} required />
      </label>

      <label className="reimbursement-field">
        <span>Kodi / Thirrja</span>
        <input value={form.projectCode} onChange={handleFieldChange("projectCode")} />
      </label>

      <label className="reimbursement-field">
        <span>Roli ne projekt</span>
        <input value={form.projectRole} onChange={handleFieldChange("projectRole")} placeholder="p.sh. PI, bashkepunetor" />
      </label>

      <label className="reimbursement-field">
        <span>Periudha</span>
        <input value={form.projectPeriod} onChange={handleFieldChange("projectPeriod")} placeholder="p.sh. Jan 2026 - Qer 2026" />
      </label>

      <label className="reimbursement-field">
        <span>Institucioni / Financuesi</span>
        <input value={form.fundingBody} onChange={handleFieldChange("fundingBody")} />
      </label>

      <label className="reimbursement-field reimbursement-wide">
        <span>Linja buxhetore</span>
        <input value={form.budgetLine} onChange={handleFieldChange("budgetLine")} />
      </label>
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

  return (
    <div className="reimbursement-flow">
      <article className="prof-card reimbursement-flow-card">
        <div className="reimbursement-flow-header">
          <div>
            <span className="reimbursement-kicker">Rimbursime</span>
            <h3>Kerkese e re per financim</h3>
            <p>Zgjidh llojin, kontrollo fushat automatike, ploteso fushat manuale dhe dergo kerkesen per ruajtje ne Supabase me PDF.</p>
          </div>
          <div className="reimbursement-header-icon">
            <Wallet size={24} />
          </div>
        </div>

        <div className="reimbursement-step-row" aria-label="Flow i rimbursimit">
          <span>Rimbursime</span>
          <span>Zgjedh llojin</span>
          <span>Auto-fill</span>
          <span>Editim manual</span>
          <span>Submit + PDF</span>
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
                <h4>Fushat automatike</h4>
                <p>Keto merren nga Google/ORCID dhe profili ne Supabase. Profesori i kontrollon para dergimit.</p>
              </div>
            </div>

            {isLoadingContext ? (
              <div className="reimbursement-loading">
                <Loader2 size={18} className="reimbursement-spin" />
                Duke ngarkuar te dhenat automatike...
              </div>
            ) : (
              <div className="reimbursement-form-grid">
                {renderAutoField("Emri dhe mbiemri", "applicantName")}
                {renderAutoField("Email", "applicantEmail", "email")}
                {renderAutoField("Fakulteti", "applicantFaculty")}
                {renderAutoField("Departamenti", "applicantDepartment")}
                {renderAutoField("Zyra", "applicantOffice")}
                {renderAutoField("ORCID iD", "applicantOrcidId")}
              </div>
            )}
          </section>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <FileText size={18} />
              <div>
                <h4>{selectedTypeConfig.label}</h4>
                <p>Fushat qe sistemi i di mbushen automatikisht; pjesa tjeter plotesohet manualisht.</p>
              </div>
            </div>

            {renderTypeFields()}
          </section>

          <section className="reimbursement-section">
            <div className="reimbursement-section-head">
              <Wallet size={18} />
              <div>
                <h4>Fushat manuale per financa</h4>
                <p>Keto fusha perdoren per shqyrtim financiar dhe per dokumentin PDF.</p>
              </div>
            </div>

            <div className="reimbursement-form-grid">
              <label className="reimbursement-field">
                <span>Shuma e kerkuar</span>
                <input value={form.amount} onChange={handleFieldChange("amount")} inputMode="decimal" required />
              </label>

              <label className="reimbursement-field">
                <span>Valuta</span>
                <select value={form.currency} onChange={handleFieldChange("currency")}>
                  <option>EUR</option>
                  <option>USD</option>
                  <option>CHF</option>
                </select>
              </label>

              <label className="reimbursement-field">
                <span>Data e shpenzimit</span>
                <input type="date" value={form.expenseDate} onChange={handleFieldChange("expenseDate")} />
              </label>

              <label className="reimbursement-field">
                <span>Numri i fatures</span>
                <input value={form.invoiceNumber} onChange={handleFieldChange("invoiceNumber")} />
              </label>

              <label className="reimbursement-field">
                <span>IBAN / Llogaria bankare</span>
                <input value={form.iban} onChange={handleFieldChange("iban")} />
              </label>

              <label className="reimbursement-field">
                <span>Link dokumentesh</span>
                <input value={form.attachmentUrl} onChange={handleFieldChange("attachmentUrl")} placeholder="URL e fatures ose dokumenteve" />
              </label>

              <label className="reimbursement-field reimbursement-wide">
                <span>Pershkrimi / Arsyeja</span>
                <textarea value={form.purpose} onChange={handleFieldChange("purpose")} rows={3} required />
              </label>

              <label className="reimbursement-field reimbursement-wide">
                <span>Shenime shtese</span>
                <textarea value={form.notes} onChange={handleFieldChange("notes")} rows={3} />
              </label>
            </div>
          </section>

          {error ? <p className="reimbursement-message error" role="alert">{error}</p> : null}
          {success ? (
            <div className="reimbursement-message success">
              <span>Kerkesa u ruajt ne Supabase dhe PDF u gjenerua.</span>
              <button type="button" onClick={() => handleDownloadPdf(success)} disabled={downloadingId === success.id}>
                {downloadingId === success.id ? "Duke shkarkuar..." : "Shkarko PDF"}
              </button>
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
            <p>Kerkesat e ruajtura ne Supabase dhe dokumentet PDF perkatese.</p>
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
                </div>
                <div className="reimbursement-request-actions">
                  <span className={`status-badge ${String(request.status).toLowerCase().replace(/\s+/g, "-")}`}>
                    {STATUS_LABELS[request.status] || request.status}
                  </span>
                  {!request.isLegacy ? (
                    <button
                      type="button"
                      className="reimbursement-download-btn"
                      onClick={() => handleDownloadPdf(request)}
                      disabled={downloadingId === request.id}
                    >
                      <Download size={16} />
                      {downloadingId === request.id ? "PDF..." : "PDF"}
                    </button>
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
