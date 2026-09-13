/**
 * Essai interactif — chercher dans ses propres documents.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * L'index est construit au chargement du module, une fois, comme la table
 * virtuelle de la base de données qu'il décrit. Ce qui se rejoue à chaque
 * frappe, c'est la requête.
 */
import { buildIndex, search, tokenise } from '../../snippets/search-in-your-own-documents/n0.js';

/**
 * Le règlement intérieur d'une entreprise, celui que tout le monde a. Un
 * exemplaire par langue : un index plein texte contient les mots des documents
 * qu'on lui donne, et ceux d'un manuel français ne répondent pas à une question
 * posée en anglais. Les documents portent leur titre comme identifiant, parce
 * que c'est ce qu'un résultat de recherche affiche.
 */
const MANUEL = {
  fr: [
    {
      id: 'Congés payés',
      title: 'Congés payés',
      body: 'Le salarié acquiert deux jours et demi de congés payés par mois travaillé. '
        + 'Le solde figure sur le bulletin de paie. Le télétravail ne change rien à ce '
        + 'calcul, et une journée de télétravail reste une journée travaillée.',
    },
    {
      id: 'Télétravail',
      title: 'Télétravail',
      body: 'Deux jours par semaine sont ouverts, après accord écrit du responsable.',
    },
    {
      id: 'Notes de frais',
      title: 'Notes de frais',
      body: 'Les notes de frais se déposent avant le cinq du mois. Le remboursement suit '
        + 'la paie du mois suivant.',
    },
    {
      id: 'Matériel informatique',
      title: 'Matériel informatique',
      body: 'Le poste de travail est renouvelé tous les quatre ans. La demande passe par '
        + 'le responsable.',
    },
    {
      id: 'Titres-restaurant',
      title: 'Titres-restaurant',
      body: 'Un titre par jour de présence sur site. La part employeur est de soixante '
        + 'pour cent.',
    },
    {
      id: 'Arrêt de travail',
      title: 'Arrêt de travail',
      body: 'Le certificat médical part à la paie dans les quarante-huit heures. Le délai '
        + 'de carence est de trois jours.',
    },
  ],
  en: [
    {
      id: 'Paid leave',
      title: 'Paid leave',
      body: 'You earn two and a half days of paid leave for every month worked. The '
        + 'balance is printed on your payslip. Remote working changes nothing in that '
        + 'count, and a day of remote working is a day worked.',
    },
    {
      id: 'Remote working',
      title: 'Remote working',
      body: 'Two days a week are open, after written approval from your manager.',
    },
    {
      id: 'Expense claims',
      title: 'Expense claims',
      body: 'Expense claims are filed before the fifth of the month. The refund follows '
        + 'the payroll run of the month after.',
    },
    {
      id: 'IT equipment',
      title: 'IT equipment',
      body: 'Your workstation is replaced every four years. The request goes through '
        + 'your manager.',
    },
    {
      id: 'Meal vouchers',
      title: 'Meal vouchers',
      body: 'One voucher for every day spent on site. The employer pays sixty per cent '
        + 'of it.',
    },
    {
      id: 'Sick notes',
      title: 'Sick notes',
      body: 'The medical certificate reaches payroll within forty-eight hours. The '
        + 'waiting period is three days.',
    },
  ],
};

const INDEX = { fr: buildIndex(MANUEL.fr), en: buildIndex(MANUEL.en) };

const T = {
  fr: {
    colonnes: ['Page du règlement', 'Score BM25'],
    note: (n, total) => (n > 1
      ? `${n} pages sur ${total} portent tous les mots cherchés.`
      : `Une page sur ${total} porte tous les mots cherchés.`),
    aucun: 'Aucun résultat',
    absents: (mots) => `Aucune page ne contient : ${mots.join(', ')}.`,
    etImplicite: 'Chaque page contient une partie des mots, aucune ne les contient tous : l’index les relie par un ET.',
    rien: 'Rien à chercher : la requête ne contient aucun mot.',
  },
  en: {
    colonnes: ['Handbook page', 'BM25 score'],
    note: (n, total) => (n > 1
      ? `${n} pages out of ${total} carry every word searched for.`
      : `One page out of ${total} carries every word searched for.`),
    aucun: 'No result',
    absents: (mots) => `No page contains: ${mots.join(', ')}.`,
    etImplicite: 'Every page carries part of the words and none carries them all: the index joins them with an AND.',
    rien: 'Nothing to search for: the query holds no word.',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Six pages indexées. Le score dit à quel point les mots cherchés sont rares dans le règlement, et un mot du titre compte dix fois un mot du corps.',
    en: 'Six pages indexed. The score says how rare the words searched for are in the handbook, and a word in a title counts ten times a word in the body.',
  },

  run(requete, lang) {
    const t = T[lang];
    const index = INDEX[lang];
    const resultats = search(index, requete, 6);
    if (resultats.length > 0) {
      return {
        rows: {
          columns: t.colonnes,
          rows: resultats.map((resultat, rang) => [
            resultat.id,
            /* Le score de la première ligne est surligné : c'est lui qui l'a
               mise en tête, et le reste du tableau dit de combien. */
            { v: resultat.score.toFixed(4), caught: rang === 0 },
          ]),
        },
        note: t.note(resultats.length, index.rows.length),
      };
    }
    /* Un silence s'explique : ou bien un mot de la requête n'est nulle part
       dans l'index, ou bien ils y sont tous mais jamais sur la même page. Les
       deux se lisent dans l'index, et c'est la moitié du diagnostic. */
    const mots = tokenise(requete);
    const absents = mots.filter((mot) => !index.documentFrequency.has(mot));
    return {
      verdict: {
        label: t.aucun,
        detail: mots.length === 0 ? t.rien : absents.length > 0 ? t.absents(absents) : t.etImplicite,
      },
    };
  },

  cases: [
    {
      label: { fr: 'Les mots du titre', en: 'The words of the title' },
      input: { fr: 'notes de frais', en: 'expense claims' },
    },
    {
      label: { fr: 'Un mot que deux pages emploient', en: 'A word two pages use' },
      input: { fr: 'télétravail', en: 'remote working' },
    },
    {
      label: { fr: 'Deux mots, une seule page', en: 'Two words, a single page' },
      input: { fr: 'accord responsable', en: 'approval manager' },
    },
    {
      label: { fr: 'La question dans les mots du lecteur', en: 'The question in the reader’s words' },
      input: {
        fr: 'combien de vacances puis-je poser',
        en: 'how much holiday can I book',
      },
      fails: true,
      why: {
        fr: 'Le règlement répond à cette question : la page s’appelle « Congés payés ». Mais le lecteur dit « vacances » là où elle dit « congés », et ce mot n’est nulle part dans l’index — il n’y a donc rien à faire correspondre, et aucun classement ne rattrape une page qui n’est même pas candidate. Le ET implicite finit le travail : il aurait fallu que la même page porte tous les mots de la phrase.',
        en: 'The handbook answers this question: the page is called “Paid leave”. But the reader says “holiday” where the page says “leave”, and that word is nowhere in the index — so there is nothing to match, and no amount of ranking rescues a page that is not even a candidate. The implicit AND finishes the job: one single page would have had to carry every word of the sentence.',
      },
    },
  ],
};
