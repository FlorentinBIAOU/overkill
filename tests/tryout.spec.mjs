/**
 * Contrôles de la zone d'essai, au navigateur, sur toutes les fiches qui en
 * ont une.
 *
 * Le contrôle est piloté par le contenu : il lit `content/tryouts/` et visite
 * la fiche correspondante. Un essai ajouté est donc automatiquement vérifié,
 * et un essai qui ne s'affiche pas fait échouer la construction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { serve } from '../scripts/shot.mjs';

async function ids(dossier) {
  try {
    return (await readdir(`content/tryouts/${dossier}`))
      .filter((f) => f.endsWith('.js'))
      .map((f) => f.slice(0, -3))
      .sort();
  } catch {
    return [];
  }
}

const LIVE = await ids('live');
const FROZEN = await ids('frozen');

const serveur = await serve();
const BASE = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();

test.after(async () => {
  await navigateur.close();
  serveur.close();
});

async function ouvrir(chemin) {
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
  return { page, erreurs };
}

test('au moins un essai interactif et un essai figé existent', () => {
  assert.ok(LIVE.length > 0, 'aucun essai interactif');
  assert.ok(FROZEN.length > 0, 'aucun essai figé');
});

for (const id of LIVE) {
  test(`essai interactif — ${id}`, async () => {
    const { page, erreurs } = await ouvrir(`/fr/fiches/${id}`);
    const zone = page.locator('[data-tryout]');
    assert.equal(await zone.count(), 1, 'une seule zone d’essai par fiche');

    // Le module a pris la main : sans cela, les boutons resteraient inertes.
    await zone.first().waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => document.querySelector('[data-tryout]')?.dataset.enhanced === 'true',
      null,
      { timeout: 5000 },
    );

    // Le résultat est annoncé aux lecteurs d'écran, il ne change pas en
    // silence sous le champ.
    assert.equal(
      await page.locator('[data-tryout-result]').getAttribute('aria-live'),
      'polite',
    );

    const avant = await page.locator('[data-tryout-result]').innerText();
    assert.ok(avant.trim().length > 0, 'le premier cas doit déjà afficher un résultat');

    // Un cas qui échoue, et son mot d'explication.
    const casQuiEchoue = page.locator('.tryout__case--fails').first();
    assert.ok(
      (await casQuiEchoue.count()) > 0,
      'un essai doit porter au moins un cas qui échoue (lot 14, partie 1.2)',
    );
    await casQuiEchoue.click();
    await page.waitForTimeout(250);
    const casse = page.locator('[data-tryout-why]');
    assert.ok(await casse.isVisible(), 'le cas qui échoue doit dire pourquoi');
    assert.ok(
      (await casse.innerText()).trim().length > 20,
      'l’explication du cas qui échoue ne peut pas être vide',
    );

    // La saisie libre : le résultat suit ce qu'on tape.
    const boutons = await page.locator('[data-tryout-case]').count();
    assert.ok(boutons >= 3, `${id} : trois ou quatre exemples cliquables attendus`);

    await page.fill('[data-tryout-input]', await page.inputValue('[data-tryout-input]') + ' ');
    await page.waitForTimeout(250);
    assert.deepEqual(erreurs, [], `erreurs de console sur /fr/fiches/${id}`);
    await page.close();
  });
}

for (const id of FROZEN) {
  test(`essai figé — ${id}`, async () => {
    const { page, erreurs } = await ouvrir(`/fr/fiches/${id}`);
    const cas = page.locator('.tryout__frozen-case');
    const n = await cas.count();
    assert.ok(n >= 5 && n <= 6, `${id} : cinq à six cas attendus, ${n} trouvés`);
    assert.equal(
      await page.locator('[data-tryout]').count(),
      0,
      'un essai figé ne déclare pas de zone interactive',
    );
    assert.ok(
      (await page.locator('.tryout__frozen-case--fails').count()) > 0,
      'un essai figé doit porter au moins un cas qui échoue',
    );
    assert.deepEqual(erreurs, [], `erreurs de console sur /fr/fiches/${id}`);
    await page.close();
  });
}
