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

const F1_EMAIL_SUBJECTS = Object.freeze({
  return: "Publikimi juaj kërkon korrigjim",
  approve: "Publikimi juaj është rekomanduar për aprovim",
  reject: "Publikimi juaj është refuzuar",
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildF1FinalizationEmail({ action, checklist, publicationTitle, professorName }) {
  const subject = F1_EMAIL_SUBJECTS[action];

  if (!subject) {
    throw new Error("f1_finalization_email_action_invalid");
  }

  const title = String(publicationTitle || "Publikimi juaj").trim();
  const name = String(professorName || "").trim();
  const generalComment = String(checklist?.generalComment || "").trim();
  const corrections = Object.entries(checklist?.items || {})
    .filter(([, item]) => item?.status === "requires_correction")
    .map(([itemId, item]) => ({
      label: F1_ITEM_LABELS[itemId] || itemId,
      comment: String(item?.comment || "").trim(),
    }));
  const greeting = name ? `I/e nderuar ${name},` : "I/e nderuar,";

  let lead;
  let detailHtml;
  let instruction;
  const messageParts = [greeting, `Titulli i publikimit: ${title}`];

  if (action === "return") {
    lead = "Komisioni ka përfunduar shqyrtimin dhe publikimi kërkon korrigjim.";
    detailHtml = `
      <div style="margin:0 0 20px;padding:14px 16px;background:#fff8ed;border-left:4px solid #c57916">
        <strong style="display:block;margin:0 0 10px">Pikat që kërkojnë korrigjim</strong>
        <ul style="margin:0;padding-left:20px">${corrections
          .map(({ label, comment }) => `<li style="margin:0 0 8px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(comment)}</li>`)
          .join("")}</ul>
      </div>`;
    instruction = "Ju lutemi rishikoni pikat e shënuara dhe ridërgoni publikimin/kërkesën për shqyrtim.";
    messageParts.push(lead, "Pikat që kërkojnë korrigjim:");
    corrections.forEach(({ label, comment }) => messageParts.push(`- ${label}: ${comment}`));
  } else if (action === "approve") {
    lead = "Publikimi është verifikuar dhe rekomanduar për aprovim nga Komisioni.";
    detailHtml = "";
    instruction = "Publikimi është përfshirë në listën e rekomandimeve dhe vazhdon në procedurën e radhës.";
    messageParts.push(lead);
  } else {
    lead = "Komisioni ka përfunduar shqyrtimin dhe publikimi është refuzuar.";
    detailHtml = "";
    instruction = "";
    messageParts.push(lead);
  }

  if (generalComment) {
    messageParts.push(`${action === "reject" ? "Arsyeja e refuzimit" : "Komenti i përgjithshëm i Komisionit"}: ${generalComment}`);
  }

  if (instruction) {
    messageParts.push(instruction);
  }

  const commentLabel = action === "reject" ? "Arsyeja e refuzimit" : "Komenti i përgjithshëm i Komisionit";
  const commentHtml = generalComment
    ? `<div style="margin:0 0 20px;padding:14px 16px;background:#f7f9fc;border-left:4px solid #153a63"><strong style="display:block;margin:0 0 6px">${commentLabel}</strong><p style="margin:0;line-height:1.6">${escapeHtml(generalComment)}</p></div>`
    : "";

  const html = `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f4f7fb">
        <tr><td align="center" style="padding:28px 16px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;background:#ffffff;border:1px solid #d9e2ef">
            <tr><td style="padding:22px 28px;background:#153a63;color:#ffffff">
              <p style="margin:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase">Universiteti i Mitrovicës &quot;Isa Boletini&quot;</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3">${escapeHtml(subject)}</h1>
            </td></tr>
            <tr><td style="padding:28px">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6">${escapeHtml(greeting)}</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6">${escapeHtml(lead)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 20px">
                <tr><td style="padding:10px 0;border-bottom:1px solid #e5ebf3;color:#536177;width:38%">Titulli i publikimit</td><td style="padding:10px 0;border-bottom:1px solid #e5ebf3;font-weight:700">${escapeHtml(title)}</td></tr>
              </table>
              ${detailHtml}
              ${commentHtml}
              ${instruction ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6">${escapeHtml(instruction)}</p>` : ""}
              <p style="margin:0;font-size:14px;line-height:1.6;color:#536177">Ky është njoftim automatik nga UMIBRes. Për pyetje shtesë, ju lutemi kontaktoni njësinë përgjegjëse institucionale.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </div>`;

  return {
    subject,
    message: messageParts.join("\n\n"),
    html,
  };
}

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
