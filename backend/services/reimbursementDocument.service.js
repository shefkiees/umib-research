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
import { getDocxLabelMap } from "../../shared/reimbursementSchema.js";

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
const APPLICANT_AUTO_FIELD_FALLBACKS = {
  applicantName: "name",
  applicantEmail: "email",
  applicantFaculty: "faculty",
  applicantDepartment: "department",
  applicantOffice: "office",
  applicantOrcidId: "orcidId",
  academicTitle: "academicTitle",
  scientificTitle: "scientificTitle",
};

function normalizeText(value) {
  return String(value ?? "").trim();
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

  const directValue = normalizeText(data.requestData?.[field] ?? data[field]);

  if (directValue) {
    return directValue;
  }

  const autoFallbackField = APPLICANT_AUTO_FIELD_FALLBACKS[field];
  return autoFallbackField ? normalizeText(data.requestData?.auto?.[autoFallbackField]) : "";
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

function formatWorkPlanItems(items) {
  return arrayText(items, (item, index) => {
    const parts = [
      `Aktiviteti ${index + 1}: ${normalizeText(item?.activity)}`,
      `Afati: ${normalizeText(item?.deadline)}`,
      `Pergjegjes: ${normalizeText(item?.responsiblePerson)}`,
      `Rezultati: ${normalizeText(item?.expectedResult)}`,
    ].filter((part) => !part.endsWith(": "));

    return parts.join(" | ");
  });
}

function formatCostItems(items) {
  return arrayText(items, (item, index) => {
    const parts = [
      `${index + 1}. ${normalizeText(item?.item) || "Artikull/sherbim"}`,
      `Sasia: ${normalizeText(item?.quantity)}`,
      `Cmimi njesi: ${normalizeText(item?.unitCost)}`,
      `Totali: ${normalizeText(item?.totalCost)}`,
      `Pershkrimi: ${normalizeText(item?.description)}`,
    ].filter((part) => !part.endsWith(": "));

    return parts.join(" | ");
  });
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
  ];
}

function getOfficeFields() {
  return [
    createField("Numri i dokumentit", "documentNumber"),
    createField("Data e dorezimit", "submittedAt"),
    createField("Statusi aktual", "status"),
  ];
}

function fieldHasValue(data, field) {
  return hasMeaningfulValue(valueOf(data, field));
}

function optionalField(data, label, field) {
  return fieldHasValue(data, field) ? [createField(label, field)] : [];
}

function isDuplicateDoiPublicationLink(data) {
  const doi = normalizeText(valueOf(data, "doi")).toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");
  const link = normalizeText(valueOf(data, "publicationLink")).toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");

  return Boolean(doi && link && doi === link);
}

