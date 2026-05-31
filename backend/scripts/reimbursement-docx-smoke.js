import assert from "node:assert/strict";
import JSZip from "jszip";
import { buildReimbursementDocxWithMetadata } from "../services/reimbursementDocument.service.js";

const BASE_REQUEST_DATA = {
  applicantName: "Smoke Applicant",
  applicantEmail: "smoke.applicant@example.com",
  applicantFaculty: "Faculty Smoke",
  applicantDepartment: "Department Smoke",
  scientificTitle: "Dr.",
  academicTitle: "Professor",
  amount: "1234.56",
  currency: "EUR",
  bankApplicantName: "Smoke Applicant",
  bankName: "Raiffeisen Bank Kosovo",
  bankAccountNumber: "1503011004083061",
  iban: "1503011004083061",
  swiftCode: "RBKOXKPR",
  bankCountry: "Kosove",
};

function createRow(requestType, requestData) {
  return {
    id: `${requestType}-smoke`,
    owner_id: "smoke-user",
    title: requestData.publicationTitle || requestData.conferenceTitle || requestData.projectTitle,
    amount: requestData.amount,
    currency: requestData.currency || "EUR",
    status: "submitted",
    request_type: requestType,
    request_data: requestData,
    document_number: `SMOKE-${requestType.toUpperCase()}`,
    submitted_at: "2026-05-10T10:00:00.000Z",
    created_at: "2026-05-10T10:00:00.000Z",
  };
}

async function extractDocxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlFileNames = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header|footer).*\.xml$/i.test(name)
  );
  const xmlText = (await Promise.all(xmlFileNames.map((name) => zip.file(name).async("string")))).join(" ");

  return xmlText
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const smokeCases = [
  {
    label: "F1",
    row: createRow("publication", {
      ...BASE_REQUEST_DATA,
      mainAuthor: "Smoke Main Author",
      correspondingAuthor: "Smoke Corresponding Author",
      coauthors: "Smoke Coauthor",
      affiliation: "Smoke Affiliation",
      publicationTitle: "Smoke F1 Publication Title",
      doi: "10.0000/smoke-f1",
      journal: "Smoke Journal",
      publisher: "Smoke Publisher",
      indexingPlatform: "Scopus",
      impactFactor: "2.50",
      scopusQuartile: "Q2",
      acceptanceDate: "2026-04-01",
      publicationDate: "2026-05-01",
      publicationLink: "https://example.com/smoke-f1",
      uibmDatabaseEvidence: "Smoke database evidence",
      publicationConferenceDetails: "Smoke conference note",
      conferenceLink: "https://example.com/conference",
      conferenceLocation: "Mitrovice",
      conferencePresentationDate: "2026-05-02",
    }),
    expectedValues: ["Smoke F1 Publication Title", "Smoke Journal", "Raiffeisen Bank Kosovo", "RBKOXKPR"],
  },
  {
    label: "F2",
    row: createRow("conference", {
      ...BASE_REQUEST_DATA,
      mainAuthor: "Smoke Conference Author",
      coParticipant: "Smoke Co Participant",
      conferenceTitle: "Smoke F2 Conference Title",
      eventPlaceDate: "Prishtine, 2026-06-12",
      organizer: "Smoke Organizer",
      invitationProgram: "Smoke invitation program",
      abstractTitle: "Smoke abstract title",
      acceptanceConfirmation: "Smoke acceptance confirmation",
      authorsAffiliation: "Smoke authors affiliation",
      speakerWithPaperPoster: "Poster",
      chairPanelist: "Jo",
      artisticSportEvent: "Jo",
      eventPublicationLink: "https://example.com/smoke-f2",
    }),
    expectedValues: ["Smoke F2 Conference Title", "Smoke Organizer", "Raiffeisen Bank Kosovo", "RBKOXKPR"],
  },
  {
    label: "F3",
    row: createRow("project", {
      ...BASE_REQUEST_DATA,
      projectTitle: "Smoke F3 Project Title",
      projectDurationMonths: "12",
      applyingUnit: "Smoke Applying Unit",
      deanName: "Smoke Dean",
      deanPlace: "Mitrovice",
      deanPhone: "+38344111222",
      deanEmail: "dean@example.com",
      deanWebsite: "https://example.com/dean",
      teamMembers: [
        {
          name: "Smoke Team Member",
          scientificGrade: "Dr.",
          academicUnit: "Smoke Unit",
          phone: "+38344111333",
          email: "team@example.com",
          specialization: "Smoke specialization",
          contribution: "Smoke contribution",
        },
      ],
      projectDescription: "Smoke project description",
      projectKeywords: "smoke, project",
      projectImpact: "Smoke project impact",
      workPlanItems: [
        {
          activity: "Smoke Activity Alpha",
          deadline: "2026-07-01",
          responsiblePerson: "Smoke Team Member",
          expectedResult: "Smoke Expected Result",
        },
      ],
      totalProjectCost: "10000",
      requestedFromUibm: "5000",
      materialCost: "2000",
      administrativeCost: "1500",
      personnelCost: "1000",
      otherCosts: "500",
      costItems: [
        {
          item: "Smoke Cost Item",
          quantity: "2",
          unitCost: "250",
          totalCost: "500",
          description: "Smoke cost description",
        },
      ],
    }),
    expectedValues: ["Smoke F3 Project Title", "Smoke Activity Alpha", "Smoke Cost Item", "Smoke Team Member"],
  },
];

for (const smokeCase of smokeCases) {
  const result = await buildReimbursementDocxWithMetadata(smokeCase.row);
  assert.equal(result.source, "official", `${smokeCase.label} used fallback DOCX generation`);
  assert.ok(result.replacementCount > 0, `${smokeCase.label} had no official template replacements`);

  const text = await extractDocxText(result.buffer);

  for (const expectedValue of smokeCase.expectedValues) {
    assert.ok(text.includes(expectedValue), `${smokeCase.label} DOCX missing ${expectedValue}`);
  }

  console.log(`${smokeCase.label}: official template used (${result.replacementCount} replacements)`);
}
