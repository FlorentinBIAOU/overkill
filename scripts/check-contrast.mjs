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
import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { codeToHtml } from 'shiki';
import { CODE_THEME, CODE_SURFACE, substitute } from '../src/lib/code-theme.mjs';

/** Les extraits affichés par les fiches : ni les tests, ni les fixtures. */
async function* walkSnippets(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('_') || e.name.startsWith('.') || e.name === '__pycache__') continue;
      yield* walkSnippets(p);
    } else if (['.py', '.js'].includes(extname(p)) && !p.includes('.test.')) {
      yield p;
    }
  }
}

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
 * Couples vérifiés. `large` marque ceux dont le seuil AA est 3:1 plutôt que
 * 4,5:1 : le texte de plus de 24 px en gras, et les éléments non textuels
 * porteurs d'information — un anneau de focus, une bordure de contrôle.
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

  /* Les couleurs de réponse. Le verdict en grand titre relève du seuil des
     gros textes ; le titre d'un point de rupture, en 0,95 rem gras, relève du
     seuil courant. */
  ['--ans-0', '--paper-2', true, 'réponse N0 sur la carte de verdict'],
  ['--ans-1', '--paper-2', true, 'réponse N1 sur la carte de verdict'],
  ['--ans-2', '--paper-2', true, 'réponse N2 sur la carte de verdict'],
  ['--ans-3', '--paper-2', true, 'réponse N3 sur la carte de verdict'],
  ['--ans-0', '--paper', true, 'réponse N0 du questionnaire'],
  ['--ans-2', '--paper', true, 'réponse N2 du questionnaire'],
  ['--ans-1', '--paper', false, 'titre « quand passer au niveau suivant »'],
  ['--ans-3', '--paper', false, 'titre « point de rupture »'],

  /* Le vert de recommandation, en texte puis en aplat. */
  ['--go', '--paper', false, 'badge « recommandé »'],
  ['--go', '--paper-2', false, 'badge « recommandé » sur fond secondaire'],
  ['--paper', '--recommended', false, 'étiquette sur l\'aplat de recommandation'],

  /* L'aplat de marque : le texte courant, puis le bouton sombre qui s'y pose. */
  ['--on-brand', '--brand', false, 'texte courant sur aplat de marque'],
  ['--on-brand-text', '--on-brand', false, 'bouton sombre sur aplat de marque'],

  /* L'anneau de focus : information non textuelle, seuil 3:1 (WCAG 1.4.11).
     Les filets --rule et --rule-strong sont des color-mix, que ce contrôle ne
     sait pas calculer ; ils sont mesurés dans le navigateur par check-a11y. */
  ['--focus', '--paper', true, 'anneau de focus'],
  ['--focus', '--paper-2', true, 'anneau de focus sur fond secondaire'],

  /* Le fond des blocs de code est fixe : les trois couples ci-dessous sont
     donc mesurés à l'identique dans les deux modes. */
  ['--code-on-surface', '--code-surface', false, 'code sur fond de bloc'],
  ['--code-on-surface-muted', '--code-surface', false, 'code secondaire sur fond de bloc'],
  ['--code-on-surface-muted', '--code-surface-2', false, 'barre du bloc de code'],
  ['--code-on-surface', '--code-surface-2', false, 'bouton copier'],
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

/* ---------------------------------------------------------------------------
   La coloration syntaxique, couleur par couleur, contre le fond des blocs.
   Le thème par défaut de Shiki échoue sur les commentaires : ce contrôle est
   la raison pour laquelle on le sait, et il doit rester au vert quand le thème
   change. Les substitutions de src/lib/code-theme.mjs sont appliquées avant
   la mesure, puisque c'est ce que le lecteur reçoit.
   ------------------------------------------------------------------------ */

console.log(`\n  Coloration syntaxique — thème ${CODE_THEME} sur ${CODE_SURFACE}`);

if (resolve(light, light['--code-surface']).toUpperCase() !== CODE_SURFACE.toUpperCase()) {
  console.error(
    `\ncheck-contrast: --code-surface vaut ${light['--code-surface']} dans tokens.css ` +
      `et ${CODE_SURFACE} dans src/lib/code-theme.mjs. Les deux doivent être identiques.`,
  );
  process.exit(1);
}

/* On ne mesure pas les couleurs que le thème déclare, mais celles qu'il pose
   réellement sur nos extraits : un thème déclare des dizaines de portées dont
   aucune n'apparaît en Python ni en JavaScript, et les mesurer produirait des
   échecs sans lecteur. Les 148 extraits du dépôt passent donc par Shiki, et
   chaque couleur émise est mesurée. */
const extraits = [];
for await (const f of walkSnippets('content/snippets')) extraits.push(f);

const couleurs = new Map(); // couleur émise -> premier extrait où elle apparaît
for (const f of extraits) {
  const langue = f.endsWith('.py') ? 'python' : 'javascript';
  const html = substitute(
    await codeToHtml(await readFile(f, 'utf8'), { lang: langue, theme: CODE_THEME }),
  );
  for (const m of html.matchAll(/(?<!background-)color:(#[0-9A-Fa-f]{6})/g)) {
    if (!couleurs.has(m[1].toUpperCase())) couleurs.set(m[1].toUpperCase(), f);
  }
}

let pire = Infinity;
let nbCouleurs = 0;
for (const [couleur, fichier] of [...couleurs].sort()) {
  const r = ratio(couleur, CODE_SURFACE);
  nbCouleurs++;
  pire = Math.min(pire, r);
  const ok = r >= 4.5;
  if (!ok) failures++;
  console.log(
    `    ${ok ? 'ok  ' : 'ECHEC'} ${r.toFixed(2).padStart(6)}:1 (min 4.5) ${couleur}` +
      (ok ? '' : `, par exemple dans ${fichier}`),
  );
}

console.log(
  `    ok   ${nbCouleurs} couleur(s) émise(s) sur ${extraits.length} extraits, ` +
    `la plus faible à ${pire.toFixed(2)}:1`,
);

if (failures) {
  console.error(`\ncheck-contrast: ${failures} couple(s) sous le seuil AA.`);
  process.exit(1);
}
console.log('\n  Tous les couples testés atteignent le seuil AA.');
