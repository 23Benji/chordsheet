import { beatAccent, beatsUntil, clampBpm, meterFromTime, tapTempo, tempoMarking, timeOfMeter, withSongTempo } from './metronome';

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

describe('tempo saved in the song', () => {
  const song = '{title: Ho la vittoria}\n{meta: numero 48}\n\n[C]HO LA VITTORIA\n';

  it('adds {tempo} at the end of the header, without moving the lyrics', () => {
    expect(withSongTempo(song, 96, 4)).toBe('{title: Ho la vittoria}\n{meta: numero 48}\n{tempo: 96}\n\n[C]HO LA VITTORIA\n');
  });

  it('replaces an existing {tempo} and writes {time} only when it is not 4/4', () => {
    const once = withSongTempo(song, 96, 3);
    expect(once).toContain('{tempo: 96}\n{time: 3/4}');
    const twice = withSongTempo(once, 120, 4);
    expect(twice).toContain('{tempo: 120}');
    expect(twice).toContain('{time: 4/4}'); // it had a {time}: kept up to date
    expect(twice.match(/tempo/g)).toHaveLength(1);
  });

  it('a song with no header gets the tempo on top', () => {
    expect(withSongTempo('[G]LODE\n', 80, 6)).toBe('{tempo: 80}\n{time: 6/8}\n[G]LODE\n');
  });

  it('reads the beat from {time}', () => {
    expect(meterFromTime('3/4')).toBe(3);
    expect(meterFromTime('6/8')).toBe(6);
    expect(meterFromTime('5/4')).toBeNull();
    expect(meterFromTime(null)).toBeNull();
    expect(timeOfMeter(2)).toBe('2/4');
  });
});
