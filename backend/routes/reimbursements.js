import express from "express";
import db from "../config/db.js";
import {
  buildReimbursementDocx,
  buildReimbursementPdf,
  getReimbursementDocumentFilenames,
} from "../services/reimbursementDocument.service.js";

const router = express.Router();

const REQUEST_TYPES = {
  publication: "Financim publikimi shkencor",
  conference: "Financim pjesemarrjeje ne konference/simpozium",
  project: "Financim projekti shkencor",
};

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

const ROLE_LABELS = {
  professor: "Profesor",
  committee: "Komision",
  prorector: "Prorektor",
  admin: "Administrator",
};

const COMMITTEE_REVIEW_STATUSES = ["submitted", "received", "in_review", "needs_correction"];
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const CURRENCY_FALLBACK = "EUR";

const REQUIRED_FIELDS = {
  common: [
    ["applicantName", "Emri dhe mbiemri eshte obligativ."],
    ["applicantEmail", "Email-i eshte obligativ."],
    ["applicantFaculty", "Njesia akademike eshte obligative."],
    ["amount", "Shuma e kerkuar eshte obligative."],
    ["currency", "Valuta eshte obligative."],
    ["purpose", "Pershkrimi/arsyeja eshte obligative."],
    ["bankApplicantName", "Emri i aplikantit ne banke eshte obligativ."],
    ["bankName", "Emri i bankes eshte obligativ."],
    ["bankAccountNumber", "Numri i llogarise bankare/IBAN eshte obligativ."],
  ],
  publication: [
    ["publicationTitle", "Titulli i punimit eshte obligativ."],
    ["mainAuthor", "Autori kryesor eshte obligativ."],
    ["affiliation", "Perkatesia/affiliation eshte obligative."],
    ["journal", "Emri i revistes eshte obligativ."],
    ["publisher", "Shtepia botuese eshte obligative."],
    ["indexingPlatform", "Indeksimi ne platforme eshte obligativ."],
    ["publicationLink", "Linku i publikimit eshte obligativ."],
  ],
  conference: [
    ["conferenceTitle", "Emertimi i ngjarjes eshte obligativ."],
    ["eventPlaceDate", "Vendi dhe data jane obligative."],
    ["organizer", "Organizatori eshte obligativ."],
    ["invitationProgram", "Ftesa/programi eshte obligativ."],
    ["abstractTitle", "Abstrakti dhe titulli i punimit jane obligative."],
    ["acceptanceConfirmation", "Konfirmimi i pranimit eshte obligativ."],
    ["participationType", "Lloji i pjesemarrjes eshte obligativ."],
  ],
  project: [
    ["projectTitle", "Titulli i projektit eshte obligativ."],
    ["projectDurationMonths", "Kohezgjatja e projektit eshte obligative."],
    ["applyingUnit", "Njesia akademike aplikuese eshte obligative."],
    ["deanName", "Emri i dekanit eshte obligativ."],
    ["projectDescription", "Pershkrimi i projekt-propozimit eshte obligativ."],
    ["projectKeywords", "Fjalet kyce jane obligative."],
    ["projectImpact", "Ndikimi/arsyeshmeria e projektit eshte obligative."],
    ["workPlan", "Plani i punes eshte obligativ."],
    ["totalProjectCost", "Kosto totale e projektit eshte obligative."],
    ["requestedFromUibm", "Shuma e kerkuar nga UIBM eshte obligative."],
    ["detailedCostDescription", "Pershkrimi i detajuar i kostos eshte obligativ."],
  ],
};

function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te derguar kerkese." });
    return;
  }

  next();
}

function canManageReimbursements(user) {
  return ["committee", "prorector", "admin"].includes(user?.role);
}

