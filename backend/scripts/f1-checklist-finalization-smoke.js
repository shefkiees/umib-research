import assert from "node:assert/strict";
import {
  F1_FINAL_ACTION_STATUSES,
  validateF1FinalAction,
} from "../services/f1ChecklistFinalization.service.js";

const checklist = (status, overrides = {}) => ({
  version: 1,
  items: {
    publication_title: {
      status,
      comment: status === "requires_correction" ? "Korrigjoni titullin." : "",
      originalValue: "Titulli",
      correctedValue: status === "committee_corrected" ? "Titulli i korrigjuar" : "",
    },
  },
  generalComment: "Koment për vendimin.",
  ...overrides,
});

assert.equal(F1_FINAL_ACTION_STATUSES.approve, "committee_approved");
assert.equal(F1_FINAL_ACTION_STATUSES.return, "needs_correction");
assert.equal(F1_FINAL_ACTION_STATUSES.reject, "rejected");
assert.equal(validateF1FinalAction("approve", checklist("ok")), null);
assert.equal(validateF1FinalAction("return", checklist("requires_correction")), null);
assert.equal(validateF1FinalAction("reject", checklist("ok")), null);
assert.equal(validateF1FinalAction("approve", checklist("unchecked"))?.error, "f1_checklist_unchecked_items");

console.log("F1 checklist finalization smoke checks passed.");
