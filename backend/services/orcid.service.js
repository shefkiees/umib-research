export async function exchangeCodeForToken(code) {
  const response = await fetch("https://orcid.org/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: process.env.ORCID_CLIENT_ID,
      client_secret: process.env.ORCID_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.ORCID_REDIRECT_URI,
    }),
  });

  return response.json();
}

export async function getOrcidPerson(orcidId, accessToken) {
  const response = await fetch(`https://pub.orcid.org/v3.0/${orcidId}/person`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.json();
}