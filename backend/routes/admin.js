import express from "express";
import PDFDocument from "pdfkit";
import db from "../config/db.js";
import { syncMissingSupabaseAuthUsers } from "../services/supabaseAuthSync.service.js";
import { getRequestIp, writeAuditLog } from "../services/auditLog.service.js";

const router = express.Router();
const ACCESS_RESET_STATUSES = new Set(["pending", "in_progress", "completed", "rejected"]);
const USER_ROLES = new Set(["admin", "committee", "professor", "prorector"]);
const USER_STATUSES = new Set(["active", "inactive", "suspended"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLICATION_REVIEW_ACTIONS = new Set(["approve", "reject", "request_changes"]);

const SYSTEM_SETTINGS_DEFAULTS = {
  reviewSlaDays: 14,
  reimbursementLimits: { Q1: 800, Q2: 600, Q3: 400, Q4: 250 },
  allowedFileTypes: ["pdf", "doc", "docx", "xlsx", "png", "jpg"],
  maxUploadMb: 20,
  defaultLanguage: "sq",
  notificationsEnabled: true,
  maintenanceMode: false,
};

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.full_name || row.email || "",
    role: row.role || "professor",
    status: row.status || "active",
    faculty: row.faculty || "",
    department: row.department || "",
    office: row.office || "",
    lastLoginAt: row.last_login_at,
    last_login_at: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const AUDIT_ACTION_LABELS = {
  "admin.auth.login": "Kyçje e adminit",
  "admin.access.unauthenticated": "Tentim qasjeje pa login",
  "admin.access.forbidden": "Tentim qasjeje pa leje",
  "admin.user.role_update": "Ndryshim roli",
  "admin.user.status_update": "Ndryshim statusi",
  "admin.access_reset.status_update": "Ndryshim konfigurimi qasjeje",
};

function mapAuditLog(row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const actor = metadata.actor || {};
  const target = metadata.target || {};
  const isFailedAccess = row.action === "admin.access.unauthenticated" || row.action === "admin.access.forbidden";

  return {
    id: row.id,
    action: row.action,
    actionLabel: AUDIT_ACTION_LABELS[row.action] || row.action,
    entityType: row.entity_type || "",
    entityId: row.entity_id || "",
    oldValue: metadata.oldValue ?? metadata.previousRole ?? metadata.previousStatus ?? metadata.previousValue ?? "",
    newValue: metadata.newValue ?? metadata.role ?? metadata.status ?? metadata.value ?? "",
    status: metadata.auditStatus || (isFailedAccess ? "failed" : "success"),
    ipAddress: metadata.ipAddress || "",
    details: metadata,
    createdAt: row.created_at,
    admin: {
      id: row.actor_id || actor.id || "",
      email: row.actor_email || actor.email || "",
      name: row.actor_name || actor.name || row.actor_email || actor.email || "",
    },
    target: {
      id: target.id || row.entity_id || "",
      email: target.email || metadata.email || "",
      name: target.name || metadata.name || target.email || metadata.email || "",
      type: row.entity_type || "",
    },
  };
}

function mapJournal(row) {
  return {
    id: row.id,
    issn: row.issn || "",
    name: row.name || "",
    publisher: row.publisher || "",
    quartile: row.quartile || "",
    wosCategory: row.wos_category || "",
    ceeol: Boolean(row.ceeol),
    isPredatory: Boolean(row.is_predatory),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPublicationReview(row) {
  const statusLabels = {
    submitted: "Në pritje",
    in_review: "Në pritje",
    approved: "Aprovuar",
    rejected: "Refuzuar",
    needs_correction: "Kthyer për përmirësim",
  };

  return {
    id: row.id,
    title: row.title || "",
    author: row.owner_name || row.owner_email || "",
    faculty: row.faculty || "",
    type: row.publication_type || "",
    status: row.status || "",
    statusLabel: statusLabels[row.status] || row.status || "",
    submittedAt: row.updated_at || row.created_at,
    documentUrl: row.source_url || "",
    comment: row.latest_comment || "",
  };
}

function parseCsvRows(csvText) {
  return String(csvText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1)
    .map((line) => {
      const [issn = "", name = "", publisher = "", quartile = "", wosCategory = "", ceeol = "", isPredatory = ""] = line
        .split(",")
        .map((value) => value.trim().replace(/^"|"$/g, ""));

      return {
        issn,
        name,
        publisher,
        quartile,
        wosCategory,
        ceeol: /^(po|true|1|yes)$/i.test(ceeol),
        isPredatory: /^(po|true|1|yes)$/i.test(isPredatory),
      };
    })
    .filter((row) => row.name);
}

async function requireAdmin(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    await writeAuditLog({
      action: "admin.access.unauthenticated",
      entityType: "admin_route",
      entityId: req.originalUrl,
      ipAddress: getRequestIp(req),
      metadata: {
        auditStatus: "failed",
        method: req.method,
        path: req.originalUrl,
      },
    });
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  if (req.user.role !== "admin") {
    await writeAuditLog({
      actor: req.user,
      action: "admin.access.forbidden",
      entityType: "admin_route",
      entityId: req.originalUrl,
      ipAddress: getRequestIp(req),
      metadata: {
        auditStatus: "failed",
        method: req.method,
        path: req.originalUrl,
        role: req.user.role,
      },
    });
    res.status(403).json({ error: "forbidden" });
    return;
  }

  next();
}

router.post("/auth-sync", requireAdmin, async (req, res) => {
  try {
    const summary = await syncMissingSupabaseAuthUsers({
      dryRun: req.body?.dryRun !== false,
      mode: req.body?.mode,
      roles: req.body?.roles,
    });

    res.json(summary);
  } catch (error) {
    console.error("POST /api/admin/auth-sync failed:", {
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });
    res.status(500).json({
      error: "auth_sync_failed",
      message: error?.message || "Auth sync failed.",
    });
  }
});

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `select id, email, full_name, role, status, faculty, department, office, last_login_at, created_at, updated_at
       from users
       order by created_at desc, email asc`
    );

    res.json({ users: result.rows.map(mapUser) });
  } catch (error) {
    console.error("GET /api/admin/users failed:", error);
    res.status(500).json({
      error: "admin_users_failed",
      message: "Perdoruesit nuk u ngarkuan.",
    });
  }
});

