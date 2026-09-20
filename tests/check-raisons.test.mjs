/**
 * check-raisons lit du Python et du JavaScript sans analyseur syntaxique : sa
 * seule fragilité est le découpage. Les tests ci-dessous portent sur les cas
 * qui le mettent en défaut — l'apostrophe dans un commentaire, le littéral
 * d'expression régulière qui contient un guillemet, le gabarit dont
 * l'interpolation contient un autre gabarit — puis sur ce que le contrôle
 * reconnaît comme une raison.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { decouper, estProse, fragments, porteurs, raisonsDe, CHAMPS } from '../scripts/check-raisons.mjs';

const chaines = (src, py) => decouper(src, py).filter((m) => m.type === 'chaine').map((m) => m.valeur);

test('les six champs de sortie sont ceux que le relecteur nomme', () => {
  assert.deepEqual(CHAMPS, ['reason', 'why', 'evidence', 'skipped', 'source', 'strategy']);
});

test('une apostrophe dans un commentaire JavaScript ne déséquilibre pas le découpage', () => {
  const src = "// l'appelant lit la raison\nconst r = { reason: 'the base is not an address' };\n";
  assert.deepEqual(chaines(src, false), ['the base is not an address']);
});

test('une apostrophe dans un commentaire Python ne déséquilibre pas le découpage', () => {
  const src = "# ce qu'on rend\nr = {\"reason\": \"the base is not an address\"}\n";
  assert.deepEqual(chaines(src, true), ['reason', 'the base is not an address']);
});

test('une expression régulière qui contient un guillemet n’est pas lue comme une chaîne', () => {
  const src = "const q = /['\"]/g;\nconst r = { reason: 'not an address' };\n";
  assert.deepEqual(chaines(src, false), ['not an address']);
});

test('une division ne passe pas pour une expression régulière', () => {
  const src = "const part = inside / total;\nconst r = { reason: 'nothing to read here' };\n";
  assert.deepEqual(chaines(src, false), ['nothing to read here']);
});

test('un gabarit imbriqué dans une interpolation ne coupe pas la chaîne', () => {
  const src = "const r = { reason: `declare a convention among [${noms.map((n) => `'${n}'`).join(', ')}]` };\n";
  assert.deepEqual(chaines(src, false), ['declare a convention among [${}]']);
});

test('une docstring Python n’est pas une chaîne du code', () => {
  const src = '"""Ce que fait le module."""\nr = {"reason": "this page is a list of links"}\n';
  assert.deepEqual(chaines(src, true), ['reason', 'this page is a list of links']);
});

test('fragments rend les morceaux constants, sans les trous d’interpolation', () => {
  assert.deepEqual(fragments('expected text, not ${typeof text}'), ['expected text, not']);
  assert.deepEqual(fragments('a file is bytes, not {type(data).__name__}'), ['a file is bytes, not']);
});

test('estProse écarte les motifs, les clés et les chemins', () => {
  assert.equal(estProse('this page is a list of links, not an article'), true);
  assert.equal(estProse('application/pdf'), false);
  assert.equal(estProse('^[0-9]{2}\\s?[A-Z]{3}$'), false);
  assert.equal(estProse('ok'), false);
});

test('porteurs reconnaît un passe-plat dont un paramètre est un champ de sortie', () => {
  assert.deepEqual(
    [...porteurs('def _report(title, text, reason):\n    pass\n', true)],
    [['_report', [2]]],
  );
  assert.deepEqual(
    [...porteurs('const report = (title, text, reason) => ({});\n', false)],
    [['report', [2]]],
  );
});

test('une raison passée par un passe-plat est reconnue', () => {
  const src = [
    'def _report(title, text, reason):',
    '    return {"title": title, "text": text, "reason": reason}',
    '',
    'def lire(html):',
    '    return _report(None, "", "this page is a list of links, not an article")',
    '',
  ].join('\n');
  assert.deepEqual([...raisonsDe(src, true)], ['this page is a list of links, not an article']);
});

test('un message d’exception n’est pas une raison', () => {
  const src = 'def lire(x):\n    raise TypeError("expected a string, not something else")\n';
  assert.deepEqual([...raisonsDe(src, true)], []);
});

// ------------------------------------------------- le contrôle, bout en bout

const RACINE = process.cwd();

/** Monte un `content/snippets` jetable et y lance le contrôle réel. */
function lancer(fichiers, dette) {
  const dir = mkdtempSync(join(tmpdir(), 'overkill-raisons-'));
  const detteReelle = readFileSync(join(RACINE, 'scripts/dette-raisons.json'), 'utf8');
  try {
    mkdirSync(join(dir, 'snippets/fiche-jetable'), { recursive: true });
    for (const [nom, corps] of Object.entries(fichiers)) {
      writeFileSync(join(dir, 'snippets/fiche-jetable', nom), corps);
    }
    writeFileSync(join(RACINE, 'scripts/dette-raisons.json'), JSON.stringify({ dette }, null, 2));
    try {
      const sortie = execFileSync(process.execPath, ['scripts/check-raisons.mjs'], {
        cwd: RACINE,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, OVERKILL_SNIPPETS: join(dir, 'snippets') },
      });
      return { code: 0, sortie };
    } catch (e) {
      return { code: e.status, sortie: (e.stdout ?? '') + (e.stderr ?? '') };
    }
  } finally {
    writeFileSync(join(RACINE, 'scripts/dette-raisons.json'), detteReelle);
    rmSync(dir, { recursive: true, force: true });
  }
}

const EXTRAIT = 'def lire(x):\n    return {"reason": "this page is a list of links, not an article"}\n';

test('une raison qu’aucun test ne cite fait échouer', () => {
  const r = lancer({ 'n0.py': EXTRAIT, 'n0.test.py': 'def test_rien():\n    assert True\n' }, []);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /this page is a list of links, not an article/);
});

test('une raison citée mot pour mot par un test passe', () => {
  const test0 = 'def test_raison():\n    assert lire(1)["reason"] == "this page is a list of links, not an article"\n';
  const r = lancer({ 'n0.py': EXTRAIT, 'n0.test.py': test0 }, []);
  assert.equal(r.code, 0);
});

test('une fiche en dette ne fait pas échouer', () => {
  const r = lancer({ 'n0.py': EXTRAIT, 'n0.test.py': 'def test_rien():\n    assert True\n' }, ['fiche-jetable']);
  assert.equal(r.code, 0);
  assert.match(r.sortie, /1 fiche\(s\) encore en dette/);
});

test('une fiche en dette dont toutes les raisons sont testées fait échouer', () => {
  const test0 = 'def test_raison():\n    assert lire(1)["reason"] == "this page is a list of links, not an article"\n';
  const r = lancer({ 'n0.py': EXTRAIT, 'n0.test.py': test0 }, ['fiche-jetable']);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /dette périmée/);
});
