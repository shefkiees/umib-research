import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import session from "express-session";
import { getAuthConfig, enforceSessionLifetime, SEVEN_DAYS_MS } from "../config/authSession.js";
import { getPlainDisplayName, getAcademicDisplayName } from "../../src/frontend/utils/academicTitles.js";

// All external services are replaced before serving requests; no real database writes or OAuth calls.
process.env.NODE_ENV = "test";
process.env.VERCEL = "";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_CALLBACK_URL = "http://localhost:5000/api/auth/google/callback";
process.env.GOOGLE_CLIENT_ID = "local-test-client";
process.env.GOOGLE_CLIENT_SECRET = "local-test-placeholder";
process.env.SESSION_SECRET = "local-test-secret-with-at-least-32-characters";
process.env.SESSION_MAX_AGE_MS = String(SEVEN_DAYS_MS);
const { default: db } = await import("../config/db.js");
const { default: passport } = await import("../config/passport.js");
const { default: router } = await import("../routes/auth.js");
const { default: PostgresSessionStore } = await import("../config/postgresSessionStore.js");
const rows = new Map();
let role = "professor";
let active = true;
let exchanges = 0;
const user = () => ({ id: "local-user", email: "test@umib.net", full_name: "Test User", role, status: active ? "active" : "inactive" });
db.query = async (sql, params = []) => {
  if (/select data/.test(sql)) {
    const row = rows.get(params[0]);
    return { rows: row && !row.data.revoked && row.expires > Date.now() ? [{ data: structuredClone(row.data) }] : [] };
  }
  if (/insert into app_sessions/.test(sql)) {
    if (params.length === 1) {
      rows.set(params[0], { data: { revoked: true }, expires: Infinity });
      return { rows: [], rowCount: 1 };
    }
    const previous = rows.get(params[0]);
    if (previous && (previous.data.revoked || previous.expires <= Date.now())) return { rows: [], rowCount: 0 };
    const data = JSON.parse(params[1]);
    for (const key of ["googleOAuthState", "authExpiresAt", "authenticatedAt"]) {
      if (previous?.data[key] !== undefined) data[key] = structuredClone(previous.data[key]);
    }
    rows.set(params[0], { data, expires: Math.min(params[2].getTime(), previous?.expires || Infinity) });
    return { rows: [] };
  }
  if (/update app_sessions/.test(sql)) {
    const row = rows.get(params[0]);
    if (!row || row.data.revoked || row.expires <= Date.now()) return { rows: [], rowCount: 0 };
    if (sql.includes("jsonb_set")) {
      row.data.googleOAuthState = JSON.parse(params[1]);
    } else if (sql.includes("data - 'googleOAuthState'")) {
      if (row.data.googleOAuthState?.nonce !== params[1] || row.data.googleOAuthState.expiresAt <= Date.now()) return { rows: [], rowCount: 0 };
      delete row.data.googleOAuthState;
    } else {
      row.expires = Math.min(row.expires, params[1].getTime());
    }
    return { rows: [{ sid: params[0] }], rowCount: 1 };
  }
  if (/FROM users/.test(sql)) return { rows: [user()], rowCount: 1 };
  return { rows: [user()], rowCount: 1 };
};
const strategy = passport._strategy("google");
strategy._oauth2.getOAuthAccessToken = (_code, _params, done) => {
  exchanges += 1;
  done(null, "test-only-access", "test-only-refresh", {});
};
strategy._loadUserProfile = (_token, done) => done(null, {});
strategy._verify = (_access, _refresh, _profile, done) => done(null, {
  id: "local-user", displayName: "Test User", email: "test@umib.net", role, status: "active",
});

function createServer(configure) {
  const app = express();
  const config = getAuthConfig();
  app.use(session({ secret: config.secret, store: new PostgresSessionStore(), resave: false, saveUninitialized: false, cookie: config.cookie }));
  app.use(enforceSessionLifetime(config.maxAge));
  app.use(passport.initialize());
  app.use(passport.session());
  configure?.(app);
  app.use("/api/auth", router);
  return app.listen(0, "127.0.0.1");
}
const close = (server) => new Promise((resolve) => server.close(resolve));
const cookieOf = (response) => response.headers.get("set-cookie")?.split(";")[0];
async function request(server, path, cookie, method = "GET") {
  if (!server.listening) await once(server, "listening");
  return fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
    redirect: "manual", method, headers: cookie ? { Cookie: cookie, "X-Forwarded-Host": "untrusted.invalid" } : {},
  });
}
async function start(server) {
  const response = await request(server, "/google");
  assert.equal(response.status, 302);
  const url = new URL(response.headers.get("location"));
  assert.equal(url.searchParams.get("redirect_uri"), process.env.GOOGLE_CALLBACK_URL);
  const state = url.searchParams.get("state");
  assert.match(state, /^[a-f0-9]{64}$/);
  return { cookie: cookieOf(response), state };
}
async function login(server) {
  const pending = await start(server);
  const response = await request(server, `/google/callback?code=test-code&state=${pending.state}`, pending.cookie);
  assert.equal(response.headers.get("location"), `http://localhost:5173/${role}/dashboard`);
  const cookie = cookieOf(response);
  assert.notEqual(cookie, pending.cookie);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Lax/);
  assert.match(response.headers.get("set-cookie"), /Path=\//);
  return { cookie, pending };
}

