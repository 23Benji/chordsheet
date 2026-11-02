# Chordsheet (originally “Innario”) — Product & Technical Specification

> Renamed to **Chordsheet** in 1.5 (see DECISIONS.md). Internal ids (database name, file-format ids) keep “innario” for compatibility.

A free, offline-first songbook app for a worship guitarist: chords over lyrics, transposition, personal notes and solos, setlists and a stage-ready performance mode. It replaces SongbookPro for one musician (Benji) and is designed so others in the church could use it later.

This document is the single source of truth. Build it **milestone by milestone** (section 9). When something here is ambiguous, choose the simplest option that respects the principles below and note the decision in `DECISIONS.md`.

---

## 1. Principles

1. **Laptop first, then iPad, then iPhone.** Primary target: Chrome/Edge on a Windows or macOS laptop, keyboard + mouse/trackpad. iPad (Safari, touch) must work well by Milestone 7; iPhone is "usable", not optimised.
2. **Offline-first, no backend, no account, no tracking.** All data lives on the device (IndexedDB). The app must work with the network off after the first load.
3. **Beautiful and calm.** Warm dark theme matching the church's new projection slides (section 6). Reading comfort on stage beats decoration.
4. **The song file is sacred; personal notes are a separate layer.** Re-importing or editing a song must never silently delete the user's notes.
5. **Free forever.** Free hosting (GitHub Pages), open-source libraries only, no paid APIs.
6. **Italian UI.** All visible strings in Italian, kept in one place so translation is possible later.

---

## 2. Tech stack (fixed unless a blocker appears)

| Concern | Choice |
|---|---|
| Framework | **Angular, latest stable**, standalone components, **signals** for state, new control flow (`@if`, `@for`), strict TypeScript |
| PWA | `@angular/pwa` (Angular service worker), web app manifest, installable on Chrome/Edge and via "Aggiungi a Home" on iPadOS |
| ChordPro | **`chordsheetjs`** (parsing, chord transposition). Render our own HTML from its `Song` model — do not rely on its HTML formatters for final styling |
| Storage | **Dexie** (IndexedDB wrapper). Call `navigator.storage.persist()` on first run |
| Styling | Plain SCSS with CSS custom properties (design tokens, section 6). No UI kit unless clearly needed (Angular CDK is fine for overlays/drag-drop) |
| Fonts | Self-hosted, offline: **Carlito** (body/UI/lyrics) and **Caladea** (headings, italic accents). Both OFL and metric-compatible with Calibri/Cambria used in the church slides. Use `@fontsource/*` packages if available, otherwise vendor the woff2 files into `src/assets/fonts` |
| Audio (metronome) | Web Audio API, no library |
| Tests | Angular CLI default unit-test setup; pure logic (parsing, transposition, anchoring, import) must have unit tests |
| Hosting | GitHub Pages via a GitHub Actions workflow (`ng build --base-href /<repo>/`) |

Keep the production bundle lean (target < 500 KB gzipped initial, lazy-load the editor and setlists).

---

## 3. Source material in this repo

- `songs/` — **166 ChordPro files** (`.cho`), converted from the church PDF songbook. *Since 1.3 this folder is local only (git-ignored): the public app ships no songs; songbooks are shared as files and imported (§5.2).*
  - File name: `NNN[suffix] - Title.cho`, e.g. `001 - Io lodo Te.cho`, `004b - Siam riuniti tutti qui.cho` (alternative version), `200 - O holy night.cho` (Christmas songs 200–203).
  - Numbers match the church's projection PowerPoint (1–146). Song 145 is missing from the source PDF; 146 exists.
  - Each file starts with `{title: …}` and `{meta: numero 12}` (number + optional version letter, e.g. `numero 123c`). Some have `{key}`, `{capo}`, `{tempo}`, `{subtitle}`.
  - Choruses use `{start_of_chorus}` / `{end_of_chorus}`. Performance notes are `{comment: …}` (e.g. "x2", "basso", "fermo batteria", "Ritornello: …").
  - Some songs carry a **second key** written as plain text at the end of lines in parentheses, e.g. `…AL SI[Bm]GNOR.    (Am Em Am Em)`, and a header comment `Tra parentesi a fine riga: gli accordi nella seconda tonalità`. Render that parenthesised group in the muted "annotation" style, right-aligned on the line. Do not transpose it in v1 (nice-to-have later: parse and transpose it too).
  - Many older songs are entirely UPPERCASE; leave text as is.
  - **Known data issues from the PDF conversion** (fixed by hand with the visual editor, §5.7 — not automatically): many chords sit in the middle of a word (`RISCA[G#m]TTATO`); some songs contain chord lines in the old notation as plain text (`F#- D A-E`, `B- G D A — D`, `C AmDm G F C`, `Mi- Do+`; `-` = minor). Lines made only of such chords are recognised automatically, normalised (`B-` → Bm, `E7-` → Em7, Do/Re/Mi → C/D/E), shown in chord style and transposed; lines mixing chords and lyrics stay as text; songs 029, 071b, 116 and 146 have no chords at all.
