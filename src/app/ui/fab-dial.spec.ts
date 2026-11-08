import { TestBed } from '@angular/core/testing';
import { FabDial } from './fab-dial';
import type { FabOption } from './fab-menu';

const OPTIONS: FabOption[] = [
  { id: 'new', label: 'Nuovo canto', icon: 'edit' },
  { id: 'import', label: 'Importa', icon: 'fileUp' },
];

function setup() {
  // jsdom has no showModal/close on <dialog>.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const fixture = TestBed.createComponent(FabDial);
  fixture.componentRef.setInput('options', OPTIONS);
  fixture.componentRef.setInput('label', 'Aggiungi');
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const tap = (selector: string) => {
    el.querySelector<HTMLElement>(selector)!.click();
    fixture.detectChanges();
  };
  const dialog = () => el.querySelector('dialog')!;
  const open = () => {
    fixture.componentInstance.open(document.createElement('button'));
    fixture.detectChanges();
  };
  return { fixture, el, tap, dialog, open };
}

describe('FabDial', () => {
  afterEach(() => vi.useRealTimers());

  it('opens with every choice, and tells the "+" to hide under the ×', () => {
    const { fixture, el, dialog, open } = setup();
    expect(dialog().classList.contains('open')).toBe(false);
    open();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(dialog().classList.contains('open')).toBe(true);
    expect(fixture.componentInstance.dialOpen()).toBe(true);
    expect(Array.from(el.querySelectorAll('.drop')).map((d) => d.textContent?.trim())).toEqual(['Nuovo canto', 'Importa']);
  });

  it('stacks upwards: the last choice is the lowest', () => {
    const { el, open } = setup();
    open();
    const drops = el.querySelectorAll<HTMLElement>('.drop');
    expect(drops[0].style.getPropertyValue('--i')).toBe('1');
    expect(drops[1].style.getPropertyValue('--i')).toBe('0');
  });

  it('a choice closes the dialog first, so a file picker can open from the same tap', () => {
    const { fixture, el, dialog, open } = setup();
    open();
    const seen: [string, boolean][] = [];
    fixture.componentInstance.chosen.subscribe((id: string) => seen.push([id, dialog().hasAttribute('open')]));
    el.querySelectorAll<HTMLElement>('.drop')[1].click();
    expect(seen).toEqual([['import', false]]);
  });

  it('the × melts the choices back first, and only then removes the dialog', () => {
    vi.useFakeTimers();
    const { fixture, tap, dialog, open } = setup();
    open();
    tap('.close');
    expect(dialog().classList.contains('open')).toBe(false);
    expect(dialog().hasAttribute('open')).toBe(true);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(fixture.componentInstance.dialOpen()).toBe(false);
  });

  it('a tap outside closes it too', () => {
    const { tap, dialog, open } = setup();
    open();
    tap('.scrim');
    expect(dialog().classList.contains('open')).toBe(false);
  });

  it('never stays open past phone width, where it would be hidden and block the page', () => {
    const { fixture, dialog, open } = setup();
    open();
    const original = window.matchMedia;
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    window.matchMedia = original;
    expect(dialog().hasAttribute('open')).toBe(false);
  });
});
