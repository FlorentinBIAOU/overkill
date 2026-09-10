/**
 * Contrôles de comportement des composants.
 *
 * Ce que la lecture du code ne prouve pas : le parcours au clavier, l'annonce
 * du changement d'onglet, la confirmation de copie, et surtout la dégradation
 * sans JavaScript, qui est un critère de qualité non négociable (CDC 8.7).
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

async function ouvrir(options = {}) {
  const page = await navigateur.newPage({ viewport: { width: 1100, height: 900 }, ...options });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.goto(`${BASE}/dev/components`, { waitUntil: 'networkidle' });
  return { page, erreurs };
}

test('la page se rend sans erreur de console', async () => {
  const { page, erreurs } = await ouvrir();
  assert.deepEqual(erreurs, []);
  await page.close();
});

test('les onglets de code répondent aux flèches et annoncent la sélection', async () => {
  const { page } = await ouvrir();
  const onglets = page.locator('#demo-executed [role="tab"]');
  assert.equal(await onglets.count(), 2);

  await onglets.first().focus();
  assert.equal(await onglets.first().getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#demo-executed-panel-javascript').isVisible(), false);

  await page.keyboard.press('ArrowRight');
  assert.equal(await onglets.nth(1).getAttribute('aria-selected'), 'true');
  assert.equal(await onglets.first().getAttribute('aria-selected'), 'false');
  assert.equal(await page.locator('#demo-executed-panel-javascript').isVisible(), true);
  assert.equal(await page.locator('#demo-executed-panel-python').isVisible(), false);

  // La flèche revient en arrière, et Home ramène au premier onglet.
  await page.keyboard.press('ArrowLeft');
  assert.equal(await onglets.first().getAttribute('aria-selected'), 'true');
  await page.keyboard.press('End');
  assert.equal(await onglets.nth(1).getAttribute('aria-selected'), 'true');

  await page.close();
});

test('le bouton copier confirme et annonce le résultat', async () => {
  const { page } = await ouvrir({ permissions: ['clipboard-read', 'clipboard-write'] });
  const bouton = page.locator('#demo-executed [data-copy]').first();
  const avant = await bouton.textContent();

  await bouton.click();
  await page.waitForFunction(
    (texte) => document.querySelector('#demo-executed [data-copy]').textContent !== texte,
    avant,
  );

  assert.equal((await bouton.textContent()).trim(), 'Copié');
  const annonce = page.locator('#demo-executed [role="status"]').first();
  assert.equal((await annonce.textContent()).trim(), 'Copié');

  const presse = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(presse.includes('def mask('), 'le presse-papiers doit contenir le code réel');

  await page.close();
});

test('sans JavaScript, les deux langages restent lisibles', async () => {
  const page = await navigateur.newPage({ javaScriptEnabled: false, viewport: { width: 1100, height: 900 } });
  await page.goto(`${BASE}/dev/components`, { waitUntil: 'load' });

  // Les deux panneaux sont dans le HTML et visibles l'un sous l'autre.
  assert.equal(await page.locator('#demo-executed-panel-python').isVisible(), true);
  assert.equal(await page.locator('#demo-executed-panel-javascript').isVisible(), true);

  // Les onglets, qui ne servent à rien sans JavaScript, sont masqués.
  assert.equal(await page.locator('#demo-executed [role="tablist"]').isVisible(), false);

  await page.close();
});

test('le focus est visible tout au long du parcours au clavier', async () => {
  const { page } = await ouvrir();
  await page.locator('body').click({ position: { x: 2, y: 2 } });

  // On parcourt la page à la touche de tabulation, comme le ferait quelqu'un
  // qui n'emploie pas de souris. Un .focus() programmatique ne déclenche pas
  // toujours :focus-visible, et ne prouverait donc rien.
  const vus = [];
  for (let i = 0; i < 60; i += 1) {
    await page.keyboard.press('Tab');
    const etat = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      // On marque chaque élément visité, pour reconnaître le moment où le
      // parcours boucle plutôt que de se fier au nom des classes.
      if (el.dataset.parcouru === '1') return { boucle: true };
      el.dataset.parcouru = '1';
      const c = getComputedStyle(el);
      return {
        cle: el.tagName + (el.id ? '#' + el.id : '') +
          (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''),
        focusVisible: el.matches(':focus-visible'),
        style: c.outlineStyle,
        width: parseFloat(c.outlineWidth),
      };
    });
    if (!etat || etat.boucle) break;
    vus.push(etat);

    assert.ok(etat.focusVisible, `${etat.cle} ne reçoit pas :focus-visible`);
    assert.notEqual(etat.style, 'none', `${etat.cle} sans contour de focus`);
    assert.ok(etat.width >= 2, `${etat.cle} : contour de ${etat.width} px, trop fin`);
  }

  assert.ok(vus.length >= 10, `attendu au moins dix arrêts au clavier, obtenu ${vus.length}`);
  await page.close();
});

test('un seul h1, et aucune hiérarchie de titres sautée', async () => {
  const { page } = await ouvrir();
  const niveaux = await page.evaluate(() =>
    [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1])),
  );
  assert.equal(niveaux.filter((n) => n === 1).length, 1, 'il doit y avoir exactement un h1');
  for (let i = 1; i < niveaux.length; i += 1) {
    assert.ok(
      niveaux[i] <= niveaux[i - 1] + 1,
      `saut de titre : h${niveaux[i - 1]} suivi de h${niveaux[i]}`,
    );
  }
  await page.close();
});

test("l'adresse d'accompagnement est cliquable et absente en clair du HTML", async () => {
  const { page } = await ouvrir();
  const lien = page.locator('.help__link');
  const href = await lien.getAttribute('href');
  assert.ok(href.startsWith('mailto:biaouflo@gmail.com'), `href inattendu : ${href}`);
  assert.ok(href.includes('subject='), "l'objet doit être pré-rempli");

  // Le HTML livré ne contient pas l'adresse en clair. On lit la réponse brute,
  // et non `page.content()`, qui rend le DOM analysé, donc les entités déjà
  // décodées : ce serait mesurer autre chose que ce que reçoit un aspirateur.
  const brut = await (await fetch(`${BASE}/dev/components`)).text();
  assert.ok(brut.includes('help__link'), 'le bloc doit bien être dans la page');
  assert.ok(!brut.includes('biaouflo@gmail.com'), "l'adresse ne doit pas apparaître en clair");
  assert.ok(!brut.includes('mailto:biaouflo'), "le mailto ne doit pas apparaître en clair");

  await page.close();
});
