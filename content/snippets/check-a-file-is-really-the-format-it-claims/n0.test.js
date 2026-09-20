import test from 'node:test';
import assert from 'node:assert/strict';

import { HEAD, MIN_BYTES, sniffFile } from './n0.js';

const hex = (s) => Buffer.from(s, 'hex');
const b64 = (s) => Buffer.from(s, 'base64');
const texte = (s) => Buffer.from(s, 'utf8');

// Des fichiers minimaux, fabriqués pour ce test. Les archives sont en base64
// parce que le test Python porte exactement les mêmes octets : c'est ce qui
// épingle les deux implémentations l'une à l'autre.
const PNG = Buffer.concat([
  hex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'),
  Buffer.alloc(20),
]);
const JPEG = Buffer.concat([
  hex('ffd8ffe000104a46494600010100000100010000'), Buffer.alloc(20), hex('ffd9'),
]);
const GIF = Buffer.concat([texte('GIF89a'), hex('0100010080000'.padEnd(14, '0')), Buffer.alloc(20)]);
const PDF = texte('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const EXE = Buffer.concat([texte('MZ\u0090\u0000'), Buffer.alloc(60), texte('PE\u0000\u0000')]);
const RTF = texte('{\\rtf1\\ansi\\deff0 Bonjour}');
const SVG = texte(
  '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"'
  + ' width="10" height="10"><rect width="10" height="10"/></svg>',
);
const CSV = texte('nom;prenom;ville\nDupont;Jean;Boulogne-Billancourt\n');
const CSV_BOM = Buffer.concat([hex('efbbbf'), CSV]);
const JSON_FILE = texte('{"nom": "Dupont"}');
const TXT = texte('Bonjour, ceci est une note.\n');

const ZIP = b64(
  'UEsDBBQAAAAIAEMhNF3I8LalCQAAAAcAAAAJAAAAbm90ZXMudHh0S8rPy8ovLQIAUEsBAhQDFAAAAAgAQyE0Xc'
  + 'jwtqUJAAAABwAAAAkAAAAAAAAAAAAAAIABAAAAAG5vdGVzLnR4dFBLBQYAAAAAAQABADcAAAAwAAAAAAA=');
const DOCX = b64(
  'UEsDBBQAAAAIAEMhNF3GEnoHrAAAAPEAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbF2Puw7CMAxFf6XKihoXBg'
  + 'aUlIEdGPgBK3HbiOahJBT4exKQOjBax/dcWxxfdm4Wisl4J9mWd+zYi9s7UGoKcUmyKedwAEhqIouJ+0CukMFH'
  + 'i7mMcYSA6o4jwa7r9qC8y+Rym6uD9eJS5NFoaq4Y8xktSQZPHzVorx62bPJiY83pF6vNkmEIs1GYy02wOP3X2f'
  + 'phMIrWfLWF6BWlZNxoZ74Si8Ztqh56Ad+n+g9QSwMEFAAAAAgAQyE0Xd1ahg0PAAAADQAAABEAAAB3b3JkL2Rv'
  + 'Y3VtZW50LnhtbLMpt0rJTy7NTc0r0bcDAFBLAQIUAxQAAAAIAEMhNF3GEnoHrAAAAPEAAAATAAAAAAAAAAAAAA'
  + 'CAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAQyE0Xd1ahg0PAAAADQAAABEAAAAAAAAAAAAA'
  + 'AIAB3QAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAACAAIAgAAAABsBAAAAAA==');
const XLSX = b64(
  'UEsDBBQAAAAIAEMhNF10vYL2rgAAAOkAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbF2PsQ7CMAxEf6XKihoXBg'
  + 'bUloEdGPgBk7o0ahNHiSnl70lhYzpZp3t3ro+Lm4qZYrLsG7XVlTq29e0dKBXZ8alRg0g4ACQzkMOkOZDPTs/R'
  + 'oeQzPiCgGfFBsKuqPRj2Ql5KWRmqrS8ZHm1HxRWjnNFRo2CZ4MVxvDOPOrNUcfqF1t5GYQiTNSh5Ecy++2ssue'
  + '+toY7N0+WITiESdmkgEjfpr2qH1m9WMLQ1fJ9pP1BLAwQUAAAACABDITRdzp6YEw0AAAALAAAADwAAAHhsL3dv'
  + 'cmtib29rLnhtbLMpzy/KTsrPz9a3AwBQSwECFAMUAAAACABDITRddL2C9q4AAADpAAAAEwAAAAAAAAAAAAAAgA'
  + 'EAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAxQAAAAIAEMhNF3OnpgTDQAAAAsAAAAPAAAAAAAAAAAAAACA'
  + 'Ad8AAAB4bC93b3JrYm9vay54bWxQSwUGAAAAAAIAAgB+AAAAGQEAAAAA');
const ODT = b64(
  'UEsDBBQAAAAAAEMhNF1exjIMJwAAACcAAAAIAAAAbWltZXR5cGVhcHBsaWNhdGlvbi92bmQub2FzaXMub3Blbm'
  + 'RvY3VtZW50LnRleHRQSwMEFAAAAAgAQyE0XTFGq2oaAAAAGgAAAAsAAABjb250ZW50LnhtbLPJT0vLTE61Ssl'
  + 'PLs1NzSvRTc7PKwHS+nYAUEsBAhQDFAAAAAAAQyE0XV7GMgwnAAAAJwAAAAgAAAAAAAAAAAAAAIABAAAAAG1p'
  + 'bWV0eXBlUEsBAhQDFAAAAAgAQyE0XTFGq2oaAAAAGgAAAAsAAAAAAAAAAAAAAIABTQAAAGNvbnRlbnQueG1sUE'
  + 'sFBgAAAAACAAIAbwAAAJAAAAAAAA==');

const RECONNUS = {
  png: PNG, jpg: JPEG, gif: GIF, pdf: PDF, exe: EXE, rtf: RTF,
  zip: ZIP, docx: DOCX, xlsx: XLSX, odt: ODT,
};
const SANS_SIGNATURE = { csv: CSV, 'csv-bom': CSV_BOM, json: JSON_FILE, txt: TXT, svg: SVG };
const SANS_SIGNATURE_REASON = 'no signature read from the bytes';

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : un fichier texte n'a pas de signature à lire", async () => {
  for (const [nom, octets] of Object.entries(SANS_SIGNATURE)) {
    const rapport = await sniffFile(octets, { claimedName: 'clients.csv', allowed: ['csv'] });
    assert.equal(rapport.detected, null, nom);
    assert.equal(rapport.reason, SANS_SIGNATURE_REASON, nom);
    assert.equal(rapport.matches_claim, null, nom);
    assert.equal(rapport.allowed, false, nom);
  }
});