function normalizeText(value) {
  return String(value ?? "").trim();
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

async function loadCurrentUser(userId) {
  const result = await db.query(
    `select id, google_id, orcid_id, email, full_name, role, faculty, department, office
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
  return {
    id: row.id,
    doi: row.doi || "",
    title: row.title || "",
    venue: row.venue || row.container_title || "",
    publisher: row.publisher || "",
    publicationYear: row.publication_year || row.year || "",
    status: row.status || "",
    sourceUrl: row.source_url || "",
  };
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
    requestData,
  };
}

function buildHistorySelect(whereClause) {
  return `select r.id, r.owner_id, r.title, r.amount, r.currency, r.status, r.request_type, r.request_data,
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

  return result.rows[0] || null;
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

function validateReimbursementPayload(requestType, formData, options = {}) {
  const errors = [];
  const amount = parseAmount(formData.amount);

  if (normalizeText(formData.amount) && amount === null) {
    errors.push({ field: "amount", message: "Shuma duhet te jete numer valid." });
  }

  if (options.asDraft) {
    return errors;
  }

  errors.push(...validateRequiredFields(formData, REQUIRED_FIELDS.common));
  errors.push(...validateRequiredFields(formData, REQUIRED_FIELDS[requestType] || []));

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
  }

  return errors;
}

function buildRequestPayload(user, requestType, formData) {
  const autoFields = buildEditableAutoFields(user, formData);
  const requestData = {
    ...formData,
    auto: autoFields,
    requestType,
    requestTypeLabel: REQUEST_TYPES[requestType],
  };
  const title = buildRequestTitle(requestType, requestData);
  const amount = parseAmount(formData.amount);
  const currency = normalizeCurrency(formData.currency);
  const publicationId = requestType === "publication" ? parseOptionalUuid(formData.publicationId) : null;
  const conferenceId = requestType === "conference" ? parseOptionalInteger(formData.conferenceId) : null;

  return { requestData, title, amount, currency, publicationId, conferenceId };
}

async function insertStatusHistory(client, reimbursementId, previousStatus, status, actor, note) {
  await client.query(
    `insert into reimbursement_status_history
     (reimbursement_id, previous_status, status, actor_id, actor_role, actor_name, note)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      reimbursementId,
      previousStatus,
      status,
      actor?.id || null,
      actor?.role || null,
      actor?.displayName || actor?.name || actor?.email || null,
      note || `Statusi u ndryshua ne ${STATUS_LABELS[status] || status}.`,
    ]
  );
}

async function notifyOwner(client, reimbursementId, ownerId, status, note) {
  if (!ownerId) {
    return;
  }

  await client.query(
    `insert into notifications (user_id, title, message, category)
     values ($1, $2, $3, 'Rimbursime')`,
    [
      ownerId,
      `Rimbursimi: ${STATUS_LABELS[status] || status}`,
      note || `Statusi i kerkeses suaj u ndryshua ne ${STATUS_LABELS[status] || status}.`,
    ]
  );
}

async function createGeneratedDocuments(client, row) {
  const documentNumber =
    row.document_number || `RIM-${formatDocumentDate(row.submitted_at || row.created_at)}-${String(row.id).slice(0, 8).toUpperCase()}`;
  const rowForDocuments = { ...row, document_number: documentNumber };
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
     returning id, owner_id, title, amount, currency, status, request_type, request_data,
               document_number, document_filename, document_docx_filename, submitted_at, created_at, updated_at`,
    [row.id, documentNumber, filenames.pdf, filenames.docx, pdfBuffer, docxBuffer]
  );

  return updateResult.rows[0];
}

async function ensureGeneratedDocument(row, format) {
  const documentNumber =
    row.document_number || `RIM-${formatDocumentDate(row.submitted_at || row.created_at)}-${String(row.id).slice(0, 8).toUpperCase()}`;
  const filenames = getReimbursementDocumentFilenames({
    ...row,
    document_number: documentNumber,
  });

  if (format === "docx") {
    const filename = row.document_docx_filename || filenames.docx;
    const buffer = row.generated_docx || (await buildReimbursementDocx({ ...row, document_number: documentNumber }));

    if (!row.generated_docx || !row.document_docx_filename || !row.document_number) {
      await db.query(
        `update reimbursements
         set document_number = coalesce(document_number, $2),
             document_docx_filename = coalesce(document_docx_filename, $3),
             generated_docx = coalesce(generated_docx, $4),
             updated_at = now()
         where id = $1`,
        [row.id, documentNumber, filename, buffer]
      );
    }

    return { buffer, filename };
  }

  const filename = row.document_filename || filenames.pdf;
  const buffer = row.generated_pdf || (await buildReimbursementPdf({ ...row, document_number: documentNumber }));

  if (!row.generated_pdf || !row.document_filename || !row.document_number) {
    await db.query(
      `update reimbursements
       set document_number = coalesce(document_number, $2),
           document_filename = coalesce(document_filename, $3),
           generated_pdf = coalesce(generated_pdf, $4),
           updated_at = now()
       where id = $1`,
      [row.id, documentNumber, filename, buffer]
    );
  }

  return { buffer, filename };
}

function getListScopeWhere(user, scope) {
  const normalizedScope = normalizeText(scope);

  if (user.role === "professor" || normalizedScope === "mine") {
    return {
      where: "where r.owner_id = $1",
      params: [user.id],
    };
  }

  if (user.role === "committee" || normalizedScope === "review") {
    return {
      where: "where r.status = any($1::text[])",
      params: [COMMITTEE_REVIEW_STATUSES],
    };
  }

  if (user.role === "prorector" || normalizedScope === "final") {
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

  if (user.role === "admin" || normalizedScope === "all") {
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
  if (user.role === "admin") {
    return Array.from(VALID_REIMBURSEMENT_STATUSES).filter((status) => status !== "draft");
  }

  if (user.role === "committee" && COMMITTEE_REVIEW_STATUSES.includes(currentStatus)) {
    return ["received", "in_review", "needs_correction", "committee_approved", "rejected"];
  }

  if (user.role === "prorector" && currentStatus === "committee_approved") {
    return ["approved", "rejected"];
  }

  if (user.role === "prorector" && currentStatus === "approved") {
    return ["paid"];
  }

  return [];
}

function parseAttachmentFile(file) {
  const filename = normalizeText(file?.filename).replace(/[\\/]/g, "-");
  const mimeType = normalizeText(file?.mimeType || file?.type);
  const base64 = normalizeText(file?.base64).replace(/^data:[^;]+;base64,/, "");

  if (!filename) {
    return { error: "Emri i fajllit mungon." };
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

  return { filename, mimeType, content, sizeBytes: content.length };
}

router.get("/context", requireAuthenticatedUser, async (req, res) => {
  try {
    const user = await loadCurrentUser(req.user.id);

    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    const [publicationsResult, conferencesResult] = await Promise.all([
      db.query(
        `select p.id, p.doi, p.title, p.venue, p.publication_year, p.status,
                m.container_title, m.publisher, m.year, m.source_url
         from publications p
         left join publication_metadata m on m.doi = p.doi
         where p.owner_id = $1
         order by p.updated_at desc, p.created_at desc
         limit 100`,
        [req.user.id]
      ),
      db.query(
        `select id, title, acronym, field, location, submission_deadline, conference_date, website
         from conferences
         order by conference_date nulls last, created_at desc
         limit 100`
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
    const scope = getListScopeWhere(req.user, req.query.scope);
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
    const scope = getListScopeWhere(req.user, req.query.scope);
    const { rows } = await db.query(
      `${buildHistorySelect(scope.where)}
       order by coalesce(r.submitted_at, r.created_at) desc`,
      scope.params
    );

    res.json(rows.map(mapReimbursementRow));
  } catch (error) {
    console.error("GET /api/reimbursements failed:", error);
    res.status(500).json({ error: "list_failed" });
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
  const formData = sanitizeRequestData(req.body?.formData);
  const validationErrors = validateReimbursementPayload(requestType, formData, { asDraft });

  if (validationErrors.length) {
    res.status(400).json({
      error: "validation_failed",
      message: validationErrors[0].message,
      errors: validationErrors,
    });
    return;
  }

  const user = await loadCurrentUser(req.user.id);

  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const payload = buildRequestPayload(user, requestType, formData);
  const status = asDraft ? "draft" : "submitted";
  const client = await db.connect();

  try {
    await client.query("begin");

    const insertResult = await client.query(
      `insert into reimbursements
       (owner_id, publication_id, conference_id, title, amount, currency, status, request_type, request_data, submitted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, case when $7 = 'submitted' then now() else null end)
       returning id, owner_id, title, amount, currency, status, request_type, request_data,
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
      asDraft ? "Kerkesa u ruajt si draft." : "Kerkesa u krijua dhe u dorezua per shqyrtim."
    );

    const rowWithHistory = await selectReimbursementWithHistoryById(withDocuments.id, client);

    await client.query("commit");

    res.status(201).json({ data: mapReimbursementRow(rowWithHistory) });
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

  const formData = sanitizeRequestData(req.body?.formData);
  const action = normalizeText(req.body?.action || "draft");
  const isSubmit = action === "submit";
  const validationErrors = validateReimbursementPayload(requestType, formData, { asDraft: !isSubmit });

  if (validationErrors.length) {
    res.status(400).json({
      error: "validation_failed",
      message: validationErrors[0].message,
      errors: validationErrors,
    });
    return;
  }

  const user = await loadCurrentUser(req.user.id);

  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const payload = buildRequestPayload(user, requestType, formData);
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

    const nextStatus = isSubmit ? "submitted" : current.status === "needs_correction" ? "needs_correction" : "draft";
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

    if (isSubmit && current.status !== "submitted") {
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

    res.json({ data: mapReimbursementRow(rowWithHistory) });
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

    const validationErrors = validateReimbursementPayload(current.request_type, current.request_data || {}, { asDraft: false });

    if (validationErrors.length) {
      await client.query("rollback");
      res.status(400).json({
        error: "validation_failed",
        message: validationErrors[0].message,
        errors: validationErrors,
      });
      return;
    }

    const updateResult = await client.query(
      `update reimbursements
       set status = 'submitted',
           submitted_at = coalesce(submitted_at, now()),
           updated_at = now()
       where id = $1
       returning id, owner_id, title, amount, currency, status, request_type, request_data,
                 document_number, document_filename, document_docx_filename, submitted_at, created_at, updated_at`,
      [current.id]
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

router.patch("/:id/status", requireAuthenticatedUser, async (req, res) => {
  if (!canManageReimbursements(req.user)) {
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
    const allowedStatuses = getAllowedStatuses(req.user, current.status);

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

    const historyNote = note || `Statusi u ndryshua ne ${STATUS_LABELS[nextStatus] || nextStatus}.`;

    await insertStatusHistory(client, current.id, current.status, nextStatus, req.user, historyNote);
    await notifyOwner(client, current.id, current.owner_id, nextStatus, historyNote);

    const rowWithHistory = await selectReimbursementWithHistoryById(current.id, client);

    await client.query("commit");

    res.json({ data: mapReimbursementRow(rowWithHistory) });
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
         (reimbursement_id, uploaded_by, filename, mime_type, size_bytes, content)
         values ($1, $2, $3, $4, $5, $6)`,
        [current.id, req.user.id, file.filename, file.mimeType, file.sizeBytes, file.content]
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
              document_number, document_filename, document_docx_filename, generated_pdf,
              submitted_at, created_at
       from reimbursements
       where id = $1
       limit 1`,
      [req.params.id]
    );

    const row = rows[0] || null;

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
              document_number, document_filename, document_docx_filename, generated_docx,
              submitted_at, created_at
       from reimbursements
       where id = $1
       limit 1`,
      [req.params.id]
    );

    const row = rows[0] || null;

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
