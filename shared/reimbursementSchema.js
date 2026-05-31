export const REIMBURSEMENT_TYPES = [
  {
    id: "publication",
    code: "F1",
    label: "F1 - Publikime shkencore",
    requestLabel: "Financim publikimi shkencor",
    description: "Financim i publikimit shkencor.",
    requiresBank: true,
  },
  {
    id: "conference",
    code: "F2",
    label: "F2 - Konferenca dhe simpoziume",
    requestLabel: "Financim pjesemarrjeje ne konference/simpozium",
    description: "Pjesemarrje, prezantim, poster, aktivitet shkencor.",
    requiresBank: true,
  },
  {
    id: "project",
    code: "F3",
    label: "F3 - Projekte shkencore",
    requestLabel: "Financim projekti shkencor",
    description: "Projekt-propozim, ekip hulumtues, plan pune dhe buxhet.",
    requiresBank: false,
  },
];

export const REIMBURSEMENT_TYPE_LABELS = REIMBURSEMENT_TYPES.reduce((acc, type) => {
  acc[type.id] = type.requestLabel;
  return acc;
}, {});

export const COMMON_REQUIRED_FIELDS = [
  ["applicantName", "Emri dhe mbiemri eshte obligativ."],
  ["applicantEmail", "Email-i eshte obligativ."],
  ["applicantFaculty", "Njesia akademike eshte obligative."],
  ["amount", "Shuma e kerkuar eshte obligative."],
  ["currency", "Valuta eshte obligative."],
];

export const BANK_REQUIRED_FIELDS = [
  ["bankApplicantName", "Emri i aplikantit ne banke eshte obligativ."],
  ["bankName", "Emri i bankes eshte obligativ."],
  ["bankAccountNumber", "Numri i llogarise bankare/IBAN eshte obligativ."],
  ["swiftCode", "SWIFT/BIC kodi eshte obligativ."],
];

export const APPLICANT_FIELDS = [
  { field: "applicantName", label: "Emri dhe mbiemri" },
  { field: "applicantEmail", label: "Email", type: "email" },
  { field: "applicantFaculty", label: "Njesia akademike" },
  { field: "applicantDepartment", label: "Departamenti" },
  { field: "applicantOffice", label: "Zyra" },
  { field: "applicantOrcidId", label: "ORCID iD" },
  { field: "scientificTitle", label: "Thirrja shkencore" },
  { field: "academicTitle", label: "Thirrja akademike" },
];

export const BANK_FIELDS = [
  { field: "bankApplicantName", label: "Emri dhe mbiemri i aplikantit" },
  { field: "bankName", label: "Emri bankes" },
  { field: "bankAccountNumber", label: "Numri i llogarise bankare / IBAN" },
  { field: "swiftCode", label: "SWIFT kodi" },
  { field: "bankCountry", label: "Vendi" },
  { field: "amount", label: "Shuma e kerkuar" },
];

