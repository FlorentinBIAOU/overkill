/**
 * Essai figé — isoler le contenu principal d'une page web.
 *
 * Figé, et non interactif : l'extrait du niveau recommandé s'appuie sur
 * `@mozilla/readability` et sur un moteur de document, deux paquets installés
 * que le navigateur ne résout pas. Les sorties sont calculées à la
 * construction du site, en exécutant le vrai extrait sur les pages ci-dessous,
 * fabriquées pour cette démonstration.
 */
import { readArticle } from '../../snippets/extract-main-content-from-a-web-page/n0.js';

const TITRE = 'La boulangerie Martin fête ses cent ans';
const PARAGRAPHES = [
  'Installée rue des Lilas depuis 1926, la boulangerie Martin a vu passer quatre'
  + ' générations de clients et trois guerres. Son four à bois, classé, tourne encore'
  + ' tous les matins à cinq heures.',
  'Clémentine Martin, qui a repris le commerce en 2019, raconte que la farine vient'
  + ' toujours du même moulin, à quarante kilomètres de là, et que la recette du pain de'
  + ' campagne n’a pas bougé d’une ligne depuis son arrière-grand-père.',
];

const PAGES = {
  article: `<!doctype html><html lang="fr"><head><title>${TITRE}</title></head><body>`
    + '<nav>Accueil Boutique Contact</nav><div class="cookies">Ce site utilise des cookies</div>'
    + `<article><h1>${TITRE}</h1><p>${PARAGRAPHES[0]}</p><p>${PARAGRAPHES[1]}</p></article>`
    + '<aside>Vous aimerez aussi : les dix meilleures boulangeries</aside>'
    + '<footer>Mentions légales</footer></body></html>',
  categorie: '<!doctype html><html><head><title>Boulangeries</title></head><body><ul>'
    + Array.from({ length: 40 }, (unused, i) => `<li><a href="/a${i}">Boulangerie numéro ${i}</a></li>`).join('')
    + '</ul></body></html>',
  commentaires: `<!doctype html><html lang="fr"><head><title>${TITRE}</title></head><body>`
    + `<article><h1>${TITRE}</h1><p>${PARAGRAPHES[0]}</p><p>${PARAGRAPHES[1]}</p></article>`
    + '<section id="comments"><h2>Commentaires</h2>'
    + '<p>Le meilleur pain de la ville, sans hésiter. Et la brioche du dimanche vaut le détour aussi.</p>'
    + '<p>J’y vais depuis vingt ans, rien n’a changé, et c’est très bien comme ça.</p></section>'
    + '</body></html>',
  courte: `<!doctype html><html><head><title>${TITRE}</title></head><body>`
    + '<article><p>La boulangerie Martin a cent ans.</p></article></body></html>',
  application: '<!doctype html><html lang="fr"><head><title>Application</title></head>'
    + '<body><div id="root"></div><script src="/app.js"></script></body></html>',
};

const T = {
  fr: {
    ok: (n) => `${n} caractères gardés`,
    ko: 'Rien à lire',
  },
  en: {
    ok: (n) => `${n} characters kept`,
    ko: 'Nothing to read',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Quatre pages fabriquées pour cette démonstration. Les sorties sont celles de l’extrait, exécutées à la construction du site.',
    en: 'Four pages built for this demonstration. The outputs are the snippet’s own, run when the site is built.',
  },

  run(input, lang, cas) {
    const t = T[lang];
    const rapport = readArticle(PAGES[cas?.page ?? 'article']);
    return {
      verdict: {
        label: rapport.reason === null ? t.ok(rapport.characters) : t.ko,
        detail: rapport.reason ?? input,
      },
      output: rapport.text || `(${rapport.characters})`,
      note: rapport.title ? `« ${rapport.title} »` : undefined,
    };
  },

  cases: [
    {
      label: { fr: 'Un article de presse locale, avec tout ce qui l’entoure', en: 'A local news article, with everything around it' },
      input: { fr: 'Le menu, le bandeau de cookies, les articles voisins et le pied de page sont jetés.', en: 'The menu, the cookie banner, the related items and the footer are dropped.' },
      page: 'article',
    },
    {
      label: { fr: 'Une page de catégorie : quarante liens et rien d’autre', en: 'A category page: forty links and nothing else' },
      input: { fr: 'Plus de la moitié du texte est dans des liens : ce n’est pas un article.', en: 'More than half the text sits inside links: this is not an article.' },
      page: 'categorie',
    },
    {
      label: { fr: 'Le même article, suivi de ses commentaires', en: 'The same article, followed by its comments' },
      input: { fr: 'Les commentaires des lecteurs ne font pas partie de l’article.', en: 'Readers’ comments are not part of the article.' },
      page: 'commentaires',
    },
    {
      label: { fr: 'Une brève de six mots', en: 'A six-word news brief' },
      input: { fr: 'Sous le plancher : le rapport le dit au lieu de rendre une chaîne courte.', en: 'Below the floor: the report says so instead of returning a short string.' },
      page: 'courte',
    },
    {
      label: { fr: 'Une page dont le corps est construit par son JavaScript', en: 'A page whose body is built by its own JavaScript' },
      input: { fr: 'La coquille arrive vide.', en: 'The shell arrives empty.' },
      page: 'application',
      fails: true,
      why: {
        fr: 'Il n’y a rien à extraire : le HTML servi ne contient qu’une balise vide et un script. Aucun extracteur ne peut lire ce que le navigateur n’a pas encore construit, et la réponse n’est pas un meilleur extracteur — c’est un navigateur sans affichage, ou le point d’accès que le site utilise lui-même pour remplir sa page.',
        en: 'There is nothing to extract: the HTML served holds one empty tag and a script. No extractor can read what the browser has not built yet, and the answer is not a better extractor — it is a headless browser, or the endpoint the site itself uses to fill the page.',
      },
    },
  ],
};
