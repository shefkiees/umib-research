import express from "express";
import db from "../config/db.js";
import {
  getUserPreferences,
  mapUserPreferences,
  updateUserPreferences,
} from "../services/notification.service.js";

const router = express.Router();

function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}

function mapNotification(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title || "",
    message: row.message || "",
    category: row.category || "",
    is_read: Boolean(row.is_read),
    created_at: row.created_at || null,
  };
}

router.get("/", requireAuthenticatedUser, async (req, res) => {
  try {
    const { rows } = await db.query(
      `select id, user_id, title, message, category, is_read, created_at
       from notifications
       where user_id = $1
       order by created_at desc`,
      [req.user.id]
    );

    res.json(rows.map(mapNotification));
  } catch (error) {
    console.error("GET /api/notifications failed:", error);
    res.status(500).json({ error: "notifications_failed" });
  }
});

router.get("/preferences", requireAuthenticatedUser, async (req, res) => {
  try {
    const row = await getUserPreferences(db, req.user.id);

    res.json(mapUserPreferences(row));
  } catch (error) {
    console.error("GET /api/notifications/preferences failed:", error);
    res.status(500).json({ error: "preferences_failed" });
  }
});

router.put("/preferences", requireAuthenticatedUser, async (req, res) => {
  try {
    const row = await updateUserPreferences(db, req.user.id, req.body || {});

    res.json(mapUserPreferences(row));
  } catch (error) {
    console.error("PUT /api/notifications/preferences failed:", error);
    res.status(500).json({ error: "preferences_update_failed" });
  }
});

router.patch("/read-all", requireAuthenticatedUser, async (req, res) => {
  try {
    await db.query(
      `update notifications
       set is_read = true
       where user_id = $1 and is_read = false`,
      [req.user.id]
    );

    const unreadResult = await db.query(
      `select count(*)::int as unread_count
       from notifications
       where user_id = $1 and is_read = false`,
      [req.user.id]
    );

    res.json({ unreadCount: Number(unreadResult.rows[0]?.unread_count || 0) });
  } catch (error) {
    console.error("PATCH /api/notifications/read-all failed:", error);
    res.status(500).json({ error: "notifications_read_all_failed" });
  }
});

router.patch("/:id/read", requireAuthenticatedUser, async (req, res) => {
  try {
    const { rows } = await db.query(
      `update notifications
       set is_read = true
       where id = $1 and user_id = $2
       returning id, user_id, title, message, category, is_read, created_at`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json(mapNotification(rows[0]));
  } catch (error) {
    console.error("PATCH /api/notifications/:id/read failed:", error);
    res.status(500).json({ error: "notification_read_failed" });
  }
});

export default router;
