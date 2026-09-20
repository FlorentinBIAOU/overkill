/**
 * Essai interactif — les termes qui distinguent un document de ses voisins.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe. Le texte que vous écrivez est
 * comparé à trois contrats fixes, affichés dans les exemples ci-dessous.
 *
 * C'est tout l'objet de la fiche : un document seul ne peut pas dire ce qui le
 * distingue, parce que l'information est dans le dossier, pas dans le document.
 */
import { extractKeyTermsInCorpus } from '../../snippets/extract-key-terms-from-a-document/n1.js';

const VIDES = {
  fr: ('de des du la le les un une et ou à au aux en dans sur pour par avec sans '
    + 'sous est sont a ont ce cette ces qui que dont se son sa ses leur leurs ne '
    + 'pas plus il elle nous vous ils elles on y d l s n c j m t qu').split(' '),
  en: ('the a an and or to of in on for with without is are be been this that these '
    + 'those it its their his her we you they has have had as at by from').split(' '),
};

// données-fictives:début — trois contrats fabriqués pour cette page : ce sont
// les documents auxquels le texte saisi est comparé, pas des documents réels.
const VOISINS = {
  fr: [
    'Conditions générales de vente. La société Lumière vend des vélos électriques. '
    + 'La batterie du vélo est garantie deux ans. Le client dispose d’un délai de '
    + 'rétractation de quatorze jours. Les présentes conditions générales de vente '
    + 'sont soumises au droit français.',
    'Conditions générales de vente. La société Lumière vend des imprimantes laser. '
    + 'La cartouche laser est garantie six mois. Le client dispose d’un délai de '
    + 'rétractation de quatorze jours. Les présentes conditions générales de vente '
    + 'sont soumises au droit français.',
    'Conditions générales de vente. La société Lumière vend des casques audio. '
    + 'Le casque audio est garanti deux ans. Le client dispose d’un délai de '
    + 'rétractation de quatorze jours. Les présentes conditions générales de vente '
    + 'sont soumises au droit français.',
  ],
  en: [
    'Terms and conditions of sale. Lumiere Ltd sells electric bicycles. The bicycle '
    + 'battery carries a two year warranty. The customer has fourteen days to '
    + 'withdraw from the sale. These terms and conditions of sale are governed by '
    + 'French law.',
    'Terms and conditions of sale. Lumiere Ltd sells laser printers. The laser '
    + 'cartridge carries a six month warranty. The customer has fourteen days to '
    + 'withdraw from the sale. These terms and conditions of sale are governed by '
    + 'French law.',
    'Terms and conditions of sale. Lumiere Ltd sells audio headsets. The audio '
    + 'headset carries a two year warranty. The customer has fourteen days to '
    + 'withdraw from the sale. These terms and conditions of sale are governed by '
    + 'French law.',
  ],
};

const T = {
  fr: {
    colonnes: ['Terme', 'Poids dans la collection', 'Occurrences'],
    lu: (n) => `${n} terme(s), pesés contre trois autres contrats`,
    rien: 'Aucun terme : ce document ne dit rien que les trois autres ne disent',
    zero: 'Tous les termes pèsent zéro : ce document ne dit que ce que les trois autres disent déjà',
  },
  en: {
    colonnes: ['Term', 'Weight in the collection', 'Occurrences'],
    lu: (n) => `${n} term(s), weighed against three other contracts`,
    rien: 'No term: this document says nothing the other three do not',
    zero: 'Every term weighs zero: this document only says what the other three already say',
  },
};

export default {
  level: 'N1',

  note: {
    fr: 'Rien ne part sur le réseau : le calcul se fait dans votre navigateur. Votre texte est comparé aux trois contrats des exemples, et à eux seuls.',
    en: 'Nothing goes out on the network: the computing happens in your browser. Your text is weighed against the three contracts of the examples, and against them only.',
  },

  run(input, lang) {
    const t = T[lang];
    const rapport = extractKeyTermsInCorpus([input, ...VOISINS[lang]], VIDES[lang]);
    const termes = rapport.documents.length ? rapport.documents[0].terms : [];
    const pese = termes.filter((terme) => terme.score > 0);

    let label = t.lu(pese.length);
    if (termes.length === 0) label = t.rien;
    else if (pese.length === 0) label = t.zero;

    return {
      rows: {
        columns: t.colonnes,
        rows: termes.map((terme) => [
          { v: terme.text, caught: terme.score > 0 },
          String(terme.score),
          String(terme.count),
        ]),
      },
      verdict: { label },
    };
  },

  cases: [
    {
      label: { fr: 'Un contrat sur un produit que les autres ne vendent pas', en: 'A contract about a product the others do not sell' },
      input: {
        fr: 'Conditions générales de vente. La société Lumière vend des moulins à café. '
          + 'Le moulin est garanti deux ans. Le client dispose d’un délai de rétractation '
          + 'de quatorze jours. Les présentes conditions générales de vente sont soumises '
          + 'au droit français.',
        en: 'Terms and conditions of sale. Lumiere Ltd sells coffee grinders. The coffee '
          + 'grinder carries a two year warranty. The customer has fourteen days to '
          + 'withdraw from the sale. These terms and conditions of sale are governed by '
          + 'French law.',
      },
    },
    {
      label: { fr: 'Le même contrat, sans son passe-partout', en: 'The same contract, without its boilerplate' },
      input: {
        fr: 'La société Lumière vend des moulins à café. Le moulin est garanti deux ans.',
        en: 'Lumiere Ltd sells coffee grinders. The coffee grinder carries a two year warranty.',
      },
    },
    {
      label: { fr: 'Une note qui ne parle que du délai de rétractation', en: 'A note that speaks only of the withdrawal period' },
      input: {
        fr: 'Note interne. Le délai de rétractation de quatorze jours court à compter de '
          + 'la livraison. Le client dispose d’un délai de rétractation entier.',
        en: 'Internal note. The fourteen days to withdraw run from delivery onwards. '
          + 'The customer has fourteen days to withdraw in full.',
      },
      fails: true,
      why: {
        fr: 'Le sujet de cette note est le délai de rétractation, et les trois contrats de la collection en parlent tous : son poids tombe à zéro, et le terme qui décrit le mieux le document disparaît de sa propre liste. C’est le point de rupture du niveau, et c’est la contrepartie exacte de ce qu’il apporte — le passe-partout descend parce qu’il est partout, et un sujet partagé descend pour la même raison. Le niveau en dessous, qui ne connaît pas la collection, le fait bien remonter : il ne sait simplement pas faire la différence entre un sujet et un passe-partout.',
        en: 'The subject of this note is the withdrawal period, and all three contracts in the collection speak of it: its weight falls to zero, and the term that best describes the document vanishes from its own list. That is the level’s breaking point, and it is the exact counterpart of what it brings — boilerplate goes down because it is everywhere, and a shared subject goes down for the same reason. The level below, which knows nothing of the collection, does bring it back up: it simply cannot tell a subject from boilerplate.',
      },
    },
  ],
  // données-fictives:fin
};