test("configuration enforces seven-day maximum, trusted URLs and production cookie flags", () => {
  const env = { NODE_ENV: "production", TRUSTED_PROXY: "loopback", SESSION_SECRET: process.env.SESSION_SECRET, CLIENT_URL: "https://umib.example", GOOGLE_CALLBACK_URL: "https://umib.example/api/auth/google/callback" };
  const config = getAuthConfig(env);
  assert.equal(config.maxAge, SEVEN_DAYS_MS);
  assert.deepEqual(config.cookie, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SEVEN_DAYS_MS });
  assert.equal(config.cookie.domain, undefined);
  assert.equal(getAuthConfig({ ...env, GOOGLE_CALLBACK_URL: "https://api.umib.example/api/auth/google/callback" }).cookie.sameSite, "none");
  assert.throws(() => getAuthConfig({ ...env, SESSION_MAX_AGE_MS: SEVEN_DAYS_MS + 1 }));
  assert.throws(() => getAuthConfig({ ...env, SESSION_SECRET: "weak" }));
  assert.throws(() => getAuthConfig({ ...env, CLIENT_URL: "http://umib.example" }));
  assert.throws(() => getAuthConfig({ ...env, TRUSTED_PROXY: "0.0.0.0/0" }));
  assert.throws(() => getAuthConfig({ ...env, TRUSTED_PROXY: "" }));
  assert.equal(getAuthConfig({ ...env, TRUSTED_PROXY: "", VERCEL: "1" }).trustedProxy, 1);
  assert.equal(getAuthConfig({}).trustedProxy, false);
});

test("OAuth state rejects missing, changed, reused, expired and wrong-session values before token exchange", async () => {
  const server = createServer();
  try {
    for (const kind of ["missing", "changed", "expired", "wrong-session", "valid"]) {
      const pending = await start(server);
      if (kind === "expired") {
        for (const row of rows.values()) if (row.data.googleOAuthState?.nonce === pending.state) row.data.googleOAuthState.expiresAt = Date.now() - 1;
      }
      const state = kind === "missing" ? "" : kind === "changed" ? "a".repeat(64) : pending.state;
      const before = exchanges;
      const response = await request(server, `/google/callback?code=test-code&state=${state}`, kind === "wrong-session" ? undefined : pending.cookie);
      assert.equal(exchanges - before, kind === "valid" ? 1 : 0);
      assert.equal(response.status, 302);
      if (kind !== "valid") assert.match(response.headers.get("location"), /\/login\?authError=/);
      assert.equal([...rows.values()].filter((row) => row.data.googleOAuthState?.nonce === pending.state).length, ["wrong-session", "expired"].includes(kind) ? 1 : 0, `state consumed: ${kind}`);
      const replay = await request(server, `/google/callback?code=test-code&state=${pending.state}`, kind === "wrong-session" ? undefined : pending.cookie);
      assert.match(replay.headers.get("location"), /\/login\?authError=/);
      assert.equal(exchanges - before, kind === "valid" ? 1 : 0);
    }
    const empty = await request(server, "/google/callback");
    assert.match(empty.headers.get("location"), /\/login\?authError=/);
  } finally { await close(server); }
});

test("production cookie flags are emitted over a trusted HTTPS proxy", async () => {
  const config = getAuthConfig({ NODE_ENV: "production", TRUSTED_PROXY: "loopback", SESSION_SECRET: process.env.SESSION_SECRET, CLIENT_URL: "https://umib.example" });
  const app = express();
  app.set("trust proxy", config.trustedProxy);
  app.use(session({ secret: config.secret, resave: false, saveUninitialized: false, cookie: config.cookie }));
  app.get("/", (req, res) => { req.session.test = true; res.json({ ok: true }); });
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { headers: { "X-Forwarded-Proto": "https" } });
    const header = response.headers.get("set-cookie");
    assert.match(header, /HttpOnly/);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Path=\//);
    assert.doesNotMatch(header, /Domain=/);
    const expiry = new Date(/Expires=([^;]+)/.exec(header)[1]).getTime();
    assert.ok(Math.abs(expiry - Date.now() - SEVEN_DAYS_MS) < 2000);
  } finally { await close(server); }
});

