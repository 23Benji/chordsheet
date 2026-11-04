// Builds the three icon SVGs from the one artwork (icon-art.svg):
//   icon-apple.svg    full bleed — iOS rounds the corners itself
//   icon.svg          rounded corners, transparent outside ("any": tab, welcome, settings)
//   icon-maskable.svg full-bleed background, artwork scaled into Android's safe zone
// Run: node scripts/icon/make-variants.mjs   (then render the PNGs, see README.md)
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const art = readFileSync(new URL('icon-art.svg', dir), 'utf8');
const defs = art.slice(art.indexOf('<defs>'), art.indexOf('</defs>') + '</defs>'.length);
const body = art.slice(art.indexOf('</defs>') + '</defs>'.length, art.lastIndexOf('</svg>')).trim();
// The first element of the body is the full-bleed background.
const bgEnd = body.indexOf('/>') + 2;
const background = body.slice(0, bgEnd);
const rest = body.slice(bgEnd).trim();

const svg = (comment, inner, extraDefs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <!-- ${comment} (generated from icon-art.svg by make-variants.mjs) -->
  ${defs.replace('</defs>', `${extraDefs}\n  </defs>`)}
  ${inner}
</svg>
`;

writeFileSync(new URL('icon-apple.svg', dir), svg('Apple touch icon: full bleed, iOS rounds the corners', `${background}\n  ${rest}`));

writeFileSync(
  new URL('icon.svg', dir),
  svg(
    'App icon with rounded corners',
    `<g clip-path="url(#round)">\n  ${background}\n  ${rest}\n  </g>`,
    '\n    <clipPath id="round"><rect width="512" height="512" rx="114"/></clipPath>',
  ),
);

writeFileSync(
  new URL('icon-maskable.svg', dir),
  svg('Maskable icon: the tile stays inside the 80% safe circle', `${background}\n  <g transform="translate(256 256) scale(0.88) translate(-256 -256)">\n  ${rest}\n  </g>`),
);
console.log('icon.svg, icon-apple.svg, icon-maskable.svg written');