router.get("/audit-logs", requireAdmin, async (req, res) => {
  try {
    const params = [];
    const filters = [];
    const action = String(req.query.action || "").trim();
    const adminEmail = String(req.query.adminEmail || req.query.admin || "").trim().toLowerCase();
    const targetEmail = String(req.query.targetEmail || req.query.target || "").trim().toLowerCase();
    const startDate = String(req.query.startDate || "").trim();
    const endDate = String(req.query.endDate || "").trim();

    if (action) {
      params.push(action);
      filters.push(`al.action = $${params.length}`);
    }

    if (adminEmail) {
      params.push(`%${adminEmail}%`);
      filters.push(`lower(coalesce(actor.email, al.metadata #>> '{actor,email}', '')) like $${params.length}`);
    }

    if (targetEmail) {
      params.push(`%${targetEmail}%`);
      filters.push(`lower(coalesce(target.email, al.metadata ->> 'email', al.metadata #>> '{target,email}', '')) like $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      filters.push(`al.created_at >= $${params.length}::timestamptz`);
    }

    if (endDate) {
      params.push(endDate);
      filters.push(`al.created_at < ($${params.length}::date + interval '1 day')`);
    }

    const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";
    const result = await db.query(
      `select al.id,
              al.actor_id,
              al.action,
              al.entity_type,
              al.entity_id,
              al.metadata,
              al.created_at,
              actor.email as actor_email,
              actor.full_name as actor_name,
              target.email as target_email,
              target.full_name as target_name
       from audit_logs al
       left join users actor on actor.id = al.actor_id
       left join users target on al.entity_type = 'user' and target.id::text = al.entity_id
       ${whereClause}
       order by al.created_at desc
       limit 200`,
      params
    );

    res.json({
      logs: result.rows.map((row) =>
        mapAuditLog({
          ...row,
          metadata: {
            ...(row.metadata || {}),
            target: {
              id: row.entity_id || "",
              email: row.target_email || row.metadata?.email || row.metadata?.target?.email || "",
              name: row.target_name || row.metadata?.target?.name || row.metadata?.email || "",
            },
          },
        })
      ),
      actions: Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })),
    });
  } catch (error) {
    console.error("GET /api/admin/audit-logs failed:", error);
    res.status(500).json({
      error: "audit_logs_failed",
      message: "Historiku i veprimeve nuk u ngarkua.",
    });
  }
});

router.patch("/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.id || "").trim();
    const role = String(req.body?.role || "").trim().toLowerCase();

    if (!UUID_PATTERN.test(userId)) {
      res.status(400).json({ error: "invalid_user_id", message: "Perdoruesi nuk eshte valid." });
      return;
    }

    if (!USER_ROLES.has(role)) {
      res.status(400).json({ error: "invalid_role", message: "Roli nuk eshte valid." });
      return;
    }

    const currentResult = await db.query(
      `select id, email, full_name, role, status, faculty, department, office, last_login_at, created_at, updated_at
       from users
       where id = $1
       limit 1`,
      [userId]
    );

    if (currentResult.rowCount === 0) {
      res.status(404).json({ error: "not_found", message: "Perdoruesi nuk u gjet." });
      return;
    }

    const currentUser = currentResult.rows[0];

    if (currentUser.id === req.user.id && currentUser.role === "admin" && role !== "admin") {
      res.status(400).json({
        error: "cannot_change_own_admin_role",
        message: "Nuk mund ta largoni rolin admin nga llogaria juaj.",
      });
      return;
    }

    const result = await db.query(
      `update users
       set role = $2,
           updated_at = now()
       where id = $1
       returning id, email, full_name, role, status, faculty, department, office, last_login_at, created_at, updated_at`,
      [userId, role]
    );

    await writeAuditLog({
      actor: req.user,
      action: "admin.user.role_update",
      entityType: "user",
      entityId: userId,
      oldValue: currentUser.role,
      newValue: role,
      ipAddress: getRequestIp(req),
      metadata: {
        target: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.full_name || currentUser.email || "",
        },
        previousRole: currentUser.role,
        role,
      },
    });

    res.json({ user: mapUser(result.rows[0]) });
  } catch (error) {
    console.error("PATCH /api/admin/users/:id/role failed:", error);
    res.status(500).json({
      error: "admin_user_role_update_failed",
      message: "Roli nuk u perditesua.",
    });
  }
});

router.patch("/users/:id/status", requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.id || "").trim();
    const status = String(req.body?.status || "").trim().toLowerCase();

    if (!UUID_PATTERN.test(userId)) {
      res.status(400).json({ error: "invalid_user_id", message: "Perdoruesi nuk eshte valid." });
      return;
    }

    if (!USER_STATUSES.has(status)) {
      res.status(400).json({ error: "invalid_status", message: "Statusi nuk eshte valid." });
      return;
    }

    const currentResult = await db.query(
      `select id, email, full_name, role, status, faculty, department, office, last_login_at, created_at, updated_at
       from users
       where id = $1
       limit 1`,
      [userId]
    );

    if (currentResult.rowCount === 0) {
      res.status(404).json({ error: "not_found", message: "Perdoruesi nuk u gjet." });
      return;
    }

    const currentUser = currentResult.rows[0];

    if (currentUser.id === req.user.id && status !== "active") {
      res.status(400).json({
        error: "cannot_deactivate_self",
        message: "Nuk mund ta deaktivizoni llogarine tuaj.",
      });
      return;
    }

    const result = await db.query(
      `update users
       set status = $2,
           updated_at = now()
       where id = $1
       returning id, email, full_name, role, status, faculty, department, office, last_login_at, created_at, updated_at`,
      [userId, status]
    );

    await writeAuditLog({
      actor: req.user,
      action: "admin.user.status_update",
      entityType: "user",
      entityId: userId,
      oldValue: currentUser.status || "active",
      newValue: status,
      ipAddress: getRequestIp(req),
      metadata: {
        target: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.full_name || currentUser.email || "",
        },
        previousStatus: currentUser.status || "active",
        status,
      },
    });

    res.json({ user: mapUser(result.rows[0]) });
  } catch (error) {
    console.error("PATCH /api/admin/users/:id/status failed:", error);
    res.status(500).json({
      error: "admin_user_status_update_failed",
      message: "Statusi nuk u perditesua.",
    });
  }
});

router.get("/access-reset-requests", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `select arr.id,
              arr.user_id,
              arr.requested_email,
              arr.status,
              arr.requester_ip,
              arr.handled_by,
              arr.handled_at,
              arr.notes,
              arr.requested_at,
              arr.updated_at,
              u.full_name,
              u.role,
              u.faculty,
              handler.full_name as handled_by_name
       from access_reset_requests arr
       left join users u on u.id = arr.user_id
       left join users handler on handler.id = arr.handled_by
       order by arr.requested_at desc
       limit 100`
    );

    res.json({
      requests: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        email: row.requested_email,
        status: row.status,
        requesterIp: row.requester_ip,
        requestedAt: row.requested_at,
        updatedAt: row.updated_at,
        handledAt: row.handled_at,
        handledBy: row.handled_by,
        handledByName: row.handled_by_name,
        notes: row.notes || "",
        user: row.user_id
          ? {
              id: row.user_id,
              name: row.full_name || row.requested_email,
              role: row.role || "",
              faculty: row.faculty || "",
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/access-reset-requests failed:", error);
    res.status(500).json({
      error: "access_reset_requests_failed",
      message: "Kerkesat nuk u ngarkuan.",
    });
  }
});

router.patch("/access-reset-requests/:id", requireAdmin, async (req, res) => {
  try {
    const requestId = Number.parseInt(req.params.id, 10);
    const status = String(req.body?.status || "").trim();
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : null;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      res.status(400).json({ error: "invalid_request_id", message: "Kerkesa nuk eshte valide." });
      return;
    }

    if (!ACCESS_RESET_STATUSES.has(status)) {
      res.status(400).json({ error: "invalid_status", message: "Statusi nuk eshte valid." });
      return;
    }

    const currentResult = await db.query(
      `select id, status
       from access_reset_requests
       where id = $1
       limit 1`,
      [requestId]
    );

    if (currentResult.rowCount === 0) {
      res.status(404).json({ error: "not_found", message: "Kerkesa nuk u gjet." });
      return;
    }

    const previousStatus = currentResult.rows[0].status;

    const result = await db.query(
      `update access_reset_requests
       set status = $2,
           notes = coalesce($3, notes),
           handled_by = case when $2 in ('completed', 'rejected') then $4 else handled_by end,
           handled_at = case when $2 in ('completed', 'rejected') then now() else handled_at end,
           updated_at = now()
       where id = $1
       returning id, user_id, requested_email, status, requester_ip, handled_by, handled_at, notes, requested_at, updated_at`,
      [requestId, status, notes, req.user.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found", message: "Kerkesa nuk u gjet." });
      return;
    }

    const row = result.rows[0];
    await writeAuditLog({
      actor: req.user,
      action: "admin.access_reset.status_update",
      entityType: "access_reset_request",
      entityId: row.id,
      oldValue: previousStatus,
      newValue: row.status,
      ipAddress: getRequestIp(req),
      metadata: {
        target: {
          id: row.user_id || "",
          email: row.requested_email,
          name: row.requested_email,
        },
        previousStatus,
        status: row.status,
      },
    });

    res.json({
      request: {
        id: row.id,
        userId: row.user_id,
        email: row.requested_email,
        status: row.status,
        requesterIp: row.requester_ip,
        handledBy: row.handled_by,
        handledAt: row.handled_at,
        notes: row.notes || "",
        requestedAt: row.requested_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/access-reset-requests/:id failed:", error);
    res.status(500).json({
      error: "access_reset_request_update_failed",
      message: "Kerkesa nuk u perditesua.",
    });
  }
});

router.get("/notifications", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `select n.id, n.title, n.message, n.category, n.is_read, n.created_at, u.email as user_email, u.full_name as user_name
       from notifications n
       left join users u on u.id = n.user_id
       where n.user_id = $1 or n.user_id is null
       order by n.created_at desc
       limit 150`,
      [req.user.id]
    );

    const accessResult = await db.query(
      `select id, action, metadata, created_at
       from audit_logs
       where action in ('admin.access.unauthenticated', 'admin.access.forbidden')
       order by created_at desc
       limit 25`
    );

    const notifications = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      category: row.category || "Sistemi",
      isRead: Boolean(row.is_read),
      createdAt: row.created_at,
      user: row.user_name || row.user_email || "",
      source: "notification",
    }));

    const accessNotifications = accessResult.rows.map((row) => ({
      id: `audit-${row.id}`,
      title: "Tentim qasjeje pa leje",
      message: row.metadata?.path ? `Tentim qasjeje në ${row.metadata.path}` : "U regjistrua tentim qasjeje në panelin admin.",
      category: "Siguria",
      isRead: true,
      createdAt: row.created_at,
      user: row.metadata?.actor?.email || "",
      source: "audit",
    }));

    res.json({ notifications: [...notifications, ...accessNotifications] });
  } catch (error) {
    console.error("GET /api/admin/notifications failed:", error);
    res.status(500).json({ error: "notifications_failed", message: "Njoftimet nuk u ngarkuan." });
  }
});

router.patch("/notifications/:id/read", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();

    if (!UUID_PATTERN.test(id)) {
      res.status(400).json({ error: "invalid_notification_id", message: "Njoftimi nuk është valid." });
      return;
    }

    await db.query(
      `update notifications
       set is_read = true
       where id = $1 and (user_id = $2 or user_id is null)`,
      [id, req.user.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/notifications/:id/read failed:", error);
    res.status(500).json({ error: "notification_update_failed", message: "Njoftimi nuk u përditësua." });
  }
});

router.patch("/notifications/read-all", requireAdmin, async (req, res) => {
  try {
    await db.query(
      `update notifications
       set is_read = true
       where user_id = $1 or user_id is null`,
      [req.user.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/notifications/read-all failed:", error);
    res.status(500).json({ error: "notifications_update_failed", message: "Njoftimet nuk u përditësuan." });
  }
});

router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const [
      userSummary,
      usersByRole,
      usersByFaculty,
      usersByDepartment,
      recentLogins,
      accessSummary,
      recentAdminChanges,
      adminActivity,
    ] = await Promise.all([
      db.query(
        `select
           count(*)::int as total,
           count(*) filter (where coalesce(status, 'active') = 'active')::int as active,
           count(*) filter (where coalesce(status, 'active') = 'inactive')::int as inactive,
           count(*) filter (where coalesce(status, 'active') = 'suspended')::int as suspended
         from users`
      ),
      db.query(
        `select coalesce(nullif(role, ''), 'professor') as role, count(*)::int as count
         from users
         group by 1
         order by count desc, role asc`
      ),
      db.query(
        `select coalesce(nullif(faculty, ''), 'Pa fakultet') as faculty, count(*)::int as count
         from users
         group by 1
         order by count desc, faculty asc`
      ),
      db.query(
        `select coalesce(nullif(department, ''), 'Pa departament') as department, count(*)::int as count
         from users
         group by 1
         order by count desc, department asc
         limit 12`
      ),
      db.query(
        `select id, email, full_name, role, faculty, last_login_at
         from users
         where last_login_at is not null
         order by last_login_at desc
         limit 8`
      ),
      db.query(
        `select
           count(*) filter (where action = 'admin.access.unauthenticated')::int as unauthenticated,
           count(*) filter (where action = 'admin.access.forbidden')::int as forbidden
         from audit_logs
         where action in ('admin.access.unauthenticated', 'admin.access.forbidden')`
      ),
      db.query(
        `select al.id,
                al.action,
                al.entity_type,
                al.entity_id,
                al.created_at,
                coalesce(u.email, al.metadata->'actor'->>'email', 'Admin') as admin_email,
                coalesce(u.full_name, al.metadata->'actor'->>'name', u.email, al.metadata->'actor'->>'email', 'Admin') as admin_name,
                coalesce(al.metadata->'target'->>'name', al.metadata->'target'->>'email', al.entity_id, '-') as target_label
         from audit_logs al
         left join users u on u.id = al.actor_id
         where al.action like 'admin.%'
         order by al.created_at desc
         limit 8`
      ),
      db.query(
        `select coalesce(u.full_name, u.email, al.metadata->'actor'->>'name', al.metadata->'actor'->>'email', 'Admin') as admin_name,
                count(*)::int as count
         from audit_logs al
         left join users u on u.id = al.actor_id
         where al.action like 'admin.%' and al.created_at >= now() - interval '30 days'
         group by 1
         order by count desc
         limit 8`
      ),
    ]);

    const summary = userSummary.rows[0] || {};
    const access = accessSummary.rows[0] || {};

    res.json({
      userSummary: {
        total: summary.total || 0,
        active: summary.active || 0,
        inactive: summary.inactive || 0,
        suspended: summary.suspended || 0,
      },
      usersByRole: usersByRole.rows.map((row) => ({ role: row.role, count: row.count })),
      usersByFaculty: usersByFaculty.rows.map((row) => ({ faculty: row.faculty, count: row.count })),
      usersByDepartment: usersByDepartment.rows.map((row) => ({ department: row.department, count: row.count })),
      recentLogins: recentLogins.rows.map((row) => ({
        id: row.id,
        name: row.full_name || row.email || "-",
        email: row.email || "-",
        role: row.role || "-",
        faculty: row.faculty || "-",
        lastLoginAt: row.last_login_at,
      })),
      accessAttempts: {
        unauthenticated: access.unauthenticated || 0,
        forbidden: access.forbidden || 0,
        total: Number(access.unauthenticated || 0) + Number(access.forbidden || 0),
      },
      recentAdminChanges: recentAdminChanges.rows.map((row) => ({
        id: row.id,
        action: row.action,
        actionLabel: AUDIT_ACTION_LABELS[row.action] || row.action,
        adminName: row.admin_name,
        adminEmail: row.admin_email,
        target: row.target_label,
        createdAt: row.created_at,
      })),
      adminActivity: adminActivity.rows.map((row) => ({ adminName: row.admin_name, count: row.count })),
    });
  } catch (error) {
    console.error("GET /api/admin/analytics failed:", error);
    res.status(500).json({ error: "analytics_failed", message: "Analitika nuk u ngarkua." });
  }
});

async function checkExternalService({ url, headers, configured = true }) {
  if (!configured) {
    return { status: "Nuk ka të dhëna", checkedAt: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "UMIBRes/1.0",
        ...(headers || {}),
      },
      signal: controller.signal,
    });

    return { status: response.ok ? "Aktiv" : "Problem", checkedAt };
  } catch (error) {
    return { status: "Problem", checkedAt };
  } finally {
    clearTimeout(timeout);
  }
}

router.get("/integrations/status", requireAdmin, async (req, res) => {
  const [orcid, crossref, scopus, email] = await Promise.all([
    checkExternalService({
      url: "https://pub.orcid.org/v3.0/0000-0002-1825-0097/person",
      headers: { Accept: "application/json" },
    }),
    checkExternalService({
      url: "https://api.crossref.org/works?rows=0",
    }),
    checkExternalService({
      url: "https://api.elsevier.com/content/serial/title?count=1",
      configured: Boolean(process.env.SCOPUS_API_KEY || process.env.ELSEVIER_API_KEY),
      headers: {
        "X-ELS-APIKey": process.env.SCOPUS_API_KEY || process.env.ELSEVIER_API_KEY || "",
        ...(process.env.SCOPUS_INST_TOKEN || process.env.ELSEVIER_INST_TOKEN
          ? { "X-ELS-Insttoken": process.env.SCOPUS_INST_TOKEN || process.env.ELSEVIER_INST_TOKEN }
          : {}),
      },
    }),
    checkExternalService({
      url: "https://api.resend.com/domains",
      configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}` },
    }),
  ]);

  const integrations = [
    {
      id: "orcid",
      name: "ORCID",
      status: orcid.status,
      description: "Importimi dhe verifikimi i profilit të hulumtuesit",
      checkedAt: orcid.checkedAt,
    },
    {
      id: "crossref",
      name: "CrossRef",
      status: crossref.status,
      description: "Verifikimi i DOI dhe marrja e metadatave",
      checkedAt: crossref.checkedAt,
    },
    {
      id: "scopus-wos",
      name: "Scopus / WoS",
      status: scopus.status,
      description: "Metrikat, citimet dhe klasifikimi i revistave",
      checkedAt: scopus.checkedAt,
    },
    {
      id: "email",
      name: "Microsoft 365 / Email",
      status: email.status,
      description: "Dërgimi i njoftimeve dhe komunikimi institucional",
      checkedAt: email.checkedAt,
    },
  ];

  res.json({ integrations });
});

