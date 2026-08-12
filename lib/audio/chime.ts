export const CHIME_BASE_FREQUENCY = 523.25;
export const CHIME_SEMITONE_OFFSETS = [0, 4, 7, 12, 7, 12, 16, 19];
export const CHIME_NOTE_SPACING_SECONDS = 0.17;
export const CHIME_ATTACK_SECONDS = 0.008;
export const CHIME_GAIN_FLOOR = 0.0001;
export const CHIME_STOP_SECONDS = 1.0;

const PARTIALS = [
  { multiplier: 1, peak: 0.32, decaySeconds: 0.9 },
  { multiplier: 4.1, peak: 0.06, decaySeconds: 0.35 },
];

export interface ChimeOscillatorSchedule {
  frequency: number;
  startTime: number;
  peakGain: number;
  peakTime: number;
  decayTime: number;
  stopTime: number;
}

export interface ChimeNoteSchedule {
  startTime: number;
  frequency: number;
  oscillators: ChimeOscillatorSchedule[];
}

export function buildChimeSchedule(volume: number): ChimeNoteSchedule[] {
  return CHIME_SEMITONE_OFFSETS.map((semitone, i) => {
    const startTime = i * CHIME_NOTE_SPACING_SECONDS;
    const frequency = CHIME_BASE_FREQUENCY * Math.pow(2, semitone / 12);
    const oscillators = PARTIALS.map(({ multiplier, peak, decaySeconds }) => ({
      frequency: frequency * multiplier,
      startTime,
      peakGain: peak * volume,
      peakTime: startTime + CHIME_ATTACK_SECONDS,
      decayTime: startTime + decaySeconds,
      stopTime: startTime + CHIME_STOP_SECONDS,
    }));
    return { startTime, frequency, oscillators };
  });
}

export interface ChimePlaySettings {
  soundOn?: boolean;
  chimeVolume?: number;
}

type AudioContextCtor = new () => AudioContext;

function resolveAudioContextCtor(): AudioContextCtor | undefined {
  const g = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

// One long-lived context, shared by every chime. A context constructed at
// chime time in a hidden tab starts "suspended" under Chrome's autoplay
// policy and plays nothing; one unlocked during a user gesture keeps its
// right to sound for the page's lifetime, including from background tabs.
let sharedCtx: AudioContext | null = null;

function sharedContext(): AudioContext | null {
  if (sharedCtx === null) {
    const AudioContextImpl = resolveAudioContextCtor();
    if (!AudioContextImpl) return null;
    sharedCtx = new AudioContextImpl();
  }
  return sharedCtx;
}

/** Call from a user-gesture handler (click, keydown) to create and resume
 *  the shared context while the browser will allow it. Best-effort. */
export function unlockAudio(): void {
  try {
    const ctx = sharedContext();
    if (ctx !== null && ctx.state === "suspended") {
      void ctx.resume();
    }
  } catch {
    // Autoplay policy / unsupported environment — chime is best-effort.
  }
}

/** Drop the shared context (tests; not used in the app itself). */
export function resetChimeAudio(): void {
  try {
    void sharedCtx?.close();
  } catch {
    // A stubbed or already-closed context — nothing to release.
  }
  sharedCtx = null;
}

export function playChime(settings: ChimePlaySettings): void {
  if (settings.soundOn === false) return;

  try {
    const ctx = sharedContext();
    if (ctx === null) return;
    // Suspended means the unlock never happened (or the browser re-suspended
    // us); resume is async, and scheduling below is against the context's
    // own clock, which only advances once running — so the melody plays
    // intact from the resume, or stays silent if the browser refuses.
    if (ctx.state === "suspended") void ctx.resume();

    const schedule = buildChimeSchedule(settings.chimeVolume ?? 0.8);
    const now = ctx.currentTime;

    for (const note of schedule) {
      for (const osc of note.oscillators) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = osc.frequency;
        gain.gain.setValueAtTime(CHIME_GAIN_FLOOR, now + osc.startTime);
        gain.gain.exponentialRampToValueAtTime(
          osc.peakGain,
          now + osc.peakTime,
        );
        gain.gain.exponentialRampToValueAtTime(
          CHIME_GAIN_FLOOR,
          now + osc.decayTime,
        );
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(now + osc.startTime);
        oscillator.stop(now + osc.stopTime);
      }
    }
  } catch {
    // Autoplay policy / unsupported environment — chime is best-effort.
  }
}
