import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import { MAX_COLUMNS, MIN_GUTTER, SAME_LINE, findColumns, readText } from './n0.js';

/** Les PDF de ce test, fabriqués pour lui, compressés pour tenir dans le fichier. */
const pdf = (...morceaux) => zlib.inflateSync(Buffer.from(morceaux.join(''), 'base64'));

// Cinq documents minimaux, tous de vrais PDF. Le test Python porte exactement
// les mêmes octets.
const COLONNES = pdf(
  'eNptU8tq20AU3esr7sbQQmpp9LIMIVCnNoU6NCSCLkIXY+nKnSDNuDOjkPYns+gPlHblfEXvyIrcVhZCjI7O'
  + 'uc+jyfW71Rs2jb3Jr99PPzwGAajNvXd+Dn7+bYfgX3LLa7UF/5pv0UBIhBu4uPBQlo4YjgQHnv9BlAbuEkf/'
  + 'TFFUKy2wv4TRUQj+GuXWfoGYzRzDWI288RY5+CsGLIC86goLKEAyg1lGSAOv1hw2qq253KIWCFdcWyGherb4'
  + 'GvL7QRGFwSC5rPcNSqINdA4ad1qYfyQuSZp2CkO9FCQBLt3BWqST3OMU1ifS9KIaoVBNg7pAQAlhwObE56Mc'
  + 'SdjRK9Vq+EnNCHMGRc2N2Z+BJVCeSPGi4dp18SBcbWULzXOD0NA4hBylibJOgrJQGl1gAzW11XAagJmOU/T8'
  + 'EnetMPC15bQP2O7lXpNCvUiWuVtlv6t+qfHIDStF9fm37cZ2rw5k4C+4wcOX91g/oBUFB39J9ZVCktU+CflW'
  + 'GjEAR9ckJ+3mntoN4uBO/wpLwRfqEe5cV8k8gSwOyYU3aGiqBfXu9F0B3YFB3Nva3WRWaSmageg/sz9qrLwA'
  + 'Ui8YLkiTJEqgggFjVGP3RR6xNB5hLGQjLJkHIyzNZkfMai5q1F37t+I7QkpNKeX+rL5SY8nXXZ0Zi7zJZPlx'
  + '5f0BAqUUkw==');
const PROSE = pdf(
  'eNptUstq20AU3c9XnI0hLXakkSXFhRCIU5tCUxpiQRehi4l07U6QZ4xmFNz+ZBf9gdJs4r/IHdm1Q10hhO65'
  + '59x37+b9dCBPU9H78/Tzl5CIYe8fxPk5ouL7ihBdKa9qu0B0oxbkkDDhFhcXgkwViMmRYMuLPurK4S4L9K8c'
  + 'xbbGQ74SDg9CRNdkFv4bkmEWGM43pJZiXCCaSsgExRzZGc5GMYoKMkdxLU6urPGN8qgIq4acV15bEyxHzaMu'
  + 'yb1B8YDirTiZMJFQKzhb6o3fYLKm5aomzC5nfagWpVppbrLzq3qv41hLXTOP2sa6PirOCDadfl4w6Dx+Y2xb'
  + 'Ho6hwV41ZokypW0b3wd1grLWxNJq4/TCbFDqgVo1z+70r2ZShKHsut6NJz2a6zSkj2btve/MAEpEY+Vo6/lA'
  + '9SN5XSpEE85facNL+6LNpXF6Dxzmn/13ceHbhGK3e44+UaXV2K5xFzOQvcswShPe5y057pCnjKDvCuh+JNLd'
  + 'gYQ3CkviaA7Df85m3dBcxMhFvH+QZxnvf449JrnGzmMOWJ4eYTKRR1gaj46wLH4Vj29H19R07c/0D0LOTVkb'
  + 'bnRXKZ9U47s686EUvd7k81S8AAGN6nc=');
