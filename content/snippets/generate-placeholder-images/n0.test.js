import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { placeholderSvg, stableHash } from './n0.js';
import { hashWord } from '../_harness/fake-llm.mjs';
import essai from '../../tryouts/live/generate-placeholder-images.js';

// The exact markup expected for one identifier. The same literal appears in
// n0.test.py: that is what pins the two implementations to each other, and it
// would break the moment either language rounded a colour differently.
const GOLDEN_MUG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"' +
  ' viewBox="0 0 60 60" role="img" aria-label="mug-106">' +
  '<rect width="60" height="60" fill="#dae8f0"/>' +
  '<rect x="24" y="12" width="12" height="12" fill="#317fa6"/>' +
  '<rect x="0" y="36" width="12" height="12" fill="#317fa6"/>' +
  '<rect x="48" y="36" width="12" height="12" fill="#317fa6"/>' +
  '<rect x="24" y="48" width="12" height="12" fill="#317fa6"/>' +
  '</svg>';

// Node ships no XML parser, so well-formedness is checked by shape: an opening
// svg element, then nothing but self-closed rects with quoted attributes.
const WELL_FORMED = /^<svg (?:[\w-]+(?::[\w-]+)?="[^"<>]*" ?)+>(?:<rect (?:[\w-]+="[^"<>]*" ?)+\/>)*<\/svg>$/;

// Caractères interdits par XML 1.0, hors tabulation et fins de ligne.
const CONTROLE_INTERDIT_EN_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

const teinte = (identifiant) => (stableHash(identifiant) >>> 16) % 360;
/** La famille de teinte telle que l'essai la nomme, lue dans son verdict. */
const famille = (identifiant) => essai.run(identifiant, 'fr').verdict.label.split(' — ')[1];
const couleurs = (svg) => svg.split('fill="').slice(1).map((part) => part.split('"')[0]);
const ariaLabel = (svg) =>
  /aria-label="([^"]*)"/.exec(svg)[1]
    .replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

/** Les cases allumées, en « colonne,ligne », lues dans le balisage. */
function cellules(svg) {
  const cote = Number(/width="(\d+)"/.exec(svg)[1]);
  const pas = Math.floor(cote / 5);
  const marge = Math.floor((cote - pas * 5) / 2);
  return new Set(
    [...svg.matchAll(/<rect x="(\d+)" y="(\d+)"/g)].map(
      ([, x, y]) => `${(Number(x) - marge) / pas},${(Number(y) - marge) / pas}`,
    ),
  );
}

/** HSL flottant de référence, en canaux 0–255. */
function hslFlottant(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const canaux = (hexa) => [1, 3, 5].map((i) => parseInt(hexa.slice(i, i + 2), 16));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : red velvet sofa ne tombe pas dans les rouges', () => {
  assert.equal(teinte('red velvet sofa'), 323);
  assert.equal(famille('red velvet sofa'), 'magenta');
  assert.ok(teinte('red velvet sofa') >= 30 && teinte('red velvet sofa') <= 330);
  // Témoin : la roue atteint bien les rouges — pour « blue velvet sofa », ce
  // qui achève la démonstration.
  assert.equal(teinte('blue velvet sofa'), 1);
  assert.equal(famille('blue velvet sofa'), 'rouge');
});

test('point de rupture : sofa-1 et sofa-2 reçoivent des teintes éloignées', () => {
  assert.deepEqual([teinte('sofa-1'), teinte('sofa-2')], [178, 226]);
  assert.ok(Math.abs(teinte('sofa-1') - teinte('sofa-2')) > 30);
  assert.notEqual(placeholderSvg('sofa-1'), placeholderSvg('sofa-2'));
  // Témoin : le même identifiant, lui, redonne la même image.
  assert.equal(placeholderSvg('sofa-1'), placeholderSvg('sofa-1'));
});

test('point de rupture : la sortie n’est que des rectangles pleins en deux couleurs', () => {
  const ids = ['red velvet sofa', 'sofa-1', 'sofa-2', 'Boulangerie Martin'];
  for (let i = 0; i < 200; i += 1) ids.push(`sku-${i}`);
  for (const id of ids) {
    const svg = placeholderSvg(id);
    assert.match(svg, WELL_FORMED);
    assert.equal(new Set(couleurs(svg)).size, 2);
    assert.equal(svg.split('<').length - 1, svg.split('<rect').length - 1 + 2);
  }
  // Témoin : les deux couleurs sont bien distinctes, le fond et l'encre.
  const [fond, encre] = couleurs(placeholderSvg('red velvet sofa'));
  assert.notEqual(fond, encre);
});

