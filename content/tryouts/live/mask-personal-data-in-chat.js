/**
 * Essai interactif — masquer les coordonnées dans un message.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 */
import { mask } from '../../snippets/mask-personal-data-in-chat/n0.js';

export default {
  level: 'N0',

  run(text) {
    return { output: mask(text), diff: true };
  },

  cases: [
    {
      label: { fr: 'Un téléphone et un email', en: 'A phone number and an email' },
      input: {
        fr: 'Bonjour, appelez-moi au 06 12 34 56 78 ou écrivez à marie.durand@exemple.fr',
        en: 'Hello, call me on 06 12 34 56 78 or write to marie.durand@example.com',
      },
    },
    {
      label: { fr: 'Un IBAN au milieu d’une phrase', en: 'An IBAN inside a sentence' },
      input: {
        fr: 'Le virement part sur FR76 3000 6000 0112 3456 7890 189, dis-moi si ça arrive',
        en: 'The transfer goes to FR76 3000 6000 0112 3456 7890 189, tell me when it lands',
      },
    },
    {
      label: { fr: 'Un numéro collé, sans espaces', en: 'A number typed without spaces' },
      input: {
        fr: 'mon num c’est 0612345678, appelle quand tu veux',
        en: 'my number is 0612345678, call whenever',
      },
    },
    {
      label: { fr: 'Le numéro écrit en lettres', en: 'The number spelled out' },
      fails: true,
      input: {
        fr: 'appelle-moi au zéro six, douze, trente-quatre, cinquante-six, soixante-dix-huit',
        en: 'call me on zero six, twelve, thirty-four, fifty-six, seventy-eight',
      },
      why: {
        fr: 'Rien n’est masqué : la règle cherche des chiffres, et il n’y en a aucun. Quelqu’un qui veut contourner le filtre le fait en deux secondes.',
        en: 'Nothing is masked: the rule looks for digits and there are none. Anyone who wants around the filter gets around it in two seconds.',
      },
    },
  ],
};