function getPublicationSections(data = {}) {
  const publicationDetailFields = [
    createField("Affiliation", "affiliation"),
    createField("Titulli i artikullit", "publicationTitle"),
    createField("DOI", "doi"),
    createField("Lloji i publikimit", "publicationType"),
    createField("Publikuar në", "venue"),
    ...optionalField(data, "Shtëpia botuese", "publisher"),
    ...optionalField(data, "Vëllimi", "volume"),
    ...optionalField(data, "Numri i revistës / Issue", "issue"),
    ...optionalField(data, "Faqet", "pages"),
    ...optionalField(data, "ISSN", "issn"),
    ...optionalField(data, "ISBN", "isbn"),
    ...optionalField(data, "Abstrakti", "abstract"),
    ...optionalField(data, "Indeksimi në platformë", "indexingPlatform"),
    ...optionalField(data, "Kategoria e indeksimit", "indexingCategory"),
    ...optionalField(data, "Impact Factor", "impactFactor"),
    ...optionalField(data, "CiteScore", "citeScore"),
    ...optionalField(data, "Kuartili", "scopusQuartile"),
    ...optionalField(data, "Data e pranimit", "acceptanceDate"),
    createField("Publikuar më", "publicationDate"),
    ...(fieldHasValue(data, "publicationLink") && !isDuplicateDoiPublicationLink(data)
      ? [createField("Linku i publikimit", "publicationLink")]
      : []),
    ...optionalField(data, "Deshmia e regjistrimit ne databazen e UIBM", "uibmDatabaseEvidence"),
  ];
  const conferenceFields = [
    ...optionalField(data, "Detajet e organizimit", "publicationConferenceDetails"),
    ...optionalField(data, "Linku i konferences", "conferenceLink"),
    ...optionalField(data, "Vendi i konferences", "conferenceLocation"),
    ...optionalField(data, "Data", "conferencePresentationDate"),
  ];
  const sections = [
    {
      title: "Parashtruesi i kerkeses",
      fields: [
        createField("Emri dhe mbiemri", "applicantName"),
        createField("Email", "applicantEmail"),
        createField("Njesia akademike", "applicantFaculty"),
        ...optionalField(data, "Departamenti", "applicantDepartment"),
        ...optionalField(data, "Thirrja shkencore", "scientificTitle"),
        ...optionalField(data, "Thirrja akademike", "academicTitle"),
        ...optionalField(data, "ORCID iD", "applicantOrcidId"),
        createField("Autori kryesor", "mainAuthor"),
        createField("Autori korrespondent", "correspondingAuthor"),
        ...optionalField(data, "Bashkautorët", "coauthors"),
      ],
    },
    {
      title: "Detajet e publikimit",
      fields: publicationDetailFields,
    },
    { title: "Te dhenat bankare", fields: getBankFields() },
    { title: "Plotesohet nga zyra", fields: getOfficeFields() },
  ];

  if (conferenceFields.length) {
    sections.splice(2, 0, {
      title: "Informata per konference/simpozium (nese aplikohet)",
      fields: conferenceFields,
    });
  }

  return sections;
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
        createField("Vendi", "location"),
        createField("Data", "conferenceDate"),
        createField("Organizatori", "organizer"),
        createField("Ftesa dhe programi", "invitationProgram"),
        createField("Abstrakti dhe titulli i punimit", "abstractTitle"),
        createField("Konfirmimi i pranimit te punimit", "acceptanceConfirmation"),
        createField("Perkatesia e autoreve te punimit", "authorsAffiliation"),
        createField("Foles me kumtese/poster", "speakerWithPaperPoster"),
        createField("Kryesues/panelist", "chairPanelist"),
        createField("Ngjarje artistike/sportive", "artisticSportEvent"),
        createField("Linku i publikimit te ngjarjes", "eventPublicationLink"),
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
  const workPlan = formatWorkPlanItems(data.requestData?.workPlanItems) || valueOf(data, "workPlan");
  const costItems = formatCostItems(data.requestData?.costItems) || valueOf(data, "detailedCostDescription");

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
        { label: "Plani i punes dhe afatet kohore", value: workPlan },
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
        { label: "Pershkrimi i detajuar i kostos", value: costItems },
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

  return getPublicationSections(data);
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

function templateValueFrom(data, ...fields) {
  return fields
    .map((field) => valueOf(data, field))
    .find(Boolean) || EMPTY_VALUE;
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
      abstractTitle: templateValueFrom(data, "abstractTitle", "publicationTitle", "abstract"),
      acceptanceConfirmation: templateValue(data, "acceptanceConfirmation"),
      authorsAffiliation: templateValue(data, "authorsAffiliation"),
      speakerWithPaperPoster: templateValue(data, "speakerWithPaperPoster"),
      artisticSportEvent: templateValue(data, "artisticSportEvent"),
      chairPanelist: templateValue(data, "chairPanelist"),
      eventPublicationLink: templateValueFrom(data, "eventPublicationLink", "publicationLink", "doi"),
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
    const workPlanSummary = formatWorkPlanItems(data.requestData?.workPlanItems);
    const costSummary = formatCostItems(data.requestData?.costItems);

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
      workPlan: workPlanSummary || templateValue(data, "workPlan"),
      totalProjectCost: templateValue(data, "totalProjectCost"),
      requestedFromUibm: templateValue(data, "requestedFromUibm"),
      materialCost: templateValue(data, "materialCost"),
      administrativeCost: templateValue(data, "administrativeCost"),
      personnelCost: templateValue(data, "personnelCost"),
      otherCosts: templateValue(data, "otherCosts"),
      detailedCostDescription: costSummary || templateValue(data, "detailedCostDescription"),
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
    publicationType: templateValue(data, "publicationType"),
    journal: templateValue(data, "journal"),
    venue: templateValue(data, "venue") || templateValue(data, "journal"),
    publisher: templateValue(data, "publisher"),
    volume: templateValue(data, "volume"),
    issue: templateValue(data, "issue"),
    pages: templateValue(data, "pages"),
    issn: templateValue(data, "issn"),
    isbn: templateValue(data, "isbn"),
    abstract: templateValue(data, "abstract"),
    indexingPlatform: templateValue(data, "indexingPlatform"),
    indexingCategory: templateValue(data, "indexingCategory"),
    impactFactor: templateValue(data, "impactFactor"),
    citeScore: templateValue(data, "citeScore"),
    scopusQuartile: templateValue(data, "scopusQuartile"),
    acceptanceDate: templateValue(data, "acceptanceDate"),
    publicationDate: templateValueFrom(data, "publicationDate", "publicationYear"),
    publicationLink: templateValue(data, "publicationLink"),
    uibmDatabaseEvidence: templateValue(data, "uibmDatabaseEvidence"),
    publicationConferenceDetails: templateValue(data, "publicationConferenceDetails"),
    conferenceLink: templateValue(data, "conferenceLink"),
    conferenceLocation: templateValue(data, "conferenceLocation"),
    conferencePresentationDate: templateValue(data, "conferencePresentationDate"),
  };
}

function getTemplateLabelMap(data) {
  return getDocxLabelMap(data.requestType);
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
      console.warn(`[reimbursements] official DOCX template ${getTypeCode(data.requestType)} had no replacements; using fallback document.`);
      return null;
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    console.info(`[reimbursements] official DOCX template ${getTypeCode(data.requestType)} used with ${replacementCount} replacements.`);
    return { buffer, replacementCount, templatePath };
  } catch (error) {
    console.error(`[reimbursements] official DOCX template ${getTypeCode(data.requestType)} failed; using fallback document:`, error);
    return null;
  }
}

