/**
 * Le catalogue paginé : sans JavaScript, avec, et la combinaison des deux avec
 * les filtres et la recherche.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../scripts/shot.mjs';

const serveur = await serve();
const BASE = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();

test.after(async () => {
  await navigateur.close();
  serveur.close();
});

async function ouvrir(chemin, { js = true } = {}) {
  const page = await navigateur.newPage({
    viewport: { width: 1280, height: 900 },
    javaScriptEnabled: js,
  });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
  return { page, erreurs };
}

const visibles = (page) => page.locator('[data-entry]:not([hidden])').count();

test('sans JavaScript, la première page montre sa tranche et la pagination est faite de liens', async () => {
  const { page } = await ouvrir('/fr/catalogue', { js: false });
  const n = await visibles(page);
  assert.ok(n >= 24 && n <= 30, `${n} cartes visibles, 24 à 30 attendues`);

  const nav = page.locator('[data-pagination]');
  assert.ok(await nav.isVisible(), 'la pagination doit être visible');
  assert.match(await nav.innerText(), /Page 1 sur \d/);
  const suivant = await nav.locator('a[rel="next"]').getAttribute('href');
  assert.match(suivant, /\/fr\/catalogue\/2/);
  await page.close();
});

test('sans JavaScript, la deuxième page montre la suite et son appel à l’action', async () => {
  const { page } = await ouvrir('/fr/catalogue/2', { js: false });
  const n = await visibles(page);
  assert.ok(n >= 1, 'la deuxième page doit montrer au moins une fiche');
  assert.match(await page.locator('[data-pagination]').innerText(), /Page 2 sur \d/);
  // Le CTA jaune reste présent sur chaque page (lot 14, partie 6).
  assert.ok(await page.locator('.cta').isVisible());
  await page.close();
});

test('avec JavaScript, la page rendue est respectée tant qu’on ne filtre pas', async () => {
  const { page, erreurs } = await ouvrir('/fr/catalogue');
  const n = await visibles(page);
  assert.ok(n >= 24 && n <= 30, `${n} cartes visibles après enrichissement`);
  assert.ok(await page.locator('[data-pagination]').isVisible());
  // Le compteur annonce tout le catalogue, pas la page.
  const total = Number(await page.locator('[data-count]').innerText());
  assert.ok(total > n, `le compteur (${total}) doit dépasser la page (${n})`);
  assert.deepEqual(erreurs, []);
  await page.close();
});

test('un filtre porte sur tout le catalogue et efface la pagination', async () => {
  const { page } = await ouvrir('/fr/catalogue/2');
  // Depuis la deuxième page, un filtre doit retrouver des fiches de la
  // première : c'est le cas qui échouerait si le filtre ne voyait que la page.
  await page.selectOption('[data-filter="family"]', 'detect-filter');
  await page.waitForFunction(
    () => document.querySelector('[data-catalogue-form]')?.dataset.spanning === 'true',
  );
  const cartes = page.locator('[data-entry]:not([hidden])');
  const n = await cartes.count();
  assert.ok(n >= 3, `${n} fiches trouvées pour la famille, au moins trois attendues`);
  for (const carte of await cartes.all()) {
    assert.equal(await carte.getAttribute('data-family'), 'detect-filter');
  }
  assert.equal(await page.locator('[data-pagination]').isVisible(), false);
  assert.equal(await page.locator('[data-count]').innerText(), String(n));
  await page.close();
});

test('la recherche traverse les pages, et l’état reste dans l’URL', async () => {
  const { page } = await ouvrir('/fr/catalogue');
  await page.fill('[data-search-input]', 'formulaire');
  await page.waitForFunction(
    () => document.querySelector('[data-catalogue-form]')?.dataset.spanning === 'true',
  );
  const n = await visibles(page);
  assert.ok(n >= 1 && n < 24, `${n} résultats pour « formulaire »`);
  assert.match(page.url(), /[?&]q=formulaire/);
  assert.equal(await page.locator('[data-pagination]').isVisible(), false);

  // Un seul caractère ne cherche rien : la pagination doit rester atteignable.
  await page.fill('[data-search-input]', 'f');
  await page.waitForFunction(
    () => document.querySelector('[data-catalogue-form]')?.dataset.spanning === 'false',
  );
  assert.ok(await page.locator('[data-pagination]').isVisible());
  await page.close();
});
