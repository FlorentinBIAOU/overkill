#!/usr/bin/env node
/**
 * Ce qu'une fiche donne à coller ailleurs, produit à la construction du site :
 * son image de partage, et son badge de README.
 *
 * Jusqu'ici, une seule image servait tout le site : un lien de fiche collé sur
 * un réseau social ne disait pas de quelle fiche il s'agissait. Chaque fiche a
 * désormais la sienne, qui porte son titre et son verdict en grand sur l'aplat
 * de marque — « Masquer les coordonnées dans un message · Pas besoin d'IA ».
 *
 * Rendue par le navigateur déjà présent dans les dépendances de développement,
 * et non par une bibliothèque d'images ajoutée pour l'occasion : le site se
 * sert de ses propres polices, de ses propres tokens, et aucune dépendance de
 * production n'entre au dépôt.
 *
 * Les fichiers sont écrits dans `public/og/<langue>/<id>.png` et
 * `public/badge/<langue>/<id>.png`, chemins que les pages annoncent. Aucun nom
 * haché : l'adresse doit rester prévisible pour que la page puisse la nommer
 * avant que l'image existe, et pour qu'un badge collé dans un README d'il y a
 * deux ans continue de s'afficher.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import matter from 'gray-matter';
import { readdir } from 'node:fs/promises';
import { serve } from './shot.mjs';
import fr from '../src/i18n/fr.ts';
import en from '../src/i18n/en.ts';

const STRINGS = { fr: fr.default ?? fr, en: en.default ?? en };
const LARGEUR = 1200;
const HAUTEUR = 630;

/** Les fiches publiées, lues à la source pour ne dépendre d'aucun build. */
async function fiches() {
  const dossier = 'content/entries';
  const noms = (await readdir(dossier)).filter((f) => f.endsWith('.mdx') && !f.startsWith('_'));
  const out = [];
  for (const nom of noms) {
    const { data } = matter(await readFile(join(dossier, nom), 'utf8'));
    if (data.status === 'published') out.push(data);
  }
  return out;
}

/**
 * Le gabarit. Les couleurs sont celles des tokens, recopiées ici parce qu'une
 * image n'a pas de feuille de style du site à charger — et parce que l'aplat
 * de marque ne suit pas le thème, il est toujours le même.
 */
function gabarit({ base, titre, reponse, niveau, langue }) {
  const site = langue === 'fr' ? 'isitoverkill.dev' : 'isitoverkill.dev';
  return `<!doctype html>
<html lang="${langue}"><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'Bricolage Grotesque';
    src: url('${base}/fonts/bricolage-grotesque-display.woff2') format('woff2');
    font-weight: 400 800;
    font-display: block;
  }
  @font-face {
    font-family: 'Inter';
    src: url('${base}/fonts/inter-600.woff2') format('woff2');
    font-weight: 600;
    font-display: block;
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${LARGEUR}px; height: ${HAUTEUR}px;
    background: #FFCE00; color: #16130E;
    padding: 64px 72px;
    display: flex; flex-direction: column; justify-content: space-between;
    font-family: 'Inter', sans-serif;
  }
  .marque { display: flex; align-items: center; gap: 16px; font-weight: 600; font-size: 30px; }
  .carre { width: 26px; height: 26px; background: #16130E; }
  h1 {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-weight: 800; letter-spacing: -0.035em; line-height: 0.98;
    font-size: ${titre.length > 58 ? 74 : titre.length > 38 ? 88 : 104}px;
    text-wrap: balance;
  }
  .bas { display: flex; align-items: center; justify-content: space-between; gap: 32px; }
  .reponse {
    background: #16130E; color: #FFFDF7;
    font-family: 'Bricolage Grotesque', sans-serif;
    font-weight: 800; font-size: 44px; letter-spacing: -0.02em;
    padding: 18px 34px; border-radius: 999px; white-space: nowrap;
  }
  .site { font-size: 26px; opacity: 0.72; }
  .niveau { font-family: 'Inter', monospace; font-size: 26px; opacity: 0.72; }
</style></head>
<body>
  <p class="marque"><span class="carre"></span>Overkill</p>
  <h1>${titre}</h1>
  <div class="bas">
    <p class="reponse">${reponse}</p>
    <p class="site">${site} <span class="niveau">· ${niveau}</span></p>
  </div>
</body></html>`;
}

