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
  "approved",
  "rejected",
  "paid",
]);

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  received: "Pranuar",
  in_review: "Ne shqyrtim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
  paid: "Paguar",
};

const CURRENCY_FALLBACK = "EUR";

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

function normalizeStatusHistory(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((item) => ({
    id: item.id,
    previousStatus: item.previousStatus || item.previous_status || null,
    previousStatusLabel: STATUS_LABELS[item.previousStatus || item.previous_status] || "",
    status: item.status || "",
    statusLabel: STATUS_LABELS[item.status] || item.status || "",
    actorId: item.actorId || item.actor_id || null,
    note: item.note || "",
    createdAt: item.createdAt || item.created_at || null,
  }));
}

function mapReimbursementRow(row) {
  const requestData = row.request_data || {};

  return {
    id: row.id,
    requestType: row.request_type || requestData.requestType || "",
    requestTypeLabel: REQUEST_TYPES[row.request_type] || requestData.requestTypeLabel || row.request_type || "",
    title: row.title || "",
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    currency: row.currency || CURRENCY_FALLBACK,
    status: row.status || "submitted",
    statusLabel: STATUS_LABELS[row.status] || row.status || "",
    submittedAt: row.submitted_at || row.created_at || null,
    documentNumber: row.document_number || "",
    documentFilename: row.document_filename || "",
    documentDocxFilename: row.document_docx_filename || "",
    downloadUrl: `/api/reimbursements/${row.id}/pdf`,
    docxDownloadUrl: `/api/reimbursements/${row.id}/docx`,
    statusHistory: normalizeStatusHistory(row.status_history || []),
    requestData,
  };
}

function buildHistorySelect(whereClause) {
  return `select r.id, r.owner_id, r.title, r.amount, r.currency, r.status, r.request_type, r.request_data,
                 r.document_number, r.document_filename, r.document_docx_filename,
                 r.submitted_at, r.created_at, r.updated_at,
                 coalesce(
                   (
                     select json_agg(
                       json_build_object(
                         'id', h.id,
                         'previousStatus', h.previous_status,
                         'status', h.status,
                         'actorId', h.actor_id,
                         'note', h.note,
                         'createdAt', h.created_at
                       )
                       order by h.created_at asc
                     )
                     from reimbursement_status_history h
                     where h.reimbursement_id = r.id
                   ),
                   '[]'::json
                 ) as status_history
          from reimbursements r
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
      publications: publicationsResult.rows.map(mapPublicationRow),
      conferences: conferencesResult.rows.map(mapConferenceRow),
    });
  } catch (error) {
    console.error("GET /api/reimbursements/context failed:", error);
    res.status(500).json({ error: "context_failed" });
  }
});

router.get("/", requireAuthenticatedUser, async (req, res) => {
  try {
    const { rows } = await db.query(
      `${buildHistorySelect("where r.owner_id = $1")}
       order by coalesce(r.submitted_at, r.created_at) desc`,
      [req.user.id]
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
    res.status(400).json({ error: "invalid_request_type" });
    return;
  }

  const formData = sanitizeRequestData(req.body?.formData);
  const amount = parseAmount(formData.amount);

  if (normalizeText(formData.amount) && amount === null) {
    res.status(400).json({ error: "invalid_amount", message: "Shuma duhet te jete numer valid." });
    return;
  }

  const user = await loadCurrentUser(req.user.id);

  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const autoFields = buildEditableAutoFields(user, formData);
  const requestData = {
    ...formData,
    auto: autoFields,
    requestType,
    requestTypeLabel: REQUEST_TYPES[requestType],
  };
  const title = buildRequestTitle(requestType, requestData);
  const currency = normalizeCurrency(formData.currency);
  const publicationId = requestType === "publication" ? parseOptionalUuid(formData.publicationId) : null;
  const conferenceId = requestType === "conference" ? parseOptionalInteger(formData.conferenceId) : null;
  const client = await db.connect();

  try {
    await client.query("begin");

    const insertResult = await client.query(
      `insert into reimbursements
       (owner_id, publication_id, conference_id, title, amount, currency, status, request_type, request_data, submitted_at)
       values ($1, $2, $3, $4, $5, $6, 'submitted', $7, $8::jsonb, now())
       returning id, owner_id, title, amount, currency, status, request_type, request_data,
                 document_number, document_filename, document_docx_filename, submitted_at, created_at, updated_at`,
      [req.user.id, publicationId, conferenceId, title, amount, currency, requestType, JSON.stringify(requestData)]
    );

    const inserted = insertResult.rows[0];
    const documentNumber = `RIM-${formatDocumentDate(inserted.submitted_at)}-${String(inserted.id).slice(0, 8).toUpperCase()}`;
    const rowForDocuments = { ...inserted, document_number: documentNumber };
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
      [inserted.id, documentNumber, filenames.pdf, filenames.docx, pdfBuffer, docxBuffer]
    );

    await client.query(
      `insert into reimbursement_status_history
       (reimbursement_id, previous_status, status, actor_id, note)
       values ($1, null, 'submitted', $2, $3)`,
      [inserted.id, req.user.id, "Kerkesa u krijua dhe u dorezua."]
    );

    const rowWithHistory = await selectReimbursementWithHistoryById(updateResult.rows[0].id, client);

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

  if (!VALID_REIMBURSEMENT_STATUSES.has(nextStatus)) {
    res.status(400).json({ error: "invalid_status" });
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const currentResult = await client.query(
      `select id, status
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

    await client.query(
      `update reimbursements
       set status = $2,
           updated_at = now()
       where id = $1`,
      [current.id, nextStatus]
    );

    await client.query(
      `insert into reimbursement_status_history
       (reimbursement_id, previous_status, status, actor_id, note)
       values ($1, $2, $3, $4, $5)`,
      [current.id, current.status, nextStatus, req.user.id, note || `Statusi u ndryshua ne ${STATUS_LABELS[nextStatus] || nextStatus}.`]
    );

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
