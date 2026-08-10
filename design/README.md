# Handoff: Pomodoro — hourly time accounting

## Overview

Pomodoro is a single-screen web app for retroactive time accounting. A timer runs for one hour. When it expires it chimes, the user acknowledges the chime, writes bullets describing what they actually did with that hour, tags it, and logs it. The next hour starts immediately. Over days this builds a log the user can read back — the point is to answer "where did my time go?" with the user's own words rather than automatic tracking.

Three features distinguish it from a standard Pomodoro timer:

1. **Pre-emptive jotting.** Bullets can be typed at any point during the running hour, not just at the chime. Whatever is typed carries into the recap.
2. **Semantic colour.** The bullets are scanned for keywords and mapped to a category ("Deep work", "Comms", "Lost it"…). Each category owns a hue; that hue colours the ring, the bullet markers, the log entry, and the activity grid. The user can override the guess.
3. **Away modes.** "Sleep" and "Work" suspend the timer and, on return, back-fill the whole absence as one-hour blocks.

## About the design files

`Pomodoro.dc.html` in this bundle is a **design reference created in HTML** — a working prototype showing intended look and behaviour, not production code to copy. It is a "Design Component": a template plus a logic class, rendered by a small runtime (`support.js`). Neither the template dialect nor the runtime should be carried into your codebase.

**The task is to recreate this design in the target codebase's existing environment** (React, Vue, SwiftUI, native, whatever is already there), using its established patterns, component library and state conventions. If no environment exists yet, choose an appropriate framework and implement it there. Read the prototype for layout, exact values and behaviour; write idiomatic code for your stack.

To view the prototype: open `Pomodoro.dc.html` in a browser (it needs `support.js` beside it, which is included).

## Fidelity

**High fidelity.** Colours, typography, spacing, copy and interactions are final. Recreate the UI closely, substituting your codebase's own primitives where they exist. Every value below is the real value used in the prototype.

The prototype has **no persistence** — reloading resets it and seeds demo data. Persistence is the first thing to add (see *Open work*).

---

## Design system

The design follows a system called **Modernist**: flat, architectural, set entirely in Archivo, near-mono red on a warm off-white, zero corner radius anywhere, strong 2px rules doing the organising. Nothing floats, nothing is decorated. Button labels are flush left, not centred.

Two rules to honour when you rebuild:

- **No border radius.** Anywhere. Squares are squares.
- **No soft dividers.** Section rules are 2px solid; only in-list separators drop to 1px.

### Design tokens

**Colour — ground and ink**

| Token | Value | Use |
| --- | --- | --- |
| Background | `#f3f2f2` | Page ground |
| Surface | `#eae9e9` | Hover fills, selected grid row |
| Text | `#201e1d` | All body and heading text |
| Accent | `#ec3013` | Primary action, status labels, chime screen, untagged ring |
| Accent hover | `#dd2b0f` | Primary button hover |
| Accent deep | `#ae1800` | Text on accent-tinted hover |
| Accent tint | `#ffe0d9` | Hover fill on accent-adjacent controls |
| Divider strong | `rgba(32,30,29,.4)` | 2px section rules, control borders |
| Divider soft | `rgba(32,30,29,.3)` | 2px borders on segmented pickers |
| Divider hairline | `rgba(32,30,29,.18)` | 1px rule under each bullet input |
| Empty cell | `#e6e3e3` | Unlogged hour in the activity grid |
| Ring track | `#e0dddd` | The unfilled part of the dial |
| Muted text | `rgba(32,30,29,.5)` / `.45` / `.38` | Secondary, tertiary, quaternary labels |

**Colour — semantic categories.** All at the same OKLCH lightness and chroma band as the accent, so no category shouts louder than another. Keep them in OKLCH; do not convert to hex and re-tune by eye.

