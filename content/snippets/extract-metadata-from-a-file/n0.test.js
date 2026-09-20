import test from 'node:test';
import assert from 'node:assert/strict';

import { strToU8, zipSync } from 'fflate';

import { APP_PART, CORE_PART, MAX_PART_BYTES, readDocumentMetadata } from './n0.js';

const CORE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Contrat de prestation</dc:title>
<dc:creator>Marie Martin</dc:creator>
<cp:lastModifiedBy>Jean Dupont</cp:lastModifiedBy>
<cp:revision>7</cp:revision>
<dcterms:created xsi:type="dcterms:W3CDTF">2026-09-14T09:12:00Z</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-10T13:55:00Z</dcterms:modified>
<cp:keywords>devis;2026</cp:keywords>
</cp:coreProperties>`;

const APP = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>Microsoft Office Word</Application>
<AppVersion>16.0000</AppVersion>
<Company>Cabinet Lumi&#232;re</Company>
<Manager>Claire Bernard</Manager>
<Template>contrat-interne.dotx</Template>
<TotalTime>413</TotalTime>
<Pages>3</Pages>
</Properties>`;

const TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="xml" ContentType="application/xml"/></Types>';

const DOC = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
  + '<w:body><w:p><w:r><w:t>Le devis est sign&#233;.</w:t></w:r></w:p></w:body></w:document>';

const COMMENTS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
  + '<w:comment w:id="1" w:author="Claire Bernard" w:date="2026-10-09T18:02:00Z"/>'
  + '</w:comments>';

/** Un document OOXML minimal, mais valide comme conteneur. */
function docx(parts) {
  const entrees = {};
  for (const [nom, contenu] of Object.entries(parts)) {
    entrees[nom] = typeof contenu === 'string' ? strToU8(contenu) : contenu;
  }
  return zipSync(entrees);
}

const BASE = {
  '[Content_Types].xml': TYPES, [CORE_PART]: CORE, [APP_PART]: APP, 'word/document.xml': DOC,
};

const COMPLET = docx(BASE);
const AVEC_COMMENTAIRES = docx({
  ...BASE,
  'word/comments.xml': COMMENTS,
  'word/people.xml': '<people/>',
  'word/settings.xml': '<settings/>',
});
const NU = docx({ '[Content_Types].xml': TYPES, 'word/document.xml': DOC });
const PAS_OOXML = docx({ 'lisezmoi.txt': 'bonjour' });
const CASSE = docx({ '[Content_Types].xml': TYPES, [CORE_PART]: '<cp:coreProperties', 'word/document.xml': DOC });

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : les deux parties lues ne sont pas toutes les métadonnées', () => {
  const rapport = readDocumentMetadata(AVEC_COMMENTAIRES);
  assert.deepEqual(rapport.other_parts,
    ['word/comments.xml', 'word/people.xml', 'word/settings.xml']);
  assert.equal(rapport.fields.manager, 'Claire Bernard'); // celui-là vient de app.xml
  assert.ok(Object.keys(rapport.fields).every((champ) => !champ.includes('comments')));
});

test('point de rupture : témoin, un document sans ces parties le dit', () => {
  assert.deepEqual(readDocumentMetadata(COMPLET).other_parts, []);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('les seize champs déclarés sont lus dans les deux parties', () => {
  const champs = readDocumentMetadata(COMPLET).fields;
  assert.equal(champs.author, 'Marie Martin');
  assert.equal(champs.last_modified_by, 'Jean Dupont');
  assert.equal(champs.revision, '7');
  assert.equal(champs.created, '2026-09-14T09:12:00Z');
  assert.equal(champs.company, 'Cabinet Lumière'); // &#232; décodé
  assert.equal(champs.manager, 'Claire Bernard');
  assert.equal(champs.template, 'contrat-interne.dotx');
  assert.equal(champs.editing_minutes, '413');
});

test("un champ absent n'est pas rendu vide", () => {
  const champs = readDocumentMetadata(COMPLET).fields;
  assert.ok(!('subject' in champs) && !('description' in champs));
});

test("un document sans métadonnées rend un dictionnaire vide, pas une erreur", () => {
  assert.deepEqual(readDocumentMetadata(NU),
    { format: 'ooxml', fields: {}, other_parts: [], reason: null });
});

test("ce qui n'est pas un document est nommé", () => {
  assert.ok(readDocumentMetadata(new Uint8Array([120, 120, 120, 120])).reason.startsWith('not a ZIP'));
  assert.equal(readDocumentMetadata(PAS_OOXML).reason, 'a ZIP, but not an OOXML document');
});

test("une partie illisible n'empêche pas de lire les autres", () => {
  const rapport = readDocumentMetadata(CASSE);
  assert.equal(rapport.format, 'ooxml');
  assert.deepEqual(rapport.fields, {});
  assert.equal(rapport.reason, null);
});

test("une partie qui promet plus que le plafond n'est pas décompressée", () => {
  const gros = docx({
    '[Content_Types].xml': TYPES,
    [CORE_PART]: `<a>${'x'.repeat(MAX_PART_BYTES + 10)}</a>`,
    'word/document.xml': DOC,
  });
  const rapport = readDocumentMetadata(gros);
  assert.equal(rapport.format, 'ooxml');
  assert.deepEqual(rapport.fields, {});
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 42, 'texte', [], {}]) {
    const rapport = readDocumentMetadata(entree);
    assert.deepEqual(rapport.fields, {});
    assert.ok(rapport.reason.startsWith('expected bytes'));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, un contrat envoyé à un client', () => {
  const champs = readDocumentMetadata(COMPLET).fields;
  for (const attendu of ['author', 'last_modified_by', 'manager', 'template']) {
    assert.ok(attendu in champs);
  }
});

test('production : entrée vide', () => {
  assert.ok(readDocumentMetadata(new Uint8Array()).reason.startsWith('not a ZIP'));
});

test('production : entrée très grande et terminaison rapide', () => {
  const gros = docx({ ...BASE, 'word/media/image1.png': new Uint8Array(5_000_000) });
  const debut = performance.now();
  const rapport = readDocumentMetadata(gros);
  assert.ok(performance.now() - debut < 30_000);
  assert.equal(rapport.fields.author, 'Marie Martin');
});

test('production : encodages inattendus', () => {
  const accents = CORE.replace('Marie Martin', 'Ma&#239;a Mart&#237;nez');
  const champs = readDocumentMetadata(docx({
    '[Content_Types].xml': TYPES, [CORE_PART]: accents, 'word/document.xml': DOC,
  })).fields;
  assert.equal(champs.author, 'Maïa Martínez');
});

test('production : valeurs aux limites', () => {
  const vide = CORE.replace('<dc:creator>Marie Martin</dc:creator>', '<dc:creator></dc:creator>');
  const champs = readDocumentMetadata(docx({
    '[Content_Types].xml': TYPES, [CORE_PART]: vide, 'word/document.xml': DOC,
  })).fields;
  assert.ok(!('author' in champs)); // un champ vide n'est pas un champ
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) readDocumentMetadata(COMPLET);
  assert.ok(performance.now() - debut < 20_000);
});
