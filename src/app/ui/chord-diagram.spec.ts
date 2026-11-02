import { TestBed } from '@angular/core/testing';
import { ChordDiagram } from './chord-diagram';

function render(chord: string): HTMLElement {
  const fixture = TestBed.createComponent(ChordDiagram);
  fixture.componentRef.setInput('chord', chord);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ChordDiagram', () => {
  it('draws dots, open strings and muted strings', () => {
    const el = render('C'); // x32010
    expect(el.querySelector('figcaption')?.textContent).toBe('C');
    expect(el.querySelectorAll('circle.dot').length).toBe(3);
    expect(el.querySelectorAll('circle.open').length).toBe(2);
    expect(el.querySelectorAll('text.mark').length).toBe(1);
  });

  it('draws a barre and the fret number for high chords, and the bass of slash chords', () => {
    const high = render('C#m'); // x46654
    expect(high.querySelector('rect.dot')).not.toBeNull();
    expect(high.querySelector('text.fret-no')?.textContent).toBe('4');
    expect(render('D/F#').querySelector('.bass')?.textContent).toBe('basso: F#');
    expect(render('C13#11').textContent).toContain('non disponibile');
  });
});
