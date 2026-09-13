/**
 * Essai figé — rédiger une présentation d'article par appel à un modèle.
 *
 * Cet extrait ne peut pas tourner dans un navigateur : il appelle un
 * fournisseur externe. Les six cas ci-dessous sont donc exécutés à la
 * construction du site, avec le double local qui sert déjà aux tests — le même
 * que `n3.test.js`.
 *
 * Ce qui est réellement calculé ici, et que rien n'écrit à la main : ce que le
 * code envoie, ce qu'il refuse avant de dépenser, ce qu'il réessaie, ce qu'il
 * rejette, et ce que son contrôle terme à terme attrape. Le texte rendu, lui,
 * est celui que le cas déclare : c'est le partage que la fiche annonce avec sa
 * mention « testé, service simulé ».
 *
 * Les consignes de l'extrait sont écrites en français, parce que c'est la
 * langue de la boutique : la fiche produit et la présentation sont donc les
 * mêmes des deux côtés du site, et seuls les intitulés changent de langue.
 *
 * Le dernier cas est le point de rupture du niveau, et le plus utile de la
 * page : le contrôle ne vaut que ce que vaut la liste de termes, et une
 * promesse dite autrement passe.
 */
import { FakeLLM } from '../../snippets/_harness/fake-llm.mjs';
import {
  DescriptionUnavailable,
  MAX_CHARACTERS,
  UngroundedDescription,
  describe,
} from '../../snippets/write-product-descriptions/n3.js';

/* Un article inventé : aucune marque, aucun catalogue existant. */
const FICHE = [
  'nom : Aurore 500',
  'catégorie : sac à dos',
  'matière : toile recyclée',
  'public : les randonneurs à la journée',
  'équipements : poche pour ordinateur, sangle ventrale',
  'coloris : ardoise, sable',
  'garantie : deux ans',
].join('\n');

/* Ce qu'un import de catalogue traîne réellement : des notes de réserve que
   personne n'a retirées, et qui partiraient chez le fournisseur au prix du
   jeton si le plafond ne les arrêtait pas. */
const FICHE_ENCOMBREE = `${FICHE}
notes de l’importateur : lot reçu le 14 mars, conteneur partagé avec la commande de sacs de sport, contrôle qualité effectué sur douze pièces prises au hasard dans le carton du dessus, deux fermetures à glissière reprises en atelier avant mise en rayon, étiquetage refait car la taille figurait en pouces sur les étiquettes d’origine, palette stockée en réserve trois semaines avant la mise en ligne, fiche technique du fournisseur traduite en interne faute de version française fournie`;

/* Les mots que le catalogue de la boutique emploie, relevés dans les attributs
   de tous les articles du rayon. Le contrôle de véracité ne vaut ni plus ni
   moins que cette liste. */
const VOCABULAIRE = [
  'toile recyclée',
  'cuir pleine fleur',
  'étanche',
  'poche pour ordinateur',
  'sangle ventrale',
  'garanti à vie',
];

const FIDELE =
  'Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile ' +
  'recyclée encaisse les ronces, et sa poche pour ordinateur rentre au bureau le lundi.';

const PROMESSE_INVENTEE =
  'Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile ' +
  'recyclée encaisse les ronces, et le sac est garanti à vie contre les défauts de couture.';

const PROMESSE_DITE_AUTREMENT =
  'Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile ' +
  'recyclée ne craint ni les ronces ni la pluie battante, et votre dos reste sec sous l’averse.';

const PROSE = 'Bien sûr ! Voici une proposition de description :';

const T = {
  fr: {
    refusAvant: 'Refusé avant le premier appel',
    rienDu: 'Rien n’est parti chez le fournisseur, rien n’est dû.',
    rejet: 'Réponse rejetée',
    rejetDetail:
      'Le modèle a répondu en prose là où le code demandait du JSON. Le code lève une erreur plutôt que de publier cela sur une page produit.',
    invente: 'Publication refusée : une promesse absente du dossier',
    inventeDetail: (termes) =>
      `Le contrôle terme à terme a trouvé « ${termes} » dans le texte et nulle part dans le dossier.`,
    envoye: (appels, caracteres) =>
      `${appels} appel facturé, ${caracteres} caractères partis chez le fournisseur, consignes et fiche comprises.`,
    reessais: (appels) =>
      `${appels} appels facturés : les deux premiers ont échoué, le troisième a répondu.`,
    perdus: (appels) => `${appels} appels envoyés et facturés, aucune réponse publiable.`,
  },
  en: {
    refusAvant: 'Refused before the first call',
    rienDu: 'Nothing left for the provider, nothing owed.',
    rejet: 'Answer rejected',
    rejetDetail:
      'The model answered in prose where the code asked for JSON. The code raises rather than publishing that on a product page.',
    invente: 'Publication refused: a promise the record does not carry',
    inventeDetail: (termes) =>
      `The term-by-term check found “${termes}” in the copy and nowhere in the record.`,
    envoye: (appels, caracteres) =>
      `${appels} call billed, ${caracteres} characters sent to the provider, instructions and record together.`,
    reessais: (appels) => `${appels} calls billed: the first two failed, the third answered.`,
    perdus: (appels) => `${appels} calls sent and billed, no publishable answer.`,
  },
};