router.get("/system-status", requireAdmin, async (req, res) => {
  const checkedAt = new Date().toISOString();
  const services = [
    {
      id: "api",
      name: "API",
      status: "Online",
      description: "Shërbimet kryesore të backend-it",
      checkedAt,
    },
  ];

  try {
    const result = await db.query(`select now() as checked_at`);
    services.push({
      id: "database",
      name: "Databaza",
      status: "Online",
      description: "Lidhja dhe përgjigjja e databazës",
      checkedAt: result.rows[0]?.checked_at || checkedAt,
    });
  } catch (error) {
    services.push({
      id: "database",
      name: "Databaza",
      status: "Problem",
      description: "Lidhja dhe përgjigjja e databazës",
      checkedAt,
    });
  }

  services.push(
    {
      id: "email",
      name: "Email",
      status: "Nuk ka të dhëna",
      description: "Dërgimi i emailave dhe njoftimeve",
      checkedAt: null,
    },
    {
      id: "storage",
      name: "Ruajtja e fajllave",
      status: "Nuk ka të dhëna",
      description: "Dokumentet, faturat dhe fajllat e ngarkuar",
      checkedAt: null,
    },
    {
      id: "uploads",
      name: "Ngarkimet",
      status: "Nuk ka të dhëna",
      description: "Procesimi i fajllave nga përdoruesit",
      checkedAt: null,
    },
    {
      id: "errors",
      name: "Gabimet e fundit",
      status: "Nuk ka të dhëna",
      description: "Gabimet e regjistruara në sistem",
      checkedAt: null,
    }
  );

  res.json({ services });
});

