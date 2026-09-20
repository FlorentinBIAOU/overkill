/**
 * Essai figé — valider un numéro de téléphone et son indicatif.
 *
 * Figé, et non interactif : l'extrait du niveau recommandé s'appuie sur
 * `libphonenumber-js`, un paquet installé que le navigateur ne résout pas.
 * Les sorties affichées sont calculées à la construction du site, en exécutant
 * le vrai extrait.
 *
 * Les cas passent chaque numéro avec la région que l'appelant déclare, parce
 * que c'est précisément ce que la fiche refuse de deviner. La région déclarée
 * est écrite dans l'intitulé du cas.
 */
import { validatePhoneNumber } from '../../snippets/validate-a-phone-number-and-its-country-code/n0.js';

const T = {
  fr: {
    ok: (nature) => `Numéro valide — ${nature}`,
    ko: 'Refusé',
    nature: {
      MOBILE: 'Une ligne mobile : un SMS arrivera.',
      FIXED_LINE: 'Une ligne fixe : un SMS n’arrivera pas.',
    },
  },
  en: {
    ok: (nature) => `Valid number — ${nature}`,
    ko: 'Refused',
    nature: {
      MOBILE: 'A mobile line: a text message will arrive.',
      FIXED_LINE: 'A fixed line: a text message will not arrive.',
    },
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Chaque sortie est celle de l’extrait, exécutée à la construction du site. La région déclarée par l’appelant figure dans l’intitulé du cas : l’extrait ne la devine jamais.',
    en: 'Every output is the snippet’s own, run when the site is built. The region the caller declares is in the case label: the snippet never guesses it.',
  },

  /* `cas.region` est ce que l'appelant déclare : l'extrait ne le devine
     jamais, et un cas sans région est un cas où l'on ne déclare rien. */
  run(input, lang, cas) {
    const t = T[lang];
    const rapport = validatePhoneNumber(input, { defaultRegion: cas?.region });
    return {
      verdict: rapport.valid
        ? {
            label: t.ok(`${rapport.region} ${rapport.e164}`),
            detail: t.nature[rapport.type] ?? rapport.type,
          }
        : { label: t.ko, detail: rapport.reason },
      output: JSON.stringify(rapport, null, 2),
    };
  },

  cases: [
    {
      label: {
        fr: 'Un mobile français, région FR déclarée',
        en: 'A French mobile, region FR declared',
      },
      input: '06 12 34 56 78',
      region: 'FR',
    },
    {
      label: {
        fr: 'Un fixe français, région FR déclarée',
        en: 'A French fixed line, region FR declared',
      },
      input: '01 23 45 67 89',
      region: 'FR',
    },
    {
      label: {
        fr: 'Les mêmes chiffres, région BE déclarée',
        en: 'The same digits, region BE declared',
      },
      input: '0470 12 34 56',
      region: 'BE',
    },
    {
      label: {
        fr: 'Un numéro sans indicatif, et rien de déclaré',
        en: 'A number with no country code, and nothing declared',
      },
      input: '06 12 34 56 78',
      fails: true,
      why: {
        fr: 'Aucune région n’est déclarée et le numéro n’en porte pas : l’extrait refuse au lieu de supposer la France. Le cas juste au-dessus montre pourquoi — « 0470 12 34 56 » est un fixe en France et un mobile en Belgique.',
        en: 'No region is declared and the number carries none: the snippet refuses instead of assuming France. The case just above shows why — “0470 12 34 56” is a fixed line in France and a mobile in Belgium.',
      },
    },
    {
      label: {
        fr: 'Un numéro béninois à l’ancienne forme, huit chiffres',
        en: 'A Benin number in the old eight-digit form',
      },
      input: '+229 97 12 34 56',
      fails: true,
      why: {
        fr: 'Ce numéro était ordinaire avant le passage du Bénin à dix chiffres ; le plan a changé, et la bibliothèque le refuse. C’est le coût réel de ce niveau : la table est datée, et elle se met à jour comme une dépendance.',
        en: 'This number was ordinary before Benin moved to ten digits; the plan changed, and the library refuses it. That is this level’s real cost: the table is dated, and it is updated like any dependency.',
      },
    },
    {
      label: {
        fr: 'Le même numéro béninois à la forme actuelle',
        en: 'The same Benin number in its current form',
      },
      input: '+229 01 97 12 34 56',
    },
  ],
};
