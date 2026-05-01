import express from "express";
import db from "../config/db.js";
import passport from "../config/passport.js";
import { googleAuthConfigured } from "../config/passport.js";
import { getAbsoluteUrlEnvValue } from "../config/urlConfig.js";

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const LOGIN_ROUTE = "/login";
const PROFESSOR_DASHBOARD_ROUTE = "/professor/dashboard";
const DASHBOARD_BY_ROLE = {
  admin: "/prorector/dashboard",
  committee: "/committee/dashboard",
  professor: PROFESSOR_DASHBOARD_ROUTE,
  prorector: "/prorector/dashboard"
};
const configuredClientUrl = getAbsoluteUrlEnvValue(process.env.CLIENT_URL);
const configuredGoogleCallbackUrl = getAbsoluteUrlEnvValue(process.env.GOOGLE_CALLBACK_URL);

function getRequestOrigin(req) {
  const forwardedProto = req.get("x-forwarded-proto");
  const forwardedHost = req.get("x-forwarded-host");
  const host = forwardedHost || req.get("host");

  if (!host) {
    return null;
  }

  return `${forwardedProto || "https"}://${host}`;
}

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function getAppOrigin(req) {
  if (!isProduction) {
    return configuredClientUrl || "http://localhost:5173";
  }

  const requestOrigin = getRequestOrigin(req);

  if (requestOrigin && !isLocalOrigin(requestOrigin)) {
    return requestOrigin;
  }

  if (configuredClientUrl) {
    return configuredClientUrl;
  }

  if (configuredGoogleCallbackUrl) {
    return new URL(configuredGoogleCallbackUrl).origin;
  }

  return requestOrigin || null;
}

function getClientUrl(req) {
  return getAppOrigin(req);
}

function getGoogleCallbackUrl(req) {
  if (!isProduction && configuredGoogleCallbackUrl) {
    return configuredGoogleCallbackUrl;
  }

  const appOrigin = getAppOrigin(req);

  if (appOrigin) {
    return `${appOrigin}/api/auth/google/callback`;
  }

  return "http://localhost:5000/api/auth/google/callback";
}

const redirectToLoginWithError = (res, authError, req) => {
  res.redirect(`${getClientUrl(req)}${LOGIN_ROUTE}?authError=${encodeURIComponent(authError)}`);
};

const getCallbackErrorCode = (error) => {
  const errorCode = String(error?.code || "");

  if (errorCode.startsWith("ER_") || errorCode.startsWith("23")) {
    return "db_user_sync_failed";
  }

  return "oauth_callback_failed";
};

function mapUserRowToProfile(row) {
  if (!row) {
    return null;
  }

  const orcidEducations = Array.isArray(row.orcid_educations) ? row.orcid_educations : [];
  const orcidEmployments = Array.isArray(row.orcid_employments) ? row.orcid_employments : [];

  return {
    id: row.id,
    googleId: row.google_id,
    orcidId: row.orcid_id,
    email: row.email,
    name: row.full_name || row.email || "",
    role: row.role,
    faculty: row.faculty || "",
    department: row.department || "",
    office: row.office || "",
    school: orcidEducations[0]?.organization || "",
    currentAffiliation: orcidEmployments[0]?.organization || orcidEducations[0]?.organization || "",
    orcidProfile: row.orcid_profile || {},
    orcidEducations,
    orcidEmployments,
    orcidLastSyncedAt: row.orcid_last_synced_at || null,
  };
}

router.get("/me", async (req, res) => {
  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
      res.status(401).json({ user: null });
      return;
    }

    const result = await db.query(
      `SELECT id, google_id, orcid_id, email, full_name, role, faculty, department, office,
              orcid_profile, orcid_educations, orcid_employments, orcid_last_synced_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ user: null });
      return;
    }

    res.json({ user: mapUserRowToProfile(result.rows[0]) });
  } catch (error) {
    console.error("GET /api/auth/me failed:", error);
    res.status(500).json({ user: null });
  }
});

router.put("/me", async (req, res) => {
  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
      res.status(401).json({ user: null });
      return;
    }

    const currentResult = await db.query(
      `SELECT id, orcid_id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (currentResult.rowCount === 0) {
      res.status(404).json({ user: null });
      return;
    }

    const currentUser = currentResult.rows[0];
    const hasOrcidIdentity = Boolean(currentUser.orcid_id);
    const nextName = String(req.body?.name || "").trim();
    const nextFaculty = String(req.body?.faculty || "").trim();
    const nextDepartment = String(req.body?.department || "").trim();
    const nextOffice = String(req.body?.office || "").trim();

    const result = await db.query(
      `UPDATE users
       SET full_name = CASE
             WHEN $2::text IS NOT NULL THEN $2
             ELSE full_name
           END,
           faculty = $3,
           department = $4,
           office = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, google_id, orcid_id, email, full_name, role, faculty, department, office,
                 orcid_profile, orcid_educations, orcid_employments, orcid_last_synced_at`,
      [
        req.user.id,
        hasOrcidIdentity ? null : (nextName || null),
        nextFaculty || null,
        nextDepartment || null,
        nextOffice || null,
      ]
    );

    res.json({ user: mapUserRowToProfile(result.rows[0]) });
  } catch (error) {
    console.error("PUT /api/auth/me failed:", error);
    res.status(500).json({ user: null });
  }
});

router.post("/logout", (req, res) => {
  req.logout((error) => {
    if (error) {
      res.status(500).json({ error: "logout_failed" });
      return;
    }

    req.session?.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });
});

router.get("/google", (req, res, next) => {
  if (!googleAuthConfigured) {
    redirectToLoginWithError(res, "oauth_not_configured", req);
    return;
  }

  passport.authenticate("google", {
    scope: ["profile", "email"],
    callbackURL: getGoogleCallbackUrl(req)
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  console.log("CALLBACK HIT");

  passport.authenticate("google", {
    callbackURL: getGoogleCallbackUrl(req)
  }, (error, user, info) => {
    if (error) {
      console.error("Google OAuth callback failed:", error);
      redirectToLoginWithError(res, getCallbackErrorCode(error), req);
      return;
    }

    if (!user) {
      const authError = info?.message?.includes("@umib.net")
        ? "unauthorized_domain"
        : "google_login_failed";

      redirectToLoginWithError(res, authError, req);
      return;
    }

    req.logIn(user, (loginError) => {
      if (loginError) {
        console.error("Creating session after Google login failed:", loginError);
        redirectToLoginWithError(res, "session_login_failed", req);
        return;
      }

      const dashboardRoute = DASHBOARD_BY_ROLE[user.role] || PROFESSOR_DASHBOARD_ROUTE;

      console.log("LOGIN SUCCESS");
      res.redirect(`${getClientUrl(req)}${dashboardRoute}`);
    });
  })(req, res, next);
});

export default router;
