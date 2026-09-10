/**
 * Recherche et filtres du catalogue (lot 05), éprouvés sur le jeu de 200
 * fiches de test que demande la section 6.2 du CDC.
 *
 * Prérequis : OVERKILL_FIXTURES=1 npm run build:dev
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

async function catalogue(chemin = '/fr/catalogue', options = {}) {
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 }, ...options });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
  return { page, erreurs };
}

const visibles = (page) =>
  page.locator('[data-entry]:not([hidden])').count();

async function chercher(page, texte) {
  const champ = page.locator('[data-search-input]');
  await champ.fill(texte);
  // Le module attend 80 ms avant de chercher, puis charge l'index.
  await page.waitForTimeout(400);
}

test('le catalogue rend les 200 fiches de test', async () => {
  const { page, erreurs } = await catalogue();
  assert.deepEqual(erreurs, []);
  assert.equal(await page.locator('[data-entry]').count(), 200);
  assert.equal(await visibles(page), 200);
  assert.equal((await page.locator('[data-count]').textContent()).trim(), '200');
  await page.close();
});

test('la recherche cherche dès deux caractères et trouve', async () => {
  const { page } = await catalogue();
  await chercher(page, 'facture');
  const n = await visibles(page);
  assert.ok(n > 0 && n < 200, `attendu un sous-ensemble, obtenu ${n}`);
  const titres = await page.locator('[data-entry]:not([hidden]) .entry-card__title').allTextContents();
  assert.ok(titres.some((t) => /facture/i.test(t)), `aucun titre pertinent : ${titres.slice(0, 5)}`);
  await page.close();
});

test('la recherche est insensible aux accents et à la casse', async () => {
  const { page } = await catalogue();
  // « modérer » figure bien dans le contenu ; on cherche le même mot avec et
  // sans accent, et en majuscules, et on attend exactement les mêmes fiches.
  await chercher(page, 'modérer');
  const avecAccent = await page.locator('[data-entry]:not([hidden])').evaluateAll((e) =>
    e.map((n) => n.dataset.entryId),
  );
  await chercher(page, 'MODERER');
  const sansAccent = await page.locator('[data-entry]:not([hidden])').evaluateAll((e) =>
    e.map((n) => n.dataset.entryId),
  );
  assert.ok(avecAccent.length > 0, 'la recherche accentuée doit trouver quelque chose');
  assert.ok(avecAccent.length < 200, 'elle doit tout de même filtrer');
  assert.deepEqual(sansAccent, avecAccent);
  await page.close();
});

test('la recherche tolère une faute légère', async () => {
  const { page } = await catalogue();
  await chercher(page, 'doublons');
  const juste = await visibles(page);
  await chercher(page, 'doublonz');
  const faute = await visibles(page);
  assert.ok(juste > 0, 'le mot juste doit trouver');
  assert.ok(faute > 0, `une faute d'une lettre doit encore trouver, obtenu ${faute}`);
  await page.close();
});

test('une recherche sans résultat montre un état vide utile', async () => {
  const { page } = await catalogue();
  await chercher(page, 'zzzzqqqq');
  assert.equal(await visibles(page), 0);
  assert.equal((await page.locator('[data-count]').textContent()).trim(), '0');
  const vide = page.locator('[data-empty-state]');
  assert.ok(await vide.isVisible());
  const lien = await page.locator('[data-empty-action]').getAttribute('href');
  assert.ok(lien.includes('issues/new'), "l'état vide doit proposer de contribuer la fiche");
  assert.ok(lien.includes('zzzzqqqq'), "le lien doit reprendre la recherche");
  await page.close();
});

test('une recherche en français ne remonte aucune fiche anglaise, et réciproquement', async () => {
  // Chaque langue a son index : le cloisonnement est structurel.
  const fr = await (await fetch(`${BASE}/fr/search-index.json`)).json();
  const en = await (await fetch(`${BASE}/en/search-index.json`)).json();
  assert.equal(fr.length, 200);
  assert.equal(en.length, 200);

  const texteFr = fr.map((e) => e.t).join(' ');
  const texteEn = en.map((e) => e.t).join(' ');
  // Un mot typiquement français ne doit pas se trouver dans l'index anglais.
  assert.ok(texteFr.includes('doublons'), "l'index français doit contenir « doublons »");
  assert.ok(!texteEn.includes('doublons'), "l'index anglais ne doit pas contenir « doublons »");
  assert.ok(texteEn.includes('duplicate'), "l'index anglais doit contenir « duplicate »");
});

test('les quatre filtres se combinent et le compteur suit', async () => {
  const { page } = await catalogue();

  await page.selectOption('[data-filter="family"]', 'extract');
  await page.waitForTimeout(100);
  const parFamille = await visibles(page);
  assert.equal(parFamille, 20, `une famille compte 20 fiches, obtenu ${parFamille}`);

  await page.selectOption('[data-filter="verdict"]', 'N0');
  await page.waitForTimeout(100);
  const parVerdict = await visibles(page);
  assert.ok(parVerdict > 0 && parVerdict < parFamille, `combinaison inopérante : ${parVerdict}`);

  await page.selectOption('[data-filter="deterministic"]', 'true');
  await page.waitForTimeout(100);
  const troisFiltres = await visibles(page);
  assert.ok(troisFiltres <= parVerdict);
  assert.equal((await page.locator('[data-count]').textContent()).trim(), String(troisFiltres));

  // Chaque ligne visible respecte bien les trois filtres.
  const lignes = await page.locator('[data-entry]:not([hidden])').evaluateAll((els) =>
    els.map((e) => ({ ...e.dataset })),
  );
  for (const l of lignes) {
    assert.equal(l.family, 'extract');
    assert.equal(l.verdict, 'N0');
    assert.equal(l.deterministic, 'true');
  }
  await page.close();
});

test("l'état des filtres est dans l'URL et se restitue", async () => {
  const { page } = await catalogue();
  await page.selectOption('[data-filter="family"]', 'search');
  await page.selectOption('[data-filter="verdict"]', 'N1');
  await page.waitForTimeout(150);

  const url = new URL(page.url());
  assert.equal(url.searchParams.get('family'), 'search');
  assert.equal(url.searchParams.get('verdict'), 'N1');
  const attendu = await visibles(page);
  await page.close();

  // La même URL, ouverte à neuf, doit rendre le même écran.
  const { page: seconde } = await catalogue(`${url.pathname}${url.search}`);
  await seconde.waitForTimeout(200);
  assert.equal(await visibles(seconde), attendu);
  assert.equal(await seconde.locator('[data-filter="family"]').inputValue(), 'search');
  assert.equal(await seconde.locator('[data-filter="verdict"]').inputValue(), 'N1');
  await seconde.close();
});

test('la recherche est aussi reprise depuis l\'URL', async () => {
  const { page } = await catalogue('/fr/catalogue?q=facture');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-search-input]').inputValue(), 'facture');
  const n = await visibles(page);
  assert.ok(n > 0 && n < 200, `attendu un sous-ensemble, obtenu ${n}`);
  await page.close();
});

test('le champ de recherche prend le focus au chargement', async () => {
  const { page } = await catalogue();
  const focalise = await page.evaluate(
    () => document.activeElement?.matches('[data-search-input]') ?? false,
  );
  assert.ok(focalise, 'le champ de recherche doit avoir le focus au chargement');
  await page.close();
});

test('sans JavaScript, la liste est complète et les filtres passent par le formulaire', async () => {
  const page = await navigateur.newPage({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(`${BASE}/fr/catalogue`, { waitUntil: 'load' });

  assert.equal(await page.locator('[data-entry]').count(), 200);
  assert.ok(await page.locator('[data-catalogue-form] button[type=submit]').isVisible());
  assert.ok(await page.locator('.catalogue__nojs').isVisible(), 'le message de dégradation doit être visible');
  await page.close();
});

test("l'index n'est chargé qu'au premier caractère tapé", async () => {
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  const demandes = [];
  page.on('request', (r) => r.url().includes('search-index') && demandes.push(r.url()));

  await page.goto(`${BASE}/fr/catalogue`, { waitUntil: 'networkidle' });
  assert.equal(demandes.length, 0, "l'index ne doit pas être chargé au repos");

  await chercher(page, 'facture');
  assert.equal(demandes.length, 1, "l'index doit être chargé une seule fois");

  await chercher(page, 'adresse');
  assert.equal(demandes.length, 1, "l'index ne doit pas être rechargé");
  await page.close();
});