test('point de rupture : témoin, les formats binaires sont bien reconnus', async () => {
  for (const [attendu, octets] of Object.entries(RECONNUS)) {
    const rapport = await sniffFile(octets, {
      claimedName: `fichier.${attendu}`, allowed: [attendu],
    });
    assert.equal(rapport.detected, attendu, attendu);
    assert.equal(rapport.matches_claim, true, attendu);
    assert.equal(rapport.allowed, true, attendu);
  }
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('le nom du fichier ne décide jamais', async () => {
  const rapport = await sniffFile(ZIP, {
    claimedName: 'photo-de-profil.png', allowed: ['png', 'jpg'],
  });
  assert.equal(rapport.detected, 'zip');
  assert.equal(rapport.claimed, 'png');
  assert.equal(rapport.matches_claim, false);
  assert.equal(rapport.allowed, false);
  const bon = await sniffFile(PNG, { claimedName: 'photo-de-profil.png', allowed: ['png', 'jpg'] });
  assert.deepEqual([bon.matches_claim, bon.allowed], [true, true]);
});

test("les conteneurs ZIP sont distingués en ouvrant l'archive", async () => {
  for (const archive of [ZIP, DOCX, XLSX, ODT]) {
    assert.equal(archive.subarray(0, 2).toString('latin1'), 'PK');
  }
  assert.equal((await sniffFile(ZIP)).detected, 'zip');
  assert.equal((await sniffFile(DOCX)).detected, 'docx');
  assert.equal((await sniffFile(XLSX)).detected, 'xlsx');
  assert.equal((await sniffFile(ODT)).detected, 'odt');
});

test("un docx n'est pas autorisé par une liste qui n'autorise que zip", async () => {
  assert.equal((await sniffFile(DOCX, { allowed: ['zip'] })).allowed, false);
  assert.equal((await sniffFile(ZIP, { allowed: ['zip'] })).allowed, true);
});

test('un fichier à deux signatures est lu comme sa première', async () => {
  assert.equal((await sniffFile(Buffer.concat([ZIP, PNG]))).detected, 'zip');
  assert.equal((await sniffFile(Buffer.concat([PNG, ZIP]))).detected, 'png');
  assert.equal((await sniffFile(Buffer.concat([PNG, ZIP]), { allowed: ['png'] })).allowed, true);
});

test("un fichier non reconnu n'est jamais autorisé", async () => {
  for (const octets of [CSV, Buffer.alloc(100), texte('??????????')]) {
    const rapport = await sniffFile(octets, { allowed: ['png', 'csv', 'txt'] });
    assert.equal(rapport.allowed, false);
  }
});

test('aucune entrée ne lève', async () => {
  for (const entree of [null, undefined, 0, 'PNG', [], {}]) {
    const rapport = await sniffFile(entree);
    assert.equal(rapport.detected, null);
    assert.equal(typeof rapport.reason, 'string');
    assert.ok(rapport.reason.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, ce qu'on téléverse dans un formulaire", async () => {
  const autorises = ['pdf', 'jpg', 'png', 'docx', 'xlsx', 'odt'];
  for (const [nom, octets, attendu] of [
    ['justificatif.pdf', PDF, 'pdf'],
    ['photo.jpg', JPEG, 'jpg'],
    ['logo.png', PNG, 'png'],
    ['contrat.docx', DOCX, 'docx'],
    ['comptes.xlsx', XLSX, 'xlsx'],
    ['note.odt', ODT, 'odt'],
  ]) {
    const rapport = await sniffFile(octets, { claimedName: nom, allowed: autorises });
    assert.equal(rapport.detected, attendu, nom);
    assert.equal(rapport.matches_claim, true, nom);
    assert.equal(rapport.allowed, true, nom);
  }
});

test('production : entrée vide', async () => {
  const rapport = await sniffFile(Buffer.alloc(0), { claimedName: 'vide.png', allowed: ['png'] });
  assert.equal(rapport.detected, null);
  assert.equal(rapport.reason, 'the file is empty');
  assert.equal(rapport.allowed, false);
});

test('production : entrée très grande et terminaison rapide', async () => {
  const enorme = Buffer.concat([PNG, Buffer.alloc(10_000_000)]);
  const debut = performance.now();
  const rapport = await sniffFile(enorme, { claimedName: 'grande.png', allowed: ['png'] });
  assert.ok(performance.now() - debut < 5000);
  assert.equal(rapport.detected, 'png');
});

test('production : encodages inattendus', async () => {
  assert.equal((await sniffFile(CSV_BOM)).detected, null);
  const rapport = await sniffFile(PNG, {
    claimedName: 'Reçu de janvier.final.PNG', allowed: ['png'],
  });
  assert.equal(rapport.claimed, 'png');
  assert.equal(rapport.matches_claim, true);
  assert.equal((await sniffFile(PNG, { claimedName: 'sans-extension' })).matches_claim, null);
});

test('production : valeurs aux limites', async () => {
  // Un seul octet, puis le plancher de lecture, juste en dessous et juste
  // au-dessus : les deux tables ne lisent pas le même nombre d'octets, et
  // l'extrait refuse en dessous du plus exigeant plutôt que de diverger.
  assert.equal(
    (await sniffFile(hex('89'))).reason,
    `under ${MIN_BYTES} bytes: too short to carry a signature`,
  );
  assert.equal((await sniffFile(PNG.subarray(0, MIN_BYTES - 1))).detected, null);
  assert.equal((await sniffFile(PNG.subarray(0, MIN_BYTES))).detected, 'png');
  const long = Buffer.concat([PNG, Buffer.alloc(HEAD)]);
  assert.equal((await sniffFile(long.subarray(0, HEAD))).detected, 'png');
  assert.equal((await sniffFile(long.subarray(0, HEAD + 1))).detected, 'png');
  assert.equal((await sniffFile(PNG, { allowed: [] })).allowed, false);
});

test("production : un fichier sale dans un lot n'empêche pas les autres", async () => {
  const lot = [PNG, CSV, PDF, Buffer.alloc(0), DOCX];
  const vus = [];
  for (const octets of lot) vus.push((await sniffFile(octets)).detected);
  assert.deepEqual(vus, ['png', null, 'pdf', null, 'docx']);
});

test('production : le contrôle tient la classe de latence annoncée', async () => {
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) {
    await sniffFile(PNG, { claimedName: 'photo.png', allowed: ['png'] });
  }
  assert.ok(performance.now() - debut < 20_000);
});
