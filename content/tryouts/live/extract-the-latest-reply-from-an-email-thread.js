/**
 * Essai interactif — garder la dernière réponse d'un fil de courriel.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe. Collez-y un de vos propres fils.
 *
 * Ce qui est surligné dans l'entrée est ce que l'extrait a gardé. Le reste est
 * la citation, reconnue au marqueur que votre client de messagerie a écrit.
 */
import { extractReply } from '../../snippets/extract-the-latest-reply-from-an-email-thread/n0.js';

const T = {
  fr: {
    coupe: (n) => `Réponse gardée, citation reconnue à la ligne ${n + 1}`,
    entier: 'Aucune citation : le message entier est la réponse',
    rien: 'Rien au-dessus du premier marqueur de citation',
    sous: 'Il y a plus de texte sous la citation qu’au-dessus : la réponse est probablement écrite dedans',
    reponse: 'La réponse',
  },
  en: {
    coupe: (n) => `Reply kept, quote recognised at line ${n + 1}`,
    entier: 'No quote: the whole message is the reply',
    rien: 'Nothing above the first quote marker',
    sous: 'There is more text under the quote than above it: the reply is probably written inside it',
    reponse: 'The reply',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Rien ne part sur le réseau : la coupe se fait dans votre navigateur, sur le texte que vous collez.',
    en: 'Nothing goes out on the network: the cut happens in your browser, on the text you paste.',
  },

  run(input, lang) {
    const t = T[lang];
    const rapport = extractReply(input);
    const debut = rapport.reply ? input.indexOf(rapport.reply) : -1;

    let label = t.entier;
    if (rapport.reason) label = t.sous;
    else if (rapport.quoted_from_line === null) label = t.entier;
    else if (!rapport.reply) label = t.rien;
    else label = t.coupe(rapport.quoted_from_line);

    return {
      output: rapport.reply,
      spans: debut >= 0
        ? [{ start: debut, end: debut + rapport.reply.length, label: t.reponse }]
        : [],
      verdict: { label },
    };
  },

  cases: [
    {
      label: { fr: 'Un fil ordinaire, la réponse au-dessus', en: 'An ordinary thread, the reply on top' },
      input: {
        fr: 'Bonjour Marie,\n\nLe devis est signé, vous pouvez lancer la production.\n\n'
          + 'Bien à vous,\nJean Dupont\n\n'
          + 'Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :\n'
          + '> Bonjour Jean,\n>\n> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?\n'
          + '>\n> Cordialement,\n> Marie',
        en: 'Hi Marie,\n\nThe quote is signed, you can start production.\n\n'
          + 'Best,\nJean\n\n'
          + 'On Oct 10, 2026, at 1:55 PM, Marie Martin <marie@exemple.fr> wrote:\n'
          + '> Hi Jean,\n>\n> Could you confirm quote DV-2026-118 before Friday?\n'
          + '>\n> Regards,\n> Marie',
      },
    },
    {
      label: { fr: 'Le même fil vu par Outlook, qui ne préfixe rien', en: 'The same thread from Outlook, which prefixes nothing' },
      input: {
        fr: 'Bonjour Marie,\n\nC’est noté, je m’en occupe.\n\nJean\n\n'
          + '________________________________\n'
          + 'De : Marie Martin <marie@exemple.fr>\n'
          + 'Envoyé : jeudi 10 octobre 2026 13:55\n'
          + 'À : Jean Dupont <jean@exemple.fr>\n'
          + 'Objet : RE: Devis DV-2026-118\n\n'
          + 'Bonjour Jean,\nPouvez-vous confirmer le devis avant vendredi ?\nMarie',
        en: 'Hi Marie,\n\nNoted, I’ll take care of it.\n\nJean\n\n'
          + '________________________________\n'
          + 'From: Marie Martin <marie@exemple.fr>\n'
          + 'Sent: Thursday, 10 October 2026 13:55\n'
          + 'To: Jean Dupont <jean@exemple.fr>\n'
          + 'Subject: RE: Quote DV-2026-118\n\n'
          + 'Hi Jean,\nCould you confirm the quote before Friday?\nMarie',
      },
    },
    {
      label: { fr: 'Un premier message, sans rien à couper', en: 'A first message, with nothing to cut' },
      input: {
        fr: 'Bonjour Marie,\n\nPouvez-vous me confirmer le devis DV-2026-118 ?\n\nBien à vous,\nJean Dupont',
        en: 'Hi Marie,\n\nCould you confirm quote DV-2026-118 for me?\n\nBest,\nJean Dupont',
      },
    },
    {
      label: { fr: 'Une réponse écrite entre les lignes citées', en: 'A reply written between the quoted lines' },
      input: {
        fr: 'Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :\n'
          + '> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?\n'
          + 'Oui, il est signé de ce matin.\n'
          + '> Et la livraison est-elle toujours prévue le 20 ?\n'
          + 'Non, le 22 : le transporteur a décalé la tournée.',
        en: 'On Oct 10, 2026, at 1:55 PM, Marie Martin <marie@exemple.fr> wrote:\n'
          + '> Could you confirm quote DV-2026-118 before Friday?\n'
          + 'Yes, it was signed this morning.\n'
          + '> And is delivery still planned for the 20th?\n'
          + 'No, the 22nd: the carrier moved the round.',
      },
      fails: true,
      why: {
        fr: 'La réponse n’est pas au-dessus du premier marqueur : elle est dedans, sous chaque question. La coupe ne rend rien, et c’est la bonne façon de se tromper — le rapport dit qu’il y a plus de texte sous la citation qu’au-dessus, au lieu de laisser croire que le message était vide. C’est le seul cas de cette fiche où monter d’un niveau se justifie, parce qu’aucun marqueur ne sépare ces lignes de celles qui les entourent.',
        en: 'The reply is not above the first marker: it is inside it, under each question. The cut returns nothing, and that is the right way to be wrong — the report says there is more text under the quote than above it, instead of letting you believe the message was empty. It is the only case on this page where moving up a level is justified, because no marker separates those lines from the ones around them.',
      },
    },
  ],
};
