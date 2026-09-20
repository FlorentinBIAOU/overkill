/**
 * check-longueur-rupture compte des phrases et des mots ; tout le contrôle
 * tient sur l'exactitude de ces deux comptes. Ils sont testés ici sur les cas
 * qui les font se tromper — l'abréviation entre guillemets, la ponctuation
 * détachée du français, le texte d'une seule phrase sans point final — puis le
 * contrôle entier est lancé sur un contenu jetable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  compterPhrases,
  compterMots,
  pointsDeRupture,
  MAX_PHRASES,
  MAX_MOTS,
} from '../scripts/check-longueur-rupture.mjs';

test('R11 est bien deux phrases et soixante mots', () => {
  assert.equal(MAX_PHRASES, 2);
  assert.equal(MAX_MOTS, 60);
});

test('une phrase sans point final compte pour une', () => {
  assert.equal(compterPhrases('Le motif syslog rejette toutes les lignes du fichier'), 1);
});

test('deux phrases séparées par un point comptent pour deux', () => {
  assert.equal(compterPhrases('Le motif rejette tout. Le témoin est dans le même test.'), 2);
});

test('l’abréviation « M. » entre guillemets ne coupe pas la phrase', () => {
  // Le point y est suivi d'un guillemet fermant, pas d'un début de phrase.
  const texte = 'La même phrase avec « M. » devant donne une personne, et le témoin le montre.';
  assert.equal(compterPhrases(texte), 1);
});

test('un point de suspension en fin de citation compte une fin de phrase', () => {
  assert.equal(compterPhrases('Il rend « rien n’a été extrait… » Le témoin dit autre chose.'), 2);
});

test('le tiret cadratin isolé n’est pas un mot', () => {
  assert.equal(compterMots('Un CSV — sans en-tête — revient non reconnu'), 7);
});

test('les guillemets français collés au mot ne le dédoublent pas', () => {
  assert.equal(compterMots('Le rapport rend « photo.jpeg » non reconnu'), 6);
});

test('pointsDeRupture lit les deux langues de chaque niveau disponible', () => {
  const points = pointsDeRupture({
    id: 'fiche-jetable',
    rungs: [
      { level: 'N0', breaking_point: { fr: 'Court.', en: 'Short.' } },
      { level: 'N1', unavailable_reason: { fr: 'x', en: 'y' } },
    ],
  });
  assert.deepEqual(
    points.map((p) => p.cle),
    ['fiche-jetable#N0.fr', 'fiche-jetable#N0.en'],
  );
});

// ------------------------------------------------- le contrôle, bout en bout

const RACINE = process.cwd();

/** Monte un `content/entries` jetable et y lance le contrôle réel. */
function lancer(fiches, dette) {
  const dir = mkdtempSync(join(tmpdir(), 'overkill-rupture-'));
  const detteReelle = readFileSync(join(RACINE, 'scripts/dette-rupture.json'), 'utf8');
  try {
    mkdirSync(join(dir, 'content/entries'), { recursive: true });
    for (const [nom, corps] of Object.entries(fiches)) {
      writeFileSync(join(dir, 'content/entries', nom), corps);
    }
    writeFileSync(join(RACINE, 'scripts/dette-rupture.json'), JSON.stringify({ dette }, null, 2));
    try {
      const sortie = execFileSync(process.execPath, ['scripts/check-longueur-rupture.mjs'], {
        cwd: RACINE,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, OVERKILL_ENTRIES: join(dir, 'content/entries') },
      });
      return { code: 0, sortie };
    } catch (e) {
      return { code: e.status, sortie: (e.stdout ?? '') + (e.stderr ?? '') };
    }
  } finally {
    writeFileSync(join(RACINE, 'scripts/dette-rupture.json'), detteReelle);
    rmSync(dir, { recursive: true, force: true });
  }
}

const fiche = (id, bpFr, bpEn = 'Short. Witness.') => `---
id: ${id}
status: published
rungs:
  - level: N0
    breaking_point:
      fr: ${JSON.stringify(bpFr)}
      en: ${JSON.stringify(bpEn)}
---
`;

const TROP_LONG =
  'Le motif syslog livré rejette toutes les lignes ordinaires du fichier de journal, ' +
  'parce qu’il exige une priorité entre chevrons que la plupart des démons n’écrivent ' +
  'pas quand ils passent par le socket local, et il rend donc un rapport vide sur un ' +
  'fichier que tout le monde considère comme parfaitement normal, ce qui est exactement ' +
  'le genre de silence que ce catalogue reproche aux modèles génératifs de produire.';

test('un dépassement absent de la dette fait échouer', () => {
  const r = lancer({ 'a.mdx': fiche('a', TROP_LONG) }, []);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /a#N0\.fr/);
  assert.match(r.sortie, /R11 en autorise 2 et 60/);
});

test('un dépassement déclaré dans la dette passe', () => {
  const r = lancer({ 'a.mdx': fiche('a', TROP_LONG) }, ['a#N0.fr']);
  assert.equal(r.code, 0);
  assert.match(r.sortie, /1 encore en dette/);
});

test('une ligne de dette dont le point de rupture est rentré dans la limite fait échouer', () => {
  const r = lancer({ 'a.mdx': fiche('a', 'Court, et le témoin passe.') }, ['a#N0.fr']);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /dette périmée/);
});

test('une ligne de dette qui ne désigne plus rien fait échouer', () => {
  const r = lancer({ 'a.mdx': fiche('a', 'Court, et le témoin passe.') }, ['disparue#N0.fr']);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /ne désigne plus aucun point de rupture publié/);
});

test('une fiche en brouillon n’est pas regardée', () => {
  const brouillon = fiche('a', TROP_LONG).replace('status: published', 'status: draft');
  const r = lancer({ 'a.mdx': brouillon }, []);
  assert.equal(r.code, 0);
});

test('trois phrases courtes font échouer, même sous soixante mots', () => {
  const r = lancer({ 'a.mdx': fiche('a', 'Un. Deux. Trois.') }, []);
  assert.equal(r.code, 1);
  assert.match(r.sortie, /3 phrase\(s\)/);
});
