export const getApiBaseUrl = () => {
  const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (configuredApiBaseUrl) {
    const normalizedBaseUrl = configuredApiBaseUrl.replace(/\/$/, "");

    if (/\/api$/i.test(normalizedBaseUrl)) {
      return normalizedBaseUrl;
    }

    return `${normalizedBaseUrl}/api`;
  }

  if (
    window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
  ) {
    return "http://localhost:5000/api";
  }

  return `${window.location.origin}/api`;
};

export const apiUrl = (path = "") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};
