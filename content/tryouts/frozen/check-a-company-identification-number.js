/**
 * Essai figé — contrôler un SIREN ou un SIRET.
 *
 * Figé, et non interactif, pour une raison mécanique : l'extrait du niveau
 * recommandé s'appuie sur `stdnum-js`, un paquet installé, et un essai
 * interactif est chargé tel quel par le navigateur. Les sorties affichées ici
 * sont donc calculées à la construction du site, en exécutant le vrai extrait.
 *
 * Les cas vont du plus ordinaire au plus instructif : ce qu'on colle d'un
 * extrait Kbis, le cas que seule la bibliothèque traite, puis les deux numéros
 * que la clé accepte et qui ne désignent pourtant pas ce qu'on croit.
 */
import { checkCompanyNumber } from '../../snippets/check-a-company-identification-number/n0.js';

const T = {
  fr: {
    ok: (kind, compact) => `${kind} bien formé — ${compact}`,
    ko: 'Refusé',
    detail: {
      SIREN: 'Neuf chiffres, clé comprise : la vérification est une identité arithmétique.',
      SIRET: 'Quatorze chiffres, clé comprise : la vérification est une identité arithmétique.',
    },
    rien: "La clé ne dit rien de plus : elle ne sait pas si ce numéro a été attribué.",
  },
  en: {
    ok: (kind, compact) => `Well-formed ${kind} — ${compact}`,
    ko: 'Refused',
    detail: {
      SIREN: 'Nine digits, check digit included: verifying it is an arithmetic identity.',
      SIRET: 'Fourteen digits, check digit included: verifying it is an arithmetic identity.',
    },
    rien: 'The key says nothing more: it does not know whether this number was ever issued.',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Chaque sortie est celle de l’extrait, exécutée à la construction du site. Rien n’est écrit à la main, et rien ne sort de la machine : le contrôle est local.',
    en: 'Every output is the snippet’s own, run when the site is built. Nothing is written by hand, and nothing leaves the machine: the check is local.',
  },

  run(input, lang) {
    const t = T[lang];
    const rapport = checkCompanyNumber(input);
    return {
      verdict: rapport.valid
        ? { label: t.ok(rapport.kind, rapport.compact), detail: t.detail[rapport.kind] }
        : { label: t.ko, detail: rapport.reason },
      output: JSON.stringify(rapport, null, 2),
      note: rapport.valid ? t.rien : undefined,
    };
  },

  cases: [
    {
      label: {
        fr: 'Un SIREN collé d’un extrait Kbis',
        en: 'A SIREN pasted from a company registry extract',
      },
      input: '732 829 320',
    },
    {
      label: {
        fr: 'Le SIRET du même établissement, séparé par des tirets',
        en: 'The SIRET of the same establishment, hyphen-separated',
      },
      input: '732-829-320-00074',
    },
    {
      label: {
        fr: 'Un SIRET de La Poste, que la clé de Luhn seule refuserait',
        en: 'A La Poste SIRET, which Luhn alone would reject',
      },
      input: '35600000009075',
    },
    {
      label: {
        fr: 'Un numéro de TVA intracommunautaire collé dans le champ',
        en: 'An EU VAT number pasted into the field',
      },
      input: 'FR44732829320',
    },
    {
      label: {
        fr: 'Neuf zéros',
        en: 'Nine zeros',
      },
      input: '000000000',
      fails: true,
      why: {
        fr: 'La clé accepte : 000000000 est bien formé. Elle ne dit pas qu’une entreprise porte ce numéro, parce qu’elle ne consulte rien — c’est le répertoire Sirene qui répond à cette question-là.',
        en: 'The key accepts: 000000000 is well-formed. It does not say a company holds that number, because it looks nothing up — the Sirene register is what answers that.',
      },
    },
    {
      label: {
        fr: 'Un SIREN saisi avec deux chiffres inversés',
        en: 'A SIREN typed with two digits swapped',
      },
      input: '382 290 401',
      fails: true,
      why: {
        fr: 'Le numéro voulu était 382 209 401 ; la saisie a inversé « 09 » en « 90 », et la clé accepte quand même. Luhn attrape toutes les fautes d’un seul chiffre, et toutes les inversions sauf celle-là.',
        en: 'The number meant was 382 209 401; the typist swapped “09” for “90”, and the key still accepts. Luhn catches every single-digit error, and every transposition but that one.',
      },
    },
  ],
};
