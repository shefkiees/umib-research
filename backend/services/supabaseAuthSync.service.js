import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import db from "../config/db.js";

const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_REDIRECT_PATH = "/auth/reset-password";
const SUPPORTED_MODES = new Set(["invite", "temporary-password"]);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getPasswordResetRedirectUrl() {
  return (
    process.env.SUPABASE_PASSWORD_RESET_REDIRECT_URL ||
    process.env.VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL ||
    `${process.env.CLIENT_URL || ""}${DEFAULT_REDIRECT_PATH}`
  );
}

function validateRedirectUrl(value) {
  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol) && url.pathname === DEFAULT_REDIRECT_PATH;
  } catch {
    return false;
  }
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

function sanitizeSupabaseError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    status: error.status,
    code: error.code,
  };
}

function generateTemporaryPassword() {
  return `${crypto.randomBytes(18).toString("base64url")}aA1!`;
}

async function loadDatabaseUsers({ roles }) {
  const normalizedRoles = Array.isArray(roles)
    ? roles.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const params = [];
  let roleFilter = "";

  if (normalizedRoles.length) {
    params.push(normalizedRoles);
    roleFilter = `and lower(role) = any($${params.length}::text[])`;
  }

  const result = await db.query(
    `select id, email, full_name, role, auth_user_id
     from users
     where email is not null
       and btrim(email) <> ''
       ${roleFilter}
     order by created_at asc, email asc`,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: normalizeEmail(row.email),
    fullName: row.full_name || "",
    role: row.role || "professor",
    authUserId: row.auth_user_id || null,
  }));
}

async function loadSupabaseAuthUsers(supabaseAdmin) {
  const usersByEmail = new Map();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: DEFAULT_PAGE_SIZE,
    });

    if (error) {
      throw error;
    }

    const users = Array.isArray(data?.users) ? data.users : [];

    users.forEach((user) => {
      const email = normalizeEmail(user.email);

      if (email && !usersByEmail.has(email)) {
        usersByEmail.set(email, user);
      }
    });

    if (users.length < DEFAULT_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return usersByEmail;
}

async function updateLocalAuthUserId(userId, authUserId) {
  await db.query(
    `update users
     set auth_user_id = $2,
         updated_at = now()
     where id = $1
       and auth_user_id is distinct from $2`,
    [userId, authUserId]
  );
}

async function createMissingAuthUser({ supabaseAdmin, user, mode, redirectTo }) {
  if (mode === "temporary-password") {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: generateTemporaryPassword(),
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName,
        app_role: user.role,
        local_user_id: user.id,
      },
    });

    return { data, error, delivery: "temporary-password-created" };
  }

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(user.email, {
    data: {
      full_name: user.fullName,
      app_role: user.role,
      local_user_id: user.id,
    },
    redirectTo,
  });

  return { data, error, delivery: "invite-email-sent" };
}

export async function syncMissingSupabaseAuthUsers(options = {}) {
  const dryRun = options.dryRun !== false;
  const mode = SUPPORTED_MODES.has(options.mode) ? options.mode : "invite";
  const roles = Array.isArray(options.roles) && options.roles.length
    ? options.roles
    : ["professor", "committee", "prorector", "admin"];
  const redirectTo = getPasswordResetRedirectUrl();

  if (!validateRedirectUrl(redirectTo)) {
    throw new Error("invalid_supabase_password_reset_redirect_url");
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const [databaseUsers, authUsersByEmail] = await Promise.all([
    loadDatabaseUsers({ roles }),
    loadSupabaseAuthUsers(supabaseAdmin),
  ]);

  const summary = {
    dryRun,
    mode,
    redirectTo,
    scanned: databaseUsers.length,
    created: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  for (const user of databaseUsers) {
    if (!isValidEmail(user.email)) {
      summary.skipped += 1;
      summary.results.push({
        email: user.email,
        role: user.role,
        status: "skipped",
        reason: "invalid_email",
      });
      continue;
    }

    const existingAuthUser = authUsersByEmail.get(user.email);

    if (existingAuthUser) {
      summary.skipped += 1;
      summary.results.push({
        email: user.email,
        role: user.role,
        status: "skipped",
        reason: "auth_user_exists",
        authUserId: existingAuthUser.id,
      });

      if (!dryRun && existingAuthUser.id && user.authUserId !== existingAuthUser.id) {
        await updateLocalAuthUserId(user.id, existingAuthUser.id);
      }

      continue;
    }

    if (dryRun) {
      summary.skipped += 1;
      summary.results.push({
        email: user.email,
        role: user.role,
        status: "would_create",
        delivery: mode,
      });
      continue;
    }

    const { data, error, delivery } = await createMissingAuthUser({
      supabaseAdmin,
      user,
      mode,
      redirectTo,
    });

    if (error) {
      summary.failed += 1;
      summary.results.push({
        email: user.email,
        role: user.role,
        status: "failed",
        error: sanitizeSupabaseError(error),
      });
      continue;
    }

    const authUserId = data?.user?.id;

    if (authUserId) {
      await updateLocalAuthUserId(user.id, authUserId);
    }

    summary.created += 1;
    summary.results.push({
      email: user.email,
      role: user.role,
      status: "created",
      authUserId,
      delivery,
    });
  }

  console.info("Supabase Auth user sync summary", {
    dryRun: summary.dryRun,
    mode: summary.mode,
    scanned: summary.scanned,
    created: summary.created,
    skipped: summary.skipped,
    failed: summary.failed,
  });

  return summary;
}
