import session from "express-session";
import db from "./db.js";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function getValidExpiry(sessionData, ttlMs) {
  const absoluteExpiry = Number(sessionData?.authExpiresAt);
  const cookieExpiry = sessionData?.cookie?.expires
    ? new Date(sessionData.cookie.expires)
    : null;

  if (cookieExpiry && !Number.isNaN(cookieExpiry.getTime())) {
    return new Date(Math.min(cookieExpiry.getTime(), absoluteExpiry || Infinity, Date.now() + ttlMs));
  }

  return new Date(Math.min(Date.now() + ttlMs, absoluteExpiry || Infinity));
}

export default class PostgresSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);
    this.db = options.db || db;
  }

  async get(sid, callback) {
    try {
      const result = await this.db.query(
        `select data
         from app_sessions
         where sid = $1 and expires_at > now() and not (data @> '{"revoked":true}'::jsonb)
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
      if (expiresAt.getTime() <= Date.now()) return callback?.(null);
      const data = { ...sessionData };
      delete data.googleOAuthState;

      await this.db.query(
        `insert into app_sessions (sid, data, expires_at)
         values ($1, $2::jsonb, $3)
         on conflict (sid) do update set
           data = (excluded.data - 'googleOAuthState')
             || (case when app_sessions.data ? 'googleOAuthState'
                  then jsonb_build_object('googleOAuthState', app_sessions.data->'googleOAuthState') else '{}'::jsonb end)
             || (case when app_sessions.data ? 'authExpiresAt'
                  then jsonb_build_object('authExpiresAt', app_sessions.data->'authExpiresAt') else '{}'::jsonb end)
             || (case when app_sessions.data ? 'authenticatedAt'
                  then jsonb_build_object('authenticatedAt', app_sessions.data->'authenticatedAt') else '{}'::jsonb end),
           expires_at = least(app_sessions.expires_at, excluded.expires_at),
           updated_at = now()
         where not (app_sessions.data @> '{"revoked":true}'::jsonb)
           and app_sessions.expires_at > now()`,
        [sid, JSON.stringify(data), expiresAt]
      );

      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  async destroy(sid, callback) {
    try {
      // A tombstone makes revocation win against any later UPSERT from an in-flight request.
      await this.db.query(
        `insert into app_sessions (sid, data, expires_at)
         values ($1, '{"revoked":true}'::jsonb, 'infinity'::timestamptz)
         on conflict (sid) do update set data = excluded.data,
           expires_at = excluded.expires_at, updated_at = now()`,
        [sid]
      );
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  async touch(sid, sessionData, callback) {
    try {
      const expiresAt = getValidExpiry(sessionData, this.ttlMs);

      await this.db.query(
        `update app_sessions
         set expires_at = least(expires_at, $2),
             updated_at = now()
         where sid = $1 and expires_at > now() and not (data @> '{"revoked":true}'::jsonb)`,
        [sid, expiresAt]
      );

      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  async issueOAuthState(sid, pending, callback) {
    try {
      const result = await this.db.query(
        `update app_sessions set data = jsonb_set(data, '{googleOAuthState}', $2::jsonb), updated_at = now()
         where sid = $1 and expires_at > now() and not (data @> '{"revoked":true}'::jsonb)
         returning sid`,
        [sid, JSON.stringify(pending)]
      );
      if (result.rowCount !== 1) throw new Error("OAuth session is unavailable.");
      callback(null);
    } catch (error) { callback(error); }
  }

  async consumeOAuthState(sid, nonce, callback) {
    if (typeof nonce !== "string" || !/^[a-f0-9]{64}$/.test(nonce)) return callback(null, false);
    try {
      // PostgreSQL rechecks this predicate after a competing UPDATE acquires the row lock.
      const result = await this.db.query(
        `update app_sessions set data = data - 'googleOAuthState', updated_at = now()
         where sid = $1 and expires_at > now() and not (data @> '{"revoked":true}'::jsonb)
           and data #>> '{googleOAuthState,nonce}' = $2
           and (data #>> '{googleOAuthState,expiresAt}')::numeric > extract(epoch from clock_timestamp()) * 1000
         returning sid`,
        [sid, nonce]
      );
      callback(null, result.rowCount === 1);
    } catch (error) { callback(error); }
  }
}
