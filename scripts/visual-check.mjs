#!/usr/bin/env node
// Drives the real composed app through every state worth eyeballing and screenshots each
// one to scripts/visual-out/, with a manifest.json describing what's in each shot.
//
// Runs with NO env configured: it supplies its own fake Clerk keys and fixture API
// responses (see scripts/_visual-harness.mjs), so it never touches Neon, Upstash, or a
// real Clerk project. Nothing here runs in CI — it's a local sanity check.
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BASE_URL,
  FAKE_CLERK_FRONTEND_HOST,
  FLOWS,
  RESPONSIVE_FLOWS,
  createFixtureState,
  gotoWithRetry,
  launchChromium,
  routeApi,
  startServer,
} from "./_visual-harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "visual-out");

class HarnessError extends Error {}

async function checkAuthRedirect() {
  console.log(
    "Checking that a request without E2E_BYPASS_AUTH redirects to sign-in...",
  );
  const server = await startServer({});
  try {
    const res = await fetch(BASE_URL, { redirect: "manual" });
    if (res.status < 300 || res.status >= 400) {
      throw new HarnessError(
        `Expected a redirect (3xx) without E2E_BYPASS_AUTH, got ${res.status}`,
      );
    }
    const location = res.headers.get("location") ?? "";
    if (!location.includes("sign-in")) {
      throw new HarnessError(
        `Expected redirect Location to point at sign-in, got "${location}"`,
      );
    }
    console.log(`  OK — ${res.status} -> ${location}`);
  } finally {
    await server.stop();
  }
}

async function driveVisualStates() {
  console.log("Starting server with E2E_BYPASS_AUTH=1...");
  const server = await startServer({ E2E_BYPASS_AUTH: "1" });

  const browser = await launchChromium();
  const manifest = [];

  try {
    const now = Date.now();
    const fixtureState = createFixtureState(now);

    const context = await browser.newContext({
      // Tall enough that the away overlay's return button (which bleeds past the panel's
      // padding box on purpose) isn't clipped at the bottom edge.
      viewport: { width: 1440, height: 1100 },
    });
    const page = await context.newPage();
    // The WAL persists in localStorage; never let one run's log leak into
    // the next (or a stale batch replay against fresh fixture state).
    await page.addInitScript(() => {
      // Init scripts run in every frame, including opaque-origin ones where
      // localStorage access throws a SecurityError — guard it.
      try {
        localStorage.clear();
      } catch {
        /* inaccessible in this frame — nothing to clear */
      }
    });

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      // Ignore failed loads of Clerk's own client SDK from the fake frontend API host — an
      // artifact of ClerkProvider needing a syntactically valid key even though
      // E2E_BYPASS_AUTH means it's never actually used to authenticate anything.
      if (msg.location().url.includes(FAKE_CLERK_FRONTEND_HOST)) return;
      consoleErrors.push(msg.text());
    });
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    await routeApi(page, fixtureState);

    const gotoResponse = await gotoWithRetry(page, BASE_URL, {
      waitUntil: "domcontentloaded",
    });
    if (!gotoResponse || !gotoResponse.ok()) {
      throw new HarnessError(
        `Page load failed: ${gotoResponse ? gotoResponse.status() : "no response"}`,
      );
    }
    // useTimer's own mount fetch (GET /api/state) races with the first flow's interaction
    // otherwise: it resolves after we've typed into the bullet jotter and stomps the draft
    // back to empty. Let it settle first.
    await page.waitForResponse((res) => res.url().includes("/api/state"), {
      timeout: 10_000,
    });

    for (const flow of FLOWS) {
      console.log(`  -> ${flow.name}`);
      await flow.run(page);
      try {
        await page.waitForSelector(flow.waitFor, { timeout: 10_000 });
      } catch {
        throw new HarnessError(
          `Selector "${flow.waitFor}" never appeared for step "${flow.name}"`,
        );
      }
      const file = `${flow.name}.png`;
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      manifest.push({
        name: flow.name,
        description: flow.description,
        covers: flow.covers,
      });
    }

    // Responsive stacks: reload to a clean running state at each viewport.
    for (const flow of RESPONSIVE_FLOWS) {
      console.log(`  -> ${flow.name}`);
      await page.setViewportSize(flow.viewport);
      const reloadResponse = await gotoWithRetry(page, BASE_URL, {
        waitUntil: "domcontentloaded",
      });
      if (!reloadResponse || !reloadResponse.ok()) {
        throw new HarnessError(
          `Page reload failed for "${flow.name}": ${
            reloadResponse ? reloadResponse.status() : "no response"
          }`,
        );
      }
      try {
        await page.waitForSelector('[data-testid="bullet-jotter"]', {
          timeout: 10_000,
        });
      } catch {
        throw new HarnessError(
          `Selector never appeared after reload for step "${flow.name}"`,
        );
      }
      const file = `${flow.name}.png`;
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      manifest.push({
        name: flow.name,
        description: flow.description,
        covers: flow.covers,
      });
    }

    if (pageErrors.length > 0) {
      throw new HarnessError(`Uncaught page errors:\n${pageErrors.join("\n")}`);
    }
    if (consoleErrors.length > 0) {
      throw new HarnessError(`Console errors:\n${consoleErrors.join("\n")}`);
    }

    await context.close();
  } finally {
    await browser.close();
    await server.stop();
  }

  return manifest;
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  await checkAuthRedirect();
  const manifest = await driveVisualStates();

  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  console.log(
    `\nWrote ${manifest.length} screenshots + manifest.json to ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exitCode = 1;
});
