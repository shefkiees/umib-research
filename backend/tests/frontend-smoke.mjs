import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const baseUrl = process.argv[3] || "http://127.0.0.1:5174";
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const page = await browser.newPage();
await page.route("**/api/**", (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"user":null}' }));
try {
  for (const role of ["admin", "professor"]) {
    let calls = 0;
    let authenticated = false;
    let oauthCalls = 0;
    await page.route("**/auth/me", async (route) => {
      calls += 1;
      await route.fulfill({ status: authenticated ? 200 : 401, contentType: "application/json", body: JSON.stringify({ user: authenticated ? { id: "test", role, name: "Test User" } : null }) });
    });
    await page.route("**/auth/google", async (route) => { oauthCalls += 1; await route.abort(); });
    const checked = page.waitForResponse((response) => response.url().includes("/auth/me"));
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await checked;
    authenticated = true;
    await page.locator(".google-btn").click();
    await page.waitForURL(`**/${role}/dashboard`);
    assert.equal(oauthCalls, 0);
    await page.goto(`${baseUrl}/auth/start`);
    await page.waitForURL(`**/${role}/dashboard`);
    assert.equal(oauthCalls, 0);
    await page.unroute("**/auth/me");
    await page.unroute("**/auth/google");
  }
  let resolveCheck;
  const pendingCheck = new Promise((resolve) => { resolveCheck = resolve; });
  let calls = 0;
  let clickStarted = false;
  let oauthCalls = 0;
  await page.route("**/auth/me", async (route) => {
    calls += 1;
    if (clickStarted) await pendingCheck;
    await route.fulfill({ status: 401, contentType: "application/json", body: '{"user":null}' });
  });
  await page.route("**/auth/google", async (route) => { oauthCalls += 1; await route.fulfill({ contentType: "text/html", body: "Local OAuth navigation test" }); });
  const checked = page.waitForResponse((response) => response.url().includes("/auth/me"));
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await checked;
  const initialCalls = calls;
  clickStarted = true;
  await page.locator(".google-btn").evaluate((button) => { button.click(); button.click(); });
  assert.equal(await page.locator(".google-btn").isDisabled(), true);
  resolveCheck();
  await page.waitForURL("**/auth/google");
  assert.equal(calls, initialCalls + 1);
  assert.equal(oauthCalls, 1);
  await page.unroute("**/auth/me");
  await page.unroute("**/auth/google");

  const css = (await Promise.all([
    "src/frontend/HomePage.css",
    "src/frontend/admin/styles/AdminDashboard.css",
    "src/frontend/professor/styles/ProfessorDashboard.css",
    "src/frontend/ProRector/styles/ProRectorDashboard.css",
    "src/frontend/committee/styles/CommitteeDashboard.css",
  ].map((path) => readFile(path, "utf8")))).join("\n");
  const longName = "Arben Aleksander ShumeEmraTeGjatesiseSeMadhe MbiemriShumeIGjatePaHapesira";
  const output = join(tmpdir(), "umibres-name-layout");
  await mkdir(output, { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(`<style>${css}</style><main style="padding:16px;display:grid;gap:16px;max-width:100%;box-sizing:border-box">
      <button class="admin-profile-btn"><div class="admin-profile-identity"><div class="admin-profile-text"><strong>${longName}</strong><span>Admin</span></div><div class="admin-avatar">AA</div></div></button>
      <button class="prof-profile-btn"><div><h4>${longName}</h4><span>Profesor</span></div><div class="prof-avatar">AA</div></button>
      <button class="prorector-profile-btn"><div class="prorector-profile-copy"><h4>${longName}</h4><span>Prorektor</span></div><span class="prorector-profile-avatar">AA</span></button>
      <button class="committee-profile-block"><div class="committee-profile-text"><h4>${longName}</h4><p>Komision</p></div></button>
      <div class="umib-homepage-root"><div class="community-profile-card"><div class="community-profile-main"><div class="community-profile-photo"><span>AA</span></div><div class="community-profile-copy"><h3>Prof. Ass. ${longName}, PhD</h3><p>Fakulteti i Inxhinierise</p></div></div><div class="community-profile-stats"><span>Publikime</span><span>Konferenca</span><span>Projekte</span></div></div></div>
      </main>`);
    const problems = await page.locator(".admin-profile-text strong, .prof-profile-btn h4, .prorector-profile-btn h4, .committee-profile-text h4, .community-profile-copy h3").evaluateAll((nodes) => nodes.filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1).map((node) => ({ parent: node.parentElement.className, width: node.clientWidth, scrollWidth: node.scrollWidth, height: node.clientHeight, scrollHeight: node.scrollHeight })));
    await page.screenshot({ path: join(output, `${width}.png`), fullPage: true });
    assert.deepEqual(problems, []);
    const outside = await page.locator(".admin-profile-text strong, .prof-profile-btn h4, .prorector-profile-btn h4, .committee-profile-text h4, .community-profile-copy h3").evaluateAll((nodes) => nodes.filter((node) => {
      const bounds = node.getBoundingClientRect();
      const container = node.closest("button, .community-profile-card").getBoundingClientRect();
      return bounds.width === 0 || bounds.bottom > container.bottom || bounds.top < container.top;
    }).map((node) => node.parentElement.className));
    assert.deepEqual(outside, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  console.log("PASS: session-aware frontend login, double-click guard, long names at 390px/1440px.");
  console.log(`Layout screenshots: ${output}`);
} finally {
  await browser.close();
}