export const REIMBURSEMENT_SCHEMAS = {
  publication: {
    id: "publication",
    requiredFields: [
      ["publicationId", "Zgjidh publikimin ekzistues."],
    ],
    sections: [
      {
        id: "authors",
        title: "Parashtruesi i kerkeses",
        fields: [
          { field: "mainAuthor", label: "Autor kryesor", source: "publication", readOnly: true },
          { field: "correspondingAuthor", label: "Autor korrespondent", source: "publication", readOnly: true },
          { field: "coauthors", label: "Bashkautoret", wide: true, source: "publication", readOnly: true },
        ],
      },
      {
        id: "publicationDetails",
        title: "Detajet e publikimit",
        fields: [
          { field: "affiliation", label: "Perkatesia e autorit (affiliation)", wide: true, source: "publication", readOnly: true },
          { field: "publicationTitle", label: "Titulli i punimit", wide: true, source: "publication", readOnly: true },
          { field: "doi", label: "DOI", source: "publication", readOnly: true },
          { field: "publicationType", label: "Tipi i publikimit", source: "publication", readOnly: true },
          { field: "venue", label: "Venue / revista / konference", source: "publication", readOnly: true },
          { field: "publisher", label: "Shtepia botuese", source: "publication", readOnly: true },
          { field: "publicationDate", label: "Data e publikimit", type: "date", source: "publication", readOnly: true },
          { field: "publicationYear", label: "Viti i publikimit", inputMode: "numeric", source: "publication", readOnly: true },
          { field: "publicationLink", label: "Linku i publikimit", wide: true, source: "publication", readOnly: true },
          { field: "volume", label: "Volume", source: "publication", readOnly: true },
          { field: "issue", label: "Issue", source: "publication", readOnly: true },
          { field: "pages", label: "Pages", source: "publication", readOnly: true },
          { field: "issn", label: "ISSN", source: "publication", readOnly: true },
          { field: "isbn", label: "ISBN", source: "publication", readOnly: true },
          { field: "abstract", label: "Abstrakti", wide: true, type: "textarea", rows: 3, source: "publication", readOnly: true },
          { field: "indexingPlatform", label: "Indeksim ne platforme", source: "publication", readOnly: true },
          { field: "impactFactor", label: "Impact faktori (IF)", source: "publication", readOnly: true },
          { field: "scopusQuartile", label: "Scopus (Q1-Q4)", type: "select", optionsKey: "scopus", source: "publication", readOnly: true },
          { field: "acceptanceDate", label: "Data e pranimit", type: "date" },
          { field: "uibmDatabaseEvidence", label: "Deshmia e regjistrimit ne databazen UIBM", wide: true, placeholder: "URL ose shenim" },
        ],
      },
      {
        id: "publicationConference",
        title: "Informata per konference/simpozium",
        fields: [
          { field: "publicationConferenceDetails", label: "Detajet e konferences/simpoziumit (nese aplikohet)", wide: true },
          { field: "conferenceLink", label: "Linku i konferences", placeholder: "https://..." },
          { field: "conferenceLocation", label: "Vendi i konferences" },
          { field: "conferencePresentationDate", label: "Data e prezantimit", type: "date" },
          { field: "publicationFee", label: "Tarifa e publikimit", placeholder: "p.sh. 450 EUR" },
        ],
      },
    ],
    attachmentChecklist: [
      { id: "publicationProof", label: "Deshmi e publikimit ose pranimit", required: true },
      { id: "publicationLink", label: "DOI ose link i publikimit", required: true },
      { id: "journalEvidence", label: "Deshmi e revistes/konferences, nese aplikohet", required: false },
      { id: "paymentEvidence", label: "Deshmi pagese/regjistrimi, nese aplikohet", required: false },
    ],
  },
  conference: {
    id: "conference",
    requiredFields: [
      ["conferenceTitle", "Emertimi i ngjarjes eshte obligativ."],
      ["location", "Vendi eshte obligativ."],
      ["conferenceDate", "Data e ngjarjes eshte obligative."],
      ["organizer", "Organizatori eshte obligativ."],
      ["invitationProgram", "Ftesa/programi eshte obligativ."],
      ["abstractTitle", "Abstrakti dhe titulli i punimit jane obligative."],
      ["acceptanceConfirmation", "Konfirmimi i pranimit eshte obligativ."],
    ],
    sections: [
      {
        id: "participants",
        title: "Parashtruesi i kerkeses",
        fields: [
          { field: "mainAuthor", label: "Autori kryesor" },
          { field: "coParticipant", label: "Bashkepjesemarresi" },
        ],
      },
      {
        id: "conferenceDetails",
        title: "Detajet e konferences, simpoziumit ose aktivitetit",
        fields: [
          { field: "conferenceTitle", label: "Emertimi i ngjarjes", wide: true, required: true },
          { field: "location", label: "Vendi", required: true },
          { field: "conferenceDate", label: "Data", type: "date", required: true },
          { field: "organizer", label: "Organizatori", wide: true },
          { field: "invitationProgram", label: "Ftesa dhe programi", wide: true, placeholder: "URL ose pershkrim" },
          { field: "abstractTitle", label: "Abstrakti dhe titulli i punimit", wide: true, type: "textarea", rows: 3 },
          { field: "acceptanceConfirmation", label: "Konfirmimi i pranimit te punimit", wide: true, placeholder: "URL ose shenim" },
          { field: "authorsAffiliation", label: "Autoret e punimit (affiliation)", wide: true },
          { field: "speakerWithPaperPoster", label: "Foles me kumtese/poster", type: "select", optionsKey: "speakerType" },
          { field: "chairPanelist", label: "Kryesues/panelist", type: "select", optionsKey: "yesNo" },
          { field: "artisticSportEvent", label: "Ngjarje artistike/sportive", type: "select", optionsKey: "yesNo" },
          { field: "eventPublicationLink", label: "Linku i publikimit te ngjarjes", wide: true, placeholder: "https://..." },
        ],
      },
    ],
    attachmentChecklist: [
      { id: "invitationProgram", label: "Ftese dhe program", required: true },
      { id: "abstract", label: "Abstrakt / titull i punimit", required: true },
      { id: "acceptanceConfirmation", label: "Konfirmim pranimi", required: true },
      { id: "costEvidence", label: "Deshmi e kostove te udhetimit/konferences", required: false },
    ],
  },
  project: {
    id: "project",
    requiredFields: [
      ["projectTitle", "Titulli i projektit eshte obligativ."],
      ["projectDurationMonths", "Kohezgjatja e projektit eshte obligative."],
      ["applyingUnit", "Njesia akademike aplikuese eshte obligative."],
      ["deanName", "Emri i dekanit eshte obligativ."],
      ["projectDescription", "Pershkrimi i projekt-propozimit eshte obligativ."],
      ["projectKeywords", "Fjalet kyce jane obligative."],
      ["projectImpact", "Ndikimi/arsyeshmeria e projektit eshte obligative."],
      ["workPlanItems", "Shto se paku nje aktivitet ne planin e punes."],
      ["totalProjectCost", "Kosto totale e projektit eshte obligative."],
      ["requestedFromUibm", "Shuma e kerkuar nga UIBM eshte obligative."],
      ["materialCost", "Kosto materiale (40%) eshte obligative."],
      ["administrativeCost", "Kosto administrative (30%) eshte obligative."],
      ["personnelCost", "Kosto te personelit (20%) eshte obligative."],
      ["otherCosts", "Kostot e tjera (10%) jane obligative."],
      ["costItems", "Shto se paku nje rresht ne pershkrimin e kostos."],
    ],
    sections: [
      {
        id: "administration",
        title: "Pjesa 1: Administrimi",
        fields: [
          { field: "projectTitle", label: "Titulli i projektit", wide: true, required: true },
          { field: "projectDurationMonths", label: "Kohezgjatja e projektit (ne muaj)", inputMode: "numeric" },
          { field: "applyingUnit", label: "Njesia akademike e UIBM-se qe aplikon" },
          { field: "deanName", label: "Emri i dekanit" },
          { field: "deanPlace", label: "Vendi" },
          { field: "deanPhone", label: "Numri i telefonit" },
          { field: "deanEmail", label: "Email adresa", type: "email" },
          { field: "deanWebsite", label: "Faqja e internetit/rrjeti social", placeholder: "https://..." },
        ],
      },
      {
        id: "projectInfo",
        title: "Pjesa II: Informacione rreth projektit",
        fields: [
          { field: "projectDescription", label: "Pershkrimi i projekt-propozimit dhe plani i hulumtimit", wide: true, type: "textarea", rows: 4 },
          { field: "projectKeywords", label: "Fjale kyce per projektin", wide: true },
          { field: "projectImpact", label: "Ndikimi dhe arsyeshmeria e projektit", wide: true, type: "textarea", rows: 3 },
          { field: "workPlan", label: "Shenime shtese per planin e punes", wide: true, type: "textarea", rows: 2, optional: true },
        ],
      },
      {
        id: "budget",
        title: "III. Arsyetimi financiar",
        fields: [
          { field: "totalProjectCost", label: "Kosto totale e projektit (EUR)", inputMode: "decimal" },
          { field: "requestedFromUibm", label: "Shuma e kerkuar nga UIBM (EUR)", inputMode: "decimal" },
          { field: "materialCost", label: "Kosto materiale (40%)", inputMode: "decimal" },
          { field: "administrativeCost", label: "Kosto administrative (30%)", inputMode: "decimal" },
          { field: "personnelCost", label: "Kosto te personelit (20%)", inputMode: "decimal" },
          { field: "otherCosts", label: "Kostot e tjera (10%)", inputMode: "decimal" },
          { field: "detailedCostDescription", label: "Shenime shtese per koston", wide: true, type: "textarea", rows: 2, optional: true },
        ],
      },
      {
        id: "metadata",
        title: "Metadata administrative",
        fields: [
          { field: "projectCode", label: "Kodi / Thirrja" },
          { field: "projectRole", label: "Roli ne projekt", placeholder: "p.sh. PI, bashkepunetor" },
          { field: "projectPeriod", label: "Periudha", placeholder: "p.sh. Jan 2026 - Qer 2026" },
          { field: "fundingBody", label: "Institucioni / Financuesi" },
          { field: "budgetLine", label: "Linja buxhetore", wide: true },
        ],
      },
    ],
    attachmentChecklist: [
      { id: "projectProposal", label: "Projekt-propozimi", required: true },
      { id: "workPlan", label: "Plani i punes", required: true },
      { id: "budgetEvidence", label: "Deshmi buxheti / kostoje", required: true },
      { id: "teamEvidence", label: "Deshmi per ekipin/anetaret, nese aplikohet", required: false },
    ],
  },
};

