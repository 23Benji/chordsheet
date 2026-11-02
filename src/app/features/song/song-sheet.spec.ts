import { TestBed } from '@angular/core/testing';
import { anchorFor } from '../../core/anchoring';
import { parseChordPro } from '../../core/chordpro';
import { Annotation } from '../../core/models';
import { SongSheet } from './song-sheet';

function render(chordpro: string): HTMLElement {
  const fixture = TestBed.createComponent(SongSheet);
  fixture.componentRef.setInput('sheet', parseChordPro(chordpro));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SongSheet', () => {
  it('renders chords above their syllables', () => {
    const el = render('[C]QUANDO GUARDO LA TUA SANTI[F]TÀ');
    const segs = Array.from(el.querySelectorAll('.seg')).map((s) => [
      s.querySelector('.chord')?.textContent ?? null,
      s.querySelector('.lyric')!.textContent,
    ]);
    expect(segs[0]).toEqual(['C', 'QUANDO ']);
    expect(segs[1]).toEqual([null, 'GUARDO ']); // no empty chord box
    expect(segs[segs.length - 1]).toEqual(['F', 'TÀ']);
  });

  it('marks choruses, comments and second-key groups', () => {
    const el = render(
      '{comment: x2}\n{start_of_chorus}\n[G]IO LODO TE\n{end_of_chorus}\n[Bm]CANTA.    (Am Em)',
    );
    expect(el.querySelector('.chorus .tag')?.textContent).toBe('Ritornello');
    expect(el.querySelector('.comment')?.textContent).toBe('x2');
    expect(el.querySelector('.second-key')?.textContent).toBe('(Am Em)');
  });

  it('labels every section so verses, choruses and intermezzi are easy to tell apart', () => {
    const el = render(
      '[A] [D]\n\n[A]uno\n\n{start_of_chorus}\n[G]rit\n{end_of_chorus}\n\n[A]due\n\n{comment: Ritornello: IO CANTERÒ…}',
    );
    const tags = Array.from(el.querySelectorAll('.section')).map((s) => [
      s.classList[1],
      s.querySelector('.tag')?.textContent,
    ]);
    expect(tags).toEqual([
      ['instrumental', 'Intro'],
      ['verse', 'Strofa 1'],
      ['chorus', 'Ritornello'],
      ['verse', 'Strofa 2'],
      ['chorusRepeat', 'Ritornello'],
    ]);
    expect(el.querySelector('.chorusRepeat')?.textContent).toContain('IO CANTERÒ…');
  });

  it('keeps chords without a syllable in the chord row (empty lyric box below)', () => {
    const el = render('[Bm] [G] [D] [A]\n[Bm][G]Chi sarà');
    const last = Array.from(el.querySelectorAll('.line'))[0].querySelectorAll('.seg');
    const a = last[last.length - 1];
    expect(a.querySelector('.chord')?.textContent).toBe('A');
    expect(a.querySelector('.lyric')).not.toBeNull();
  });

  it('shows old-notation chord lines as chords', () => {
    const el = render('Intro: B- G D A');
    expect(Array.from(el.querySelectorAll('.chord-line .chord')).map((c) => c.textContent)).toEqual([
      'Bm',
      'G',
      'D',
      'A',
    ]);
  });

  it('collapses the chord row on lines without chords', () => {
    const el = render('solo testo');
    expect(el.querySelector('.line')?.classList).toContain('no-chords');
  });

  it('renders the personal layer: highlight, note, tab, personal chord', () => {
    const src = '[C]QUANDO GUARDO LA TUA SANTI[F]TÀ\nHO CERCATO';
    const sheet = parseChordPro(src);
    const base = { songId: 's', anchor: anchorFor(sheet, 0), createdAt: 0, updatedAt: 0 };
    const annotations: Annotation[] = [
      { ...base, id: 'h', type: 'highlight', text: '', color: 'sky' },
      { ...base, id: 'n', type: 'note', text: 'piano', color: 'coral' },
      { ...base, id: 't', type: 'tab', title: 'Assolo intro', text: 'e|---0---|' },
      { ...base, id: 'c', type: 'chord', text: 'Fmaj7', chordIndex: 1 },
    ];
    const fixture = TestBed.createComponent(SongSheet);
    fixture.componentRef.setInput('sheet', sheet);
    fixture.componentRef.setInput('annotations', new Map([[0, annotations]]));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const row = el.querySelector('.row')!;
    expect(row.classList).toContain('hl-sky');
    expect(row.querySelector('.note.note-coral')?.textContent).toBe('piano');
    expect(row.querySelector('.tab figcaption')?.textContent).toBe('Assolo intro');
    expect(row.querySelector('.tab pre')?.textContent).toBe('e|---0---|');
    const personal = row.querySelector('.chord.personal')!;
    expect(personal.textContent).toBe('Fmaj7');
    expect(personal.nextElementSibling?.textContent).toBe('F'); // above the original F
    expect(el.querySelectorAll('.row')[1].querySelector('.note')).toBeNull();
  });

  it('selects a line on click only when selectable', () => {
    const fixture = TestBed.createComponent(SongSheet);
    fixture.componentRef.setInput('sheet', parseChordPro('UNO\nDUE'));
    let selected = -1;
    fixture.componentInstance.lineSelect.subscribe((i: number) => (selected = i));
    fixture.detectChanges();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.row');
    rows[1].click();
    expect(selected).toBe(-1);
    fixture.componentRef.setInput('selectable', true);
    fixture.detectChanges();
    rows[1].click();
    expect(selected).toBe(1);
  });
});
