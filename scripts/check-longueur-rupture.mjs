#!/usr/bin/env node
/**
 * Règle R11 de la charte de rédaction : `breaking_point`, deux phrases,
 * soixante mots.
 *
 *   « Sur les 74 points de rupture du catalogue relus au lot 15, 68
 *     dépassaient soixante mots : ils ne se lisaient plus. »
 *
 * La règle est écrite en toutes lettres depuis le lot 16, et la relecture du
 * lot 17 l'a trouvée enfreinte vingt-cinq fois sur vingt-cinq : 79 mots de
 * moyenne, 66 sur les quatorze premières fiches et 90 sur les onze dernières.
 * Une règle qui porte un nombre et qu'aucun contrôle ne vérifie dérive
 * toujours dans le même sens, parce qu'il y a toujours une bonne raison
 * d'ajouter une phrase. C'est le chemin qu'a suivi `check-marquages` ; celui-ci
 * le refait pour R11.
 *
 * La troisième phrase qu'on veut ajouter a presque toujours sa place dans la
 * docstring de l'extrait : c'est le renvoi, le cas voisin, ou l'alternative
 * écartée.
 *
 * ## La dette
 *
 * Le catalogue comptait 166 points de rupture hors limite le jour où ce
 * contrôle a été écrit — 166 sur 208 —, dans 41 fiches, dont 29 hors du
 * périmètre du lot 18.
 * Les réécrire toutes d'un coup aurait touché des fiches que personne n'a
 * relues, et dont les tests citent les exemples mot pour mot. La dette est donc
 * déclarée dans `scripts/dette-rupture.json`, et elle ne peut que diminuer :
 *
 *   - un point de rupture hors limite absent de la dette fait échouer ;
 *   - une ligne de dette dont le point de rupture tient désormais dans la
 *     limite fait échouer, pour qu'on la retire ;
 *   - une ligne de dette qui ne désigne plus rien fait échouer.
 *
 * Aucune ligne ne s'ajoute à ce fichier : il se vide.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

/** Le dossier des fiches. Déplaçable pour que la suite de tests valide le
 *  contrôle sur un contenu jetable, sans toucher au contenu réel. */
const FICHES = process.env.OVERKILL_ENTRIES ?? 'content/entries';
const DETTE = 'scripts/dette-rupture.json';

/** R11, en chiffres. */
export const MAX_PHRASES = 2;
export const MAX_MOTS = 60;

/**
 * Compte les phrases d'un point de rupture.
 *
 * Une fin de phrase est un point, un point d'exclamation, d'interrogation ou
 * de suspension suivi de la fin du texte, ou d'un début de phrase : une
 * majuscule, un chiffre, ou un guillemet ouvrant. Les guillemets fermants
 * traversés au passage ne comptent pas, la citation pouvant se terminer avec
 * la phrase. Ce détour évite de compter « M. » comme une phrase — ce qui suit
 * le guillemet fermant y est en minuscules, donc la phrase continue —, ce
 * qu'un découpage naïf fait à chaque nom de personne cité.
 */
export function compterPhrases(texte) {
  const fins = texte.match(/[.!?…]+(?=(?:\s*[»”"')\]])*(?:\s+[«“"(]?[A-ZÀ-ÞŒ0-9]|\s*$))/g);
  return fins ? fins.length : 1;
}

/**
 * Compte les mots d'un point de rupture.
 *
 * Un mot est une suite de caractères séparée par des espaces qui porte au
 * moins une lettre ou un chiffre. Les tirets cadratins et les guillemets
 * isolés, qui sont de la ponctuation détachée en typographie française, ne
 * comptent pas : les faire compter gonflerait la mesure d'une manière qui
 * dépend de la langue et pas de ce qu'on lit.
 */
export function compterMots(texte) {
  return texte.split(/\s+/).filter((jeton) => /[\p{L}\p{N}]/u.test(jeton)).length;
}

/** Les points de rupture d'une fiche publiée, un par niveau et par langue. */
export function pointsDeRupture(fiche) {
  const points = [];
  for (const rung of fiche.rungs ?? []) {
    for (const langue of ['fr', 'en']) {
      const texte = rung.breaking_point?.[langue];
      if (typeof texte !== 'string' || !texte.trim()) continue;
      points.push({
        cle: `${fiche.id}#${rung.level}.${langue}`,
        texte: texte.trim(),
        phrases: compterPhrases(texte.trim()),
        mots: compterMots(texte.trim()),
      });
    }
  }
  return points;
}

const horsLimite = (p) => p.phrases > MAX_PHRASES || p.mots > MAX_MOTS;

// ------------------------------------------------------------------ exécution

if (import.meta.url === `file://${process.argv[1]}`) {
  const dette = new Set(JSON.parse(await readFile(DETTE, 'utf8')).dette);
  const vus = new Set();
  const trop = [];
  const perimes = [];
  let total = 0;

  const fichiers = (await readdir(FICHES)).filter((f) => f.endsWith('.mdx') && !f.startsWith('_'));
  for (const fichier of fichiers) {
    const { data } = matter(await readFile(join(FICHES, fichier), 'utf8'));
    if (data.status !== 'published') continue;

    for (const point of pointsDeRupture(data)) {
      total += 1;
      vus.add(point.cle);
      if (horsLimite(point)) {
        if (!dette.has(point.cle)) trop.push(point);
      } else if (dette.has(point.cle)) {
        perimes.push({ cle: point.cle, pourquoi: `tient dans la limite (${point.phrases} phrase(s), ${point.mots} mots)` });
      }
    }
  }

  for (const cle of dette) {
    if (!vus.has(cle)) perimes.push({ cle, pourquoi: 'ne désigne plus aucun point de rupture publié' });
  }

  if (trop.length || perimes.length) {
    console.error(`\ncheck-longueur-rupture : ${trop.length + perimes.length} problème(s)\n`);
    for (const p of trop) {
      console.error(`  ✗ ${p.cle}  ${p.phrases} phrase(s), ${p.mots} mots — R11 en autorise ${MAX_PHRASES} et ${MAX_MOTS}`);
      console.error(`      ${p.texte.slice(0, 120)}…`);
    }
    for (const p of perimes) {
      console.error(`  ✗ ${p.cle}  ligne de dette périmée : ${p.pourquoi}`);
      console.error(`      retirer la ligne de ${DETTE}`);
    }
    if (trop.length) {
      console.error(
        '\n  R11 : deux phrases, un exemple, un témoin. Ce qui dépasse — le renvoi, le cas\n' +
          '  voisin, l\'alternative écartée — va dans la docstring de l\'extrait, pas ici.\n',
      );
    }
    process.exit(1);
  }

  console.log(
    `check-longueur-rupture : OK — ${total} point(s) de rupture, ` +
      `${dette.size} encore en dette, aucun nouveau dépassement`,
  );
}
