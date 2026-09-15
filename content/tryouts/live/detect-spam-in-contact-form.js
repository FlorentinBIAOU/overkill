/**
 * Essai interactif — repérer le spam dans un formulaire de contact.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * Ce niveau n'existe qu'entraîné, et il ne pèse que les n-grammes des
 * messages qu'on lui a montrés. Il y a donc deux modèles, un par corpus de
 * trente-deux envois, entraînés au chargement de la page, et la page choisit
 * celui de sa langue.
 *
 * Ce que l'essai ne peut pas faire croire : taper de l'anglais dans le champ
 * de la page française le fait juger par le modèle français, qui n'a jamais vu
 * ces mots. C'est la limite de l'entraînement, pas celle de l'essai.
 */
import { spamScore, train } from '../../snippets/detect-spam-in-contact-form/n1.js';

const SPAM_FR = [
  'Bonjour, nous garantissons la première page de Google pour votre site, tarif imbattable.',
  'Augmentez votre trafic avec nos packs de liens retours premium à prix cassés.',
  'Cher monsieur, je peux améliorer le référencement de votre site en un mois, faible coût.',
  'Gagnez des revenus passifs avec le trading de cryptomonnaies, rejoignez notre canal.',
  'Nous proposons des articles invités sur des blogs à forte autorité, meilleurs tarifs.',
  'Achetez des abonnés et des mentions j’aime pas cher pour vos réseaux sociaux.',
  'Votre site web fait daté, nous le refaisons entièrement pour un prix très bas.',
  'Félicitations, vous avez gagné un lot, cliquez sur le lien ci-dessous pour le réclamer.',
  'Nous sommes une société de développement offshore, louez nos développeurs pas chers.',
  'Augmentez vos ventes avec notre base de données de contacts pour emailing de masse.',
  'Cher propriétaire, votre nom de domaine expire, renouvelez-le aujourd’hui avec remise.',
  'Nous vendons des fichiers de prospects qualifiés, résultats garantis, essai gratuit.',
  'Bonjour chère amie, j’ai une proposition d’affaires de plusieurs millions, répondez-moi.',
  'Recevez des milliers de visiteurs sur votre site chaque mois, sans aucun effort.',
  'Notre agence offre un trafic illimité et les premières positions, premier mois offert.',
  'Offre spéciale cette semaine seulement, logo pas cher et retouches illimitées.',
];

const LEGITIMES_FR = [
  'Bonjour, j’ai commandé une lampe la semaine dernière et elle est arrivée cassée, que faire ?',
  'Pouvez-vous me dire si l’atelier de mardi accepte encore des inscriptions ?',
  'Je souhaiterais un devis pour repeindre les volets d’une maison près de Nantes.',
  'Votre formulaire refuse mon code postal, j’habite à l’étranger, pouvez-vous m’aider ?',
  'Bonjour, la boutique est-elle ouverte le samedi après-midi au mois d’août ?',
  'J’ai envoyé une facture il y a trois semaines et elle n’est toujours pas payée, qui contacter ?',
  'Livrez-vous en Belgique, et combien de temps prend la livraison en général ?',
  'La notice mentionne une pièce qui ne se trouvait pas dans le carton.',
  'J’ai perdu le ticket de caisse d’un achat de juin, pouvez-vous m’en renvoyer une copie ?',
  'Bonjour, ma commande numéro 4512 n’a pas bougé depuis dix jours, est-elle perdue ?',
  'Le modèle bleu est-il encore disponible en taille moyenne, ou bien est-il arrêté ?',
  'Nous sommes une école et souhaiterions visiter votre atelier avec quinze élèves.',
  'La batterie de l’appareil acheté en mars ne tient plus la charge.',
  'Puis-je changer l’adresse de livraison d’une commande passée hier ?',
  'Bonjour, je souhaite résilier mon abonnement avant le prochain renouvellement.',
  'Votre lettre d’information arrive en double, pouvez-vous retirer l’adresse en trop ?',
];

const SPAM_EN = [
  'Hello, we offer guaranteed first page ranking on Google for your website.',
  'Boost your traffic with our premium backlink packages at cheap prices.',
  'Dear sir, I can improve your website ranking within one month, low cost.',
  'Earn passive income trading crypto, join our telegram channel right now.',
  'We provide guest posting services on high authority blogs, best rates.',
  'Buy cheap followers and likes for your social media accounts today.',
  'Your website design looks outdated, we redesign it for a very low price.',
  'Congratulations, you have won a prize, click the link below to claim it.',
  'We are an offshore web development company, hire our developers cheap.',
  'Increase your sales with our bulk email marketing database of contacts.',
  'Dear owner, your domain is expiring, renew it today at a discount price.',
  'We sell verified leads for your industry, guaranteed results, free trial.',
  'Hello dear, I have a business proposal worth millions, reply for details.',
  'Get thousands of visitors to your website every month, no effort needed.',
  'Our agency offers unlimited traffic and top rankings, first month free.',
  'Special offer this week only, cheap logo design and unlimited revisions.',
];

