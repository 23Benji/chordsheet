import { beatsUntil, clampBpm, tapTempo } from './metronome';

describe('metronome', () => {
  it('computes tempo from taps and restarts after a pause', () => {
    let state = tapTempo([], 0);
    expect(state.bpm).toBeNull();
    state = tapTempo(state.taps, 500);
    expect(state.bpm).toBe(120);
    state = tapTempo(state.taps, 1000);
    state = tapTempo(state.taps, 1520);
    expect(state.bpm).toBe(118);
    expect(tapTempo(state.taps, 9000)).toEqual({ taps: [9000], bpm: null });
  });

  it('clamps and schedules beats', () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(999)).toBe(260);
    expect(beatsUntil(1, 2.1, 120)).toEqual([1, 1.5, 2]);
  });
});
