/**
 * L'index de recherche, un par langue (CDC 9.1).
 *
 * Construit au build, servi comme un fichier statique, chargé par le catalogue
 * seulement au premier caractère tapé. Il couvre titre, besoin, scénario, noms
 * des approches et famille. Le code des extraits en est exclu : il noierait la
 * pertinence.
 *
 * Une recherche dans une langue ne retourne que les fiches de cette langue,
 * puisque chaque langue a son index.
 */
import type { APIRoute } from 'astro';
import { publishedEntries, familyTitles } from '../../lib/content';
import { buildIndex } from '../../lib/search-index';
import { LOCALES, type Locale } from '../../i18n';

export function getStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as Locale;
  const entries = await publishedEntries();
  const titres = await familyTitles(lang);
  const index = buildIndex(entries.map((e) => e.data), titres, lang);

  return new Response(JSON.stringify(index), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
