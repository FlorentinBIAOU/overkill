#!/usr/bin/env node
/**
 * Interdit numéro 2 du cahier des charges : n'invente aucun chiffre.
 *
 *   « Pas de prix absolu, pas de gCO₂e sans méthodologie citée, pas de
 *     benchmark non réalisé. En l'absence de source, utilise le vocabulaire
 *     d'ordre de grandeur ou n'affirme rien. »
 *
 * Ce contrôle cherche les formes chiffrées interdites dans tout ce qui est
 * publié : le contenu des fiches, les pages éditoriales, et les commentaires
 * des extraits de code, qui sont affichés sur le site.
 *
 * Il ne remplace pas la relecture. Il attrape les formes, pas les affirmations.
 * Ce qu'il ne voit pas, la charte de rédaction l'interdit en amont.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const RACINES = [process.env.OVERKILL_CONTENU ?? 'content'];
const EXTENSIONS = new Set(['.mdx', '.md', '.py', '.js', '.mjs', '.yaml']);

/*
 * Un nombre écrit en toutes lettres, tel qu'il apparaît dans un facteur :
 * « cinquante-cinq », « six mille », et leurs équivalents anglais
 * (`fifty-five`, `six thousand`).
 *
 * « un » et « une » n'y sont pas : « divisé par une expression régulière » se
 * lirait comme un facteur, et un facteur de un ne se publie pas.
 */
const LETTRES_FR =
  '(?:cinquante|quarante|soixante|quatorze|quinze|seize|treize|douze|onze|dix|deux|trois|quatre|cinq|six|sept|huit|neuf|vingt|trente|cents?|mille)'
  + '(?:[-\\s](?:et[-\\s])?(?:un|cinquante|quarante|soixante|quatorze|quinze|seize|treize|douze|onze|dix|deux|trois|quatre|cinq|six|sept|huit|neuf|vingt|trente|cents?|mille))*';

const LETTRES_EN =
  '(?:fifty|sixty|seventy|eighty|ninety|twelve|eleven|twenty|thirty|forty|hundred|thousand|million|ten|two|three|four|five|six|seven|eight|nine)'
  + '(?:[-\\s](?:and[-\\s])?(?:one|fifty|sixty|seventy|eighty|ninety|twelve|eleven|twenty|thirty|forty|hundred|thousand|million|ten|two|three|four|five|six|seven|eight|nine))*';

/** Ce qu'on cherche, et pourquoi c'est interdit. */
const MOTIFS = [
  {
    nom: 'prix absolu',
    /*
     * Le dollar ne se cherche qu'avant le nombre, comme il s'écrit vraiment.
     * Le chercher après attraperait « %1$s » et « ${variable} », qui sont des
     * chaînes de format et des littéraux gabarits, pas des prix.
     * L'euro et la livre se cherchent des deux côtés, comme ils s'écrivent.
     */
    motif:
      /(?<![\w.%])(?:[€£]\s?\d|\$\s?\d|\d[\d\s.,]*\s?(?:[€£]|(?:euros?|dollars?|centimes?|cents?)\b))/gi,
    raison: 'les tarifs changent tous les trimestres ; employer le vocabulaire de la section 4.5',
  },
  {
    nom: 'empreinte chiffrée',
    motif: /\d[\d\s.,]*\s?(?:g\s?CO2e?|gCO₂e|kg\s?CO2|tonnes?\s?de\s?CO2|kWh|watts?|joules?)/gi,
    raison: 'toute affirmation chiffrée sur l\'empreinte doit citer une méthodologie publiée',
  },
  {
    /*
     * Un facteur est un chiffre de performance. Le relevé du lot 17 l'a montré
     * sur une fiche acceptée : « ×55 » et « ×6 000 » étaient publiés sur la
     * page, et le seul test qui les approchait affirmait « garde × 5 <
     * recompile ». La fiche aurait pu annoncer trois ordres de grandeur de
     * plus sans qu'un test bouge.
     *
     * Les quatre écritures d'un facteur sont cherchées, en chiffres comme en
     * lettres : « ×55 », « 55 fois plus rapide », « divise par 55 », et
     * « divise le temps par cinquante-cinq ». Écrire le nombre en toutes
     * lettres n'en fait pas un ordre de grandeur : « cinquante-cinq » est
     * aussi précis que « 55 ». Ce que la section 4.5 autorise, c'est
     * « deux ordres de grandeur », qui ne nomme aucun nombre.
     */
    nom: 'performance non mesurée',
    motif: new RegExp(
      [
        `\\b\\d+(?:[.,]\\d+)?\\s?(?:x|fois)\\s+(?:plus|moins|faster|slower|cheaper|rapide|vite|lent)\\b`,
        `(?<![\\w.,])×\\s?\\d+`,
        `\\bdivis(?:e|ent|é|ée|és|ées)\\b[^.]{0,40}?\\bpar\\s+(?:\\d+(?:[.,]\\d+)?|${LETTRES_FR})`,
        `\\bmultipli(?:e|ent|é|ée|és|ées)\\b[^.]{0,40}?\\bpar\\s+(?:\\d+(?:[.,]\\d+)?|${LETTRES_FR})`,
        `\\bdivides?\\b[^.]{0,40}?\\bby\\s+(?:\\d+(?:[.,]\\d+)?|${LETTRES_EN})`,
        `\\bmultiplies?\\b[^.]{0,40}?\\bby\\s+(?:\\d+(?:[.,]\\d+)?|${LETTRES_EN})`,
        `\\b\\d{2,3}\\s?%\\s+(?:de\\s+)?(?:précision|exactitude|rappel|accuracy|precision|recall|f1)\\b`,
      ].join('|'),
      'gi',
    ),
    raison: 'un chiffre de performance exige un banc d\'essai réellement exécuté',
  },
  {
    /*
     * Une taille annoncée avec un nombre est une mesure, et une mesure exige
     * d'avoir été faite. « Quelques mégaoctets », sans nombre, est un ordre de
     * grandeur exprimé en mots : c'est exactement ce que la section 4.5 du CDC
     * demande d'employer à la place d'un chiffre, et le CDC s'en sert lui-même
     * en section 1.1. Le contrôle ne cherche donc que les formes chiffrées.
     */
    nom: 'taille annoncée sans mesure',
    motif:
      /\b(?:environ|about|roughly|autour de|près de)?\s*\d+(?:[.,]\d+)?\s?(?:kilooctets?|mégaoctets?|gigaoctets?|téraoctets?|kilobytes?|megabytes?|gigabytes?|terabytes?|Ko|Mo|Go|To|KB|MB|GB|TB)\b/g,
    raison: 'une taille annoncée avec un nombre exige une mesure réelle',
  },
  {
    nom: 'latence affirmée hors classes',
    motif:
      /\b(?:under|less than|moins de|sous)\s+(?:a|one|un|une|\d+)\s?(?:milliseconde?s?|millisecondes?|ms|secondes?|seconds?)\b/gi,
    raison: 'la latence se déclare dans le frontmatter, avec les cinq classes de la section 4.5',
  },
];

