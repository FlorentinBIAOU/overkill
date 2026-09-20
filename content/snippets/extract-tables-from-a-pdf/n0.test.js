import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import {
  MIN_FILLED_CELLS, SAME_CELL, SAME_COLUMN, SAME_LINE, groupIntoRows, readTables,
} from './n0.js';

/** Les PDF de ce test, fabriqués pour lui, compressés pour tenir dans le fichier. */
const pdf = (...morceaux) => zlib.inflateSync(Buffer.from(morceaux.join(''), 'base64'));

// Sept documents minimaux, tous de vrais PDF. Le test Python porte exactement
// les mêmes octets.
const TABLEAU = pdf(
  'eNptlN9u2jAUxu/zFOcGaZNoYyd2/khVpdGCKm3VGETaRbWLFBzqKthTYja2l9zFXmDabpa3mGNsMmoARYff'
  + '+ZzvOMrn0fx2doEvSTD6/efHzwADAvn4HFxdQVh8+8wgvClVWcsNhPNyw1qItGAB19cBE+teGHkLDrrwLV+3'
  + '8EB7+Sd9F7kTCvB/C+NhIYTvmNioJ0gJ6hWtali5DdAlha8BjSHNCWyBpoeqhqWBaeSgrhykyEFdORhlDurK'
  + 'QZQ4qCsHD0YDw5mDprI0xo6aylJCHDWVu2t6Mr+lkwLCGQaMoKjMM0f62dAU0kyTLbxadFXXMLFir6F4Pgpw'
  + 'Nihuu5ZvRKm4FCeaGA+aD7tSKK66EwEhg2De8D3cFSf9fgqamfb9zQWhCPszuL7c1VzAL1iVVedPYVWRb287'
  + 'OB/nyDOPE2eeI4R8c9ufyB2va8kb5jtbCfadbScmY+Q7Y+KccXTO2faLp47/bRhUUqgz5lYV++a2Q+iYHu4+'
  + 'Lfo02Nfd5oJ4gZppHwiXu0dl/vYQQzgpW3bo3LH6C1N8VUI4FSu55kKn9SMXb0TLj2AIHj2b2P6q3zhlAx7e'
  + 'szUvJ3IPD/0GaE4hI5EO8oK1ctesdML79WYAU+gt2pOh/+m862cjVAvxi/Ni37AqQJAE6PiBhNKYQgVHhvWM'
  + 'piMGlhCP4Qh7LNeJfMGw/g5MNSWvWWO2v+TfGSR6U1L2h5OdtFVlo8ycGMdJMBpN38+Cf0GVQCM=');
const SANS_FILETS = pdf(
  'eNptU9Fq2zAUffdX3JfABukk2ZITQyksbUJhK8tSwx7KHlRHTlVcacjyyPaTfdgPjO1l/ovJjhI3VYwx9j3n'
  + '6pxrzh0trxZn5B2NRn/+Pv+KCGDQ94/R+Tmg/Mc3AeiSW17pDaAl34gaYkdYwcVFJNS6I8ZBw46HPsh1DXes'
  + 'o391p+hGWSAvGpOhEdBHoTb2AVjcM2prBH+KZjmgBQGCIS97Y9gdwCYwmbrKE7xZtWVrhCrEW8gfDwQyHRhX'
  + 'bS03ilup1REnIQPnc8OVlbY9IlA6EJZGbuE6P8I7F2zawzeXZ5RhEnrY47qppILfUPCyDV14VhzKe4Rk4wwH'
  + '4km6F88wxqG4x2e6kVWlpRGhsqeQUNkjCR3jUJnQvTKJTyl7PH9o5T8joNTKnhD3rCQU9whlY7Y7fZ53kfGZ'
  + '8OGhQeoWTgfQbXNv+8+uSADNeC12yLWovgsrCw5orgq9lspF+otU71UtD4UhnexkrLunS5z1W4BuxFrymd7C'
  + 'XTcAyxhMaezSvhK1bkzh1qDr7w30L25Evz7d7ZbC/Rtla0heLdXWiDLCkEb4cEHKWMKghEONOI89ooZaSoMa'
  + 'cTv1upZmIW+SveBZw2UlTD/+rfwpIHVDad1tsHdaW25s7zMjk2g0mn9aRP8BLUIT7Q==');
