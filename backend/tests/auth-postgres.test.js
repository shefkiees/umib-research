import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import PostgresSessionStore from "../config/postgresSessionStore.js";
import { enforceSessionLifetime, SEVEN_DAYS_MS } from "../config/authSession.js";

const connectionString = process.env.TEST_DATABASE_URL;
const schema = `auth_test_${randomBytes(12).toString("hex")}`;
let admin;
let pool;
let created = false;
let storeA;
let storeB;
const call = (store, method, ...args) => new Promise((resolve, reject) => {
  store[method](...args, (error, result) => error ? reject(error) : resolve(result));
});
const sessionData = () => ({ cookie: { expires: new Date(Date.now() + 60000) } });

before(async () => {
  if (!connectionString) return;
  let url;
  try { url = new URL(connectionString); }
  catch { throw new Error("TEST_DATABASE_URL is invalid; its value is not printed."); }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && process.env.AUTH_TEST_ALLOW_REMOTE !== "true") {
    throw new Error("Real auth tests require a dedicated local database or explicit remote-test authorization.");
  }
  admin = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    await admin.query(`create schema "${schema}"`);
    created = true;
    pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, max: 4, connectionTimeoutMillis: 3000 });
    await pool.query(`create table app_sessions (
      sid text primary key, data jsonb not null, expires_at timestamptz not null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    )`);
    storeA = new PostgresSessionStore({ db: pool });
    storeB = new PostgresSessionStore({ db: pool });
  } catch {
    throw new Error("Isolated PostgreSQL auth test setup failed; connection values are not printed.");
  }
});

after(async () => {
  await pool?.end();
  if (created && /^auth_test_[a-f0-9]{24}$/.test(schema)) await admin.query(`drop schema "${schema}" cascade`);
  await admin?.end();
});

const options = { skip: !connectionString && "TEST_DATABASE_URL is not configured; no real PostgreSQL test was run." };

async function withLockedSession(sid, operation) {
  const lock = await pool.connect();
  try {
    await lock.query("begin");
    await lock.query("update app_sessions set updated_at = now() where sid = $1", [sid]);
    const competing = operation();
    // Both independent SQL requests queue behind the held PostgreSQL row lock.
    await lock.query("select pg_sleep(0.05)");
    await lock.query("commit");
    return await competing;
  } catch (error) {
    await lock.query("rollback");
    throw error;
  } finally { lock.release(); }
}

test("real PostgreSQL: parallel state consumption permits exactly one winner", options, async () => {
  const sid = "state-concurrency";
  await call(storeA, "set", sid, sessionData());
  const pending = { nonce: "a".repeat(64), expiresAt: Date.now() + 60000 };
  await call(storeA, "issueOAuthState", sid, pending);
  const outcomes = await withLockedSession(sid, () => Promise.all([
    call(storeA, "consumeOAuthState", sid, pending.nonce),
    call(storeB, "consumeOAuthState", sid, pending.nonce),
  ]));
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.equal(await call(storeB, "consumeOAuthState", sid, pending.nonce), false);
});

test("real PostgreSQL: stale session saves never restore or replace controlled OAuth state", options, async () => {
  const sid = "state-stale-write";
  const data = sessionData();
  const first = { nonce: "b".repeat(64), expiresAt: Date.now() + 60000 };
  const second = { nonce: "c".repeat(64), expiresAt: Date.now() + 60000 };
  await call(storeA, "set", sid, data);
  await call(storeA, "issueOAuthState", sid, first);
  assert.equal(await call(storeB, "consumeOAuthState", sid, first.nonce), true);
  await call(storeA, "set", sid, { ...data, googleOAuthState: first });
  assert.equal(await call(storeB, "consumeOAuthState", sid, first.nonce), false);
  await call(storeA, "issueOAuthState", sid, second);
  await call(storeB, "set", sid, { ...data, googleOAuthState: first });
  assert.equal((await call(storeA, "get", sid)).googleOAuthState.nonce, second.nonce);
});

test("real PostgreSQL: logout wins against concurrent and later authenticated writes", options, async () => {
  const sid = "logout-concurrency";
  const data = { ...sessionData(), passport: { user: "synthetic-user" }, authenticatedAt: Date.now(), authExpiresAt: Date.now() + 60000 };
  await call(storeA, "set", sid, data);
  await withLockedSession(sid, () => Promise.all([
    call(storeA, "set", sid, data), call(storeB, "destroy", sid),
  ]));
  await call(storeA, "set", sid, data);
  await call(storeA, "touch", sid, data);
  assert.equal(await call(storeB, "get", sid), null);
  const revoked = await pool.query("select data from app_sessions where sid = $1", [sid]);
  assert.deepEqual(revoked.rows[0].data, { revoked: true });
  await call(storeB, "destroy", "destroy-before-insert");
  await call(storeA, "set", "destroy-before-insert", data);
  assert.equal(await call(storeB, "get", "destroy-before-insert"), null);
  await call(storeA, "set", "fresh-after-logout", data);
  assert.equal((await call(storeB, "get", "fresh-after-logout")).passport.user, "synthetic-user");
});

test("real PostgreSQL: updates and ID rotation retain the absolute authentication deadline", options, async () => {
  const now = Date.now();
  const data = { ...sessionData(), passport: { user: "synthetic-user" }, authenticatedAt: now, authExpiresAt: now + 60000 };
  await call(storeA, "set", "absolute-deadline", data);
  const extended = { ...data, cookie: { expires: new Date(now + SEVEN_DAYS_MS) }, authenticatedAt: now + 1000, authExpiresAt: now + SEVEN_DAYS_MS };
  await call(storeB, "set", "absolute-deadline", extended);
  await call(storeB, "touch", "absolute-deadline", extended);
  assert.equal((await call(storeA, "get", "absolute-deadline")).authExpiresAt, data.authExpiresAt);
  const result = await pool.query("select expires_at from app_sessions where sid = $1", ["absolute-deadline"]);
  assert.ok(result.rows[0].expires_at.getTime() <= data.authExpiresAt);
  await call(storeB, "destroy", "absolute-deadline");
  await call(storeA, "set", "rotated-deadline", data);
  assert.equal((await call(storeB, "get", "rotated-deadline")).authExpiresAt, data.authExpiresAt);
});

test("real PostgreSQL: legacy authentication is revoked and requires a fresh login", options, async () => {
  const sid = "legacy-authentication";
  await call(storeA, "set", sid, { ...sessionData(), passport: { user: "legacy-user" } });
  const req = { session: await call(storeA, "get", sid) };
  req.session.regenerate = (done) => storeA.destroy(sid, (error) => { req.session = { cookie: {} }; done(error); });
  await new Promise((resolve, reject) => enforceSessionLifetime(SEVEN_DAYS_MS)(req, { clearCookie() {} }, (error) => error ? reject(error) : resolve()));
  assert.equal(req.session.passport, undefined);
  assert.equal(await call(storeB, "get", sid), null);
});
