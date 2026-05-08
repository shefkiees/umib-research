import PDFDocument from "pdfkit";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const FORM_TITLES = {
  publication: "KERKESE PER FINANCIM TE PUBLIKIMIT SHKENCOR (Formulari 1)",
  conference: "FORMULAR I APLIKIMIT PER FINANCIM TE PJESEMARRJES NE KONFERENCA DHE SIMPOZIUME (Formulari 2)",
  project: "FORMULAR I APLIKIMIT PER FINANCIM TE PROJEKTEVE SHKENCORE (Formulari 3)",
};

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  received: "Pranuar",
  in_review: "Ne shqyrtim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
  paid: "Paguar",
};

const EMPTY_VALUE = "-";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function formatDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toISOString().slice(0, 10);
}

function valueOf(data, field) {
  if (field === "amount") {
    return data.amount ? `${data.amount} ${data.currency || "EUR"}` : "";
  }

  if (field === "submittedAt") {
    return formatDate(data.submittedAt);
  }

  if (field === "status") {
    return STATUS_LABELS[data.status] || data.status || "";
  }

  return normalizeText(data.requestData?.[field] ?? data[field]);
}

function arrayText(items, formatter) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  return items
    .map(formatter)
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");
}

function createField(label, field) {
  return { label, field };
}

function getCommonApplicantFields() {
  return [
    createField("Emri dhe mbiemri", "applicantName"),
    createField("Email", "applicantEmail"),
    createField("Njesia akademike", "applicantFaculty"),
    createField("Departamenti", "applicantDepartment"),
    createField("Thirrja shkencore", "scientificTitle"),
    createField("Thirrja akademike", "academicTitle"),
    createField("ORCID iD", "applicantOrcidId"),
  ];
}

function getBankFields() {
  return [
    createField("Emri dhe mbiemri i aplikantit", "bankApplicantName"),
    createField("Emri bankes", "bankName"),
    createField("Numri i llogarise bankare / IBAN", "bankAccountNumber"),
    createField("SWIFT kodi", "swiftCode"),
    createField("Vendi", "bankCountry"),
    createField("Shuma e kerkuar", "amount"),
    createField("Sheno me fjale", "amountWords"),
  ];
}

function getOfficeFields() {
  return [
    createField("Numri i dokumentit", "documentNumber"),
    createField("Data e dorezimit", "submittedAt"),
    createField("Statusi aktual", "status"),
  ];
}

function getPublicationSections() {
  return [
    {
      title: "Parashtruesi i kerkeses",
      fields: [
        ...getCommonApplicantFields(),
        createField("Autor kryesor", "mainAuthor"),
        createField("Autor korrespondent", "correspondingAuthor"),
        createField("Bashkautoret", "coauthors"),
      ],
    },
    {
      title: "Detajet e publikimit",
      fields: [
        createField("Perkatesia e autorit (affiliation)", "affiliation"),
        createField("Titulli i punimit", "publicationTitle"),
        createField("DOI", "doi"),
        createField("Emri i revistes", "journal"),
        createField("Shtepia botuese", "publisher"),
        createField("Indeksim ne platformen", "indexingPlatform"),
        createField("Impact faktori (IF)", "impactFactor"),
        createField("Scopus (Q1-Q4)", "scopusQuartile"),
        createField("Data e pranimit", "acceptanceDate"),
        createField("Data e publikimit", "publicationDate"),
        createField("Linku i publikimit", "publicationLink"),
        createField("Deshmia e regjistrimit ne databazen e UIBM", "uibmDatabaseEvidence"),
      ],
    },
    {
      title: "Informata per konference/simpozium (nese aplikohet)",
      fields: [
        createField("Detajet e organizimit", "publicationConferenceDetails"),
        createField("Linku i konferences", "conferenceLink"),
        createField("Vendi i konferences", "conferenceLocation"),
        createField("Data", "conferencePresentationDate"),
      ],
    },
    { title: "Te dhenat bankare", fields: getBankFields() },
    { title: "Plotesohet nga zyra", fields: getOfficeFields() },
  ];
}

