#!/usr/bin/env node
/**
 * Règles d'emploi de la couleur (CDC 8.3), vérifiées sur les sources.
 *
 *  1. Aucune couleur en dur : toute valeur de couleur passe par un token.
 *  2. --brand et --brand-deep ne sont jamais des couleurs de texte. Le jaune
 *     ne porte que du très gros texte encre, pose en aplat.
 *  3. --go n'apparaît que dans le composant du badge « recommande ». Ailleurs,
 *     le marquage de l'option recommandée passe par le rôle --recommended, qui
 *     nomme l'usage ; comme --go, il ne peut pas cohabiter avec un nom de
 *     classe évoquant bon ou mauvais.
 *  4. La rampe --rung-* ne sert jamais a exprimer un jugement : aucun token de
 *     rampe ne peut cohabiter avec un nom de classe évoquant bon ou mauvais.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const ROOTS = ['src'];
const EXT = new Set(['.astro', '.css', '.ts', '.js', '.mjs']);

/** Fichiers ou une valeur hexadécimale est légitime. */
const HEX_ALLOWED = new Set([
  'tokens.css', // la source unique des tokens
  // Ce module nomme le thème de coloration syntaxique, le fond sur lequel il
  // est mesuré et les substitutions éventuelles. Ces couleurs n'appartiennent
  // pas au système de design : elles viennent d'un thème extérieur, et le
  // contrôle de contraste les relit ici pour les mesurer.
  'code-theme.mjs',
]);

/** Le badge « recommande » est le seul endroit ou --go est autorise. */
const GO_ALLOWED = new Set(['VerdictBadge.astro', 'tokens.css', 'check-colour-usage.mjs']);

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (EXT.has(extname(p))) yield p;
  }
}

const problems = [];

for (const root of ROOTS) {
  for await (const file of walk(root)) {
    const name = basename(file);
    const src = await readFile(file, 'utf8');

    src.split('\n').forEach((line, i) => {
      const at = `${file}:${i + 1}`;
      const code = line.replace(/\/\*.*?\*\//g, '').replace(/^\s*(\/\/|\*|<!--).*/, '');

      // 1. couleurs en dur
      if (!HEX_ALLOWED.has(name) && /#[0-9a-fA-F]{3,8}\b/.test(code)) {
        problems.push(`${at}  couleur en dur, employer un token : ${line.trim()}`);
      }
      if (!HEX_ALLOWED.has(name) && /\b(rgb|hsl)a?\(/.test(code)) {
        problems.push(`${at}  couleur en dur, employer un token : ${line.trim()}`);
      }

      // 2. le jaune n'est jamais une couleur de texte
      if (/(^|[^-\w])color\s*:\s*var\(--brand(-deep)?\)/.test(code)) {
        problems.push(`${at}  --brand n'est jamais une couleur de texte (CDC 8.3)`);
      }

      // 3. le vert est réservé au badge « recommandé »
      if (/var\(--go\)/.test(code) && !GO_ALLOWED.has(name)) {
        problems.push(`${at}  --go est réservé au badge « recommandé » (CDC 8.3)`);
      }

      // 3 bis. le marqueur de recommandation ne devient pas un marqueur de qualité
      if (/var\(--recommended\)/.test(code) && /(good|bad|warn|danger|success|error|bon|mauvais)/i.test(code)) {
        problems.push(`${at}  --recommended dit « recommandé », jamais « bon » (CDC 8.3, interdit 4)`);
      }

      // 4. la rampe ne code pas un jugement
      if (/var\(--rung-[0-3]\)/.test(code) && /(good|bad|warn|danger|success|error|bon|mauvais)/i.test(code)) {
        problems.push(`${at}  la rampe mesure le poids, jamais la qualite (CDC 8.3, interdit 4)`);
      }
    });
  }
}

if (problems.length) {
  console.error('check-colour-usage: regles d\'emploi de la couleur non respectees\n');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`check-colour-usage: OK`);
