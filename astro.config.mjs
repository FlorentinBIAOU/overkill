// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import rehypeTableScroll from './src/lib/rehype-table-scroll.mjs';

export const SITE = 'https://isitoverkill.dev';

/** Fournisseurs chargés en import dynamique par les extraits N2 et N3. */
const PROVIDERS = [
  'openai',
  '@xenova/transformers',
  '@huggingface/transformers',
  'tesseract.js',
  'node-postal',
];

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/dev/'),
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', fr: 'fr' },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    /*
     * Les extraits N2 et N3 chargent leur fournisseur en import dynamique, et
     * seulement quand aucun client ne leur est passé — ce qui n'arrive jamais
     * ici : les essais et les tests injectent tous un double local. Ces
     * paquets ne sont donc pas installés, et n'ont pas à l'être. Sans cette
     * liste, l'analyseur de Rollup les réclame à la construction alors que la
     * ligne qui les mentionne ne s'exécute pas.
     */
    ssr: { external: PROVIDERS },
    build: { rollupOptions: { external: PROVIDERS } },
  },
  markdown: {
    // Un tableau large défile dans son conteneur, jamais la page.
    rehypePlugins: [rehypeTableScroll],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: false,
    },
  },
});
