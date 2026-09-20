/**
 * Essai figé — contrôler un IBAN avant un virement.
 *
 * Figé, et non interactif, pour une raison mécanique : l'extrait du niveau
 * recommandé s'appuie sur `ibantools`, un paquet installé, que le navigateur
 * ne sait pas résoudre. Les sorties affichées sont calculées à la
 * construction du site, en exécutant le vrai extrait.
 *
 * Les cas montrent les deux clés à l'œuvre, puis les deux choses qu'aucune
 * clé ne sait : le compte est-il joignable, et est-il celui du bon
 * bénéficiaire.
 */
import { checkBankDetails } from '../../snippets/check-bank-details-before-a-transfer/n0.js';

const T = {
  fr: {
    ok: (pays) => `IBAN bien formé — ${pays}`,
    ko: 'Refusé',
    deux: 'Les deux clés passent : celle d’ISO 13616, et la clé RIB française.',
    une: 'La clé d’ISO 13616 passe. Ce pays n’a pas de clé nationale calculée ici.',
    rien: 'Aucune de ces clés ne dit à qui appartient le compte.',
  },
  en: {
    ok: (pays) => `Well-formed IBAN — ${pays}`,
    ko: 'Refused',
    deux: 'Both keys pass: the ISO 13616 one, and the French RIB key.',
    une: 'The ISO 13616 key passes. This country has no national key computed here.',
    rien: 'None of these keys says who owns the account.',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Chaque sortie est celle de l’extrait, exécutée à la construction du site. Les numéros affichés sont fabriqués pour cette page : ils sont valides et n’appartiennent à personne.',
    en: 'Every output is the snippet’s own, run when the site is built. The numbers shown are built for this page: they are valid and belong to nobody.',
  },

  run(input, lang) {
    const t = T[lang];
    const rapport = checkBankDetails(input);
    return {
      verdict: rapport.valid
        ? {
            label: t.ok(rapport.country),
            detail: rapport.national_key === true ? t.deux : t.une,
          }
        : { label: t.ko, detail: rapport.reason },
      output: JSON.stringify(rapport, null, 2),
      note: rapport.valid ? t.rien : undefined,
    };
  },

  cases: [
    {
      label: {
        fr: 'Un IBAN français collé d’une facture, groupé par quatre',
        en: 'A French IBAN pasted from an invoice, grouped in fours',
      },
      input: 'FR76 3000 6000 0112 3456 7890 189',
    },
    {
      label: {
        fr: 'Le même numéro, un chiffre du compte mal saisi',
        en: 'The same number, one account digit mistyped',
      },
      input: 'FR76 3000 6000 0112 3456 7891 189',
    },
    {
      label: {
        fr: 'Le même numéro, une lettre glissée dans le compte',
        en: 'The same number, a letter slipped into the account',
      },
      input: 'FR76 3000 6000 0112 3456 7A90 189',
    },
    {
      label: {
        fr: 'Un IBAN allemand, qui n’a pas de clé nationale calculée ici',
        en: 'A German IBAN, with no national key computed here',
      },
      input: 'DE89 3704 0044 0532 0130 00',
    },
    {
      label: {
        fr: 'Un IBAN brésilien, parfaitement formé',
        en: 'A Brazilian IBAN, perfectly well-formed',
      },
      input: 'BR18 0036 0305 0000 1000 9795 493C 1',
      fails: true,
      why: {
        fr: 'Le numéro passe, et aucun virement SEPA n’arrivera au Brésil. La clé contrôle la forme, pas la joignabilité : c’est pour cela que le rapport rend le pays même quand il dit oui.',
        en: 'The number passes, and no SEPA transfer will ever reach Brazil. The key checks the shape, not reachability: that is why the report returns the country even when it says yes.',
      },
    },
    {
      label: {
        fr: 'Un autre compte du même établissement',
        en: 'Another account at the same branch',
      },
      input: 'FR76 3000 6000 0109 8765 4321 028',
      fails: true,
      why: {
        fr: 'Même pays, même code banque, même guichet, et les deux clés passent : c’est la forme que prend la facture au RIB changé. Rien dans le numéro ne dit lequel des deux comptes est celui de votre fournisseur — c’est la vérification du bénéficiaire, obligatoire en zone euro depuis le 9 octobre 2025, qui le dit.',
        en: 'Same country, same bank code, same branch, and both keys pass: this is the shape the redirected-invoice fraud takes. Nothing in the number says which of the two accounts is your supplier’s — that is what payee verification, mandatory in the euro area since 9 October 2025, is for.',
      },
    },
  ],
};
