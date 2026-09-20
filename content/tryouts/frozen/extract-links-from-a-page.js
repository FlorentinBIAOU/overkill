/**
 * Essai figé — récupérer les liens d'une page et les rendre absolus.
 *
 * L'extrait du niveau recommandé charge un moteur de document pour analyser le
 * HTML : il ne tourne pas tel quel dans la zone d'essai du site. Les six cas
 * ci-dessous sont donc exécutés à la construction du site, avec le vrai
 * extrait et ses vraies dépendances — rien n'est simulé ici, seule l'exécution
 * est figée.
 *
 * Chaque cas déclare la base, parce que c'est ce que la fiche dit : sans
 * l'adresse d'où la page a été servie, un href relatif ne veut rien dire.
 */
import { extractLinks } from '../../snippets/extract-links-from-a-page/n0.js';

const GENRES = {
  fr: { page: 'page', anchor: 'ancre', mail: 'courriel', phone: 'téléphone', other: 'autre' },
  en: { page: 'page', anchor: 'anchor', mail: 'mail', phone: 'phone', other: 'other' },
};

const T = {
  fr: {
    colonnes: ['Écrit dans la page', 'Où cela mène', 'Genre'],
    lu: (n, base) => `${n} lien(s), résolus contre ${base}`,
    rien: 'Aucun lien dans cette page',
    ecarte: (n) => ` · ${n} écarté(s)`,
    refus: 'Aucune base déclarée : rien à résoudre',
  },
  en: {
    colonnes: ['Written in the page', 'Where it leads', 'Kind'],
    lu: (n, base) => `${n} link(s), resolved against ${base}`,
    rien: 'No link in this page',
    ecarte: (n) => ` · ${n} dropped`,
    refus: 'No base declared: nothing to resolve',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Rien ne part sur le réseau : la page est analysée telle qu’elle est donnée, et aucune adresse n’est visitée. La base est celle que le cas déclare.',
    en: 'Nothing goes out on the network: the page is parsed as given, and no address is visited. The base is the one the case declares.',
  },

  run(input, lang, cas = {}) {
    const t = T[lang];
    const rapport = extractLinks(input, cas.base ?? '');
    if (rapport.reason) return { verdict: { label: t.refus, detail: rapport.reason } };

    return {
      rows: {
        columns: t.colonnes,
        rows: rapport.links.map((lien) => [
          lien.href,
          { v: lien.url, caught: true },
          GENRES[lang][lien.kind],
        ]),
      },
      verdict: {
        label: (rapport.links.length ? t.lu(rapport.links.length, rapport.base) : t.rien)
          + (rapport.skipped.length ? t.ecarte(rapport.skipped.length) : ''),
        detail: rapport.skipped.map((s) => `${s.href ?? '—'} : ${s.why}`).join(' · '),
      },
    };
  },

  cases: [
    {
      label: { fr: 'Une page de blog ordinaire', en: 'An ordinary blog page' },
      base: 'https://exemple.fr/blog/',
      input: '<a href="article">L’article</a>\n<a href="/racine" rel="nofollow">Racine</a>\n'
        + '<a href="../haut">Un cran au-dessus</a>\n<a href="https://autre.fr/page">Chez les voisins</a>',
    },
    {
      label: { fr: 'Ancres, courriels et ce qui n’est pas une adresse', en: 'Anchors, mail and what is not an address' },
      base: 'https://exemple.fr/blog/',
      input: '<a href="#ancre">Ancre</a>\n<a href="mailto:jean@exemple.fr">Écrire</a>\n'
        + '<a href="tel:+33123456789">Appeler</a>\n<a href="javascript:alert(1)">Script</a>\n'
        + '<a>Sans href</a>',
    },
    {
      label: { fr: 'Un élément <base> dans la page change tout', en: 'A <base> element in the page changes everything' },
      base: 'https://exemple.fr/blog/',
      input: '<base href="https://exemple.fr/v2/">\n<a href="article">L’article</a>\n'
        + '<a href="/racine">Racine</a>',
    },
    {
      label: { fr: 'Les écritures que le navigateur normalise', en: 'The spellings a browser normalises' },
      base: 'https://exemple.fr/blog/',
      input: '<a href="https://café.fr/page">Accent dans l’hôte</a>\n'
        + '<a href="HTTPS://EXEMPLE.FR/MAJ">Majuscules</a>\n'
        + '<a href="https://exemple.fr:443/p">Port par défaut</a>\n'
        + '<a href="/chemin avec espaces/é.html">Espaces et accents</a>',
    },
    {
      label: { fr: 'Une barre inversée n’est pas un caractère de chemin', en: 'A backslash is not a path character' },
      base: 'https://exemple.fr/blog/',
      input: '<a href="\\\\chemin">Deux barres inversées</a>\n'
        + '<a href="\\chemin">Une barre inversée</a>\n'
        + '<a href="chemin">Rien du tout</a>',
    },
    {
      label: { fr: 'La même page, résolue contre la mauvaise base', en: 'The same page, resolved against the wrong base' },
      base: 'https://www.exemple.fr/blog/2026/',
      input: '<a href="article">L’article</a>\n<a href="/racine">Racine</a>\n'
        + '<a href="../haut">Un cran au-dessus</a>',
      fails: true,
      why: {
        fr: 'Les trois adresses rendues sont valides, et les trois sont fausses : la page avait été servie depuis un autre hôte et un autre dossier. Le code résout contre ce qu’on lui déclare et n’a aucun moyen de vérifier cette déclaration — c’est pourquoi il rend la base employée dans son rapport, et c’est la première chose à regarder quand tous les liens partent ailleurs. Le cas le plus courant est une redirection : on déclare l’adresse demandée quand il fallait déclarer celle où l’on a atterri.',
        en: 'The three addresses returned are valid, and all three are wrong: the page had been served from another host and another folder. The code resolves against what it is told and has no way to check that declaration — which is why it returns the base it used, and why that is the first thing to look at when every link goes elsewhere. The commonest cause is a redirect: the address requested was declared where the address landed on should have been.',
      },
    },
  ],
};