/** La fiche telle qu'elle s'affiche, vers l'objet que l'extrait attend. */
function lireFiche(texte) {
  const produit = {};
  for (const ligne of texte.split('\n')) {
    const [cle, ...reste] = ligne.split(' : ');
    if (reste.length === 0) continue;
    const valeur = reste.join(' : ').trim();
    produit[cle.trim()] = valeur.includes(', ') ? valeur.split(', ') : valeur;
  }
  return produit;
}

export default {
  level: 'N3',

  note: {
    fr: 'Le texte rendu par le modèle est simulé par le double local qui sert aux tests. Ce qui est calculé ici, c’est ce que le code envoie, ce qu’il refuse avant de dépenser, ce qu’il réessaie, et ce que son contrôle contre le dossier attrape. La température envoyée n’est pas nulle : deux appels sur la même fiche ne rendent pas le même texte.',
    en: 'The copy the model returns is simulated by the local double the tests use. What is computed here is what the code sends, what it refuses before spending, what it retries, and what its check against the record catches. The temperature sent is not zero: two calls on the same record do not return the same copy.',
  },

  /* La réponse du fournisseur est portée par le cas : quatre cas partagent la
     même fiche produit et ne diffèrent que par ce qui revient. */
  async run(fiche, lang, cas = {}) {
    const t = T[lang];
    const simulation = cas.simulate ?? {};
    const reponse = simulation.reponse ?? FIDELE;
    const client = new FakeLLM({
      response: reponse === PROSE ? PROSE : JSON.stringify({ description: reponse }),
      failTimes: simulation.failTimes ?? 0,
    });
    try {
      const texte = await describe(lireFiche(fiche), client, { vocabulary: VOCABULAIRE });
      return {
        output: texte,
        note: simulation.failTimes
          ? t.reessais(client.callCount)
          : t.envoye(client.callCount, client.lastRequest.prompt.length),
      };
    } catch (erreur) {
      if (erreur instanceof RangeError) {
        return {
          verdict: { label: t.refusAvant, detail: erreur.message },
          note: t.rienDu,
        };
      }
      if (erreur instanceof UngroundedDescription) {
        return {
          verdict: { label: t.invente, detail: t.inventeDetail(erreur.message) },
          note: t.envoye(client.callCount, client.lastRequest.prompt.length),
        };
      }
      return {
        verdict: {
          label: t.rejet,
          detail: erreur instanceof DescriptionUnavailable ? t.rejetDetail : String(erreur),
        },
        note: t.perdus(client.callCount),
      };
    }
  },

  cases: [
    {
      label: { fr: 'Un texte qui s’en tient au dossier', en: 'Copy that sticks to the record' },
      input: FICHE,
    },
    {
      label: {
        fr: 'La même fiche, avec les notes de réserve restées dedans',
        en: 'The same record, with the stockroom notes still in it',
      },
      input: FICHE_ENCOMBREE,
      shown: {
        fr: `la même fiche, notes de l’importateur comprises : 702 caractères d’attributs, ${702 - MAX_CHARACTERS} de trop`,
        en: `the same record, importer notes included: 702 characters of attributes, ${702 - MAX_CHARACTERS} too many`,
      },
    },
    {
      label: { fr: 'Le fournisseur échoue deux fois', en: 'The provider fails twice' },
      input: FICHE,
      simulate: { failTimes: 2 },
      shown: {
        fr: 'la même fiche, mais les deux premiers appels échouent',
        en: 'the same record, but the first two calls fail',
      },
    },
    {
      label: { fr: 'Le modèle répond en prose', en: 'The model answers in prose' },
      input: FICHE,
      simulate: { reponse: PROSE },
      shown: {
        fr: 'la même fiche ; le modèle répond « Bien sûr ! Voici une proposition… »',
        en: 'the same record; the model answers “Bien sûr ! Voici une proposition…”',
      },
    },
    {
      label: {
        fr: 'Le modèle promet une garantie à vie',
        en: 'The model promises a lifetime guarantee',
      },
      input: FICHE,
      simulate: { reponse: PROMESSE_INVENTEE },
      shown: {
        fr: 'la même fiche, qui dit deux ans de garantie ; le modèle écrit « garanti à vie »',
        en: 'the same record, which says a two-year warranty; the model writes « garanti à vie »',
      },
    },
    {
      label: {
        fr: 'Le modèle promet la même chose, avec d’autres mots',
        en: 'The model promises the same thing, in other words',
      },
      input: FICHE,
      simulate: { reponse: PROMESSE_DITE_AUTREMENT },
      shown: {
        fr: 'la même fiche, qui ne parle nulle part d’étanchéité ; le modèle écrit « ne craint pas la pluie battante »',
        en: 'the same record, which says nothing about waterproofing; the model writes « ne craint pas la pluie battante »',
      },
      fails: true,
      why: {
        fr: 'Le texte promet un sac qui garde le dos sec sous l’averse. Le dossier ne dit rien de tel, et la boutique n’a jamais vendu ce sac comme étanche. Le contrôle ne voit rien : il cherche les termes du catalogue, et « étanche » n’est pas écrit — la promesse est dite autrement. Ce contrôle ne vaut que ce que vaut la liste, et aucune liste de mots ne couvre les façons de dire la même chose. Le texte part en ligne.',
        en: 'The copy promises a bag that keeps your back dry in a downpour. The record says nothing of the kind, and the shop has never sold this bag as waterproof. The check sees nothing: it looks for the catalogue’s terms, and « étanche » is not written — the promise is made in other words. That check is worth exactly what the list is worth, and no list of words covers the ways of saying the same thing. The copy goes live.',
      },
    },
  ],
};
