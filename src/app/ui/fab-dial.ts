import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { IT } from '../i18n/it';
import type { FabOption } from './fab-menu';
import { Icon } from './icon';

/** Keep in step with the closing transitions in fab-dial.scss. */
const CLOSE_MS = 240;

/**
 * The choices of the floating "+": a tap turns it into an × and each choice
 * grows out of it as a drop that morphs into a glass button; closing melts
 * them back in.
 *
 * It lives in a native <dialog>: browsers draw it above everything (the tab
 * bar too) and make the page behind it unreachable, so a tap outside can only
 * close it.
 */
@Component({
  selector: 'app-fab-dial',
  imports: [Icon],
  template: `
    <dialog #dial class="dial" tabindex="-1" [class.open]="expanded()" [attr.aria-label]="label()" (cancel)="onCancel($event)">
      <div class="scrim" (click)="closeDial()"></div>
      <div #anchor class="anchor">
        @for (option of options(); track option.id; let i = $index, count = $count) {
          <!-- The choices stack upwards: --i is how many sit below this one. -->
          <button type="button" class="drop" [style.--i]="count - 1 - i" (click)="choose(option.id)">
            <span class="inner"><span class="content"><app-icon [name]="option.icon" /> {{ option.label }}</span></span>
          </button>
        }
        <button type="button" class="btn icon-btn fab glass close" [attr.aria-label]="closeLabel" [title]="closeLabel" (click)="closeDial()">
          <app-icon name="plus" />
        </button>
      </div>
    </dialog>
  `,
  // fab-menu.scss: the × is the same button as the "+".
  styleUrls: ['./fab-menu.scss', './fab-dial.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Above phone width the "+" is hidden, and an open dialog would be hidden
    // with it while still blocking the page: never leave it open there.
    '(window:resize)': 'closeIfTooWide()',
    '(window:popstate)': 'closeNow()',
  },
})
export class FabDial {
  readonly options = input.required<readonly FabOption[]>();
  readonly label = input.required<string>();
  /** The choice tapped. Emitted inside the tap, so it can open a file picker. */
  readonly chosen = output<string>();

  protected readonly closeLabel = IT.common.close;
  /** The dialog is showing (also while it animates closed). */
  readonly dialOpen = signal(false);
  /** Drives the morph: false = every choice is hidden inside the "+". */
  protected readonly expanded = signal(false);

  private readonly dial = viewChild.required<ElementRef<HTMLDialogElement>>('dial');
  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  open(trigger: HTMLElement): void {
    if (this.dialOpen()) return;
    // Where the "+" is, so the × sits exactly over it. Set directly, not through
    // a binding: it must be right before the dialog's first frame.
    const box = trigger.getBoundingClientRect();
    const anchor = this.anchor().nativeElement;
    anchor.style.left = `${box.left}px`;
    anchor.style.top = `${box.top}px`;
    const dial = this.dial().nativeElement;
    dial.showModal();
    // Otherwise the browser focuses the first choice and rings it, as if it were
    // already picked. The Tab key still reaches every choice from here.
    dial.focus();
    this.dialOpen.set(true);
    // CSS can't animate to "as wide as the text", so each drop is told its
    // width. Measuring also makes the browser lay out the closed state first:
    // without it there would be nothing to morph from.
    dial.querySelectorAll<HTMLElement>('.drop').forEach((drop) => {
      const content = drop.querySelector('.content');
      if (content) drop.style.setProperty('--width', `${Math.ceil(content.getBoundingClientRect().width)}px`);
    });
    this.expanded.set(true);
  }

  /** × or a tap elsewhere: the drops melt back into the "+", then the dialog goes. */
  protected closeDial(): void {
    if (!this.expanded()) return;
    this.expanded.set(false);
    this.closeTimer = setTimeout(() => this.closeNow(), CLOSE_MS);
  }

  /**
   * The dialog closes first, no animation: the next screen or the file picker
   * is coming up, and a file picker needs the page behind to be reachable.
   */
  protected choose(id: string): void {
    this.closeNow();
    this.chosen.emit(id);
  }

  /** Esc: animate like the ×, instead of the browser closing it at once. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closeDial();
  }

  protected closeIfTooWide(): void {
    if (this.dialOpen() && !window.matchMedia('(max-width: 600px)').matches) this.closeNow();
  }

  protected closeNow(): void {
    clearTimeout(this.closeTimer);
    this.expanded.set(false);
    this.dialOpen.set(false);
    const dial = this.dial().nativeElement;
    if (dial.open) dial.close();
  }
}