const LEGITIMES_EN = [
  'Hello, I ordered a lamp last week and it arrived damaged, what should I do?',
  'Could you tell me if the workshop on tuesday is still open for registration?',
  'I would like a quote for repainting the shutters of a house near Nantes.',
  'Your online form refused my postcode, I live abroad, can you help me?',
  'Good morning, is the shop open on saturday afternoon during august?',
  'I sent an invoice three weeks ago and it is still unpaid, who do I contact?',
  'Do you deliver to Belgium, and how long does the delivery usually take?',
  'The instructions in the manual mention a part that was not in the box.',
  'I lost the receipt for a purchase made in june, can you send a copy?',
  'Hello, my order number 4512 has not moved for ten days, is it lost?',
  'Is the blue model still available in size medium, or is it discontinued?',
  'We are a school and would like to visit your workshop with fifteen pupils.',
  'The battery of the device I bought in march no longer holds a charge.',
  'Can I change the delivery address of an order that was placed yesterday?',
  'Hello, I would like to cancel my subscription before the next renewal.',
  'Your newsletter arrives twice, could you remove the duplicate address?',
];

/** Un modèle par langue, entraîné une fois pour toutes au chargement. */
function entrainer(spam, legitimes) {
  return train(
    [...spam, ...legitimes],
    [...spam.map(() => 1), ...legitimes.map(() => 0)],
  );
}

const MODELES = {
  fr: entrainer(SPAM_FR, LEGITIMES_FR),
  en: entrainer(SPAM_EN, LEGITIMES_EN),
};

// Le seuil est celui de l'extrait. Le déplacer est une décision de la
// boutique, et l'afficher ici est la seule façon de faire lire le score.
const SEUIL = 0.5;

const T = {
  fr: {
    spam: 'Écarté comme spam',
    legitime: 'Passe : demande à lire',
    detail: (score, verdict) =>
      `Score de spam ${score}, ${verdict ? 'au-dessus' : 'en dessous'} du seuil de ${nombre(SEUIL, 'fr')}.`,
    note: 'Modèle entraîné sur 32 envois étiquetés, dont 16 spams.',
  },
  en: {
    spam: 'Turned away as spam',
    legitime: 'Let through: an enquiry to read',
    detail: (score, verdict) =>
      `Spam score ${score}, ${verdict ? 'above' : 'below'} the ${nombre(SEUIL, 'en')} threshold.`,
    note: 'Model trained on 32 labelled submissions, 16 of them spam.',
  },
};

function nombre(valeur, lang) {
  const texte = valeur.toFixed(2);
  return lang === 'fr' ? texte.replace('.', ',') : texte;
}

export default {
  level: 'N1',

  note: {
    fr: 'Le modèle est entraîné dans votre navigateur au chargement de la page, sur un corpus d’envois étiquetés écrit juste à côté. Rien ne part ailleurs.',
    en: 'The model is trained in your browser as the page loads, on a corpus of labelled submissions written right beside it. Nothing leaves the page.',
  },

  run(message, lang) {
    const t = T[lang];
    const score = spamScore(MODELES[lang], message);
    const spam = score >= SEUIL;
    return {
      verdict: {
        label: spam ? t.spam : t.legitime,
        detail: t.detail(nombre(score, lang), spam),
      },
      note: t.note,
    };
  },

  cases: [
    {
      label: {
        fr: 'Une offre de référencement, jamais vue telle quelle',
        en: 'An SEO offer, never seen in these words',
      },
      input: {
        fr: 'Bonjour, nous pouvons propulser votre site en première position sur Google, offre à petit prix.',
        en: 'Hi, we can boost your google ranking with quality links, cheap offer.',
      },
    },
    {
      label: { fr: 'Un client dont le colis est abîmé', en: 'A customer with a damaged parcel' },
      input: {
        fr: 'Bonjour, mon colis est arrivé hier mais le carton était ouvert.',
        en: 'Hello, my parcel arrived yesterday but the box was open.',
      },
    },
    {
      label: {
        fr: 'Un démarchage au mot-clé espacé : le reste du message suffit',
        en: 'A solicitation with its keyword spaced out: the rest of the message is enough',
      },
      input: {
        fr: 'nous vendons des l i e n s retours et du trafic pas cher, boostez votre référencement',
        en: 'we sell b a c k l i n k s and cheap traffic, boost your rankings today',
      },
    },
    {
      label: { fr: 'Le robot patient', en: 'The patient sender' },
      fails: true,
      input: {
        fr: 'Bonjour, je découvre votre société et je souhaiterais discuter d’un partenariat pour accroître votre visibilité. Quand cela vous conviendrait-il ?',
        en: 'Good morning, I came across your company and I would like to discuss a partnership to increase your visibility. When would suit you?',
      },
      why: {
        fr: 'Court, poli, sans offre, sans prix et sans lien : cet envoi est écrit dans le registre des demandes de clients, et il score comme elles. C’est mot pour mot le message qui traverse déjà les règles de N0 ; ce que N1 gagne, c’est le flot entre les deux, pas cet expéditeur-là.',
        en: 'Short, polite, no offer, no price, no link: this submission is written in the register of customer enquiries, and it scores like one. It is word for word the message that already walks past the N0 rules; what N1 gains is the flood in between, not this particular sender.',
      },
    },
  ],
};
