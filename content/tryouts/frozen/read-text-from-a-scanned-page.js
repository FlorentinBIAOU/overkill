/**
 * Essai figé — lire le texte d'une page scannée.
 *
 * Cet extrait ne peut pas tourner dans un navigateur : il démarre un moteur de
 * reconnaissance optique auto-hébergé, avec ses données linguistiques, et il ne
 * reçoit pas du texte mais une image. Les six cas ci-dessous sont donc exécutés
 * à la construction du site, avec le double local qui sert déjà aux tests — le
 * même que `n2.test.js`.
 *
 * Ce qui est réellement calculé ici, et que rien n'écrit à la main : la page
 * envoyée au moteur, le nettoyage du texte qui revient — espaces d'un document
 * photographié, mot coupé par une fin de ligne — le seuil sous lequel la page
 * part en relecture, et ce que le code fait quand un appel tombe. Ce que le
 * moteur lit dans les pixels, lui, est simulé : c'est le partage que la fiche
 * déclare avec sa mention « testé, moteur simulé ».
 *
 * Le dernier cas est le point de rupture du niveau : une référence fausse, un
 * score haut, et pas un drapeau levé.
 */
import { FakeOCR } from '../../snippets/_harness/fake-model.mjs';
import {
  DEFAULT_MIN_CONFIDENCE,
  readPage,
} from '../../snippets/read-text-from-a-scanned-page/n2.js';

/**
 * Ce qu'un moteur rend sur une page de bureau : le texte, avec les espaces en
 * dents de scie d'un document photographié plutôt que composé. Un exemplaire
 * par langue, puisque le moteur se règle sur une langue.
 */
const LECTURES = {
  fr: {
    nette: 'NORD FOURNITURES SAS\n'
      + '   N° 2024-000431\n'
      + '\n'
      + '   Émise le 3 avril 2024\n'
      + 'NET A PAYER    92,40 EUR\n',
    coupee: 'Merci de joindre un second exem-\nplaire de la facture au bon de\nlivraison.\n',
    confiante: 'N° 2O24-OOO431\n   NET A PAYER    92,40 EUR\n',
  },
  en: {
    nette: 'NORTHERN SUPPLIES LTD\n'
      + '   Invoice 2024-000431\n'
      + '\n'
      + '   Issued 03/04/2024\n'
      + 'TOTAL DUE    92.40 EUR\n',
    coupee: 'Please attach a second dupli-\ncate of the invoice to the\ndelivery note.\n',
    confiante: 'Invoice 2O24-OOO431\n   TOTAL DUE    92.40 EUR\n',
  },
};

/** Un moteur qui laisse tomber un appel, comme un processus déjà occupé. */
class MoteurCapricieux {
  constructor(moteur, chutes) {
    this.moteur = moteur;
    this.chutes = chutes;
    this.appels = 0;
  }

  async read(image) {
    this.appels += 1;
    if (this.chutes > 0) {
      this.chutes -= 1;
      throw new Error('le processus du moteur n’était pas prêt');
    }
    return this.moteur.read(image);
  }
}

const T = {
  fr: {
    lue: (confiance, appels) => `Confiance ${confiance}, au-dessus du seuil de ${DEFAULT_MIN_CONFIDENCE.toString().replace('.', ',')} : la page est classée sans relecture. ${appels === 1 ? 'Un appel' : `${appels} appels`}, sur votre machine, sans clé ni quota.`,
    relue: (confiance, appels) => `Confiance ${confiance}, sous le seuil de ${DEFAULT_MIN_CONFIDENCE.toString().replace('.', ',')} : le texte est gardé et la page part en relecture humaine. ${appels === 1 ? 'Un appel' : `${appels} appels`}, sur votre machine, sans clé ni quota.`,
    reprise: 'Le premier appel est tombé, le second a répondu.',
    vide: (confiance) => `Le moteur se dit sûr à ${confiance}, et n’a pourtant rendu aucun texte : la page part en relecture, parce qu’une page blanche n’est pas une lecture.`,
  },
  en: {
    lue: (confiance, appels) => `Confidence ${confiance}, above the threshold of ${DEFAULT_MIN_CONFIDENCE}: the page is filed without review. ${appels === 1 ? 'One call' : `${appels} calls`}, on your own machine, with no key and no quota.`,
    relue: (confiance, appels) => `Confidence ${confiance}, below the threshold of ${DEFAULT_MIN_CONFIDENCE}: the text is kept and the page goes to human review. ${appels === 1 ? 'One call' : `${appels} calls`}, on your own machine, with no key and no quota.`,
    reprise: 'The first call dropped, the second answered.',
    vide: (confiance) => `The engine claims ${confiance} confidence and returned no text at all: the page goes to review, because a blank page is not a reading.`,
  },
};

