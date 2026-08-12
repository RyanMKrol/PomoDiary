"use client";

import type { UseTimerResult } from "@/lib/client/useTimer";
import { Dial } from "./Dial";
import { BulletJotter } from "./BulletJotter";
import { PickerStrip } from "./PickerStrip";
import { ControlBar } from "./ControlBar";
import { RecapBar } from "./RecapBar";
import { ChimeOverlay } from "./ChimeOverlay";
import { AwayOverlay } from "./AwayOverlay";
import { PauseOverlay } from "./PauseOverlay";
import { Vine } from "./Vine";
import styles from "./Panels.module.css";

export interface PanelsProps {
  timerState: UseTimerResult;
}

export function Panels({ timerState }: PanelsProps) {
  const {
    mode,
    remainingSeconds,
    chimeFrom,
    chimeTo,
    awayKind,
    awaySince,
    awayLabel,
    awayElapsedSeconds,
    updateDraft,
    resume,
    awayStart,
    awayReturn,
    log,
    skip,
    acknowledge,
  } = timerState;

  const awayNow =
    awaySince != null && awayElapsedSeconds != null
      ? awaySince + awayElapsedSeconds * 1000
      : null;

  return (
    <div className={styles.panelsContainer}>
      <div className={styles.leftPanel} data-testid="left-panel">
        <Dial timerState={timerState} />
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />
        <ControlBar timerState={timerState} awayStart={awayStart} />
        <RecapBar timerState={timerState} log={log} skip={skip} />
        {mode === "chime" && chimeFrom != null && chimeTo != null && (
          <ChimeOverlay
            chimeFrom={chimeFrom}
            chimeTo={chimeTo}
            onAcknowledge={() => acknowledge()}
          />
        )}
        {mode === "away" &&
          awayKind != null &&
          awaySince != null &&
          awayNow !== null && (
            <AwayOverlay
              awayKind={awayKind}
              awaySince={awaySince}
              now={awayNow}
              awayLabel={awayLabel}
              onReturn={() => awayReturn()}
            />
          )}
        {mode === "paused" && <PauseOverlay onResume={() => resume()} />}
      </div>
      <div className={styles.rightPanel} data-testid="right-panel">
        <Vine timerState={timerState} />
      </div>
    </div>
  );
}
