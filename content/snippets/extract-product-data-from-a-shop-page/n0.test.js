import test from 'node:test';
import assert from 'node:assert/strict';

import { readProducts } from './n0.js';

/** Une page de boutique, réduite à ce qui compte pour ce test. */
function page(bloc, corps = '') {
  const script = bloc ? `<script type="application/ld+json">${bloc}</script>` : '';
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    + `<title>Moulin à café Lumière</title>${script}</head>`
    + `<body><h1>Moulin à café Lumière</h1>${corps}</body></html>`;
}

function produit(prix = '19.90', extra = {}) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Moulin à café Lumière',
    sku: 'MC-4501',
    gtin13: '3760012345678',
    brand: { '@type': 'Brand', name: 'Lumière' },
    offers: {
      '@type': 'Offer', price: prix, priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    },
    ...extra,
  });
}

const CORPS = '<p class="prix">19,90 €</p><p>Référence MC-4501</p><p>En stock</p>';

// Une fiche en promotion dont le bloc JSON-LD n'a pas suivi.
const PROMO = page(produit('24.90'), CORPS);
// La même, en accord avec elle-même.
const EN_ACCORD = page(produit('19.90'), CORPS);
// Un graphe, comme en produisent les greffons de référencement.
const GRAPHE = page(JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [{ '@type': 'Organization', name: 'Boulangerie Martin' }, JSON.parse(produit())],
}), CORPS);
// La page du produit, et le carrousel des articles voisins.
const CARROUSEL = page(JSON.stringify([
  JSON.parse(produit()),
  JSON.parse(produit().replace('MC-4501', 'MC-9000')
    .replace('Moulin à café Lumière', 'Bouilloire Lumière')),
]), CORPS);
const SANS = page('', CORPS);
const CASSE = page("{ceci n'est pas du JSON", CORPS);
const VIRGULE = page(produit('1 234,56'), CORPS);
const NOMBRE = page(produit(19.9), CORPS);
const MICRODONNEES = page('', '<div itemscope itemtype="https://schema.org/Product">'
  + '<span itemprop="name">Moulin à café Lumière</span></div>');

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le bloc publié peut ne plus correspondre à la page', () => {
  const rapport = readProducts(PROMO);
  assert.equal(rapport.products[0].price, 24.9);
  assert.ok(PROMO.includes('19,90'));
  assert.ok(!PROMO.includes('24,90'));
  assert.ok(PROMO.includes('24.90'));
});

test("point de rupture : témoin, sur une page en accord le prix est celui affiché", () => {
  const rapport = readProducts(EN_ACCORD);
  assert.equal(rapport.products[0].price, 19.9);
  assert.ok(EN_ACCORD.includes('19,90 €'));
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('les six champs sont lus et normalisés', () => {
  assert.deepEqual(readProducts(EN_ACCORD).products[0], {
    name: 'Moulin à café Lumière', sku: 'MC-4501', gtin: '3760012345678',
    brand: 'Lumière', price: 19.9, price_text: '19.90',
    currency: 'EUR', availability: 'InStock',
  });
});

test('la disponibilité est la même écrite de trois façons', () => {
  for (const ecrit of ['https://schema.org/InStock', 'http://schema.org/InStock', 'InStock']) {
    const bloc = produit().replace('https://schema.org/InStock', ecrit);
    assert.equal(readProducts(page(bloc)).products[0].availability, 'InStock', ecrit);
  }
});

test('un graphe et une liste de blocs sont parcourus', () => {
  assert.equal(readProducts(GRAPHE).products[0].sku, 'MC-4501');
  assert.equal(readProducts(GRAPHE).products.length, 1);
});

test("tous les produits de la page sont rendus, et la page ne dit pas lequel", () => {
  assert.deepEqual(readProducts(CARROUSEL).products.map((p) => p.sku), ['MC-4501', 'MC-9000']);
});

test("un prix qui n'est pas un nombre revient nul avec son texte", () => {
  const lu = readProducts(VIRGULE).products[0];
  assert.equal(lu.price, null);
  assert.equal(lu.price_text, '1 234,56');
  assert.equal(readProducts(NOMBRE).products[0].price, 19.9);
});

test('une page muette et une page cassée ne se confondent pas', () => {
  assert.deepEqual(readProducts(SANS), {
    source: null, products: [], reason: 'no JSON-LD product',
  });
  assert.equal(readProducts(CASSE).reason, 'the JSON-LD on this page could not be parsed');
});

test('les microdonnées ne sont pas lues par ce niveau', () => {
  assert.deepEqual(readProducts(MICRODONNEES).products, []);
  assert.ok(MICRODONNEES.includes('itemprop'));
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 0, 4.2, [], {}, Symbol('x')]) {
    const rapport = readProducts(entree);
    assert.deepEqual(rapport.products, []);
    assert.equal(typeof rapport.reason, 'string');
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, une fiche produit de boutique', () => {
  const rapport = readProducts(EN_ACCORD);
  assert.equal(rapport.source, 'json-ld');
  assert.equal(rapport.products[0].name, 'Moulin à café Lumière');
});

test('production : entrée vide', () => {
  assert.deepEqual(readProducts(''), {
    source: null, products: [], reason: 'no JSON-LD product',
  });
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = EN_ACCORD.replace('</body>', `<div>${'x'.repeat(1_000_000)}</div></body>`);
  let debut = performance.now();
  const rapport = readProducts(enorme);
  assert.ok(performance.now() - debut < 10_000);
  assert.equal(rapport.products[0].sku, 'MC-4501');
  // Une page faite de balises ouvertes non refermées ne fait pas exploser le balayage.
  debut = performance.now();
  readProducts("<script type='application/ld+json'>".repeat(20_000));
  assert.ok(performance.now() - debut < 10_000);
});

test('production : encodages inattendus', () => {
  for (const nom of ['Moulin à café Lumière', 'Bouilloire 🫖 Lumière',
    'Moulin à café', 'Moulin « Lumière »']) {
    const bloc = produit().replace('Moulin à café Lumière', nom);
    assert.equal(readProducts(page(bloc)).products[0].name, nom, nom);
  }
  const bloc = produit().replace('"Moulin à café Lumière"', '"  Moulin à café Lumière  "');
  assert.equal(readProducts(page(bloc)).products[0].name, 'Moulin à café Lumière');
});

test('production : valeurs aux limites', () => {
  assert.deepEqual(readProducts(page('')).products, []);
  assert.deepEqual(readProducts(page('null')).products, []);
  assert.deepEqual(readProducts(page('["Product"]')).products, []);
  const bloc = produit().replace('"@type":"Product"', '"@type":["Product","Thing"]');
  assert.equal(readProducts(page(bloc)).products[0].sku, 'MC-4501');
  const sansOffre = JSON.stringify({ '@type': 'Product', name: 'Moulin' });
  const lu = readProducts(page(sansOffre)).products[0];
  assert.deepEqual([lu.price, lu.currency, lu.availability], [null, null, null]);
});

test("production : un bloc cassé n'empêche pas de lire les autres", () => {
  const deux = page("{ceci n'est pas du JSON").replace(
    '</head>', `<script type="application/ld+json">${produit()}</script></head>`,
  );
  assert.equal(readProducts(deux).products[0].sku, 'MC-4501');
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) readProducts(EN_ACCORD);
  assert.ok(performance.now() - debut < 20_000);
});
