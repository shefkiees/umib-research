import { adminEn } from "../i18n/locales/en/admin";
import { adminSq } from "../i18n/locales/sq/admin";

export const ADMIN_TEXT = {
  sq: adminSq,
  en: adminEn,
};

export function getAdminText(language) {
  return ADMIN_TEXT[language] || ADMIN_TEXT.sq;
}
