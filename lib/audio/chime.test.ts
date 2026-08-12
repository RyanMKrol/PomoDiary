import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildChimeSchedule,
  playChime,
  resetChimeAudio,
  unlockAudio,
} from "./chime";

describe("buildChimeSchedule", () => {
  it("returns 8 notes spaced 0.17s apart", () => {
    const schedule = buildChimeSchedule(1);
    expect(schedule).toHaveLength(8);
    schedule.forEach((note, i) => {
      expect(note.startTime).toBeCloseTo(i * 0.17, 10);
    });
  });

  it("frequency of the offset-12 note is exactly 2x the base frequency", () => {
    const schedule = buildChimeSchedule(1);
    const base = schedule[0].frequency; // offset 0
    const octave = schedule[3].frequency; // offset 12
    expect(octave).toBeCloseTo(base * 2, 10);
  });

  it("scales per-note gains 0.32/0.06 by volume", () => {
    const schedule = buildChimeSchedule(0.5);
    const [fundamental, partial] = schedule[0].oscillators;
    expect(fundamental.peakGain).toBeCloseTo(0.32 * 0.5, 10);
    expect(partial.peakGain).toBeCloseTo(0.06 * 0.5, 10);
  });

  it("decays the fundamental over 0.9s and the partial over 0.35s", () => {
    const schedule = buildChimeSchedule(1);
    const [fundamental, partial] = schedule[0].oscillators;
    expect(fundamental.decayTime - fundamental.startTime).toBeCloseTo(0.9, 10);
    expect(partial.decayTime - partial.startTime).toBeCloseTo(0.35, 10);
  });

  it("stops every oscillator 1.0s after its own start", () => {
    const schedule = buildChimeSchedule(1);
    for (const note of schedule) {
      for (const osc of note.oscillators) {
        expect(osc.stopTime - osc.startTime).toBeCloseTo(1.0, 10);
      }
    }
  });
});

class FakeGainParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeGainNode {
  gain = new FakeGainParam();
  connect = vi.fn().mockReturnThis();
}

class FakeOscillatorNode {
  type = "";
  frequency = { value: 0 };
  connect = vi.fn().mockReturnThis();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state = "running";
  close = vi.fn();
  resume = vi.fn();
  createOscillator = vi.fn(() => new FakeOscillatorNode());
  createGain = vi.fn(() => new FakeGainNode());
}

describe("playChime", () => {
  beforeEach(() => {
    resetChimeAudio();
  });

  afterEach(() => {
    resetChimeAudio();
    vi.unstubAllGlobals();
  });

  it("schedules every oscillator on one shared AudioContext, reused across chimes", () => {
    const instances: FakeAudioContext[] = [];
    class TrackedAudioContext extends FakeAudioContext {
      constructor() {
        super();
        instances.push(this);
      }
    }
    vi.stubGlobal("AudioContext", TrackedAudioContext);

    playChime({ soundOn: true, chimeVolume: 0.8 });
    playChime({ soundOn: true, chimeVolume: 0.8 });

    // One context for both chimes: a fresh context minted in a hidden tab
    // would start suspended and play nothing, so the context is shared.
    expect(instances).toHaveLength(1);
    const ctx = instances[0];
    // 8 notes * 2 oscillators (fundamental + partial) each, twice.
    expect(ctx.createOscillator).toHaveBeenCalledTimes(32);
    expect(ctx.close).not.toHaveBeenCalled();
  });

  it("resumes a suspended context before scheduling", () => {
    class SuspendedAudioContext extends FakeAudioContext {
      state = "suspended";
    }
    const instances: SuspendedAudioContext[] = [];
    vi.stubGlobal(
      "AudioContext",
      class extends SuspendedAudioContext {
        constructor() {
          super();
          instances.push(this);
        }
      },
    );

    playChime({ soundOn: true });

    expect(instances[0].resume).toHaveBeenCalledTimes(1);
    expect(instances[0].createOscillator).toHaveBeenCalled();
  });

  it("is a no-op when soundOn is false", () => {
    const ctor = vi.fn();
    vi.stubGlobal("AudioContext", ctor);

    playChime({ soundOn: false });

    expect(ctor).not.toHaveBeenCalled();
  });

  it("swallows errors thrown when constructing the AudioContext", () => {
    class ThrowingAudioContext {
      constructor() {
        throw new Error("autoplay blocked");
      }
    }
    vi.stubGlobal("AudioContext", ThrowingAudioContext);

    expect(() => playChime({ soundOn: true })).not.toThrow();
  });
});

describe("unlockAudio", () => {
  beforeEach(() => {
    resetChimeAudio();
  });

  afterEach(() => {
    resetChimeAudio();
    vi.unstubAllGlobals();
  });

  it("creates the shared context and resumes it when suspended", () => {
    const instances: FakeAudioContext[] = [];
    vi.stubGlobal(
      "AudioContext",
      class extends FakeAudioContext {
        state = "suspended";
        constructor() {
          super();
          instances.push(this);
        }
      },
    );

    unlockAudio();

    expect(instances).toHaveLength(1);
    expect(instances[0].resume).toHaveBeenCalledTimes(1);

    // A later chime rides the same, now-unlocked context.
    playChime({ soundOn: true });
    expect(instances).toHaveLength(1);
  });

  it("does not resume a context that is already running", () => {
    const instances: FakeAudioContext[] = [];
    vi.stubGlobal(
      "AudioContext",
      class extends FakeAudioContext {
        constructor() {
          super();
          instances.push(this);
        }
      },
    );

    unlockAudio();

    expect(instances[0].resume).not.toHaveBeenCalled();
  });

  it("is safe without an AudioContext implementation", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => unlockAudio()).not.toThrow();
  });
});
