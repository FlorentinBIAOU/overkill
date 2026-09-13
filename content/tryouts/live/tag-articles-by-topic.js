/**
 * Essai interactif — étiqueter des articles par thème.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * Ce barreau ne connaît que le fonds qu'on lui a étiqueté à la main. Un fonds
 * français n'apprend rien de l'anglais : il y en a donc deux, vingt-huit
 * articles chacun, avec les mêmes quatre thèmes — deux articles en portent
 * deux, un n'en porte aucun, parce qu'un article sans étiquette est un exemple
 * négatif utile et pas un trou. Les huit classifieurs, quatre par langue,
 * s'entraînent en une centaine de millisecondes au chargement de la page.
 *
 * Les thèmes sont nommés par une clé commune aux deux fonds, et traduits à
 * l'affichage : la taxonomie de la rédaction est la même dans les deux
 * langues, seuls les articles changent.
 */
import { score, tag, train } from '../../snippets/tag-articles-by-topic/n1.js';

const FONDS_FR = [
  ['La loi de finances relève le plafond du crédit d’impôt recherche pour les PME.', ['fiscalite']],
  ['Le taux de TVA applicable aux travaux de rénovation change au premier janvier.', ['fiscalite']],
  ['La déclaration fiscale des entreprises doit être déposée en ligne avant le 15 mai.', ['fiscalite']],
  ['L’administration fiscale précise le calcul de l’impôt sur les sociétés.', ['fiscalite']],
  ['Le barème de l’impôt sur le revenu est revalorisé pour tenir compte de l’inflation.', ['fiscalite']],
  ['Une facture sans mention de TVA expose l’entreprise à un redressement.', ['fiscalite']],
  ['Nous ouvrons un poste de développeur : les candidatures sont à envoyer avant la fin du mois.', ['recrutement']],
  ['L’entretien d’embauche se déroule en deux temps, un échange technique puis une rencontre avec l’équipe.', ['recrutement']],
  ['Le recrutement d’un profil senior demande plusieurs semaines de recherche.', ['recrutement']],
  ['Nous cherchons quelqu’un pour rejoindre l’équipe produit et l’accompagner sur la durée.', ['recrutement']],
  ['Trois cents candidatures sont arrivées pour une seule offre publiée la semaine dernière.', ['recrutement']],
  ['La période d’essai du nouveau salarié se termine à la fin du mois de mars.', ['recrutement']],
  ['L’équipe ne se retrouve au bureau que le mardi ; le reste de la semaine, chacun travaille depuis chez lui.', ['teletravail']],
  ['Les réunions se tiennent en visioconférence, ce qui demande un ordre du jour écrit.', ['teletravail']],
  ['Le télétravail deux jours par semaine est inscrit dans l’accord d’entreprise.', ['teletravail']],
  ['Travailler à distance depuis son domicile suppose des horaires clairs et un droit à la déconnexion.', ['teletravail']],
  ['Les bureaux ont été réduits de moitié depuis que chacun vient trois jours par semaine.', ['teletravail']],
  ['Un salarié installé loin du siège ne passe au bureau qu’une fois par mois.', ['teletravail']],
  ['Un rançongiciel a paralysé le système d’information d’une collectivité pendant plusieurs jours.', ['cybersecurite']],
  ['La campagne d’hameçonnage imitait un message de la banque de l’entreprise.', ['cybersecurite']],
  ['Changer les mots de passe ne suffit pas : il faut activer la double authentification.', ['cybersecurite']],
  ['Une fuite de données a exposé les adresses de milliers de clients.', ['cybersecurite']],
  ['Le correctif publié hier ferme une faille exploitée depuis une semaine.', ['cybersecurite']],
  ['Un message frauduleux invitait les salariés à saisir leur identifiant sur un faux site.', ['cybersecurite']],
  ['Le versement des indemnités de télétravail suit un régime de TVA particulier.', ['fiscalite', 'teletravail']],
  ['Le recrutement à distance impose de vérifier l’identité du candidat sans jamais le rencontrer.', ['recrutement', 'teletravail']],
  ['La prime versée aux salariés qui travaillent depuis chez eux entre dans l’assiette de l’impôt.', ['fiscalite', 'teletravail']],
  ['Le compte-rendu du conseil municipal est en ligne.', []],
];

