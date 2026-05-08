import session from "express-session";
import db from "./db.js";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function getValidExpiry(sessionData, ttlMs) {
  const cookieExpiry = sessionData?.cookie?.expires
    ? new Date(sessionData.cookie.expires)
    : null;

  if (cookieExpiry && !Number.isNaN(cookieExpiry.getTime())) {
    return cookieExpiry;
  }

  return new Date(Date.now() + ttlMs);
}

export default class PostgresSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);
  }

  async get(sid, callback) {
    try {
      const result = await db.query(
        `select data
         from app_sessions
         where sid = $1 and expires_at > now()
         limit 1`,
        [sid]
      );

      callback(null, result.rows[0]?.data || null);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      const expiresAt = getValidExpiry(sessionData, this.ttlMs);

      await db.query(
        `insert into app_sessions (sid, data, expires_at)
         values ($1, $2::jsonb, $3)
         on conflict (sid) do update set
           data = excluded.data,
           expires_at = excluded.expires_at,
           updated_at = now()`,
        [sid, JSON.stringify(sessionData), expiresAt]
      );

      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  async destroy(sid, callback) {
    try {
      await db.query("delete from app_sessions where sid = $1", [sid]);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  async touch(sid, sessionData, callback) {
    try {
      const expiresAt = getValidExpiry(sessionData, this.ttlMs);

      await db.query(
        `update app_sessions
         set expires_at = $2,
             updated_at = now()
         where sid = $1`,
        [sid, expiresAt]
      );

      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }
}
