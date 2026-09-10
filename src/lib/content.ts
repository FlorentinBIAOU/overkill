/**
 * Accès au contenu, pour les pages.
 *
 * Un seul endroit sait comment les collections sont rangées, triées et
 * reliées entre elles. Les pages consomment le résultat.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n';
import { FAMILIES } from '../content/schema/enums';

/**
 * Le jeu de 200 fiches de test n'entre dans le site que derrière un drapeau
 * (CDC 6.2). Il ne se commite pas et ne se publie jamais.
 */
export const FIXTURES_ACTIVES = process.env.OVERKILL_FIXTURES === '1';

export async function allEntries() {
  const fiches = await getCollection('entries');
  return fiches.sort((a, b) => a.data.title.en.localeCompare(b.data.title.en));
}

/**
 * Les fiches affichées au public : les brouillons restent visibles, marqués
 * comme tels, parce qu'un brouillon assumé vaut mieux qu'une page absente.
 */
export async function publishedEntries() {
  return allEntries();
}

export async function allFamilies() {
  const familles = await getCollection('families');
  return familles.sort((a, b) => a.data.order - b.data.order);
}

export async function familyTitles(lang: Locale): Promise<Record<string, string>> {
  const familles = await allFamilies();
  return Object.fromEntries(familles.map((f) => [f.data.id, f.data.title[lang]]));
}

export async function allRoadmap() {
  try {
    return await getCollection('roadmap');
  } catch {
    return [];
  }
}

/**
 * Deux ou trois fiches voisines (CDC 7.5).
 *
 * Même famille d'abord, puis même verdict, puis n'importe laquelle. La
 * sélection est déterministe : deux constructions du site donnent les mêmes
 * voisines, ce qui rend le contrôle de liens reproductible.
 */
export function neighboursOf(entry: CollectionEntry<'entries'>, toutes: CollectionEntry<'entries'>[]) {
  const autres = toutes.filter((e) => e.id !== entry.id);
  const parPriorite = [
    autres.filter((e) => e.data.family === entry.data.family),
    autres.filter((e) => e.data.family !== entry.data.family && e.data.verdict === entry.data.verdict),
    autres,
  ];

  const choisies: typeof autres = [];
  for (const groupe of parPriorite) {
    for (const candidate of groupe) {
      if (choisies.length >= 3) break;
      if (!choisies.some((c) => c.id === candidate.id)) choisies.push(candidate);
    }
  }
  return choisies.slice(0, 3);
}

/** Les dix familles, dans l'ordre d'affichage, même si un fichier manque. */
export const FAMILY_ORDER = FAMILIES;

export const ISSUE_URL =
  'https://github.com/florentin-biaou/overkill/issues/new?template=propose-entry.yml';
