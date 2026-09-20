/**
 * Essai figé — contrôler un mot de passe contre la politique.
 *
 * Figé pour une raison qui est le sujet de la fiche : un essai interactif
 * devrait faire sortir quelque chose du mot de passe que vous tapez, et cette
 * page n'a aucune raison de le faire. Les mots de passe ci-dessous sont
 * choisis pour la démonstration, et la liste de fuites est un double local —
 * les comptes affichés sont ceux du double, pas ceux du service.
 *
 * Les sorties sont calculées à la construction du site en exécutant le vrai
 * extrait, avec ce double injecté là où il ferait une requête HTTPS.
 */
import { createHash } from 'node:crypto';

import { RANGE_URL, checkPassword } from '../../snippets/check-a-password-against-a-policy/n0.js';

/* Ce que le double connaît. Ce sont des mots de passe réellement présents dans
   les fuites publiques ; leur compte ici est celui du double. */
const FUITES = {
  motdepasse: 9_999,
  'Motdepasse1!': 42,
  'correct horse battery staple': 120,
  aaaaaaaaaaaaaaaa: 3,
};

const sha1 = (mot) => createHash('sha1').update(mot, 'utf8').digest('hex').toUpperCase();

/* Les adresses demandées, pour les montrer : c'est tout ce qui sort. */
let derniereAdresse = null;

async function fetchRange(url) {
  derniereAdresse = url;
  const prefixe = url.slice(RANGE_URL.length);
  const lignes = Object.entries(FUITES)
    .filter(([mot]) => sha1(mot).slice(0, 5) === prefixe)
    .map(([mot, n]) => `${sha1(mot).slice(5)}:${n}`);
  for (let i = lignes.length; i < 800; i += 1) {
    lignes.push(`${i.toString(16).toUpperCase().padStart(35, '0')}:0`);
  }
  return lignes.join('\r\n');
}

const T = {
  fr: {
    ok: 'Accepté',
    raisons: {
      'too-short': 'trop court',
      'too-long': 'trop long',
      breached: 'présent dans une fuite',
      'context-word': 'c’est le nom du site',
      'not-text': 'ce n’est pas du texte',
    },
    sorti: (a) => `Ce qui est sorti de la machine : ${a}`,
    rien: 'Rien n’est sorti de la machine : le refus s’est joué avant la liste.',
  },
  en: {
    ok: 'Accepted',
    raisons: {
      'too-short': 'too short',
      'too-long': 'too long',
      breached: 'found in a breach',
      'context-word': 'it is the site’s own name',
      'not-text': 'it is not text',
    },
    sorti: (a) => `What left the machine: ${a}`,
    rien: 'Nothing left the machine: the refusal was settled before the list.',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'La liste de fuites est un double local, et les comptes affichés sont les siens. Ce qui compte ici est ailleurs : l’adresse demandée, montrée sous chaque cas, ne contient que cinq caractères du haché.',
    en: 'The breach list is a local double, and the counts shown are its own. What matters here is elsewhere: the address requested, shown under each case, holds only five characters of the hash.',
  },

  async run(input, lang) {
    const t = T[lang];
    derniereAdresse = null;
    const rapport = await checkPassword(input, { context: ['Boulangerie-Martin'], fetchRange });
    const raisons = rapport.reasons.map((r) => t.raisons[r] ?? r).join(', ');
    return {
      verdict: {
        label: rapport.acceptable ? t.ok : `Refusé — ${raisons}`,
        detail: derniereAdresse ? t.sorti(derniereAdresse) : t.rien,
      },
      output: JSON.stringify(rapport, null, 2),
    };
  },

  cases: [
    {
      label: { fr: 'Une phrase de passe française', en: 'A French passphrase' },
      input: 'le chat dort sur le radiateur',
    },
    {
      label: { fr: 'Le mot de passe que produisent les règles de composition', en: 'The password composition rules produce' },
      input: 'Motdepasse1!',
    },
    {
      label: { fr: 'Seize lettres identiques, sans majuscule ni chiffre', en: 'Sixteen identical letters, no capital, no digit' },
      input: 'aaaaaaaaaaaaaaaa',
    },
    {
      label: { fr: 'Une phrase de passe célèbre', en: 'A famous passphrase' },
      input: 'correct horse battery staple',
    },
    {
      label: { fr: 'Le nom du site lui-même', en: 'The site’s own name' },
      input: 'Boulangerie-Martin',
    },
    {
      label: { fr: 'Le prénom et l’année de naissance de la fille du titulaire', en: 'The account holder’s daughter’s name and birth year' },
      input: 'Clementine-2019-Martin',
      fails: true,
      why: {
        fr: 'Vingt-deux caractères, aucune fuite connue : la politique l’accepte, et c’est le prénom de la fille du titulaire suivi de son année de naissance. Le contrôle ne connaît que ce qui a déjà fuité ; ce qu’un proche devinerait en trois essais ne laisse aucune trace dans une liste. C’est la limite du niveau, et elle ne se referme pas avec un modèle : elle se referme avec un second facteur.',
        en: 'Twenty-two characters, no known breach: the policy accepts it, and it is the account holder’s daughter’s first name followed by her year of birth. The check only knows what has already leaked; what a relative would guess in three tries leaves no trace in any list. That is this level’s limit, and a model does not close it: a second factor does.',
      },
    },
  ],
};
