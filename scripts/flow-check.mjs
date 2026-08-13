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
import {
  blockEndFor,
  deriveNow,
  dispatch,
  floorHourBoundary,
  initialState,
} from "../lib/timer/engine.ts";
import { fmtChimeRange } from "../lib/time/index.ts";
import {
  BASE_URL,
  FAKE_CLERK_FRONTEND_HOST,
  gotoWithRetry,
  reloadWithRetry,
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
    lastBatchId: null,
    settings: {
      soundOn: false,
      chimeVolume: 0.5,
      pauseAfterLog: false,
      recentAwayLabels: [],
    },
    entries: [],
  };
}

function engineSettings(fx) {
  return {
    pauseAfterLog: fx.settings.pauseAfterLog,
  };
}

/** Rolls the stored state forward to fx.now (running -> chime etc.) and persists it. */
function derive(fx) {
  const result = deriveNow(fx.state, fx.now);
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
    hourStart: fx.state.hourStart,
    blockEnd: blockEndFor(fx.state.hourStart),
    chimeFrom: fx.state.chimeFrom,
    chimeTo: fx.state.chimeTo,
    awayKind: fx.state.awayKind,
    awaySince: fx.state.awaySince,
    awayLabel: fx.state.awayLabel,
    draftBullets: fx.state.draftBullets.length ? fx.state.draftBullets : [""],
    draftTag: fx.state.draftTag,
    draftFeel: fx.state.draftFeel,
    draftIntent: fx.state.draftIntent,
    phraseIdx: fx.state.phraseIdx,
    settings: fx.settings,
    serverNow: fx.now,
    userKey: "e2e",
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

    if (pathname === "/api/timer/sync" && method === "POST") {
      const body = readJson();
      if (fx.lastBatchId !== null && fx.lastBatchId === body.batchId) {
        return route.fulfill({
          json: { applied: false, state: statePayload(fx, null, null) },
        });
      }
      // Replay each record AT ITS OWN client timestamp (rec.at, not fx.now),
      // deriving first — exactly like the real sync handler. Dispatching at
      // fx.now instead would pass today and rot silently.
      for (const rec of body.actions ?? []) {
        fx.state = deriveNow(fx.state, rec.at).state;
        const result = dispatch(
          fx.state,
          engineSettings(fx),
          rec.action,
          rec.at,
        );
        fx.state = result.state;
        pushEntries(fx, result.entriesToInsert);
      }
      fx.lastBatchId = body.batchId;
      const ts = body.todayStart ?? null;
      const te = body.todayEnd ?? null;
      return route.fulfill({
        json: { applied: true, state: statePayload(fx, ts, te) },
      });
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

/** Let the client's background flusher fire (3s cadence) so fixture-side
 *  assertions observe the flushed state. UI assertions never need this —
 *  the UI is optimistic — only `fx.*` reads do. */
async function flushTick(page, fx) {
  await tick(page, fx, 3_500);
}

/** fastForward fires the flusher's virtual timer, but the intercepted POST
 *  completes in REAL time after fastForward resolves — poll the fixture
 *  until the flush has actually landed. */
async function waitForFixture(step, label, predicate) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  fail(step, `timed out waiting for fixture: ${label}`);
}

const MIN = 60_000;

async function main() {
  // 09:00 local today, so ~7.5 fast-forwarded hours stay inside one local day
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
    page.on("pageerror", (err) => {
      const text = String(err);
      // Clerk JS can never load from the fake frontend host; the big clock
      // fast-forwards now fire its load-timeout as an uncaught rejection too —
      // the same artifact the console filter below already excludes.
      if (
        text.includes(FAKE_CLERK_FRONTEND_HOST) ||
        text.includes("Failed to load Clerk JS")
      ) {
        return;
      }
      pageErrors.push(text);
    });
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

    // The WAL persists in localStorage; clear on every document load so the
    // flows stay deterministic (reloads intentionally drop unflushed local
    // records here — WAL recovery is covered by the client unit tests).
    await page.addInitScript(() => {
      // Init scripts run in every frame, including opaque-origin ones where
      // localStorage access throws a SecurityError — guard it.
      try {
        localStorage.clear();
      } catch {
        /* inaccessible in this frame — nothing to clear */
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
    // the block's own :00 boundary, not "now". T0 is 09:00 local, which is
    // hour-aligned in any whole-hour-offset timezone, so the boundary is
    // exactly one hour after the start.
    await tick(page, fx, 30 * MIN);
    const expectedRange = fmtChimeRange(T0, blockEndFor(T0));
    const overlayText = await page.getByTestId("chime-overlay").innerText();
    if (!overlayText.includes(expectedRange)) {
      fail(
        "1-rollover",
        `chime overlay should show "${expectedRange}" (the block's :00), got: ${overlayText.replace(/\n/g, " | ")}`,
      );
    }
    // The natural chime is derived, not dispatched: the fixture's stored
    // state still says "running" until something rolls it forward, exactly
    // like the real DB row. Derive at the fixture clock to observe it.
    derive(fx);
    assertEqual("1-rollover", "fixture mode", fx.state.mode, "chime");
    pass("1-rollover: chime raised; range end pinned to the block's :00");

    // ---- 2. Recap + log with tag inference ---------------------------------
    await page.getByTestId("chime-overlay").click();
    await page.getByTestId("recap-bar").waitFor();

    await page.getByTestId("bullet-input-0").fill("Did the laundry");
    await page.getByTestId("bullet-input-0").press("Enter");
    await page.getByTestId("bullet-input-1").fill("Cooked dinner for everyone");
    // No tag picked — inference from "laundry"/"cooked" must fire inside
    // the engine and outweigh Social's "dinner" hit.
    await page.getByTestId("recap-log-it").click();

    await page
      .locator('[data-testid="vine-container"] article')
      .first()
      .waitFor();
    const entryCount = fx.entries.length;
    assertEqual("2-log", "entries after log", entryCount, 1);
    assertEqual("2-log", "inferred tag", fx.entries[0].tag, "Chores");
    // CSS uppercases the tag label in the vine, so compare case-insensitively.
    const dayViewText = (
      await page.getByTestId("vine-container").innerText()
    ).toUpperCase();
    if (!dayViewText.includes("CHORES")) {
      fail(
        "2-log",
        `day view should show the Chores entry, got: ${dayViewText.slice(0, 200)}`,
      );
    }

    // Ring reset: engine is running again, counting down to the next :00
    // (the log landed mid-hour, so the new bucket starts at the floored :00
    // and less than an hour remains).
    assertEqual("2-log", "mode after log", fx.state.mode, "running");
    assertEqual(
      "2-log",
      "remaining after log",
      derive(fx),
      Math.floor((blockEndFor(fx.now) - fx.now) / 1000),
    );

    // The header fetches its count once on mount, so the increment is observed
    // on reload (fixture state lives in this process and survives it).
    await reloadWithRetry(page, { waitUntil: "domcontentloaded" });
    await page.getByTestId("bullet-jotter").waitFor();
    // Class names are hashed in the production build, so assert on the header's
    // text; the count reads "00" until its fetch settles, so wait for the "01".
    await page.locator("header").getByText("01", { exact: true }).waitFor();
    pass("2-log: Chores inferred, entry in day view, ring reset, count 01");

    // ---- 3. Skip logs nothing and rotates the phrase ------------------------
    // The engine advances phraseIdx by one per logged/skipped hour; the dial
    // shows PHRASES[phraseIdx]. After the step-2 log we're on 1; skip moves to 2.
    const phraseBefore = PHRASES[fx.state.phraseIdx][0];
    await page.getByText(phraseBefore).waitFor();

    // The End early button is gone (hours only end at :00) — raise the chime
    // by advancing both clocks past the current block's wall-clock boundary.
    const step3Advance = blockEndFor(fx.now) - fx.now + MIN;
    await tick(page, fx, step3Advance);
    await page.getByTestId("chime-overlay").waitFor();
    await page.getByTestId("chime-overlay").click();
    await page.getByTestId("recap-bar").waitFor();
    await page.getByTestId("recap-skip").click();
    await page.getByTestId("recap-bar").waitFor({ state: "hidden" });

    const phraseIdxBefore = fx.state.phraseIdx;
    await flushTick(page, fx);
    await waitForFixture(
      "3-skip",
      "skip to flush",
      () => fx.state.phraseIdx !== phraseIdxBefore,
    );
    assertEqual("3-skip", "entries after skip", fx.entries.length, 1);
    const phraseAfter = PHRASES[fx.state.phraseIdx][0];
    if (phraseAfter === phraseBefore) {
      fail("3-skip", "engine phraseIdx did not advance on skip");
    }
    await page.getByText(phraseAfter).waitFor();
    pass("3-skip: no entry logged, phrase rotated");

    // ---- 4. Away backfill ----------------------------------------------------
    const awayHourStart = fx.state.hourStart; // the interrupted hour's :00
    await page.getByTestId("control-sleep").click();
    await page.getByTestId("away-overlay").waitFor();
    const entriesBeforeAway = fx.entries.length;

    await tick(page, fx, 3 * 60 * MIN + 20 * MIN); // 3h20m
    await page.getByTestId("away-return-button").click();
    await page.getByTestId("away-overlay").waitFor({ state: "hidden" });
    const awayReturnAt = fx.now;
    await flushTick(page, fx);
    await waitForFixture(
      "4-away",
      "away blocks to flush",
      () => fx.entries.length > entriesBeforeAway,
    );

    // Aligned backfill: one entry for the interrupted hour (its floored :00
    // to its boundary), then one entry per WHOLE :00→:00 hour up to the
    // return's floored hour. The trailing partial hour is NOT its own entry —
    // it seeds the resumed block's draft as an "Asleep (N min)" bullet.
    // Compute the expectation from the same boundary walk the engine does.
    const expectedBlocks = (() => {
      const lastBoundary = floorHourBoundary(awayReturnAt);
      let count = 1; // the interrupted hour
      let from = blockEndFor(awayHourStart);
      while (from < lastBoundary) {
        from = blockEndFor(from);
        count += 1;
      }
      return count;
    })();
    const newBlocks = fx.entries.slice(entriesBeforeAway);
    assertEqual(
      "4-away",
      "backfilled blocks",
      newBlocks.length,
      expectedBlocks,
    );
    for (const block of newBlocks) {
      assertEqual("4-away", "backfilled tag", block.tag, "Asleep");
    }
    // Entries are hour buckets now: every block starts AND ends on a
    // wall-clock :00.
    for (const block of newBlocks) {
      if (new Date(block.from).getTime() % (60 * MIN) !== 0) {
        fail("4-away", `block ${block.from} does not start on a :00`);
      }
      if (new Date(block.to).getTime() % (60 * MIN) !== 0) {
        fail("4-away", `block ending ${block.to} does not end on a :00`);
      }
    }
    // The trailing partial hour lives in the resumed block's draft instead.
    const seededDraft = fx.state.draftBullets.join(" | ");
    if (!/Asleep \(\d+ min\)/.test(seededDraft)) {
      fail(
        "4-away",
        `resumed draft should carry the trailing "Asleep (N min)" bullet, got: ${JSON.stringify(fx.state.draftBullets)}`,
      );
    }
    assertEqual("4-away", "mode after return", fx.state.mode, "running");
    pass(
      `4-away: 3h20m sleep backfilled as ${newBlocks.length} aligned Asleep blocks (trailing partial seeds the draft), timer running`,
    );

    // ---- 5. "Wait for me" hold survives reload -------------------------------
    // Mid-hour pause was removed from the UI (hours are honest wall-clock
    // blocks); the paused state is now only reachable as the between-hours
    // hold from the pauseAfterLog setting. Drive the setting through the UI
    // so the client's local copy updates too (settings stay a direct PATCH,
    // outside the WAL).
    await page.getByTestId("vine-settings-button").click();
    await page.getByTestId("pause-wait-for-me-button").click();
    await page.keyboard.press("Escape");
    // As in step 3: no End early button any more, cross the :00 boundary.
    const step5Advance = blockEndFor(fx.now) - fx.now + MIN;
    await tick(page, fx, step5Advance);
    await page.getByTestId("chime-overlay").waitFor();
    await page.getByTestId("chime-overlay").click();
    await page.getByTestId("recap-bar").waitFor();
    await page.getByTestId("recap-log-it").click();
    await page.getByTestId("pause-overlay").waitFor();
    await flushTick(page, fx);
    await waitForFixture(
      "5-pause",
      "hold to flush",
      () => fx.state.mode === "paused",
    );
    assertEqual("5-pause", "mode while holding", fx.state.mode, "paused");

    await reloadWithRetry(page, { waitUntil: "domcontentloaded" });
    await page.getByTestId("pause-overlay").waitFor();
    assertEqual("5-pause", "mode after reload", fx.state.mode, "paused");
    // And the hold is escapable: click anywhere on the overlay to start a
    // fresh block running to the next :00.
    await page.getByTestId("pause-overlay").click();
    await page.getByTestId("pause-overlay").waitFor({ state: "hidden" });
    const resumeAt = fx.now;
    await flushTick(page, fx);
    await waitForFixture(
      "5-pause",
      "resume to flush",
      () => fx.state.mode === "running",
    );
    assertEqual("5-pause", "mode after resume", fx.state.mode, "running");
    // The resumed block is the hour BUCKET containing the resume click: its
    // hourStart is the click time floored to :00. The record's timestamp is
    // the page's clock at click time (which drifts in real time between
    // fastForwards), but flooring absorbs that drift — assert the bucket
    // shape rather than exact equality.
    if (
      fx.state.hourStart % (60 * MIN) !== 0 ||
      fx.state.hourStart > resumeAt ||
      resumeAt - fx.state.hourStart >= 60 * MIN
    ) {
      fail(
        "5-pause",
        `block should be the :00 bucket containing the resume click (hourStart ${fx.state.hourStart}, resumeAt ${resumeAt})`,
      );
    }
    pass("5-pause: wait-for-me hold survives reload and resumes on click");

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
