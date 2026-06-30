import express from "express";
import db from "../config/db.js";
import passport from "../config/passport.js";
import { googleAuthConfigured } from "../config/passport.js";
import { getAbsoluteUrlEnvValue } from "../config/urlConfig.js";
import { sendEmailNotification } from "../services/notification.service.js";
import { getRequestIp, writeAuditLog } from "../services/auditLog.service.js";

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const LOGIN_ROUTE = "/login";
const PROFESSOR_DASHBOARD_ROUTE = "/professor/dashboard";
const ACCESS_RESET_SUCCESS_MESSAGE = "Nese ky email ekziston ne sistem, kerkesa do te procesohet nga stafi pergjegjes.";
const DASHBOARD_BY_ROLE = {
  admin: "/admin/dashboard",
  committee: "/committee/dashboard",
  professor: PROFESSOR_DASHBOARD_ROUTE,
  prorector: "/prorector/dashboard"
};
const configuredClientUrl = getAbsoluteUrlEnvValue(process.env.CLIENT_URL);
const configuredGoogleCallbackUrl = getAbsoluteUrlEnvValue(process.env.GOOGLE_CALLBACK_URL);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const PROFILE_PHOTO_MAX_LENGTH = 180000;
const PROFILE_PHOTO_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;
const SYSTEM_INSTITUTION = "Universiteti \"Isa Boletini\" Mitrovicë";
const CITATION_COUNT_SQL = `
  case
    when coalesce(
      m.raw_json->>'is-referenced-by-count',
      m.raw_json#>>'{message,is-referenced-by-count}',
      m.raw_json->>'citationCount',
      m.raw_json->>'citation_count'
    ) ~ '^[0-9]+$'
    then coalesce(
      m.raw_json->>'is-referenced-by-count',
      m.raw_json#>>'{message,is-referenced-by-count}',
      m.raw_json->>'citationCount',
      m.raw_json->>'citation_count'
    )::int
    else null
  end
`;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeIban(value) {
  return normalizeText(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeCurrency(value) {
  const currency = normalizeText(value).toUpperCase();
  return CURRENCY_PATTERN.test(currency) ? currency : "EUR";
}

function normalizeProfilePhotoUrl(value) {
  const photoUrl = normalizeText(value);

  if (!photoUrl) {
    return "";
  }

  if (photoUrl.length > PROFILE_PHOTO_MAX_LENGTH || !PROFILE_PHOTO_DATA_URL_PATTERN.test(photoUrl)) {
    const error = new Error("invalid_profile_photo");
    error.statusCode = 400;
    throw error;
  }

  return photoUrl;
}

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

async function updateLastLoginAt(userId) {
  console.log("last_login_update_started", { userId });

  const result = await db.query(
    `update users
     set last_login_at = now(),
         updated_at = now()
     where id = $1
     returning id, email, last_login_at`,
    [userId]
  );

  const row = result.rows[0] || null;

  console.log("last_login_update_finished", {
    userId,
    updated: result.rowCount,
    email: row?.email,
    lastLoginAt: row?.last_login_at,
  });

  return row;
}

function mapUserRowToProfile(row) {
  if (!row) {
    return null;
  }

  const orcidEducations = Array.isArray(row.orcid_educations) ? row.orcid_educations : [];
  const orcidEmployments = Array.isArray(row.orcid_employments) ? row.orcid_employments : [];
  const profileOverrides = row.profile_overrides && typeof row.profile_overrides === "object"
    ? row.profile_overrides
    : {};
  const overrideEducation = Array.isArray(profileOverrides.education) ? profileOverrides.education : null;
  const displayEducation = overrideEducation || orcidEducations;
  const overrideSchool = String(profileOverrides.school || "").trim();
  const overrideAffiliation = String(profileOverrides.currentAffiliation || profileOverrides.current_affiliation || "").trim();
  const profilePhotoUrl = String(profileOverrides.profilePhotoUrl || profileOverrides.profile_photo_url || "").trim();

  return {
    id: row.id,
    googleId: row.google_id,
    orcidId: row.orcid_id,
    email: row.email,
    name: row.full_name || row.email || "",
    role: row.role,
    status: row.status || "active",
    academicTitle: row.academic_title || "",
    scientificTitle: row.scientific_title || "",
    faculty: row.faculty || "",
    department: row.department || "",
    office: row.office || "",
    school: overrideSchool || orcidEducations[0]?.organization || "",
    currentAffiliation: overrideAffiliation || orcidEmployments[0]?.organization || orcidEducations[0]?.organization || "",
    profilePhotoUrl,
    avatarUrl: profilePhotoUrl,
    education: displayEducation,
    profileOverrides,
    orcidProfile: row.orcid_profile || {},
    orcidEducations,
    orcidEmployments,
    orcidLastSyncedAt: row.orcid_last_synced_at || null,
  };
}

function mapCommunityProfessorRow(row) {
  const profileOverrides = row.profile_overrides && typeof row.profile_overrides === "object"
    ? row.profile_overrides
    : {};
  const orcidEducations = Array.isArray(row.orcid_educations) ? row.orcid_educations : [];
  const orcidEmployments = Array.isArray(row.orcid_employments) ? row.orcid_employments : [];
  const overrideSchool = String(profileOverrides.school || "").trim();
  const overrideAffiliation = String(profileOverrides.currentAffiliation || profileOverrides.current_affiliation || "").trim();
  const profilePhotoUrl = String(profileOverrides.profilePhotoUrl || profileOverrides.profile_photo_url || "").trim();
  const institution = overrideAffiliation
    || orcidEmployments[0]?.organization
    || overrideSchool
    || orcidEducations[0]?.organization
    || SYSTEM_INSTITUTION;

  return {
    id: row.id,
    email: row.email || "",
    name: row.full_name || row.email || "",
    role: row.role || "professor",
    status: row.status || "active",
    faculty: row.faculty || "",
    department: row.department || "",
    institution,
    currentAffiliation: institution,
    fieldOfStudy: row.scientific_title || row.academic_title || row.department || row.faculty || "",
    profilePhotoUrl,
    avatarUrl: profilePhotoUrl,
    publicationCount: Number(row.publications_total || 0),
    publicationsTotal: Number(row.publications_total || 0),
    conferenceCount: Number(row.conferences_total || 0),
    conferencesTotal: Number(row.conferences_total || 0),
    citationCount: Number(row.citations_total || 0),
    citationsTotal: Number(row.citations_total || 0),
  };
}

function mapBankAccountRow(row = {}) {
  return {
    id: row.id,
    label: row.label || "",
    bankApplicantName: row.bank_applicant_name || "",
    bankName: row.bank_name || "",
    bankAccountNumber: row.bank_account_number || "",
    iban: row.iban || "",
    swiftCode: row.swift_code || "",
    bankCountry: row.bank_country || "",
    currency: row.currency || "EUR",
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeBankAccountPayload(body = {}) {
  const iban = normalizeIban(body.iban || body.bankAccountNumber || body.bank_account_number);
  const bankAccountNumber = normalizeIban(body.bankAccountNumber || body.bank_account_number || body.iban);

  return {
    label: normalizeText(body.label),
    bankApplicantName: normalizeText(body.bankApplicantName || body.bank_applicant_name),
    bankName: normalizeText(body.bankName || body.bank_name),
    bankAccountNumber,
    iban,
    swiftCode: normalizeText(body.swiftCode || body.swift_code).toUpperCase(),
    bankCountry: normalizeText(body.bankCountry || body.bank_country) || "Kosovë",
    currency: normalizeCurrency(body.currency),
    isDefault: Boolean(body.isDefault ?? body.is_default),
  };
}

function validateBankAccountPayload(payload = {}) {
  const errors = [];

  if (!payload.label) {
    errors.push({ field: "label", message: "Emertimi i llogarise bankare eshte obligativ." });
  }

  if (!payload.bankApplicantName) {
    errors.push({ field: "bankApplicantName", message: "Emri i aplikantit ne banke eshte obligativ." });
  }

  if (!payload.bankName) {
    errors.push({ field: "bankName", message: "Emri i bankes eshte obligativ." });
  }

  if (!payload.bankAccountNumber && !payload.iban) {
    errors.push({ field: "bankAccountNumber", message: "Numri i llogarise bankare ose IBAN eshte obligativ." });
  }

  if (!payload.swiftCode || !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(payload.swiftCode)) {
    errors.push({ field: "swiftCode", message: "SWIFT/BIC kodi duhet te kete 8 ose 11 karaktere valide." });
  }

  return errors;
}

async function clearDefaultBankAccount(client, userId) {
  await client.query(
    `update user_bank_accounts
     set is_default = false,
         updated_at = now()
     where user_id = $1
       and is_default = true
       and archived_at is null`,
    [userId]
  );
}

async function ensureDefaultBankAccount(client, userId) {
  const currentDefault = await client.query(
    `select id
     from user_bank_accounts
     where user_id = $1
       and is_default = true
       and archived_at is null
     limit 1`,
    [userId]
  );

  if (currentDefault.rowCount > 0) {
    return;
  }

  await client.query(
    `update user_bank_accounts
     set is_default = true,
         updated_at = now()
     where id = (
       select id
       from user_bank_accounts
       where user_id = $1
         and archived_at is null
       order by updated_at desc nulls last, created_at desc
       limit 1
     )`,
    [userId]
  );
}

router.get("/community", async (req, res) => {
  try {
    const [result, totalsResult] = await Promise.all([
      db.query(
        `select
           u.id,
           u.email,
           u.full_name,
           u.role,
           u.status,
           u.academic_title,
           u.scientific_title,
           u.faculty,
           u.department,
           u.profile_overrides,
           u.orcid_educations,
           u.orcid_employments,
           coalesce(pub.publications_total, 0)::int as publications_total,
           coalesce(pub.citations_total, 0)::int as citations_total,
           coalesce(conf.conferences_total, 0)::int as conferences_total
         from users u
         left join lateral (
           select
             count(*)::int as publications_total,
             coalesce(sum(${CITATION_COUNT_SQL}), 0)::int as citations_total
           from publications p
           left join publication_metadata m on m.doi = coalesce(p.external_metadata_id, p.doi)
           where p.owner_id = u.id
         ) pub on true
         left join lateral (
           select count(*)::int as conferences_total
           from conferences c
           where c.created_by = u.id
         ) conf on true
         where lower(coalesce(u.role, '')) in ('professor', 'profesor')
           and coalesce(u.status, 'active') = 'active'
         order by
           (coalesce(pub.publications_total, 0) + coalesce(conf.conferences_total, 0) + coalesce(pub.citations_total, 0)) desc,
           u.full_name asc nulls last,
           u.email asc
         limit 24`
      ),
      db.query(
        `select
           (select count(*)::int
            from users u
            where coalesce(u.status, 'active') = 'active'
              and lower(coalesce(u.role, '')) in ('professor', 'profesor')) as academic_staff_total,
           (select count(*)::int from users) as registered_user_total,
           (select count(*)::int from publications) as publication_total,
           (select count(*)::int from conferences) as conference_total,
           (select coalesce(sum(${CITATION_COUNT_SQL}), 0)::int
            from publications p
            left join publication_metadata m on m.doi = coalesce(p.external_metadata_id, p.doi)) as citations_total,
           (select count(distinct nullif(trim(u.faculty), ''))::int
            from users u
            where coalesce(u.status, 'active') = 'active'
              and lower(coalesce(u.role, '')) in ('professor', 'profesor')) as faculty_total`
      ),
    ]);

    const users = result.rows.map(mapCommunityProfessorRow);
    const faculties = new Set(users.map((user) => user.faculty).filter(Boolean));
    const institutions = new Set(users.map((user) => user.institution).filter(Boolean));
    const totals = totalsResult.rows[0] || {};

    res.json({
      users,
      analytics: {
        userSummary: {
          total: Number(totals.registered_user_total || users.length),
          academicStaffTotal: Number(totals.academic_staff_total || users.length),
        },
      },
      registeredUserTotal: Number(totals.registered_user_total || users.length),
      academicStaffTotal: Number(totals.academic_staff_total || users.length),
      publicationTotal: Number(totals.publication_total || 0),
      conferenceTotal: Number(totals.conference_total || 0),
      citationsTotal: Number(totals.citations_total || 0),
      institutionTotal: institutions.size,
      facultyTotal: Number(totals.faculty_total || faculties.size),
    });
  } catch (error) {
    console.error("GET /api/auth/community failed:", error);
    res.status(500).json({
      error: "community_load_failed",
      message: "Komuniteti akademik nuk u ngarkua.",
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
      res.status(401).json({ user: null });
      return;
    }

    const result = await db.query(
      `SELECT id, google_id, orcid_id, email, full_name, role, status, academic_title, scientific_title, faculty, department, office,
              profile_overrides, orcid_profile, orcid_educations, orcid_employments, orcid_last_synced_at
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
      `SELECT id, orcid_id, profile_overrides
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
    const nextSchool = String(req.body?.school || "").trim();
    const nextCurrentAffiliation = String(req.body?.currentAffiliation || req.body?.current_affiliation || "").trim();
    const currentOverrides = currentUser.profile_overrides && typeof currentUser.profile_overrides === "object"
      ? currentUser.profile_overrides
      : {};
    const hasProfilePhotoField = Object.prototype.hasOwnProperty.call(req.body || {}, "profilePhotoUrl")
      || Object.prototype.hasOwnProperty.call(req.body || {}, "profile_photo_url");
    const nextProfilePhotoUrl = hasProfilePhotoField
      ? normalizeProfilePhotoUrl(req.body?.profilePhotoUrl || req.body?.profile_photo_url)
      : String(currentOverrides.profilePhotoUrl || currentOverrides.profile_photo_url || "").trim();
    const nextEducation = Array.isArray(req.body?.education)
      ? req.body.education
      : Array.isArray(req.body?.orcidEducations || req.body?.orcid_educations)
        ? (req.body.orcidEducations || req.body.orcid_educations)
        : currentOverrides.education;
    const nextProfileOverrides = {
      ...currentOverrides,
      school: nextSchool,
      currentAffiliation: nextCurrentAffiliation,
      profilePhotoUrl: nextProfilePhotoUrl,
      education: Array.isArray(nextEducation) ? nextEducation : [],
    };

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
           profile_overrides = $8::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, google_id, orcid_id, email, full_name, role, status, academic_title, scientific_title, faculty, department, office,
                 profile_overrides, orcid_profile, orcid_educations, orcid_employments, orcid_last_synced_at`,
      [
        req.user.id,
        hasOrcidIdentity ? null : (nextName || null),
        nextFaculty || null,
        nextDepartment || null,
        nextOffice || null,
        nextAcademicTitle || null,
        nextScientificTitle || null,
        JSON.stringify(nextProfileOverrides),
      ]
    );

    res.json({ user: mapUserRowToProfile(result.rows[0]) });
  } catch (error) {
    console.error("PUT /api/auth/me failed:", error);
    res.status(error.statusCode || 500).json({
      user: null,
      error: error.message || "profile_save_failed",
    });
  }
});

router.get("/me/bank-accounts", async (req, res) => {
  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
      res.status(401).json({ bankAccounts: [] });
      return;
    }

    const result = await db.query(
      `select id, label, bank_applicant_name, bank_name, bank_account_number, iban,
              swift_code, bank_country, currency, is_default, created_at, updated_at
       from user_bank_accounts
       where user_id = $1
         and archived_at is null
       order by is_default desc, updated_at desc nulls last, created_at desc`,
      [req.user.id]
    );

    res.json({ bankAccounts: result.rows.map(mapBankAccountRow) });
  } catch (error) {
    console.error("GET /api/auth/me/bank-accounts failed:", error);
    res.status(500).json({ bankAccounts: [], error: "bank_accounts_load_failed" });
  }
});

router.post("/me/bank-accounts", async (req, res) => {
  const client = await db.connect();

  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
      res.status(401).json({ bankAccount: null });
      return;
    }

    const payload = normalizeBankAccountPayload(req.body);
    const errors = validateBankAccountPayload(payload);

    if (errors.length) {
      res.status(400).json({ error: "invalid_bank_account", errors });
      return;
    }

    await client.query("begin");

    if (payload.isDefault) {
      await clearDefaultBankAccount(client, req.user.id);
    }

    const result = await client.query(
      `insert into user_bank_accounts
       (user_id, label, bank_applicant_name, bank_name, bank_account_number, iban,
        swift_code, bank_country, currency, is_default)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id, label, bank_applicant_name, bank_name, bank_account_number, iban,
                 swift_code, bank_country, currency, is_default, created_at, updated_at`,
      [
        req.user.id,
        payload.label,
        payload.bankApplicantName,
        payload.bankName,
        payload.bankAccountNumber,
        payload.iban,
        payload.swiftCode,
        payload.bankCountry,
        payload.currency,
        payload.isDefault,
      ]
    );

    if (!payload.isDefault) {
      await ensureDefaultBankAccount(client, req.user.id);
    }

    await client.query("commit");

    res.status(201).json({ bankAccount: mapBankAccountRow(result.rows[0]) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("POST /api/auth/me/bank-accounts failed:", error);
    res.status(500).json({ error: "bank_account_create_failed" });
  } finally {
    client.release();
  }
});

router.put("/me/bank-accounts/:id", async (req, res) => {
  const client = await db.connect();

  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
      res.status(401).json({ bankAccount: null });
      return;
    }

    const bankAccountId = normalizeText(req.params.id);

    if (!UUID_PATTERN.test(bankAccountId)) {
      res.status(400).json({ error: "invalid_bank_account_id" });
      return;
    }

    const payload = normalizeBankAccountPayload(req.body);
    const errors = validateBankAccountPayload(payload);

    if (errors.length) {
      res.status(400).json({ error: "invalid_bank_account", errors });
      return;
    }

    await client.query("begin");

    if (payload.isDefault) {
      await clearDefaultBankAccount(client, req.user.id);
    }

    const result = await client.query(
      `update user_bank_accounts
       set label = $3,
           bank_applicant_name = $4,
           bank_name = $5,
           bank_account_number = $6,
           iban = $7,
           swift_code = $8,
           bank_country = $9,
           currency = $10,
           is_default = $11,
           updated_at = now()
       where id = $1
         and user_id = $2
         and archived_at is null
       returning id, label, bank_applicant_name, bank_name, bank_account_number, iban,
                 swift_code, bank_country, currency, is_default, created_at, updated_at`,
      [
        bankAccountId,
        req.user.id,
        payload.label,
        payload.bankApplicantName,
        payload.bankName,
        payload.bankAccountNumber,
        payload.iban,
        payload.swiftCode,
        payload.bankCountry,
        payload.currency,
        payload.isDefault,
      ]
    );

    if (result.rowCount === 0) {
      await client.query("rollback");
      res.status(404).json({ error: "bank_account_not_found" });
      return;
    }

    if (!payload.isDefault) {
      await ensureDefaultBankAccount(client, req.user.id);
    }

    await client.query("commit");

    res.json({ bankAccount: mapBankAccountRow(result.rows[0]) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("PUT /api/auth/me/bank-accounts/:id failed:", error);
    res.status(500).json({ error: "bank_account_update_failed" });
  } finally {
    client.release();
  }
});

router.delete("/me/bank-accounts/:id", async (req, res) => {
  const client = await db.connect();

  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
      res.status(401).json({ deleted: false });
      return;
    }

    const bankAccountId = normalizeText(req.params.id);

    if (!UUID_PATTERN.test(bankAccountId)) {
      res.status(400).json({ error: "invalid_bank_account_id" });
      return;
    }

    await client.query("begin");

    const result = await client.query(
      `update user_bank_accounts
       set archived_at = now(),
           is_default = false,
           updated_at = now()
       where id = $1
         and user_id = $2
         and archived_at is null
       returning id`,
      [bankAccountId, req.user.id]
    );

    if (result.rowCount === 0) {
      await client.query("rollback");
      res.status(404).json({ error: "bank_account_not_found" });
      return;
    }

    await ensureDefaultBankAccount(client, req.user.id);
    await client.query("commit");

    res.json({ deleted: true });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("DELETE /api/auth/me/bank-accounts/:id failed:", error);
    res.status(500).json({ error: "bank_account_delete_failed" });
  } finally {
    client.release();
  }
});

router.patch("/me/bank-accounts/:id/default", async (req, res) => {
  const client = await db.connect();

  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
      res.status(401).json({ bankAccount: null });
      return;
    }

    const bankAccountId = normalizeText(req.params.id);

    if (!UUID_PATTERN.test(bankAccountId)) {
      res.status(400).json({ error: "invalid_bank_account_id" });
      return;
    }

    await client.query("begin");
    await clearDefaultBankAccount(client, req.user.id);

    const result = await client.query(
      `update user_bank_accounts
       set is_default = true,
           updated_at = now()
       where id = $1
         and user_id = $2
         and archived_at is null
       returning id, label, bank_applicant_name, bank_name, bank_account_number, iban,
                 swift_code, bank_country, currency, is_default, created_at, updated_at`,
      [bankAccountId, req.user.id]
    );

    if (result.rowCount === 0) {
      await client.query("rollback");
      res.status(404).json({ error: "bank_account_not_found" });
      return;
    }

    await client.query("commit");

    res.json({ bankAccount: mapBankAccountRow(result.rows[0]) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("PATCH /api/auth/me/bank-accounts/:id/default failed:", error);
    res.status(500).json({ error: "bank_account_default_failed" });
  } finally {
    client.release();
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

    req.logIn(user, async (loginError) => {
      if (loginError) {
        console.error("Creating session after Google login failed:", loginError);
        redirectToLoginWithError(res, "session_login_failed", req);
        return;
      }

      const dashboardRoute = DASHBOARD_BY_ROLE[user.role] || PROFESSOR_DASHBOARD_ROUTE;

      try {
        await updateLastLoginAt(user.id);
        if (user.role === "admin") {
          await writeAuditLog({
            actor: user,
            action: "admin.auth.login",
            entityType: "user",
            entityId: user.id,
            ipAddress: getRequestIp(req),
            metadata: {
              target: {
                id: user.id,
                email: user.email,
                name: user.name || user.displayName || user.email || "",
              },
            },
          });
        }
      } catch (lastLoginError) {
        console.warn("Updating last_login_at after login failed:", {
          userId: user.id,
          message: lastLoginError?.message,
        });
      }

      console.log("LOGIN SUCCESS");
      res.redirect(`${getClientUrl(req)}${dashboardRoute}`);
    });
  })(req, res, next);
});

export default router;