- `assets/` — `bg-dark.jpg` (calm warm blurred background, for empty states / about page only), `bg-dark-rays.jpg` (warm light rays, for the welcome screen only).

On first launch, if the library is empty, offer **"Importa l'innario incluso"**, which loads all files from `songs/` (bundle them as static assets). Also support importing user files (section 5.2).

---

## 4. Data model (Dexie)

```ts
interface Song {
  id: string;            // uuid
  number: number | null; // from {meta: numero}
  suffix: string;        // 'b', 'c' … for alternative versions, '' otherwise
  title: string;
  chordpro: string;      // the full source text — edits change this
  key?: string;          // from {key} or detected (first chord) — display only
  capo?: number;
  tempo?: number;
  tags: string[];
  source: 'bundled' | 'imported' | 'created';
  createdAt: number; updatedAt: number;
}

interface SongPrefs {      // per-song personal playback settings
  songId: string;
  transpose: number;       // semitones, -11..+11
  capo: number;            // 0..11 (display shape chords: sounding = shape + capo)
  preferSharps?: boolean;  // accidental preference after transposition
  fontScale?: number;
  columns?: 1 | 2;
  autoscrollSpeed?: number;
}

type AnnotationType = 'note' | 'highlight' | 'tab' | 'chord';
interface Annotation {
  id: string;
  songId: string;
  anchor: LineAnchor;      // where it belongs (see 4.1)
  type: AnnotationType;
  text: string;            // note text, tab block (monospace), or custom chord name
  color?: 'amber' | 'coral' | 'sage' | 'sky';
  createdAt: number; updatedAt: number;
}

interface LineAnchor {
  sectionIndex: number;    // paragraph/section index in parsed song
  lineIndex: number;       // line index within the song (flattened)
  textHash: string;        // hash of the line's lyric text (chords stripped, normalised)
  snippet: string;         // first ~40 chars of lyric text, for fuzzy re-anchoring
  occurrence: number;      // nth identical line in the song (choruses repeat!)
}

interface Setlist {
  id: string; name: string; date?: string;     // e.g. "Domenica 9 novembre"
  items: { songId: string; transpose?: number; note?: string }[];
  createdAt: number; updatedAt: number;
}

interface Settings { theme: 'dark' | 'light'; fontScale: number; chordStyle: 'above' | 'inline'; showChordDiagrams: boolean; keyboardMap: Record<string,string>; }
```

### 4.1 Annotation anchoring (important)
When a song's text changes (user edit or re-import), re-anchor every annotation: first exact `textHash` + `occurrence`, then same `textHash` any occurrence, then best fuzzy match on `snippet` (normalised Levenshtein ≥ 0.8), else mark the annotation **"da ricollegare"** (orphaned) and show it in a tray at the bottom of the song where the user can drag it to a line or delete it. Never delete annotations automatically. Unit-test this.

---

## 5. Features

### 5.1 Library (home)
- Grid/list of songs: number badge (amber pill), title, key, small icons if the song has personal notes or tabs.
- **Search** (instant, accent-insensitive, case-insensitive) across number ("12", "123b"), title and lyrics. Typing a number and pressing Enter opens that song directly.
- **Versions grouped**: songs sharing a number (123, 123b, 123c …) are one row, showing the main version (no suffix) and a small "N versioni" pill. While searching, the best-matching version represents the row (so "123c" + Enter opens 123c).
- Filters: all / with my notes / Christmas (200+) / with several versions. Sort by number (default) or title.
- Keyboard: `/` focuses search, arrows move, Enter opens.