export async function buildReimbursementDocxWithMetadata(row) {
  const data = prepareDocumentData(row);
  const templateResult = await buildTemplateDocx(data);

  if (templateResult?.buffer) {
    return {
      buffer: templateResult.buffer,
      source: "official",
      replacementCount: templateResult.replacementCount,
      templatePath: templateResult.templatePath,
    };
  }

  console.warn(`[reimbursements] fallback DOCX generated for ${getTypeCode(data.requestType)}.`);
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

  return {
    buffer: await Packer.toBuffer(document),
    source: "fallback",
    replacementCount: 0,
    templatePath: null,
  };
}

export async function buildReimbursementDocx(row) {
  const result = await buildReimbursementDocxWithMetadata(row);
  return result.buffer;
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

const PUBLICATION_PDF_LONG_FIELDS = new Set([
  "publicationTitle",
  "coauthors",
  "affiliation",
  "doi",
  "venue",
  "abstract",
]);

function getPdfContentWidth(pdf) {
  return pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
}

function ensurePdfSpace(pdf, height) {
  const bottom = pdf.page.height - pdf.page.margins.bottom;

  if (pdf.y + height > bottom) {
    pdf.addPage();
  }
}

function addPublicationPdfSectionHeader(pdf, title) {
  const contentWidth = getPdfContentWidth(pdf);
  const x = pdf.page.margins.left;
  const height = 22;

  ensurePdfSpace(pdf, height + 10);
  pdf.moveDown(0.45);
  pdf
    .roundedRect(x, pdf.y, contentWidth, height, 2)
    .fill("#e8eef6");
  pdf
    .fillColor("#153a63")
    .font("Helvetica-Bold")
    .fontSize(11.5)
    .text(title, x + 9, pdf.y + 6, { width: contentWidth - 18 });
  pdf.y += height + 6;
}

function addPublicationPdfCompactField(pdf, field, value) {
  const contentWidth = getPdfContentWidth(pdf);
  const x = pdf.page.margins.left;
  const labelWidth = 150;
  const gap = 12;
  const valueWidth = contentWidth - labelWidth - gap - 16;

  pdf.font("Helvetica").fontSize(9.5);
  const valueHeight = pdf.heightOfString(value, { width: valueWidth });
  const rowHeight = Math.max(24, valueHeight + 12);

  ensurePdfSpace(pdf, rowHeight + 2);
  const rowTop = pdf.y;
  const y = pdf.y;

  pdf
    .moveTo(x, y)
    .lineTo(x + contentWidth, y)
    .strokeColor("#d8e0ea")
    .lineWidth(0.4)
    .stroke();
  pdf
    .fillColor("#1f2937")
    .font("Helvetica-Bold")
    .fontSize(9.2)
    .text(`${field.label}:`, x + 8, y + 7, { width: labelWidth });
  pdf
    .fillColor("#374151")
    .font("Helvetica")
    .fontSize(9.5)
    .text(value, x + labelWidth + gap, y + 7, { width: valueWidth });

  pdf.y = rowTop + rowHeight;
}

function addPublicationPdfLongField(pdf, field, value) {
  const contentWidth = getPdfContentWidth(pdf);
  const x = pdf.page.margins.left;
  const labelHeight = 13;
  const padding = 8;
  const valueWidth = contentWidth - (padding * 2);

  pdf.font("Helvetica").fontSize(9.5);
  const valueHeight = pdf.heightOfString(value, { width: valueWidth });
  const blockHeight = labelHeight + valueHeight + 18;

  ensurePdfSpace(pdf, blockHeight + 4);
  const y = pdf.y;

  pdf
    .roundedRect(x, y, contentWidth, blockHeight, 2)
    .strokeColor("#d8e0ea")
    .lineWidth(0.45)
    .stroke();
  pdf
    .fillColor("#1f2937")
    .font("Helvetica-Bold")
    .fontSize(9.4)
    .text(`${field.label}:`, x + padding, y + 7, { width: valueWidth });
  pdf
    .fillColor("#374151")
    .font("Helvetica")
    .fontSize(9.5)
    .text(value, x + padding, y + 22, { width: valueWidth, lineGap: 1.5 });

  pdf.y = y + blockHeight + 4;
}

function addPublicationPdfSections(pdf, data) {
  getFormSections(data).forEach((section) => {
    addPublicationPdfSectionHeader(pdf, section.title);

    section.fields.forEach((field) => {
      const value = getFieldValue(data, field) || EMPTY_VALUE;

      if (PUBLICATION_PDF_LONG_FIELDS.has(field.field)) {
        addPublicationPdfLongField(pdf, field, value);
        return;
      }

      addPublicationPdfCompactField(pdf, field, value);
    });
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

    if (data.requestType === "publication") {
      addPublicationPdfSections(pdf, data);
    } else {
      getFormSections(data).forEach((section) => {
        addPdfSection(pdf, section.title, section.fields, data);
      });
    }

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
