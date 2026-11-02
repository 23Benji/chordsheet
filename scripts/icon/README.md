App icons: a chord diagram (nut, strings, frets, finger dots) on the amber tile.
Regenerate the PNGs in `public/icons/` on macOS with:

```sh
sips -s format png scripts/icon/icon.svg --out public/icons/icon-512.png
sips -z 192 192 public/icons/icon-512.png --out public/icons/icon-192.png
sips -s format png scripts/icon/icon-maskable.svg --out public/icons/icon-maskable-512.png
sips -s format png scripts/icon/icon-apple.svg --out /tmp/apple-512.png
sips -z 180 180 /tmp/apple-512.png --out public/icons/apple-touch-icon.png
```
