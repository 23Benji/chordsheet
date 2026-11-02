# CLAUDE.md — working agreement for this repo

## What this is
"Chordsheet" (originally "Innario"; internal ids such as the database name and file-format ids keep that name): an offline-first Angular PWA songbook (chords over lyrics, transpose, personal notes/solos, setlists, performance mode). **Read `SPEC.md` first — it is the source of truth.**

## Owner
Benji — first-year Computer Science student, knows Angular basics and Java. Explain non-obvious Angular/RxJS/signals choices briefly in commit messages or code comments so he can learn from the code. UI language: Italian.

## How to work
- Build **one milestone at a time** (SPEC §9). Before starting a milestone, write a short plan as a checklist in `PLAN.md`; tick items as you go.
- After each milestone: run `ng build` and the tests, fix everything, then commit with a clear message (`M1: library, song view, transpose`). Stop and summarise what to test manually.
- Record any decision that deviates from or fills a gap in SPEC.md in `DECISIONS.md` (date, decision, why).
- Ask before adding a dependency that is not listed in SPEC §2.
- No backend, no analytics, no external runtime requests.
- Keep components small and standalone; state in signal-based services (`LibraryService`, `SongPrefsService`, `AnnotationService`, `SetlistService`, `SettingsService`); pure logic (parsing, transposition, anchoring, import) in plain TypeScript files with unit tests.
- Strings shown to the user live in `src/app/i18n/it.ts`.
- Design tokens only via CSS custom properties defined in `src/styles/_tokens.scss` (SPEC §6). Never hard-code colours in components.

## Data
- Songs: the public app ships **no songs** (they're imported from a songbook file, ChordPro files or a backup). A local, git-ignored `songs/` folder enables "Importa l'innario incluso" in local builds (`npm run songs:index`).
- Logos/backgrounds: `assets/`.
- Never modify files in `songs/` from code; user edits live in IndexedDB.

## Commands
- dev: `ng serve` (service worker is disabled in dev; test offline with a production build)
- test: `ng test` (Vitest; `ng test --watch=false` for a single run)
- build: `ng build` → `dist/innario/browser`
- songs index: `npm run songs:index` after adding/removing files in `songs/`
- deploy: GitHub Actions on push to `main` → GitHub Pages (`.github/workflows/deploy.yml`)

## Layout
- `src/app/core/` pure logic + specs (chordpro, transpose, search, song-meta, song-import, models)
- `src/app/data/db.ts` Dexie schema; `src/app/services/` signal-based state
- `src/app/features/` screens (welcome, library, home, song); `src/app/ui/` shared bits
