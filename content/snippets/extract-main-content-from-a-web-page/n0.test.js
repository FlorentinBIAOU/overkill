import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_LINK_SHARE, MIN_CHARACTERS, readArticle } from './n0.js';

const PARAGRAPHES = [
  'Installée rue des Lilas depuis 1926, la boulangerie Martin a vu passer quatre'
  + ' générations de clients et trois guerres. Son four à bois, classé, tourne encore'
  + ' tous les matins à cinq heures.',
  'Clémentine Martin, qui a repris le commerce en 2019, raconte que la farine vient'
  + ' toujours du même moulin, à quarante kilomètres de là, et que la recette du pain de'
  + ' campagne n’a pas bougé d’une ligne depuis son arrière-grand-père.',
];

const AUTOUR = ['Accueil Boutique Contact', 'Ce site utilise des cookies',
  'Mentions légales', 'Vous aimerez aussi : les dix meilleures boulangeries'];

const TITRE = 'La boulangerie Martin fête ses cent ans';

const ARTICLE = `<!doctype html><html lang="fr"><head><title>${TITRE}</title></head><body>`
  + `<nav>${AUTOUR[0]}</nav><div class="cookies">${AUTOUR[1]}</div>`
  + `<article><h1>${TITRE}</h1><p>${PARAGRAPHES[0]}</p><p>${PARAGRAPHES[1]}</p></article>`
  + `<aside>${AUTOUR[3]}</aside><footer>${AUTOUR[2]}</footer></body></html>`;

// Une page dont le corps est construit par son propre JavaScript.
const APPLICATION = '<!doctype html><html lang="fr"><head><title>Application</title></head>'
  + '<body><div id="root"></div><script src="/app.js"></script></body></html>';

// Une page qui n'est pas un article : une liste de liens.
const CATEGORIE = '<!doctype html><html><head><title>Boulangeries</title></head><body><ul>'
  + Array.from({ length: 40 }, (unused, i) => `<li><a href="/a${i}">Boulangerie numéro ${i}</a></li>`).join('')
  + '</ul></body></html>';

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : une page construite par son JavaScript n'a rien à extraire", () => {
  const rapport = readArticle(APPLICATION);
  assert.equal(rapport.characters, 0);
  assert.equal(
    rapport.reason,
    'almost nothing was extracted: this page may be built by its own JavaScript',
  );
  assert.ok(APPLICATION.includes('app.js'));
});

test('point de rupture : témoin, le même article servi en HTML est extrait', () => {
  const rapport = readArticle(ARTICLE);
  assert.equal(rapport.reason, null);
  assert.ok(rapport.characters > MIN_CHARACTERS);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test("les phrases de l'article sont gardées et le reste jeté", () => {
  const { text } = readArticle(ARTICLE);
  for (const phrase of PARAGRAPHES) assert.ok(text.includes(phrase), phrase.slice(0, 40));
  for (const bruit of AUTOUR) assert.ok(!text.includes(bruit), bruit);
});

test('le titre est rendu à part', () => {
  assert.equal(readArticle(ARTICLE).title, TITRE);
  assert.equal(readArticle(APPLICATION).title, 'Application');
});

test("une page de liens ne passe pas pour un article", () => {
  const rapport = readArticle(CATEGORIE);
  assert.equal(rapport.text, '');
  assert.equal(rapport.reason, 'this page is a list of links, not an article');
  assert.equal(MAX_LINK_SHARE, 0.5);
  assert.equal(readArticle(ARTICLE).reason, null);
});

test("les commentaires des lecteurs ne font pas partie de l'article", () => {
  const avec = ARTICLE.replace('<aside>', '<section id="comments"><h2>Commentaires</h2>'
    + '<p>Le meilleur pain de la ville, sans hésiter. Et la brioche du dimanche vaut le détour aussi.</p>'
    + '<p>J’y vais depuis vingt ans, rien n’a changé, et c’est très bien comme ça.</p></section><aside>');
  assert.equal(readArticle(avec).text, readArticle(ARTICLE).text);
  assert.ok(avec.includes('brioche'));
});

test('le plancher est réglable et son effet est visible', () => {
  assert.notEqual(readArticle(ARTICLE, { minCharacters: 10_000 }).reason, null);
  assert.equal(readArticle(ARTICLE, { minCharacters: 1 }).reason, null);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 0, 4.2, [], {}, Symbol('x')]) {
    const rapport = readArticle(entree);
    assert.equal(rapport.text, '');
    assert.equal(typeof rapport.reason, 'string');
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, un article de presse locale', () => {
  const rapport = readArticle(ARTICLE);
  assert.equal(rapport.title, TITRE);
  assert.equal(rapport.reason, null);
  assert.ok(rapport.text.includes(PARAGRAPHES[0]));
});

test('production : entrée vide', () => {
  const vide = readArticle('');
  assert.equal(vide.text, '');
  assert.equal(vide.reason, 'this page could not be parsed');
});

test('production : entrée très grande et terminaison rapide', () => {
  const ajout = Array.from({ length: 500 },
    (unused, i) => `<p>Paragraphe numéro ${i} : ${PARAGRAPHES[1]}</p>`).join('');
  const enorme = ARTICLE.replace('</article>', `${ajout}</article>`);
  const debut = performance.now();
  const rapport = readArticle(enorme);
  assert.ok(performance.now() - debut < 30_000);
  assert.ok(rapport.characters > 10_000);
});

test('production : encodages inattendus', () => {
  const page = ARTICLE.replace('boulangerie Martin a vu', 'boulangerie Martin&nbsp;🥖 a vu');
  assert.ok(readArticle(page).text.includes('🥖'));
  assert.equal(readArticle(ARTICLE.replace('lang="fr"', '')).reason, null);
  const casse = ARTICLE.replaceAll('</p>', '').replace('</article>', '');
  assert.equal(typeof readArticle(casse).text, 'string');
});

test('production : valeurs aux limites', () => {
  const corps = 'a'.repeat(MIN_CHARACTERS);
  const page = `<html><head><title>t</title></head><body><article><p>${corps}</p></article></body></html>`;
  const lu = readArticle(page);
  assert.ok(lu.reason === null || lu.characters < MIN_CHARACTERS);
  const court = page.replace(corps, 'a'.repeat(MIN_CHARACTERS - 1));
  assert.notEqual(readArticle(court).reason, null);
});

test("production : une page illisible dans un lot n'empêche pas les autres", () => {
  const lot = [ARTICLE, '', APPLICATION, '<html', ARTICLE];
  assert.deepEqual(
    lot.map((p) => readArticle(p).reason === null),
    [true, false, false, false, true],
  );
});

test("production : l'extraction tient la classe de latence annoncée", () => {
  const debut = performance.now();
  for (let i = 0; i < 1_000; i += 1) readArticle(ARTICLE);
  assert.ok(performance.now() - debut < 60_000);
});