/**
 * Contextes où un nombre est une donnée et non une affirmation : jeux de test,
 * paramètres d'exemple, constantes d'algorithme.
 */
const EXCEPTIONS = [
  /\.test\.(py|js)$/, // les jeux de test contiennent des données chiffrées
];

/**
 * Une région de données fictives, déclarée dans le fichier lui-même.
 *
 * Une facture d'exemple porte des montants : ce sont les données que l'extrait
 * doit lire, pas un tarif que le site affirme. Le contrôle ne peut pas faire
 * la différence tout seul, donc le fichier la déclare, et la déclaration dit
 * pourquoi. Elle se cherche avec `grep 'données-fictives'`, et elle reste
 * étroite : une phrase affichée qui annoncerait un prix de fournisseur est
 * toujours refusée, même dans le même fichier.
 *
 *   // données-fictives:début — une facture d'exemple, montants compris
 *   ...
 *   // données-fictives:fin
 */
const OUVRE_FICTIF = /données-fictives:début/;
const FERME_FICTIF = /données-fictives:fin/;

async function* parcourir(dossier) {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    if (e.name.startsWith('_') && e.isDirectory()) continue;
    const p = join(dossier, e.name);
    if (e.isDirectory()) yield* parcourir(p);
    else if (EXTENSIONS.has(extname(p))) yield p;
  }
}

const trouvailles = [];

for (const racine of RACINES) {
  if (!existsSync(racine)) continue;
  for await (const fichier of parcourir(racine)) {
    if (EXCEPTIONS.some((e) => e.test(fichier))) continue;
    const texte = await readFile(fichier, 'utf8');
    const lignes = texte.split('\n');

    /* Les lignes déclarées comme données fictives, marqueurs compris. */
    const fictives = new Set();
    let dedans = false;
    lignes.forEach((ligne, i) => {
      if (OUVRE_FICTIF.test(ligne)) dedans = true;
      if (dedans) fictives.add(i);
      if (FERME_FICTIF.test(ligne)) dedans = false;
    });
    if (dedans) {
      trouvailles.push({
        ou: fichier,
        nom: 'région de données fictives non fermée',
        raison: 'ajouter le marqueur « données-fictives:fin » là où la région s\'arrête',
        extrait: '',
        trouve: 'données-fictives:début',
      });
    }

    for (const { nom, motif, raison } of MOTIFS) {
      lignes.forEach((ligne, i) => {
        if (fictives.has(i)) return;
        motif.lastIndex = 0;
        const trouve = ligne.match(motif);
        if (trouve) {
          trouvailles.push({
            ou: `${fichier}:${i + 1}`,
            nom,
            raison,
            extrait: ligne.trim().slice(0, 100),
            trouve: trouve.join(', '),
          });
        }
      });
    }
  }
}

if (trouvailles.length) {
  console.error(`\ncheck-figures : ${trouvailles.length} chiffre(s) interdit(s)\n`);
  for (const t of trouvailles) {
    console.error(`  ✗ ${t.ou}  [${t.nom}] « ${t.trouve} »`);
    console.error(`      ${t.extrait}`);
    console.error(`      ${t.raison}\n`);
  }
  process.exit(1);
}

console.log('check-figures : OK — aucun prix absolu, aucune empreinte chiffrée, aucun banc d\'essai affirmé');
