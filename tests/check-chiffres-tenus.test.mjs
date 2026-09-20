/**
 * check-chiffres-tenus lit des nombres écrits dans deux conventions — « 6 887 »
 * et « 6,887 » sont le même nombre —, et il doit écarter ce qui n'est pas une
 * mesure. Les deux lectures sont testées ici, puis le contrôle est lancé sur un
 * contenu jetable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { valeurDe, chiffresDe, ecritures } from '../scripts/check-chiffres-tenus.mjs';

const valeurs = (fr) =>
  chiffresDe({ rungs: [{ level: 'N0', breaking_point: { fr } }] }).map((c) => c.valeur);

test('les deux conventions de séparateur donnent le même nombre', () => {
  assert.equal(valeurDe('6 887'), '6887');
  assert.equal(valeurDe('6,887'), '6887');
  assert.equal(valeurDe('1 047 576'), '1047576');
  assert.equal(valeurDe('1 000,00'), '1000.00');
  assert.equal(valeurDe('1,234.56'), '1234.56');
  assert.equal(valeurDe('0,38'), '0.38');
  assert.equal(valeurDe('244.98'), '244.98');
});

test('un pourcentage, un facteur, une décimale et un grand entier sont des mesures', () => {
  assert.deepEqual(valeurs('Le taux monte à 7 % sur ce lot, et le témoin le montre.'), ['7']);
  assert.deepEqual(valeurs('Le nettoyage est 42 fois plus lent que le balayage linéaire.'), ['42']);
  assert.deepEqual(valeurs('Le score descend à 0,897 sur cette paire, et rien ne le rattrape.'), ['0.897']);
  assert.deepEqual(valeurs('Une page de contrat ordinaire en rend 224, le témoin en rend deux.'), ['224']);
});

test('une année et un numéro de norme ne sont pas des mesures', () => {
  assert.deepEqual(valeurs('La réception électronique est obligatoire depuis 2026, et rien ne change.'), []);
  assert.deepEqual(valeurs('Le motif suit la RFC 2822, et le témoin suit la RFC 5322.'), []);
  assert.deepEqual(valeurs('Le paquet est en version 1.4.4, publiée depuis longtemps.'), []);
});

test('le chiffre d’un nom de niveau n’ouvre pas un nombre', () => {
  assert.deepEqual(valeurs('Le N1 rend 1 482 là où le N0 rend 1 254, et les deux se trompent.'), ['1482', '1254']);
});

test('un nombre écrit avec un séparateur se cherche aussi sans lui', () => {
  assert.ok(ecritures({ valeur: '6887', brut: '6 887' }).includes('6887'));
  assert.ok(ecritures({ valeur: '6887', brut: '6 887' }).includes('6 887'));
});

// ------------------------------------------------- le contrôle, bout en bout

const RACINE = process.cwd();

function lancer(fr, test0, dette) {
  const dir = mkdtempSync(join(tmpdir(), 'overkill-chiffres-'));
  const detteReelle = readFileSync(join(RACINE, 'scripts/dette-chiffres.json'), 'utf8');
  try {
    mkdirSync(join(dir, 'entries'), { recursive: true });
    mkdirSync(join(dir, 'snippets/fiche-jetable'), { recursive: true });
    writeFileSync(
      join(dir, 'entries/fiche-jetable.mdx'),
      `---\nid: fiche-jetable\nstatus: published\nrungs:\n  - level: N0\n    breaking_point:\n      fr: ${JSON.stringify(fr)}\n---\n`,
    );
    writeFileSync(join(dir, 'snippets/fiche-jetable/n0.test.py'), test0);
    writeFileSync(join(RACINE, 'scripts/dette-chiffres.json'), JSON.stringify({ dette }, null, 2));
    try {
      const sortie = execFileSync(process.execPath, ['scripts/check-chiffres-tenus.mjs'], {
        cwd: RACINE,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          OVERKILL_ENTRIES: join(dir, 'entries'),
          OVERKILL_SNIPPETS: join(dir, 'snippets'),
        },
      });
      return { code: 0, sortie };
    } catch (e) {
      return { code: e.status, sortie: (e.stdout ?? '') + (e.stderr ?? '') };
    }
  } finally {
    writeFileSync(join(RACINE, 'scripts/dette-chiffres.json'), detteReelle);
    rmSync(dir, { recursive: true, force: true });
  }
}

const PHRASE = 'La clé RIB ferme les 6 887 cas mesurés, et le témoin en laisse passer deux.';

test('un nombre publié qu’aucun test ne porte fait échouer', () => {
  const r = lancer(PHRASE, 'def test_rien():\n    assert True\n', []);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /« 6 887 »/);
});

test('le même nombre écrit sans séparateur dans le test suffit', () => {
  const r = lancer(PHRASE, 'def test_mesure():\n    assert mesurer() == 6887\n', []);
  assert.equal(r.code, 0);
});

test('une fiche en dette ne fait pas échouer', () => {
  const r = lancer(PHRASE, 'def test_rien():\n    assert True\n', ['fiche-jetable']);
  assert.equal(r.code, 0);
  assert.match(r.sortie, /1 fiche\(s\) encore en dette/);
});

test('une fiche en dette dont tous les nombres sont tenus fait échouer', () => {
  const r = lancer(PHRASE, 'def test_mesure():\n    assert mesurer() == 6887\n', ['fiche-jetable']);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /dette périmée/);
});
