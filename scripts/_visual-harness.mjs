// Shared driver for the local visual-regression harness (scripts/visual-check.mjs).
//
// This module owns everything that isn't specific to "which screenshot am I taking right
// now": building the app (once) and starting it against PORT, waiting for it to come up,
// installing a fake-but-realistic /api/** backend via Playwright's page.route (so the
// harness never touches Neon/Upstash/Clerk), and the ordered list of states to drive +
// screenshot.
//
// Ports 4796-4799 are used by sibling projects on this machine — this harness owns 4795.
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";

export const PORT = 4795;
// 127.0.0.1, not localhost: Chromium's DNS resolution for "localhost" is unreliable in some
// sandboxed/headless environments, even though plain Node fetch() resolves it fine.
export const BASE_URL = `http://127.0.0.1:${PORT}`;

// The domain encoded into FAKE_CLERK_ENV's publishable key below — Clerk's client-side SDK
// loads its own JS bundle from this host, which doesn't exist. Those failed loads land in the
// page's console as "Failed to load resource" errors; the harness ignores console errors that
// point back at this host (see driveVisualStates), since they're an artifact of using a fake
// Clerk project rather than a real app defect.
export const FAKE_CLERK_FRONTEND_HOST = "e2e-harness.example.com";

// A syntactically valid (but fake) Clerk publishable/secret key pair. @clerk/nextjs throws
// at request time if these are missing entirely, even when E2E_BYPASS_AUTH skips the actual
// auth check — so the harness always supplies them, real Clerk project or not.
export const FAKE_CLERK_ENV = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_ZTJlLWhhcm5lc3MuZXhhbXBsZS5jb20k",
  CLERK_SECRET_KEY:
    "sk_test_e2eharnessfakeSecretKeyForLocalOnly0000000000000000",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
};

let built = false;

function run(cmd, args, opts) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${result.status}`);
  }
}

/** Builds the app once per process, then starts `next start` on PORT with the given env. */
export async function startServer(env) {
  if (!built) {
    run("npx", ["next", "build"], {
      env: { ...process.env, ...FAKE_CLERK_ENV },
    });
    built = true;
  }

  const proc = spawn("npx", ["next", "start", "-p", String(PORT)], {
    env: { ...process.env, ...FAKE_CLERK_ENV, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  proc.stdout.on("data", (d) => (output += d.toString()));
  proc.stderr.on("data", (d) => (output += d.toString()));

  const exited = new Promise((_, reject) => {
    proc.once("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`next start exited early (${code}):\n${output}`));
      }
    });
  });

  await Promise.race([waitForServer(BASE_URL), exited]);

  return {
    proc,
    async stop() {
      proc.removeAllListeners("exit");
      proc.kill("SIGTERM");
      await new Promise((resolve) => proc.once("exit", resolve));
    },
  };
}

/**
 * Chromium's own loopback DNS resolution can flake for the first attempt or two on machines
 * running a VPN with a custom resolver (e.g. Tailscale MagicDNS) — Node's fetch() resolves
 * 127.0.0.1 instantly every time, but Chromium's separate network process occasionally throws
 * ERR_NAME_NOT_RESOLVED until it settles. Node's fetch() against waitForServer already proved
 * the server itself is up, so a short retry here is purely working around that resolver flake.
 */
export async function gotoWithRetry(page, url, options, attempts = 5) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await page.goto(url, options);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastError;
}

export async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server didn't start at ${url} within ${timeoutMs}ms`);
}

