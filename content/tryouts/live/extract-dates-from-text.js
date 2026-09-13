/**
 * Essai interactif — extraire les dates d'un texte libre.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : rien ici ne
 * reproduit son code, et ce qui s'affiche est ce qu'il renvoie.
 *
 * Le tableau porte les deux lectures possibles, parce que la fiche tient sur
 * ce point : les chiffres ne disent pas si 03/04/2024 est un 3 avril ou un
 * 4 mars. L'extrait est donc appelé deux fois, une fois par convention, et les
 * deux colonnes montrent ce que l'appelant tranche à la place du document.
 */
import { extractDates } from '../../snippets/extract-dates-from-text/n0.js';

const T = {
  fr: {
    ecrit: 'Écrit dans le texte',
    jour: 'Lu en jour d’abord',
    mois: 'Lu en mois d’abord',
    refus: 'aucune date réelle',
    rien: 'Aucune date trouvée',
    rienDetail:
      'Aucun groupe de chiffres du texte ne désigne un jour que le calendrier possède.',
    trouvees: (n) => `${n} date${n > 1 ? 's' : ''} retenue${n > 1 ? 's' : ''} sur ce texte.`,
  },
  en: {
    ecrit: 'As written in the text',
    jour: 'Read day-first',
    mois: 'Read month-first',
    refus: 'no real date',
    rien: 'No date found',
    rienDetail: 'No group of digits in the text names a day the calendar actually has.',
    trouvees: (n) => `${n} date${n > 1 ? 's' : ''} kept in this text.`,
  },
};

/** Une date lisible par quelqu'un qui ne lit pas l'ISO. */
function lisible(date, lang) {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export default {
  level: 'N0',

  note: {
    fr: 'La convention jour-mois est un choix de l’appelant, pas une propriété du texte. Les deux colonnes donnent les deux lectures du même passage.',
    en: 'The day-month convention is the caller’s choice, not a property of the text. The two columns give both readings of the same passage.',
  },

  run(texte, lang) {
    const t = T[lang];
    const jourDabord = extractDates(texte, true);
    // Même texte, convention inverse : la colonne de droite n'est pas un
    // commentaire sur le résultat, c'est un second appel de l'extrait.
    const restant = extractDates(texte, false);

    if (jourDabord.length === 0 && restant.length === 0) {
      return { verdict: { label: t.rien, detail: t.rienDetail } };
    }

    const rows = jourDabord.map(({ text, date }) => {
      const position = restant.findIndex((autre) => autre.text === text);
      const inverse = position === -1 ? null : restant.splice(position, 1)[0];
      const memeJour = inverse && inverse.date.getTime() === date.getTime();
      return [
        text,
        lisible(date, lang),
        // Une lecture inverse identique est le signe d'une écriture non
        // ambiguë : l'ISO, ou un mois écrit en lettres.
        inverse === null ? t.refus : { v: lisible(inverse.date, lang), caught: !memeJour },
      ];
    });

    return {
      rows: { columns: [t.ecrit, t.jour, t.mois], rows },
      note: t.trouvees(jourDabord.length),
    };
  },

  cases: [
    {
      label: {
        fr: 'Trois formats dans une phrase de compte rendu',
        en: 'Three formats in one line of meeting notes',
      },
      input: {
        fr: 'Réunion le 12/03/2024, livraison le 3 avril 2024, gel des specs 2024-03-01.',
        en: 'Meeting on 12/03/2024, delivery on 3 April 2024, spec freeze 2024-03-01.',
      },
    },
    {
      label: {
        fr: 'Une date que le calendrier n’a pas',
        en: 'A date the calendar does not have',
      },
      input: {
        fr: 'Livraison annoncée le 31/02/2024, reportée au 1er mars 2024.',
        en: 'Delivery announced for 31/02/2024, pushed back to 1 March 2024.',
      },
    },
    {
      label: {
        fr: 'La même écriture pour deux jours différents',
        en: 'One spelling, two different days',
      },
      input: {
        fr: 'Le contrat court à partir du 03/04/2024, résiliable au 12/03/2025.',
        en: 'The contract runs from 03/04/2024, cancellable on 12/03/2025.',
      },
    },
    {
      label: { fr: 'Des échéances relatives à aujourd’hui', en: 'Deadlines relative to today' },
      input: {
        fr: 'On se voit jeudi prochain, et la livraison part dans quinze jours.',
        en: 'Let us meet next Thursday, and the delivery leaves in a fortnight.',
      },
      fails: true,
      why: {
        fr: 'Rien n’est trouvé : il n’y a aucun chiffre à faire correspondre. Et l’échec est silencieux — une liste vide, pas une erreur — donc un outil de planification bâti là-dessus ne voit jamais ces phrases passer.',
        en: 'Nothing is found: there are no digits to match. And the failure is silent — an empty list, not an error — so a planning tool built on this never sees these sentences go by.',
      },
    },
  ],
};
