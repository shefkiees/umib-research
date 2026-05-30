import { apiUrl } from "./api";

export async function sendAccessResetRequest(email) {
  const response = await fetch(apiUrl("/auth/password-reset"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || "access_reset_failed");
  }

  return { data };
}

export const sendPasswordResetEmail = sendAccessResetRequest;
