import en from './en';
import fr from './fr';

export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

/** L'anglais est la version canonique du site (CDC 9.3). */
export const DEFAULT_LOCALE: Locale = 'en';

const DICTIONARIES = { en, fr };

/**
 * Le type des chaînes est celui du dictionnaire anglais. Toute clé absente du
 * dictionnaire français devient une erreur de type.
 */
export type Strings = typeof en;

export function t(locale: Locale): Strings {
  return DICTIONARIES[locale] as Strings;
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** L'autre langue, pour le sélecteur. */
export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'fr' : 'en';
}

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
};