const CESURE = pdf(
  'eNptUs1u1DAYvPsp5rJSQW0d529bqapEYFdIbEXVRuJQcfBuvg2ugr3YTlX6khx4AQSnfQucNGwQIYoiZ775'
  + '7PlmPLt+szwRpymb/fz17TsTiGDW9+ziArz8uiPw19LLxtTg17ImhzgQbnB5yUhXHTGeNDzz+DtVOdxlHf1j'
  + '2MW02kP81ZiMjeAr0rX/BDGPOobzluRnVpTgSwERo9wim2N+FqGsIHKUK3a0klibtpG6JqsIV9J6pY+htAt6'
  + 'mz3hB4pQN7Wmkxco71G+ZEeFakLHxrTWH0PiocVOOkcWX1oZDkW913srR75XRjtUhE2jSPtuuWuVgziP89M/'
  + 'rEXZzTSIHqZLJ7YsTTCA37Zr3/92oAAvpKPnyltqHsirjQRfBIWV0sHzD0q/0k4dgNG+7L++d18bhA4x8Suq'
  + 'lCzMI+6iAGTnGc7SOMRxQy54sAk5df29gH4hkA75dm9ITft+7OSf1B8tbVmEnEWHB3mWJRm2OGAiaOwresTy'
  + 'dIKJWEywJE0mWJpGI+atVA3Zfvxb9UTIw1DGdFdsUBqugfW9zizP2Wy2eL9kvwFnBNKk');
const SCAN = pdf(
  'eNptUstq20AUpdDVUOg2ZBEuFJNVOnqMhEsSLxzHjXFLXLuQgMliLN3YYySNMxoXu+t+RheFfkA/oX/QGrLN'
  + 'Kt12012XnZEd21QRw8xwdM7Vueeq0mk0D9yXjFTuf/28JS44IAdjcnQE9P18gkBPuOaJHALt8CHm4BlCF2o1'
  + 'gllsiV5JsOTRtohz6AeWfmWqyGmmwd0S+hsh0DeYDfUIfMcScq2Qp+QGgldW7kCVecUZpUBbqQsNCe9smRVx'
  + 'VZCVnFyeD8YYaaC96UAXSCs15oBeiNh8jTlAz1AMRxqC0FpMpOpNeGQIDfwgInyt+BxoXei8g+pEphOZoemi'
  + 'CrQpEo3KnAnX2MBIxrhugvlbTcw+3y4Wi7/Pn+6++LT3LPuyf7xz5+x+//rncL21U//Jj2/kd7mj4NFs7a6s'
  + 'j+Uo6FuMBa/LGfRtRjYzk5eJvIu5nKrIzMLqH7Kwd5shW83RLtN6pk3FHPz/pjtTeE0cCImzfiAMAj+Aa1hj'
  + 'rvFZvMk2WMhKmOu5JcxzvBLG3C1MKy4SVEUEPfERwQyqK6X9lVZOc82VLnwGzCOVyul5k/wD2SfOiA==');
