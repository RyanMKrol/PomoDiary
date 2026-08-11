"use client";

import { fmtClock } from "@/lib/time";
import { PHRASES, tagColor, inferTag } from "@/lib/domain";
import { useTimer, type UseTimerResult } from "@/lib/client/useTimer";
import styles from "./Dial.module.css";

const SESSION_SECONDS = 3600; // Default to 1 hour

function generateTicks(): Array<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}> {
  return Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    return {
      x1: 100 + Math.cos(angle) * 70,
      y1: 100 + Math.sin(angle) * 70,
      x2: 100 + Math.cos(angle) * 78,
      y2: 100 + Math.sin(angle) * 78,
    };
  });
}

export interface DialProps {
  timerState?: Partial<UseTimerResult>;
}

export function Dial({ timerState }: DialProps = {}) {
  const defaultState = useTimer();
  const state = timerState
    ? { ...defaultState, ...timerState }
    : (defaultState as Partial<UseTimerResult>);

  const {
    mode = "running",
    remainingSeconds = SESSION_SECONDS,
    chimeFrom,
    draftBullets = [],
    draftTag,
    phraseIdx = 0,
    ringNow = async () => {},
  } = state;

  const isChime = mode === "chime";
  const isRecap = mode === "recap";
  const isRunning = mode === "running";
  const isPaused = mode === "paused";

  const sessionSeconds = state.settings?.sessionMinutes
    ? state.settings.sessionMinutes * 60
    : SESSION_SECONDS;
  const remaining = remainingSeconds ?? sessionSeconds;
  const dashOffset = 552.92 * (remaining / sessionSeconds);

  const guess = inferTag(draftBullets);
  const activeTag = draftTag || guess;
  const arcColor = activeTag ? tagColor(activeTag) : "#ec3013";

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

  const hourStartDisplay =
    isRecap || isChime
      ? chimeFrom
      : (state as Record<string, unknown>).hourStart;
  const hourStartLabel = hourStartDisplay
    ? fmtClock(hourStartDisplay as number)
    : "—";

  const ticks = generateTicks();

  return (
    <div className={styles.row}>
      <div
        className={styles.dialWrapper}
        onClick={() => ringNow()}
        title="Ring it now"
      >
        <svg
          viewBox="0 0 200 200"
          className={styles.svg}
          style={{ overflow: "visible" }}
        >
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
        <div className={styles.timeSince}>
          Since {hourStartLabel} · click the dial to ring it now
        </div>
      </div>
    </div>
  );
}
