/**
 * Les deux documents de ce test sont réels, pas fabriqués à la main.
 *
 * `contrat-libreoffice.pdf` est l'export PDF d'un traitement de texte — le cas
 * que le scénario de la fiche donne en exemple, et celui qui fait échouer un
 * lecteur de flux écrit à la main : la police y est un sous-ensemble
 * renuméroté. `scan-image-seule.pdf` est la même page, rendue en image puis
 * remise dans un PDF : aucun caractère, une image plein cadre.
 *
 * Ce que ces tests prouvent : la décision que prend l'extrait, et le rapport
 * qu'il rend. Ce qu'ils ne prouvent pas : que pdf.js lit bien un PDF, ce qui
 * est son affaire et celle de ses propres tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIN_CHARACTERS, readTextLayer } from './n0.js';

const CONTRAT = readFileSync(new URL('./contrat-libreoffice.pdf', import.meta.url));
const SCAN = readFileSync(new URL('./scan-image-seule.pdf', import.meta.url));

// Le début du contrat, tel qu'il est écrit dans le document source.
const PREMIERE_LIGNE = 'Contrat de prestation';

/** Un double à la surface de pdf.js : `getDocument(...).promise`, puis les pages. */
function fauxPdfjs(pages, { lu = [] } = {}) {
  const load = ({ data }) => {
    lu.push(Buffer.from(data.slice(0, 4)).toString());
    return {
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: async (number) => ({
          getTextContent: async () => ({
            items: [{ str: pages[number - 1], hasEOL: false }],
          }),
        }),
      }),
    };
  };
  return load;
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une page scannée ne rend pas une chaîne vide mais un refus', async () => {
  // breaking_point : « une page scannée ne porte aucun caractère, et l'extrait
  // le dit au lieu de rendre une chaîne vide ». Témoin : le même document, avant
  // d'être rendu en image, est lu.
  const rapport = await readTextLayer(SCAN);
  assert.equal(rapport.has_text_layer, false);
  assert.equal(rapport.text, '');
  assert.equal(rapport.characters, 0);
  assert.equal(rapport.pages, 1); // le fichier est valide, et il a bien une page
  assert.equal(rapport.reason, 'no text layer: this page is an image, and needs OCR');
  assert.equal((await readTextLayer(CONTRAT)).has_text_layer, true);
});

test('point de rupture : l’extrait ne lit pas les pixels et ne le prétend pas', async () => {
  // Le rapport nomme l'étape suivante, il ne la fait pas.
  assert.match((await readTextLayer(SCAN)).reason, /needs OCR/);
  // Et rien dans l'extrait ne ressemble à de la reconnaissance : il n'importe
  // qu'un lecteur de PDF, et seulement dans la fonction.
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.match(source, /await import\('pdfjs-dist\/legacy\/build\/pdf\.mjs'\)/);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('lit l’export d’un traitement de texte, polices sous-ensemble comprises', async () => {
  // « two hundred lines that still lose to the first font the file renumbers
  // for itself, which is what a word processor does on every export ».
  const rapport = await readTextLayer(CONTRAT);
  assert.equal(rapport.has_text_layer, true);
  assert.ok(rapport.text.startsWith(PREMIERE_LIGNE));
  assert.ok(rapport.text.includes('Papeterie Lambert'));
  assert.ok(rapport.text.includes('trente jours'));
  assert.equal(rapport.reason, null);
  assert.equal(rapport.pages, 1);
});

test('le rapport porte la décision, le texte, le compte et la raison', async () => {
  const rapport = await readTextLayer(CONTRAT);
  assert.deepEqual(Object.keys(rapport).sort(), ['characters', 'has_text_layer', 'pages', 'reason', 'text']);
  // Le même compte qu'en Python, sur le même document.
  assert.equal(rapport.characters, 233);
});

test('le seuil est paramétrable et range un tampon sous l’image', async () => {
  assert.equal(MIN_CHARACTERS, 24);
  assert.equal((await readTextLayer(CONTRAT, { minCharacters: 233 })).has_text_layer, true);
  const trop = await readTextLayer(CONTRAT, { minCharacters: 234 });
  assert.equal(trop.has_text_layer, false);
  assert.match(trop.reason, /needs OCR$/);
  // Le texte trouvé est rendu quand même : c'est au relecteur de voir.
  assert.ok(trop.text.startsWith(PREMIERE_LIGNE));
});

test('le compte ne retient que les caractères lisibles', async () => {
  const rapport = await readTextLayer(CONTRAT, { load: fauxPdfjs([' \n\t '.repeat(50)]) });
  assert.equal(rapport.characters, 0);
  assert.equal(rapport.has_text_layer, false);
});

test('la bibliothèque est injectée pour le test, et réelle en production', async () => {
  const lu = [];
  const load = fauxPdfjs(['Contrat de prestation, lu par le double, assez long pour passer le seuil.'], { lu });
  assert.equal((await readTextLayer(CONTRAT, { load })).has_text_layer, true);
  assert.deepEqual(lu, ['%PDF']);
  // Par défaut, c'est bien pdf.js qui est chargé, et il lit le même document.
  assert.ok((await readTextLayer(CONTRAT)).text.startsWith(PREMIERE_LIGNE));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : des octets qui ne sont pas un PDF ne lèvent pas', async () => {
  for (const donnees of [Buffer.alloc(0), Buffer.from('pas un pdf'), Buffer.from('%PDF-1.7 tronqué'), CONTRAT.subarray(0, 200)]) {
    const rapport = await readTextLayer(donnees);
    assert.equal(rapport.has_text_layer, false);
    assert.equal(rapport.text, '');
    assert.match(rapport.reason, /could not be opened as a PDF/);
  }
});

test('production : une bibliothèque qui lève en cours de lecture est rapportée', async () => {
  const load = () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({ getTextContent: async () => { throw new Error('font table is broken'); } }),
    }),
  });
  const rapport = await readTextLayer(CONTRAT, { load });
  assert.equal(rapport.has_text_layer, false);
  assert.match(rapport.reason, /font table is broken/);
});

test('production : un document vide de pages', async () => {
  const rapport = await readTextLayer(CONTRAT, { load: fauxPdfjs([]) });
  assert.deepEqual([rapport.pages, rapport.characters, rapport.has_text_layer], [0, 0, false]);
});

test('production : la lecture est déterministe et tient dans une borne large', async () => {
  const debut = performance.now();
  assert.deepEqual(await readTextLayer(CONTRAT), await readTextLayer(CONTRAT));
  assert.ok(performance.now() - debut < 10_000);
});

test('production : les deux documents du test sont ceux qu’ils disent être', () => {
  assert.ok(CONTRAT.subarray(0, 4).toString() === '%PDF' && SCAN.subarray(0, 4).toString() === '%PDF');
  assert.ok(CONTRAT.includes('LibreOffice'));
  assert.ok(SCAN.includes('/Subtype /Image') || SCAN.includes('/Subtype/Image'));
  assert.ok(!CONTRAT.includes('/Subtype /Image') && !CONTRAT.includes('/Subtype/Image'));
});
