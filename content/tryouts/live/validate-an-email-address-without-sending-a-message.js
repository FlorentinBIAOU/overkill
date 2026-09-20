/**
 * Essai interactif — contrôler la forme d'une adresse électronique.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe, exactement comme sur votre serveur.
 *
 * Le verdict affiche trois choses, et c'est l'écart entre elles que l'essai
 * met en scène : la forme est-elle celle du standard HTML, l'adresse
 * normalisée — domaine en minuscules, partie locale intacte —, et le domaine
 * porte-t-il un point, ce qui est tout ce que `routable` sait. Un point n'est
 * pas une résolution : dire que le domaine « se résout sur l'internet public »
 * contredirait le point de rupture de la fiche à deux centimètres de lui.
 */
import { checkEmailSyntax } from '../../snippets/validate-an-email-address-without-sending-a-message/n0.js';

const T = {
  fr: {
    ok: 'Forme valide',
    ko: 'Refusé',
    routable: (domaine) => `Normalisée en ${domaine}. Le domaine porte un point : rien ici ne dit qu’il existe, seulement qu’il n’est pas un nom d’hôte local.`,
    locale: (domaine) => `Normalisée en ${domaine}. Le domaine n’a pas de point : aucun serveur de courrier public ne l’atteindra.`,
  },
  en: {
    ok: 'Valid shape',
    ko: 'Refused',
    routable: (domaine) => `Normalised to ${domaine}. The domain carries a dot: nothing here says it exists, only that it is not a local host name.`,
    locale: (domaine) => `Normalised to ${domaine}. The domain has no dot: no public mail server will reach it.`,
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Tapez une adresse. Le contrôle est celui du standard HTML, celui que votre navigateur applique déjà au champ : rien ne part sur le réseau, et rien ne dit si la boîte existe.',
    en: 'Type an address. The check is the HTML standard’s, the one your browser already applies to the field: nothing goes out on the network, and nothing says whether the mailbox exists.',
  },

  run(input, lang) {
    const t = T[lang];
    const rapport = checkEmailSyntax(input);
    return {
      verdict: rapport.valid
        ? {
            label: t.ok,
            detail: rapport.routable ? t.routable(rapport.normalised) : t.locale(rapport.normalised),
          }
        : { label: t.ko, detail: rapport.reason },
      output: JSON.stringify(rapport, null, 2),
    };
  },

  cases: [
    {
      label: {
        fr: 'Une adresse de formulaire, avec des majuscules',
        en: 'An address from a form, with capitals',
      },
      input: 'Jean.DUPONT@Exemple.FR',
    },
    {
      label: {
        fr: 'Une adresse internationalisée',
        en: 'An internationalised address',
      },
      input: 'jéan@exemple.fr',
    },
    {
      label: {
        fr: 'Un nom d’hôte sans point',
        en: 'A host name with no dot',
      },
      input: 'jean@localhost',
    },
    {
      label: {
        fr: 'Une faute de frappe sur le domaine',
        en: 'A typo in the domain',
      },
      input: 'jean.dupont@gmial.com',
      fails: true,
      why: {
        fr: 'La forme est parfaite, et le domaine est une faute de frappe sur gmail.com : le courriel partira et ne reviendra jamais. La syntaxe ne consulte rien — pour savoir si le domaine reçoit du courrier, il faut résoudre ses enregistrements MX, et pour savoir si la boîte existe, il faut lui écrire.',
        en: 'The shape is perfect, and the domain is a typo for gmail.com: the message will leave and never come back. Syntax looks nothing up — to know whether the domain takes mail you have to resolve its MX records, and to know whether the mailbox exists you have to write to it.',
      },
    },
  ],
};
