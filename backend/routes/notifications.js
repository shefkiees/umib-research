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
    metadata: row.metadata || {},
    is_read: Boolean(row.is_read),
    created_at: row.created_at || null,
  };
}

async function ensureNotificationMetadataSchema(client) {
  await client.query("alter table notifications add column if not exists metadata jsonb not null default '{}'::jsonb");
}

async function ensurePublicationRevisionNotifications(client, userId) {
  await ensureNotificationMetadataSchema(client);

  await client.query(
    `insert into notifications (user_id, title, message, category, metadata)
     select
       p.owner_id,
       'Publikimi juaj kerkon korrigjim',
       concat(
         'Komisioni ka kerkuar perditesim te metadata-s per "',
         coalesce(nullif(p.title, ''), nullif(p.doi, ''), 'publikimin'),
         '". ',
         coalesce(nullif(p.metadata_review_comment, ''), 'Ju lutem rishikoni publikimin dhe ridergojeni.')
       ),
       'Publikime',
       jsonb_build_object('type', 'publication_revision', 'publicationId', p.id)
     from publications p
     where p.owner_id = $1
       and (p.status = 'needs_correction' or p.metadata_review_status = 'correction')
       and not exists (
         select 1
         from notifications n
         where n.user_id = p.owner_id
           and n.metadata->>'type' = 'publication_revision'
           and n.metadata->>'publicationId' = p.id::text
       )`,
    [userId]
  );
}

router.get("/", requireAuthenticatedUser, async (req, res) => {
  try {
    await ensurePublicationRevisionNotifications(db, req.user.id);

    const { rows } = await db.query(
      `select id, user_id, title, message, category, metadata, is_read, created_at
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
       returning id, user_id, title, message, category, metadata, is_read, created_at`,
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
