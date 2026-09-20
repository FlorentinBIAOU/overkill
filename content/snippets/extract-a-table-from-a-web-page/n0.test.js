import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_SPAN, extractTables } from './n0.js';

// Un tableau de devis ordinaire : un entête groupé, une cellule fusionnée en
// hauteur, et une ligne de total qui court sur toute la largeur.
const DEVIS = `<table><caption>Devis 2026</caption>
<tr><th>Article</th><th colspan="2">Prix</th></tr>
<tr><td>Moulin</td><td>HT</td><td>TTC</td></tr>
<tr><td rowspan="2">Lot</td><td>1</td><td>2</td></tr>
<tr><td>3</td><td>4</td></tr>
<tr><td colspan="3">Total</td></tr></table>`;

const IMBRIQUE = '<table><tr><td>avant<table><tr><td>interne</td></tr></table>après</td>'
  + '<td>voisine</td></tr></table>';

const SECTIONS = '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>';

const textes = (html, index = 0) => extractTables(html).tables[index].rows
  .map((ligne) => ligne.map((cellule) => cellule.text));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une cellule fusionnée est répétée, et le dit', () => {
  const grille = extractTables(DEVIS).tables[0].rows;
  assert.deepEqual(grille[4].map((c) => c.text), ['Total', 'Total', 'Total']);
  assert.deepEqual(grille[4].map((c) => c.repeated), [false, true, true]);
});

test('point de rupture : témoin, une ligne sans fusion ne lève aucun drapeau', () => {
  const grille = extractTables(DEVIS).tables[0].rows;
  assert.deepEqual(grille[1].map((c) => c.text), ['Moulin', 'HT', 'TTC']);
  assert.ok(!grille[1].some((c) => c.repeated));
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la grille rendue est celle que le lecteur voit', () => {
  assert.deepEqual(textes(DEVIS), [
    ['Article', 'Prix', 'Prix'],
    ['Moulin', 'HT', 'TTC'],
    ['Lot', '1', '2'],
    ['Lot', '3', '4'],
    ['Total', 'Total', 'Total'],
  ]);
});

test('une fusion en hauteur descend dans la ligne suivante', () => {
  const grille = extractTables(DEVIS).tables[0].rows;
  assert.deepEqual([grille[2][0].text, grille[2][0].repeated], ['Lot', false]);
  assert.deepEqual([grille[3][0].text, grille[3][0].repeated], ['Lot', true]);
});

test("les cellules d'entête sont marquées", () => {
  const grille = extractTables(DEVIS).tables[0].rows;
  assert.ok(grille[0].every((c) => c.header));
  assert.ok(!grille[1].some((c) => c.header));
});

test('un tableau dans une cellule est un tableau à part', () => {
  const rapport = extractTables(IMBRIQUE);
  assert.equal(rapport.tables.length, 2);
  assert.deepEqual(textes(IMBRIQUE, 1), [['interne']]);
  assert.deepEqual(textes(IMBRIQUE, 0), [['avantaprès', 'voisine']]);
  assert.equal(rapport.tables[0].nested, true);
  assert.equal(rapport.tables[1].nested, false);
});

test('la légende est rendue avec la grille', () => {
  assert.equal(extractTables(DEVIS).tables[0].caption, 'Devis 2026');
  assert.equal(extractTables(SECTIONS).tables[0].caption, null);
});

test('les sections de tableau ne coupent pas les lignes', () => {
  assert.deepEqual(textes(SECTIONS), [['A'], ['1']]);
});

test('une portée absurde est plafonnée, pas crue', () => {
  const rapport = extractTables('<table><tr><td colspan="99999">large</td></tr></table>');
  assert.equal(rapport.tables[0].columns, MAX_SPAN);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 42, [], {}, '']) {
    const rapport = extractTables(entree);
    assert.deepEqual(rapport.tables, []);
    if (typeof entree !== 'string') assert.ok(rapport.reason.startsWith('expected text'));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, un tableau de devis', () => {
  const table = extractTables(DEVIS).tables[0];
  assert.equal(table.columns, 3);
  assert.equal(table.rows.length, 5);
});

test('production : entrée vide', () => {
  assert.deepEqual(extractTables(''), { tables: [], reason: null });
  assert.deepEqual(extractTables('<table></table>').tables[0].rows, []);
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = `<table>${'<tr><td>a</td><td>b</td></tr>'.repeat(20_000)}</table>`;
  const debut = performance.now();
  const rapport = extractTables(enorme);
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.tables[0].rows.length, 20_000);
});

test('production : encodages inattendus', () => {
  assert.deepEqual(textes('<table><tr><td>&eacute;t&eacute;</td></tr></table>'), [['été']]);
  assert.deepEqual(textes('<table><tr><td>  espaces\n  multiples </td></tr></table>'),
    [['espaces multiples']]);
});

test('production : valeurs aux limites', () => {
  assert.deepEqual(textes('<table><tr><td>1</td><td>2</td></tr><tr><td>3</td></tr></table>'),
    [['1', '2'], ['3', '']]);
  assert.deepEqual(textes('<table><tr><td>a</td></tr>'), [['a']]);
});

test("production : un tableau illisible n'empêche pas de lire les autres", () => {
  const rapport = extractTables(`<table></table>${DEVIS}`);
  assert.equal(rapport.tables.length, 2);
  assert.equal(rapport.tables[1].columns, 3);
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) extractTables(DEVIS);
  assert.ok(performance.now() - debut < 20_000);
});