export const DOCX_LABEL_MAPS = {
  publication: {
    "EMRI DHE MBIEMRI:": "applicantName",
    "THIRRJA SHKENCORE:": "scientificTitle",
    "NJËSIA AKADEMIKE": "applicantFaculty",
    "NJÃ‹SIA AKADEMIKE": "applicantFaculty",
    "THIRRJA AKADEMIKE:": "academicTitle",
    "AUTOR KRYESOR:": "mainAuthor",
    "AUTOR KORRESPONDENT:": "correspondingAuthor",
    "BASHKAUTORËT:": "coauthors",
    "BASHKAUTORÃ‹T:": "coauthors",
    "PËRKATËSIA E AUTORIT (AFFILATION):": "affiliation",
    "PÃ‹RKATÃ‹SIA E AUTORIT (AFFILATION):": "affiliation",
    "TITULLI I PUNIMIT:": "publicationTitle",
    "DOI:": "doi",
    "TIPI I PUBLIKIMIT:": "publicationType",
    "VENUE / REVISTA / KONFERENCE:": "journal",
    "EMRI REVISTËS:": "journal",
    "EMRI REVISTÃ‹S:": "journal",
    "SHTËPIA BOTUESE": "publisher",
    "SHTÃ‹PIA BOTUESE": "publisher",
    "VOLUME:": "volume",
    "ISSUE:": "issue",
    "PAGES:": "pages",
    "ISSN:": "issn",
    "ISBN:": "isbn",
    "ABSTRAKTI:": "abstract",
    "INDEKSIMI NË PLATFORMËN:": "indexingPlatform",
    "INDEKSIMI NÃ‹ PLATFORMÃ‹N:": "indexingPlatform",
    "IMPAKT FAKTORI (IF):": "impactFactor",
    "SCOPUS (Q1-Q": "scopusQuartile",
    "DATA E PRANIMIT:": "acceptanceDate",
    "DATA E PUBLIKIMIT:": "publicationDate",
    "LINKU I PUBLIKIMIT:": "publicationLink",
    "DËSHMIA E REGJISTRIMIT TË PUNIMIT SHKENCOR NË DATABAZËN E PUNIMEVE SHKENCORE TË UIBM": "uibmDatabaseEvidence",
    "DÃ‹SHMIA E REGJISTRIMIT TÃ‹ PUNIMIT SHKENCOR NÃ‹ DATABAZÃ‹N E PUNIMEVE SHKENCORE TÃ‹ UIBM": "uibmDatabaseEvidence",
    "LINKU I KONFERENCËS:": "conferenceLink",
    "LINKU I KONFERENCÃ‹S:": "conferenceLink",
    "VENDI I KONFERENCËS:": "conferenceLocation",
    "VENDI I KONFERENCÃ‹S:": "conferenceLocation",
    "DATA:": "conferencePresentationDate",
    "EMRI BANKËS:": "bankName",
    "EMRI BANKÃ‹S:": "bankName",
    "NUMRI I LLOGARISË BANKARE:": "bankAccountNumber",
    "NUMRI I LLOGARISÃ‹ BANKARE:": "bankAccountNumber",
    "SWIFT KODI:": "swiftCode",
    "VENDI:": "bankCountry",
    "SHUMA E KËRKUAR:": "amount",
    "SHUMA E KÃ‹RKUAR:": "amount",
  },
  conference: {
    "EMRI DHE MBIEMRI:": "applicantName",
    "THIRRJA SHKENCORE:": "scientificTitle",
    "NJËSIA AKADEMIKE:": "applicantFaculty",
    "NJÃ‹SIA AKADEMIKE:": "applicantFaculty",
    "THIRRJA AKADEMIKE:": "academicTitle",
    "AUTORI KRYESOR:": "mainAuthor",
    "BASHKËPJESËMARRËSI:": "coParticipant",
    "BASHKÃ‹PJESÃ‹MARRÃ‹SI:": "coParticipant",
    "EMËRTIMI I NGJARJES:": "conferenceTitle",
    "EMÃ‹RTIMI I NGJARJES:": "conferenceTitle",
    "VENDI DHE DATA:": "eventPlaceDate",
    "ORGANIZATORI:": "organizer",
    "FTESA DHE PROGRAMI:": "invitationProgram",
    "ABSTRAKTI DHE TITULLI I PUNIMIT:": "abstractTitle",
    "KONFIRMIMI I PRANIMIT TË PUNIMIT:": "acceptanceConfirmation",
    "KONFIRMIMI I PRANIMIT TÃ‹ PUNIMIT:": "acceptanceConfirmation",
    "AUTORËT E PUNIMIT (AFFILIATION):": "authorsAffiliation",
    "AUTORÃ‹T E PUNIMIT (AFFILIATION):": "authorsAffiliation",
    "FOLES ME KUMTESË/POSTER:": "speakerWithPaperPoster",
    "FOLES ME KUMTESÃ‹/POSTER:": "speakerWithPaperPoster",
    "NGJARJE ARTISTIKE/ SPORTIVE:": "artisticSportEvent",
    "KRYESUES/PANELIST": "chairPanelist",
    "LINKU I PUBLIKIMIT TË NGJARJES:": "eventPublicationLink",
    "LINKU I PUBLIKIMIT TÃ‹ NGJARJES:": "eventPublicationLink",
    "EMRI BANKËS:": "bankName",
    "EMRI BANKÃ‹S:": "bankName",
    "NUMRI I LLOGARISË BANKARE:": "bankAccountNumber",
    "NUMRI I LLOGARISÃ‹ BANKARE:": "bankAccountNumber",
    "SWIFT KODI:": "swiftCode",
    "VENDI:": "bankCountry",
    "SHUMA E KËRKUAR:": "amount",
    "SHUMA E KÃ‹RKUAR:": "amount",
  },
  project: {
    "Titulli i projektit": "projectTitle",
    "Kohëzgjatja e projektit (në muaj)": "projectDurationMonths",
    "KohÃ«zgjatja e projektit (nÃ« muaj)": "projectDurationMonths",
    "Njësia Akademike e UIBM-së që aplikon": "applyingUnit",
    "NjÃ«sia Akademike e UIBM-sÃ« qÃ« aplikon": "applyingUnit",
    "Emri i Dekanit": "deanName",
    "Vendi": "deanPlace",
    "Numri i telefonit": "deanPhone",
    "Email adresa": "deanEmail",
    "Faqja e internetit/rrjeti social": "deanWebsite",
    "Të dhënat për anëtarët e ekipit hulumtues": "teamMembers",
    "TÃ« dhÃ«nat pÃ«r anÃ«tarÃ«t e ekipit hulumtues": "teamMembers",
    "Përshkrim gjithëpërfshirës i projekt-propozimit dhe plani i hulumtimit": "projectDescription",
    "PÃ«rshkrim gjithÃ«pÃ«rfshirÃ«s i projekt-propozimit dhe plani i hulumtimit": "projectDescription",
    "Fjale kyçe për projektin": "projectKeywords",
    "FjalÃ« kyÃ§e pÃ«r projektin": "projectKeywords",
    "Ndikimi dhe arsyeshmëria e projektit": "projectImpact",
    "Ndikimi dhe arsyeshmÃ«ria e projektit": "projectImpact",
    "Plani i punës dhe afatet kohore": "workPlan",
    "Plani i punÃ«s dhe afatet kohore": "workPlan",
    "Kosto totale e projektit": "totalProjectCost",
    "Shuma e kërkuar nga UIBM": "requestedFromUibm",
    "Shuma e kÃ«rkuar nga UIBM": "requestedFromUibm",
    "Kosto materiale": "materialCost",
    "Kosto administrative": "administrativeCost",
    "Kosto te personelit": "personnelCost",
    "Kosto tÃ« personelit": "personnelCost",
    "Kostot e tjera": "otherCosts",
    "Përshkrimi i detajuar i kostos": "detailedCostDescription",
    "PÃ«rshkrimi i detajuar i kostos": "detailedCostDescription",
  },
};

export function getReimbursementSchema(type) {
  return REIMBURSEMENT_SCHEMAS[type] || REIMBURSEMENT_SCHEMAS.publication;
}

export function getReimbursementType(type) {
  return REIMBURSEMENT_TYPES.find((item) => item.id === type) || REIMBURSEMENT_TYPES[0];
}

export function requiresBank(type) {
  return Boolean(getReimbursementType(type).requiresBank);
}

export function getRequiredFields(type) {
  return [
    ...COMMON_REQUIRED_FIELDS,
    ...(requiresBank(type) ? BANK_REQUIRED_FIELDS : []),
    ...(getReimbursementSchema(type).requiredFields || []),
  ];
}

export function getAttachmentChecklist(type) {
  return getReimbursementSchema(type).attachmentChecklist || [];
}

export function getDocxLabelMap(type) {
  return DOCX_LABEL_MAPS[type] || DOCX_LABEL_MAPS.publication;
}
