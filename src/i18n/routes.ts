/**
 * Construction des URL du site.
 *
 * Le CDC donne l'arborescence en section 7.1 et précise en 9.3 que toutes les
 * URL existent en `/fr/...` et en `/en/...`. Les segments sont donc identiques
 * dans les deux langues, seul le préfixe change. C'est ce qui permet au
 * sélecteur de langue de conserver la page courante par simple substitution du
 * préfixe, et ce qui rend les liens entre versions triviaux à vérifier.
 */
import { LOCALES, type Locale } from './index';

/** Les segments de premier niveau, tels qu'écrits en section 7.1 du CDC. */
export const SEGMENTS = {
  home: '',
  catalogue: 'catalogue',
  families: 'familles',
  entries: 'fiches',
  methodology: 'methodologie',
  about: 'a-propos',
  contribute: 'contribuer',
  help: 'accompagnement',
  legal: 'mentions-legales',
  privacy: 'confidentialite',
  credits: 'credits',
} as const;

export type PageKey = keyof typeof SEGMENTS;

/** `/fr/fiches/mask-personal-data-in-chat` */
export function route(locale: Locale, page: PageKey, slug?: string): string {
  const segment = SEGMENTS[page];
  const parts = ['', locale, segment, slug].filter((p) => p !== '' && p !== undefined);
  return `/${parts.join('/')}`;
}

/**
 * Le même chemin dans l'autre langue.
 *
 * Repose sur l'égalité des segments entre langues : on ne remplace que le
 * préfixe. Si un jour les segments étaient traduits, cette fonction serait le
 * seul endroit à changer.
 */
export function switchLocale(path: string, target: Locale): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 0 && (LOCALES as readonly string[]).includes(parts[0]!)) {
    parts[0] = target;
    return `/${parts.join('/')}`;
  }
  return `/${target}`;
}

/** La locale d'un chemin, ou undefined si le chemin n'en porte pas. */
export function localeOf(path: string): Locale | undefined {
  const first = path.split('/').filter(Boolean)[0];
  return first && (LOCALES as readonly string[]).includes(first) ? (first as Locale) : undefined;
}
