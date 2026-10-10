const TITLE_PREFIXES = {
  profesor: "Prof.",
  professor: "Prof.",
  prof: "Prof.",
  "profesor i rregullt": "Prof.",
  "profesor asistent": "Prof. Ass.",
  "asistent profesor": "Prof. Ass.",
  "assistant professor": "Prof. Ass.",
  "prof ass": "Prof. Ass.",
  "ass prof": "Prof. Ass.",
  "profesor i asociuar": "Prof. Assoc.",
  "associate professor": "Prof. Assoc.",
  "prof assoc": "Prof. Assoc.",
  "assoc prof": "Prof. Assoc.",
  asistent: "Ass.",
  assistant: "Ass.",
  ass: "Ass.",
  "senior assistant": "Sr. Ass.",
  "senior asistent": "Sr. Ass.",
  "sr ass": "Sr. Ass.",
};

const firstText = (...values) =>
  values.find((value) => typeof value === "string" && value.trim())?.trim() || "";

export function hasPhD(value) {
  return String(value || "").trim().toLowerCase().replace(/\./g, "") === "phd";
}

export function formatAcademicTitle(value, { omitDoctorate = false } = {}) {
  const title = String(value || "").trim();
  if (!title) return "";

  const normalized = title.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  const rank = normalized.replace(/\b(dr|doktor|doktore|doktori)\b/g, "").replace(/\s+/g, " ").trim();
  const prefix = Object.hasOwn(TITLE_PREFIXES, rank) ? TITLE_PREFIXES[rank] : "";
  // Preserve unrecognized stored titles without inventing an equivalent rank.
  if (!prefix) {
    return omitDoctorate
      ? title.replace(/\b(?:dr\.?|doktor|doktore|doktori)(?=\s|$)/gi, "").replace(/\s+/g, " ").trim()
      : title;
  }
  return rank !== normalized && !omitDoctorate ? `${prefix} Dr.` : prefix;
}

export function getPlainDisplayName(user = {}) {
  const firstName = firstText(user.firstName, user.first_name);
  const lastName = firstText(user.lastName, user.last_name);
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : "";
  return firstText(fullName, user.name, user.fullName, user.full_name, user.displayName, firstName, lastName, user.email);
}

export function getAcademicDisplayName(user = {}) {
  const name = getPlainDisplayName(user);
  const doctorate = hasPhD(firstText(user.scientificTitle, user.scientific_title));
  const title = formatAcademicTitle(firstText(user.academicTitle, user.academic_title), { omitDoctorate: doctorate });
  if (!name) return "";
  const displayName = doctorate ? name.replace(/^Dr\.?\s+/i, "") : name;
  const prefixedName = title && displayName.toLowerCase().startsWith(`${title.toLowerCase()} `)
    ? displayName
    : [title, displayName].filter(Boolean).join(" ");
  return doctorate && !/,\s*Ph\.?D\.?$/i.test(prefixedName) ? `${prefixedName}, PhD` : prefixedName;
}
