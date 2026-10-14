import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

// This suite starts its own frontend; every API response is synthetic.
const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, mode: "test" });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.AUTH_BROWSER_CHANNEL ? { channel: process.env.AUTH_BROWSER_CHANNEL } : {}) });
} catch (error) {
  await server.close();
  throw error;
}
test.after(async () => { await browser.close(); await server.close(); });

async function setup(role = "professor") {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = { authenticated: false, meStatus: null, logoutFailure: null, meCalls: 0, logoutCalls: 0, delayMe: 0, delayLogout: 0, oauthCalls: 0 };
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/api/")) {
      const headers = { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Credentials": "true", "Cache-Control": "no-store" };
      if (url.pathname.endsWith("/auth/me")) {
        state.meCalls++;
        const status = state.meStatus || (state.authenticated ? 200 : 401);
        if (state.delayMe) await new Promise((resolve) => setTimeout(resolve, state.delayMe));
        if (status === "network") return route.abort("failed");
        return route.fulfill({ status, headers, json: { user: status === 200 ? { id: "synthetic-user", email: "test@umib.net", full_name: "Test User", role, status: "active" } : null } });
      }
      if (url.pathname.endsWith("/auth/logout")) {
        state.logoutCalls++;
        if (state.delayLogout) await new Promise((resolve) => setTimeout(resolve, state.delayLogout));
        if (state.logoutFailure === "network") return route.abort("failed");
        if (state.logoutFailure) return route.fulfill({ status: 500, headers, json: { error: "logout_failed" } });
        state.authenticated = false;
        return route.fulfill({ status: 200, headers, json: { message: "Logged out" } });
      }
      if (url.pathname.endsWith("/auth/google")) {
        state.oauthCalls++;
        return route.fulfill({ status: 200, contentType: "text/html", body: "Synthetic Google entry" });
      }
      return route.fulfill({ status: 200, headers, json: [] });
    }
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  return { context, page, state };
}

async function waitVisible(locator) { await locator.waitFor({ state: "visible", timeout: 25000 }); }
async function clickLogout(page, role) {
  const profile = role === "committee" ? ".committee-profile-block" : `.${role === "professor" ? "prof" : role}-profile-btn`;
  await page.locator(profile).click();
  await page.getByRole("button", { name: /^(Dil|Logout|Log out)$/ }).click();
}

test("both homepage buttons share login; 401 shows Google and avoids a second check", async () => {
  const { context, page, state } = await setup();
  try {
    for (const selector of [".nav-login-btn", ".btn-gold"]) {
      await page.goto(base);
      const before = state.meCalls;
      await page.locator(selector).first().click();
      await waitVisible(page.locator(".google-btn"));
      assert.equal(new URL(page.url()).pathname, "/login");
      assert.equal(state.meCalls - before, 1);
    }
    const before = state.meCalls;
    await page.locator(".google-btn").click();
    await page.waitForURL("**/api/auth/google");
    assert.equal(state.meCalls, before);
    assert.equal(state.oauthCalls, 1);
  } finally { await context.close(); }
});

test("login timeout shows retry and a late response cannot redirect", async () => {
  const { context, page, state } = await setup();
  try {
    state.authenticated = true;
    state.delayMe = 18_000;
    await page.goto(`${base}/login`);
    await waitVisible(page.getByRole("alert"));
    assert.equal(new URL(page.url()).pathname, "/login");
    state.delayMe = 0;
    state.authenticated = false;
    await page.getByRole("button", { name: "Provo përsëri" }).click();
    await waitVisible(page.getByRole("button", { name: /Google/ }));
    await page.waitForTimeout(3500);
    assert.equal(new URL(page.url()).pathname, "/login");
  } finally { await context.close(); }
});

test("logout timeout restores retry without clearing authentication or storage", async () => {
  const { context, page, state } = await setup("professor");
  try {
    state.authenticated = true;
    state.delayLogout = 18_000;
    state.logoutFailure = 500;
    await page.goto(`${base}/professor/dashboard`);
    await page.evaluate(() => localStorage.setItem("authToken", "synthetic"));
    await clickLogout(page, "professor");
    await waitVisible(page.locator(".logout-dialog [role=alert]"));
    assert.equal(new URL(page.url()).pathname, "/professor/dashboard");
    assert.equal(await page.evaluate(() => localStorage.getItem("authToken")), "synthetic");
    assert.equal(await page.locator("[inert]").count(), 0);
    await page.getByRole("button", { name: "Mbyll" }).click();
    state.delayLogout = 0;
    state.logoutFailure = null;
    await clickLogout(page, "professor");
    await page.waitForURL("**/login?loggedOut=1");
    await waitVisible(page.getByRole("button", { name: /Google/ }));
  } finally { await context.close(); }
});

