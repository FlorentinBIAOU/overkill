#!/usr/bin/env node
/**
 * Audit d'accessibilité automatisé (CDC 11.2, contrôle 6).
 *
 *   « audit automatisé sur l'accueil, une page de famille et une page de fiche »
 *
 * Il tourne axe-core dans un navigateur réel sur le site construit, en clair et
 * en sombre. Toute violation de niveau sérieux ou critique fait échouer le
 * contrôle ; les niveaux mineur et modéré sont affichés en avertissement.
 *
 * À cela s'ajoutent cinq contrôles structurels qu'axe ne fait pas, et qui se
 * scriptent sans ambiguïté (lot 14 partie 9.3) :
 *
 *   1. le texte alternatif ne ment pas : pas de nom de fichier, pas de
 *      « image de », pas de roman de deux cents caractères ;
 *   2. aucun libellé de lien générique — « cliquez ici », « en savoir plus » —,
 *      dans les deux langues : hors contexte, un tel lien ne dit rien ;
 *   3. les identifiants sont uniques, y compris ceux qui ne servent qu'à lier
 *      un libellé à son champ, qu'axe ne regarde plus ;
 *   4. chaque repère de navigation porte un nom, et deux repères ne portent
 *      pas le même : c'est ce nom que le lecteur d'écran annonce ;
 *   5. le lien d'évitement est le premier élément focalisable et pointe vers
 *      le contenu principal.
 *
 * Un audit automatisé ne voit quand même qu'une partie du sujet. Ce qu'il ne
 * voit pas — la pertinence d'un texte alternatif, un libellé lu hors contexte,
 * l'ordre de tabulation réel, l'annonce d'un composant qui se met à jour — est
 * vérifié par tests/components.spec.mjs et par une relecture manuelle
 * consignée au rapport.
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './shot.mjs';

const PAGES = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (PAGES.length === 0) {
  console.error('usage : node scripts/check-a11y.mjs <chemin> [chemin...]');
  process.exit(1);
}

const THEMES = ['light', 'dark'];
const BLOQUANT = new Set(['serious', 'critical']);

const serveur = await serve();
const base = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();

const bloquantes = [];
const avertissements = [];
const structurels = [];
let analysees = 0;

/*
 * Libellés qui ne disent rien hors contexte. La liste est courte et tenue à la
 * main : un contrôle qui crie au loup finit ignoré.
 */
const LIBELLES_VIDES = [
  'ici', 'cliquez ici', 'cliquer ici', 'ce lien', 'en savoir plus', 'lire la suite',
  'lire plus', 'plus', 'voir', 'voir plus', 'suite', 'détails',
  'here', 'click here', 'this link', 'read more', 'learn more', 'more', 'see more',
  'link', 'details', 'continue',
];