test("untrusted forwarded HTTPS does not cause a production cookie to be emitted", async () => {
  const config = getAuthConfig({ NODE_ENV: "production", TRUSTED_PROXY: "192.0.2.10", SESSION_SECRET: process.env.SESSION_SECRET, CLIENT_URL: "https://umib.example" });
  const app = express();
  app.set("trust proxy", config.trustedProxy);
  app.use(session({ secret: config.secret, resave: false, saveUninitialized: false, cookie: config.cookie }));
  app.get("/", (req, res) => { req.session.test = true; res.json({ ok: true }); });
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { headers: { "X-Forwarded-Proto": "https" } });
    assert.equal(response.headers.get("set-cookie"), null);
  } finally { await close(server); }
});

test("all roles: login, refresh, cookie reuse, restart, expiry, inactive user and logout", async () => {
  rows.clear();
  let server = createServer();
  try {
    assert.equal((await request(server, "/me")).status, 401);
    for (const currentRole of ["admin", "professor", "committee", "prorector"]) {
      role = currentRole;
      const { cookie, pending } = await login(server);
      assert.equal((await request(server, "/me", pending.cookie)).status, 401);
      for (let count = 0; count < 2; count++) {
        const response = await request(server, "/me", cookie);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).user.role, currentRole);
      }
      const existing = await request(server, "/google", cookie);
      assert.equal(existing.headers.get("location"), `http://localhost:5173/${role}/dashboard`);
      const deadline = [...rows.values()].find((row) => row.data.passport?.user)?.data.authExpiresAt;
      assert.ok(deadline <= Date.now() + SEVEN_DAYS_MS);
      await close(server);
      server = createServer();
      assert.equal((await request(server, "/me", cookie)).status, 200);
      for (const row of rows.values()) {
        if (row.data.passport?.user) assert.ok(row.expires <= row.data.authExpiresAt, `expiry difference: ${row.expires - row.data.authExpiresAt}`);
      }
      active = false;
      assert.equal((await request(server, "/me", cookie)).status, 401);
      active = true;
      const logout = await request(server, "/logout", cookie, "POST");
      assert.equal(logout.status, 200);
      assert.match(logout.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
      assert.equal((await request(server, "/me", cookie)).status, 401);
      const again = await login(server);
      for (const row of rows.values()) if (row.data.passport?.user) row.data.authExpiresAt = Date.now() - 1;
      assert.equal((await request(server, "/me", again.cookie)).status, 401);
      const expired = await request(server, "/google", again.cookie);
      assert.equal(new URL(expired.headers.get("location")).hostname, "accounts.google.com");
      const last = await login(server);
      for (const row of rows.values()) if (row.data.passport?.user) row.data.authExpiresAt = Date.now() - 1;
      const directExpired = await request(server, "/google", last.cookie);
      assert.equal(new URL(directExpired.headers.get("location")).hostname, "accounts.google.com");
    }
  } finally { await close(server); }
});

test("plain names omit academic fields and academic names never derive titles from roles", () => {
  const profile = { name: "A Very Long Academic Name", role: "admin", academicTitle: "profesor", scientificTitle: "PhD" };
  assert.equal(getPlainDisplayName(profile), profile.name);
  assert.equal(getAcademicDisplayName(profile), `Prof. ${profile.name}, PhD`);
  assert.equal(getAcademicDisplayName({ name: profile.name, role: "admin" }), profile.name);
  assert.equal(getPlainDisplayName({ firstName: "Test", full_name: "Test Complete Name" }), "Test Complete Name");
  assert.equal(getPlainDisplayName({ firstName: "Test", lastName: "User", full_name: "Other Name" }), "Test User");
});

const storeCall = (store, method, ...args) => new Promise((resolve, reject) => {
  store[method](...args, (error, result) => error ? reject(error) : resolve(result));
});

test("legacy authenticated sessions require reauthentication; trusted timestamps retain their deadline", async () => {
  const middleware = enforceSessionLifetime(SEVEN_DAYS_MS);
  for (const attributes of [{}, { authExpiresAt: "invalid" }, { authenticatedAt: Date.now() - SEVEN_DAYS_MS - 1 }]) {
    let rotated = false;
    const req = { session: {
      passport: { user: "legacy-user" }, cookie: { expires: new Date(Date.now() + SEVEN_DAYS_MS) }, ...attributes,
      regenerate(done) { rotated = true; req.session = { cookie: {} }; done(); },
    } };
    await new Promise((resolve, reject) => middleware(req, { clearCookie() {} }, (error) => error ? reject(error) : resolve()));
    assert.equal(rotated, true);
    assert.equal(req.session.passport, undefined);
  }
  const authenticatedAt = Date.now() - 2 * 86400000;
  const req = { session: { passport: { user: "current-user" }, cookie: {}, authenticatedAt } };
  middleware(req, {}, () => {});
  assert.equal(req.session.authExpiresAt, authenticatedAt + SEVEN_DAYS_MS);
  const preserved = req.session.authExpiresAt;
  middleware(req, {}, () => {});
  assert.equal(req.session.authExpiresAt, preserved);
});

