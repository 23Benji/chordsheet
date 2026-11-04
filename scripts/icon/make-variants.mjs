// Builds the three icon SVGs from the one artwork (icon-art.svg):
//   icon-apple.svg    full bleed — iOS rounds the corners itself
//   icon.svg          rounded corners, transparent outside ("any": tab, welcome, settings)
//   icon-maskable.svg full bleed, only the symbol (id="symbol") scaled into Android's safe zone
// Run: node scripts/icon/make-variants.mjs   (then render the PNGs, see README.md)
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const art = readFileSync(new URL('icon-art.svg', dir), 'utf8');
const open = art.indexOf('<svg');
const header = art.slice(open, art.indexOf('>', open) + 1);
const defs = art.slice(art.indexOf('<defs>'), art.indexOf('</defs>') + '</defs>'.length);
const body = art.slice(art.indexOf('</defs>') + '</defs>'.length, art.lastIndexOf('</svg>')).trim();

const svg = (comment, inner, extraDefs = '') =>
  `${header}
  <!-- ${comment} (generated from icon-art.svg by make-variants.mjs) -->
  ${defs.replace('</defs>', `${extraDefs}\n  </defs>`)}
  ${inner}
</svg>
`;

writeFileSync(new URL('icon-apple.svg', dir), svg('Apple touch icon: full bleed, iOS rounds the corners', body));
writeFileSync(
  new URL('icon.svg', dir),
  svg('App icon with rounded corners', `<g clip-path="url(#round)">\n  ${body}\n  </g>`, '\n    <clipPath id="round"><rect width="512" height="512" rx="114"/></clipPath>'),
);
writeFileSync(
  new URL('icon-maskable.svg', dir),
  svg(
    'Maskable icon: the symbol stays inside the 80% safe circle',
    body.replace('<g id="symbol">', '<g id="symbol" transform="translate(256 256) scale(0.86) translate(-256 -256)">'),
  ),
);
console.log('icon.svg, icon-apple.svg, icon-maskable.svg written');
