import express from "express";
import { createClient } from "@supabase/supabase-js";
import db from "../config/db.js";
import passport from "../config/passport.js";
import { googleAuthConfigured } from "../config/passport.js";
import { getAbsoluteUrlEnvValue } from "../config/urlConfig.js";
import { sendEmailNotification } from "../services/notification.service.js";

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const LOGIN_ROUTE = "/login";
const PROFESSOR_DASHBOARD_ROUTE = "/professor/dashboard";
const PASSWORD_RESET_ROUTE = "/auth/reset-password";
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

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("supabase_admin_not_configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getPasswordResetRedirectUrl(req) {
  return (
    process.env.SUPABASE_PASSWORD_RESET_REDIRECT_URL ||
    process.env.VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL ||
    `${getClientUrl(req)}${PASSWORD_RESET_ROUTE}`
  );
}

function buildPasswordResetEmailHtml(actionLink) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:620px;margin:0 auto">
      <h2 style="margin:0 0 16px;font-size:22px">Rivendosja e Fjalekalimit - UMIBRes</h2>
      <p>Pershendetje i/e nderuar,</p>
      <p>Kemi pranuar nje kerkese per rivendosjen e fjalekalimit te llogarise suaj ne platformen UMIBRes.</p>
      <p>Klikoni butonin me poshte per te vendosur nje fjalekalim te ri.</p>
      <p style="margin:24px 0">
        <a href="${actionLink}" style="background:#153a63;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;display:inline-block;font-weight:700">
          Ndrysho Fjalekalimin
        </a>
      </p>
      <p>Ky link eshte i vlefshem per kohe te kufizuar.</p>
      <hr style="border:none;border-top:1px solid #d8e0ea;margin:28px 0" />
      <p>Universiteti i Mitrovices "Isa Boletini"</p>
      <p style="color:#536177;font-size:13px">Nese nuk keni kerkuar rivendosjen e fjalekalimit, ju lutemi injoroni kete mesazh.</p>
      <p style="color:#536177;font-size:13px">&copy; 2026 UMIB. Te gjitha te drejtat e rezervuara.</p>
    </div>
  `;
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
    academicTitle: row.academic_title || "",
    scientificTitle: row.scientific_title || "",
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
      `SELECT id, google_id, orcid_id, email, full_name, role, academic_title, scientific_title, faculty, department, office,
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
    const nextAcademicTitle = String(req.body?.academicTitle || req.body?.academic_title || "").trim();
    const nextScientificTitle = String(req.body?.scientificTitle || req.body?.scientific_title || "").trim();

    const result = await db.query(
      `UPDATE users
       SET full_name = CASE
             WHEN $2::text IS NOT NULL THEN $2
             ELSE full_name
           END,
           faculty = $3,
           department = $4,
           office = $5,
           academic_title = $6,
           scientific_title = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, google_id, orcid_id, email, full_name, role, academic_title, scientific_title, faculty, department, office,
                 orcid_profile, orcid_educations, orcid_employments, orcid_last_synced_at`,
      [
        req.user.id,
        hasOrcidIdentity ? null : (nextName || null),
        nextFaculty || null,
        nextDepartment || null,
        nextOffice || null,
        nextAcademicTitle || null,
        nextScientificTitle || null,
      ]
    );

    res.json({ user: mapUserRowToProfile(result.rows[0]) });
  } catch (error) {
    console.error("PUT /api/auth/me failed:", error);
    res.status(500).json({ user: null });
  }
});

router.post("/password-reset", async (req, res) => {
  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
      res.status(401).json({ error: "unauthorized", message: "Sesioni nuk eshte aktiv." });
      return;
    }

    const requestedEmail = String(req.body?.email || "").trim().toLowerCase();

    if (!requestedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
      res.status(400).json({ error: "invalid_email", message: "Email nuk eshte valid." });
      return;
    }

    const userResult = await db.query(
      `select email from users where id = $1 limit 1`,
      [req.user.id]
    );
    const accountEmail = String(userResult.rows[0]?.email || "").trim().toLowerCase();

    if (!accountEmail || accountEmail !== requestedEmail) {
      res.status(403).json({ error: "email_mismatch", message: "Email nuk perputhet me llogarine." });
      return;
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const redirectTo = getPasswordResetRedirectUrl(req);
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: accountEmail,
      options: { redirectTo },
    });

    if (error) {
      console.error("Supabase recovery link generation failed:", error);
      res.status(error.status || 500).json({ error: error.code || "recovery_link_failed", message: error.message });
      return;
    }

    const actionLink = data?.properties?.action_link;

    if (!actionLink) {
      res.status(500).json({ error: "missing_recovery_link", message: "Recovery link nuk u gjenerua." });
      return;
    }

    const emailResult = await sendEmailNotification({
      to: accountEmail,
      title: "Rivendosja e Fjalekalimit - UMIBRes",
      message: `Klikoni kete link per te ndryshuar fjalekalimin: ${actionLink}`,
      category: "Siguria",
      html: buildPasswordResetEmailHtml(actionLink),
    });

    if (emailResult?.skipped) {
      res.status(500).json({ error: "email_not_configured", message: "Resend nuk eshte konfiguruar." });
      return;
    }

    res.json({ sent: true, redirectTo });
  } catch (error) {
    console.error("POST /api/auth/password-reset failed:", error);
    res.status(500).json({ error: "password_reset_failed", message: error.message || "Reset email nuk u dergua." });
  }
});

router.post("/logout", (req, res) => {
  const clearCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  };

  req.logout((error) => {
    if (error) {
      res.status(500).json({ error: "logout_failed" });
      return;
    }

    if (!req.session) {
      res.clearCookie("connect.sid", clearCookieOptions);
      res.json({ message: "Logged out" });
      return;
    }

    req.session.destroy(() => {
      res.clearCookie("connect.sid", clearCookieOptions);
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
