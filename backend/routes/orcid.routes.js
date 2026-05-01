import express from "express";
import db from "../config/db.js";
import {
  exchangeCodeForToken,
  getOrcidEducations,
  getOrcidEmployments,
  getOrcidPerson,
} from "../services/orcid.service.js";

const router = express.Router();

function extractOrcidName(person, fallbackName = "") {
  const name = person?.name || {};
  const givenName = String(name?.["given-names"]?.value || name?.["given-names"]?.content || "").trim();
  const familyName = String(name?.["family-name"]?.value || name?.["family-name"]?.content || "").trim();
  const creditName = String(name?.["credit-name"]?.value || name?.["credit-name"]?.content || "").trim();

  const resolvedName = creditName || [givenName, familyName].filter(Boolean).join(" ").trim();
  return resolvedName || fallbackName;
}

function readOrcidValue(node) {
  if (typeof node === "string" || typeof node === "number") {
    return String(node).trim();
  }

  return String(node?.value || node?.content || "").trim();
}

function formatOrcidDate(date) {
  if (!date) {
    return "";
  }

  return [date.year, date.month, date.day]
    .map(readOrcidValue)
    .filter(Boolean)
    .join("-");
}

function extractOrcidProfile(person, tokenData) {
  const urls = person?.["researcher-urls"]?.["researcher-url"] || [];
  const keywords = person?.keywords?.keyword || [];
  const countries = person?.addresses?.address || [];
  const externalIdentifiers = person?.["external-identifiers"]?.["external-identifier"] || [];

  return {
    name: extractOrcidName(person, tokenData?.name || ""),
    biography: readOrcidValue(person?.biography),
    researcherUrls: urls.map((item) => ({
      name: readOrcidValue(item?.["url-name"]),
      url: readOrcidValue(item?.url),
    })).filter((item) => item.name || item.url),
    keywords: keywords.map((item) => readOrcidValue(item?.content || item)).filter(Boolean),
    countries: countries.map((item) => readOrcidValue(item?.country)).filter(Boolean),
    externalIdentifiers: externalIdentifiers.map((item) => ({
      type: readOrcidValue(item?.["external-id-type"]),
      value: readOrcidValue(item?.["external-id-value"]),
      url: readOrcidValue(item?.["external-id-url"]),
    })).filter((item) => item.type || item.value || item.url),
  };
}

function extractAffiliations(section, summaryKey) {
  const groups = section?.["affiliation-group"] || [];

  return groups.flatMap((group) => {
    const summaries = group?.summaries || [];

    return summaries.map((entry) => {
      const summary = entry?.[summaryKey] || entry;
      const organization = summary?.organization || {};
      const address = organization?.address || {};
      const disambiguatedOrg = organization?.["disambiguated-organization"] || {};

      return {
        putCode: summary?.["put-code"] || null,
        organization: readOrcidValue(organization?.name || organization),
        department: readOrcidValue(summary?.["department-name"]),
        roleTitle: readOrcidValue(summary?.["role-title"]),
        startDate: formatOrcidDate(summary?.["start-date"]),
        endDate: formatOrcidDate(summary?.["end-date"]),
        city: readOrcidValue(address?.city),
        region: readOrcidValue(address?.region),
        country: readOrcidValue(address?.country),
        organizationId: readOrcidValue(disambiguatedOrg?.["disambiguated-organization-identifier"]),
        organizationIdSource: readOrcidValue(disambiguatedOrg?.["disambiguation-source"]),
        url: readOrcidValue(summary?.url),
        visibility: readOrcidValue(summary?.visibility),
      };
    }).filter((item) => item.organization || item.department || item.roleTitle);
  });
}

async function getOptionalOrcidData(label, loader) {
  try {
    return await loader();
  } catch (error) {
    console.warn(`ORCID ${label} data could not be loaded:`, error);
    return null;
  }
}

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://www.umibres.page";
};

