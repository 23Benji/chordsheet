# PLAN

## M1 — Foundation + read songs

- [x] `git init`, Angular project (latest, standalone, strict, SCSS) created in this folder, keeping `songs/`, `assets/`, `*.md`
- [x] Dependencies: `chordsheetjs`, `dexie`, `@angular/pwa`, fonts (`@fontsource/carlito`, `@fontsource/caladea` or vendored woff2)
- [x] Design tokens `src/styles/_tokens.scss` (dark theme), global styles, self-hosted fonts
- [x] Strings in `src/app/i18n/it.ts`
- [x] Bundled songs + logos/backgrounds copied into the build as static assets (`angular.json` assets glob) + generated `public/songs-index.json` manifest
- [x] Pure logic (`src/app/core/`), with unit tests:
  - [x] `song-meta.ts`: number/suffix detection from `{meta: numero}` and file name
  - [x] `chordpro.ts`: parse ChordPro → our own render model (sections, lines, segments; chorus/comment/second-key group)
  - [x] `transpose.ts`: transpose + capo + accidental spelling (incl. slash chords), key detection
  - [x] `search.ts`: accent/case-insensitive search across number, title and lyrics
  - [x] Test: all 166 bundled files parse and keep number/title
- [x] Dexie schema (`db.ts`): songs, songPrefs, annotations, setlists, settings; `navigator.storage.persist()` on first run
- [x] Services (signals): `LibraryService` (load, bundled import), `SongPrefsService` (transpose/capo/fontScale per song), `SettingsService` (minimal)
- [x] Welcome / empty screen (rays background, logo, Psalm verse, "Importa l'innario incluso")
- [x] Layout: left sidebar library (search, filters, sort, keyboard `/` arrows Enter) + main song view
- [x] Song view: header (number pill, title, key "Tonalità: G (originale E)", capo "Capo 2 · suona in A"), transpose −/+, capo, font −/+; chords above lyrics; chorus block "Rit."; comments muted italic; second-key groups right-aligned muted
- [x] PWA: manifest (Innario, `#14100D`, standalone), icons 192/512/maskable/apple-touch 180, service worker caching app shell, fonts, songs
- [x] GitHub Pages workflow (`.github/workflows/deploy.yml`)
- [x] `ng build` + `ng test` green, commit `M1: …`, fill in Commands in CLAUDE.md, write `DECISIONS.md`
- [x] Manual check in Chrome at 1366×768 and 1920×1080, install + offline test, Lighthouse PWA check — done 2026-11-05 with Playwright on a production build: no manifest/installability errors, service worker in control, library, song, performance, Scalette and Impostazioni all open offline (Lighthouse dropped its PWA category in v12, so Chrome's own installability check was used)

## M1.1 — Feedback after M1

- [x] `core/versions.ts` (+ spec): group songs by number, collapse search results to one row per number keeping the best-ranked version
- [x] Library: one row per number, "N versioni" pill, filter "Con più versioni"
- [x] Song view: version switcher next to transpose
- [x] Song view on laptops (≥ 900px): two columns, sections never cut, overflow → next page; page numbers, "Continua →", ‹ › buttons, keys →/Space/PageDown and ←/PageUp
- [x] 1/2 column toggle (persisted in SongPrefs.columns)
- [x] SPEC: versions, paged columns, visual editor; milestones renumbered (new M2 — Visual editor)
- [x] DECISIONS.md updated
- [x] `ng build` + `ng test` green, commit

## M1.2 — Section labels

- [x] Parser: section kinds (verse/chorus/chorusRepeat/bridge/instrumental), verse numbers, Intro/Intermezzo/Finale by position, plain-text headings, "Ritornello" reminders, section directives with labels (+ tests)
- [x] Song sheet: coloured label tag per section (Strofa, Ritornello, Bridge, Intro/Intermezzo/Finale), "Ritornello (ripeti)" reminder line
- [x] Checked the labels of all 166 songs; SPEC + DECISIONS updated
- [x] `ng build` + `ng test` green, commit

## M1.3 — Chord display fixes (song 142 feedback)

- [x] Chords without a syllable under them stay in the chord row; no empty gap on wrapped rows
- [x] Old-notation chord lines ("B- G D A — D", "C AmDm", "Mi- Do+") recognised, styled and transposed (`core/chord-text.ts` + tests); chords after "Intro:" / "Intermezzo:" headings too
- [x] "Rit:" lines: dropped inside choruses; outside they start a chorus / chorus reminder
- [x] Fix: text after a `#` was lost (chordsheetjs comment syntax)
- [x] Checked all detected chord lines across the 166 songs; `ng build` + `ng test` green, commit

## M2 — Visual editor

Pure logic (`src/app/core/`, with tests):
- [x] `editor-model.ts`: ChordPro ⇄ editable model (meta, sections with kind/label, lines = text + chords at character positions, comments, untouched raw lines); round-trip test on all 166 songs (same rendered result)
- [x] Editing operations: edit text (chords follow their syllables), add / move / change / delete chord, split / merge lines, add / delete / move / duplicate sections and lines, convert old-notation chord line (onto the lyric line below, or in place), transpose permanently, chip layout for overlapping chords
- [x] `chords-over-words.ts`: pasted "chords above lyrics" text → ChordPro (column-aligned)
- [x] ChordPro syntax highlighting tokens for the source view
- [x] Export file name (`123c - Title.cho`)

Services:
- [x] `LibraryService`: save (update/insert), delete (also prefs/annotations), number+suffix uniqueness check, fetch the bundled original of a song ("Ripristina originale")

UI (lazy-loaded route `canto/:id/modifica`, `nuovo`):
- [x] Editor page: song data form (number, title, key, tempo, capo), tabs Visuale / Sorgente, live preview with the real renderer (side by side on laptops, tab on narrow screens), Salva / Annulla, undo/redo (buttons + Ctrl/Cmd+Z), unsaved-changes guard
- [x] Visual editor: section cards (kind: Automatico/Strofa, Ritornello, Bridge, Intro, Intermezzo, Finale + free label; move up/down, duplicate, delete), add section/line/note
- [x] Line editor: monospace lyric input + chord row; click to add chord (popover with the song's chords as palette), drag to move (mouse + touch), click to change/delete; keyboard: Ctrl/Cmd+K add chord at cursor, arrows move a focused chord, Delete removes, Enter splits line, Backspace at start merges, ↑/↓ move between lines
- [x] "Converti accordi" button on old-notation chord lines
- [x] Source editor: monospace textarea with highlighted [chords] and {directives}
- [x] "Incolla testo con accordi sopra" dialog (replace or append)
- [x] New song from template (sidebar button "Nuovo canto"); title required; number+suffix must be unique
- [x] Delete song (confirmation dialog), "Ripristina originale" for bundled songs
- [x] Export `.cho` from editor and song view; "Modifica" button in song view
- [x] Confirmation dialog component (native `<dialog>`, no dependency)
- [x] Strings in `it.ts`, tokens only

Done:
- [x] SPEC/DECISIONS updated, `ng build` + `ng test` green, commit `M2: visual editor`

## M3 — Personal layer

Pure logic (with tests):
- [x] `core/anchoring.ts`: line anchors (section, line, hash of normalised text, snippet, occurrence); resolve: exact hash+occurrence → same hash nearest → fuzzy snippet (normalised Levenshtein ≥ 0.8) → orphaned; `reanchorAll` after a text change (never deletes)

Data / services:
- [x] Annotation model: `title` (tab), `chordIndex` (personal chord: which chord of the line), `orphaned`; SongPrefs `memo` (Promemoria); Settings `showNotes`
- [x] `AnnotationService`: per-song annotations, add / update / delete / relink, re-anchor a song after its text changes
- [x] `ToastService` + toast in the app shell
- [x] Editor save re-anchors the song's annotations and shows a toast if some became orphaned

UI:
- [x] Song sheet renders annotations: highlight (4 colours), notes beside the line (below on narrow columns), tab/solo blocks (monospace, title), personal chord in coral above the original chord (transposed with the song)
- [x] Click/tap (or Enter) on a line selects it → bottom panel: Nota, Evidenzia, Tab/Assolo, Accordo personale; edit/delete existing annotations of the line
- [x] Promemoria panel at the top of the song (collapsed by default, shows first line), autosaved
- [x] Toolbar toggle "Mostra le mie note"
- [x] Orphaned notes: banner "N note da ricollegare" → list with "Ricollega" (then click a line) and delete
- [x] Library note/tab icons and "Con le mie note" filter use real data (incl. Promemoria)
- [x] Strings in `it.ts`, tokens only; pages are re-measured when notes change

Done:
- [x] SPEC/DECISIONS updated, `ng build` + `ng test` green, commit `M3: personal layer`

## M4 — Performance mode

Pure logic (with tests):
- [x] `core/paging.ts`: page maths for column pages and vertical screens (count, offsets), auto-scroll speed from tempo
- [x] `core/keymap.ts`: actions (next, prev, autoscroll, slower, faster), default keys (Space/PageDown/→/↓, PageUp/←/↑, S, [, ]), resolve a key, reassign, Italian key labels

Shared:
- [x] `Pager` directive (`ui/pager.ts`) extracted from the song view: column pages (landscape/laptop) or screen-by-screen vertical pages; re-measures on content/resize; song view refactored to use it and the configurable keys
- [x] `ScreenService`: Fullscreen API (incl. webkit prefix) and Screen Wake Lock (re-acquired when the tab becomes visible again)
- [x] High-contrast performance tokens in `_tokens.scss` (text ≥ 7:1)

Performance view (lazy route `canto/:id/esibizione`, optional `?coda=id1,id2,…` for M5 setlists):
- [x] Full-screen overlay, wake lock while open, large font (song font × 1.25), title at the top of the sheet, notes shown (not editable)
- [x] Thin auto-hiding top bar: title, key/capo, song x/y in the queue, page x/y, auto-scroll controls, font −/+, 1/2 columns, pedal keys, full screen, exit
- [x] Navigation: configurable keys, tap zones (left = back, right = next, middle = show bar), always-visible small page indicator; next at the end of a song → next song in the queue
- [x] Auto-scroll: S start/stop, [ ] slower/faster, speed per song (seconds per screen); vertical = smooth scroll, columns = automatic page turn with a progress bar; "Da tempo" sets the speed from {tempo}
- [x] Pedal keys dialog: press a key to assign it to an action, remove, restore defaults (saved in Settings)
- [x] "Esibizione" button in the song view (enters full screen on the click)

Done:
- [x] SPEC/DECISIONS updated, `ng build` + `ng test` green, commit `M4: performance mode`

## M5 — Setlists

Pure logic (with tests):
- [x] `core/setlists.ts`: new setlist / item (with ids), duplicate, move item, effective transpose of an item, share format (`innario-setlist` JSON with number+suffix+title) export and import (match by number+suffix, then title; report missing songs)

Data / services:
- [x] `@angular/cdk` (allowed by SPEC §2) for drag & drop
- [x] `SetlistService` (signals + Dexie): create, update, delete, duplicate, add song, import
- [x] `SetlistItem.id` for stable drag & drop tracking

UI:
- [x] Sidebar tabs "Libreria | Scalette"
- [x] Setlists page: list (name, date, number of songs), new setlist (name + date), open, play, duplicate, share, delete (confirmation), import a shared `.json`
- [x] Setlist page: editable name and date; songs reordered by drag & drop (handle, touch, keyboard ↑/↓ buttons too); per-song transpose override with resulting key, short note, remove, open; add songs with a search box (number + Enter adds); play from the start or from any song
- [x] "Aggiungi a scaletta" menu in the song view (existing setlists + new one)
- [x] Performance mode plays a setlist (`?scaletta=…&pos=…`): per-item transpose, item note shown, next/prev through the setlist
- [x] Share: Web Share with the file when available (iPad), otherwise download
- [x] Strings in `it.ts`, tokens only

Done:
- [x] SPEC/DECISIONS updated, `ng build` + `ng test` green, commit `M5: setlists`

## M5.1 — Intro card (Benji's request)

- [x] `SongPrefs.intro` (part, chords, rhythm, note) + `core/intro.ts` (chords stored in the original key, shown transposed) with tests
- [x] Intro card at the top of the song sheet (song view + performance mode), sage like the Intro label
- [x] Intro panel in the song view: part (song sections or free text), chords (live preview), rhythm with ↓ ↑ · buttons, note; save / delete
- [x] SPEC/DECISIONS, build + tests, commit

## M6 — Extras

Pure logic (with tests):
- [x] `core/chord-diagrams.ts`: guitar fingerings for all roots × (major, m, 7, m7, maj7, sus2, sus4, add9, 6, m6, 9, dim, aug, 5) from open shapes + movable E/A barre shapes; slash chords = base shape + bass note
- [x] `core/metronome.ts`: tap tempo, BPM limits, beat scheduling maths
- [x] `core/backup.ts`: backup file (songs, prefs, annotations, setlists, settings); restore "replace" or "merge" (songs matched by id, then number+suffix / title, ids remapped in prefs, notes, setlists)
- [x] `core/export-notes.ts`: `.cho` export with personal notes embedded as `{comment}` / `{start_of_tab}` lines

UI:
- [x] Chord diagram (SVG) on hover / tap of a chord in the song view (setting on/off)
- [x] Metronome widget in the song view: BPM from {tempo} or manual, −/+, tap tempo, amber pulse, optional click (Web Audio, look-ahead scheduling, accent on beat 1)
- [x] Settings page `/impostazioni`: theme dark/light, global text size, chord style (above / inline), chord diagrams, accidentals (auto / ♯ / ♭), pedal keys, restore bundled songbook, backup / restore (merge or replace), storage usage + persistence, app version, about (logo, credits)
- [x] Export menu in the song view: `.cho`, `.cho` with my notes, Print / PDF
- [x] Print stylesheet: A4, black on white, chords above lyrics, no app chrome
- [x] Light theme completed (all tokens), theme applied everywhere
- [x] Sidebar link to Impostazioni; strings in `it.ts`, tokens only

Done:
- [x] SPEC/DECISIONS updated, `ng build` + `ng test` green, commit `M6: extras`

## M7 — iPad & iPhone polish

Pure logic (with tests):
- [x] `core/gestures.ts`: swipe detection (distance, direction, speed)
- [x] `core/platform.ts`: iOS/iPadOS Safari detection (iPadOS reports "Macintosh" + touch), installed (standalone) detection

UI:
- [x] Swipe directive: left = next page, right = previous in performance mode and in the paged song view (vertical scrolling untouched, no accidental tap after a swipe)
- [x] iPhone (≤ 600px): bottom bar Libreria / Scalette / Impostazioni, single column; iPad portrait: library as slide-over; landscape: side by side
- [x] Touch targets ≥ 44px on touch screens (also the small buttons), `touch-action: manipulation`, no long-press callout on the stage
- [x] Safe areas (notch / home indicator) on bars, panels, pages
- [x] Safari hint "Condividi → Aggiungi alla schermata Home" when running in Safari on iPhone/iPad and not installed (dismissible, remembered)
- [x] Storage persistence prompt when the data isn't protected yet (dismissible)
- [x] "Nuova versione disponibile — Aggiorna" toast from the service worker (toast with action button)

Done:
- [x] SPEC/DECISIONS updated, version 1.0.0, `ng build` + `ng test` green, commit `M7: iPad & iPhone polish`

## 1.1 — Chord voicings + UI coherence pass (Benji's feedback, with screenshots via Playwright)

Chord diagrams:
- [x] Several fingerings per chord (open, E/A/D/C movable shapes, deduplicated, easiest first) + tests
- [x] Diagram popover: "‹ 1/3 ›" to browse voicings; stays open while the pointer is on it

Shared UI patterns:
- [x] One `Popover` component (CDK Overlay: anchored, flips, Esc / outside click close) used by every menu and pop-up panel
- [x] Shared bottom-sheet and menu styles (annotation, intro panels; export, setlist, more menus)

Song page:
- [x] App bar: sidebar · number · title (key / capo under it) · **Esibizione** (primary) · Modifica · Aggiungi a scaletta · ⋯ (export, print)
- [x] Controls row of chips: Tonalità (transpose + capo + ♯/♭ in one popover), Aa (text size, 1/2 columns), Versione (when > 1), Intro, Metronomo, Note; horizontally scrollable on iPhone
- [x] Fix: clicking a line in the right column shifted the page (focus scroll) — rows inside the column, pager snaps back

Elsewhere:
- [x] Hint banner inline at the top of the library (never covers content)
- [x] Sidebar: filters in one scrollable row, cleaner count/sort row, "+" for new song next to the search
- [x] Editor: secondary tools in a ⋯ menu
- [x] Screenshots at laptop / iPad / iPhone sizes after the changes; fix what looks wrong
- [x] DECISIONS, build + tests, commit

## 1.2 — Premium polish (Benji's feedback)

- [x] Lucide icons (vendored, ISC) replacing the hand-drawn ones; icon geometry test
- [x] Button hierarchy (discreet / secondary / primary / danger, round icon buttons)
- [x] Settings as grouped rows with icons, plain explanations, switches; restore-backup dialog
- [x] Song page: chip icons, Note chip panel with Promemoria, memo line only when set
- [x] Empty state for setlists; textareas use the app font; phone fixes (library default, bottom-bar icons, settings layout)
- [x] Screenshots checked at laptop and iPhone sizes; build + tests; commit

## 1.3 — Public version (GitHub Pages)

- [x] No church branding: logos removed (app mark instead), neutral texts; songbook-agnostic welcome
- [x] Songs not in the public repo/build: `songs/` and the generated `songs-index.json` git-ignored; bundled import only when songs are present locally; song tests skip without them (CI)
- [x] Import songs from files: songbook file (`innario-songbook` JSON, songs only, no personal data), `.cho/.chopro/.chordpro/.txt` (many at once) and backup files; on the welcome screen and in Impostazioni; existing number+suffix → skip or replace (notes kept and re-anchored)
- [x] "Condividi i canti": export the library as a songbook file (to share on WhatsApp/e-mail)
- [x] `scripts/build-songbook-file.mjs`: songs/*.cho → songbook file (for Benji to share)
- [x] Fresh public git history (no songs/logos in it); private history kept locally
- [ ] `gh` installed, repo created, GitHub Pages enabled, first deploy checked

## 1.4 — Safer data

- [x] GitHub Actions updated (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5)
- [x] "Proteggi i dati": clear message when the browser refuses (install the app, make backups)
- [x] Backup reminder: "Ultimo backup: …" in Impostazioni; a hint when the last backup is older than 14 days (snooze 14 days)
- [x] Automatic backup file (Chrome/Edge on computers): choose a file once (e.g. in an iCloud/Google Drive folder), rewritten a few seconds after every change; "Riattiva" when the browser asks for permission again

## 1.5 — Rename to Chordsheet

- [x] Visible name everywhere (app, manifest, page title, messages, file names); neutral wording instead of "innario"
- [x] Internal ids kept (database, file formats, local keys) for compatibility
- [x] Repository renamed → 23benji.github.io/chordsheet/; build + tests; deploy checked

## 1.6 — Neutral icon and welcome

- [x] App icon: chord diagram on the amber tile (any, maskable, Apple touch)
- [x] Welcome line "Accordi e testi, sempre con te." + "Trasponi · Annota · Suona dal vivo"

## 1.8 — Folders ("Cartelle") + editor fix on iPhone

- [x] Data: `Folder {id, name, songIds}` in a new Dexie table (version 3); pure helpers + tests (`core/folders.ts`); `FolderService` (signals)
- [x] Backup: folders included; merge re-points song ids like setlists; old backups still open
- [x] Library: folder chips ("Tutti i canti" + folders with counts + new), ⋯ per folder (Rinomina, Condividi i canti, Elimina)
- [x] Library: "Seleziona" mode → Aggiungi a… / Sposta in… / Togli (versions of a song move together)
- [x] Song page: Cartelle button (tick folders); on iPhone inside ⋯ as a bottom sheet
- [x] New song: choose folders (default: the folder open in the library)
- [x] Import (Impostazioni): choose folders for the imported songs
- [x] Editor on iPhone: chord box no longer goes off-screen (the page slid sideways); lyric lines get the full width
- [x] Start-up bundle kept under budget (library menus use a native-dialog action sheet, not the CDK popover)
- [x] Screenshots iPhone (390, 375) and laptop (1280); build + tests; commit


## 1.21 — Sync between devices (Google Drive)

- [x] `core/sync.ts` (+ spec): three-way merge (base / local / cloud) so edits *and deletions* sync; never-synced songs adopt the cloud ids (no duplicates); 3-device scenario test
- [x] `services/google-drive.ts` (+ spec): Google sign-in (code flow + PKCE, refresh token kept on the device), one file `chordsheet-sync.json` in Drive's hidden app folder; plain fetch, no library; loaded on demand
- [x] `SyncService`: sync at start-up, when the app comes back to the front, when back online, 5 s after a change, "Sincronizza ora"; "Esci"
- [x] Impostazioni → Sincronizzazione (hidden while no client ID is set); screenshots 390 + 1280
- [x] Benji: Google Cloud project + OAuth client (ID in `sync-config.ts`, secret as Actions secret)
- [x] Test on the real devices (Benji: "tutto ok")
- [x] Impostazioni → "I tuoi dati": Google Drive / Importa (also backups → Unisci/Sostituisci) / Esporta (backup or songs); auto-backup only without sync; storage moved to Informazioni; backup/persist banners off while synced

## 1.27+ — Roadmap (Benji, 2026-11-05)

In this order, one at a time (build + tests + screenshots + push after each):

1. **Loose ends**
   - [x] Second key in parentheses at the end of a line, e.g. `(Am Em Am Em)`: transpose it together with the song (song view, performance, PDF)
   - [x] Production build: install (manifest + service worker) and offline check, automated with Playwright (the old manual M1 check)
2. **Solo testo** (lyrics only): one switch hides all chords — for singers, and to print a lyrics booklet from a setlist
   - [x] `lyricsOnlySheet()` (+ tests): no chords, chord lines, second key or instrumental parts; line indexes kept for notes
   - [x] Setting "Solo testo" (Impostazioni → Canti, per device) + switch in the song's Testo panel + "Solo testo ✕" badge under the title; performance mode follows it
   - [x] Setlist "Stampa / PDF" → booklet: cover with the list, then each song (con accordi with the setlist's keys, or solo testo)
   - [x] Screenshots 390 + 1280, booklet PDF rendered and checked; build + tests
3. **Capo consigliato**: for the current key, suggest the capo that gives easy open shapes (e.g. Bb → capo 3, shapes in G)
   - [x] `core/capo.ts` (+ tests): shape difficulty per chord, average over the song for capo 0–7 (+0.1 per fret), suggest only when the song is hard as it is (≥ 1) and the gain is clear (≥ 0.6) — 27 of the 166 bundled songs get a suggestion
   - [x] Tonalità panel: "Capo consigliato · Capo 3 · forme in G" + Usa (guitar only, follows transposition); screenshots 390 + 1280
   - [x] After "Usa" the tip rests 30 days on that song (going back to the original key doesn't bring it back)
4. **Share a setlist as a QR code / link**: the setlist travels inside the link (no server); opening it on another device imports it, matching songs by number
   - [x] `core/setlist-link.ts` (+ tests): compact JSON → deflate → base64url after `#` (never sent to the server); explicit 0 transposition kept; `linkFragment()` finds a link in pasted text
   - [x] "Condividi" (setlist and list page) → sheet with QR code (`qrcode-generator`, loaded on demand), Invia link, Copia link, Invia come file
   - [x] `/scaletta-condivisa#…`: preview (found / not in library) → Aggiungi alle mie scalette; welcome hint on an empty device; iPhone Safari hint (links don't open the home-screen app) + Importa scaletta → Incolla un link
   - [x] Two-device test with Playwright; the QR in the screenshot decoded by macOS (CIDetector) = the link
5. **Accordatore** (tuner), experimental: microphone + pitch detection, offline; try it and keep it only if it is accurate enough
   - [x] `core/pitch.ts` (+ tests): YIN pitch detection with parabolic interpolation, note/cents, nearest open string, median smoother — every open string within 1 cent on pure tones, overtone-heavy tones and Karplus-Strong plucks, with noise
   - [x] `/accordatore`: gauge (±50 cent, green ±5), note + octave, cents, Hz, string row; mic with echo cancelling / noise suppression / auto gain off; entries in the song ⋯ menu and the setlist page
   - [x] End-to-end through the app's audio chain with a synthetic plucked-string "microphone": A2 +10.4 → "+10 cent", E2 −1.1 → "Accordata", B3 −28.0 → "−28 cent"
   - [x] Benji tried it on the iPhone: "works strangely good enough", but: frozen after leaving the app, low E not detected
   - [x] Leaving the app pauses it ("In pausa" + Riprendi); also pauses if iOS ends the mic or suspends the audio
   - [x] Low E: loudness gate 0.01 → 0.002 (a quiet low E was dropped as silence), best-match fallback when no dip is under the threshold, octave fix for the two lowest strings, tap a string to tune only that one (±7 semitones, no octave errors)
   - [x] Bass (E1 A1 D2 G2, 8192-sample window) with a Chitarra / Basso switch, remembered
   - [x] Also reachable from Impostazioni → Esibizione → Accordatore (discreet, always there)

## 1.33 — Small upgrades + statistics (Benji, 2026-11-05)

Benji: "I don't think more features are wise to add" — small improvements to what is there, plus one thing for his Sundays. One at a time, carefully; **one version for the whole batch** (commit each item, push once at the end).

1. **Pinch to zoom** the song text (two fingers, like a photo), instead of going through the text-size control
   - [x] `ui/pinch.ts`: CSS scale while the fingers move (smooth, no re-layout), real text size on release (5 % steps, 60–200 %, saved per song like A−/A+); the browser's page zoom is blocked there
   - [x] Song view (scroll: stays at the same place in the song; pages) and performance mode; a pinch is never a swipe / page turn
   - [x] Tested with two simulated fingers (Chrome DevTools touch): 22 → 44 → 22 px, page zoom stays 1
2. **Search forgives small typos**: "alleluja" finds "Alleluia", a missing / extra / swapped letter still finds the song
   - [x] `core/search.ts` (+ tests): spelling variants always (j/y = i, k = c, silent h, double letters), ranked after exact matches; real typos (Damerau-Levenshtein: 1 letter off from 4 letters, 2 from 7; the last word also against word beginnings while typing) only when nothing else matched
   - [x] Real songbook (166 songs): "glria" → Gloria a Dio, "el shadai" → El Shaddai, "benedeto" → Benedetto il nome, "alleluja" → 7 songs; every query < 2.1 ms
3. **Recent songs**: tapping the empty search shows the last 5 songs opened
   - [x] `RecentService` (+ tests): last 5 songs opened on this device (localStorage, not synced — a convenience), recorded by the song view and performance mode
   - [x] Library: "Recenti" above the list while the empty search has the focus (not while typing or selecting; the song open right now is left out); screenshots 390 + 1280
4. **"Prossimo" with key and capo** in performance mode ("Prossimo: Tu sei Re · E, capo 2")
   - [x] Key you'll play in (the song's key + its setlist transposition − its capo) and the capo; just the title in Solo testo; test + screenshot
5. **"Annulla" instead of "Sei sicuro?"**: delete at once, with an undo button in the message for a few seconds
   - [x] Deleting returns what was removed: songs (with prefs, notes and the folders they were in), a setlist, a folder; `restoreSongs` / `restore` put it back (memory + IndexedDB; sync merges snapshots, so a restored item simply comes back)
   - [x] Library selection, folder, setlist (list and page) and editor "Elimina": no dialog; toast "… eliminato" + Annulla for 8 s (`UNDO_MS`). Other confirmations (leave without saving, restore a backup, sign out) stay
   - [x] Tests (delete/restore with an in-memory DB, toast timing) + real app: setlist and 2 songs deleted and brought back, still there after reload
6. **"Automatico" theme**: follows the iPhone's light/dark mode
   - [x] Tile "Auto" (half Chiaro, half Scuro) first among the themes: Chiaro by day, Scuro when the system is in dark mode, switching live (`SettingsService.theme`, `resolveTheme` + tests); phone: tiles in two rows of three
   - [x] Screenshots 390 + 1280 with the system in light and dark mode
7. **Statistiche** from the setlists (Benji makes a new scaletta every Sunday): which songs are sung most, which parts of the songbook (1–50, 51–100, 100+…), which numbers — with charts. Not a new button: an option inside Scalette ("Statistiche" in its ⋯ menu). "Maybe not everyone will use it", so it stays out of the way.
   - [ ] 

Ideas noted for later: service plan items in setlists (Preghiera, Lettura…), lyrics on the church projector, song history ("suonato 3 settimane fa"), key-jump warnings in setlists, tuner: keep the screen awake + steadier "Accordata", reopen the app on the last song, reference recording per song, song version history.
