/**
 * Essai interactif — repérer un numéro de suivi dans un e-mail.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe. Collez-y une de vos confirmations
 * d'expédition.
 *
 * Ce qui est surligné dans l'entrée est ce qui a été reconnu. La colonne
 * « vérifié » est la seule qui compte : elle distingue un identifiant dont le
 * chiffre de contrôle est juste d'une simple forme reconnue.
 */
import { findTrackingNumbers } from '../../snippets/extract-tracking-numbers-from-an-email/n0.js';

const T = {
  fr: {
    colonnes: ['Trouvé', 'Famille', 'Vérifié', 'Pourquoi'],
    oui: 'oui',
    non: 'non',
    lu: (n, v) => `${n} candidat(s), dont ${v} vérifié(s) par leur chiffre de contrôle`,
    rien: 'Aucune référence de colis dans ce texte',
    trouve: 'Candidat',
    raisons: {
      null: 'chiffre de contrôle juste',
      'shape only: this family carries nothing to check': 'forme seule : cette famille ne porte rien à vérifier',
      'the check digit does not match the serial number': 'le chiffre de contrôle ne correspond pas au numéro de série',
    },
  },
  en: {
    colonnes: ['Found', 'Family', 'Checked', 'Why'],
    oui: 'yes',
    non: 'no',
    lu: (n, v) => `${n} candidate(s), ${v} of them verified by their check digit`,
    rien: 'No parcel reference in this text',
    trouve: 'Candidate',
    raisons: {
      null: 'check digit is right',
      'shape only: this family carries nothing to check': 'shape only: this family carries nothing to check',
      'the check digit does not match the serial number': 'the check digit does not match the serial number',
    },
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Rien ne part sur le réseau : aucun transporteur n’est interrogé. Seule la norme UPU S10 porte un chiffre de contrôle ; les autres familles ne sont que des formes reconnues.',
    en: 'Nothing goes out on the network: no carrier is queried. Only the UPU S10 standard carries a check digit; the other families are recognised shapes and nothing more.',
  },

  run(input, lang, cas) {
    const t = T[lang];
    const familles = cas?.familles ?? ['upu-s10', 'ups'];
    const rapport = findTrackingNumbers(input, familles);
    const verifies = rapport.found.filter((f) => f.checked).length;

    return {
      spans: rapport.found.map((f) => ({ start: f.start, end: f.end, label: t.trouve })),
      rows: {
        columns: t.colonnes,
        rows: rapport.found.map((f) => [
          { v: f.text, caught: f.checked },
          f.family,
          f.checked ? t.oui : t.non,
          t.raisons[f.why ?? 'null'],
        ]),
      },
      verdict: {
        label: rapport.found.length ? t.lu(rapport.found.length, verifies) : t.rien,
      },
    };
  },

  cases: [
    {
      label: { fr: 'Une confirmation d’expédition', en: 'A shipping confirmation' },
      input: {
        fr: 'Bonjour,\n\nVotre commande 1234567890 du 10 octobre 2026 est expédiée.\n'
          + 'Numéro de suivi Colissimo : RB123456785GB.\nSuivi UPS : 1Z9999W99999999999.\n\n'
          + 'Cordialement,\nLe service client',
        en: 'Hello,\n\nYour order 1234567890 of 10 October 2026 has shipped.\n'
          + 'Tracking number: RB123456785GB.\nUPS tracking: 1Z9999W99999999999.\n\n'
          + 'Regards,\nCustomer service',
      },
    },
    {
      label: { fr: 'Le même numéro, un chiffre recopié de travers', en: 'The same number, one digit copied wrong' },
      input: {
        fr: 'Votre numéro de suivi est RB123456784GB, à saisir sur le site du transporteur.',
        en: 'Your tracking number is RB123456784GB, to be entered on the carrier’s site.',
      },
    },
    {
      label: { fr: 'Un indicatif que la norme réserve', en: 'A service indicator the standard reserves' },
      input: {
        fr: 'Référence interne SA123456785GB, à ne pas confondre avec un numéro de suivi.',
        en: 'Internal reference SA123456785GB, not to be mistaken for a tracking number.',
      },
    },
    {
      label: { fr: 'Le même e-mail, avec la famille « dix chiffres » demandée', en: 'The same email, with the “ten digits” family asked for' },
      input: {
        fr: 'Bonjour,\n\nVotre commande 1234567890 du 10 octobre 2026 est expédiée.\n'
          + 'Numéro de suivi Colissimo : RB123456785GB.\nNotre téléphone : 0123456789.\n',
        en: 'Hello,\n\nYour order 1234567890 of 10 October 2026 has shipped.\n'
          + 'Tracking number: RB123456785GB.\nOur phone: 0123456789.\n',
      },
      familles: ['upu-s10', 'ups', 'ten-digits'],
      fails: true,
      why: {
        fr: 'La famille « dix chiffres » est la forme d’une lettre de transport DHL Express, et c’est aussi celle du numéro de commande et du numéro de téléphone du même message : les trois reviennent, aucun n’est vérifié, et rien dans le nombre lui-même ne permettrait de les départager. C’est pourquoi cette famille n’est pas cherchée par défaut : la déclarer est un choix de l’appelant, qui sait ce qu’il reçoit. Le numéro Colissimo de la même ligne, lui, revient vérifié — son onzième caractère se recalcule à partir des huit précédents.',
        en: 'The “ten digits” family is the shape of a DHL Express air waybill, and it is also the shape of the order number and the phone number in the same message: all three come back, none of them verified, and nothing in the number itself could tell them apart. That is why this family is not searched by default: declaring it is the caller’s choice, and the caller knows what they receive. The postal number on the same line does come back verified — its eleventh character is recomputed from the eight before it.',
      },
    },
  ],
};
