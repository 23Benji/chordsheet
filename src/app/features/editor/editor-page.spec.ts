import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Song } from '../../core/models';
import { songFromChordPro } from '../../core/song-import';
import { LayoutService } from '../../services/layout.service';
import { LibraryService } from '../../services/library.service';
import { EditorPage } from './editor-page';

const existing = songFromChordPro('{title: Io lodo Te}\n{meta: numero 1}\n\n[C]QUANDO GUARDO', '', 'bundled');
const other = songFromChordPro('{title: Celebriam}\n{meta: numero 2}\n\n[G]x', '', 'bundled');

function setup(id?: string) {
  const saved: Song[] = [];
  const library = {
    byId: signal(new Map([existing, other].map((s) => [s.id, s]))),
    findByNumber: (n: number, suffix: string, except?: string) =>
      [existing, other].find((s) => s.number === n && s.suffix === suffix && s.id !== except),
    saveSong: async (song: Song) => void saved.push(song),
  };
  TestBed.configureTestingModule({
    imports: [EditorPage],
    providers: [provideRouter([]), { provide: LibraryService, useValue: library }, LayoutService],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(EditorPage);
  if (id) fixture.componentRef.setInput('id', id);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  // Exact text, or the long label of a button that also carries a short one
  // (<span class="long">…</span><span class="short">…</span>, shown on phones).
  const button = (text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === text || b.querySelector('.long')?.textContent?.trim() === text,
    )!;
  return { fixture, el, type, button, saved, navigate };
}

describe('EditorPage', () => {
  it('opens a song, shows it in the preview and saves the edits', async () => {
    const { fixture, el, type, button, saved, navigate } = setup(existing.id);
    expect(el.querySelector<HTMLInputElement>('.field.title input')!.value).toBe('Io lodo Te');
    expect(el.querySelector('.preview-pane .preview-title')?.textContent).toBe('Io lodo Te');

    type('.field.title input', 'Io lodo Te Signore');
    expect(el.querySelector('.dirty')).not.toBeNull();

    button('Salva').click();
    await fixture.whenStable();
    expect(saved[0]).toMatchObject({ id: existing.id, title: 'Io lodo Te Signore', number: 1 });
    expect(saved[0].chordpro).toContain('[C]QUANDO GUARDO');
    expect(navigate).toHaveBeenCalledWith(['/canto', existing.id], { replaceUrl: false });
  });

  it('refuses a number already used by another song', async () => {
    const { fixture, el, type, button, saved } = setup(existing.id);
    type('.field.number input', '2');
    button('Salva').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(saved).toEqual([]);
    expect(el.querySelector('.error')?.textContent).toContain('Esiste già il canto 2');
  });

  it('a new song needs a title', async () => {
    const { fixture, el, button, saved } = setup();
    expect(el.querySelector('h1')?.textContent).toBe('Nuovo canto');
    button('Salva').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(saved).toEqual([]);
    expect(el.querySelector('.error')?.textContent).toContain('titolo');
  });

  it('undo and redo restore the previous text', () => {
    const { fixture, el, type } = setup(existing.id);
    const title = () => el.querySelector<HTMLInputElement>('.field.title input')!.value;
    type('.field.title input', 'Nuovo titolo');
    const undo = el.querySelector<HTMLButtonElement>('[aria-label^="Annulla modifica"]')!;
    undo.click();
    fixture.detectChanges();
    expect(title()).toBe('Io lodo Te');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }));
    fixture.detectChanges();
    expect(title()).toBe('Nuovo titolo');
  });

  it('switches to the ChordPro source and back without losing edits', () => {
    const { fixture, el, type, button } = setup(existing.id);
    type('.field.title input', 'Titolo X');
    button('Sorgente ChordPro').click();
    fixture.detectChanges();
    const area = el.querySelector<HTMLTextAreaElement>('app-source-editor textarea')!;
    expect(area.value).toContain('{title: Titolo X}');
    area.value = area.value.replace('QUANDO', 'MENTRE');
    area.dispatchEvent(new Event('input'));
    button('Visuale').click();
    fixture.detectChanges();
    expect(el.querySelector<HTMLInputElement>('app-line-editor input.text')!.value).toBe('MENTRE GUARDO');
  });
});
