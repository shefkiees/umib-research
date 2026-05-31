import db from "../config/db.js";

export function getRequestIp(req) {
  const forwardedFor = req?.get?.("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return req?.ip || req?.socket?.remoteAddress || null;
}

export async function writeAuditLog({
  actor,
  actorId,
  action,
  entityType,
  entityId,
  oldValue,
  newValue,
  ipAddress,
  metadata,
}) {
  try {
    const actorSnapshot = actor
      ? {
          id: actor.id,
          email: actor.email || "",
          name: actor.displayName || actor.name || actor.full_name || actor.email || "",
        }
      : null;

    const payload = {
      ...(metadata || {}),
      actor: actorSnapshot,
      oldValue: oldValue ?? metadata?.oldValue ?? null,
      newValue: newValue ?? metadata?.newValue ?? null,
      ipAddress: ipAddress || metadata?.ipAddress || null,
    };

    await db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [
        actorId || actor?.id || null,
        action,
        entityType || null,
        entityId ? String(entityId) : null,
        JSON.stringify(payload),
      ]
    );
  } catch (error) {
    console.warn("audit_log_write_failed", {
      action,
      entityType,
      entityId,
      message: error?.message,
    });
  }
}
