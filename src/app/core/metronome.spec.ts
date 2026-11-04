import { beatAccent, beatsUntil, clampBpm, tapTempo, tempoMarking } from './metronome';

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

  it('names the tempo and accents the bar', () => {
    const table = [
      { upTo: 66, name: 'Largo' },
      { upTo: 108, name: 'Andante' },
      { upTo: 999, name: 'Allegro' },
    ];
    expect(tempoMarking(40, table)).toBe('Largo');
    expect(tempoMarking(66, table)).toBe('Andante');
    expect(tempoMarking(140, table)).toBe('Allegro');
    expect(beatAccent(0, 4)).toBe('strong');
    expect(beatAccent(2, 4)).toBe('weak');
    expect(beatAccent(3, 6)).toBe('medium');
    expect(beatAccent(3, 4)).toBe('weak');
  });
});
