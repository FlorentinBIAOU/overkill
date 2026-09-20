import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CORPUS, MOJIBAKE, MOJIBAKE_TEXTE, PAGE_ANGLAISE, RETENUES, TABLEAU_DE_CHIFFRES,
} from './fixtures.mjs';
import { triagePages } from './n0.js';
import { MARGIN, fit, isReadable, normalise, score } from './n1.js';

const MODELE = fit(CORPUS);
const arrondi = (x, n) => Number(x.toFixed(n));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : une page de chiffres n'est pas de la langue", () => {
  // « Un tableau de montants — « 12/01/2026 1 250,00 4 300,50 » — tombe sous
  // le seuil comme la page cassée, alors que c'est du texte parfaitement lu. »
  const chiffres = isReadable(TABLEAU_DE_CHIFFRES, MODELE);
  assert.equal(chiffres.readable, false);
  assert.equal(arrondi(chiffres.score, 2), -4.1);
  assert.equal(arrondi(MODELE.threshold, 2), -2.98);
  assert.ok(TABLEAU_DE_CHIFFRES.includes('12/01/2026'));
});

test("point de rupture : témoin, une page hors du lot passe", () => {
  // « Le témoin : une lettre commerciale qui n'est pas dans le lot
  // d'entraînement marque −2,83, au-dessus du seuil. »
  //
  // Le témoin est pris HORS de CORPUS, et c'est tout ce qui fait qu'il
  // démontre quelque chose : une page d'entraînement passe son propre seuil
  // par construction. L'ancien témoin était CORPUS[0].
  const temoin = isReadable(RETENUES[2], MODELE);
  assert.ok(!CORPUS.includes(RETENUES[2]));
  assert.equal(temoin.readable, true);
  assert.equal(arrondi(temoin.score, 2), -2.83);
});

test('les quatre pages retenues hors du lot passent toutes', () => {
  // R7 : ce que le réglage par défaut produit un jour ordinaire, pas sur
  // l'exemple qui l'illustre.
  const attendus = [-2.42, -2.63, -2.83, -2.65];
  RETENUES.forEach((page, i) => {
    const lu = isReadable(page, MODELE);
    assert.equal(lu.readable, true, page.slice(0, 40));
    assert.equal(arrondi(lu.score, 2), attendus[i], page.slice(0, 40));
  });
  const pireEntrainement = Math.min(...CORPUS.map((p) => score(p, MODELE)));
  const pireRetenue = Math.min(...RETENUES.map((p) => score(p, MODELE)));
  assert.equal(arrondi(pireEntrainement - pireRetenue, 2), 0.35);
  assert.equal(MARGIN, 0.5);
});

test('le modèle généralise en validation croisée', () => {
  // Le seuil vient du lot d'entraînement, donc la seule façon de savoir s'il
  // généralise est de retirer une page du lot et de la noter contre les cinq
  // autres. Les six passent.
  for (let retiree = 0; retiree < CORPUS.length; retiree += 1) {
    const reste = CORPUS.filter((unused, i) => i !== retiree);
    assert.equal(isReadable(CORPUS[retiree], fit(reste)).readable, true, String(retiree));
  }
});