const DEUX_PAGES = pdf(
  'eNq1U8tq20AU3esr7saQFifSyJZsQQjEqU2hDg2xoYvQxUS6didIM+7MKKT9yS76A6XdRPmK3hk7cht5G2PE'
  + 'zNU593WOelfvZsfsZBj0fv/58TNgEIG6vQtOTyFcftsghBfc8lKtIbziazQQE+Aazs4ClIUDxh3CFhd+EIWB'
  + 'm8TDx+75mXKpWlpKsacP9nQI5yjX9gsM2cghjNXIq2CyhHDGgEWwXPn2ImCQjGA0pkgFR3MOt6ouuVyjFgiX'
  + 'XFshYfVk8Q0s71rGII5aykXZVCgJ1sI5aNxoYf6juCJp6hmGJsqJAly6g7VIJ9ngCcwPlNmRSoRcVRXqHAEl'
  + 'xBHLCM87NZLYw1eq1vCLhhGmD3nJjWn6YCkoD5R45nDtprgXrreihuqpQqhoHUJ2ygzGnoIyVxpdYgMljVVx'
  + 'WoA56ZbY4Qvc1MLA15qTHrBuZKOJoZ4p06WTcqfVTtRhxxMzRf2Fi/rW+qsLMggn3OD2zXss79GKnEM4pf4K'
  + 'Iclwn4Q8l0a0gb1rkoOmc0+N3mDOdOElFoJP1APcuKmSLIHxMCYXXqOhreY0u+P7BvyBwXBnbvcns0pL2QwM'
  + 'Xlg+PeDZeJAc8CyJtGq9WgAjX8yDI5eYdggFwkajsX6d7mZQ3wvqyy0Wlm+Do6l0Oy85GJWLxjYwfcBqQ75a'
  + 'nC/6wGvI+UbQ5+nf87LlUa5KlITDWityU+FmpKsRj7QmKkk+m5BL1FriccuaEIXTsmtt+4CekJdbZzVGrGUD'
  + 'uTjmG/24ld5xDqk/em31x6+k/uig+ukL9R80roIIsiBqf5AmCem/gjbGyKH+jdzH0mEnxuJRJ5ZkaSeWZoNO'
  + 'bMyylzHGog6XxdE/XPKdKFH71S3Ed4SMFqKUBfY8JdlRWz8jG8RZ0OtNP86Cvy1BwMQ=');

// Une facture ordinaire à quatre colonnes, sans un seul filet : c'est le
// document le plus banal du public visé, et il ressortait transposé.
const FACTURE = pdf(
  'eNptVNFumzAUfecr7kukTSrDNoYGqarUtEWVlqhZwlu1B5c4mSNiT8ZU2b5+18CapC5CiJx7zj3H5jqT5UMZ0288okDAvO6jmxtI'
  + 'qj+/JST3wonG7CBZip1sgSFhBbe3kdQbT2SBYOAl39WmhZfU039iF9NpB/RMmH4q9E8rkTr4JAu5UWJmjvBCEMiKDKacYb+VbE1n'
  + 'azTy+tKgon+hkI0B/Y222mG3FviH2PzMfS71zv2CPOWe0DorxSGaVZHvRglU235XCKa/JnA9ReQAX9Z3qznMJSxM1yj9Far9BSvP'
  + 'exZlYDsJG8xZWmllG8+7g8KXQJCxXlAwSgjMsKnZaRnPVNMIXeNSXaBgvFeUonadlaChvIsZYXlMONpuOsDnXug3tAOPf2yQjytZ'
  + 'yS0G0vVlJnrGeJCt2mnhlLlcaJqeOD86oZ1yl034GWFp1RGeqiBFPpQX9zHPCA0z/K/3+wwCarGVYYqRxUL7sUKLq4IE5vzdvCCE'
  + 'hOZjHb8Hfgij7CfOI4WGzmMl5VckdCbjrviZp9B2FoYOj5Uf0XEIx2HNgqPSD3yy7l5d/9ODFJKZaOVQeZLNm3SqFmcjf7RyG6Fz'
  + 'RN4vyLMszWALJ6yAoaJPWDYNMEqzAGOcBljB8hPmrFCNtP0y1uqvhBzPsTH+b2E8nK0T1vU5iyKPJpPH5zL6BzDKI3I=');

const GAUCHE = 'La boulangerie Martin fête\nses cent ans cette année. Le\n'
  + 'four à bois, classé, tourne\nencore tous les matins.';
const DROITE = 'Clémentine Martin a repris\nle commerce en 2019. La\n'
  + 'farine vient du même moulin\ndepuis quatre générations.';

