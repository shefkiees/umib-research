import test from "node:test";
import assert from "node:assert/strict";
import { createAuthClient, DASHBOARD_BY_ROLE } from "../../src/frontend/auth/authClient.js";

const client = (request) => createAuthClient(request, (path) => path);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const response = (status, role) => ({ status, ok: status === 200, json: async () => ({ user: { role } }) });

test("session checks map every role and distinguish anonymous, HTTP and network errors", async () => {
  for (const [role, route] of Object.entries(DASHBOARD_BY_ROLE)) {
    assert.equal(await client(async (_url, options) => {
      assert.equal(options.credentials, "include");
      assert.equal(options.cache, "no-store");
      return response(200, role);
    }).checkSession(), route);
  }
  assert.equal(await client(async () => response(401)).checkSession(), null);
  await assert.rejects(client(async () => response(500)).checkSession(), /session_check_failed/);
  await assert.rejects(client(async () => { throw new Error("network"); }).checkSession(), /network/);
  await assert.rejects(client(async () => response(200, "unknown")).checkSession(), /unsupported_role/);
});

test("concurrent mounts share one request; a refresh always revalidates", async () => {
  const pending = deferred();
  let calls = 0;
  const auth = client(async () => { calls++; return pending.promise; });
  const first = auth.checkSession();
  const second = auth.checkSession();
  await Promise.resolve();
  assert.equal(calls, 1);
  pending.resolve(response(200, "admin"));
  assert.deepEqual(await Promise.all([first, second]), ["/admin/dashboard", "/admin/dashboard"]);
  await auth.checkSession();
  assert.equal(calls, 2);
});

test("an unmounted consumer cannot use a late response; the new consumer can", async () => {
  const pending = deferred();
  const auth = client(async () => pending.promise);
  const controller = new AbortController();
  const old = auth.checkSession(controller.signal);
  const rejected = assert.rejects(old, { name: "AbortError" });
  controller.abort();
  const fresh = auth.checkSession();
  pending.resolve(response(200, "professor"));
  await rejected;
  assert.equal(await fresh, "/professor/dashboard");
});

test("logout invalidates checks already in flight and deduplicates repeated clicks", async () => {
  const session = deferred();
  const logout = deferred();
  let calls = 0;
  const auth = client(async (url, options) => {
    if (url === "/auth/me") return session.promise;
    calls++;
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "include");
    return logout.promise;
  });
  const stale = assert.rejects(auth.checkSession(), { name: "AbortError" });
  const first = auth.logout();
  const second = auth.logout();
  await Promise.resolve();
  assert.equal(calls, 1);
  session.resolve(response(200, "admin"));
  await stale;
  logout.resolve(response(200));
  await first;
  await second;
});

test("timeout aborts an unresponsive fetch and retry starts a fresh request", async () => {
  for (const method of ["checkSession", "logout"]) {
    let calls = 0;
    let requestSignal;
    const auth = createAuthClient(async (_url, options) => {
      requestSignal = options.signal;
      if (++calls === 1) return new Promise(() => {});
      return response(200, "professor");
    }, (path) => path, { timeoutMs: 20 });
    await assert.rejects(auth[method](), { name: "TimeoutError" });
    assert.equal(requestSignal.aborted, true);
    await auth[method]();
    assert.equal(calls, 2);
  }
});

test("timeout includes a stalled JSON body", async () => {
  const auth = createAuthClient(async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }), (path) => path, { timeoutMs: 20 });
  await assert.rejects(auth.checkSession(), { name: "TimeoutError" });
});

test("cancelling one consumer leaves the shared fetch and other consumer active", async () => {
  for (const method of ["checkSession", "logout"]) {
  const pending = deferred();
  let requestSignal;
  const auth = client(async (_url, options) => { requestSignal = options.signal; return pending.promise; });
  const controller = new AbortController();
  const cancelled = assert.rejects(auth[method](controller.signal), { name: "AbortError" });
  const active = auth[method]();
  await Promise.resolve();
  controller.abort();
  await cancelled;
  assert.equal(requestSignal.aborted, false);
  pending.resolve(response(200, "committee"));
  assert.equal(await active, method === "checkSession" ? "/committee/dashboard" : undefined);
  }
});

test("last consumer cancellation settles without fetch cooperation and releases pending", async () => {
  for (const method of ["checkSession", "logout"]) {
    let calls = 0;
    let requestSignal;
    const auth = client(async (_url, options) => {
      requestSignal = options.signal;
      if (++calls === 1) return new Promise(() => {});
      return response(200, "admin");
    });
    const controller = new AbortController();
    const cancelled = assert.rejects(auth[method](controller.signal), { name: "AbortError" });
    await Promise.resolve();
    controller.abort();
    await cancelled;
    assert.equal(requestSignal.aborted, true);
    await auth[method]();
    assert.equal(calls, 2);
  }
});

test("late successful responses after timeout cannot invalidate a fresh session check", async () => {
  const late = deferred();
  const active = deferred();
  const auth = createAuthClient(async (url) => url === "/auth/logout" ? late.promise : active.promise, (path) => path, { timeoutMs: 30 });
  await assert.rejects(auth.logout(), { name: "TimeoutError" });
  const fresh = auth.checkSession();
  late.resolve(response(200));
  active.resolve(response(200, "prorector"));
  assert.equal(await fresh, "/prorector/dashboard");
});

test("consumer abort listeners are removed after success, error, timeout and cancellation", async () => {
  for (const mode of ["success", "error", "timeout", "cancel"]) {
    const controller = new AbortController();
    const signal = controller.signal;
    let listeners = 0;
    const add = signal.addEventListener.bind(signal);
    const remove = signal.removeEventListener.bind(signal);
    signal.addEventListener = (...args) => { listeners++; return add(...args); };
    signal.removeEventListener = (...args) => { listeners--; return remove(...args); };
    const auth = createAuthClient(async () => {
      if (mode === "error") throw new Error("network");
      if (["timeout", "cancel"].includes(mode)) return new Promise(() => {});
      return response(200, "admin");
    }, (path) => path, { timeoutMs: 20 });
    const pending = auth.checkSession(signal);
    if (mode === "cancel") controller.abort();
    if (mode === "success") await pending;
    else await assert.rejects(pending);
    assert.equal(listeners, 0);
  }
});

test("operation timers are cleared on success, rejection, cancellation and timeout", async () => {
  const timers = new Set();
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  globalThis.setTimeout = (...args) => { const timer = originalSet(...args); timers.add(timer); return timer; };
  globalThis.clearTimeout = (timer) => { timers.delete(timer); originalClear(timer); };
  try {
    for (const mode of ["success", "error", "timeout", "cancel"]) {
      const controller = new AbortController();
      const auth = createAuthClient(async () => {
        if (mode === "error") throw new Error("network");
        if (["timeout", "cancel"].includes(mode)) return new Promise(() => {});
        return response(200, "admin");
      }, (path) => path, { timeoutMs: 20 });
      const pending = auth.checkSession(controller.signal);
      if (mode === "cancel") controller.abort();
      if (mode === "success") await pending;
      else await assert.rejects(pending);
      await Promise.resolve();
      assert.equal(timers.size, 0);
    }
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});

test("logout failures reject and allow an explicit retry", async () => {
  for (const failure of [async () => response(500), async () => { throw new Error("network"); }]) {
    let calls = 0;
    const auth = client(async () => ++calls === 1 ? failure() : response(200));
    await assert.rejects(auth.logout());
    await auth.logout();
    assert.equal(calls, 2);
  }
});