const CELLULE_REPLIEE = pdf(
  'eNptlN9q2zAUxu/9FOcmsEFaS7blP1AKS5tQWMu6xLCLsgs3VjIVWxq2vGV7yV3sBcZ2U7/FJEWKmzohhJPf'
  + '+XTyHaMvk/vrxRk+j7zJ33+/fnsYEIjHJ+/iAvz8x1cK/lUhi0pswb8vtrSFQAmWcHnpUV5qYTA6sNf571nZ'
  + 'wgPR8s9qiui4BPziYDgcBP+W8q38AjEhWtHKhha1h84JfPdICEkWQQ0k2VcVrAxMAgdV5WCQOqgqB1HsoKoc'
  + '3M8cGE4dNJWlIXbUVJZGkaOmclOTI6uWznLwFxgwgnxjHi9Sj4EkkKSK1PBm2W/6hvI1fQv500GA00Fx3bds'
  + 'ywvJBD/ShHjQfOwKLpnsjwRRNAjuG7aDm/yor12Q1LTvrs4igvDYg+uLrmIc/sC62PRw29XsuaFjN1YdjG3Y'
  + 'Ds6mGRr/Shibbi3K54pCgIJ4Cn3J9MpQsVotRkfOceScZwidmGn7M9GxqhLslF0rwWO7thNGUzt6nuuLa2+m'
  + 'vcLR6O4vhLrl/qp7lOarhhj8WdHSfeeGVt+oZOsC/Dlfi5JxFaxPjL/jLTuAISPkZLj0p7ox0mbRv6MlK2Zi'
  + 'Bw96AZIRSKNAZW5JW9E1axVGfd4YMIVa0YZYv1U0uVTTWghfRXvX0I2HIPbQ4aUTGhLYwIFh5dF0+MDiaMRw'
  + 'gEcsVRF9zbLgxTzZFKyijVl/xX5SiNVSQuj/Eeu0lUUjjU+MCPYmk/mHhfcfqPEzlA==');
const PROSE = pdf(
  'eNptUstq20AU3c9XnI0hLXakkSXFhRCIU5tCUxpiQRehi4l07U6QZ4xmFNz+ZBf9gdJs4r/IHdm1Q10hhO65'
  + '59x37+b9dCBPU9H78/Tzl5CIYe8fxPk5ouL7ihBdKa9qu0B0oxbkkDDhFhcXgkwViMmRYMuLPurK4S4L9K8c'
  + 'xbbGQ74SDg9CRNdkFv4bkmEWGM43pJZiXCCaSsgExRzZGc5GMYoKMkdxLU6urPGN8qgIq4acV15bEyxHzaMu'
  + 'yb1B8YDirTiZMJFQKzhb6o3fYLKm5aomzC5nfagWpVppbrLzq3qv41hLXTOP2sa6PirOCDadfl4w6Dx+Y2xb'
  + 'Ho6hwV41ZokypW0b3wd1grLWxNJq4/TCbFDqgVo1z+70r2ZShKHsut6NJz2a6zSkj2btve/MAEpEY+Vo6/lA'
  + '9SN5XSpEE85facNL+6LNpXF6Dxzmn/13ceHbhGK3e44+UaXV2K5xFzOQvcswShPe5y057pCnjKDvCuh+JNLd'
  + 'gYQ3CkviaA7Df85m3dBcxMhFvH+QZxnvf449JrnGzmMOWJ4eYTKRR1gaj46wLH4Vj29H19R07c/0D0LOTVkb'
  + 'bnRXKZ9U47s686EUvd7k81S8AAGN6nc=');