const FONDS_EN = [
  ['The finance act raises the ceiling of the research tax credit for small firms.', ['fiscalite']],
  ['The VAT rate on renovation work changes on the first of January.', ['fiscalite']],
  ['Company tax returns have to be filed online before the fifteenth of May.', ['fiscalite']],
  ['The tax authority clarifies how corporation tax is to be calculated.', ['fiscalite']],
  ['Income tax bands are raised to take inflation into account.', ['fiscalite']],
  ['An invoice with no VAT line exposes the company to a reassessment.', ['fiscalite']],
  ['We are opening a developer position: applications are due before the end of the month.', ['recrutement']],
  ['The job interview runs in two parts, a technical discussion then a meeting with the team.', ['recrutement']],
  ['Hiring a senior profile takes several weeks of searching.', ['recrutement']],
  ['We are looking for someone to join the product team and stay with it.', ['recrutement']],
  ['Three hundred applications arrived for a single vacancy posted last week.', ['recrutement']],
  ['The probation period of the new employee ends at the end of March.', ['recrutement']],
  ['The team is only in the office on Tuesdays; the rest of the week everyone works from home.', ['teletravail']],
  ['Meetings are held over video, which calls for a written agenda.', ['teletravail']],
  ['Two days a week from home is written into the company agreement.', ['teletravail']],
  ['Working at a distance from home needs clear hours and a right to disconnect.', ['teletravail']],
  ['The offices were halved once everyone came in three days a week.', ['teletravail']],
  ['An employee living far from headquarters comes to the office once a month.', ['teletravail']],
  ['Ransomware paralysed the information system of a local authority for several days.', ['cybersecurite']],
  ['The phishing campaign imitated a message from the company bank.', ['cybersecurite']],
  ['Changing passwords is not enough: two-factor authentication has to be switched on.', ['cybersecurite']],
  ['A data leak exposed the addresses of thousands of customers.', ['cybersecurite']],
  ['The patch published yesterday closes a flaw exploited for a week.', ['cybersecurite']],
  ['A fraudulent message invited staff to type their login on a fake site.', ['cybersecurite']],
  ['Payment of the working-from-home allowance follows a particular VAT regime.', ['fiscalite', 'teletravail']],
  ['Hiring at a distance means checking the identity of a candidate you never meet.', ['recrutement', 'teletravail']],
  ['The bonus paid to staff who work from home counts towards taxable income.', ['fiscalite', 'teletravail']],
  ['The minutes of the town council meeting are online.', []],
];

function entrainer(fonds) {
  return train(
    fonds.map(([article]) => article),
    fonds.map(([, themes]) => themes),
  );
}

const MODELES = { fr: entrainer(FONDS_FR), en: entrainer(FONDS_EN) };

// Le seuil est celui de l'extrait, et c'est toute la politique de relecture de
// la rédaction : le baisser fait remonter des thèmes, pas forcément les bons.
const SEUIL = 0.5;

const THEMES = {
  fiscalite: { fr: 'Fiscalité', en: 'Tax' },
  recrutement: { fr: 'Recrutement', en: 'Hiring' },
  teletravail: { fr: 'Télétravail', en: 'Remote work' },
  cybersecurite: { fr: 'Cybersécurité', en: 'Cybersecurity' },
};

const T = {
  fr: {
    colonnes: ['Thème de la maison', 'Score du classifieur'],
    retenus: (liste) => `Étiquettes posées : ${liste}`,
    aucun: 'Aucune étiquette posée',
    detail: (seuil) => `Chaque thème répond pour lui seul ; le seuil de publication est à ${seuil}.`,
    note: 'Quatre classifieurs entraînés sur 28 articles étiquetés à la main.',
  },
  en: {
    colonnes: ['In-house topic', 'Classifier score'],
    retenus: (liste) => `Tags attached: ${liste}`,
    aucun: 'No tag attached',
    detail: (seuil) => `Each topic answers for itself alone; the publishing threshold sits at ${seuil}.`,
    note: 'Four classifiers trained on 28 hand-tagged articles.',
  },
};

