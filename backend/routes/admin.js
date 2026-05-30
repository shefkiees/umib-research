import express from "express";
import db from "../config/db.js";
import { syncMissingSupabaseAuthUsers } from "../services/supabaseAuthSync.service.js";

const router = express.Router();
const ACCESS_RESET_STATUSES = new Set(["pending", "in_progress", "completed", "rejected"]);

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  if (req.user.role !== "admin") {
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

export default router;
