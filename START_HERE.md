# Start here (for Benji)

This folder is a starter kit for building the Chordsheet app (originally "Innario") with **Claude Code**.

## What's inside
- `SPEC.md` — the full specification (features, design, data model, milestones). Claude Code reads it.
- `CLAUDE.md` — rules for how Claude Code should work in this project (it reads this automatically).
- `songs/` — (local only, git-ignored) your songs in ChordPro format; the public app ships none.
- `assets/` — the warm backgrounds.

## One-time setup on your laptop
1. Install **Node.js LTS** (nodejs.org) and **Git**.
2. Install the Angular CLI: `npm install -g @angular/cli`
3. Install **Claude Code** (see docs.claude.com → Claude Code) and log in.
4. Create a free **GitHub** account if you don't have one (for hosting later).

## Start the project
1. Unzip this folder somewhere, e.g. `Documents/innario-app`.
2. Open a terminal in that folder and run: `git init` then `claude`
3. Paste this as your first message:

> Read CLAUDE.md and SPEC.md carefully. Then create the Angular project in this folder (keep songs/, assets/ and the .md files), and build Milestone 1 exactly as specified. Start by writing PLAN.md with your checklist for M1, then implement it, run the build and tests, and commit. When M1 is done, tell me what to test manually in the browser.

4. When it finishes, run `ng serve`, open http://localhost:4200 and try it.
5. Then continue with: *"M1 looks good. Build Milestone 2."* — and so on until M7 (see SPEC §9 for the order).

## Tips
- Go one milestone at a time and test in between; it's much easier to fix things early.
- If you don't like something, say it concretely ("the chords are too small", "move the transpose buttons to the right") — Claude Code will change it.
- If something in SPEC.md should change, ask Claude Code to update SPEC.md too, so it stays the source of truth.
- Publishing: ask Claude Code *"Set up GitHub Pages deployment and explain the steps"* once you have a GitHub repo.
- On the iPad: open the published link in Safari → Condividi → "Aggiungi alla schermata Home".