const getProfessorDashboardUrl = (status) => {
  return `${getFrontendUrl()}/professor/dashboard?orcid=${status}`;
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

    const dbUserResult = await db.query(
      `SELECT id, email, google_id, full_name
       FROM users
       WHERE id = $1 OR google_id = $2 OR email = $3
       LIMIT 1`,
      [req.user.id, req.user.googleId || req.user.id, req.user.email]
    );

    if (dbUserResult.rowCount === 0) {
      console.log("Logged-in user not found in DB:", req.user);
      return res.redirect(getProfessorDashboardUrl("user_not_found"));
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
    return res.redirect(getProfessorDashboardUrl("error"));
  }
});

// 🔁 STEP 2: Callback nga ORCID
router.get("/callback", async (req, res) => {
  try {
    const { code, error, state } = req.query;

    if (error) {
      console.log("ORCID auth error:", error);
      return res.redirect(getProfessorDashboardUrl("auth_error"));
    }

    if (!code) {
      return res.redirect(getProfessorDashboardUrl("missing_code"));
    }

    const userId = state;

    if (!userId || userId === "undefined" || userId === "null") {
      console.log("Invalid userId in ORCID state:", userId);
      return res.redirect(getProfessorDashboardUrl("no_user_session"));
    }

    const tokenData = await exchangeCodeForToken(code);

    if (!tokenData || tokenData.error) {
      console.log("ORCID token error:", tokenData);
      return res.redirect(getProfessorDashboardUrl("token_error"));
    }

    const orcidId = tokenData.orcid;
    const accessToken = tokenData.access_token;

    if (!orcidId || !accessToken) {
      console.log("Missing ORCID ID or access token:", tokenData);
      return res.redirect(getProfessorDashboardUrl("token_error"));
    }

    const [person, educations, employments] = await Promise.all([
      getOptionalOrcidData("person", () => getOrcidPerson(orcidId, accessToken)),
      getOptionalOrcidData("educations", () => getOrcidEducations(orcidId, accessToken)),
      getOptionalOrcidData("employments", () => getOrcidEmployments(orcidId, accessToken)),
    ]);

    console.log("ORCID connected successfully");
    console.log("Database user ID:", userId);
    console.log("ORCID ID:", orcidId);
    console.log("ORCID person:", person ? "received" : "not received");

    const orcidProfile = extractOrcidProfile(person, tokenData);
    const orcidDisplayName = orcidProfile.name;
    const orcidEducations = extractAffiliations(educations, "education-summary");
    const orcidEmployments = extractAffiliations(employments, "employment-summary");

    const result = await db.query(
      `UPDATE users
       SET orcid_id = $1,
           full_name = CASE
             WHEN $2::text IS NOT NULL AND $2::text <> '' THEN $2
             ELSE full_name
           END,
           orcid_profile = $4::jsonb,
           orcid_educations = $5::jsonb,
           orcid_employments = $6::jsonb,
           orcid_last_synced_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, full_name, orcid_id`,
      [
        orcidId,
        orcidDisplayName || null,
        userId,
        JSON.stringify(orcidProfile),
        JSON.stringify(orcidEducations),
        JSON.stringify(orcidEmployments),
      ]
    );

    if (result.rowCount === 0) {
      console.log("No user found with database id:", userId);
      return res.redirect(getProfessorDashboardUrl("user_not_found"));
    }

    return res.redirect(getProfessorDashboardUrl("connected"));
  } catch (error) {
    console.error("ORCID callback error:", error);
    return res.redirect(getProfessorDashboardUrl("error"));
  }
});

// 🧪 Test session
router.get("/session-check", (req, res) => {
  res.json({
    loggedIn: Boolean(req.user),
    user: req.user || null,
  });
});

// 🧪 Debug env
router.get("/debug-env", (req, res) => {
  res.json({
    hasClientId: Boolean(process.env.ORCID_CLIENT_ID),
    hasRedirectUri: Boolean(process.env.ORCID_REDIRECT_URI),
    redirectUri: process.env.ORCID_REDIRECT_URI,
    frontendUrl: getFrontendUrl(),
  });
});

export default router;