/** Launches Chromium, downloading the browser binary on first run if needed. */
export async function launchChromium() {
  try {
    const browser = await chromium.launch();
    return browser;
  } catch {
    run("npx", ["playwright", "install", "chromium"]);
    return chromium.launch();
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HOUR_MS = 3_600_000;

/** Mirrors design/PomoDiary.dc.html's demo seed (lines 307-333): a spread of hours today
 * and yesterday plus an away block, with a few extra entries further back so the 10-day
 * grid shows a real spread. Day offset 3 is deliberately left empty (the empty-state shot). */
export function seedEntries(now) {
  let n = 0;
  // Anchor at noon TODAY, not the wall clock: seeding "2 hours ago" from a
  // just-after-midnight run put every "today" entry on yesterday, emptying
  // the day view and failing the harness's article checks.
  const anchor = new Date(now);
  anchor.setHours(12, 0, 0, 0);
  const base = anchor.getTime();
  const mk = (agoHours, tag, feel, intent, bullets) => ({
    id: `seed-${n++}`,
    from: new Date(base - agoHours * HOUR_MS).toISOString(),
    to: new Date(base - (agoHours - 1) * HOUR_MS).toISOString(),
    tag,
    feel,
    intent,
    bullets,
  });

  return [
    mk(2, "Comms", "Scattered", "no", [
      "Slack backlog — 40 min of it",
      "Two calls I didn't need to be on",
      "Started the pricing doc, got three lines in",
    ]),
    mk(3, "Deep work", "Charged", "yes", [
      "Rewrote the onboarding empty states",
      "Finally cut the second modal",
    ]),
    mk(4, "Meetings", "Drained", "yes", [
      "Roadmap review",
      "Follow-up with Priya about Q3 scope",
    ]),
    mk(5, "Deep work", "Steady", "yes", [
      "Bug triage — closed 6",
      "Paired with Sam on the auth redirect",
    ]),
    mk(6, "Errands", "Steady", "yes", [
      "Walked to the post office",
      "Picked up the parcel",
    ]),
    mk(28, "Deep work", "Charged", "yes", ["Drafted the Q3 plan"]),
    mk(29, "Meetings", "Steady", "yes", ["Design review"]),
    mk(30, "Comms", "Scattered", "no", ["Inbox, mostly"]),
    mk(31, "At work", "—", "yes", ["At work"]),
    mk(32, "At work", "—", "yes", ["At work"]),
    mk(40, "Asleep", "—", "yes", ["Asleep"]),
    mk(41, "Asleep", "—", "yes", ["Asleep"]),
    mk(42, "Asleep", "—", "yes", ["Asleep"]),
    // Days 5-8 ago, so the grid shows a real multi-day spread (day 3 stays empty).
    mk(5 * 24 + 2, "Deep work", "Steady", "yes", ["Shipped the settings page"]),
    mk(6 * 24 + 5, "Rest", "Steady", "yes", ["Sat in the garden"]),
    mk(7 * 24 + 3, "Learning", "Charged", "yes", [
      "Read the OKLCH paper properly",
    ]),
    mk(8 * 24 + 4, "Lost it", "Drained", "no", ["Scrolling. No excuse."]),
  ];
}

export function seedSettings() {
  return {
    sessionMinutes: 60,
    soundOn: true,
    chimeVolume: 0.8,
    pauseAfterLog: false,
  };
}

/** The empty grid day (see seedEntries) — used by the day-view-empty step. */
export const EMPTY_DAY_INDEX = 3;

// ---------------------------------------------------------------------------
// Stateful /api/timer + /api/state fixture — mirrors lib/timer/engine.ts's mode
// transitions closely enough to drive every state the harness needs to screenshot,
// without a database.
// ---------------------------------------------------------------------------

export function createFixtureState(now) {
  return {
    mode: "running",
    chimeFrom: null,
    chimeTo: null,
    awayKind: null,
    awaySince: null,
    draftBullets: [""],
    draftTag: null,
    draftFeel: null,
    draftIntent: null,
    phraseIdx: 0,
    remainingSeconds: seedSettings().sessionMinutes * 60,
    settings: seedSettings(),
    entries: seedEntries(now),
  };
}

function buildStatePayload(state, now) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const count = state.entries.filter(
    (e) => new Date(e.from).getTime() >= todayStart.getTime(),
  ).length;

  return {
    mode: state.mode,
    remainingSeconds: state.remainingSeconds,
    chimeFrom: state.chimeFrom,
    chimeTo: state.chimeTo,
    awayKind: state.awayKind,
    awaySince: state.awaySince,
    draftBullets: state.draftBullets,
    draftTag: state.draftTag,
    draftFeel: state.draftFeel,
    draftIntent: state.draftIntent,
    phraseIdx: state.phraseIdx,
    settings: state.settings,
    count,
  };
}

function resetDraft(state) {
  state.draftBullets = [""];
  state.draftTag = null;
  state.draftFeel = null;
  state.draftIntent = null;
  state.chimeFrom = null;
  state.chimeTo = null;
}

function applyAction(state, action, now) {
  switch (action.type) {
    case "pause":
      if (state.mode === "running") state.mode = "paused";
      break;
    case "resume":
      if (state.mode === "paused") state.mode = "running";
      break;
    case "restart":
      state.mode = "running";
      state.remainingSeconds = state.settings.sessionMinutes * 60;
      break;
    case "ringNow":
      state.mode = "chime";
      state.chimeFrom = now - state.settings.sessionMinutes * 60_000;
      state.chimeTo = now;
      break;
    case "acknowledge":
      state.mode = "recap";
      break;
    case "log": {
      const bullets = (action.payload?.bullets ?? []).filter(
        (b) => b.trim().length > 0,
      );
      state.entries.push({
        id: `logged-${state.entries.length}`,
        from: new Date(state.chimeFrom ?? now - HOUR_MS).toISOString(),
        to: new Date(state.chimeTo ?? now).toISOString(),
        tag: action.payload?.tag || "Deep work",
        feel: action.payload?.feel || "Steady",
        intent: action.payload?.intent ?? null,
        bullets: bullets.length ? bullets : ["(nothing written down)"],
      });
      state.mode = state.settings.pauseAfterLog ? "paused" : "running";
      state.remainingSeconds = state.settings.sessionMinutes * 60;
      resetDraft(state);
      break;
    }
    case "skip":
      state.mode = state.settings.pauseAfterLog ? "paused" : "running";
      state.remainingSeconds = state.settings.sessionMinutes * 60;
      resetDraft(state);
      break;
    case "awayStart":
      state.mode = "away";
      state.awayKind = action.kind;
      state.awaySince = now;
      break;
    case "awayReturn":
      state.mode = "running";
      state.awayKind = null;
      state.awaySince = null;
      state.remainingSeconds = state.settings.sessionMinutes * 60;
      break;
    case "draftUpdate": {
      const patch = action.patch ?? {};
      if ("bullets" in patch) state.draftBullets = patch.bullets;
      if ("tag" in patch) state.draftTag = patch.tag;
      if ("feel" in patch) state.draftFeel = patch.feel;
      if ("intent" in patch) state.draftIntent = patch.intent;
      break;
    }
    default:
      break;
  }
}

/** Installs the fixture /api/** backend on a Playwright page. */
export async function routeApi(page, state) {
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const { pathname } = url;
    const method = req.method();
    const now = Date.now();

    if (pathname === "/api/state" && method === "GET") {
      return route.fulfill({ json: buildStatePayload(state, now) });
    }

    if (pathname === "/api/timer" && method === "POST") {
      let action = {};
      try {
        action = req.postDataJSON();
      } catch {
        action = {};
      }
      applyAction(state, action, now);
      return route.fulfill({ json: buildStatePayload(state, now) });
    }

    if (pathname === "/api/entries" && method === "GET") {
      const hasRange = url.searchParams.has("from");
      const from = Number(url.searchParams.get("from"));
      const to = Number(url.searchParams.get("to"));
      const list = state.entries
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
      const entry = state.entries.find((e) => e.id === entryMatch[1]);
      if (!entry) {
        return route.fulfill({
          status: 404,
          json: { error: "Entry not found" },
        });
      }
      let patch = {};
      try {
        patch = req.postDataJSON();
      } catch {
        patch = {};
      }
      Object.assign(entry, patch);
      return route.fulfill({ json: entry });
    }

    if (pathname === "/api/settings" && method === "GET") {
      return route.fulfill({ json: state.settings });
    }

    if (pathname === "/api/settings" && method === "PATCH") {
      let patch = {};
      try {
        patch = req.postDataJSON();
      } catch {
        patch = {};
      }
      Object.assign(state.settings, patch);
      return route.fulfill({ json: state.settings });
    }

    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// PAGES/FLOWS — the ordered list of states the harness screenshots. Each step's `run`
// drives the real composed UI (clicks, typing) against the fixture state above; the
// harness screenshots the full page after `run` resolves and `waitFor` is satisfied.
// ---------------------------------------------------------------------------

export const FLOWS = [
  {
    name: "01-running-hour-suggested-tag",
    description:
      "Running hour with bullets typed; the tag picker suggests a chip from the text.",
    covers: ["Dial", "BulletJotter", "PickerStrip", "ControlBar", "Vine"],
    waitFor: '[data-testid="bullet-jotter"]',
    async run(page) {
      await page
        .getByTestId("bullet-input-0")
        .fill("Wrote the pricing page copy");
    },
  },
  {
    name: "02-picked-tag",
    description: "A tag chip picked explicitly in the picker strip.",
    covers: ["PickerStrip"],
    waitFor: '[data-testid="chip-Deep work"][aria-pressed="true"]',
    async run(page) {
      await page.getByTestId("chip-Deep work").click();
    },
  },
  {
    name: "03-paused",
    description: "The full-panel pause overlay shown while the clock waits.",
    covers: ["PauseOverlay", "ControlBar"],
    waitFor: '[data-testid="pause-overlay"]',
    async run(page) {
      await page.getByTestId("control-pause-resume").click();
    },
  },
  {
    name: "04-chime-overlay",
    description: "The chime overlay shown when the hour rings.",
    covers: ["ChimeOverlay"],
    waitFor: '[data-testid="chime-overlay"]',
    async run(page) {
      await page.getByTestId("pause-overlay").click(); // click anywhere resumes
      // force: true — the dial's progress arc animates continuously (CSS transition tied to
      // the ticking countdown), so Playwright's actionability "element is stable" check never
      // settles on its own.
      await page.getByTitle("Ring it now").click({ force: true });
    },
  },
  {
    name: "05-recap-with-pickers",
    description: "Recap bar and pickers shown after acknowledging the chime.",
    covers: ["RecapBar", "PickerStrip", "BulletJotter"],
    waitFor: '[data-testid="recap-bar"]',
    async run(page) {
      await page.getByTestId("chime-overlay").click();
    },
  },
  {
    name: "06-away-sleep",
    description: "The away overlay in sleep mode.",
    covers: ["AwayOverlay", "ControlBar"],
    waitFor: '[data-testid="away-overlay"]',
    async run(page) {
      await page.getByTestId("recap-log-it").click();
      await page.getByTestId("control-sleep").click();
    },
  },
  {
    name: "07-away-work",
    description: "The away overlay in work mode.",
    covers: ["AwayOverlay", "ControlBar"],
    waitFor: '[data-testid="away-overlay"]',
    async run(page) {
      await page.getByTestId("away-return-button").click();
      await page.getByTestId("control-work").click();
    },
  },
  {
    name: "08-day-view-with-entries",
    description: "The vine's day view showing logged entries for today.",
    covers: ["Vine", "DayView"],
    waitFor: '[data-testid="vine-container"] article',
    async run(page) {
      await page.getByTestId("away-return-button").click();
    },
  },
  {
    name: "09-grid-view",
    description: "The vine's 10-day grid view.",
    covers: ["Vine", "GridView"],
    waitFor: '[data-testid="day-row-0"]',
    async run(page) {
      await page.getByTestId("vine-zoom-button").click();
    },
  },
  {
    name: "10-day-view-empty",
    description: "The day view's empty state for a day with no entries.",
    covers: ["Vine", "DayView"],
    waitFor: "text=Nothing in the basket yet.",
    async run(page) {
      await page.getByTestId(`day-row-${EMPTY_DAY_INDEX}`).click();
    },
  },
  {
    name: "11-edit-entry-open",
    description: "An entry's inline editor open in the day view.",
    covers: ["DayView", "EntryEditor"],
    waitFor: '[data-testid^="editor-"]',
    async run(page) {
      await page.getByTestId("vine-zoom-button").click();
      await page.getByTestId("day-row-0").click();
      const firstEdit = page.locator('[data-testid^="edit-button-"]').first();
      await firstEdit.click();
    },
  },
  {
    name: "12-settings-panel-open",
    description: "The settings panel opened from the vine header.",
    covers: ["SettingsPanel"],
    waitFor: '[data-testid="settings-panel"]',
    async run(page) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.getByTestId("vine-settings-button").click();
    },
  },
];

export const RESPONSIVE_FLOWS = [
  {
    name: "13-responsive-600",
    description: "Composed UI reflowed at a ~600px viewport width.",
    covers: ["Panels"],
    viewport: { width: 600, height: 1000 },
  },
  {
    name: "14-responsive-900",
    description: "Composed UI reflowed at a ~900px viewport width.",
    covers: ["Panels"],
    viewport: { width: 900, height: 1000 },
  },
];
