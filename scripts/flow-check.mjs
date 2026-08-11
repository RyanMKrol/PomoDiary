// Clock-driven flow check — the assertion-based twin of scripts/visual-check.mjs.
//
// Where the visual harness screenshots states for a human to eyeball, this script
// fast-forwards Playwright's fake clock through the core temporal flows and FAILS
// (exit 1) if the behaviour is wrong. The API fixtures here are STATEFUL: an
// in-memory server state mutated by the REAL lib/timer engine (imported below via
// tsx), so the browser drives true transitions rather than canned responses.
//
// Run with: npm run flow:check   (no env vars needed; not part of CI)
import { PHRASES } from "../lib/domain/index.ts";
import { deriveNow, dispatch, initialState } from "../lib/timer/engine.ts";
import { fmtChimeRange } from "../lib/time/index.ts";
import {
  BASE_URL,
  FAKE_CLERK_FRONTEND_HOST,
  gotoWithRetry,
  launchChromium,
  startServer,
} from "./_visual-harness.mjs";

// ---------------------------------------------------------------------------
// Stateful fixture backed by the real engine
// ---------------------------------------------------------------------------

function createFlowFixture(t0) {
  return {
    // The fixture's own clock. Advanced in lockstep with page.clock via tick()
    // below, so the "server" and the browser agree on what time it is.
    now: t0,
    state: initialState(t0),
    settings: {
      sessionMinutes: 60,
      soundOn: false,
      chimeVolume: 0.5,
      pauseAfterLog: false,
    },
    entries: [],
  };
}

function engineSettings(fx) {
  return {
    sessionMinutes: fx.settings.sessionMinutes,
    pauseAfterLog: fx.settings.pauseAfterLog,
  };
}

/** Rolls the stored state forward to fx.now (running -> chime etc.) and persists it. */
function derive(fx) {
  const result = deriveNow(fx.state, engineSettings(fx), fx.now);
  fx.state = result.state;
  return result.remainingSeconds;
}

function pushEntries(fx, entriesToInsert) {
  for (const e of entriesToInsert) {
    fx.entries.push({
      id: `flow-${fx.entries.length}`,
      from: new Date(e.from).toISOString(),
      to: new Date(e.to).toISOString(),
      tag: e.tag,
      feel: e.feel,
      intent: e.intent,
      bullets: e.bullets,
    });
  }
}

function statePayload(fx, todayStart, todayEnd) {
  const remainingSeconds = derive(fx);
  const payload = {
    mode: fx.state.mode,
    remainingSeconds,
    chimeFrom: fx.state.chimeFrom,
    chimeTo: fx.state.chimeTo,
    awayKind: fx.state.awayKind,
    awaySince: fx.state.awaySince,
    draftBullets: fx.state.draftBullets.length ? fx.state.draftBullets : [""],
    draftTag: fx.state.draftTag,
    draftFeel: fx.state.draftFeel,
    draftIntent: fx.state.draftIntent,
    phraseIdx: fx.state.phraseIdx,
    settings: fx.settings,
  };
  if (todayStart !== null && todayEnd !== null) {
    payload.count = fx.entries.filter((e) => {
      const t = new Date(e.from).getTime();
      return t >= todayStart && t < todayEnd;
    }).length;
  }
  return payload;
}

