/**
 * Essai figé — savoir si un PDF a besoin d'OCR.
 *
 * Figé, et non interactif : l'entrée est un fichier PDF, pas du texte, et
 * l'extrait du niveau recommandé s'appuie sur `pdf.js`, un paquet installé.
 * Les sorties sont calculées à la construction du site, en exécutant le vrai
 * extrait sur les documents ci-dessous — cinq PDF minimaux fabriqués pour
 * cette page, qui sont de vrais PDF.
 *
 * Ce que l'essai montre, c'est le plan de tri : pour chaque page, le nombre de
 * caractères qu'elle rend, le nombre d'images qu'elle trace, et la décision.
 */
import { triagePages } from '../../snippets/know-whether-a-pdf-needs-ocr/n0.js';
import {
  ENTETE_SCAN, MIXTE, MOJIBAKE, NUMERIQUE, SCAN,
} from '../../snippets/know-whether-a-pdf-needs-ocr/fixtures.mjs';

const DOCUMENTS = { NUMERIQUE, SCAN, MIXTE, ENTETE_SCAN, MOJIBAKE };

const T = {
  fr: {
    colonnes: ['Page', 'Caractères', 'Images', 'Décision'],
    verdicts: { text: 'se lit', scan: 'à l’OCR', blank: 'rien à lire' },
    plan: (ocr, lus) => `${ocr} page(s) à envoyer à l’OCR, ${lus} à lire gratuitement`,
  },
  en: {
    colonnes: ['Page', 'Characters', 'Images', 'Decision'],
    verdicts: { text: 'readable', scan: 'to OCR', blank: 'nothing to read' },
    plan: (ocr, lus) => `${ocr} page(s) to send to OCR, ${lus} to read for free`,
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Cinq documents, et le plan de tri que l’extrait en tire. Les sorties sont celles du code, exécutées à la construction du site : rien n’est écrit à la main.',
    en: 'Five documents, and the triage plan the snippet derives from them. The outputs are the code’s own, run when the site is built: nothing is written by hand.',
  },

  async run(input, lang, cas) {
    const t = T[lang];
    const plan = await triagePages(DOCUMENTS[cas?.document ?? 'NUMERIQUE']);
    return {
      rows: {
        columns: t.colonnes,
        rows: plan.pages.map((p) => [
          String(p.page),
          String(p.characters),
          String(p.images),
          { v: t.verdicts[p.verdict], caught: p.verdict === 'scan' },
        ]),
      },
      verdict: {
        label: t.plan(plan.needs_ocr.length, plan.readable.length),
        detail: input,
      },
    };
  },

  cases: [
    {
      label: { fr: 'Un contrat exporté d’un traitement de texte', en: 'A contract exported from a word processor' },
      input: { fr: 'Deux pages de texte, aucune image : rien à payer.', en: 'Two pages of text, no image: nothing to pay for.' },
      document: 'NUMERIQUE',
    },
    {
      label: { fr: 'Un document entièrement scanné', en: 'A document scanned from end to end' },
      input: { fr: 'Deux pages d’image, aucun caractère : les deux partent à l’OCR.', en: 'Two image pages, no characters: both go to OCR.' },
      document: 'SCAN',
    },
    {
      label: { fr: 'Un contrat dont une seule page est scannée', en: 'A contract with a single scanned page' },
      input: { fr: 'Trois pages, une seule à payer : c’est ce que le tri par document fait perdre.', en: 'Three pages, one to pay for: this is what per-document triage costs you.' },
      document: 'MIXTE',
    },
    {
      label: { fr: 'Une page scannée qui porte un en-tête en vrai texte', en: 'A scanned page carrying a header in real text' },
      input: { fr: 'Vingt-huit caractères et une image : une règle qui demande « y a-t-il du texte » la déclarerait lisible.', en: 'Twenty-eight characters and one image: a rule that asks “is there any text” would call it readable.' },
      document: 'ENTETE_SCAN',
    },
    {
      label: { fr: 'Une page dont la police n’a pas de table de caractères', en: 'A page whose font carries no character map' },
      input: { fr: 'Cent quatre-vingt-trois caractères, aucune image : rangée parmi les pages lisibles.', en: 'A hundred and eighty-three characters, no image: filed among the readable pages.' },
      document: 'MOJIBAKE',
      fails: true,
      why: {
        fr: 'La page rend « #$%&!*+,-./0123 » là où elle affiche un paragraphe, et le compte de caractères ne voit pas la différence : elle est déclarée lisible. C’est le point de rupture de ce niveau, et c’est ce que le niveau N1 attrape en notant les paires de lettres contre celles de vos pages sûres.',
        en: 'The page yields “#$%&!*+,-./0123” where it shows a paragraph, and counting characters cannot tell: it is called readable. That is this level’s breaking point, and it is what level N1 catches by scoring letter pairs against those of the pages you already trust.',
      },
    },
  ],
};
