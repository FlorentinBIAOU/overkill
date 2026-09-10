/**
 * Construction de l'index de recherche, au build.
 *
 * L'index couvre ce que la section 9.1 du CDC demande : titre, besoin,
 * scénario, noms des approches, famille. Le code des extraits en est exclu :
 * il noierait la pertinence, et personne ne cherche une fiche par le nom d'une
 * variable.
 *
 * Un index par langue. Une recherche dans une langue ne retourne donc que les
 * fiches de cette langue, sans filtrage supplémentaire côté client.
 */
import type { Locale } from '../i18n';

export interface IndexedEntry {
  /** Identifiant de la fiche, qui sert de clé pour retrouver sa ligne dans le DOM. */
  i: string;
  /** Texte indexé, déjà normalisé : minuscules, sans accents. */
  t: string;
}

/**
 * Retire les diacritiques et passe en minuscules.
 *
 * La même fonction sert au build et au navigateur : si les deux ne
 * normalisaient pas pareil, une recherche accentuée ne trouverait rien.
 */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function buildIndex(
  entries: any[],
  familyTitles: Record<string, string>,
  lang: Locale,
): IndexedEntry[] {
  return entries.map((e) => {
    const morceaux = [
      e.title[lang],
      e.need[lang],
      e.scenario[lang],
      familyTitles[e.family] ?? e.family,
      ...e.rungs.filter((r: any) => r.available).map((r: any) => r.name[lang]),
    ];
    return { i: e.id, t: normalise(morceaux.join(' ')) };
  });
}