### 5.2 Import / export
- Import: drag & drop or file picker for `.cho`, `.chopro`, `.chordpro`, `.txt` (ChordPro) and `.zip` of those. Detect number/suffix from `{meta: numero}` or from the file name pattern `NNN[x] - Title`.
- On conflict (same number+suffix exists): show a dialog per file or "apply to all": *Sostituisci testo (mantieni le mie note)* / *Tieni entrambi* / *Salta*. Replacing re-anchors annotations (4.1).
- **Backup**: export everything (songs, prefs, annotations, setlists, settings) as one `innario-backup-YYYY-MM-DD.json`; restore from it (merge or replace). This is how data moves between laptop and iPad in v1.
- Export a single song as `.cho` (with or without personal notes embedded as `{comment}` lines) and **print/PDF** via a print stylesheet (A4, chords above lyrics, black on white).

### 5.3 Song view (the heart of the app)
- Header: number pill, title, key (after transposition), capo, tempo; buttons: version switcher, transpose −/+, capo, font −/+, 1/2 columns, notes on/off, performance mode, edit, add to setlist.
- **Version switcher**: when the song has alternative versions, a row of number pills (`123` `123b` `123c` …) next to transpose switches between them. Prefs (transpose, capo …) stay per version.
- **Two-column pages (laptop, ≥ 900px wide, default)**: no scrolling needed while playing. The song is laid out in two columns of fixed height; a verse/chorus is never cut between columns if it fits in one. What doesn't fit continues on the next "page" (two more columns), flipped with `→`/`PageDown`/`Space` and `←`/`PageUp` or the ‹ / "Continua ›" buttons; "Pagina 1 / 2" shows where you are. The 1/2-columns toggle (per song) switches to normal vertical scrolling. Narrow screens always scroll.
- **Chords above lyrics**: each line rendered as segments (chord on top, lyric below), chords bold in the accent colour; a chord with no lyric under it still keeps its slot. Long lines wrap by segment without separating a chord from its syllable.
- **Section labels on every song**, readable and easy to tell apart (a small coloured tag above each section): *Strofa 1, 2, 3 …* (neutral), *Ritornello* (amber, tinted block), *Bridge* (coral, faint coral block), *Intro / Intermezzo musicale / Finale* (sage). Derived automatically: `{start_of_chorus}` → Ritornello; `{comment: Ritornello: …}` → a compact "Ritornello (ripeti) …" reminder; chord-only paragraphs → Intro (before the first sung part), Finale (after the last) or Intermezzo musicale; plain-text headings in the converted songs (`Intro: A, D, A, E`, `Intermezzo musicale …`, `x finale …`, `Bridge`, `Special`) → that section; remaining paragraphs are numbered verses. Explicit ChordPro directives win: `{start_of_bridge}`, `{start_of_verse: Strofa finale}`, `{start_of_part: Intro}`, `{start_of_chorus: Ritornello 2}`. A Bridge cannot be detected automatically — it is set in the editor.
- Comments in muted italic; `(Am Em …)` second-key groups right-aligned in muted style.
- **Transposition**: semitone steps, persisted per song (SongPrefs). Show both "Tonalità: G (originale E)" when transposed. Respect sharps/flats preference; default: choose the spelling that matches the target key.
- **Capo**: shows chord shapes = sounding chords transposed down by capo; header shows "Capo 2 · suona in A".
- **Chord diagrams** (guitar): hover/tap a chord to show a small fingering diagram (built-in dictionary for common chords incl. m, 7, m7, maj7, sus2, sus4, add9, slash chords → show base shape + bass note). Toggle in settings.
- Font scaling persists per song and globally; layout reflows.

### 5.4 Personal layer (notes, highlights, solos)
- Select/click a line → small toolbar: **Nota**, **Evidenzia**, **Tab/Assolo**, **Accordo personale**.
  - *Nota*: short text shown as a coloured margin note next to the line (and inline under the line on narrow screens).
  - *Evidenzia*: tinted background on the line (4 colours).
  - *Tab/Assolo*: monospace block inserted visually under the line (e.g. guitar tab, 6 lines), with a title like "Assolo intro". Paste-friendly, preserves spaces.
  - *Accordo personale*: override/annotate a chord at that line (e.g. "Cadd9 invece di C") shown in coral above the original.
