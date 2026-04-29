const ENV_ASSIGNMENT_PATTERN = /^[A-Z0-9_]+=(.+)$/;
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

const stripWrappingQuotes = (value) => {
  if (
    (value.startsWith("\"") && value.endsWith("\""))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
};

const stripEnvAssignmentPrefix = (value) => {
  const match = value.match(ENV_ASSIGNMENT_PATTERN);
  return match ? match[1].trim() : value;
};

export const normalizeUrlEnvValue = (value) => {
  if (!value) {
    return "";
  }

  const trimmedValue = value.trim();
  const normalizedValue = stripWrappingQuotes(stripEnvAssignmentPrefix(trimmedValue));

  return normalizedValue.replace(/\/$/, "");
};

export const getAbsoluteUrlEnvValue = (value) => {
  const normalizedValue = normalizeUrlEnvValue(value);
  return ABSOLUTE_URL_PATTERN.test(normalizedValue) ? normalizedValue : "";
};
