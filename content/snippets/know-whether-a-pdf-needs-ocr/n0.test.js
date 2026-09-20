import test from 'node:test';
import assert from 'node:assert/strict';

import { ENTETE_SCAN, MIXTE, MOJIBAKE, NUMERIQUE, NUMERO_PAGE, SCAN, VIDE } from './fixtures.mjs';
import { triagePages } from './n0.js';

/** Le texte de chaque page, tel que N0 le lit, pour les assertions de citation. */
async function pagesDe(pdf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), isEvalSupported: false }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- pdf.js hands pages out one at a time
    const content = await (await doc.getPage(i)).getTextContent();
    out.push(content.items.map((item) => item.str ?? '').join(''));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une couche texte illisible compte comme du texte', async () => {
  const plan = await triagePages(MOJIBAKE);
  assert.deepEqual(plan.pages, [{ page: 1, characters: 183, images: 0, verdict: 'text' }]);
  assert.deepEqual(plan.readable, [1]);
  assert.deepEqual(plan.needs_ocr, []);
  assert.ok((await pagesDe(MOJIBAKE))[0].startsWith('#$%&!*+,-./0123456'));
});

test('point de rupture : témoin, une vraie page de texte est rangée pareil', async () => {
  const plan = await triagePages(NUMERIQUE);
  assert.deepEqual(plan.pages.map((p) => p.verdict), ['text', 'text']);
  assert.deepEqual(plan.readable, [1, 2]);
  const casse = await triagePages(MOJIBAKE);
  // Le chiffre publié dans le point de rupture, asserté à l'unité.
  assert.equal(plan.pages[0].characters, 224);
  assert.equal(casse.pages[0].characters, 183);
  assert.ok(Math.abs(plan.pages[0].characters - casse.pages[0].characters) < 60);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la décision est prise page par page', async () => {
  const plan = await triagePages(MIXTE);
  assert.deepEqual(plan.pages.map((p) => p.verdict), ['text', 'scan', 'text']);
  assert.deepEqual(plan.needs_ocr, [2]);
  assert.deepEqual(plan.readable, [1, 3]);
});

test('un scan qui porte un en-tête en vrai texte reste un scan', async () => {
  const page = (await triagePages(ENTETE_SCAN)).pages[0];
  assert.deepEqual([page.characters, page.images], [28, 1]);
  assert.equal(page.verdict, 'scan');
  // La règle « y a-t-il du texte » — celle d'un seuil bas — le déclare lisible.
  const bas = await triagePages(ENTETE_SCAN, { minCharacters: 24 });
  assert.equal(bas.pages[0].verdict, 'text');
  // Témoin : au seuil de la fiche, une vraie page de texte reste lisible.
  assert.equal((await triagePages(NUMERIQUE)).pages[0].verdict, 'text');
});

test("une page sans texte et sans image n'est pas envoyée à l'OCR", async () => {
  const vide = await triagePages(VIDE);
  assert.deepEqual(vide.unreadable, [1]);
  assert.deepEqual(vide.needs_ocr, []);
  assert.deepEqual((await triagePages(NUMERO_PAGE)).pages[0], {
    page: 1, characters: 3, images: 0, verdict: 'blank',
  });
});

test("un scan sans aucun texte part à l'OCR", async () => {
  const plan = await triagePages(SCAN);
  assert.deepEqual(plan.needs_ocr, [1, 2]);
  assert.deepEqual(plan.pages.map((p) => p.characters), [0, 0]);
  assert.deepEqual(plan.pages.map((p) => p.images), [1, 1]);
});

test('le seuil est réglable et son effet est visible', async () => {
  assert.deepEqual((await triagePages(ENTETE_SCAN, { minCharacters: 1 })).readable, [1]);
  assert.deepEqual((await triagePages(ENTETE_SCAN, { minCharacters: 120 })).needs_ocr, [1]);
  assert.deepEqual((await triagePages(NUMERIQUE, { minCharacters: 1000 })).unreadable, [1, 2]);
});

test("un fichier qui n'est pas un PDF donne une raison, pas une exception", async () => {
  const plan = await triagePages(Buffer.from("ceci n'est pas un PDF"));
  assert.deepEqual(plan.pages, []);
  assert.ok(plan.reason.startsWith('this file could not be opened as a PDF'));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, un lot de documents reçus', async () => {
  const plans = [];
  for (const document of [NUMERIQUE, SCAN, MIXTE, ENTETE_SCAN]) {
    plans.push(await triagePages(document));
  }
  assert.deepEqual(plans.map((p) => p.pages.length), [2, 2, 3, 1]);
  assert.equal(plans.reduce((n, p) => n + p.needs_ocr.length, 0), 4);
  assert.equal(plans.reduce((n, p) => n + p.readable.length, 0), 4);
});

test('production : entrée vide', async () => {
  const plan = await triagePages(Buffer.alloc(0));
  assert.deepEqual(plan.pages, []);
  assert.ok(plan.reason.startsWith('this file could not be opened as a PDF'));
});

test('production : entrée malveillante, un PDF tronqué', async () => {
  for (const coupe of [10, 200, Math.floor(MIXTE.length / 2), MIXTE.length - 1]) {
    const plan = await triagePages(MIXTE.subarray(0, coupe));
    assert.ok(Array.isArray(plan.pages));
    assert.ok(plan.reason === null || plan.reason.startsWith('this file'));
  }
});

test('production : valeurs aux limites', async () => {
  const { characters } = (await triagePages(ENTETE_SCAN)).pages[0];
  assert.equal(
    (await triagePages(ENTETE_SCAN, { minCharacters: characters })).pages[0].verdict, 'text',
  );
  assert.equal(
    (await triagePages(ENTETE_SCAN, { minCharacters: characters + 1 })).pages[0].verdict, 'scan',
  );
  assert.deepEqual((await triagePages(VIDE, { minCharacters: 0 })).readable, [1]);
});

test("production : un document illisible dans un lot n'empêche pas les autres", async () => {
  const plans = [];
  for (const document of [NUMERIQUE, Buffer.from('pas un PDF'), SCAN]) {
    plans.push(await triagePages(document));
  }
  assert.deepEqual(plans.map((p) => p.pages.length), [2, 0, 2]);
  assert.notEqual(plans[1].reason, null);
});

test('production : le tri tient la classe de latence annoncée', async () => {
  const debut = performance.now();
  for (let i = 0; i < 100; i += 1) await triagePages(MIXTE);
  assert.ok(performance.now() - debut < 60_000);
});
