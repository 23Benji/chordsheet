App icon "Accordo": two lines of lyrics with a small amber mark above each
(a chord over a syllable) on a warm dark glass surface that fills the whole
icon — minimal, no instrument.

- `icon-art.svg` — the artwork, 512 × 512, full bleed. **Edit this one.**
- `make-variants.mjs` builds the three framings from it:
  `icon.svg` (rounded corners), `icon-apple.svg` (full bleed — iOS rounds it),
  `icon-maskable.svg` (only the symbol, `id="symbol"`, scaled into
  Android's 80 % safe circle; the glass stays full bleed).

Regenerate on macOS (Chrome renders the blur/glow; `sips` alone can't):

```sh
node scripts/icon/make-variants.mjs
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
render() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 --window-size=512,512 --screenshot="$2" "file://$PWD/$1"; }
render scripts/icon/icon.svg public/icons/icon-512.png
render scripts/icon/icon-maskable.svg public/icons/icon-maskable-512.png
render scripts/icon/icon-apple.svg /tmp/apple-512.png
sips -z 192 192 public/icons/icon-512.png --out public/icons/icon-192.png
sips -z 180 180 /tmp/apple-512.png --out public/icons/apple-touch-icon.png
```

Note: SVG gradients on straight lines need `gradientUnits="userSpaceOnUse"`
(a bounding-box gradient on a line with no width paints nothing).