/** Exécute l'extrait sur un cas décrit, et rend ce qui s'est réellement passé. */
async function execute(image, lang, { lecture, confiance, chutes = 0 }) {
  const t = T[lang];
  const pages = lecture ? { [image]: LECTURES[lang][lecture] } : {};
  const moteur = new FakeOCR(pages, confiance);
  const double = chutes ? new MoteurCapricieux(moteur, chutes) : moteur;
  const { text, confidence, review } = await readPage(image, double);
  const appels = chutes ? double.appels : moteur.calls.length;
  const dit = confidence.toString().replace('.', lang === 'fr' ? ',' : '.');
  const note = text === ''
    ? t.vide(dit)
    : review ? t.relue(dit, appels) : t.lue(dit, appels);
  return {
    output: text,
    note: chutes ? `${t.reprise} ${note}` : note,
  };
}

export default {
  level: 'N2',

  note: {
    fr: 'Ce que le moteur lit dans les pixels est simulé par le double local qui sert aux tests. Ce qui est calculé ici, c’est le nettoyage du texte qui revient, le seuil sous lequel la page part en relecture, et ce que le code fait d’un appel tombé.',
    en: 'What the engine reads in the pixels is simulated by the local double the tests use. What is computed here is the cleaning of the text that comes back, the threshold under which the page goes to review, and what the code does with a dropped call.',
  },

  async run(image, lang, cas = {}) {
    const simulation = cas.simulate ?? {};
    return execute(image, lang, {
      lecture: simulation.lecture ?? null,
      confiance: simulation.confiance ?? 0.94,
      chutes: simulation.chutes ?? 0,
    });
  },

  cases: [
    {
      label: { fr: 'Un scan net de facture', en: 'A clean invoice scan' },
      input: 'scan-facture-000431.png',
      simulate: { lecture: 'nette', confiance: 0.94 },
      shown: {
        fr: 'scan-facture-000431.png — la facture Nord Fournitures, posée à plat',
        en: 'scan-facture-000431.png — the Northern Supplies invoice, laid flat',
      },
    },
    {
      label: { fr: 'Un mot coupé par la fin de ligne', en: 'A word cut by the end of a line' },
      input: 'scan-bon-livraison.png',
      simulate: { lecture: 'coupee', confiance: 0.91 },
      shown: {
        fr: 'scan-bon-livraison.png — un bon de livraison où « exem- plaire » tient sur deux lignes',
        en: 'scan-bon-livraison.png — a delivery note where “dupli- cate” sits across two lines',
      },
    },
    {
      label: { fr: 'Un fax pâle', en: 'A faint fax' },
      input: 'fax-facture-000431.png',
      simulate: { lecture: 'nette', confiance: 0.41 },
      shown: {
        fr: 'fax-facture-000431.png — la même facture, reçue par télécopie',
        en: 'fax-facture-000431.png — the same invoice, received by fax',
      },
    },
    {
      label: { fr: 'Le verso vierge d’une page', en: 'The blank back of a page' },
      input: 'scan-verso-vierge.png',
      simulate: { confiance: 0.99 },
      shown: {
        fr: 'scan-verso-vierge.png — le dos d’une feuille, passé au scanner avec le reste',
        en: 'scan-verso-vierge.png — the back of a sheet, scanned along with the rest',
      },
    },
    {
      label: { fr: 'Un appel tombe', en: 'A call drops' },
      input: 'scan-facture-000431.png',
      simulate: { lecture: 'nette', confiance: 0.94, chutes: 1 },
      shown: {
        fr: 'scan-facture-000431.png — la même page, mais le premier appel échoue',
        en: 'scan-facture-000431.png — the same page, but the first call fails',
      },
    },
    {
      label: { fr: 'Un zéro lu comme un O', en: 'A zero read as an O' },
      input: 'scan-facture-000431-bis.png',
      simulate: { lecture: 'confiante', confiance: 0.96 },
      shown: {
        fr: 'scan-facture-000431-bis.png — un scan net, glyphes bien détachés',
        en: 'scan-facture-000431-bis.png — a clean scan, glyphs well separated',
      },
      fails: true,
      why: {
        fr: 'La facture porte la référence 2024-000431 ; le moteur rend « 2O24-OOO431 », avec la lettre O à la place du zéro, et une confiance de 0,96. Le drapeau de relecture reste baissé, puisque le moteur n’a pas hésité : le scan est net, les glyphes sont détachés, et c’est justement pour cela qu’il est sûr de lui. Relever le seuil n’y change rien, l’erreur est confiante. Ce qui la rattrape, c’est une règle sur la forme attendue de vos références, écrite à la main : le barreau N0, de nouveau.',
        en: 'The invoice carries the reference 2024-000431; the engine returns “2O24-OOO431”, with the letter O in place of the zero, and a confidence of 0.96. The review flag stays down, because the engine never hesitated: the scan is clean, the glyphs are well separated, and that is exactly why it is sure of itself. Raising the threshold changes nothing, the mistake is confident. What catches it is a rule about the shape your references take, written by hand: rung N0 again.',
      },
    },
  ],
};
