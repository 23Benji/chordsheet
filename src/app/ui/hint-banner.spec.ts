import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LibraryService } from '../services/library.service';
import { HintBanner } from './hint-banner';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('HintBanner', () => {
  afterEach(() => localStorage.clear());

  it('suggests "Aggiungi alla schermata Home" in iPhone Safari, and remembers dismissal', () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { value: IPHONE, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    TestBed.configureTestingModule({
      imports: [HintBanner],
      providers: [{ provide: LibraryService, useValue: { isEmpty: signal(false) } }],
    });
    const fixture = TestBed.createComponent(HintBanner);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Aggiungi alla schermata Home');

    el.querySelector<HTMLButtonElement>('[aria-label="Non mostrare più"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.hint')).toBeNull();
    expect(localStorage.getItem('innario.dismissedHints')).toBe('["install"]');
    Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
  });
});
