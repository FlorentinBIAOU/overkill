import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';

import { entrySchema } from './content/schema/entry';
import { familySchema } from './content/schema/family';
import { pageSchema } from './content/schema/page';
import { roadmapItemSchema } from './content/schema/roadmap';

/**
 * Les collections pointent sur `content/` à la racine, comme l'impose
 * l'arborescence de la section 10.2 du CDC, et non sur `src/content/` qui
 * serait l'usage d'Astro. L'API Content Layer d'Astro 5 le permet par `base`.
 */

/**
 * Le jeu de 200 fiches de test (CDC 6.2) ne rejoint la collection que derrière
 * un drapeau. Il n'est jamais commité et ne se publie jamais : il sert à
 * vérifier que la navigation, la recherche et les filtres tiennent à l'échelle
 * visée.
 */
const AVEC_FIXTURES = process.env.OVERKILL_FIXTURES === '1';

const entries = defineCollection({
  loader: glob({
    base: AVEC_FIXTURES ? './content/entries-fixtures' : './content/entries',
    pattern: '**/[^_]*.mdx',
  }),
  schema: entrySchema,
});

const families = defineCollection({
  loader: glob({ base: './content/families', pattern: '**/[^_]*.mdx' }),
  schema: familySchema,
});

const pages = defineCollection({
  loader: glob({ base: './content/pages', pattern: '**/[^_]*.mdx' }),
  schema: pageSchema,
});

// Les 200 intitulés de la feuille de route (CDC 6.2). Astro lit nativement une
// liste YAML dont chaque élément porte un `id`.
const roadmap = defineCollection({
  loader: file('./content/roadmap.yaml'),
  schema: roadmapItemSchema,
});

export const collections = { entries, families, pages, roadmap };