const TEXTE_CESURE = 'La boulangerie Martin, installée à Boulogne-\n'
  + 'Billancourt, a vu passer quatre généra-\n'
  + 'tions de clients depuis 1926.';

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : une page de tableau est lue dans l'ordre imprimé", async () => {
  // « Sur une page dont le corps est un tableau, les gouttières entre les
  // colonnes dépassent celles d'un texte : lire les bandes de haut en bas
  // rendrait toutes les références, puis toutes les désignations, puis tous
  // les prix. Ces pages sont lues dans l'ordre du dessin, et `reason` le dit. »
  const page = (await readText(FACTURE)).pages[0];
  assert.equal(page.columns, 3);
  assert.equal(page.reason, 'this page looks like a table: read in page order');
  const lignes = page.text.split('\n');
  assert.deepEqual(lignes.slice(4, 7), [
    'Reference Designation Quantite Prix HT',
    'MC-4501 Moulin a cafe 2 19,90',
    'MC-9000 Bouilloire 1 34,00',
  ]);
  assert.ok(lignes[5].includes('MC-4501') && lignes[5].includes('19,90'));
  // Témoin : la page à deux colonnes de prose, elle, est bien réordonnée.
  const colonnes = (await readText(COLONNES)).pages[0];
  assert.equal(colonnes.reason, null);
  assert.equal(colonnes.text, `${GAUCHE}\n\n${DROITE}`);
});

test('un tableau à deux colonnes reste transposé, et la fiche le dit', () => {
  // Docstring : « a table of exactly two columns […] is still read as two
  // columns, and still transposed. That is the first line of the breaking
  // point, not a footnote. »
  assert.equal(MAX_COLUMNS, 2);
  const deuxColonnes = [{ text: 'Total', x: 0.0, end: 40.0, y: 0.0 },
    { text: '19,90', x: 200.0, end: 240.0, y: 0.0 },
    { text: 'Remise', x: 0.0, end: 45.0, y: -12.0 },
    { text: '2,00', x: 200.0, end: 235.0, y: -12.0 }];
  assert.equal(findColumns(deuxColonnes).length, 2);
});

test("la gouttière minimale est un réglage de l'appelant", async () => {
  const serres = [{ text: 'a', x: 0.0, end: 100.0, y: 0.0 },
    { text: 'b', x: 110.0, end: 300.0, y: 0.0 }];
  assert.equal(findColumns(serres).length, 1);
  assert.equal(findColumns(serres, { minGutter: 10.0 }).length, 2);
  assert.equal((await readText(COLONNES, { minGutter: 500.0 })).pages[0].columns, 1);
});

test('les lignes coupées en fin de ligne sont comptées', async () => {
  // Docstring : « it counts those lines in `hyphenated_lines` so the caller
  // can decide for its own ».
  assert.equal((await readText(CESURE)).pages[0].hyphenated_lines, 2);
  assert.equal((await readText(COLONNES)).pages[0].hyphenated_lines, 0);
});

test('une césure reste une césure', async () => {
  // Docstring : « a word cut at the end of a line stays cut […] would also
  // glue « Boulogne- » and « Billancourt », which is a different town. »
  const texte = (await readText(CESURE)).pages[0].text;
  assert.equal(texte, TEXTE_CESURE);
  assert.ok(texte.includes('généra-\ntions'));
  assert.ok(texte.includes('Boulogne-\nBillancourt'));
});