- Song-level note: a free text "Promemoria" panel at the top (collapsed by default), e.g. "Attacco piano, entra la batteria al ritornello".
- **Intro card** (added M5.1): per song, how to start it — *Parte* (e.g. "come il ritornello"), *Accordi* (transposed with the song), *Ritmo* (strumming, e.g. "↓ ↓↑ ↑↓↑"), *Nota*. Shown as a sage "Intro" block before the first section, also in performance mode.
- Global toggle "Mostra le mie note" (for clean view).
- All notes are stored as Annotations (section 4), never written into the ChordPro text unless the user exports with notes embedded.
- Implementation (M3): selecting a line (click/tap or Enter) opens a panel at the bottom of the song view with these actions and the line's existing annotations (edit/delete). Notes appear beside the line (below it in narrow columns), highlights tint the line, tabs are monospace blocks under it, personal chords appear in coral above the chord they replace and transpose with the song. The Promemoria is stored in SongPrefs. Orphaned notes show a banner "N note da ricollegare" → list with *Ricollega* (then tap a line) and *Elimina*. Editor saves re-anchor and report orphans in a toast.

### 5.5 Performance mode
- Full screen (Fullscreen API), hides all chrome except a thin auto-hiding top bar (title, key, song x/y in setlist).
- **Screen Wake Lock** while active.
- Navigation: `Space`/`PageDown`/`→`/`↓` = next screen/page, `PageUp`/`←`/`↑` = previous; at the end of the song, next goes to the next song in the active setlist. These keys are what Bluetooth page-turner pedals (AirTurn, PageFlip) send — make the mapping configurable in Settings.
- **Auto-scroll**: start/stop with `S`, speed −/+ with `[`/`]`, speed saved per song; optional start from tempo.
- **Two-column layout** option for landscape screens; paginate by columns so a whole verse/chorus is never split if it fits.
- Large default font, maximum contrast variant of the theme.
- Implementation (M4): route `canto/:id/esibizione[?coda=…]`, full-screen overlay with Screen Wake Lock; auto-hiding top bar (title, key/capo, song x/y, auto-scroll ▶/⏸ with seconds per page and "Da tempo", font −/+, 1/2 columns, Tasti e pedale, full screen, exit); tap zones (right = next, left = back, middle = bar); small always-visible page indicator; "Prossimo: …" at the end of a song in a queue. Auto-scroll speed in seconds per screen; in two-column pages it turns pages automatically with a progress bar.

### 5.6 Setlists
- Create a setlist (name + date), add songs from library or song view, reorder by drag & drop, per-item transpose override and short note ("solo chitarra", "ripetere rit."), remove.
- Play a setlist in performance mode; next/prev moves through songs.
- Duplicate a setlist; share one as a small `.json` file (and import it — songs matched by number+suffix).
- Implementation (M5): sidebar tabs Libreria | Scalette; setlists page (create with name + date, import, play, duplicate, share, delete); setlist page (drag & drop with handle or ↑/↓, per-song transpose with resulting key, note, play from any song, search box to add songs — number + Enter adds); "Aggiungi a una scaletta" menu in the song view. Performance mode shows the setlist name, "Canto x di y", the item's note and "Prossimo: …".