| Category | Colour |
| --- | --- |
| Deep work | `oklch(0.58 0.20 30)` (this is the system red) |
| Admin | `oklch(0.58 0.13 250)` |
| Meetings | `oklch(0.58 0.15 305)` |
| Comms | `oklch(0.60 0.14 62)` |
| Learning | `oklch(0.58 0.14 155)` |
| Errands | `oklch(0.58 0.10 200)` |
| Rest | `oklch(0.62 0.06 130)` |
| Lost it | `oklch(0.42 0.012 40)` |
| Asleep (away) | `oklch(0.38 0.055 275)` |
| At work (away) | `oklch(0.50 0.075 235)` |
| Unfiled | `oklch(0.72 0.012 40)` |

**Typography.** One family: **Archivo** (Google Fonts, weights 400 / 600 / 800). Body 15px / 1.55 / 400.

| Role | Size | Weight | Tracking | Case |
| --- | --- | --- | --- | --- |
| Wordmark, brand numerals | 21px | 800 | -0.03em | upper |
| Panel phrase | 26px | 800 | -0.03em | sentence |
| Vine day title | 19px | 800 | -0.02em | sentence |
| Log entry start time | 19px | 800 | -0.02em | — |
| Bullet input (live) | 17px | 600 | -0.015em | sentence |
| Log entry bullet | 16px | 600 | -0.012em | sentence |
| Control bar button | 12px | 800 | 0.08em | upper |
| Section label | 11px | 800 | 0.16em | upper |
| Meta / secondary | 11px | 600 | 0.14em | upper |
| Tag chip | 11px | 800 | 0.06–0.09em | upper |
| Segmented option | 10px | 800 | 0.05em | upper |
| Grid hour ruler | 10px | 800 | 0.10em | — |
| Chime headline | `clamp(48px,7vw,78px)` | 800 | -0.04em | upper |
| Away headline | `clamp(44px,6.5vw,72px)` | 800 | -0.04em | upper |

**Spacing.** 4 / 8 / 12 / 16 / 24 / 32 scale. Panel gutters are 32px left/right on the timer side, 26px on the log side. **Radius: 0 everywhere. Shadows: none.**

---

## Layout

Full viewport, no page scroll (`height:100vh; overflow:hidden`). Column stack:

1. **Header** — 68px tall, 2px bottom rule, 26px side padding.
2. **Body** — CSS grid, `grid-template-columns: minmax(430px,46%) 1fr; grid-template-rows: minmax(0,1fr)`. Left = timer panel (2px right rule), right = log panel. Both panels are `min-height:0` flex columns; only their inner regions scroll.

**Header contents:** 13px red square + wordmark `POMODORO` (21px/800) · tagline "One hour. One honest account of it." (11px/600/upper/.5 alpha) · flex spacer · hours-logged-today count (21px/800, accent) followed by "picked today · Mon 10 Aug".

### Left panel — the timer

Vertical order, all `flex:0 0 auto` except the bullet scroller:

**a. Dial + phrase row** — flex row, 22px gap, padding 22/32/20.
- **Dial**: `width: min(124px, 17vh)`, square, `cursor:pointer` (clicking it rings the chime immediately). `animation: breathe 7s ease-in-out infinite` — a scale 1 → 1.02 → 1 pulse, the only ambient motion on the screen. SVG `viewBox="0 0 200 200"`:
  - track circle r=88, stroke `#e0dddd`, width 14
  - 12 tick marks, from r=70 to r=78, `rgba(32,30,29,.3)`, 2px, at 30° intervals
  - progress arc r=88, width 14, `stroke-dasharray: 552.92`, `stroke-dashoffset: 552.92 × (remaining / total)`, rotated -90° about centre so it starts at 12 o'clock and **depletes clockwise**. Transition `stroke-dashoffset .4s linear, stroke .5s ease`.
  - Stroke colour = the active category's hue, or `#ec3013` when nothing is tagged or inferred. **Never** the pale Unfiled grey — it disappears into the track.
  - Nothing is drawn inside the ring. No numerals; the whole point is ambient.
- **Text column**: status label (11px/800/.18em/upper, accent) → phrase (26px/800) → sub-phrase (11px/600/upper, .5 alpha) → "Since 2:14 PM · click the dial to ring it now" (11px/600/upper, .38 alpha).