function getConferenceSections() {
  return [
    {
      title: "Parashtruesi i kerkeses",
      fields: [
        ...getCommonApplicantFields(),
        createField("Autori kryesor", "mainAuthor"),
        createField("Bashkepjesemarresi", "coParticipant"),
      ],
    },
    {
      title: "Detajet e konferences, simpoziumit ose aktivitetit",
      fields: [
        createField("Emertimi i ngjarjes", "conferenceTitle"),
        createField("Vendi dhe data", "eventPlaceDate"),
        createField("Organizatori", "organizer"),
        createField("Ftesa dhe programi", "invitationProgram"),
        createField("Abstrakti dhe titulli i punimit", "abstractTitle"),
        createField("Konfirmimi i pranimit te punimit", "acceptanceConfirmation"),
        createField("Autoret e punimit (affiliation)", "authorsAffiliation"),
        createField("Foles me kumtese/poster", "speakerWithPaperPoster"),
        createField("Kryesues/panelist", "chairPanelist"),
        createField("Ngjarje artistike/sportive", "artisticSportEvent"),
        createField("Linku i publikimit te ngjarjes", "eventPublicationLink"),
        createField("Kosto regjistrimi", "registrationFee"),
        createField("Kosto udhetimi", "travelCost"),
        createField("Kosto akomodimi", "accommodationCost"),
      ],
    },
    { title: "Te dhenat bankare", fields: getBankFields() },
    { title: "Plotesohet nga zyra", fields: getOfficeFields() },
  ];
}

function getProjectSections(data) {
  const teamMembers = arrayText(data.requestData?.teamMembers, (member, index) => {
    const values = [
      `Anetari ${index + 1}`,
      member?.name,
      member?.scientificGrade,
      member?.academicUnit,
      member?.phone,
      member?.email,
      member?.specialization,
      member?.contribution,
    ].filter(Boolean);

    return values.join(" | ");
  });

  return [
    {
      title: "Pjesa 1: Administrimi",
      fields: [
        createField("Titulli i projektit", "projectTitle"),
        createField("Kohezgjatja e projektit (ne muaj)", "projectDurationMonths"),
        createField("Njesia akademike e UIBM-se qe aplikon", "applyingUnit"),
        createField("Emri i dekanit", "deanName"),
        createField("Vendi", "deanPlace"),
        createField("Numri i telefonit", "deanPhone"),
        createField("Email adresa", "deanEmail"),
        createField("Faqja e internetit/rrjeti social", "deanWebsite"),
        { label: "Te dhenat per ekipin hulumtues", value: teamMembers },
      ],
    },
    {
      title: "Pjesa II: Informacione rreth projektit",
      fields: [
        createField("Pershkrim gjitheperfshires i projekt-propozimit dhe plani i hulumtimit", "projectDescription"),
        createField("Fjale kyce per projektin", "projectKeywords"),
        createField("Ndikimi dhe arsyeshmeria e projektit", "projectImpact"),
        createField("Plani i punes dhe afatet kohore", "workPlan"),
      ],
    },
    {
      title: "III. Arsyetimi financiar",
      fields: [
        createField("Kosto totale e projektit (EUR)", "totalProjectCost"),
        createField("Shuma e kerkuar nga UIBM (EUR)", "requestedFromUibm"),
        createField("Kosto materiale (40%)", "materialCost"),
        createField("Kosto administrative (30%)", "administrativeCost"),
        createField("Kosto te personelit (20%)", "personnelCost"),
        createField("Kostot e tjera (10%)", "otherCosts"),
        createField("Pershkrimi i detajuar i kostos", "detailedCostDescription"),
        createField("Shuma e kerkuar per rimbursim", "amount"),
      ],
    },
    { title: "Plotesohet nga zyra", fields: getOfficeFields() },
  ];
}

function getFormSections(data) {
  if (data.requestType === "conference") {
    return getConferenceSections();
  }

  if (data.requestType === "project") {
    return getProjectSections(data);
  }

  return getPublicationSections();
}

function getFieldValue(data, field) {
  if (field.value !== undefined) {
    return normalizeText(field.value);
  }

  if (field.field === "bankApplicantName") {
    return valueOf(data, field.field) || valueOf(data, "applicantName");
  }

  if (field.field === "bankAccountNumber") {
    return valueOf(data, field.field) || valueOf(data, "iban");
  }

  if (field.field === "applyingUnit") {
    return valueOf(data, field.field) || valueOf(data, "applicantFaculty");
  }

  return valueOf(data, field.field);
}

function prepareDocumentData(row) {
  return {
    id: row.id,
    requestType: row.request_type,
    title: row.title,
    amount: row.amount === null || row.amount === undefined ? "" : String(row.amount),
    currency: row.currency || "EUR",
    status: row.status,
    submittedAt: row.submitted_at || row.created_at,
    documentNumber: row.document_number || "",
    requestData: row.request_data || {},
  };
}

