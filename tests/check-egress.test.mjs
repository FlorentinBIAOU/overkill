/**
 * check-egress confronte le badge `data_egress` au code qu'il décrit. Ce qu'il
 * doit surtout savoir faire est distinguer une adresse qu'on appelle d'une
 * adresse qui n'est qu'un identifiant : un espace de noms XML et un domaine
 * d'exemple réservé par la RFC 2606 ne sont pas des connexions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sortiesDe } from '../scripts/check-egress.mjs';

const noms = (src) => sortiesDe(src).map((s) => s.nom);

test('une adresse de service tiers est une sortie', () => {
  assert.deepEqual(noms('const URL = "https://api.pwnedpasswords.com/range/";'), ['adresse HTTP']);
});

test('les primitives réseau des deux langages sont des sorties', () => {
  assert.deepEqual(noms('import urllib.request\n'), ['urllib.request']);
  assert.deepEqual(noms('const r = await fetch(url);\n'), ['fetch']);
  assert.deepEqual(noms('import socket\n'), ['socket']);
});

test('un espace de noms XML n’est pas une connexion', () => {
  assert.deepEqual(noms('svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");'), []);
});

test('un domaine d’exemple réservé par la RFC 2606 n’est pas une connexion', () => {
  assert.deepEqual(noms('const SPAM = /https?:\\/\\/example\\.com/;'), []);
  assert.deepEqual(noms('LIEN = "http://example.com/offre"'), []);
});

test('un mot qui contient « socket » n’est pas un import de socket', () => {
  assert.deepEqual(noms('const websocketLike = 1; // import socketry\n'), []);
});

// ------------------------------------------------- le contrôle, bout en bout

const RACINE = process.cwd();

function lancer(code, egress, dette) {
  const dir = mkdtempSync(join(tmpdir(), 'overkill-egress-'));
  const detteReelle = readFileSync(join(RACINE, 'scripts/dette-egress.json'), 'utf8');
  try {
    mkdirSync(join(dir, 'entries'), { recursive: true });
    mkdirSync(join(dir, 'snippets/fiche-jetable'), { recursive: true });
    writeFileSync(join(dir, 'snippets/fiche-jetable/n0.py'), code);
    writeFileSync(
      join(dir, 'entries/fiche-jetable.mdx'),
      [
        '---',
        'id: fiche-jetable',
        'status: published',
        'rungs:',
        '  - level: N0',
        '    available: true',
        '    risks:',
        `      data_egress: ${egress}`,
        '    code:',
        '      python: snippets/fiche-jetable/n0.py',
        '---',
        '',
      ].join('\n'),
    );
    writeFileSync(join(RACINE, 'scripts/dette-egress.json'), JSON.stringify({ dette }, null, 2));
    try {
      const sortie = execFileSync(process.execPath, ['scripts/check-egress.mjs'], {
        cwd: RACINE,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          OVERKILL_ENTRIES: join(dir, 'entries'),
          OVERKILL_CONTENT: dir,
        },
      });
      return { code: 0, sortie };
    } catch (e) {
      return { code: e.status, sortie: (e.stdout ?? '') + (e.stderr ?? '') };
    }
  } finally {
    writeFileSync(join(RACINE, 'scripts/dette-egress.json'), detteReelle);
    rmSync(dir, { recursive: true, force: true });
  }
}

const APPELLE = 'import urllib.request\n\ndef verifier(mot):\n    return urllib.request.urlopen("https://api.exemple.fr/x")\n';
const LOCAL = 'def verifier(mot):\n    return len(mot) >= 12\n';

test('« none » sur un niveau qui appelle un service fait échouer', () => {
  const r = lancer(APPELLE, 'none', []);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /urllib\.request/);
});

test('« third-party » sur le même code passe', () => {
  const r = lancer(APPELLE, 'third-party', []);
  assert.equal(r.code, 0);
});

test('« none » sur un niveau qui n’ouvre rien passe', () => {
  const r = lancer(LOCAL, 'none', []);
  assert.equal(r.code, 0);
});

test('une fiche en dette ne fait pas échouer, et sa dette périme quand elle est en règle', () => {
  assert.equal(lancer(APPELLE, 'none', ['fiche-jetable']).code, 0);
  const remis = lancer(LOCAL, 'none', ['fiche-jetable']);
  assert.equal(remis.code, 1);
  assert.match(remis.sortie, /dette périmée/);
});
