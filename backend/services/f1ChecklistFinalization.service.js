export const F1_FINAL_ACTION_STATUSES = Object.freeze({
  return: "needs_correction",
  reject: "rejected",
  approve: "committee_approved",
});

const F1_ITEM_LABELS = {
  publication_title: "Titulli i artikullit",
  publication_type: "Lloji i publikimit",
  journal_name: "Emri i Revistës",
  acceptance_date: "Data e Pranimit",
  publication_date: "Data e Publikimit",
  main_author: "Autori kryesor",
  corresponding_author: "Autori korrespondent",
  coauthors: "Bashkautorët",
  affiliation: "Përkatësia institucionale (Affiliation)",
  doi: "DOI",
  article_link: "Linku i Artikullit",
  issn_eissn: "ISSN / E-ISSN",
  indexing_platform: "Indeksimi në platformë",
  indexing_category: "Kategoria e indeksimit",
  quartile: "Kuartili",
  impact_factor: "Impact Factor",
  cite_score: "CiteScore",
  request_pdf: "Formulari i kërkesës (PDF)",
  request_docx: "Formulari i kërkesës (DOCX)",
  article_document: "Artikulli shkencor",
};

export function validateF1FinalAction(action, checklist) {
  if (!Object.prototype.hasOwnProperty.call(F1_FINAL_ACTION_STATUSES, action)) {
    return { error: "f1_final_action_invalid", message: "Veprimi përfundimtar i checklistës F1 nuk është valid." };
  }

  const items = Object.values(checklist?.items || {});

  if (!items.length) {
    return { error: "f1_checklist_items_required", message: "Checklista F1 nuk përmban pika për vendim." };
  }

  if (items.some((item) => item.status === "unchecked")) {
    return { error: "f1_checklist_unchecked_items", message: "Kontrolloni të gjitha pikat para vendimit përfundimtar." };
  }

  if (action === "approve" && items.some((item) => !["ok", "committee_corrected"].includes(item.status))) {
    return {
      error: "f1_checklist_approval_blocked",
      message: "Aprovimi lejohet vetëm kur të gjitha pikat janë në rregull ose të korrigjuara nga Komisioni.",
    };
  }

  if (action === "return" && !items.some((item) => item.status === "requires_correction")) {
    return {
      error: "f1_checklist_return_blocked",
      message: "Kthimi për korrigjim kërkon të paktën një pikë me statusin Kërkon korrigjim.",
    };
  }

  if (action === "reject" && !String(checklist?.generalComment || "").trim()) {
    return { error: "f1_checklist_rejection_comment_required", message: "Komenti i përgjithshëm është i detyrueshëm për refuzim." };
  }

  return null;
}

export function buildF1FinalizationNote(action, checklist) {
  const generalComment = String(checklist?.generalComment || "").trim();

  if (action === "approve") {
    return "Kërkesa juaj është aprovuar nga Komisioni dhe është përfshirë në listën e rekomandimeve.";
  }

  if (action === "reject") {
    return `Kërkesa juaj është refuzuar nga Komisioni. Komenti i Komisionit: ${generalComment}`;
  }

  const corrections = Object.entries(checklist?.items || {})
    .filter(([, item]) => item.status === "requires_correction")
    .map(([itemId, item]) => `${F1_ITEM_LABELS[itemId] || itemId}: ${String(item.comment || "").trim()}`);
  const noteParts = [
    "Kërkesa juaj është kthyer për korrigjim.",
    `Korrigjimet e kërkuara: ${corrections.join("; ")}`,
  ];

  if (generalComment) {
    noteParts.push(`Komenti i përgjithshëm i Komisionit: ${generalComment}`);
  }

  return noteParts.join(" ");
}
