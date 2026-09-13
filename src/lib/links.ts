/**
 * La nature d'un lien, déduite de son adresse.
 *
 * Jusqu'ici, les liens du site étaient du texte nu posé en liste : rien ne
 * disait où ils menaient. Un lecteur doit savoir avant de cliquer s'il ouvre
 * une documentation, une spécification, un dépôt de code ou un article de
 * recherche.
 *
 * La déduction se fait sur l'hôte, pas sur le libellé : elle ne demande donc
 * aucune saisie supplémentaire dans les fiches, et elle reste juste quand une
 * fiche est écrite par quelqu'un d'autre. Une fiche peut malgré tout la
 * corriger en posant `kind` sur le lien.
 *
 * Le repli est `page` — « page web » — qui est vrai de n'importe quelle
 * adresse. Aucune règle ici ne prétend savoir ce qu'elle ne peut pas savoir.
 */
export const LINK_KINDS = [
  'repo',
  'doc',
  'spec',
  'paper',
  'academic',
  'law',
  'reference',
  'page',
] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

const SPEC_HOSTS = [
  'w3.org',
  'whatwg.org',
  'rfc-editor.org',
  'ietf.org',
  'iso.org',
  'unicode.org',
  'json-schema.org',
  'oasis-open.org',
  'ecma-international.org',
];

const PAPER_HOSTS = ['arxiv.org', 'aclanthology.org', 'doi.org', 'hal.science', 'dl.acm.org'];

const LAW_HOSTS = ['eur-lex.europa.eu', 'legifrance.gouv.fr', 'service-public.fr', 'cnil.fr'];

const DOC_HOSTS = [
  'developer.mozilla.org',
  'scikit-learn.org',
  'numpy.org',
  'readthedocs.io',
  'sbert.net',
  'fasttext.cc',
  'huggingface.co',
  'elastic.co',
  'sqlite.org',
  'postgresql.org',
];

/** Vrai si l'hôte est le domaine donné ou l'un de ses sous-domaines. */
function under(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

/** L'hôte, sans le `www.` qui n'apprend rien à personne. */
export function source(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function classify(url: string): LinkKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'page';
  }
  const host = parsed.hostname.replace(/^www\./, '');
  const path = parsed.pathname;

  // Un dépôt, et non la page d'accueil de la forge ni un site de projet.
  if ((under(host, 'github.com') || under(host, 'gitlab.com')) && path.split('/').filter(Boolean).length >= 2) {
    return 'repo';
  }
  if (SPEC_HOSTS.some((d) => under(host, d))) return 'spec';
  if (PAPER_HOSTS.some((d) => under(host, d))) return 'paper';
  if (LAW_HOSTS.some((d) => under(host, d))) return 'law';
  if (under(host, 'wikipedia.org')) return 'reference';
  if (DOC_HOSTS.some((d) => under(host, d))) return 'doc';
  if (host.startsWith('docs.') || host.startsWith('developer.') || path.startsWith('/docs/')) {
    return 'doc';
  }
  // Une adresse universitaire : le document peut être un article comme un
  // chapitre de cours, donc on dit ce qu'on sait, pas plus.
  if (/(^|\.)(edu|ac\.[a-z]{2})$/.test(host) || /\.(uni[a-z-]*|univ[a-z-]*)\./.test(host)) {
    return 'academic';
  }
  if (host.endsWith('.github.io')) return 'doc';
  return 'page';
}
