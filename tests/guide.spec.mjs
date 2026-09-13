/**
 * Le questionnaire au navigateur : l'enchaînement des écrans, le compte des
 * questions restantes, et les trois formes de verdict.
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

async function ouvrir({ js = true } = {}) {
  const page = await navigateur.newPage({
    viewport: { width: 1280, height: 900 },
    javaScriptEnabled: js,
  });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.goto(`${BASE}/fr/par-ou-commencer`, { waitUntil: 'networkidle' });
  return { page, erreurs };
}

const choisir = (page, question, valeur) =>
  page.check(`[data-question="${question}"] input[value="${valeur}"]`);

test('sans JavaScript, la page reste lisible et renvoie aux familles', async () => {
  const { page } = await ouvrir({ js: false });
  // Les quatre écrans sont là, le mot sur JavaScript aussi.
  assert.equal(await page.locator('[data-screen]').count(), 4);
  assert.ok(await page.locator('.guide__nojs').isVisible());
  assert.ok(await page.locator('.guide__nojs a').isVisible());
  await page.close();
});

test('le compte des questions restantes suit les réponses', async () => {
  const { page, erreurs } = await ouvrir();
  const progres = page.locator('[data-guide-progress]');
  assert.match(await progres.innerText(), /Étape 1 sur 4 · 8 questions restantes/);

  await choisir(page, 'family', 'detect-filter');
  assert.match(await progres.innerText(), /7 questions restantes/);
  await choisir(page, 'frequence', 'basse');
  assert.match(await progres.innerText(), /6 questions restantes/);
  assert.deepEqual(erreurs, []);
  await page.close();
});

test('« je ne sais pas » sur la famille retire la question des tâches', async () => {
  const { page } = await ouvrir();
  await choisir(page, 'family', 'nsp');
  // Sept questions au total au lieu de huit, dont une déjà répondue.
  assert.match(await page.locator('[data-guide-progress]').innerText(), /6 questions restantes/);
  await choisir(page, 'frequence', 'nsp');
  await page.click('[data-guide-next]');
  // L'écran de la tâche ne pose plus que la question sur les données.
  assert.equal(await page.locator('[data-question="entry"]').isVisible(), false);
  await page.close();
});

test('un écran refuse de passer sans réponse, et le dit', async () => {
  const { page } = await ouvrir();
  await page.click('[data-guide-next]');
  const erreur = page.locator('[data-guide-error]');
  assert.ok(await erreur.isVisible());
  assert.match(await erreur.innerText(), /Je ne sais pas/);
  assert.equal(await page.locator('[data-screen="0"]').isVisible(), true);
  await page.close();
});

/** Remplit les huit questions et arrive au verdict. */
async function parcours(page, reponses) {
  await choisir(page, 'family', reponses.family);
  await choisir(page, 'frequence', reponses.frequence);
  await page.click('[data-guide-next]');
  if (reponses.entry) await choisir(page, 'entry', reponses.entry);
  await choisir(page, 'egress', reponses.egress);
  await page.click('[data-guide-next]');
  await choisir(page, 'meme', reponses.meme);
  await choisir(page, 'verifier', reponses.verifier);
  await page.click('[data-guide-next]');
  await choisir(page, 'exemples', reponses.exemples);
  await choisir(page, 'heberger', reponses.heberger);
  await page.click('[data-guide-next]');
}

test('une tâche désignée donne un verdict expliqué et la fiche', async () => {
  const { page, erreurs } = await ouvrir();
  await parcours(page, {
    family: 'detect-filter',
    frequence: 'moyenne',
    entry: 'mask-personal-data-in-chat',
    egress: 'non',
    meme: 'oui',
    verifier: 'oui',
    exemples: 'aucun',
    heberger: 'non',
  });

  const verdict = page.locator('[data-guide-verdict]');
  assert.ok(await verdict.isVisible());
  const texte = await verdict.innerText();
  assert.match(texte, /Pas besoin d’IA/);
  // Jamais la réponse seule : le pourquoi vient de la fiche.
  assert.match(texte, /Pourquoi/);
  assert.ok(texte.length > 400, 'le verdict doit expliquer, pas asséner');
  // La fiche est là, au format carte du catalogue.
  const cartes = verdict.locator('.card');
  assert.ok((await cartes.count()) >= 1);
  assert.match(await cartes.first().innerText(), /Masquer les coordonnées/);
  // Le formulaire a laissé la place, et on peut reprendre.
  assert.equal(await page.locator('[data-guide-form]').isVisible(), false);
  assert.ok(await page.locator('[data-guide-restart]').isVisible());
  assert.deepEqual(erreurs, []);
  await page.close();
});

test('une contrainte qui déplace la réponse le dit, et dit vers quoi', async () => {
  const { page } = await ouvrir();
  // Le résumé d'un document long recommande N3, qui part chez un tiers.
  await parcours(page, {
    family: 'transform',
    frequence: 'basse',
    entry: 'summarise-a-long-document',
    egress: 'non',
    meme: 'nsp',
    verifier: 'nsp',
    exemples: 'nsp',
    heberger: 'oui',
  });
  const texte = await page.locator('[data-guide-verdict]').innerText();
  assert.match(texte, /vos données ne peuvent pas sortir|données ne peuvent pas sortir/i);
  await page.close();
});

test('une famille sans tâche correspondante propose le message et le mail d’abord', async () => {
  const { page } = await ouvrir();
  await parcours(page, {
    family: 'detect-filter',
    frequence: 'basse',
    entry: 'aucune',
    egress: 'non',
    meme: 'oui',
    verifier: 'oui',
    exemples: 'aucun',
    heberger: 'non',
  });
  const verdict = page.locator('[data-guide-verdict]');
  const texte = await verdict.innerText();
  assert.match(texte, /ne couvre pas encore ce besoin/);

  const routes = verdict.locator('.gv__route a');
  assert.equal(await routes.count(), 2);
  // Le mail en premier : la cible principale n'a pas de compte GitHub.
  const premier = await routes.first().getAttribute('href');
  assert.ok(premier.startsWith('mailto:'), `attendu un mailto, reçu ${premier}`);
  const corps = decodeURIComponent(premier);
  assert.match(corps, /Qu’est-ce que vous voulez faire/);
  // Les espaces sont des espaces, pas des « + » : un mailto n'est pas un
  // formulaire, et un brouillon rempli de plus serait inutilisable.
  assert.ok(!corps.includes('+'), 'le corps du message ne doit pas contenir de +');
  assert.match(corps, /Aucune de celles-là/);
  const second = await routes.nth(1).getAttribute('href');
  assert.match(second, /github\.com/);
  await page.close();
});

test('sans tâche ni famille, le catalogue est filtré par les contraintes', async () => {
  const { page } = await ouvrir();
  await parcours(page, {
    family: 'nsp',
    frequence: 'nsp',
    egress: 'non',
    meme: 'oui',
    verifier: 'nsp',
    exemples: 'nsp',
    heberger: 'nsp',
  });
  const verdict = page.locator('[data-guide-verdict]');
  assert.match(await verdict.innerText(), /Sans la tâche/);
  const lien = await verdict
    .locator('a[href^="/fr/catalogue"]')
    .first()
    .getAttribute('href');
  assert.match(lien, /egress=none/);
  assert.match(lien, /deterministic=true/);
  await page.close();
});
