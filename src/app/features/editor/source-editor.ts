import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { highlightChordPro } from '../../core/chordpro-highlight';
import { IT } from '../../i18n/it';

/**
 * ChordPro text editor with light highlighting. The trick: a transparent
 * <textarea> (it receives typing and shows the caret) sits exactly on top of
 * a <pre> showing the same text in colour. Both share font, padding and
 * wrapping, and the same grid cell, so they always line up.
 */
@Component({
  selector: 'app-source-editor',
  template: `
    <div class="source">
      <pre class="highlight" aria-hidden="true">@for (line of tokens(); track $index) {@for (token of line; track $index) {<span [class]="token.cls">{{ token.text }}</span>}{{ '\\n' }}}{{ ' ' }}</pre>
      <textarea
        #area
        spellcheck="false"
        autocapitalize="off"
        [attr.aria-label]="t.tabSource"
        [value]="text()"
        (input)="changed.emit(area.value)"
      ></textarea>
    </div>
  `,
  styles: `
    .source {
      display: grid;
      min-height: 60vh;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
    }
    .highlight,
    textarea {
      grid-area: 1 / 1;
      margin: 0;
      padding: 18px 20px;
      border: none;
      font: 15px/1.6 var(--font-mono);
      letter-spacing: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      tab-size: 4;
    }
    .highlight {
      color: var(--text);
      pointer-events: none;
    }
    textarea {
      overflow: hidden;
      resize: none;
      background: transparent;
      color: transparent;
      caret-color: var(--text);

      &:focus {
        outline: none;
      }
      &::selection {
        background: var(--highlight-amber);
      }
    }
    .chord {
      color: var(--accent);
      font-weight: 700;
    }
    .directive {
      color: var(--sage);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceEditor {
  readonly text = input.required<string>();
  readonly changed = output<string>();
  protected readonly t = IT.editor;
  protected readonly tokens = computed(() => highlightChordPro(this.text()));
}
