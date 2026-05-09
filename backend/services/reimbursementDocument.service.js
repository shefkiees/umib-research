import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, "..", "templates");

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
  needs_correction: "Kthyer per korrigjim",
  committee_approved: "Aprovuar nga komisioni",
  approved: "Aprovuar final",
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

function getTypeCode(requestType) {
  if (requestType === "conference") {
    return "F2";
  }

  if (requestType === "project") {
    return "F3";
  }

  return "F1";
}

function escapeXml(value) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function templateValue(data, field) {
  return valueOf(data, field) || EMPTY_VALUE;
}

function getTemplateValues(data) {
  const baseValues = {
    documentNumber: data.documentNumber || "",
    submittedAt: formatDate(data.submittedAt),
    status: STATUS_LABELS[data.status] || data.status || "",
    amount: templateValue(data, "amount"),
    applicantName: templateValue(data, "applicantName"),
    applicantEmail: templateValue(data, "applicantEmail"),
    applicantFaculty: templateValue(data, "applicantFaculty"),
    applicantDepartment: templateValue(data, "applicantDepartment"),
    scientificTitle: templateValue(data, "scientificTitle"),
    academicTitle: templateValue(data, "academicTitle"),
    bankApplicantName: templateValue(data, "bankApplicantName") || templateValue(data, "applicantName"),
    bankName: templateValue(data, "bankName"),
    bankAccountNumber: templateValue(data, "bankAccountNumber") || templateValue(data, "iban"),
    swiftCode: templateValue(data, "swiftCode"),
    bankCountry: templateValue(data, "bankCountry"),
    amountWords: templateValue(data, "amountWords"),
    purpose: templateValue(data, "purpose"),
  };

  if (data.requestType === "conference") {
    return {
      ...baseValues,
      mainAuthor: templateValue(data, "mainAuthor"),
      coParticipant: templateValue(data, "coParticipant"),
      conferenceTitle: templateValue(data, "conferenceTitle"),
      eventPlaceDate: templateValue(data, "eventPlaceDate") || [templateValue(data, "location"), templateValue(data, "conferenceDate")].filter((item) => item !== EMPTY_VALUE).join(" / "),
      organizer: templateValue(data, "organizer"),
      invitationProgram: templateValue(data, "invitationProgram"),
      abstractTitle: templateValue(data, "abstractTitle"),
      acceptanceConfirmation: templateValue(data, "acceptanceConfirmation"),
      authorsAffiliation: templateValue(data, "authorsAffiliation"),
      speakerWithPaperPoster: templateValue(data, "speakerWithPaperPoster"),
      artisticSportEvent: templateValue(data, "artisticSportEvent"),
      chairPanelist: templateValue(data, "chairPanelist"),
      eventPublicationLink: templateValue(data, "eventPublicationLink"),
    };
  }

  if (data.requestType === "project") {
    const members = Array.isArray(data.requestData?.teamMembers) ? data.requestData.teamMembers : [];
    const memberSummary = members
      .map((member, index) => [
        `Anetari ${index + 1}`,
        member?.name,
        member?.scientificGrade,
        member?.academicUnit,
        member?.phone,
        member?.email,
        member?.specialization,
        member?.contribution,
      ].filter(Boolean).join(" | "))
      .filter(Boolean)
      .join("; ");

    return {
      ...baseValues,
      projectTitle: templateValue(data, "projectTitle"),
      projectDurationMonths: templateValue(data, "projectDurationMonths"),
      applyingUnit: templateValue(data, "applyingUnit") || templateValue(data, "applicantFaculty"),
      deanName: templateValue(data, "deanName"),
      deanPlace: templateValue(data, "deanPlace"),
      deanPhone: templateValue(data, "deanPhone"),
      deanEmail: templateValue(data, "deanEmail"),
      deanWebsite: templateValue(data, "deanWebsite"),
      teamMembers: memberSummary || EMPTY_VALUE,
      projectDescription: templateValue(data, "projectDescription"),
      projectKeywords: templateValue(data, "projectKeywords"),
      projectImpact: templateValue(data, "projectImpact"),
      workPlan: templateValue(data, "workPlan"),
      totalProjectCost: templateValue(data, "totalProjectCost"),
      requestedFromUibm: templateValue(data, "requestedFromUibm"),
      materialCost: templateValue(data, "materialCost"),
      administrativeCost: templateValue(data, "administrativeCost"),
      personnelCost: templateValue(data, "personnelCost"),
      otherCosts: templateValue(data, "otherCosts"),
      detailedCostDescription: templateValue(data, "detailedCostDescription"),
    };
  }

  return {
    ...baseValues,
    mainAuthor: templateValue(data, "mainAuthor"),
    correspondingAuthor: templateValue(data, "correspondingAuthor"),
    coauthors: templateValue(data, "coauthors"),
    affiliation: templateValue(data, "affiliation"),
    publicationTitle: templateValue(data, "publicationTitle"),
    doi: templateValue(data, "doi"),
    journal: templateValue(data, "journal"),
    publisher: templateValue(data, "publisher"),
    indexingPlatform: templateValue(data, "indexingPlatform"),
    impactFactor: templateValue(data, "impactFactor"),
    scopusQuartile: templateValue(data, "scopusQuartile"),
    acceptanceDate: templateValue(data, "acceptanceDate"),
    publicationDate: templateValue(data, "publicationDate"),
    publicationLink: templateValue(data, "publicationLink"),
    uibmDatabaseEvidence: templateValue(data, "uibmDatabaseEvidence"),
    publicationConferenceDetails: templateValue(data, "publicationConferenceDetails"),
    conferenceLink: templateValue(data, "conferenceLink"),
    conferenceLocation: templateValue(data, "conferenceLocation"),
    conferencePresentationDate: templateValue(data, "conferencePresentationDate"),
  };
}

