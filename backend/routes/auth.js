import express from "express";
import db from "../config/db.js";
import passport from "../config/passport.js";
import { googleAuthConfigured } from "../config/passport.js";
import { getAbsoluteUrlEnvValue } from "../config/urlConfig.js";
import { sendEmailNotification } from "../services/notification.service.js";

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const LOGIN_ROUTE = "/login";
const PROFESSOR_DASHBOARD_ROUTE = "/professor/dashboard";
const ACCESS_RESET_SUCCESS_MESSAGE = "Nese ky email ekziston ne sistem, kerkesa do te procesohet nga stafi pergjegjes.";
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

function getAccessResetAdminUrl(req) {
  return `${getClientUrl(req) || ""}/admin/dashboard`;
}

function buildAccessResetEmailHtml({ email, requesterIp, adminUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:620px;margin:0 auto">
      <h2 style="margin:0 0 16px;font-size:22px">Rivendosja e qasjes - UMIBRes</h2>
      <p>Pershendetje i/e nderuar,</p>
      <p>Ne platformen UMIBRes eshte pranuar nje kerkese per rivendosjen e qasjes.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>IP:</strong> ${requesterIp || "N/A"}</p>
      <p>Kerkesa duhet te trajtohet manualisht nga administratori ose stafi pergjegjes i IT-se.</p>
      <p style="margin:24px 0">
        <a href="${adminUrl}" style="background:#153a63;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;display:inline-block;font-weight:700">
          Paraqit kerkesen
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #d8e0ea;margin:28px 0" />
      <p>Universiteti i Mitrovices "Isa Boletini"</p>
      <p style="color:#536177;font-size:13px">&copy; 2026 UMIB. Te gjitha te drejtat e rezervuara.</p>
    </div>
  `;
}

function buildAccessResetUserEmailHtml({ email, appUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:620px;margin:0 auto">
      <h2 style="margin:0 0 16px;font-size:22px">Rivendosja e qasjes - UMIBRes</h2>
      <p>Pershendetje i/e nderuar,</p>
      <p>Kerkesa juaj per rivendosjen e qasjes u pranua.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p>Stafi pergjegjes i IT-se do ta shqyrtoje kerkesen dhe do t'ju kontaktoje sipas procedures se fakultetit.</p>
      <p style="margin:24px 0">
        <a href="${appUrl}" style="background:#153a63;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;display:inline-block;font-weight:700">
          Paraqit kerkesen
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #d8e0ea;margin:28px 0" />
      <p>Universiteti i Mitrovices "Isa Boletini"</p>
      <p style="color:#536177;font-size:13px">&copy; 2026 UMIB. Te gjitha te drejtat e rezervuara.</p>
    </div>
  `;
}

function getAccessResetRecipients(rows = []) {
  const configuredRecipients = String(process.env.ACCESS_RESET_NOTIFY_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const adminRecipients = rows
    .map((row) => String(row.email || "").trim().toLowerCase())
    .filter(Boolean);

  return [...new Set([...configuredRecipients, ...adminRecipients])];
}

function getAccessResetTemplateId() {
  return process.env.RESEND_ACCESS_RESET_TEMPLATE_ID || process.env.RESEND_PASSWORD_RESET_TEMPLATE_ID || "";
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
    const requestedEmail = String(req.body?.email || "").trim().toLowerCase();

    if (!requestedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
      res.status(400).json({ error: "invalid_email", message: "Email nuk eshte valid." });
      return;
    }

    const userResult = await db.query(
      `select id, email, full_name, role
       from users
       where lower(email) = lower($1)
       limit 1`,
      [requestedEmail]
    );
    const account = userResult.rows[0] || null;

    if (!account) {
      res.json({ received: true, message: ACCESS_RESET_SUCCESS_MESSAGE });
      return;
    }

    const requesterIp = req.ip || req.get("x-forwarded-for") || null;
    const userAgent = req.get("user-agent") || null;
    const insertResult = await db.query(
      `insert into access_reset_requests (user_id, requested_email, requester_ip, user_agent)
       values ($1, $2, $3, $4)
       returning id, requested_at`,
      [account.id, account.email, requesterIp, userAgent]
    );
    const requestRow = insertResult.rows[0];
    const adminResult = await db.query(
      `select email from users where role = 'admin' and email is not null`
    );
    const recipients = getAccessResetRecipients(adminResult.rows);
    const adminUrl = getAccessResetAdminUrl(req);
    const appUrl = `${getClientUrl(req) || ""}/login`;
    const templateId = getAccessResetTemplateId();

    try {
      const userEmailResult = await sendEmailNotification({
        to: account.email,
        title: "Rivendosja e qasjes - UMIBRes",
        message: "Kerkesa juaj per rivendosjen e qasjes u pranua. Stafi pergjegjes i IT-se do ta shqyrtoje kerkesen dhe do t'ju kontaktoje.",
        category: "Siguria",
        html: buildAccessResetUserEmailHtml({ email: account.email, appUrl }),
        template: templateId
          ? {
              id: templateId,
              variables: {
                REQUEST_EMAIL: account.email,
                REQUEST_ID: requestRow.id,
                REQUESTED_AT: requestRow.requested_at,
                ADMIN_LINK: adminUrl,
                RESET_LINK: appUrl,
                ACTION_LABEL: "Paraqit kerkesen",
              },
            }
          : null,
      });

      if (userEmailResult?.skipped) {
        console.warn("access_reset_user_email_skipped", { requestId: requestRow.id });
      }
    } catch (emailError) {
      console.warn("access_reset_user_email_failed", {
        requestId: requestRow.id,
        message: emailError.message,
      });
    }

    if (recipients.length) {
      try {
        const emailResult = await sendEmailNotification({
          to: recipients,
          title: "Rivendosja e qasjes - UMIBRes",
          message: `Kerkese per rivendosje qasjeje nga ${account.email}. Trajtojeni manualisht sipas procedures se fakultetit.`,
          category: "Siguria",
          html: buildAccessResetEmailHtml({ email: account.email, requesterIp, adminUrl }),
          template: templateId
            ? {
                id: templateId,
                variables: {
                  REQUEST_EMAIL: account.email,
                  REQUEST_ID: requestRow.id,
                  REQUESTED_AT: requestRow.requested_at,
                  ADMIN_LINK: adminUrl,
                  RESET_LINK: adminUrl,
                  ACTION_LABEL: "Paraqit kerkesen",
                },
              }
            : null,
        });

        if (emailResult?.skipped) {
          console.warn("access_reset_email_skipped", { requestId: requestRow.id });
        }
      } catch (emailError) {
        console.warn("access_reset_email_failed", {
          requestId: requestRow.id,
          message: emailError.message,
        });
      }
    }

    res.json({
      received: true,
      message: "Kerkesa juaj per rivendosjen e qasjes u pranua. Kontrolloni emailin tuaj.",
    });
  } catch (error) {
    console.error("POST /api/auth/password-reset failed:", error);
    res.status(500).json({ error: "access_reset_failed", message: "Kerkesa nuk u pranua. Provoni perseri." });
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
