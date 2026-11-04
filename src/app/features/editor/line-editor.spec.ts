import { TestBed } from '@angular/core/testing';
import { EditorLyricsLine, lyricsToChordPro, parseLyricsLine } from '../../core/editor-model';
import { LineChange, LineEditor } from './line-editor';

function setup(source: string) {
  const fixture = TestBed.createComponent(LineEditor);
  let line: EditorLyricsLine = parseLyricsLine(source);
  fixture.componentRef.setInput('line', line);
  fixture.componentRef.setInput('palette', ['G', 'D']);
  // Behave like the parent: apply every change to the input.
  fixture.componentInstance.changed.subscribe((c: LineChange) => {
    line = c.line;
    fixture.componentRef.setInput('line', line);
  });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const text = el.querySelector<HTMLInputElement>('input.text')!;
  return { fixture, el, text, current: () => lyricsToChordPro(line) };
}

describe('LineEditor', () => {
  it('shows chords above the text at their character position', () => {
    const { el, text } = setup('[G]Dio è [D]grande');
    expect(text.value).toBe('Dio è grande');
    const chips = Array.from(el.querySelectorAll<HTMLElement>('.chord-chip'));
    expect(chips.map((c) => [c.textContent, c.style.left])).toEqual([
      ['G', '0ch'],
      ['D', '6ch'],
    ]);
  });

  it('typing keeps chords on their syllables', () => {
    const { text, current } = setup('[G]Dio è [D]grande');
    text.value = 'Oh Dio è grande';
    text.dispatchEvent(new Event('input'));
    expect(current()).toBe('Oh [G]Dio è [D]grande');
  });

  it('Ctrl+K adds a chord at the cursor from the popover palette', () => {
    const { fixture, el, text, current } = setup('Dio è grande');
    text.setSelectionRange(6, 6);
    text.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    fixture.detectChanges();
    const palette = Array.from(el.querySelectorAll<HTMLButtonElement>('.pal'));
    expect(palette.map((b) => b.textContent)).toEqual(['G', 'D']);
    palette[1].click();
    fixture.detectChanges();
    expect(current()).toBe('Dio è [D]grande');
    expect(el.querySelector('.popover')).toBeNull();
  });

  it('a focused chord moves with the arrow keys and is deleted with Canc', () => {
    const { fixture, el, current } = setup('[G]Dio');
    const chip = () => el.querySelector<HTMLElement>('.chord-chip')!;
    chip().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(current()).toBe('D[G]io');
    chip().dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    fixture.detectChanges();
    expect(current()).toBe('Dio');
  });

  it('Enter asks to split the line at the cursor', () => {
    const { fixture, text } = setup('Dio è grande');
    let splitAt = -1;
    fixture.componentInstance.split.subscribe((at: number) => (splitAt = at));
    text.setSelectionRange(4, 4);
    text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(splitAt).toBe(4);
  });
});