function getTemplateLabelMap(data) {
  if (data.requestType === "conference") {
    return {
      "EMRI DHE MBIEMRI:": "applicantName",
      "THIRRJA SHKENCORE:": "scientificTitle",
      "NJËSIA AKADEMIKE:": "applicantFaculty",
      "THIRRJA AKADEMIKE:": "academicTitle",
      "AUTORI KRYESOR:": "mainAuthor",
      "BASHKËPJESËMARRËSI:": "coParticipant",
      "EMËRTIMI I NGJARJES:": "conferenceTitle",
      "VENDI DHE DATA:": "eventPlaceDate",
      "ORGANIZATORI:": "organizer",
      "FTESA DHE PROGRAMI:": "invitationProgram",
      "ABSTRAKTI DHE TITULLI I PUNIMIT:": "abstractTitle",
      "KONFIRMIMI I PRANIMIT TË PUNIMIT:": "acceptanceConfirmation",
      "AUTORËT E PUNIMIT (AFFILIATION):": "authorsAffiliation",
      "FOLES ME KUMTESË/POSTER:": "speakerWithPaperPoster",
      "NGJARJE ARTISTIKE/ SPORTIVE:": "artisticSportEvent",
      "KRYESUES/PANELIST": "chairPanelist",
      "LINKU I PUBLIKIMIT TË NGJARJES:": "eventPublicationLink",
      "EMRI BANKËS:": "bankName",
      "NUMRI I LLOGARISË BANKARE:": "bankAccountNumber",
      "SWIFT KODI:": "swiftCode",
      "VENDI:": "bankCountry",
      "SHUMA E KËRKUAR:": "amount",
      "SHËNO ME FJALË:": "amountWords",
    };
  }

  if (data.requestType === "project") {
    return {
      "Titulli i projektit": "projectTitle",
      "Kohëzgjatja e projektit (në muaj)": "projectDurationMonths",
      "Njësia Akademike e UIBM-së që aplikon": "applyingUnit",
      "Emri i Dekanit": "deanName",
      "Vendi": "deanPlace",
      "Numri i telefonit": "deanPhone",
      "Email adresa": "deanEmail",
      "Faqja e internetit/rrjeti social": "deanWebsite",
      "Të dhënat për anëtarët e ekipit hulumtues": "teamMembers",
      "Përshkrim gjithëpërfshirës i projekt-propozimit dhe plani i hulumtimit": "projectDescription",
      "Fjalë kyçe për projektin": "projectKeywords",
      "Ndikimi dhe arsyeshmëria e projektit": "projectImpact",
      "Plani i punës dhe afatet kohore": "workPlan",
      "Kosto totale e projektit": "totalProjectCost",
      "Shuma e kërkuar nga UIBM": "requestedFromUibm",
      "Kosto materiale": "materialCost",
      "Kosto administrative": "administrativeCost",
      "Kosto të personelit": "personnelCost",
      "Kostot e tjera": "otherCosts",
      "Përshkrimi i detajuar i kostos": "detailedCostDescription",
    };
  }

  return {
    "EMRI DHE MBIEMRI:": "applicantName",
    "THIRRJA SHKENCORE:": "scientificTitle",
    "NJËSIA AKADEMIKE": "applicantFaculty",
    "THIRRJA AKADEMIKE:": "academicTitle",
    "AUTOR KRYESOR:": "mainAuthor",
    "AUTOR KORRESPONDENT:": "correspondingAuthor",
    "BASHKAUTORËT:": "coauthors",
    "PËRKATËSIA E AUTORIT (AFFILATION):": "affiliation",
    "TITULLI I PUNIMIT:": "publicationTitle",
    "DOI:": "doi",
    "EMRI REVISTËS:": "journal",
    "SHTËPIA BOTUESE": "publisher",
    "INDEKSIMI NË PLATFORMËN:": "indexingPlatform",
    "IMPAKT FAKTORI (IF):": "impactFactor",
    "SCOPUS (Q1-Q": "scopusQuartile",
    "DATA E PRANIMIT:": "acceptanceDate",
    "DATA E PUBLIKIMIT:": "publicationDate",
    "LINKU I PUBLIKIMIT:": "publicationLink",
    "DËSHMIA E REGJISTRIMIT TË PUNIMIT SHKENCOR NË DATABAZËN E PUNIMEVE SHKENCORE TË UIBM": "uibmDatabaseEvidence",
    "LINKU I KONFERENCËS:": "conferenceLink",
    "VENDI I KONFERENCËS:": "conferenceLocation",
    "DATA:": "conferencePresentationDate",
    "EMRI BANKËS:": "bankName",
    "NUMRI I LLOGARISË BANKARE:": "bankAccountNumber",
    "SWIFT KODI:": "swiftCode",
    "VENDI:": "bankCountry",
    "SHUMA E KËRKUAR:": "amount",
    "SHËNO ME FJALË:": "amountWords",
  };
}