function createDocxParagraph(text, options = {}) {
  return new Paragraph({
    spacing: { before: options.before ?? 120, after: options.after ?? 120 },
    alignment: options.alignment,
    heading: options.heading,
    children: [
      new TextRun({
        text,
        bold: options.bold,
        size: options.size || 22,
        color: options.color,
      }),
    ],
  });
}

function createDocxCell(text, options = {}) {
  return new TableCell({
    width: { size: options.width || 50, type: WidthType.PERCENTAGE },
    shading: options.shading ? { fill: options.shading } : undefined,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: text || EMPTY_VALUE,
            bold: options.bold,
            size: 19,
            color: options.color,
          }),
        ],
      }),
    ],
  });
}

function createFieldTable(data, section) {
  const rows = [
    new TableRow({
      children: [
        createDocxCell(section.title, { width: 100, bold: true, shading: "DCE6F2", color: "153A63" }),
      ],
      tableHeader: false,
    }),
    ...section.fields.map((field) => (
      new TableRow({
        children: [
          createDocxCell(field.label, { width: 35, bold: true }),
          createDocxCell(getFieldValue(data, field), { width: 65 }),
        ],
      })
    )),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "AAB7C4" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "AAB7C4" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "AAB7C4" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "AAB7C4" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D8E0EA" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D8E0EA" },
    },
    rows,
  });
}

export async function buildReimbursementDocx(row) {
  const data = prepareDocumentData(row);
  const title = FORM_TITLES[data.requestType] || "FORMULAR RIMBURSIMI";
  const children = [
    createDocxParagraph("Universiteti \"Isa Boletini\" - Mitrovice", {
      bold: true,
      size: 24,
      alignment: AlignmentType.CENTER,
      color: "153A63",
    }),
    createDocxParagraph(title, {
      bold: true,
      size: 28,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      color: "153A63",
    }),
    createDocxParagraph(`Numri i dokumentit: ${data.documentNumber || EMPTY_VALUE}`, {
      alignment: AlignmentType.CENTER,
      size: 20,
    }),
  ];

  getFormSections(data).forEach((section) => {
    children.push(createFieldTable(data, section));
    children.push(createDocxParagraph("", { after: 80 }));
  });

  children.push(
    createDocxParagraph("Nenshkrimi i aplikuesit", { bold: true, before: 260 }),
    createDocxParagraph("__________________________", { before: 80 })
  );

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}

function addPdfSection(pdf, title, fields, data) {
  pdf.moveDown(0.5);
  pdf
    .fillColor("#153a63")
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(title, { continued: false });
  pdf.moveDown(0.25);

  fields.forEach((field) => {
    const value = getFieldValue(data, field) || EMPTY_VALUE;

    pdf
      .fillColor("#1f2937")
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text(`${field.label}:`, { continued: false });
    pdf
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#374151")
      .text(value, { indent: 10 });
    pdf.moveDown(0.15);
  });
}

export function buildReimbursementPdf(row) {
  const data = prepareDocumentData(row);
  const title = FORM_TITLES[data.requestType] || "FORMULAR RIMBURSIMI";

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margins: { top: 48, right: 48, bottom: 48, left: 48 },
      bufferPages: true,
    });
    const chunks = [];

    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf
      .fillColor("#153a63")
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Universiteti \"Isa Boletini\" - Mitrovice", { align: "center" });
    pdf.moveDown(0.35);
    pdf.fontSize(16).text(title, { align: "center" });
    pdf.moveDown(0.35);
    pdf
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#374151")
      .text(`Numri i dokumentit: ${data.documentNumber || EMPTY_VALUE}`, { align: "center" });
    pdf.moveDown();

    getFormSections(data).forEach((section) => {
      addPdfSection(pdf, section.title, section.fields, data);
    });

    pdf.moveDown();
    pdf
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text("Nenshkrimi i aplikuesit");
    pdf.moveDown(0.4);
    pdf.text("__________________________");

    pdf.end();
  });
}

export function getReimbursementDocumentFilenames(row) {
  const typeCode = row.request_type === "conference" ? "F2" : row.request_type === "project" ? "F3" : "F1";
  const documentNumber = row.document_number || `RIM-${String(row.id).slice(0, 8).toUpperCase()}`;

  return {
    pdf: `${typeCode}-${documentNumber}.pdf`,
    docx: `${typeCode}-${documentNumber}.docx`,
  };
}