router.get("/journals", requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search || "").trim().toLowerCase();
    const params = [];
    let whereClause = "";

    if (search) {
      params.push(`%${search}%`);
      whereClause = `where lower(name) like $1 or lower(issn) like $1 or lower(publisher) like $1`;
    }

    const result = await db.query(
      `select id, issn, name, publisher, quartile, wos_category, ceeol, is_predatory, created_at, updated_at
       from admin_journals
       ${whereClause}
       order by updated_at desc, name asc
       limit 200`,
      params
    );

    res.json({ journals: result.rows.map(mapJournal) });
  } catch (error) {
    console.error("GET /api/admin/journals failed:", error);
    res.status(500).json({ error: "journals_failed", message: "Revistat nuk u ngarkuan." });
  }
});

router.post("/journals", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const issn = String(req.body?.issn || "").trim();
    const publisher = String(req.body?.publisher || "").trim();
    const quartile = String(req.body?.quartile || "").trim();
    const wosCategory = String(req.body?.wosCategory || req.body?.wos_category || "").trim();
    const ceeol = Boolean(req.body?.ceeol);
    const isPredatory = Boolean(req.body?.isPredatory || req.body?.is_predatory);

    if (!name) {
      res.status(400).json({ error: "invalid_journal", message: "Emri i revistës është i detyrueshëm." });
      return;
    }

    const result = await db.query(
      `insert into admin_journals (issn, name, publisher, quartile, wos_category, ceeol, is_predatory, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, issn, name, publisher, quartile, wos_category, ceeol, is_predatory, created_at, updated_at`,
      [issn, name, publisher, quartile, wosCategory, ceeol, isPredatory, req.user.id]
    );

    await writeAuditLog({
      actor: req.user,
      action: "admin.journal.create",
      entityType: "journal",
      entityId: result.rows[0].id,
      newValue: name,
      ipAddress: getRequestIp(req),
      metadata: { target: { id: result.rows[0].id, name } },
    });

    res.status(201).json({ journal: mapJournal(result.rows[0]) });
  } catch (error) {
    console.error("POST /api/admin/journals failed:", error);
    res.status(500).json({ error: "journal_create_failed", message: "Revista nuk u ruajt." });
  }
});