function replaceTemplateMarkers(xml, values) {
  let nextXml = xml;
  let replacements = 0;

  Object.entries(values).forEach(([key, value]) => {
    const safeValue = escapeXml(value).replace(/[\r\n]+/g, "; ");

    [`{{${key}}}`, `[[${key}]]`, `«${key}»`].forEach((marker) => {
      const regex = new RegExp(escapeRegex(escapeXml(marker)), "g");
      const matches = nextXml.match(regex);

      if (matches?.length) {
        replacements += matches.length;
        nextXml = nextXml.replace(regex, safeValue);
      }
    });
  });

  return { xml: nextXml, replacements };
}

function appendTemplateLabelValues(xml, values, labelMap) {
  let nextXml = xml;
  let replacements = 0;

  Object.entries(labelMap).forEach(([label, key]) => {
    const value = values[key];

    if (!hasMeaningfulValue(value) || value === EMPTY_VALUE) {
      return;
    }

    const safeLabel = escapeXml(label);
    const safeValue = escapeXml(value).replace(/[\r\n]+/g, "; ");
    const regex = new RegExp(`(${escapeRegex(safeLabel)})(?!\\s*${escapeRegex(safeValue)})`, "g");
    const matches = nextXml.match(regex);

    if (matches?.length) {
      replacements += matches.length;
      nextXml = nextXml.replace(regex, `$1 ${safeValue}`);
    }
  });

  return { xml: nextXml, replacements };
}

async function buildTemplateDocx(data) {
  const templatePath = path.join(TEMPLATE_DIR, `${getTypeCode(data.requestType)}.docx`);

  try {
    const [{ default: JSZip }, templateBuffer] = await Promise.all([
      import("jszip"),
      fs.readFile(templatePath),
    ]);
    const zip = await JSZip.loadAsync(templateBuffer);
    const values = getTemplateValues(data);
    const labelMap = getTemplateLabelMap(data);
    let replacementCount = 0;
    const xmlFileNames = Object.keys(zip.files).filter((name) =>
      /^word\/(document|header|footer).*\.xml$/i.test(name)
    );

    for (const fileName of xmlFileNames) {
      const file = zip.file(fileName);

      if (!file) {
        continue;
      }

      const originalXml = await file.async("string");
      const markerResult = replaceTemplateMarkers(originalXml, values);
      const labelResult = appendTemplateLabelValues(markerResult.xml, values, labelMap);
      replacementCount += markerResult.replacements + labelResult.replacements;

      if (markerResult.replacements || labelResult.replacements) {
        zip.file(fileName, labelResult.xml);
      }
    }

    if (replacementCount === 0) {
      return null;
    }

    return zip.generateAsync({ type: "nodebuffer" });
  } catch (error) {
    console.warn("Official reimbursement DOCX template fill failed, falling back to generated document:", error.message);
    return null;
  }
}

export async function buildReimbursementDocx(row) {
  const data = prepareDocumentData(row);
  const templateBuffer = await buildTemplateDocx(data);

  if (templateBuffer) {
    return templateBuffer;
  }

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
  const typeCode = getTypeCode(row.request_type);
  const documentNumber = row.document_number || `RIM-${String(row.id).slice(0, 8).toUpperCase()}`;

  return {
    pdf: `${typeCode}-${documentNumber}.pdf`,
    docx: `${typeCode}-${documentNumber}.docx`,
  };
}