test('point de rupture : le hachage décide de tout, deux identifiants en collision donnent le même dessin', () => {
  assert.equal(stableHash('costarring'), stableHash('liquid'));
  assert.equal(
    placeholderSvg('costarring').replace('aria-label="costarring"', ''),
    placeholderSvg('liquid').replace('aria-label="liquid"', ''),
  );
  // Témoin : sans collision, la figure change.
  assert.notEqual(placeholderSvg('costarring'), placeholderSvg('costarrings'));
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('le balisage attendu est exactement celui du test Python', () => {
  assert.equal(placeholderSvg('mug-106', 60), GOLDEN_MUG);
  const source = readFileSync(new URL('./n0.test.py', import.meta.url), 'utf8');
  const bloc = /GOLDEN_MUG = \(([\s\S]*?)\n\)/.exec(source)[1];
  const litteraux = [...bloc.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
  assert.equal(litteraux.join(''), GOLDEN_MUG);
});

test('Python et JavaScript s’accordent au caractère près', () => {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const ids = [];
  for (let i = 0; i < 2000; i += 1) ids.push(`sku-${i}`);
  ids.push('', 'café-crème', 'cafe\u0301', '\ufeffsku', 'a\u200bb', 'canapé 🛋️',
    'chaise "Löw" & <co>', 'ZAŻÓŁĆ', '\u00a0espace');
  const tailles = [240, 60, 7, 5, 4, 1, 0, 1001];
  assert.equal(new Set(ids.map(teinte)).size, 360);
  const script =
    'import sys, json; sys.path.insert(0, sys.argv[1]); from n0 import placeholder_svg; ' +
    'd = json.load(sys.stdin); ' +
    'json.dump([[placeholder_svg(i, s) for s in d["sizes"]] for i in d["ids"]], sys.stdout)';
  const r = spawnSync(python, ['-c', script, fileURLToPath(new URL('.', import.meta.url))], {
    input: JSON.stringify({ ids, sizes: tailles }),
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ids.map((i) => tailles.map((s) => placeholderSvg(i, s))));
});

test('est déterministe et dépend de l’identifiant', () => {
  assert.equal(placeholderSvg('sku-4451'), placeholderSvg('sku-4451'));
  assert.notEqual(placeholderSvg('sku-4451'), placeholderSvg('sku-4452'));
});

test('le hachage est le FNV-1a 32 bits de référence', () => {
  assert.equal(stableHash(''), 0x811c9dc5);
  assert.equal(stableHash('a'), 0xe40c292c);
  assert.equal(stableHash('foobar'), 0xbf9cf968);
  for (const mot of ['sku-4451', 'café-crème', 'canapé 🛋️']) {
    assert.equal(stableHash(mot), hashWord(mot));
  }
});

test('une multiplication ordinaire dériverait là où Math.imul reste exact', () => {
  // Commentaire : « a plain multiplication on numbers this large loses
  // precision past 2^53 and would silently drift away ».
  const naif = (text) => {
    let digest = 2166136261;
    for (const char of text) digest = ((digest ^ char.codePointAt(0)) * 16777619) >>> 0;
    return digest;
  };
  assert.notEqual(naif('sku-4451'), stableHash('sku-4451'));
  // Témoin : l'arithmétique entière exacte, en BigInt, donne bien stableHash.
  let exact = 2166136261n;
  for (const char of 'sku-4451') exact = ((exact ^ BigInt(char.codePointAt(0))) * 16777619n) & 0xffffffffn;
  assert.equal(Number(exact), stableHash('sku-4451'));
});

test('la figure est symétrique', () => {
  // Assertion d'origine, conservée : la paire miroir de la troisième ligne.
  assert.ok(GOLDEN_MUG.includes('<rect x="0" y="36"'));
  assert.ok(GOLDEN_MUG.includes('<rect x="48" y="36"'));
  for (let i = 0; i < 300; i += 1) {
    const cases = cellules(placeholderSvg(`sku-${i}`, 60));
    for (const c of cases) {
      const [x, y] = c.split(',').map(Number);
      assert.ok(cases.has(`${4 - x},${y}`));
    }
  }
});

test('les bits hauts choisissent la teinte et les bits bas les cases', () => {
  for (let i = 0; i < 300; i += 1) {
    const id = `sku-${i}`;
    const digest = stableHash(id);
    const attendues = new Set();
    for (let ligne = 0; ligne < 5; ligne += 1) {
      for (let colonne = 0; colonne < 5; colonne += 1) {
        if ((digest >>> (ligne * 3 + Math.min(colonne, 4 - colonne))) & 1) attendues.add(`${colonne},${ligne}`);
      }
    }
    const svg = placeholderSvg(id, 60);
    assert.deepEqual(cellules(svg), attendues);
    const fond = canaux(couleurs(svg)[0]);
    const attendu = hslFlottant(teinte(id), 45, 90);
    fond.forEach((c, k) => assert.ok(Math.abs(c - attendu[k]) <= 2, id));
  }
});

test('le fond teinté et l’encre sont la conversion HSL des pourcentages annoncés', () => {
  // hexColour n'est pas exporté : la roue entière est parcourue par les
  // identifiants, et chaque couleur est comparée à la conversion flottante.
  const vues = new Set();
  for (let i = 0; vues.size < 360; i += 1) {
    const id = `sku-${i}`;
    const h = teinte(id);
    if (vues.has(h)) continue;
    vues.add(h);
    const [fond, encre] = couleurs(placeholderSvg(id, 60));
    for (const [hexa, s, l] of [[fond, 45, 90], [encre ?? fond, encre ? 55 : 45, encre ? 42 : 90]]) {
      const attendu = hslFlottant(h, s, l);
      canaux(hexa).forEach((c, k) => assert.ok(Math.abs(c - attendu[k]) <= 2, `${h} ${s} ${l}`));
    }
  }
});

test('le balisage est du XML bien formé', () => {
  const svg = placeholderSvg('sku-4451');
  assert.match(svg, WELL_FORMED);
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('width="240"'));
  assert.ok(svg.includes('role="img"'));
});

test('l’identifiant est recopié dans aria-label', () => {
  assert.equal(ariaLabel(placeholderSvg('client 4412 — Mme Durand')), 'client 4412 — Mme Durand');
});

test('aucun fichier écrit et aucune dépendance externe', () => {
  const noms = ['writeFileSync', 'writeFile', 'openSync', 'open', 'createWriteStream', 'appendFileSync'];
  const origines = Object.fromEntries(noms.map((n) => [n, fs[n]]));
  let svg;
  try {
    for (const n of noms) {
      fs[n] = () => {
        throw new Error('un fichier a été ouvert');
      };
    }
    syncBuiltinESMExports();
    svg = placeholderSvg('sku-4451');
  } finally {
    Object.assign(fs, origines);
    syncBuiltinESMExports();
  }
  assert.equal(typeof svg, 'string');
  // The only URL in the output is the SVG namespace itself.
  assert.equal(svg.split('http').length - 1, 1);
  for (const forbidden of ['<image', 'href', 'url(', '@font-face', '<script']) {
    assert.ok(!svg.includes(forbidden), forbidden);
  }
});

test('une image prend moins d’une milliseconde', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) placeholderSvg(`sku-${i}`);
  assert.ok(performance.now() - debut < 1000);
});

test('l’essai : un identifiant qui dit rouge sort en vert', () => {
  const cas = essai.cases.find((c) => c.fails);
  assert.equal(cas.input, 'canapé en velours rouge');
  assert.equal(teinte(cas.input), 159);
  assert.equal(essai.run(cas.input, 'fr').verdict.label, 'Teinte 159° — vert');
  assert.equal(essai.run(cas.input, 'en').verdict.label, 'Hue 159° — green');
});

test('l’essai : deux vues du même canapé donnent un bleu et un vert', () => {
  assert.equal(famille('canape-4501-vue-face'), 'bleu');
  assert.equal(famille('canape-4501-vue-profil'), 'vert');
});

test('l’essai : le détail compte des rectangles pleins en deux couleurs', () => {
  for (const cas of essai.cases) {
    const input = typeof cas.input === 'string' ? cas.input : cas.input.fr;
    const { image, verdict } = essai.run(input, 'fr');
    const carres = image.svg.split('<rect').length - 1;
    assert.equal(verdict.detail, `${carres} rectangles pleins en 2 couleurs, et rien à télécharger : le balisage entier tient dans la page.`);
    assert.equal(image.svg, placeholderSvg(input, 240));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un identifiant vide donne une image', () => {
  // A missing reference is exactly when a placeholder is needed, so an empty
  // identifier has to give an image rather than an exception.
  const svg = placeholderSvg('');
  assert.match(svg, WELL_FORMED);
  assert.ok(svg.includes('aria-label=""'));
});

test('production : un identifiant absent lève une TypeError', () => {
  assert.throws(() => placeholderSvg(null), TypeError);
  assert.throws(() => placeholderSvg(undefined), TypeError);
});

test('production : un identifiant d’un mégaoctet termine vite', () => {
  const id = 'sku-'.repeat(250_000);
  const debut = performance.now();
  const svg = placeholderSvg(id);
  assert.ok(performance.now() - debut < 5000);
  assert.match(svg, WELL_FORMED);
  assert.equal(ariaLabel(svg), id);
});

test('production : accents et caractères de balisage sont échappés', () => {
  assert.ok(placeholderSvg('café-crème').includes('aria-label="café-crème"'));

  const escaped = placeholderSvg('chaise "Löw" & <co>');
  assert.ok(escaped.includes('aria-label="chaise &quot;Löw&quot; &amp; &lt;co&gt;"'));
  assert.match(escaped, WELL_FORMED);
});

test('production : l’esperluette est échappée en premier', () => {
  const svg = placeholderSvg('&lt;déjà échappé&gt;');
  assert.ok(svg.includes('aria-label="&amp;lt;déjà échappé&amp;gt;"'));
  assert.equal(ariaLabel(svg), '&lt;déjà échappé&gt;');
});

test('production : une injection de balisage reste dans l’attribut', () => {
  const id = '"/><script>alert(1)</script><rect x="';
  const svg = placeholderSvg(id);
  assert.ok(!svg.includes('<script'));
  assert.match(svg, WELL_FORMED);
  assert.equal(ariaLabel(svg), id);
});

test('production : NFC et NFD du même mot donnent deux images différentes', () => {
  const nfc = 'café'.normalize('NFC');
  const nfd = 'café'.normalize('NFD');
  assert.notEqual(placeholderSvg(nfc), placeholderSvg(nfd));
  assert.equal(placeholderSvg(nfc), placeholderSvg('café'));
});

test('production : insécables, largeur nulle, emoji et BOM sont recopiés tels quels', () => {
  for (const id of ['prix\u00a0doux', 'a\u200bb', 'canapé 🛋️', '\ufeffsku-1', 'SKU-1']) {
    const svg = placeholderSvg(id);
    assert.match(svg, WELL_FORMED);
    assert.equal(ariaLabel(svg), id);
  }
  // Casse mixte : deux identifiants distincts, deux images.
  assert.notEqual(placeholderSvg('SKU-1'), placeholderSvg('sku-1'));
});

test('un caractère de contrôle est recopié tel quel et rend le SVG mal formé', () => {
  // Une tabulation verticale collée depuis un tableur passe dans aria-label :
  // XML 1.0 l'interdit, le SVG servi en image/svg+xml ne s'affiche plus.
  assert.doesNotMatch(placeholderSvg('canapé\u000b4501'), CONTROLE_INTERDIT_EN_XML);
});

test('production : tailles aux limites', () => {
  // A small size still gives whole pixels.
  const svg = placeholderSvg('mug-106', 7);
  assert.ok(svg.includes('width="1"'));
  assert.match(svg, WELL_FORMED);
  // Exactement la grille : une case d'un pixel.
  assert.ok(placeholderSvg('mug-106', 5).includes('width="1" height="1"'));
  // Juste en dessous : les cases font zéro pixel, il ne reste que le fond.
  const petit = placeholderSvg('mug-106', 4);
  assert.ok(petit.split('<rect').slice(2).every((r) => r.includes('width="0"')));
  // Zéro : un SVG vide mais bien formé.
  assert.match(placeholderSvg('mug-106', 0), WELL_FORMED);
  // Juste au-dessus d'un multiple de la grille : la marge centre la figure.
  const xs = [...placeholderSvg('sku-1', 64).matchAll(/<rect x="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(xs.length && xs.every((x) => (x - 2) % 12 === 0 && x >= 2 && x <= 50));
});
