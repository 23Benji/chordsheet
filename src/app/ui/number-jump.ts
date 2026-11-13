import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NUMBER_JUMP_DELAY_MS, addDigit, songForNumber, startsNumberJump } from '../core/number-jump';
import { IT } from '../i18n/it';
import { LibraryService } from '../services/library.service';

/**
 * "Vai al numero" (computer keyboard, Benji 2026-11-13): type a song's
 * number anywhere — library, a song, setlists — and a small box shows the
 * number and the song's title; Enter opens it, or it opens by itself after
 * a short pause. Esc cancels, ⌫ takes back a digit. Not in the editor or in
 * presentation mode (see startsNumberJump). Phones without a keyboard never
 * send these keys, so nothing changes there.
 */
@Component({
  selector: 'app-number-jump',
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    @if (digits()) {
      <div class="box" role="status" aria-live="polite">
        <span class="label">{{ t.label }}</span>
        <span class="number">{{ digits() }}</span>
        @if (song(); as match) {
          <span class="title">{{ match.title }}</span>
        } @else {
          <span class="title none">{{ t.none }}</span>
        }
        <span class="hint">{{ song() ? t.hint : t.cancelHint }}</span>
      </div>
    }
  `,
  styles: `
    .box {
      position: fixed;
      top: 28%;
      left: 50%;
      z-index: 30;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      width: max-content;
      min-width: 280px;
      max-width: min(480px, calc(100vw - 2 * var(--page-x)));
      padding: var(--space-5) var(--space-8) var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      box-shadow: var(--shadow);
      text-align: center;
      transform: translateX(-50%);
      pointer-events: none;
      animation: appear 0.12s ease-out;
    }
    @keyframes appear {
      from {
        opacity: 0;
        transform: translateX(-50%) scale(0.96);
      }
    }
    .label {
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .number {
      color: var(--accent);
      font-family: var(--font-heading);
      font-size: 56px;
      font-weight: 700;
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
    }
    .title {
      max-width: 100%;
      overflow: hidden;
      color: var(--text);
      font-size: 19px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;

      &.none {
        color: var(--text-muted);
        font-weight: 400;
      }
    }
    .hint {
      margin-top: var(--space-2);
      color: var(--text-muted);
      font-size: 13px;
    }
    @media (prefers-reduced-motion: reduce) {
      .box {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberJump {
  protected readonly t = IT.numberJump;
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);

  protected readonly digits = signal('');
  protected readonly song = computed(() => songForNumber(this.library.versionsByNumber(), this.digits()));
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const digits = this.digits();
    if (!digits) {
      const starts = startsNumberJump({
        key: event.key,
        modifier: event.ctrlKey || event.metaKey || event.altKey,
        typing: isTyping(event.target),
        dialogOpen: !!document.querySelector('dialog[open]'),
        url: this.router.url,
      });
      if (!starts) return;
      event.preventDefault();
      this.set(addDigit('', event.key)!);
      return;
    }

    const next = addDigit(digits, event.key);
    if (next !== null) {
      event.preventDefault();
      this.set(next);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.set(digits.slice(0, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.openNow();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close();
    } else if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
      this.close(); // any other key: it was not a number after all
    }
  }

  private set(digits: string): void {
    this.digits.set(digits);
    clearTimeout(this.timer);
    if (digits) this.timer = setTimeout(() => this.openNow(), NUMBER_JUMP_DELAY_MS);
  }

  /** Opens the song shown in the box; with no song for that number the box just goes away. */
  private openNow(): void {
    const song = this.song();
    this.close();
    if (song && this.router.url.split(/[?#]/)[0] !== `/canto/${song.id}`) void this.router.navigate(['/canto', song.id]);
  }

  private close(): void {
    clearTimeout(this.timer);
    this.digits.set('');
  }
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
