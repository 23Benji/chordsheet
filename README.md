# Innario

Offline-first songbook app (PWA) for worship musicians: chords above lyrics, transposition, capo, personal notes, setlists and a
performance mode, setlists, an editor that needs no ChordPro knowledge, backup
between devices. Works offline and installs on laptop, iPad and iPhone.
See `SPEC.md` (the specification), `PLAN.md` (progress) and
`DECISIONS.md`.

```sh
npm install
npx ng serve      # http://localhost:4200
npx ng test       # unit tests
npx ng build      # production build in dist/innario/browser
```

## Songs

The app ships **without songs**. Import them on the welcome screen or in
Impostazioni → Importa canti: a songbook file shared by your church/group
(`innario-songbook` JSON), ChordPro files (`.cho`, `.chopro`, `.txt`), or a
backup. To turn a folder of ChordPro files into one songbook file to share:

```sh
node scripts/build-songbook-file.mjs path/to/songs innario-canti.json
```

If a `songs/` folder with `.cho` files is present when building (it is
git-ignored), run `npm run songs:index` and the app also offers
"Importa l'innario incluso".

## Licences

Icons: [Lucide](https://lucide.dev) (ISC). Fonts: Carlito, Caladea (OFL).
