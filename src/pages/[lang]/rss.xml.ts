/**
 * Flux RSS, un par langue (CDC 7.1).
 *
 * Il ne porte que les fiches publiées, triées par date de révision. Un
 * brouillon n'a rien à faire dans un flux : quelqu'un qui s'abonne veut être
 * prévenu de ce qui est prêt.
 */
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { publishedEntries } from '../../lib/content';
import { LOCALES, t, type Locale } from '../../i18n';
import { route } from '../../i18n/routes';

export function getStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}

export const GET: APIRoute = async ({ params, site }) => {
  const lang = params.lang as Locale;
  const strings = t(lang);
  const entries = (await publishedEntries())
    .filter((e) => e.data.status === 'published')
    .sort((a, b) => b.data.updated.getTime() - a.data.updated.getTime());

  return rss({
    title: `${strings.site.name} — ${strings.site.tagline}`,
    description:
      lang === 'fr'
        ? "Pour chaque tâche courante, toutes les options connues, de la règle au modèle généraliste."
        : 'For every common task, all the known options, from a rule to a general-purpose model.',
    site: site ?? 'https://overkill.example',
    customData: `<language>${lang}</language>`,
    items: entries.map((e) => ({
      title: e.data.title[lang],
      description: e.data.need[lang],
      link: route(lang, 'entries', e.data.id),
      pubDate: e.data.updated,
      categories: [e.data.family, e.data.verdict],
    })),
  });
};