for (const chemin of PAGES) {
  for (const theme of THEMES) {
    // axe-core exige un contexte explicite, et non une page ouverte
    // directement sur le navigateur.
    const contexte = await navigateur.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
    });
    const page = await contexte.newPage();
    await page.goto(base + chemin, { waitUntil: 'networkidle' });

    const resultats = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    analysees++;

    /* Les contrôles structurels ne dépendent pas du thème : une seule passe. */
    if (theme === THEMES[0]) {
      const trouves = await page.evaluate((libellesVides) => {
        const soucis = [];
        const normaliser = (t) =>
          (t ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .replace(/[.:;!?»«"'’\u2026]+$/g, '')
            .trim();

        // 1. texte alternatif
        for (const img of document.querySelectorAll('img')) {
          const alt = img.getAttribute('alt');
          const ou = img.getAttribute('src') ?? '(sans src)';
          if (alt === null) {
            soucis.push(`img sans attribut alt : ${ou}`);
            continue;
          }
          if (alt === '') continue; // décoratif, assumé
          if (/\.(png|jpe?g|svg|webp|avif|gif)\b/i.test(alt)) {
            soucis.push(`alt qui recopie un nom de fichier : « ${alt} »`);
          }
          /* « photo de », « picture of » : la nature de l'élément est déjà
             annoncée par le lecteur d'écran. La tournure française « image de
             remplacement » est en revanche un nom d'objet, pas un préfixe :
             le motif ne retient donc que les formes sans ambiguïté. */
          if (/^(photo|picture|illustration|capture d'écran|logo|icône|icon)\s+(de|du|des|of|d')/i.test(alt) ||
              /^image of\b/i.test(alt)) {
            soucis.push(`alt préfixé de sa nature : « ${alt} »`);
          }
          if (alt.length > 200) {
            soucis.push(`alt de ${alt.length} caractères, à déplacer dans le texte : ${ou}`);
          }
        }

        // 2. libellés de lien
        for (const a of document.querySelectorAll('a[href]')) {
          if (a.closest('[hidden]')) continue;
          const nom = normaliser(a.getAttribute('aria-label') ?? a.textContent);
          if (nom === '') {
            const image = a.querySelector('img[alt]:not([alt=""])');
            if (!image) soucis.push(`lien sans libellé : ${a.getAttribute('href')}`);
            continue;
          }
          if (libellesVides.includes(nom)) {
            soucis.push(`libellé de lien vide de sens : « ${nom} » → ${a.getAttribute('href')}`);
          }
        }

        // 3. unicité des identifiants
        const vus = new Map();
        for (const el of document.querySelectorAll('[id]')) {
          vus.set(el.id, (vus.get(el.id) ?? 0) + 1);
        }
        for (const [id, n] of vus) {
          if (n > 1) soucis.push(`identifiant en double (${n} fois) : #${id}`);
        }

        // 4. repères de navigation
        const noms = new Map();
        for (const nav of document.querySelectorAll('nav, [role="navigation"]')) {
          const etiquette =
            nav.getAttribute('aria-label') ??
            document.getElementById(nav.getAttribute('aria-labelledby') ?? '')?.textContent;
          const nom = normaliser(etiquette);
          if (nom === '') {
            soucis.push(`repère de navigation sans nom : ${nav.className || nav.tagName.toLowerCase()}`);
            continue;
          }
          noms.set(nom, (noms.get(nom) ?? 0) + 1);
        }
        for (const [nom, n] of noms) {
          if (n > 1) soucis.push(`deux repères de navigation nommés « ${nom} »`);
        }

        // 5. lien d'évitement
        const focalisables = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex^="-"])')];
        const premier = focalisables[0];
        const cible = premier?.getAttribute('href') ?? '';
        if (!premier || !cible.startsWith('#')) {
          soucis.push("le premier élément focalisable n'est pas un lien d'évitement");
        } else if (!document.querySelector(cible)) {
          soucis.push(`le lien d'évitement pointe vers ${cible}, qui n'existe pas`);
        }

        return soucis;
      }, LIBELLES_VIDES);

      for (const souci of trouves) structurels.push({ ou: chemin, souci });
    }
    for (const v of resultats.violations) {
      const ligne = {
        ou: `${chemin} (${theme})`,
        id: v.id,
        impact: v.impact,
        description: v.help,
        cibles: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      };
      (BLOQUANT.has(v.impact) ? bloquantes : avertissements).push(ligne);
    }
    await page.close();
    await contexte.close();
  }
}

await navigateur.close();
serveur.close();

console.log(
  `\ncheck-a11y — ${PAGES.length} page(s), ${analysees} analyse(s) axe, clair et sombre,` +
    ` ${PAGES.length} contrôle(s) structurel(s)\n`,
);

const afficher = (liste, marque) => {
  for (const v of liste) {
    console.log(`  ${marque} ${v.ou}  [${v.impact}] ${v.id}`);
    console.log(`      ${v.description}`);
    for (const c of v.cibles) console.log(`      ${c}`);
  }
};

if (avertissements.length) {
  console.log(`  ${avertissements.length} avertissement(s), non bloquant(s) :\n`);
  afficher(avertissements, '!');
  console.log('');
}

if (structurels.length) {
  console.error(`check-a11y : ${structurels.length} défaut(s) de structure\n`);
  for (const s of structurels) console.error(`  ✗ ${s.ou}  ${s.souci}`);
  console.error('');
}

if (bloquantes.length || structurels.length) {
  if (bloquantes.length) {
    console.error(`check-a11y : ${bloquantes.length} violation(s) bloquante(s)\n`);
    afficher(bloquantes, '✗');
    console.error('');
  }
  process.exit(1);
}

console.log('check-a11y : aucune violation sérieuse ni critique\n');
