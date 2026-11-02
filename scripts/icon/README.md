App icons (number-pill motif + the cross from the church logo).
Regenerate the PNGs in `public/icons/` on macOS with:

```sh
sips -s format png scripts/icon/icon.svg --out public/icons/icon-512.png
sips -z 192 192 public/icons/icon-512.png --out public/icons/icon-192.png
sips -s format png scripts/icon/icon-maskable.svg --out public/icons/icon-maskable-512.png
sips -z 180 180 public/icons/icon-maskable-512.png --out public/icons/apple-touch-icon.png
```
