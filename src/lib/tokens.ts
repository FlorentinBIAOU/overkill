/**
 * Lecture des tokens depuis src/styles/tokens.css, la source unique.
 *
 * Sert a la page de controle et aux scripts de verification : personne ne
 * recopie une valeur de couleur a la main, elle est lue la ou elle est definie.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Chemin resolu depuis la racine du projet : stable au build comme en dev,
// contrairement a import.meta.url qui suit le fichier apres empaquetage.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

export function readTokenBlock(selectorFragment: string): Record<string, string> {
  const start = CSS.indexOf(selectorFragment);
  if (start === -1) throw new Error(`bloc de tokens introuvable : ${selectorFragment}`);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const line of CSS.slice(open + 1, close).split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

export const lightTokens = readTokenBlock(':root {');
export const darkTokens = readTokenBlock(":root[data-theme='dark'] {");
