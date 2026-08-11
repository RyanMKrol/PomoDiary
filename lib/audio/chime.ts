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

export function playChime(settings: ChimePlaySettings): void {
  if (settings.soundOn === false) return;

  try {
    const AudioContextImpl = resolveAudioContextCtor();
    if (!AudioContextImpl) return;

    const ctx = new AudioContextImpl();
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

    setTimeout(() => ctx.close(), 3000);
  } catch {
    // Autoplay policy / unsupported environment — chime is best-effort.
  }
}
