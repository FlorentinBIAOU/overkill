/**
 * Essai interactif — réparer un texte au mauvais encodage.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe. Collez-y une valeur sortie d'un
 * import, elle sera traitée exactement comme sur votre serveur.
 *
 * Le surlignage montre ce qui a changé de part et d'autre, ce qui est la seule
 * façon honnête d'afficher une réparation : on voit ce que le code a réécrit.
 */
import { repairEncoding } from '../../snippets/repair-text-with-broken-encoding/n0.js';

const T = {
  fr: {
    repare: 'Réparé',
    intact: 'Laissé tel quel',
    perdu: 'Des octets ont déjà été perdus',
    detailRepare: 'Les octets ont été réécrits en Windows-1252 puis relus en UTF-8.',
    detailIntact: 'Aucune suite d’octets ne se lit comme de l’UTF-8 mal décodé.',
    detailPerdu: 'Le texte porte le caractère de remplacement : ces octets-là ne reviendront pas.',
  },
  en: {
    repare: 'Repaired',
    intact: 'Left as it was',
    perdu: 'Bytes were already lost',
    detailRepare: 'The characters were written back as Windows-1252 bytes and read again as UTF-8.',
    detailIntact: 'No run of bytes reads as mis-decoded UTF-8.',
    detailPerdu: 'The text carries the replacement character: those bytes are not coming back.',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Collez une valeur sortie d’un import. Rien ne part sur le réseau : la réparation est une opération sur les octets, faite ici même.',
    en: 'Paste a value that came out of an import. Nothing goes out on the network: the repair is a byte operation, done right here.',
  },

  run(input, lang) {
    const t = T[lang];
    const rapport = repairEncoding(input);
    const label = rapport.lossy ? t.perdu : rapport.changed ? t.repare : t.intact;
    const detail = rapport.lossy ? t.detailPerdu : rapport.changed ? t.detailRepare : t.detailIntact;
    return {
      output: rapport.text,
      diff: true,
      verdict: { label, detail },
    };
  },

  cases: [
    {
      label: { fr: 'Un nom d’entreprise sorti d’un import', en: 'A company name out of an import' },
      input: 'CrÃ©dit Agricole, 12 rue des FrÃ¨res-LumiÃ¨re',
    },
    {
      label: { fr: 'Le même accident deux fois de suite', en: 'The same accident twice over' },
      input: 'ÃƒÂ©tÃƒÂ© ÃƒÂ  Nice',
    },
    {
      label: { fr: 'Une ligne déjà correcte, avec tout ce qui ressemble à du texte cassé', en: 'A line already correct, with everything that looks like broken text' },
      input: 'São Paulo, Ångström, Île-de-France, L’été à Nice',
    },
    {
      label: { fr: 'La phrase d’un ticket de bogue', en: 'A sentence from a bug report' },
      input: 'Bug : on voit « Ã© » au lieu de « é » dans le PDF',
      fails: true,
      why: {
        fr: 'Le réparateur ne sait pas que la phrase parle de l’encodage : il répare l’exemple cité, et le ticket dit maintenant « on voit « é » au lieu de « é » ». C’est pour cela que l’extrait rend un drapeau « changed » au lieu de réécrire en place — une réparation que personne n’a notée ne se distingue pas d’une donnée qui a toujours été ainsi.',
        en: 'The repair has no idea the sentence is about encoding: it repairs the quoted example, and the ticket now reads “we see « é » instead of « é »”. That is why the snippet returns a “changed” flag instead of rewriting in place — a repair nobody recorded is indistinguishable from data that was always like that.',
      },
    },
  ],
};
