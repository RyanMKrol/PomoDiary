import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildChimeSchedule, playChime } from "./chime";

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
  close = vi.fn();
  createOscillator = vi.fn(() => new FakeOscillatorNode());
  createGain = vi.fn(() => new FakeGainNode());
}

describe("playChime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("constructs an AudioContext, schedules every oscillator, and closes after 3s", () => {
    const instances: FakeAudioContext[] = [];
    class TrackedAudioContext extends FakeAudioContext {
      constructor() {
        super();
        instances.push(this);
      }
    }
    vi.stubGlobal("AudioContext", TrackedAudioContext);

    playChime({ soundOn: true, chimeVolume: 0.8 });

    expect(instances).toHaveLength(1);
    const ctx = instances[0];
    // 8 notes * 2 oscillators (fundamental + partial) each.
    expect(ctx.createOscillator).toHaveBeenCalledTimes(16);
    expect(ctx.close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);
    expect(ctx.close).toHaveBeenCalledTimes(1);
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
