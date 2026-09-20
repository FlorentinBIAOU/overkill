/**
 * check-figures attrape les formes chiffrées interdites. Ce qu'il ne savait
 * pas voir, et que le relevé du lot 17 lui reproche, est le facteur de
 * performance : « ×55 » et « ×6 000 » étaient publiés sur une fiche acceptée.
 *
 * Le contrôle est un script, pas une bibliothèque : il se teste comme on
 * l'appelle, sur une arborescence de contenu écrite pour l'occasion, dont la
 * racine lui est passée par `OVERKILL_CONTENU`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Le contrôle lancé sur une fiche d'une seule ligne : sa sortie et son code. */
function controler(corps) {
  const racine = mkdtempSync(join(tmpdir(), 'figures-'));
  mkdirSync(join(racine, 'entries'), { recursive: true });
  writeFileSync(join(racine, 'entries', 'essai.mdx'), `---\ntitle: "Essai"\n---\n\n${corps}\n`);
  try {
    const sortie = execFileSync('node', ['scripts/check-figures.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, OVERKILL_CONTENU: racine },
    });
    return { code: 0, sortie };
  } catch (erreur) {
    return { code: erreur.status, sortie: `${erreur.stdout}${erreur.stderr}` };
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

const refuse = (corps) => controler(corps).code === 1;

test('les quatre écritures d’un facteur sont refusées', () => {
  assert.ok(refuse('Le cache rend la validation ×55 plus économe.'));
  assert.ok(refuse('Le cache la rend 55 fois plus rapide.'));
  assert.ok(refuse('Le cache divise le temps par 55.'));
  assert.ok(refuse('Le cache divise le temps par cinquante-cinq.'));
});

test('le facteur en lettres est refusé dans les deux langues', () => {
  assert.ok(refuse('which divides the time by fifty-five in Python'));
  assert.ok(refuse('which multiplies throughput by six thousand'));
  assert.ok(refuse('ce qui multiplie le débit par six mille'));
});

test('un ordre de grandeur en mots reste autorisé', () => {
  assert.equal(controler('Le cache fait gagner deux ordres de grandeur.').code, 0);
  assert.equal(controler('Le cache fait gagner plusieurs ordres de grandeur.').code, 0);
});

test('une phrase ordinaire où « par » n’introduit pas un nombre passe', () => {
  assert.equal(controler('Le texte se divise par paragraphes, puis par phrases.').code, 0);
  assert.equal(controler('The file is divided by section, then by line.').code, 0);
});

test('le facteur est nommé dans le message d’échec', () => {
  const { code, sortie } = controler('Le cache divise le temps par cinquante-cinq.');
  assert.equal(code, 1);
  assert.match(sortie, /performance non mesurée/);
  assert.match(sortie, /divise le temps par cinquante-cinq/);
});

test('les autres formes interdites sont toujours vues', () => {
  assert.ok(refuse('Le service coûte 12 €.'));
  assert.ok(refuse('Le modèle atteint 92 % de précision.'));
  assert.ok(refuse('Le fichier pèse 42 Mo.'));
});

test('le contenu publié du dépôt ne porte aucun chiffre interdit', () => {
  const sortie = execFileSync('node', ['scripts/check-figures.mjs'], { encoding: 'utf8' });
  assert.match(sortie, /check-figures : OK/);
});