const SCAN = pdf(
  'eNptUstq20AUpdDVUOg2ZBEuFJNVOnqMhEsSLxzHjXFLXLuQgMliLN3YYySNMxoXu+t+RheFfkA/oX/QGrLN'
  + 'Kt12012XnZEd21QRw8xwdM7Vueeq0mk0D9yXjFTuf/28JS44IAdjcnQE9P18gkBPuOaJHALt8CHm4BlCF2o1'
  + 'gllsiV5JsOTRtohz6AeWfmWqyGmmwd0S+hsh0DeYDfUIfMcScq2Qp+QGgldW7kCVecUZpUBbqQsNCe9smRVx'
  + 'VZCVnFyeD8YYaaC96UAXSCs15oBeiNh8jTlAz1AMRxqC0FpMpOpNeGQIDfwgInyt+BxoXei8g+pEphOZoemi'
  + 'CrQpEo3KnAnX2MBIxrhugvlbTcw+3y4Wi7/Pn+6++LT3LPuyf7xz5+x+//rncL21U//Jj2/kd7mj4NFs7a6s'
  + 'j+Uo6FuMBa/LGfRtRjYzk5eJvIu5nKrIzMLqH7Kwd5shW83RLtN6pk3FHPz/pjtTeE0cCImzfiAMAj+Aa1hj'
  + 'rvFZvMk2WMhKmOu5JcxzvBLG3C1MKy4SVEUEPfERwQyqK6X9lVZOc82VLnwGzCOVyul5k/wD2SfOiA==');
const DEUX_PAGES = pdf(
  'eNrtlM1O3DAUhfd5irsZqZWA+CZ2fiSE1AFGSC0qhUhdoC7CjGcwCnaVeFral+yiL1C1m85b1PHYEwZPl+yI'
  + 'oujmu8c+tpWT0cXJZB8PaDT6/efHzwiBgLq5iw4PIa6+feYQH9e6btQC4ot6wTtIjOASjo4iLme9MAkGrHXx'
  + 'WzHr4JpZedE/P5m51FJqM8UwPB2GQ/yOy4W+hZySXtHpltf3ETlg8DViKeQlhXtg+bpq4MrCPPHQVB4y4qGp'
  + 'PEwKD03lIck8NJWHa6OBYeGhrRxN0VNbOUqpp7bys+Zb63d0XEE8QUAC1dyePAE0AsgLQ+7h1eVqvmq5nPLX'
  + 'UN1tBFgMipNVJxay1kLJLU2Kg+bDspZa6NWWgNJBcNGKBzirtvr9Klhh2+fH+5QRDNfg+2rZCAm/YFrPV+Eq'
  + 'nCoJ7V0Hy72SBOZp5s1LQkho7vpjtRRNo0TLQ2cnwdDZdVK6R0JnpN4Zk13Orl/drsTflsNcSb3D3KnS0Nx1'
  + 'KNtj69lPqz4N7nN3uaBBrCbGB+Kr5Y22rz1EiMd1x9edM9584VpMa4hP5VTNhDSZ/SjkG9mJDRiCx3bmtn+a'
  + 'L067mMfnfCbqsXqA634DrGRQ0MQE+ZJ3atlOTc778XYBtjBbdP+H/jZ5N2cjdQfpk79GtiP2LMFHsX/Jxks2'
  + '/pON/LmzUTxTNvKd2cieZOOh5fOIQBmRzQUZYymDOWwYmvzajhxYRgOGSR6wEsunDAlmAUOaBCwPfbHARzrd'
  + '1qLhrT26K/GdQ2kORCkN6HfZ6brVdo9YpkU0Gp2+n0T/AK4CFZc=');

// Une facture reçue par courriel : un bloc adresse, un numéro de facture, un
// tableau à quatre colonnes sans un seul filet, et un pied de page. C'est
// l'entrée qui a fait tomber cette fiche à la relecture.
const FACTURE_SANS_FILETS = pdf(
  'eNptVNFumzAUfecr7kukTSrDNoYGqarUtEWVlqhZwlu1B5c4mSNiT8ZU2b5+18CapC5CiJx7zj3H5jqT5UMZ0288okDAvO6jmxtI'
  + 'qj+/JST3wonG7CBZip1sgSFhBbe3kdQbT2SBYOAl39WmhZfU039iF9NpB/RMmH4q9E8rkTr4JAu5UWJmjvBCEMiKDKacYb+VbE1n'
  + 'azTy+tKgon+hkI0B/Y222mG3FviH2PzMfS71zv2CPOWe0DorxSGaVZHvRglU235XCKa/JnA9ReQAX9Z3qznMJSxM1yj9Far9BSvP'
  + 'exZlYDsJG8xZWmllG8+7g8KXQJCxXlAwSgjMsKnZaRnPVNMIXeNSXaBgvFeUonadlaChvIsZYXlMONpuOsDnXug3tAOPf2yQjytZ'
  + 'yS0G0vVlJnrGeJCt2mnhlLlcaJqeOD86oZ1yl034GWFp1RGeqiBFPpQX9zHPCA0z/K/3+wwCarGVYYqRxUL7sUKLq4IE5vzdvCCE'
  + 'hOZjHb8Hfgij7CfOI4WGzmMl5VckdCbjrviZp9B2FoYOj5Uf0XEIx2HNgqPSD3yy7l5d/9ODFJKZaOVQeZLNm3SqFmcjf7RyG6Fz'
  + 'RN4vyLMszWALJ6yAoaJPWDYNMEqzAGOcBljB8hPmrFCNtP0y1uqvhBzPsTH+b2E8nK0T1vU5iyKPJpPH5zL6BzDKI3I=');

