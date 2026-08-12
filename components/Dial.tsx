"use client";

import { fmtClock } from "@/lib/time";
import { PHRASES } from "@/lib/domain";
import { type UseTimerResult } from "@/lib/client/useTimer";
import styles from "./Dial.module.css";

const SESSION_SECONDS = 3600; // Default to 1 hour

function generateTicks(): Array<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}> {
  // Rounded to 3 decimals: server and browser trig can differ in the last
  // float digits, and any difference in the SSR'd SVG attributes trips
  // React's hydration mismatch warning.
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    return {
      x1: round(100 + Math.cos(angle) * 70),
      y1: round(100 + Math.sin(angle) * 70),
      x2: round(100 + Math.cos(angle) * 78),
      y2: round(100 + Math.sin(angle) * 78),
    };
  });
}

export interface DialProps {
  /** Always supplied by the shell — the Dial must never create its own
   *  timer client (a second client means a second WAL copy and a double
   *  chime). */
  timerState: Partial<UseTimerResult>;
}

export function Dial({ timerState }: DialProps) {
  const state = timerState;

  const {
    mode = "running",
    remainingSeconds = SESSION_SECONDS,
    chimeFrom,
    phraseIdx = 0,
    hourStart,
    blockEnd,
  } = state;

  const isChime = mode === "chime";
  const isRecap = mode === "recap";
  const isRunning = mode === "running";
  const isPaused = mode === "paused";

  // The arc drains over the real block, which can be shorter than an hour
  // when the block started mid-hour (blocks end on the wall-clock :00).
  const blockSeconds =
    hourStart != null && blockEnd != null
      ? Math.max(1, Math.round((blockEnd - hourStart) / 1000))
      : SESSION_SECONDS;
  const remaining = remainingSeconds ?? blockSeconds;
  const dashOffset = 552.92 * (remaining / blockSeconds);

  // The progress arc is core branding — always accent red, never tag-colored.
  const arcColor = "#ec3013";

  const statusLabel = isRecap
    ? "Recap the hour"
    : isChime
      ? "Time's ripe"
      : isRunning
        ? "Hour in progress"
        : "Paused";

  const [phrase, subPhrase] = PHRASES[phraseIdx] || [
    "The hour awaits",
    "Keep the clock",
  ];
  const displayPhrase = isRecap
    ? "That hour, then."
    : isPaused
      ? "Paused."
      : phrase;
  const displaySubPhrase = isRecap
    ? "Say where it went"
    : isPaused
      ? "The clock waits for you"
      : subPhrase;

  const hourStartDisplay = isRecap || isChime ? chimeFrom : hourStart;
  const hourStartLabel = hourStartDisplay ? fmtClock(hourStartDisplay) : "—";

  const ticks = generateTicks();

  return (
    <div className={styles.row}>
      <div className={styles.dialWrapper}>
        <svg
          viewBox="0 0 200 200"
          className={styles.svg}
          style={{ overflow: "visible" }}
        >
          {/* "Hour in progress" breathing glow: a soft accent-gradient warmth
              behind the ring, inhaling and exhaling. Running mode only —
              the owner picked this over sonar/ripple/heartbeat candidates. */}
          {isRunning && (
            <>
              <defs>
                <radialGradient id="dialGlowGrad">
                  <stop offset="0%" stopColor="#ec3013" stopOpacity="0.9" />
                  <stop offset="70%" stopColor="#ec3013" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#ec3013" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle
                cx="100"
                cy="100"
                r="60"
                fill="url(#dialGlowGrad)"
                className={styles.pulse}
                data-testid="dial-pulse"
              />
            </>
          )}

          {/* Track circle */}
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="#e0dddd"
            strokeWidth="14"
          />

          {/* Tick marks */}
          {ticks.map((tick, i) => (
            <line
              key={`tick-${i}`}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="rgba(32,30,29,.3)"
              strokeWidth="2"
            />
          ))}

          {/* Progress arc */}
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke={arcColor}
            strokeWidth="14"
            strokeDasharray="552.92"
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            style={{
              transition: "stroke-dashoffset .4s linear, stroke .5s ease",
            }}
          />
        </svg>
      </div>

      <div className={styles.textColumn}>
        <div className={styles.statusLabel}>{statusLabel}</div>
        <div className={styles.phrase}>{displayPhrase}</div>
        <div className={styles.subPhrase}>{displaySubPhrase}</div>
        <div className={styles.timeSince}>Since {hourStartLabel}</div>
      </div>
    </div>
  );
}