router.patch("/journals/:id", requireAdmin, async (req, res) => {
  try {
    const journalId = String(req.params.id || "").trim();

    if (!UUID_PATTERN.test(journalId)) {
      res.status(400).json({ error: "invalid_journal_id", message: "Revista nuk është valide." });
      return;
    }

    const name = String(req.body?.name || "").trim();
    const issn = String(req.body?.issn || "").trim();
    const publisher = String(req.body?.publisher || "").trim();
    const quartile = String(req.body?.quartile || "").trim();
    const wosCategory = String(req.body?.wosCategory || req.body?.wos_category || "").trim();
    const ceeol = Boolean(req.body?.ceeol);
    const isPredatory = Boolean(req.body?.isPredatory || req.body?.is_predatory);

    if (!name) {
      res.status(400).json({ error: "invalid_journal", message: "Emri i revistës është i detyrueshëm." });
      return;
    }

    const result = await db.query(
      `update admin_journals
       set issn = $2, name = $3, publisher = $4, quartile = $5, wos_category = $6, ceeol = $7, is_predatory = $8, updated_at = now()
       where id = $1
       returning id, issn, name, publisher, quartile, wos_category, ceeol, is_predatory, created_at, updated_at`,
      [journalId, issn, name, publisher, quartile, wosCategory, ceeol, isPredatory]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found", message: "Revista nuk u gjet." });
      return;
    }

    await writeAuditLog({
      actor: req.user,
      action: "admin.journal.update",
      entityType: "journal",
      entityId: journalId,
      newValue: name,
      ipAddress: getRequestIp(req),
      metadata: { target: { id: journalId, name } },
    });

    res.json({ journal: mapJournal(result.rows[0]) });
  } catch (error) {
    console.error("PATCH /api/admin/journals/:id failed:", error);
    res.status(500).json({ error: "journal_update_failed", message: "Revista nuk u përditësua." });
  }
});