const LIGNES = [['Référence', 'Désignation', 'Quantité', 'Prix HT'],
  ['MC-4501', 'Moulin à café', '2', '19,90'],
  ['MC-9000', 'Bouilloire', '1', '34,00'],
  ['MC-1200', 'Théière fonte', '3', '45,50']];

const REPLIEE_SANS_FILETS = [['Référence', 'Désignation', 'Quantité', 'Prix HT'],
  ['MC-4501', 'Moulin à café Lumière', '2', '19,90'],
  ['', 'modèle 2026, édition limitée', '', ''],
  ['MC-9000', 'Bouilloire', '1', '34,00']];

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : l'habillage de la page n'est pas une ligne du tableau", async () => {
  // « Sur une facture sans filets, la grille est déduite de toute la page : le
  // bloc adresse, le numéro de facture et le pied de page tombent dans la
  // première colonne. Les lignes à moins de deux cellules remplies ne sont pas
  // rendues, et `dropped_lines` dit lesquelles. »
  const table = (await readTables(FACTURE_SANS_FILETS)).tables[0];
  assert.equal(table.strategy, 'text');
  assert.deepEqual(table.rows, [
    ['Reference', 'Designation', 'Quantite', 'Prix HT'],
    ['MC-4501', 'Moulin a cafe', '2', '19,90'],
    ['MC-9000', 'Bouilloire', '1', '34,00'],
  ]);
  assert.deepEqual(table.dropped_lines, [
    'SARL Le Moulin',
    '12 rue des Freres-Lumiere',
    '92100 Boulogne-Billancourt',
    'Facture n FA-2026-0412 du 12 janvier 2026',
    'Page 1 sur 1',
  ]);
  assert.equal(MIN_FILLED_CELLS, 2);
});

test('point de rupture : la lecture devinée sort une cellule repliée du tableau', async () => {
  // Faute de détection des filets en JavaScript, c'est toujours la lecture
  // devinée qui répond ici. La seconde ligne de la désignation n'a qu'une
  // cellule remplie : elle est nommée dans `dropped_lines` plutôt que rendue
  // comme une ligne du tableau, donc elle sort de la case où elle devrait
  // être. L'extrait Python lit les filets et la garde dans la case.
  const table = (await readTables(CELLULE_REPLIEE)).tables[0];
  assert.equal(table.strategy, 'text');
  assert.deepEqual(table.rows, [
    ['Référence', 'Désignation', 'Quantité', 'Prix HT'],
    ['MC-4501', 'Moulin à café Lumière', '2', '19,90'],
    ['MC-9000', 'Bouilloire', '1', '34,00'],
  ]);
  assert.deepEqual(table.dropped_lines, ['modèle 2026, édition limitée']);
  // La grille brute, avant le filtre, porte bien les quatre lignes.
  assert.equal(REPLIEE_SANS_FILETS.length, 4);
});