/**
 * Le badge à coller dans un README.
 *
 * Deux parties, comme les badges qu'on trouve en tête des dépôts : le nom du
 * site sur l'encre, le verdict sur l'aplat de marque. La largeur n'est pas
 * calculée à la main — le navigateur mesure le texte, et la capture suit
 * l'élément. Rendu au double de la taille d'affichage, pour rester net.
 */
function gabaritBadge({ base, verifie, reponse }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'Inter';
    src: url('${base}/fonts/inter-600.woff2') format('woff2');
    font-weight: 600;
    font-display: block;
  }
  * { margin: 0; box-sizing: border-box; }
  body { background: transparent; }
  .badge {
    display: inline-flex; align-items: stretch;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 26px;
    line-height: 1; border-radius: 8px; overflow: hidden;
  }
  /* Les deux moitiés seulement : sans le sélecteur d'enfant direct, le carré
     de marque héritait de la hauteur et du padding, et devenait un bloc. */
  .badge > span { display: flex; align-items: center; padding: 0 20px; height: 56px; }
  .gauche { background: #16130E; color: #FFFDF7; gap: 12px; }
  .carre { width: 16px; height: 16px; background: #FFCE00; }
  .droite { background: #FFCE00; color: #16130E; }
</style></head>
<body><span class="badge">
  <span class="gauche"><span class="carre"></span>${verifie}</span>
  <span class="droite">${reponse}</span>
</span></body></html>`;
}

const echappe = (t) =>
  String(t).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const serveur = await serve();
const base = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();
const page = await navigateur.newPage({
  viewport: { width: LARGEUR, height: HAUTEUR },
  deviceScaleFactor: 1,
});

const publiees = await fiches();
let ecrites = 0;
let badges = 0;

const pageBadge = await navigateur.newPage({
  viewport: { width: 900, height: 120 },
  deviceScaleFactor: 2,
});

for (const langue of ['fr', 'en']) {
  const dossierOg = join('public', 'og', langue);
  const dossierBadge = join('public', 'badge', langue);
  await mkdir(dossierOg, { recursive: true });
  await mkdir(dossierBadge, { recursive: true });

  for (const fiche of publiees) {
    const reponse = STRINGS[langue].rung.answer[fiche.verdict];

    await page.setContent(
      gabarit({
        base,
        titre: echappe(fiche.title[langue]),
        reponse: echappe(reponse),
        niveau: fiche.verdict,
        langue,
      }),
      { waitUntil: 'load' },
    );
    await page.evaluate(() => document.fonts.ready);
    await writeFile(join(dossierOg, `${fiche.id}.png`), await page.screenshot({ type: 'png' }));
    ecrites += 1;

    await pageBadge.setContent(
      gabaritBadge({
        base,
        verifie: echappe(STRINGS[langue].share.badgeVerified),
        reponse: echappe(reponse),
      }),
      { waitUntil: 'load' },
    );
    await pageBadge.evaluate(() => document.fonts.ready);
    await writeFile(
      join(dossierBadge, `${fiche.id}.png`),
      await pageBadge.locator('.badge').screenshot({ type: 'png', omitBackground: true }),
    );
    badges += 1;
  }
}

await navigateur.close();
serveur.close();

console.log(
  `\nbuild-share-assets — ${ecrites} image(s) de partage ${LARGEUR}×${HAUTEUR} ` +
    `et ${badges} badge(s), ${publiees.length} fiche(s) × 2 langues\n`,
);
