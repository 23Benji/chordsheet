// Minimal typings for the Node APIs used by specs that read the bundled
// songs from disk (tests run in Node via Vitest). Avoids adding @types/node.
declare module 'node:fs' {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function existsSync(path: string): boolean;
}