**b. Bullet scroller** — `flex:1; min-height:0; overflow:auto`, 2px top rule, 32px side padding.
- Heading row: `{{ jotHeading }}` + `{{ jotHint }}` — "As you go" / "Enter for the next bullet" while running, "What did you actually do?" / "Tidy it up" in recap.
- One row per bullet: 8px square marker in the active hue (`animation: popDot .35s cubic-bezier(.2,1.6,.4,1)` — scales 0 → 1), 12px gap, borderless transparent input (17px/600), 1px bottom hairline. No visible input chrome at all.

**c. Picker strip** — pinned, `flex:0 0 auto`, 2px top rule, padding 11/32/13. Never inside the scroller: these must be reachable without scrolling.
- Label row: "Call it" + the inferred-tag hint "↳ reads like comms" rendered in that category's colour.
- Tag chips: wrapping flex, 4px gap. 11px/800/upper, 5px 9px padding, 2px border. Unselected = transparent fill, `rgba(32,30,29,.3)` border, `.7` alpha text. Suggested (inferred, not yet confirmed) = transparent fill but border and text in the category colour. Selected = filled with the category colour, white text. Hover border `#ec3013`. Clicking a selected chip deselects.
- Feeling: full-width segmented row of 4 — Charged / Steady / Scattered / Drained. 2px border, 2px inner dividers, 10px/800/upper. Selected = `#201e1d` fill, white text. **Deliberately ink, not colour** — colour means *what kind of hour*, never *how it went*.
- Intent: full-width segmented row of 2 — On purpose / Got away. Same treatment. Both rows are their own grid rows (`grid-template-columns: minmax(0,1fr)`); side by side they overflow the 430px panel.

**d. Control bar** — 2px top rule, four buttons, all 12px/800/.08em/upper, 15px/16px padding, 2px right dividers, flush-left labels with a 9px square swatch:
`Pause`/`Resume` (flex:1, red swatch, hover `#ffe0d9`/`#ae1800`) · `Restart` (outline swatch) · `Sleep` (indigo swatch) · `Work` (steel swatch). The last three hover `#eae9e9`/`#201e1d`.
A fifth button does not fit — the panel's min-content budget at 430px is about 392px for four.

**e. Recap bar** — replaces (d) in recap mode: `Log it & start the next hour` (accent fill, white, flex:1, 19/22 padding, hover `#dd2b0f`) + `Skip` (transparent, 2px left rule).

### Right panel — the log ("the vine")

**Header** — 54px, 2px bottom rule. "The vine" (11px/800/upper) · the current view title (19px/800: "Today", or "Sunday 9 Aug", or "Every day") · spacer · a full-height zoom button with a 2px left rule reading "Zoom out" or "Back to the day".

**Day view** — scrolling list, 26px side padding, newest hour first. Each entry is a grid `108px 1fr` with 22px gap, 22px vertical padding, 2px bottom rule, entering with `riseIn .5s cubic-bezier(.2,.7,.3,1)` (opacity 0 → 1, translateY 16px → 0).
- Left column: start time (19px/800) · "to 3:14 PM" (11px/600/upper/.45) · a 4px bar in the entry's category colour.
- Right column: chip row — category chip (filled with its colour, white text, 2px border of the same colour), feeling chip (outline, `.65` alpha text), intent chip (outline "Intentional" or "Unmarked"; "Got away" fills with `oklch(0.42 0.012 40)` and white text). Then the bullet list: 7px square marker in the entry's colour, offset `translateY(-2px)`, 11px gap, 16px/600 text, 5px between rows.
- Empty state: 30px accent square, "Nothing here yet." (27px/800), one explanatory line at `.55` alpha, max-width 450px.