async function routeStatefulApi(page, fx) {
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const { pathname } = url;
    const method = req.method();

    const readJson = () => {
      try {
        return req.postDataJSON() ?? {};
      } catch {
        return {};
      }
    };

    if (pathname === "/api/state" && method === "GET") {
      const todayStart = url.searchParams.has("todayStart")
        ? Number(url.searchParams.get("todayStart"))
        : null;
      const todayEnd = url.searchParams.has("todayEnd")
        ? Number(url.searchParams.get("todayEnd"))
        : null;
      return route.fulfill({ json: statePayload(fx, todayStart, todayEnd) });
    }

    if (pathname === "/api/timer" && method === "POST") {
      derive(fx); // roll running -> chime first, exactly like the real handler
      const action = readJson();
      const result = dispatch(fx.state, engineSettings(fx), action, fx.now);
      fx.state = result.state;
      pushEntries(fx, result.entriesToInsert);
      return route.fulfill({ json: statePayload(fx, null, null) });
    }

    if (pathname === "/api/entries" && method === "GET") {
      const hasRange = url.searchParams.has("from");
      const from = Number(url.searchParams.get("from"));
      const to = Number(url.searchParams.get("to"));
      const list = fx.entries
        .filter((e) => {
          if (!hasRange) return true; // no params = full history (grid view)
          const t = new Date(e.from).getTime();
          return t >= from && t < to;
        })
        .sort(
          (a, b) => new Date(b.from).getTime() - new Date(a.from).getTime(),
        );
      return route.fulfill({ json: list });
    }

    const entryMatch = pathname.match(/^\/api\/entries\/([^/]+)$/);
    if (entryMatch && method === "PATCH") {
      const entry = fx.entries.find((e) => e.id === entryMatch[1]);
      if (!entry) {
        return route.fulfill({ status: 404, json: { error: "not found" } });
      }
      Object.assign(entry, readJson());
      return route.fulfill({ json: entry });
    }

    if (pathname === "/api/settings" && method === "GET") {
      return route.fulfill({ json: fx.settings });
    }
    if (pathname === "/api/settings" && method === "PATCH") {
      Object.assign(fx.settings, readJson());
      return route.fulfill({ json: fx.settings });
    }

    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function fail(step, message) {
  throw new Error(`[flow-check] FAIL ${step}: ${message}`);
}

function assertEqual(step, label, actual, expected) {
  if (actual !== expected) {
    fail(
      step,
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function pass(step) {
  console.log(`[flow-check] PASS ${step}`);
}

/** Advance the browser clock and the fixture clock together. */
async function tick(page, fx, ms) {
  fx.now += ms;
  await page.clock.fastForward(ms);
}

const MIN = 60_000;

async function main() {
  // 09:00 local today, so ~5.5 fast-forwarded hours stay inside one local day
  // (the header's today-bounds and the vine's day view both key off local dates).
  const t0Date = new Date();
  t0Date.setHours(9, 0, 0, 0);
  const T0 = t0Date.getTime();

  const fx = createFlowFixture(T0);
  const server = await startServer({ E2E_BYPASS_AUTH: "1" });
  const browser = await launchChromium();

  try {
    const page = await browser.newPage();

    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("console", (msg) => {
      // The harness runs against a fake Clerk project (see FAKE_CLERK_ENV), so
      // Clerk's own JS bundle can never load — both error shapes are artifacts
      // of that, not app defects.
      if (
        msg.type() === "error" &&
        !msg.text().includes(FAKE_CLERK_FRONTEND_HOST) &&
        !msg.location()?.url?.includes(FAKE_CLERK_FRONTEND_HOST) &&
        !msg.text().includes("Failed to load Clerk JS")
      ) {
        pageErrors.push(`console error: ${msg.text()}`);
      }
    });

    await page.clock.install({ time: T0 });
    await routeStatefulApi(page, fx);
    await gotoWithRetry(page, BASE_URL, { waitUntil: "domcontentloaded" });
    await page.getByTestId("bullet-jotter").waitFor();

    // ---- 1. Hour rollover --------------------------------------------------
    await tick(page, fx, 61 * MIN);
    await page.getByTestId("chime-overlay").waitFor();

    // Wait a further 30 minutes AT the chime: the shown range's end must be
    // hourStart + session length, not "now".
    await tick(page, fx, 30 * MIN);
    const expectedRange = fmtChimeRange(T0, T0 + 60 * MIN);
    const overlayText = await page.getByTestId("chime-overlay").innerText();
    if (!overlayText.includes(expectedRange)) {
      fail(
        "1-rollover",
        `chime overlay should show "${expectedRange}" (hourStart + session), got: ${overlayText.replace(/\n/g, " | ")}`,
      );
    }
    assertEqual("1-rollover", "fixture mode", fx.state.mode, "chime");
    pass("1-rollover: chime raised; range end pinned to hourStart + session");

    // ---- 2. Recap + log with tag inference ---------------------------------
    await page.getByTestId("chime-overlay").click();
    await page.getByTestId("recap-bar").waitFor();

    await page.getByTestId("bullet-input-0").fill("Cleared the inbox to zero");
    await page.getByTestId("bullet-input-0").press("Enter");
    await page
      .getByTestId("bullet-input-1")
      .fill("Replied to the vendor thread");
    // No tag picked — inference from "inbox" must fire inside the engine.
    await page.getByTestId("recap-log-it").click();

    await page
      .locator('[data-testid="vine-container"] article')
      .first()
      .waitFor();
    const entryCount = fx.entries.length;
    assertEqual("2-log", "entries after log", entryCount, 1);
    assertEqual("2-log", "inferred tag", fx.entries[0].tag, "Comms");
    // CSS uppercases the tag label in the vine, so compare case-insensitively.
    const dayViewText = (
      await page.getByTestId("vine-container").innerText()
    ).toUpperCase();
    if (!dayViewText.includes("COMMS")) {
      fail(
        "2-log",
        `day view should show the Comms entry, got: ${dayViewText.slice(0, 200)}`,
      );
    }

    // Ring reset: engine is running again with a full session ahead of it.
    assertEqual("2-log", "mode after log", fx.state.mode, "running");
    assertEqual("2-log", "remaining after log", derive(fx), 60 * 60);

    // The header fetches its count once on mount, so the increment is observed
    // on reload (fixture state lives in this process and survives it).
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("bullet-jotter").waitFor();
    // Class names are hashed in the production build, so assert on the header's
    // text; the count reads "00" until its fetch settles, so wait for the "01".
    await page.locator("header").getByText("01", { exact: true }).waitFor();
    pass("2-log: Comms inferred, entry in day view, ring reset, count 01");

    // ---- 3. Skip logs nothing and rotates the phrase ------------------------
    // The engine advances phraseIdx by one per logged/skipped hour; the dial
    // shows PHRASES[phraseIdx]. After the step-2 log we're on 1; skip moves to 2.
    const phraseBefore = PHRASES[fx.state.phraseIdx][0];
    await page.getByText(phraseBefore).waitFor();

    // The dial's arc animates continuously, so force the click (same as visual-check).
    await page.getByTitle("Ring it now").click({ force: true });
    await page.getByTestId("chime-overlay").waitFor();
    await page.getByTestId("chime-overlay").click();
    await page.getByTestId("recap-bar").waitFor();
    await page.getByTestId("recap-skip").click();
    await page.getByTestId("recap-bar").waitFor({ state: "hidden" });

    assertEqual("3-skip", "entries after skip", fx.entries.length, 1);
    const phraseAfter = PHRASES[fx.state.phraseIdx][0];
    if (phraseAfter === phraseBefore) {
      fail("3-skip", "engine phraseIdx did not advance on skip");
    }
    await page.getByText(phraseAfter).waitFor();
    pass("3-skip: no entry logged, phrase rotated");

    // ---- 4. Away backfill ----------------------------------------------------
    await page.getByTestId("control-sleep").click();
    await page.getByTestId("away-overlay").waitFor();
    const entriesBeforeAway = fx.entries.length;

    await tick(page, fx, 3 * 60 * MIN + 20 * MIN); // 3h20m
    await page.getByTestId("away-return-button").click();
    await page.getByTestId("away-overlay").waitFor({ state: "hidden" });

    const newBlocks = fx.entries.slice(entriesBeforeAway);
    assertEqual("4-away", "backfilled blocks", newBlocks.length, 4);
    for (const block of newBlocks) {
      assertEqual("4-away", "backfilled tag", block.tag, "Asleep");
    }
    assertEqual("4-away", "mode after return", fx.state.mode, "running");
    pass("4-away: 3h20m sleep backfilled as 4 Asleep blocks, timer running");

    // ---- 5. Pause survives reload --------------------------------------------
    await page.getByTestId("control-pause-resume").click();
    await page
      .getByTestId("control-pause-resume")
      .filter({ hasText: "Resume" })
      .waitFor();
    const remainingWhilePaused = fx.state.pausedRemaining;
    if (remainingWhilePaused === null || remainingWhilePaused === undefined) {
      fail("5-pause", "engine should be holding a pausedRemaining");
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByTestId("control-pause-resume")
      .filter({ hasText: "Resume" })
      .waitFor();
    assertEqual("5-pause", "mode after reload", fx.state.mode, "paused");
    assertEqual(
      "5-pause",
      "remaining after reload",
      fx.state.pausedRemaining,
      remainingWhilePaused,
    );
    pass("5-pause: still paused after reload with the same remaining");

    if (pageErrors.length > 0) {
      fail("page-errors", `\n${pageErrors.join("\n")}`);
    }

    console.log("[flow-check] all flows passed");
  } finally {
    await browser.close();
    await server.stop();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