test("legacy signed cookie is rejected even when its cookie expiry is still in the future", async () => {
  rows.clear();
  const server = createServer();
  try {
    const { cookie } = await login(server);
    const row = [...rows.values()].find((value) => value.data.passport?.user);
    delete row.data.authExpiresAt;
    delete row.data.authenticatedAt;
    assert.equal((await request(server, "/me", cookie)).status, 401);
    assert.ok([...rows.values()].some((value) => value.data.revoked));
    const response = await request(server, "/google", cookie);
    assert.equal(new URL(response.headers.get("location")).hostname, "accounts.google.com");
    await login(server);
  } finally { await close(server); }
});

test("parallel OAuth callbacks permit at most one token exchange", async () => {
  const server = createServer();
  try {
    const pending = await start(server);
    const before = exchanges;
    const responses = await Promise.all([0, 1].map(() => request(server, `/google/callback?code=test-code&state=${pending.state}`, pending.cookie)));
    assert.equal(exchanges - before, 1);
    assert.equal(responses.filter((response) => response.headers.get("location").includes("/dashboard")).length, 1);
  } finally { await close(server); }
});

test("logout revocation wins against late writes and session snapshots cannot restore consumed state", async () => {
  rows.clear();
  const store = new PostgresSessionStore();
  const server = createServer();
  try {
    const { cookie } = await login(server);
    const [sid, row] = [...rows].find(([, value]) => value.data.passport?.user && !value.data.revoked && value.expires > Date.now());
    const stale = structuredClone(row.data);
    const logout = await request(server, "/logout", cookie, "POST");
    assert.equal(logout.status, 200);
    await Promise.all([storeCall(store, "set", sid, stale), storeCall(store, "touch", sid, stale)]);
    assert.equal(await storeCall(store, "get", sid), null);
    assert.equal((await request(server, "/me", cookie)).status, 401);
    const newSid = "fresh-test-session";
    const data = { cookie: { expires: new Date(Date.now() + 60000) } };
    await storeCall(store, "set", newSid, data);
    const pending = { nonce: "b".repeat(64), expiresAt: Date.now() + 60000 };
    await storeCall(store, "issueOAuthState", newSid, pending);
    assert.equal(await storeCall(store, "consumeOAuthState", newSid, pending.nonce), true);
    await storeCall(store, "set", newSid, { ...data, googleOAuthState: pending });
    assert.equal(await storeCall(store, "consumeOAuthState", newSid, pending.nonce), false);
  } finally { await close(server); }
});

test("an active HTTP request cannot resurrect its session after concurrent logout", async () => {
  rows.clear();
  let started;
  let release;
  const captured = new Promise((resolve) => { started = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const server = createServer((app) => {
    app.get("/api/auth/test/delayed", async (req, res) => {
      req.session.activeRequest = true;
      started();
      await gate;
      req.session.save((error) => error ? res.sendStatus(500) : res.json({ completed: true }));
    });
  });
  try {
    const { cookie } = await login(server);
    const delayed = request(server, "/test/delayed", cookie);
    await captured;
    assert.equal((await request(server, "/logout", cookie, "POST")).status, 200);
    release();
    assert.equal((await delayed).status, 200);
    assert.equal((await request(server, "/me", cookie)).status, 401);
  } finally { release(); await close(server); }
});

test("session updates and ID rotation cannot extend an existing authentication deadline", async () => {
  const store = new PostgresSessionStore();
  const now = Date.now();
  const data = { passport: { user: "test-user" }, cookie: { expires: new Date(now + 60000) }, authenticatedAt: now - 60000, authExpiresAt: now + 60000 };
  await storeCall(store, "set", "deadline-test", data);
  await storeCall(store, "set", "deadline-test", { ...data, authExpiresAt: now + SEVEN_DAYS_MS, authenticatedAt: now, cookie: { expires: new Date(now + SEVEN_DAYS_MS) } });
  assert.equal((await storeCall(store, "get", "deadline-test")).authExpiresAt, data.authExpiresAt);
  await storeCall(store, "destroy", "deadline-test");
  await storeCall(store, "set", "rotated-test", data);
  assert.equal((await storeCall(store, "get", "rotated-test")).authExpiresAt, data.authExpiresAt);
  assert.equal(await storeCall(store, "get", "deadline-test"), null);
});
