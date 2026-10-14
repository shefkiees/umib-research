import { apiUrl } from "../utils/api.js";

export const DASHBOARD_BY_ROLE = {
  admin: "/admin/dashboard",
  professor: "/professor/dashboard",
  committee: "/committee/dashboard",
  prorector: "/prorector/dashboard",
};

export const AUTH_TIMEOUT_MS = 15_000;

function createOperation(work, timeoutMs, onFinish) {
  const controller = new AbortController();
  let settled = false;
  let consumers = 0;
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
    onFinish();
    if (error) reject(error);
    else resolve(value);
  };
  const onAbort = () => finish(controller.signal.reason);
  const timer = setTimeout(() => controller.abort(new DOMException("Authentication request timed out", "TimeoutError")), timeoutMs);
  controller.signal.addEventListener("abort", onAbort, { once: true });
  // Settlement does not depend on fetch (or response.json) honoring the abort signal.
  Promise.resolve().then(() => { controller.signal.throwIfAborted(); return work(controller.signal); }).then((value) => finish(null, value), (error) => finish(error));

  return {
    cancel: () => controller.abort(new DOMException("Authentication request cancelled", "AbortError")),
    subscribe(signal) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      consumers += 1;
      return new Promise((accept, fail) => {
        let completed = false;
        const complete = (error, value) => {
          if (completed) return;
          completed = true;
          signal?.removeEventListener("abort", abort);
          consumers -= 1;
          if (error) fail(error);
          else accept(value);
        };
        const abort = () => {
          complete(signal.reason);
          // React StrictMode can immediately replace an unmounted consumer.
          queueMicrotask(() => {
            if (!settled && consumers === 0) controller.abort(new DOMException("No active consumers", "AbortError"));
          });
        };
        signal?.addEventListener("abort", abort, { once: true });
        promise.then((value) => complete(null, value), (error) => complete(error));
      });
    },
  };
}

export function createAuthClient(request = (...args) => fetch(...args), url = apiUrl, { timeoutMs = AUTH_TIMEOUT_MS } = {}) {
  let sessionRequest = null;
  let generation = 0;
  let logoutRequest = null;

  const invalidate = () => {
    generation += 1;
    sessionRequest?.cancel();
    sessionRequest = null;
  };

  return {
    invalidate,
    async checkSession(signal) {
      signal?.throwIfAborted();
      const currentGeneration = generation;
      if (!sessionRequest) {
        const pending = createOperation(async (requestSignal) => {
          const response = await request(url("/auth/me"), { credentials: "include", cache: "no-store", signal: requestSignal });
          if (response.status === 401) return null;
          if (!response.ok) throw new Error("session_check_failed");
          const data = await response.json();
          const route = DASHBOARD_BY_ROLE[String(data.user?.role || "").toLowerCase()];
          if (!route) throw new Error("unsupported_role");
          return route;
        }, timeoutMs, () => { if (sessionRequest === pending) sessionRequest = null; });
        sessionRequest = pending;
      }
      const route = await sessionRequest.subscribe(signal);
      signal?.throwIfAborted();
      if (currentGeneration !== generation) throw new DOMException("Stale session check", "AbortError");
      return route;
    },
    logout(signal) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      if (logoutRequest) return logoutRequest.subscribe(signal);
      invalidate();
      const pending = createOperation(async (requestSignal) => {
        const response = await request(url("/auth/logout"), { method: "POST", credentials: "include", signal: requestSignal });
        if (!response.ok) throw new Error("logout_failed");
        requestSignal.throwIfAborted();
        invalidate();
      }, timeoutMs, () => { if (logoutRequest === pending) logoutRequest = null; });
      logoutRequest = pending;
      return pending.subscribe(signal);
    },
  };
}

export const authClient = createAuthClient();
