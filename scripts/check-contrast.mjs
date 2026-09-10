#!/usr/bin/env node
/**
 * Vérification des rapports de contraste des couples texte-fond du système
 * de design (CDC 8.3 : minimum 4,5:1, et 3:1 pour les textes de plus de 24 px
 * en gras).
 *
 * Les valeurs sont lues dans src/styles/tokens.css, pas recopiées, pour que le
 * contrôle suive la source unique.
 */
import { readFile } from 'node:fs/promises';

const css = await readFile('src/styles/tokens.css', 'utf8');

/** Extrait les déclarations d'un bloc de tokens donne. */
function tokensOf(selectorFragment) {
  const start = css.indexOf(selectorFragment);
  if (start === -1) throw new Error(`bloc introuvable : ${selectorFragment}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out = {};
  for (const line of css.slice(open + 1, close).split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const light = tokensOf(':root {');
const dark = tokensOf(":root[data-theme='dark'] {");

function resolve(scope, value, depth = 0) {
  if (depth > 8) throw new Error(`reference circulaire : ${value}`);
  const m = value.match(/^var\((--[\w-]+)\)$/);
  if (m) return resolve(scope, scope[m[1]] ?? light[m[1]], depth + 1);
  return value;
}

function rgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Couples texte-fond vérifiés. `large` marque les couples réservés au texte de
 * plus de 24 px en gras, pour lesquels le seuil AA est 3:1.
 *
 * Deux couleurs du système ne sont jamais des couleurs de texte et n'ont donc
 * pas de couple ici :
 *   --brand      n'apparaît qu'en aplat, sous du très gros texte encre (CDC 8.3)
 *   --brand-deep ne sert qu'aux bordures et aux états actifs sur fond jaune
 * Leur bon usage est vérifié par scripts/check-colour-usage.mjs, qui échoue si
 * l'une des deux apparaît comme valeur de `color`.
 */
const PAIRS = [
  ['--ink', '--paper', false, 'texte courant'],
  ['--ink', '--paper-2', false, 'texte sur fond secondaire'],
  ['--muted', '--paper', false, 'texte secondaire'],
  ['--muted', '--paper-2', false, 'texte secondaire sur fond secondaire'],
  ['--on-surface', '--surface', false, 'texte sur aplat sombre'],
  ['--on-rung-0', '--rung-0', false, 'texte sur N0'],
  ['--on-rung-1', '--rung-1', false, 'texte sur N1'],
  ['--on-rung-2', '--rung-2', false, 'texte sur N2'],
  ['--on-rung-3', '--rung-3', false, 'texte sur N3'],
  ['--ink', '--brand', true, 'display sur aplat de marque'],
];

let failures = 0;

for (const [name, scope] of [['clair', light], ['sombre', dark]]) {
  console.log(`\n  Mode ${name}`);
  for (const [fg, bg, large, label] of PAIRS) {
    // Le jaune de marque est identique dans les deux modes et porte toujours
    // l'encre sombre du mode clair.
    const fgv = fg === '--ink' && bg === '--brand' ? '#16130E' : resolve(scope, scope[fg] ?? light[fg]);
    const bgv = resolve(scope, scope[bg] ?? light[bg]);
    if (fgv.startsWith('color-mix')) continue; // non calculable statiquement
    const r = ratio(fgv, bgv);
    const min = large ? 3 : 4.5;
    const ok = r >= min;
    if (!ok) failures++;
    console.log(
      `    ${ok ? 'ok  ' : 'ECHEC'} ${r.toFixed(2).padStart(6)}:1 ` +
        `(min ${min}) ${label} — ${fgv} sur ${bgv}`,
    );
  }
}

if (failures) {
  console.error(`\ncheck-contrast: ${failures} couple(s) sous le seuil AA.`);
  process.exit(1);
}
console.log('\n  Tous les couples testes atteignent le seuil AA.');