**Grid view (zoomed out)** — 10 days as rows, 24 hours as columns.
- Row grid: `88px 1fr 42px`, 14px gap, 6px vertical padding. Left = day label ("Today", "Yesterday", then "Sat 8"), middle = `repeat(24,1fr)` with 2px gap and 22px-tall cells, right = the day's logged-hour count, zero-padded.
- A cell is the category colour of the entry whose start hour matches that column, otherwise `#e6e3e3`. Each cell has a `title` of "14:00 · Comms — Inbox, mostly".
- The whole row is clickable → sets the selected day and switches back to day view. Selected day's row sits on `#eae9e9`; hover the same.
- Above the rows, a ruler of 8 labels (00, 03 … 21) laid out on `repeat(8,1fr)`, plus a right-aligned "HRS".
- Below: a 2px rule, then a legend of every category (11px square + label) and the line "Click a day to read the hours back."

### Overlays

Both cover the left panel absolutely (`inset:0`), entering with `wipeIn` (opacity 0 → 1, scale .96 → 1).

**Chime (z-index 3)** — the whole panel becomes a button filled `#ec3013`, white text, content bottom-aligned, padding 44/34/38. A 30px white square sits top-left with a second square outline over it running `ringPulse 1.5s ease-out infinite` (opacity .55 → 0, scale 1 → 1.5). Headline "TIME'S RIPE." on two lines. A 3px white rule animates in with `barGrow 1.4s` (scaleX 0 → 1 from the left). Below it: "2:14 PM – 3:14 PM — click anywhere to account for it". Clicking anywhere acknowledges.

**Away (z-index 4)** — filled with the away mode's colour (indigo for sleep, steel for work), white text, bottom-aligned. Headline "ASLEEP." / "AT WORK.", a 3px 50%-white rule with the same `barGrow`, then "Since 11:20 PM · 7h 12m so far" (recomputed every second), then the mode's note. A full-bleed white button at the bottom reads "I'm awake" / "I'm back".

### Animations

| Name | Definition | Applied to |
| --- | --- | --- |
| `breathe` | scale 1 → 1.02 → 1, 7s ease-in-out infinite | the dial |
| `riseIn` | opacity 0 → 1, translateY 14–16px → 0, .4–.5s `cubic-bezier(.2,.7,.3,1)` | log entries, grid rows |
| `wipeIn` | opacity 0 → 1, scale .96 → 1, .35–.45s `cubic-bezier(.2,.7,.3,1)` | overlays, view switches |
| `barGrow` | scaleX 0 → 1 from left, 1.4s `cubic-bezier(.2,.7,.3,1)` | the rules on chime/away screens |
| `popDot` | scale 0 → 1, .35s `cubic-bezier(.2,1.6,.4,1)` | bullet markers |
| `ringPulse` | opacity .55 → 0, scale 1 → 1.5, 1.5s ease-out infinite | the chime's pulsing square |

Nothing else moves. Resist adding more.

---

## Interactions & behaviour

### The hour cycle