test('témoin de la césure : le reste du texte est rendu tel quel', async () => {
  const texte = (await readText(CESURE)).pages[0].text;
  assert.ok(texte.includes('a vu passer quatre'));
  assert.equal(texte.split('\n').length - 1, 2);
  assert.ok(texte.endsWith('tions de clients depuis 1926.'));
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('une page à deux colonnes est lue colonne par colonne', async () => {
  const page = (await readText(COLONNES)).pages[0];
  assert.equal(page.columns, 2);
  assert.equal(page.text, `${GAUCHE}\n\n${DROITE}`);
});

test("une page à une colonne est rendue dans l'ordre", async () => {
  const page = (await readText(PROSE)).pages[0];
  assert.equal(page.columns, 1);
  assert.ok(page.text.startsWith('Contrat de prestation de services\n'));
  assert.ok(page.text.endsWith('et le client désigné ci-après.'));
});

test('le nombre de colonnes est rendu', async () => {
  // Docstring : « It says what was found, not what was done ».
  assert.equal((await readText(FACTURE)).pages[0].columns, 3);
  assert.deepEqual((await readText(DEUX_PAGES)).pages.map((p) => p.columns), [2, 1]);
  const scan = (await readText(SCAN)).pages[0];
  assert.equal(scan.columns, 0);
  assert.equal(scan.text, '');
});

test('les bandes sont trouvées par les gouttières', () => {
  const mots = [{ text: 'a', x: 0.0, end: 100.0, y: 0.0 },
    { text: 'b', x: 100.0 + MIN_GUTTER, end: 300.0, y: 0.0 }];
  assert.equal(findColumns(mots).length, 2);
  const serres = [{ text: 'a', x: 0.0, end: 100.0, y: 0.0 },
    { text: 'b', x: 100.0 + MIN_GUTTER - 1, end: 300.0, y: 0.0 }];
  assert.equal(findColumns(serres).length, 1);
  assert.deepEqual(findColumns([]), []);
});

test("chaque page est lue, et l'appelant peut en choisir", async () => {
  assert.deepEqual((await readText(DEUX_PAGES)).pages.map((p) => p.page), [1, 2]);
  assert.deepEqual((await readText(DEUX_PAGES, { pages: [2] })).pages.map((p) => p.page), [2]);
});

test("un fichier qui n'est pas un PDF donne une raison", async () => {
  const rapport = await readText(Buffer.from("ceci n'est pas un PDF"));
  assert.deepEqual(rapport.pages, []);
  // R14 : la raison dit ce que le code a constaté, et elle porte l'erreur que
  // la bibliothèque a rendue.
  assert.ok(rapport.reason.startsWith('this file could not be opened as a PDF: '));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, un contrat d'une page", async () => {
  const page = (await readText(PROSE)).pages[0];
  assert.ok(page.text.includes('société Exemple SAS'));
  assert.equal(page.columns, 1);
});

test('production : entrée vide', async () => {
  const vide = await readText(Buffer.alloc(0));
  assert.deepEqual(vide.pages, []);
  assert.notEqual(vide.reason, null);
});

test('production : entrée très grande et terminaison rapide', () => {
  const mots = Array.from({ length: 10_000 }, (unused, i) => ({
    text: `m${i}`, x: (i % 40) * 13.0, end: (i % 40) * 13.0 + 10, y: -Math.floor(i / 40) * 12.0,
  }));
  const debut = performance.now();
  const bandes = findColumns(mots);
  assert.ok(performance.now() - debut < 30_000);
  assert.equal(bandes.length, 1);
});

test('production : encodages inattendus', async () => {
  const texte = (await readText(PROSE)).pages[0].text;
  assert.ok(texte.includes('société'));
  assert.ok(texte.includes('siège'));
  const mots = [{ text: 'corps', x: 57.0, end: 200.0, y: 0.0 },
    { text: '42', x: 520.0, end: 530.0, y: 0.0 }];
  assert.equal(findColumns(mots).length, 2);
});

test('production : valeurs aux limites', () => {
  assert.deepEqual(findColumns([{ text: 'seul', x: 10.0, end: 40.0, y: 0.0 }]), [[10, 41]]);
  assert.equal(SAME_LINE, 3.0);
});

test("production : une page illisible n'empêche pas de lire les autres", async () => {
  const lot = [PROSE, Buffer.from('pas un PDF'), COLONNES, SCAN];
  const vus = [];
  for (const p of lot) vus.push((await readText(p)).pages.length);
  assert.deepEqual(vus, [1, 0, 1, 1]);
});

test('production : la lecture tient la classe de latence annoncée', async () => {
  const debut = performance.now();
  for (let i = 0; i < 100; i += 1) await readText(COLONNES);
  assert.ok(performance.now() - debut < 60_000);
});
