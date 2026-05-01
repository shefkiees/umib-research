import express from "express";
import db from "../config/db.js";
import {
  exchangeCodeForToken,
  getOrcidPerson,
} from "../services/orcid.service.js";

const router = express.Router();

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://www.umibres.page";
};

// 🔗 STEP 1: Redirect tek ORCID
router.get("/connect", async (req, res) => {
  try {
    if (!process.env.ORCID_CLIENT_ID || !process.env.ORCID_REDIRECT_URI) {
      return res.status(500).send("ORCID environment variables are missing");
    }

    if (!req.user || !req.user.email) {
      console.log("No logged-in user found before ORCID connect");
      return res.redirect(`${getFrontendUrl()}/login?orcid=no_user_session`);
    }

    // Gjej user-in real në databazë.
    // req.user.id mund të jetë Google ID, ndërsa users.id është UUID.
    const dbUserResult = await db.query(
      `SELECT id, email, google_id, full_name
       FROM users
       WHERE google_id = $1 OR email = $2
       LIMIT 1`,
      [req.user.id, req.user.email]
    );

    if (dbUserResult.rowCount === 0) {
      console.log("Logged-in user not found in DB:", req.user);
      return res.redirect(`${getFrontendUrl()}/profile?orcid=user_not_found`);
    }

    const dbUser = dbUserResult.rows[0];

    const params = new URLSearchParams({
      client_id: process.env.ORCID_CLIENT_ID,
      response_type: "code",
      scope: "/authenticate",
      redirect_uri: process.env.ORCID_REDIRECT_URI,
      state: dbUser.id,
    });

    return res.redirect(`https://orcid.org/oauth/authorize?${params.toString()}`);
  } catch (error) {
    console.error("ORCID connect error:", error);
    return res.redirect(`${getFrontendUrl()}/profile?orcid=error`);
  }
});

// 🔁 STEP 2: Callback nga ORCID
router.get("/callback", async (req, res) => {
  try {
    const { code, error, state } = req.query;

    if (error) {
      console.log("ORCID auth error:", error);
      return res.redirect(`${getFrontendUrl()}/profile?orcid=auth_error`);
    }

    if (!code) {
      return res.redirect(`${getFrontendUrl()}/profile?orcid=missing_code`);
    }

    const userId = state;

    if (!userId || userId === "undefined" || userId === "null") {
      console.log("Invalid userId in ORCID state:", userId);
      return res.redirect(`${getFrontendUrl()}/profile?orcid=no_user_session`);
    }

    const tokenData = await exchangeCodeForToken(code);

    if (!tokenData || tokenData.error) {
      console.log("ORCID token error:", tokenData);
      return res.redirect(`${getFrontendUrl()}/profile?orcid=token_error`);
    }

    const orcidId = tokenData.orcid;
    const accessToken = tokenData.access_token;

    if (!orcidId || !accessToken) {
      console.log("Missing ORCID ID or access token:", tokenData);
      return res.redirect(`${getFrontendUrl()}/profile?orcid=token_error`);
    }

    const person = await getOrcidPerson(orcidId, accessToken);

    console.log("ORCID connected successfully");
    console.log("Database user ID:", userId);
    console.log("ORCID ID:", orcidId);
    console.log("ORCID person:", person ? "received" : "not received");

    const result = await db.query(
      `UPDATE users
       SET orcid_id = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, full_name, orcid_id`,
      [orcidId, userId]
    );

    if (result.rowCount === 0) {
      console.log("No user found with database id:", userId);
      return res.redirect(`${getFrontendUrl()}/profile?orcid=user_not_found`);
    }

    return res.redirect(`${getFrontendUrl()}/profile?orcid=connected`);
  } catch (error) {
    console.error("ORCID callback error:", error);
    return res.redirect(`${getFrontendUrl()}/profile?orcid=error`);
  }
});

// 🧪 Test: kontrollo nëse session/user ekziston
router.get("/session-check", (req, res) => {
  res.json({
    loggedIn: Boolean(req.user),
    user: req.user || null,
  });
});

// 🧪 Debug endpoint
router.get("/debug-env", (req, res) => {
  res.json({
    hasClientId: Boolean(process.env.ORCID_CLIENT_ID),
    hasRedirectUri: Boolean(process.env.ORCID_REDIRECT_URI),
    redirectUri: process.env.ORCID_REDIRECT_URI,
    frontendUrl: getFrontendUrl(),
  });
});

export default router;