1. **Running.** A 1s interval decrements `remaining`. The user may type bullets and set tag / feeling / intent at any time.
2. **Chime.** At zero, play the sound and enter `chime`. Record `chimeFrom` (the hour's start) and `chimeTo` (now). The timer does not restart on its own — if the user is away for two hours it simply waits at the chime, and the logged block still reads as the original hour.
3. **Acknowledge.** Any click on the chime overlay enters `recap` and focuses the last bullet input.
4. **Recap.** Same bullet list, same pickers; only the copy and the bottom bar change.
5. **Log it.** Push an entry, then reset: bullets to one empty string, tag/feeling/intent to null, `remaining` to full, `hourStart` to now, mode back to running (or paused if `pauseAfterLog`). Advance the phrase index. **Skip** does the same but writes no entry.

### Bullets

- `Enter` inserts a new empty bullet **after the current one** and focuses it (do not append to the end — the user may be editing mid-list).
- `Backspace` on an already-empty bullet, when more than one exists, removes it and focuses the previous one.
- Empty bullets are dropped on save. If all are empty the entry logs a single bullet reading "(nothing written down)".
- Focus is applied after the state update, from a pending-focus index resolved in the post-update lifecycle. Keep the ref array in sync with splices or focus lands on the wrong row.

### Tag inference

On every render, join all bullets, lowercase, and score each category: +2 for a matched keyword longer than 5 characters, +1 otherwise. Highest score wins; ties go to the earlier category. Return nothing under 3 characters of input. The result is a *suggestion* — an explicit user pick always wins, and clearing the pick returns to the suggestion. On save, the stored tag is `userPick || inference || "Unfiled"`.

Keyword lists are in the prototype's logic class (`TAGS`). They are deliberately mundane and English-only; treat them as a starting seed. A better implementation might learn from the user's own corrections over time.

### Away modes

Entering an away mode records `{kind, since}` and suspends the countdown (the interval keeps ticking only to refresh the elapsed readout). On return, walk from `since` to now in one-hour steps, emitting an entry per step (tag "Asleep" / "At work", intent "yes", one bullet), capped at 24 blocks; anything under a minute logs nothing. Then start a clean hour.

### The chime sound

Synthesized with the Web Audio API — no audio files. A gentle marimba arpeggio: base C5 (523.25 Hz), semitone offsets `[0, 4, 7, 12, 7, 12, 16, 19]`, one note every 0.17s. Each note is two sine oscillators — the fundamental and a partial at 4.1× — with an exponential attack to peak in 8ms and an exponential decay to silence over 0.9s (fundamental) and 0.35s (partial). Peak gain 0.32 and 0.06 respectively, scaled by the volume setting. The context is closed after 3s.

Browsers block audio until the user has interacted with the page. In production, prompt for notification permission and pair the chime with a system notification, since the whole premise is that the user is looking at something else.

## State

| Field | Type | Notes |
| --- | --- | --- |
| `mode` | `running \| paused \| chime \| recap \| away` | Drives the entire left panel |
| `remaining` | seconds | Counts down from `sessionMinutes × 60` |
| `hourStart` | timestamp | Start of the current hour |
| `chimeFrom` / `chimeTo` | timestamp | The span being recapped, frozen at the chime |
| `bullets` | `string[]` | Always at least one element; may be empty strings |
| `tag` / `feel` / `intent` | `string \| null` | Explicit user picks only; inference is derived |
| `entries` | `Entry[]` | Newest first |
| `away` | `{kind, since} \| null` | |
| `view` | `day \| grid` | Right panel |
| `selectedDay` | date string \| null | Null means today |

`Entry`: `{ id, from, to, tag, feel, intent, bullets: string[] }`.

Everything else — colours, labels, the inferred tag, grid cells, counts — is derived at render time. Keep it that way; the only stored facts are what the user typed and picked.

### Settings (exposed as tweaks in the prototype)

`sessionMinutes` (default 60, 1–180) · `soundOn` (true) · `chimeVolume` (0.8) · `pauseAfterLog` (false — the next hour starts immediately) · `demoData` (true; seeds the log so the views have content).

## Open work

Not built in the prototype, in rough priority order:

1. **Persistence.** Nothing survives a reload. Entries, the running hour's start time and the away state all need storing, and the timer must be reconstructed from wall-clock time on load rather than resumed from a counter — a closed laptop should not stop the hour.
2. **Notifications.** A page-title/favicon change and a system notification at the chime.
3. **Editing past entries.** The vine is read-only today.
4. **The grid is fixed at 10 days** with no paging back, and it buckets by the entry's start hour, so two entries starting in the same clock hour collide (only the first is drawn).
5. **Responsive.** The layout assumes a desktop window at least ~950px wide. Below that the two-column grid needs to become a stack.
6. **Accessibility.** Focus is visible (2px accent `:focus-visible` ring) and controls are real buttons, but the chime and away overlays need live-region announcements, and the grid cells need accessible names rather than `title` attributes.

## Assets

None. No images, no icon fonts, no SVG illustration — every mark on the screen is a square, a circle, a rule, or Archivo. The only external dependency is the Archivo webfont from Google Fonts.

## Files

- `Pomodoro.dc.html` — the design. Template first, then the logic class: constants (`TAGS`, `AWAY`, `FEELS`, `PHRASES`) at the top, then the component, whose `renderVals()` computes every value the template renders.
- `support.js` — the prototype runtime. **Reference only — do not port it.**
