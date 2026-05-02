import express from "express";
import db from "../config/db.js";

const router = express.Router();

const REQUEST_TYPES = {
  publication: "Financim publikimi shkencor",
  conference: "Financim pjesemarrjeje ne konference/simpozium",
  project: "Financim projekti shkencor",
};

const CURRENCY_FALLBACK = "EUR";

function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te derguar kerkese." });
    return;
  }

  next();
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

function sanitizeRequestData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  return Object.entries(data).reduce((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key] = value.trim();
      return acc;
    }

    if (value === null || typeof value === "number" || typeof value === "boolean") {
      acc[key] = value;
      return acc;
    }

    return acc;
  }, {});
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
    submittedAt: row.submitted_at || row.created_at || null,
    documentNumber: row.document_number || "",
    documentFilename: row.document_filename || "",
    downloadUrl: `/api/reimbursements/${row.id}/pdf`,
    requestData,
  };
}

function removeDiacritics(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value) {
  return removeDiacritics(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value, maxLength = 90) {
  const words = removeDiacritics(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = nextLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : [""];
}

function addField(lines, label, value) {
  const text = normalizeText(value);

  if (!text) {
    return;
  }

  wrapText(`${label}: ${text}`).forEach((line) => lines.push(line));
}

function buildDocumentLines(row) {
  const data = row.request_data || {};
  const auto = data.auto || {};
  const lines = [
    "UMIBRes - Kerkese per rimbursim",
    `Numri i dokumentit: ${row.document_number || ""}`,
    `Data e dorezimit: ${formatDate(row.submitted_at || row.created_at)}`,
    `Lloji i kerkeses: ${REQUEST_TYPES[row.request_type] || data.requestTypeLabel || ""}`,
    "",
    "Te dhenat automatike",
  ];

  addField(lines, "Profesori", auto.name);
  addField(lines, "Email", auto.email);
  addField(lines, "Fakulteti", auto.faculty);
  addField(lines, "Departamenti", auto.department);
  addField(lines, "Zyra", auto.office);
  addField(lines, "ORCID iD", auto.orcidId || "Nuk eshte lidhur");
  lines.push("");
  lines.push("Detajet e kerkeses");

  if (row.request_type === "publication") {
    addField(lines, "DOI", data.doi);
    addField(lines, "Titulli i publikimit", data.publicationTitle);
    addField(lines, "Revista/Konferenca", data.journal);
    addField(lines, "Botuesi", data.publisher);
    addField(lines, "Viti", data.publicationYear);
    addField(lines, "Tarifa e publikimit", data.publicationFee);
  }

  if (row.request_type === "conference") {
    addField(lines, "Konferenca/Simpoziumi", data.conferenceTitle);
    addField(lines, "Lokacioni", data.location);
    addField(lines, "Data", data.conferenceDate);
    addField(lines, "Lloji i pjesemarrjes", data.participationType);
    addField(lines, "Kosto regjistrimi", data.registrationFee);
    addField(lines, "Kosto udhetimi", data.travelCost);
    addField(lines, "Kosto akomodimi", data.accommodationCost);
  }

  if (row.request_type === "project") {
    addField(lines, "Titulli i projektit", data.projectTitle);
    addField(lines, "Kodi/Thirrja", data.projectCode);
    addField(lines, "Roli ne projekt", data.projectRole);
    addField(lines, "Periudha", data.projectPeriod);
    addField(lines, "Institucioni/Financuesi", data.fundingBody);
    addField(lines, "Linja buxhetore", data.budgetLine);
  }

  addField(lines, "Shuma e kerkuar", row.amount ? `${row.amount} ${row.currency}` : "");
  addField(lines, "Data e shpenzimit", data.expenseDate);
  addField(lines, "Numri i fatures", data.invoiceNumber);
  addField(lines, "IBAN / Llogaria bankare", data.iban);
  addField(lines, "Link dokumentesh", data.attachmentUrl);
  addField(lines, "Pershkrimi", data.purpose);
  addField(lines, "Shenime", data.notes);

  return lines.filter((line, index, allLines) => !(line === "" && allLines[index - 1] === ""));
}

function buildPdfBuffer(row) {
  const lines = buildDocumentLines(row).slice(0, 42);
  const content = [
    "BT",
    "/F1 16 Tf",
    "50 790 Td",
    `(${escapePdfText(lines[0] || "Kerkese per rimbursim")}) Tj`,
    "/F1 10 Tf",
    "0 -24 Td",
    ...lines.slice(1).flatMap((line) => {
      if (!line) {
        return ["0 -12 Td"];
      }

      return [`(${escapePdfText(line)}) Tj`, "0 -16 Td"];
    }),
    "ET",
  ].join("\n");

  const stream = `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    stream,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "ascii");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "ascii");
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
         order by p.created_at desc
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
      `select id, owner_id, title, amount, currency, status, request_type, request_data,
              document_number, document_filename, submitted_at, created_at, updated_at
       from reimbursements
       where owner_id = $1
       order by coalesce(submitted_at, created_at) desc`,
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
  const client = await db.connect();

  try {
    await client.query("begin");

    const insertResult = await client.query(
      `insert into reimbursements
       (owner_id, title, amount, currency, status, request_type, request_data, submitted_at)
       values ($1, $2, $3, $4, 'submitted', $5, $6::jsonb, now())
       returning id, owner_id, title, amount, currency, status, request_type, request_data,
                 document_number, document_filename, submitted_at, created_at, updated_at`,
      [req.user.id, title, amount, currency, requestType, JSON.stringify(requestData)]
    );

    const inserted = insertResult.rows[0];
    const documentNumber = `RIM-${formatDocumentDate(inserted.submitted_at)}-${String(inserted.id).slice(0, 8).toUpperCase()}`;
    const documentFilename = `${documentNumber}.pdf`;
    const pdfBuffer = buildPdfBuffer({
      ...inserted,
      document_number: documentNumber,
      document_filename: documentFilename,
    });

    const updateResult = await client.query(
      `update reimbursements
       set document_number = $2,
           document_filename = $3,
           generated_pdf = $4,
           updated_at = now()
       where id = $1
       returning id, owner_id, title, amount, currency, status, request_type, request_data,
                 document_number, document_filename, submitted_at, created_at, updated_at`,
      [inserted.id, documentNumber, documentFilename, pdfBuffer]
    );

    await client.query("commit");

    res.status(201).json({ data: mapReimbursementRow(updateResult.rows[0]) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("POST /api/reimbursements failed:", error);
    res.status(500).json({ error: "create_failed" });
  } finally {
    client.release();
  }
});

router.get("/:id/pdf", requireAuthenticatedUser, async (req, res) => {
  try {
    const { rows } = await db.query(
      `select id, owner_id, title, amount, currency, status, request_type, request_data,
              document_number, document_filename, generated_pdf, submitted_at, created_at
       from reimbursements
       where id = $1 and owner_id = $2
       limit 1`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const row = rows[0];
    let pdfBuffer = row.generated_pdf;
    let filename = row.document_filename;

    if (!pdfBuffer) {
      const documentNumber =
        row.document_number || `RIM-${formatDocumentDate(row.submitted_at || row.created_at)}-${String(row.id).slice(0, 8).toUpperCase()}`;
      filename = filename || `${documentNumber}.pdf`;
      pdfBuffer = buildPdfBuffer({ ...row, document_number: documentNumber, document_filename: filename });

      await db.query(
        `update reimbursements
         set document_number = coalesce(document_number, $2),
             document_filename = coalesce(document_filename, $3),
             generated_pdf = $4,
             updated_at = now()
         where id = $1`,
        [row.id, documentNumber, filename, pdfBuffer]
      );
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename || "rimbursim.pdf"}"`);
    res.send(Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer));
  } catch (error) {
    console.error("GET /api/reimbursements/:id/pdf failed:", error);
    res.status(500).json({ error: "pdf_failed" });
  }
});

export default router;