router.delete("/journals/:id", requireAdmin, async (req, res) => {
  try {
    const journalId = String(req.params.id || "").trim();

    if (!UUID_PATTERN.test(journalId)) {
      res.status(400).json({ error: "invalid_journal_id", message: "Revista nuk është valide." });
      return;
    }

    const result = await db.query(
      `delete from admin_journals
       where id = $1
       returning id, name`,
      [journalId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found", message: "Revista nuk u gjet." });
      return;
    }

    await writeAuditLog({
      actor: req.user,
      action: "admin.journal.delete",
      entityType: "journal",
      entityId: journalId,
      oldValue: result.rows[0].name,
      ipAddress: getRequestIp(req),
      metadata: { target: { id: journalId, name: result.rows[0].name } },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/journals/:id failed:", error);
    res.status(500).json({ error: "journal_delete_failed", message: "Revista nuk u fshi." });
  }
});

router.post("/journals/import", requireAdmin, async (req, res) => {
  try {
    const rows = parseCsvRows(req.body?.csv || req.body?.content || "");

    if (!rows.length) {
      res.status(400).json({ error: "invalid_csv", message: "CSV nuk përmban rreshta validë." });
      return;
    }

    for (const row of rows) {
      await db.query(
        `insert into admin_journals (issn, name, publisher, quartile, wos_category, ceeol, is_predatory, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [row.issn, row.name, row.publisher, row.quartile, row.wosCategory, row.ceeol, row.isPredatory, req.user.id]
      );
    }

    await writeAuditLog({
      actor: req.user,
      action: "admin.journal.import",
      entityType: "journal",
      newValue: `${rows.length} revista`,
      ipAddress: getRequestIp(req),
      metadata: { importedCount: rows.length },
    });

    res.json({ imported: rows.length });
  } catch (error) {
    console.error("POST /api/admin/journals/import failed:", error);
    res.status(500).json({ error: "journal_import_failed", message: "Importi nuk u krye." });
  }
});

router.get("/publication-review", requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const params = [];
    const filters = [];

    if (status) {
      params.push(status);
      filters.push(`p.status = $${params.length}`);
    }

    const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";
    const result = await db.query(
      `select p.id,
              p.title,
              p.publication_type,
              p.status,
              p.source_url,
              p.created_at,
              p.updated_at,
              u.email as owner_email,
              u.full_name as owner_name,
              u.faculty,
              latest.notes as latest_comment
       from publications p
       left join users u on u.id = p.owner_id
       left join lateral (
         select notes
         from approval_events ae
         where ae.entity_type = 'publication' and ae.entity_id = p.id::text
         order by ae.created_at desc
         limit 1
       ) latest on true
       ${whereClause}
       order by p.updated_at desc
       limit 200`,
      params
    );

    res.json({ publications: result.rows.map(mapPublicationReview) });
  } catch (error) {
    console.error("GET /api/admin/publication-review failed:", error);
    res.status(500).json({ error: "publication_review_failed", message: "Shqyrtimi i publikimeve nuk u ngarkua." });
  }
});

router.patch("/publication-review/:id", requireAdmin, async (req, res) => {
  try {
    const publicationId = String(req.params.id || "").trim();
    const action = String(req.body?.action || "").trim();
    const comment = String(req.body?.comment || "").trim();

    if (!UUID_PATTERN.test(publicationId)) {
      res.status(400).json({ error: "invalid_publication_id", message: "Publikimi nuk është valid." });
      return;
    }

    if (!PUBLICATION_REVIEW_ACTIONS.has(action)) {
      res.status(400).json({ error: "invalid_action", message: "Veprimi nuk është valid." });
      return;
    }

    if ((action === "reject" || action === "request_changes") && !comment) {
      res.status(400).json({ error: "comment_required", message: "Komenti është i detyrueshëm për këtë veprim." });
      return;
    }

    const nextStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "needs_correction";
    const currentResult = await db.query(`select id, title, status from publications where id = $1 limit 1`, [publicationId]);

    if (currentResult.rowCount === 0) {
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    const current = currentResult.rows[0];
    const updateResult = await db.query(
      `update publications
       set status = $2, updated_at = now()
       where id = $1
       returning id, title, publication_type, status, source_url, created_at, updated_at`,
      [publicationId, nextStatus]
    );

    await db.query(
      `insert into approval_events (entity_type, entity_id, actor_id, action, notes)
       values ('publication', $1, $2, $3, $4)`,
      [publicationId, req.user.id, action, comment || null]
    );

    await writeAuditLog({
      actor: req.user,
      action: "admin.publication.review",
      entityType: "publication",
      entityId: publicationId,
      oldValue: current.status,
      newValue: nextStatus,
      ipAddress: getRequestIp(req),
      metadata: {
        target: { id: publicationId, name: current.title },
        comment,
      },
    });

    res.json({ publication: mapPublicationReview(updateResult.rows[0]) });
  } catch (error) {
    console.error("PATCH /api/admin/publication-review/:id failed:", error);
    res.status(500).json({ error: "publication_review_update_failed", message: "Publikimi nuk u përditësua." });
  }
});

router.get("/reports", requireAdmin, async (req, res) => {
  try {
    const publicationCount = await db.query(`select count(*)::int as count from publications`);
    const reimbursementTotal = await db.query(`select coalesce(sum(amount), 0)::numeric as total from reimbursements`);

    res.json({
      reports: [
        { id: "annual", title: "Raport vjetor i hulumtimit", count: publicationCount.rows[0]?.count || 0 },
        { id: "faculty", title: "Raport sipas fakultetit", count: publicationCount.rows[0]?.count || 0 },
        { id: "accreditation", title: "Raport për akreditim", count: publicationCount.rows[0]?.count || 0 },
        { id: "financial", title: "Përmbledhje financiare", amount: Number(reimbursementTotal.rows[0]?.total || 0) },
      ],
      filters: {
        faculties: [],
        departments: [],
        publicationTypes: [],
        quartiles: ["Q1", "Q2", "Q3", "Q4"],
      },
    });
  } catch (error) {
    console.error("GET /api/admin/reports failed:", error);
    res.status(500).json({ error: "reports_failed", message: "Raportet nuk u ngarkuan." });
  }
});

router.get("/reports/export", requireAdmin, async (req, res) => {
  try {
    const format = String(req.query.format || "excel").toLowerCase();
    const publicationCount = await db.query(`select count(*)::int as count from publications`);
    const reimbursementTotal = await db.query(`select coalesce(sum(amount), 0)::numeric as total from reimbursements`);
    const rows = [
      ["Raport vjetor i hulumtimit", publicationCount.rows[0]?.count || 0],
      ["Raport sipas fakultetit", publicationCount.rows[0]?.count || 0],
      ["Raport për akreditim", publicationCount.rows[0]?.count || 0],
      ["Përmbledhje financiare", `${Number(reimbursementTotal.rows[0]?.total || 0).toFixed(2)} EUR`],
    ];

    if (format === "pdf") {
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=\"raporti.pdf\"");
        res.send(Buffer.concat(chunks));
      });

      doc.fontSize(18).text("Raport administrativ", { underline: true });
      doc.moveDown();
      rows.forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
      doc.end();
      return;
    }

    const content = [`Raporti,Vlera`, ...rows.map(([label, value]) => `"${label}","${value}"`)].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"raporti.csv\"");
    res.send(content);
  } catch (error) {
    console.error("GET /api/admin/reports/export failed:", error);
    res.status(500).json({ error: "reports_export_failed", message: "Eksporti nuk u krye." });
  }
});

router.get("/budget", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `select
         coalesce(sum(amount) filter (where status in ('submitted', 'received', 'in_review', 'needs_correction', 'committee_approved')), 0)::numeric as committed,
         coalesce(sum(amount) filter (where status in ('approved', 'paid')), 0)::numeric as spent
       from reimbursements`
    );

    const total = Number(process.env.ADMIN_RESEARCH_BUDGET_EUR || 0);
    const committed = Number(result.rows[0]?.committed || 0);
    const spent = Number(result.rows[0]?.spent || 0);

    res.json({
      total,
      committed,
      spent,
      remaining: Math.max(total - committed - spent, 0),
      warnings: [75, 90, 100],
    });
  } catch (error) {
    console.error("GET /api/admin/budget failed:", error);
    res.status(500).json({ error: "budget_failed", message: "Buxheti nuk u ngarkua." });
  }
});

router.get("/settings", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`select value from admin_system_settings where key = 'system' limit 1`);
    res.json({ settings: { ...SYSTEM_SETTINGS_DEFAULTS, ...(result.rows[0]?.value || {}) } });
  } catch (error) {
    console.error("GET /api/admin/settings failed:", error);
    res.status(500).json({ error: "settings_failed", message: "Konfigurimet nuk u ngarkuan." });
  }
});

router.patch("/settings", requireAdmin, async (req, res) => {
  try {
    const nextSettings = {
      ...SYSTEM_SETTINGS_DEFAULTS,
      ...(req.body || {}),
    };

    const result = await db.query(
      `insert into admin_system_settings (key, value, updated_by, updated_at)
       values ('system', $1::jsonb, $2, now())
       on conflict (key)
       do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()
       returning value`,
      [JSON.stringify(nextSettings), req.user.id]
    );

    await writeAuditLog({
      actor: req.user,
      action: "admin.settings.update",
      entityType: "settings",
      entityId: "system",
      ipAddress: getRequestIp(req),
      metadata: { target: { id: "system", name: "Konfigurimet" } },
    });

    res.json({ settings: result.rows[0].value });
  } catch (error) {
    console.error("PATCH /api/admin/settings failed:", error);
    res.status(500).json({ error: "settings_update_failed", message: "Konfigurimet nuk u ruajtën." });
  }
});

export default router;