for (const role of ["professor", "committee", "admin", "prorector"]) {
  test(`${role}: delayed 401 after unmount cannot navigate from homepage`, async () => {
    const { context, page, state } = await setup(role);
    try {
      state.meStatus = 401;
      state.delayMe = 800;
      await page.goto(`${base}/${role}/dashboard`);
      await page.evaluate(() => {
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForTimeout(1100);
      assert.equal(new URL(page.url()).pathname, "/");
    } finally { await context.close(); }
  });
}

test("login network/500 errors stay on login and support retry", async () => {
  for (const failure of [500, "network"]) {
    const { context, page, state } = await setup();
    try {
      state.meStatus = failure;
      await page.goto(`${base}/login`);
      await waitVisible(page.getByRole("alert"));
      assert.equal(new URL(page.url()).pathname, "/login");
      assert.equal(state.oauthCalls, 0);
      state.meStatus = 401;
      await page.getByRole("button", { name: "Provo përsëri" }).click();
      await waitVisible(page.getByRole("button", { name: /Google/ }));
    } finally { await context.close(); }
  }
});

for (const role of ["admin", "professor", "committee", "prorector"]) {
  test(`${role}: valid login, refresh, failed logout, retry and successful logout`, async () => {
    const { context, page, state } = await setup(role);
    try {
      state.authenticated = true;
      await page.goto(`${base}/login`);
      await page.waitForURL(`**/${role}/dashboard`);
      assert.equal(state.oauthCalls, 0);
      await page.reload();
      await waitVisible(page.locator(role === "committee" ? ".committee-profile-block" : `.${role === "professor" ? "prof" : role}-profile-btn`));
      assert.equal(new URL(page.url()).pathname, `/${role}/dashboard`);
      await page.evaluate(() => { localStorage.setItem("authToken", "synthetic"); sessionStorage.setItem("authToken", "synthetic"); });
      state.logoutFailure = 500;
      await clickLogout(page, role);
      await waitVisible(page.locator(".logout-dialog [role=alert]"));
      if (process.env.AUTH_SCREENSHOT_DIR && role === "admin") await page.screenshot({ path: join(process.env.AUTH_SCREENSHOT_DIR, "logout-error-desktop.png") });
      assert.equal(new URL(page.url()).pathname, `/${role}/dashboard`);
      assert.equal(await page.evaluate(() => localStorage.getItem("authToken")), "synthetic");
      state.logoutFailure = "network";
      await page.getByRole("button", { name: "Provo përsëri" }).click();
      await waitVisible(page.locator(".logout-dialog [role=alert]"));
      assert.equal(state.authenticated, true);
      assert.equal(new URL(page.url()).pathname, `/${role}/dashboard`);
      state.logoutFailure = null;
      state.delayLogout = 200;
      await page.getByRole("button", { name: "Provo përsëri" }).click();
      await waitVisible(page.locator(".logout-dialog [role=status]"));
      assert.equal(state.logoutCalls, 3);
      await page.waitForURL("**/login?loggedOut=1");
      await waitVisible(page.getByText("Keni dalë me sukses nga platforma."));
      await waitVisible(page.getByRole("button", { name: /Google/ }));
      assert.equal(await page.evaluate(() => localStorage.getItem("authToken")), null);
      assert.equal(await page.evaluate(() => sessionStorage.getItem("authToken")), null);
      assert.equal(state.authenticated, false);
      await page.reload();
      await waitVisible(page.getByRole("button", { name: /Google/ }));
    } finally { await context.close(); }
  });
}

test("leaving login ignores a delayed authenticated response", async () => {
  const { context, page, state } = await setup();
  try {
    state.authenticated = true;
    state.delayMe = 500;
    await page.goto(base);
    await page.evaluate(() => {
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitVisible(page.getByText("Duke kontrolluar sesionin..."));
    await page.evaluate(() => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(800);
    assert.equal(new URL(page.url()).pathname, "/");
  } finally { await context.close(); }
});

test("faculty page uses the shared logout and the error dialog fits mobile", async () => {
  const { context, page, state } = await setup("prorector");
  try {
    state.authenticated = true;
    state.logoutFailure = 500;
    await page.goto(`${base}/prorector/faculties/synthetic-faculty`);
    await clickLogout(page, "prorector");
    await waitVisible(page.locator(".logout-dialog [role=alert]"));
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await page.locator(".logout-dialog").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844);
    if (process.env.AUTH_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.AUTH_SCREENSHOT_DIR, "logout-error-mobile.png") });
    state.logoutFailure = null;
    await page.getByRole("button", { name: "Provo përsëri" }).click();
    await page.waitForURL("**/login?loggedOut=1");
    await waitVisible(page.getByRole("button", { name: /Google/ }));
    if (process.env.AUTH_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.AUTH_SCREENSHOT_DIR, "logged-out-mobile.png") });
  } finally { await context.close(); }
});