test("le lot d'entraînement est du français accentué", () => {
  // T5 et R1 : l'entrée ordinaire d'un fonds documentaire francophone porte
  // des accents. Un lot sans un seul « é » ne donne à ALPHABET que le lissage
  // add-one sur la moitié de ses lettres.
  assert.ok(CORPUS.every((page) => /[àâçéèêîïôùû]/.test(page)));
  assert.ok(CORPUS.reduce((n, page) => n + (page.match(/é/g) ?? []).length, 0) >= 10);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test("N1 attrape la page que N0 avait rangée parmi les lisibles", async () => {
  // R4 : le niveau recommandé et celui du dessus, sur le point de rupture de
  // N0. N0 range la page cassée parmi les lisibles ; N1 la refuse.
  assert.deepEqual((await triagePages(MOJIBAKE)).readable, [1]);
  const casse = isReadable(MOJIBAKE_TEXTE, MODELE);
  assert.equal(casse.readable, false);
  assert.equal(arrondi(casse.score, 2), -4.14);
  // Témoin : sur la page de prose, les deux niveaux sont d'accord.
  assert.equal(isReadable(CORPUS[1], MODELE).readable, true);
});

test("le seuil vient du lot d'entraînement et de rien d'autre", () => {
  const scores = CORPUS.map((page) => score(page, MODELE));
  assert.equal(MODELE.threshold, Math.min(...scores) - MARGIN);
  assert.ok(CORPUS.every((page) => isReadable(page, MODELE).readable));
});

test('une autre langue sur le même alphabet tombe sous le seuil', () => {
  // T3 : une entrée qui viole l'hypothèse du modèle.
  const anglais = isReadable(PAGE_ANGLAISE, MODELE);
  assert.equal(anglais.readable, false);
  assert.equal(arrondi(anglais.score, 2), -3.25);
  const bilingue = fit([...CORPUS, PAGE_ANGLAISE]);
  assert.equal(isReadable(PAGE_ANGLAISE, bilingue).readable, true);
});

test("le modèle est reproductible et ne dépend d'aucun tirage", () => {
  assert.equal(fit(CORPUS).threshold, fit(CORPUS).threshold);
  assert.equal(fit([...CORPUS].reverse()).threshold, MODELE.threshold);
});

test("tout ce qui n'est pas une lettre devient un seul symbole", () => {
  assert.equal(normalise('Le Prix : 1 250,00 EUR !'), 'le prix # # ###### eur #');
  assert.equal(normalise(''), '');
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, les pages que N0 vient de déclarer lisibles', () => {
  for (const page of CORPUS) {
    assert.equal(isReadable(page, MODELE).readable, true, page.slice(0, 40));
  }
});

test('production : entrée vide', () => {
  const vide = isReadable('', MODELE);
  assert.equal(vide.score, -Infinity);
  assert.equal(vide.readable, false);
  assert.equal(isReadable('a', MODELE).score, -Infinity);
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = CORPUS.join(' ').repeat(500);
  const debut = performance.now();
  const resultat = isReadable(enorme, MODELE);
  assert.ok(performance.now() - debut < 30_000);
  assert.equal(resultat.readable, true);
});

test('production : encodages inattendus', () => {
  // Accents décomposés : le « é » composé est dans l'alphabet, le décomposé
  // est un « e » suivi d'un accent seul, qui tombe dans « autre ».
  const compose = 'réception préalable'.normalize('NFC');
  const decompose = 'réception préalable'.normalize('NFD');
  assert.equal(normalise(compose), 'réception préalable');
  assert.equal(normalise(decompose), 're#ception pre#alable');
  assert.notEqual(score(decompose, MODELE), score(compose, MODELE));
  assert.equal(normalise('ok​ 🙂'), 'ok###');
});

test('production : valeurs aux limites', () => {
  assert.equal(score('', MODELE), -Infinity);
  assert.equal(score('a', MODELE), -Infinity);
  assert.ok(score('es', MODELE) > -Infinity);
  // Un lot d'entraînement vide est refusé : un modèle ajusté sur rien
  // déclarerait tout lisible, et c'est l'erreur coûteuse de cette fiche.
  assert.throws(() => fit([]), {
    message: 'fit needs at least one page you have read yourself',
  });
});

test("production : une page illisible dans un lot n'empêche pas les autres", () => {
  const lot = [CORPUS[0], MOJIBAKE_TEXTE, CORPUS[1], '', TABLEAU_DE_CHIFFRES];
  assert.deepEqual(
    lot.map((p) => isReadable(p, MODELE).readable),
    [true, false, true, false, false],
  );
});

test('production : le score tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) score(CORPUS[0], MODELE);
  assert.ok(performance.now() - debut < 60_000);
});