### 5.7 Editor
- **Editor visuale (main editor)**: edit a song without typing `[brackets]`. Lyrics are plain editable text; chords are shown above them as in the song view. Click/tap above a syllable to add a chord (palette with the chords already used in the song + free input), drag a chord to move it to another syllable, click a chord to change or delete it. Add/remove lines, mark a block as chorus, add a comment. **Set or change a section's kind/label** (Strofa, Ritornello, Bridge, Intro, Intermezzo, Finale, or free text), saved as the ChordPro section directives listed in §5.3. This is how the badly placed chords from the PDF conversion get fixed (§3).
- Old-notation chord lines (`F#- D A-E` over a lyric line) can be converted into chords over that lyric with one click.
- Saving writes the new ChordPro text to the song in IndexedDB (the files in `songs/` are never touched); the song can be exported as `.cho`.
- Implementation (M2): lyric lines are edited in a monospace font with the chords on a row above (click to add — palette of the song's chords —, drag or ←/→ to move, click/Enter to change, Canc to delete; Ctrl/Cmd+K adds a chord at the cursor; Enter splits a line, Backspace at the start merges). Section cards with kind (Strofa automatica, Ritornello, Bridge, Intro, Intermezzo musicale, Finale) and free label; move, duplicate, delete; notes (`{comment}`). Live preview with the song-view renderer beside the editor (tab on narrow screens). Undo/redo, unsaved-changes guard, delete song, "Ripristina originale" for bundled songs.
- Split view: ChordPro source (monospace textarea with light syntax highlighting of `[chords]` and `{directives}`) | live preview using the same renderer as the song view.
- Helpers: insert chord at cursor, wrap selection as chorus, add comment, transpose the source permanently (with confirmation), "Converti accordi sopra il testo → ChordPro" for pasted chords-over-words text (chordsheetjs `ChordsOverWordsParser`).
- Create new song (number, title) from a template. Validate number+suffix uniqueness.
- Saving re-anchors annotations (4.1) and shows a toast if any became orphaned.

### 5.8 Metronome
- Small widget in song view/performance mode: BPM from `{tempo}` or set manually, tap tempo, visual pulse (amber dot) + optional click sound (Web Audio, sample-accurate scheduling).

### 5.9 Settings & about
- Theme dark (default) / light, global font size, chord style, chord diagrams on/off, pedal key mapping, accidental preference, "Ripristina innario incluso", backup/restore, storage usage, app version.
- About page: logo, short credits (ChordSheetJS, fonts).
- Implementation (M6): `/impostazioni` (link at the bottom of the sidebar) with Aspetto (theme, text size, chord style, accidentals, diagrams, notes), Esibizione (keys/pedal), Dati (backup export / restore with "Unisci" or "Sostituisci", restore bundled songbook, storage used + persistence) and Informazioni (logo, version, credits). Song view toolbar: metronome, export menu (.cho, .cho with notes, Stampa / PDF).

### 5.10 PWA specifics
- Manifest: name "Innario", short_name "Innario", theme/background `#14100D`, display `standalone`, icons generated from the logo/number-pill motif (192, 512, maskable, Apple touch icon 180).
- Service worker caches the app shell, fonts and bundled songs; show a discreet "Nuova versione disponibile — Aggiorna" toast on update.
- iPadOS: `apple-mobile-web-app-capable`, status bar style black-translucent, safe-area insets, an in-app hint explaining "Condividi → Aggiungi alla schermata Home" when running in Safari but not installed (Safari can evict storage of non-installed sites).

---

## 6. Design system

The look must match the church's new projection slides ("Luce" style): warm near-black brown background, warm white text, amber accent, soft coral for a second voice/personal chord. Calm, generous spacing, rounded corners, no harsh borders.

### 6.1 Tokens (dark — default)
```scss
--bg:            #14100D;  // page background (same as church website theme colour)
--bg-elev-1:     #1C1612;  // panels, header
--surface:       #2B2119;  // cards, pills, inputs, chorus tint (use at ~40% for chorus)
--border:        #3A2E25;
--text:          #F6EFE4;  // lyrics, primary text
--text-muted:    #A8988A;  // secondary text, comments, second-key groups
--accent:        #F2B45C;  // chords, number pills, focus rings, active states
--accent-ink:    #14100D;  // text on accent
--coral:         #EE9A78;  // personal chords, second voice, warnings
--sage:          #9CC3A3;  // success
--sky:           #8FB8DE;  // info / one highlight colour
--highlight-amber: rgba(242,180,92,.18);
--highlight-coral: rgba(238,154,120,.18);
--highlight-sage:  rgba(156,195,163,.16);
--highlight-sky:   rgba(143,184,222,.16);
--radius-s: 8px; --radius-m: 12px; --radius-l: 18px;
--shadow: 0 8px 30px rgba(0,0,0,.35);
```
### 6.2 Tokens (light — optional theme)
`--bg #FBF8F4`, `--bg-elev-1 #FFFFFF`, `--surface #EFE6DC`, `--border #E3D6C8`, `--text #2A1F17`, `--text-muted #8C7B6C`, `--accent #C46A1E`, `--accent-ink #FFFFFF`, `--coral #B0473A`.

### 6.3 Typography
- UI + lyrics: **Carlito**. Lyrics 22px default (song view), chords Carlito Bold 0.85em in `--accent`, line-height 1.35, chord row tight above lyric row.
- Headings and decorative accents: **Caladea** (italic for the welcome verse).
- Monospace for tabs/editor: system monospace stack (`ui-monospace, "Cascadia Code", Consolas, monospace`).
- Numbers in pills: Carlito Bold, tabular figures.

### 6.4 Motifs & components
- **Number pill**: rounded rectangle, `--accent` background with `--accent-ink` text (same as the slides). Secondary pills: `--surface` background, muted text.
- Cards: `--bg-elev-1`, radius-l, subtle shadow on hover, no outlines.
- Buttons: ghost by default (transparent, text colour), primary = accent fill. Icon buttons 40×40 min (44×44 on touch).
- Focus ring: 2px `--accent` with 2px offset. All interactive elements keyboard-reachable.
- Welcome / empty library screen: `bg-dark-rays.jpg` background, app icon + name top-left, the line *"Accordi e testi, sempre con te."* in Caladea italic and "TRASPONI · ANNOTA · SUONA DAL VIVO" in small spaced amber caps, plus the import button. (Since 1.6; before: Psalm 150:6.)
- No decorative stripes or accent bars; separation through spacing and surface tint.
- Contrast: body text ≥ 7:1 on `--bg` in performance mode; ≥ 4.5:1 everywhere else.

### 6.5 Layout
- Laptop: left sidebar (library list with search, collapsible) + main song view; setlist panel can dock on the right.
- iPad landscape: same as laptop; portrait: sidebar becomes a slide-over.
- iPhone: single column, bottom bar (Libreria, Scalette, Impostazioni).

---

## 7. Non-functional requirements
- Opening any song < 100 ms after the library is loaded; search results update < 50 ms for 200 songs.
- Works fully offline after first visit; survives reloads; no data loss on update.
- Accessibility: semantic HTML, labels on icon buttons, prefers-reduced-motion respected.
- No external network calls at runtime (fonts and songs are bundled).

---

## 8. Testing & quality gates
- Unit tests: ChordPro import (all 166 bundled files parse without error and keep their number/title), number/suffix detection, transposition & capo maths (incl. slash chords and accidental spelling), second-key group detection, annotation re-anchoring (4.1), backup round-trip.
- A dev-only "parse all songs" check page or test that reports any file that fails to parse.
- Before marking a milestone done: `ng build` succeeds with no errors, tests pass, Lighthouse PWA/installability check passes (from Milestone 1), and manual check in Chrome at 1366×768 and 1920×1080.

---

## 9. Milestones (build in this order; commit after each)

**M1 — Foundation + read songs**
Angular project, PWA setup, design tokens + fonts, Dexie schema, bundled import of `songs/`, library with search, song view with chords-above-lyrics rendering, choruses/comments/second-key styling, transpose + capo + font size persisted per song, dark theme. GitHub Pages workflow.
*Done when:* all 166 songs import and render; search "123c" and "grazia" work; transposing song 1 to D shows correct chords; app installs in Chrome and works offline.

**M1.1 — Feedback after M1** (done)
Versions grouped (library row + switcher in song view); two-column pages with page numbers and keyboard flipping on laptops; 1/2-column toggle; automatic section labels (Strofa N, Ritornello, Intro/Intermezzo/Finale, Bridge via directives).

**M2 — Visual editor** (moved forward: the converted songs need fixing first)
Editor visuale (§5.7): click to add chords, drag to move, edit lyrics, chorus/comment, section kind/label (e.g. Bridge), old-notation chord-line conversion; ChordPro source view with live preview; new song from template; chords-over-words paste conversion; save to IndexedDB, single-song `.cho` export.

**M3 — Personal layer**
Annotations (note, highlight, tab, personal chord), song-level Promemoria, toggle, orphan tray, re-anchoring + tests. Editor saves re-anchor annotations from here on.

**M4 — Performance mode**
Fullscreen, wake lock, pedal/keyboard navigation (configurable, reusing the M1.1 page flipping), auto-scroll, two-column pagination in full screen.

**M5 — Setlists**
Setlists CRUD, drag-reorder, per-item transpose, play in performance mode, share/import JSON.

**M6 — Extras**
Chord diagrams, metronome, backup/restore, print stylesheet, light theme, settings page.

**M7 — iPad & iPhone polish** (done: swipe page turning, iPhone bottom bar, 44px touch targets, safe areas, Safari install hint, storage persistence prompt, update toast)
Touch targets, gestures (swipe for next page in performance mode), safe areas, Safari install hint, portrait/landscape layouts, storage persistence prompt.

---

## 10. Out of scope (v1)
Cloud sync / accounts, collaboration, audio playback, sheet-music (staff) notation, PDF song import, App Store packaging. Keep the architecture open for a later optional sync (e.g. a `SyncService` interface with a no-op implementation).
