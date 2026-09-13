/**
 * Les données structurées, construites depuis le contenu (lot 14, 9.1).
 *
 * Un seul endroit produit ces objets, pour qu'ils ne divergent pas des pages :
 * le titre du balisage est celui de la page, sa date est celle de la fiche, et
 * son adresse est celle de la balise canonique.
 */
import type { Locale } from '../i18n';

/** La fiche : un article technique, avec sa date de révision (CDC 5.1). */
export function techArticle({
  url,
  title,
  description,
  updated,
  lang,
  site,
  image,
  section,
  author,
}: {
  url: string;
  title: string;
  description: string;
  updated: Date;
  lang: Locale;
  site: string;
  image: string;
  section: string;
  author: string;
}) {
  const iso = updated.toISOString().slice(0, 10);
  return {
    '@type': 'TechArticle',
    headline: title,
    description,
    inLanguage: lang,
    url,
    /* La date de publication n'est pas suivie séparément : le dépôt ne garde
       qu'une date de révision, et annoncer une date de publication qu'on
       n'a pas serait une invention. */
    dateModified: iso,
    image: `${site}${image}`,
    articleSection: section,
    author: { '@type': 'Person', name: author },
    publisher: { '@type': 'Organization', name: 'Overkill', url: site },
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/',
  };
}

/** Le catalogue et les familles : une page de collection. */
export function collectionPage({
  url,
  title,
  description,
  lang,
  items,
}: {
  url: string;
  title: string;
  description: string;
  lang: Locale;
  items: { name: string; url: string }[];
}) {
  return {
    '@type': 'CollectionPage',
    name: title,
    description,
    inLanguage: lang,
    url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };
}

/** L'accueil : le site lui-même. */
export function webSite({
  site,
  url,
  name,
  description,
  lang,
}: {
  site: string;
  url: string;
  name: string;
  description: string;
  lang: Locale;
}) {
  return {
    '@type': 'WebSite',
    name,
    description,
    url,
    inLanguage: lang,
    publisher: { '@type': 'Organization', name, url: site },
  };
}
