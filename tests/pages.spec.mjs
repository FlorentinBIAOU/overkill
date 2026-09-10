/**
 * Contrôles des quatre gabarits de page (lot 04).
 *
 * Ils rendent avec des données factices choisies pour être ingrates : un
 * barreau absent, un verdict N3, un titre très long, une fiche en brouillon,
 * une famille sans illustration.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../scripts/shot.mjs';

const GABARITS = {
  fiche: '/dev/entry',
  'fiche en brouillon': '/dev/entry-draft',
  catalogue: '/dev/catalogue',
  famille: '/dev/famille',
  éditorial: '/dev/editorial',
};

const serveur = await serve();
const BASE = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();

test.after(async () => {
  await navigateur.close();
  serveur.close();
});

async function ouvrir(chemin, options = {}) {
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 }, ...options });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
  return { page, erreurs };
}

for (const [nom, chemin] of Object.entries(GABARITS)) {
  test(`gabarit ${nom} : rendu sans erreur, un seul h1, hiérarchie sans saut`, async () => {
    const { page, erreurs } = await ouvrir(chemin);
    assert.deepEqual(erreurs, [], `erreurs de console sur ${chemin}`);

    const niveaux = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({
        n: Number(h.tagName[1]),
        texte: h.textContent.trim().slice(0, 40),
      })),
    );
    assert.equal(
      niveaux.filter((h) => h.n === 1).length,
      1,
      `${chemin} doit avoir exactement un h1`,
    );
    for (let i = 1; i < niveaux.length; i += 1) {
      assert.ok(
        niveaux[i].n <= niveaux[i - 1].n + 1,
        `${chemin} : h${niveaux[i - 1].n} « ${niveaux[i - 1].texte} » suivi de h${niveaux[i].n} « ${niveaux[i].texte} »`,
      );
    }
    await page.close();
  });

  test(`gabarit ${nom} : lisible sans JavaScript`, async () => {
    const page = await navigateur.newPage({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 900 },
    });
    await page.goto(BASE + chemin, { waitUntil: 'load' });

    // Le contenu principal est présent, et la navigation fonctionne.
    assert.ok(await page.locator('main').isVisible());
    assert.ok((await page.locator('h1').textContent()).trim().length > 0);
    assert.ok(await page.locator('header a[href]').first().isVisible());
    await page.close();
  });
}

for (const [nom, chemin] of Object.entries(GABARITS)) {
  test(`gabarit ${nom} : aucun identifiant en double`, async () => {
    const { page } = await ouvrir(chemin);
    const doublons = await page.evaluate(() => {
      const vus = new Map();
      for (const el of document.querySelectorAll('[id]')) {
        vus.set(el.id, (vus.get(el.id) ?? 0) + 1);
      }
      return [...vus].filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n} fois)`);
    });
    assert.deepEqual(doublons, [], `${chemin} porte des identifiants en double`);
    await page.close();
  });
}

test('la fiche affiche le verdict deux fois : en badge et dans le tableau', async () => {
  const { page } = await ouvrir('/dev/entry');
  const badgeEntete = page.locator('.entry__badges .verdict-badge');
  const badgeTableau = page.locator('.rung-table .verdict-badge');
  assert.equal(await badgeEntete.count(), 1);
  assert.equal(await badgeTableau.count(), 1);
  assert.ok((await badgeEntete.textContent()).includes('N0'));
  await page.close();
});

test('la fiche ancre chaque barreau et le sommaire y mène', async () => {
  const { page } = await ouvrir('/dev/entry');
  for (const ancre of ['n0', 'n1', 'n2', 'n3', 'verdict', 'sources']) {
    assert.equal(
      await page.locator(`#${ancre}`).count(),
      1,
      `ancre #${ancre} manquante`,
    );
    assert.equal(
      await page.locator(`.toc a[href="#${ancre}"], a[href="#${ancre}"]`).count() > 0,
      true,
      `aucun lien vers #${ancre}`,
    );
  }
  await page.close();
});

test('le sommaire est collant au-delà de 900 px et ne l\'est pas en dessous', async () => {
  const grand = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  await grand.goto(`${BASE}/dev/entry`, { waitUntil: 'networkidle' });
  assert.equal(
    await grand.locator('.doc-aside').evaluate((el) => getComputedStyle(el).position),
    'sticky',
  );
  await grand.close();

  const petit = await navigateur.newPage({ viewport: { width: 600, height: 900 } });
  await petit.goto(`${BASE}/dev/entry`, { waitUntil: 'networkidle' });
  assert.equal(
    await petit.locator('.doc-aside').evaluate((el) => getComputedStyle(el).position),
    'static',
  );
  await petit.close();
});

test('la fiche en brouillon le dit visiblement', async () => {
  const { page } = await ouvrir('/dev/entry-draft');
  assert.ok(await page.locator('.entry__draft').first().isVisible());
  assert.ok(await page.locator('.callout--marked').first().isVisible());
  await page.close();
});

test('le catalogue rend sa liste complète sans JavaScript', async () => {
  const page = await navigateur.newPage({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(`${BASE}/dev/catalogue`, { waitUntil: 'load' });
  assert.equal(await page.locator('[data-entry]').count(), 3);
  // Le formulaire de filtres reste soumissible.
  assert.ok(await page.locator('[data-catalogue-form] button[type=submit]').isVisible());
  await page.close();
});

test('une famille sans illustration le montre au lieu de laisser un trou', async () => {
  const { page } = await ouvrir('/dev/famille');
  const absente = page.locator('.family-illustration--missing');
  if ((await absente.count()) > 0) {
    assert.ok(await absente.getAttribute('aria-label'));
  } else {
    assert.equal(await page.locator('.family-illustration svg').count(), 1);
  }
  await page.close();
});

test('chaque page déclare hreflang dans les deux sens et une canonique', async () => {
  const { page } = await ouvrir('/dev/entry');
  const liens = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="alternate"], link[rel="canonical"]')].map((l) => ({
      rel: l.getAttribute('rel'),
      hreflang: l.getAttribute('hreflang'),
      href: l.getAttribute('href'),
    })),
  );
  assert.equal(liens.filter((l) => l.rel === 'canonical').length, 1);
  assert.ok(liens.some((l) => l.hreflang === 'en'));
  assert.ok(liens.some((l) => l.hreflang === 'fr'));
  const xdefault = liens.find((l) => l.hreflang === 'x-default');
  assert.ok(xdefault, 'x-default manquant');
  assert.ok(xdefault.href.includes('/en'), "x-default doit pointer vers l'anglais");
  await page.close();
});

test('aucune ressource tierce n\'est chargée à l\'exécution', async () => {
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  const externes = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.hostname !== '127.0.0.1' && url.protocol !== 'data:') externes.push(r.url());
  });
  await page.goto(`${BASE}/dev/entry`, { waitUntil: 'networkidle' });
  assert.deepEqual(externes, []);
  await page.close();
});
