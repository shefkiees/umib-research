import express from "express";
import db from "../config/db.js";
import { exchangeCodeForToken, getOrcidPerson } from "../services/orcid.service.js";

const router = express.Router();

// 🔗 STEP 1: Redirect tek ORCID
router.get("/connect", (req, res) => {
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

// 🔁 STEP 2: Callback nga ORCID
router.get("/callback", async (req, res) => {
  try {
    const { code, error } = req.query;

    // ❗ kontrollo nëse ORCID kthen error direkt
    if (error) {
      console.log("ORCID auth error:", error);
      return res.redirect(`${process.env.FRONTEND_URL}/profile?orcid=auth_error`);
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/profile?orcid=missing_code`);
    }

    // 🔑 Exchange code → token
    const tokenData = await exchangeCodeForToken(code);

    if (!tokenData || tokenData.error) {
      console.log("ORCID token error:", tokenData);
      return res.redirect(`${process.env.FRONTEND_URL}/profile?orcid=token_error`);
    }

    const orcidId = tokenData.orcid;
    const accessToken = tokenData.access_token;

    // 👤 Merr të dhënat e userit nga ORCID
    const person = await getOrcidPerson(orcidId, accessToken);

    const firstName = person?.name?.["given-names"]?.value || "";
    const lastName = person?.name?.["family-name"]?.value || "";
    const biography = person?.biography?.content || "";

    // ⚠️ FIX KRITIK: userId duhet të ekzistojë
    const userId = req.user?.id || req.session?.user?.id;

    if (!userId) {
      console.log("No user session found!");
      return res.redirect(`${process.env.FRONTEND_URL}/profile?orcid=no_user_session`);
    }

    // 💾 UPDATE DB (kontrollo nëse ekziston rreshti)
    await db.query(
      `UPDATE researchers
       SET orcid_id = ?, first_name = ?, last_name = ?, biography = ?
       WHERE user_id = ?`,
      [orcidId, firstName, lastName, biography, userId]
    );

    return res.redirect(`${process.env.FRONTEND_URL}/profile?orcid=connected`);
    
  } catch (error) {
    console.error("ORCID callback error:", error.message);
    return res.redirect(`${process.env.FRONTEND_URL}/profile?orcid=error`);
  }
});

// 🧪 Debug endpoint
router.get("/debug-env", (req, res) => {
  res.json({
    hasClientId: Boolean(process.env.ORCID_CLIENT_ID),
    hasRedirectUri: Boolean(process.env.ORCID_REDIRECT_URI),
    redirectUri: process.env.ORCID_REDIRECT_URI,
  });
});

export default router;