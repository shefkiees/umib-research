import express from "express";
import db from "../config/db.js";
import { exchangeCodeForToken, getOrcidPerson } from "../services/orcid.service.js";

const router = express.Router();

router.get("/connect", (req, res) => {
  console.log("ORCID_CLIENT_ID:", process.env.ORCID_CLIENT_ID);
  console.log("ORCID_REDIRECT_URI:", process.env.ORCID_REDIRECT_URI);

  if (!process.env.ORCID_CLIENT_ID || !process.env.ORCID_REDIRECT_URI) {
    return res.status(500).send("ORCID environment variables are missing");
  }

  const params = new URLSearchParams({
    client_id: process.env.ORCID_CLIENT_ID,
    response_type: "code",
    scope: "/authenticate",
    redirect_uri: process.env.ORCID_REDIRECT_URI,
  });

  res.redirect(`https://orcid.org/oauth/authorize?${params.toString()}`);
});

router.get("/callback", async (req, res) => {
  const dashboardUrl = `${process.env.FRONTEND_URL}/professor/dashboard`;

  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${dashboardUrl}?orcid=missing_code`);
    }

    const tokenData = await exchangeCodeForToken(code);

    if (tokenData.error) {
      console.log("ORCID token error:", tokenData);
      return res.redirect(`${dashboardUrl}?orcid=token_error`);
    }

    const orcidId = tokenData.orcid;
    const accessToken = tokenData.access_token;

    const person = await getOrcidPerson(orcidId, accessToken);

    const firstName = person?.name?.["given-names"]?.value || "";
    const lastName = person?.name?.["family-name"]?.value || "";
    const biography = person?.biography?.content || "";

    const userId = req.user?.id || req.session?.user?.id;

    if (!userId) {
      return res.redirect(`${dashboardUrl}?orcid=no_user_session`);
    }

    await db.query(
      `UPDATE researchers
       SET orcid_id = ?, first_name = ?, last_name = ?, biography = ?
       WHERE user_id = ?`,
      [orcidId, firstName, lastName, biography, userId]
    );

    return res.redirect(`${dashboardUrl}?orcid=connected`);
  } catch (error) {
    console.error("ORCID callback error:", error);
    return res.redirect(`${dashboardUrl}?orcid=error`);
  }
});

router.get("/debug-env", (req, res) => {
  res.json({
    hasClientId: Boolean(process.env.ORCID_CLIENT_ID),
    clientIdStart: process.env.ORCID_CLIENT_ID?.slice(0, 8),
    hasRedirectUri: Boolean(process.env.ORCID_REDIRECT_URI),
    redirectUri: process.env.ORCID_REDIRECT_URI,
  });
});

export default router;