function nombre(valeur, lang) {
  const texte = valeur.toFixed(2);
  return lang === 'fr' ? texte.replace('.', ',') : texte;
}

export default {
  level: 'N1',

  note: {
    fr: 'Les classifieurs sont entraînés dans votre navigateur au chargement de la page, sur le fonds étiqueté écrit juste à côté. Aucun article ne part ailleurs.',
    en: 'The classifiers are trained in your browser as the page loads, on the tagged archive written right beside it. No article leaves the page.',
  },

  run(article, lang) {
    const t = T[lang];
    const modele = MODELES[lang];
    const scores = score(modele, article);
    const retenus = tag(modele, article, SEUIL);
    /* Tous les thèmes sont affichés, et pas seulement ceux retenus : c'est le
       seul moyen de voir qu'un thème manquant n'apparaît pas en baissant le
       seuil, il laisse la place au thème le plus proche. */
    const classement = [...modele.topics].sort((a, b) => scores[b] - scores[a]);
    return {
      verdict: {
        label:
          retenus.length > 0
            ? t.retenus(retenus.map((cle) => THEMES[cle][lang]).join(', '))
            : t.aucun,
        detail: t.detail(nombre(SEUIL, lang)),
      },
      rows: {
        columns: t.colonnes,
        rows: classement.map((cle) => [
          { v: THEMES[cle][lang], caught: retenus.includes(cle) },
          nombre(scores[cle], lang),
        ]),
      },
      note: t.note,
    };
  },

  cases: [
    {
      label: { fr: 'Un article sur un faux message bancaire', en: 'An article about a fake bank message' },
      input: {
        fr: 'Un message frauduleux invitait les salariés à saisir leur mot de passe sur un faux site de la banque.',
        en: 'A fraudulent message invited staff to type their password on a fake bank site.',
      },
    },
    {
      label: { fr: 'Un article qui traite deux thèmes à la fois', en: 'An article covering two topics at once' },
      input: {
        fr: 'Les indemnités de télétravail versées aux salariés qui travaillent depuis chez eux entrent dans le calcul de l’impôt et de la TVA.',
        en: 'The working-from-home allowance paid to staff who work from home counts towards income tax and VAT.',
      },
    },
    {
      label: {
        fr: 'Un thème traité de bout en bout sans être nommé',
        en: 'A topic covered from end to end without being named',
      },
      input: {
        fr: 'Depuis le printemps, l’équipe ne se retrouve au bureau que le mardi. Le reste de la semaine, chacun s’organise depuis chez lui, et les réunions se tiennent en visioconférence.',
        en: 'Since the spring the team has only been in the office on Tuesdays. The rest of the week everyone sorts themselves out from home, and meetings are held over video.',
      },
    },
    {
      label: { fr: 'Un article sur un thème que personne n’a étiqueté', en: 'An article on a topic nobody labelled' },
      fails: true,
      input: {
        fr: 'La région finance une partie du matériel acheté par les entreprises industrielles, via un guichet de subvention ouvert jusqu’en juin.',
        en: 'The region is funding part of the equipment bought by industrial companies, through a subsidy desk open until June.',
      },
      why: {
        fr: 'L’article parle de subventions, un thème absent du fonds étiqueté : il n’existe pas pour le modèle, et rien ne peut le faire apparaître. Regardez le tableau — baisser le seuil ne fait pas surgir le thème manquant, il classe un article sur les subventions en télétravail. Chaque thème ajouté à la taxonomie redemande une passe d’étiquetage à la main sur tout le fonds.',
        en: 'The article is about subsidies, a topic absent from the labelled archive: it does not exist for the model, and nothing can make it appear. Look at the table — lowering the threshold does not surface the missing topic, it files an article about subsidies under remote work. Every topic added to the taxonomy asks for another hand-labelling pass over the whole archive.',
      },
    },
  ],
};
