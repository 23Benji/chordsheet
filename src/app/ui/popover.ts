import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * The one pop-up pattern of the app (menus, small control panels): a button
 * that opens a panel anchored to it. Built on CDK Overlay, so the panel is
 * positioned next to the button, flips above it when there's no room, and
 * closes with Esc or a click outside. Styles of the panel: `.popover-panel`
 * and `.menu-item` in styles.scss.
 *
 * <app-popover label="Tonalità" triggerClass="chip">
 *   <span trigger>Tonalità D</span>
 *   …panel content…
 * </app-popover>
 */
@Component({
  selector: 'app-popover',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <button
      type="button"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      [class]="'btn ' + triggerClass()"
      [class.open]="open()"
      [attr.aria-expanded]="open()"
      [attr.aria-haspopup]="menu() ? 'menu' : 'dialog'"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="toggle()"
    >
      <ng-content select="[trigger]" />
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayPush]="true"
      (overlayOutsideClick)="onOutside($event, origin.elementRef.nativeElement)"
      (overlayKeydown)="$event.key === 'Escape' && close()"
      (detach)="close()"
    >
      <div class="popover-panel" [class.menu]="menu()" [attr.role]="menu() ? 'menu' : 'dialog'" [attr.aria-label]="label()" (click)="onPanelClick($event)">
        <ng-content />
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Popover {
  readonly label = input.required<string>();
  /** Extra classes for the trigger button: 'icon-btn', 'chip' … */
  readonly triggerClass = input('icon-btn');
  /** Menus close as soon as an item is chosen. */
  readonly menu = input(false);

  readonly open = signal(false);

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  toggle(): void {
    this.open.update((open) => !open);
  }

  close(): void {
    this.open.set(false);
  }

  /** A click on the trigger is handled by toggle(), not as "outside". */
  protected onOutside(event: MouseEvent, trigger: HTMLElement): void {
    if (!trigger.contains(event.target as Node)) this.close();
  }

  protected onPanelClick(event: MouseEvent): void {
    if (this.menu() && (event.target as HTMLElement).closest('.menu-item')) this.close();
  }
}