test("point de rupture : témoin, le rapport dit laquelle des deux lectures a répondu", async () => {
  assert.equal((await readTables(TABLEAU)).tables[0].strategy, 'text');
  assert.equal((await readTables(SANS_FILETS)).tables[0].strategy, 'text');
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('les deux lectures donnent la même grille sur un tableau ordinaire', async () => {
  assert.deepEqual((await readTables(TABLEAU)).tables[0].rows, LIGNES);
  assert.deepEqual((await readTables(SANS_FILETS)).tables[0].rows, LIGNES);
});

test("un mot n'est jamais coupé", async () => {
  assert.equal((await readTables(SANS_FILETS)).tables[0].rows[0][3], 'Prix HT');
});

test("les mots d'une même cellule sont rassemblés", async () => {
  assert.equal((await readTables(SANS_FILETS)).tables[0].rows[1][1], 'Moulin à café');
  assert.equal(SAME_CELL, 10.0);
  assert.equal(SAME_LINE, 3.0);
  assert.equal(SAME_COLUMN, 12.0);
});

test("une page sans tableau ne rend pas un tableau inventé", async () => {
  // Une page de prose n'a ni filets ni colonnes : chaque ligne y porte une
  // seule cellule remplie, donc aucune n'est une ligne de tableau.
  assert.deepEqual((await readTables(PROSE)).tables, []);
  assert.deepEqual((await readTables(SCAN)).tables, []);
});

test("chaque page est lue, et l'appelant peut en choisir", async () => {
  const deux = await readTables(DEUX_PAGES);
  assert.deepEqual(deux.tables.map((t) => t.page), [1, 2]);
  assert.deepEqual((await readTables(DEUX_PAGES, { pages: [2] })).tables.map((t) => t.page), [2]);
});

test("un fichier qui n'est pas un PDF donne une raison", async () => {
  const rapport = await readTables(Buffer.from("ceci n'est pas un PDF"));
  assert.deepEqual(rapport.tables, []);
  assert.ok(rapport.reason.startsWith('this file could not be opened as a PDF'));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, une facture à quatre colonnes', async () => {
  const table = (await readTables(TABLEAU)).tables[0];
  assert.equal(table.rows.length, 4);
  assert.deepEqual(table.rows[1], ['MC-4501', 'Moulin à café', '2', '19,90']);
});

test('production : entrée vide', async () => {
  const vide = await readTables(Buffer.alloc(0));
  assert.deepEqual(vide.tables, []);
  assert.notEqual(vide.reason, null);
  assert.deepEqual(groupIntoRows([]), []);
});

test('production : entrée très grande et terminaison rapide', () => {
  const mots = Array.from({ length: 10_000 }, (unused, i) => ({
    text: `m${i}`, x: (i % 50) * 11.0, end: (i % 50) * 11.0 + 8, y: -Math.floor(i / 50) * 12.0,
  }));
  const debut = performance.now();
  const grille = groupIntoRows(mots);
  assert.ok(performance.now() - debut < 30_000);
  assert.equal(grille.length, 200);
});

test('production : encodages inattendus', () => {
  const mots = [{ text: 'Réf.', x: 0, end: 20, y: 0 },
    { text: 'Moulin à café 🫖', x: 100, end: 200, y: 0 },
    { text: '19,90', x: 300, end: 320, y: 0 }];
  assert.deepEqual(groupIntoRows(mots), [['Réf.', 'Moulin à café 🫖', '19,90']]);
});

test('production : valeurs aux limites', () => {
  const base = { x: 0.0, end: 10.0 };
  assert.equal(groupIntoRows([{ ...base, text: 'a', y: 0.0 },
    { ...base, text: 'b', y: -SAME_LINE }]).length, 1);
  assert.equal(groupIntoRows([{ ...base, text: 'a', y: 0.0 },
    { ...base, text: 'b', y: -SAME_LINE - 0.1 }]).length, 2);
  assert.deepEqual(groupIntoRows([{ text: 'a', x: 0.0, end: 10.0, y: 0.0 },
    { text: 'b', x: 10.0 + SAME_CELL, end: 30.0, y: 0.0 }]), [['a b']]);
  assert.deepEqual(groupIntoRows([{ text: 'a', x: 0.0, end: 10.0, y: 0.0 },
    { text: 'b', x: 10.0 + SAME_CELL + 0.1, end: 30.0, y: 0.0 }]), [['a', 'b']]);
});

test("production : une page sans tableau n'empêche pas de lire les autres", async () => {
  const lot = [TABLEAU, Buffer.from('pas un PDF'), SANS_FILETS, SCAN, FACTURE_SANS_FILETS];
  const vus = [];
  for (const p of lot) vus.push((await readTables(p)).tables.length);
  assert.deepEqual(vus, [1, 0, 1, 0, 1]);
});

test('production : la lecture tient la classe de latence annoncée', async () => {
  const debut = performance.now();
  for (let i = 0; i < 100; i += 1) await readTables(TABLEAU);
  assert.ok(performance.now() - debut < 60_000);
});
