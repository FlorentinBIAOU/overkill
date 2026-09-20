import test from 'node:test';
import assert from 'node:assert/strict';

import { extractLinks } from './n0.js';

const BASE = 'https://exemple.fr/blog/';

// Une page ordinaire : des liens relatifs, un lien externe, une ancre, un
// courriel, et deux choses qui ne sont pas des adresses.
const PAGE = `<!doctype html><html><head><title>Le blog</title></head><body>
<a href="article">L'article</a>
<a href="/racine" rel="nofollow">Racine</a>
<a href="../haut">Un cran au-dessus</a>
<a href="https://autre.fr/page">Chez les voisins</a>
<a href="#ancre">Ancre</a>
<a href="mailto:jean@exemple.fr">&Eacute;crire</a>
<a href="tel:+33123456789">Appeler</a>
<a href="javascript:alert(1)">Script</a>
<a>Sans href</a>
<a href="  ">Vide</a>
</body></html>`;

// La même page, avec un élément <base> qui change tout.
const AVEC_BASE = PAGE.replace('<title>', '<base href="https://exemple.fr/v2/"><title>');

const pageDe = (...hrefs) => `<!doctype html><html><body>${
  hrefs.map((href) => `<a href="${href}">x</a>`).join('')}</body></html>`;

const urls = (html, base = BASE) => extractLinks(html, base).links.map((l) => l.url);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une base fausse rend des adresses valides et fausses', () => {
  assert.equal(urls(PAGE, 'https://exemple.fr/blog/')[0], 'https://exemple.fr/blog/article');
  assert.equal(urls(PAGE, 'https://www.exemple.fr/blog/2026/')[0],
    'https://www.exemple.fr/blog/2026/article');
  assert.equal(extractLinks(PAGE, 'https://www.exemple.fr/blog/2026/').reason, null);
});

test('point de rupture : témoin, la base employée est rendue dans le rapport', () => {
  assert.equal(extractLinks(PAGE, BASE).base, BASE);
  const rapport = extractLinks(AVEC_BASE, BASE);
  assert.equal(rapport.base, 'https://exemple.fr/v2/');
  assert.equal(rapport.links[0].url, 'https://exemple.fr/v2/article');
});

// ---------------------------------------------------------------------------
// Le verdict, confronté aux données de la fiche
// ---------------------------------------------------------------------------

test("verdict : un antislash ne va pas où l'on croit", () => {
  assert.deepEqual(urls(pageDe('\\\\chemin')), ['https://chemin/']);
  assert.deepEqual(urls(pageDe('\\chemin')), ['https://exemple.fr/chemin']);
  assert.deepEqual(urls(pageDe('chemin')), ['https://exemple.fr/blog/chemin']);
});

test('verdict : les six autres divergences mesurées sont fermées', () => {
  assert.deepEqual(urls(pageDe(' https://exemple.fr/espace ')), ['https://exemple.fr/espace']);
  assert.deepEqual(urls(pageDe('https://café.fr/page')), ['https://xn--caf-dma.fr/page']);
  assert.deepEqual(urls(pageDe('HTTPS://EXEMPLE.FR/MAJ')), ['https://exemple.fr/MAJ']);
  assert.deepEqual(urls(pageDe('/a b c')), ['https://exemple.fr/a%20b%20c']);
  assert.deepEqual(urls(pageDe('/é')), ['https://exemple.fr/%C3%A9']);
  assert.deepEqual(urls(pageDe('https://exemple.fr:443/p')), ['https://exemple.fr/p']);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la base est exigée', () => {
  for (const base of [null, undefined, '', '   ', 42]) {
    const rapport = extractLinks(PAGE, base);
    assert.deepEqual(rapport.links, []);
    assert.equal(rapport.reason, 'the address the page was served from is required');
  }
});

test("ce qui n'est pas une adresse est écarté avec sa raison", () => {
  assert.deepEqual(extractLinks(PAGE, BASE).skipped, [
    { href: 'javascript:alert(1)', why: 'javascript is not an address' },
    { href: null, why: 'no address' },
    { href: '  ', why: 'no address' },
  ]);
});

test('chaque lien porte son genre', () => {
  assert.deepEqual(extractLinks(PAGE, BASE).links.map((l) => l.kind),
    ['page', 'page', 'page', 'page', 'anchor', 'mail', 'phone']);
});

test('le texte du lien est rendu, entités décodées', () => {
  const textes = extractLinks(PAGE, BASE).links.map((l) => l.text);
  assert.equal(textes[0], "L'article");
  assert.equal(textes[5], 'Écrire');
  const riche = pageDe('x').replace('>x<', '><em>Café</em> chez eux<');
  assert.equal(extractLinks(riche, BASE).links[0].text, 'Café chez eux');
});

test('le rel est rendu tel quel', () => {
  const liens = extractLinks(PAGE, BASE).links;
  assert.equal(liens[1].rel, 'nofollow');
  assert.equal(liens[0].rel, null);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 42, [], {}]) {
    assert.deepEqual(extractLinks(entree, BASE).links, []);
  }
  assert.deepEqual(extractLinks('<a href=', BASE).links, []);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, une page de blog', () => {
  assert.deepEqual(urls(PAGE).slice(0, 4), [
    'https://exemple.fr/blog/article',
    'https://exemple.fr/racine',
    'https://exemple.fr/haut',
    'https://autre.fr/page',
  ]);
});

test('production : entrée vide', () => {
  assert.deepEqual(extractLinks('', BASE),
    { links: [], skipped: [], base: BASE, reason: null });
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = `<html><body>${'<a href="a">x</a>'.repeat(50_000)}</body></html>`;
  const debut = performance.now();
  const rapport = extractLinks(enorme, BASE);
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.links.length, 50_000);
});

test('production : encodages inattendus', () => {
  assert.deepEqual(urls(pageDe('/déjà%20encodé')),
    ['https://exemple.fr/d%C3%A9j%C3%A0%20encod%C3%A9']);
  assert.deepEqual(urls(pageDe('\ta\nb\rc')), ['https://exemple.fr/blog/abc']);
  assert.ok(extractLinks(`﻿${PAGE}`, BASE).links[0].url.endsWith('/article'));
});

test('production : valeurs aux limites', () => {
  assert.deepEqual(urls(pageDe('?')), ['https://exemple.fr/blog/?']);
  assert.deepEqual(urls(pageDe('#')), ['https://exemple.fr/blog/#']);
  assert.deepEqual(urls(pageDe('https://exemple.fr')), ['https://exemple.fr/']);
  assert.deepEqual(urls(pageDe('//exemple.fr\\evil.com/')), ['https://exemple.fr/evil.com/']);
});

test("production : un lien illisible n'empêche pas de lire les autres", () => {
  assert.deepEqual(urls(pageDe('javascript:x', 'article', '')),
    ['https://exemple.fr/blog/article']);
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) extractLinks(PAGE, BASE);
  assert.ok(performance.now() - debut < 20_000);
});
