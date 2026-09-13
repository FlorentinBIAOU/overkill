/**
 * Essai figé — extraire les champs d'une facture avec un modèle de document.
 *
 * Cet extrait ne peut pas tourner dans un navigateur : il charge un modèle de
 * compréhension de document auto-hébergé, dont les poids se téléchargent une
 * fois et pèsent plusieurs centaines de mégaoctets. Les six cas ci-dessous sont
 * donc exécutés à la construction du site, avec le double local qui sert déjà
 * aux tests — le même que `n2.test.js`.
 *
 * Ce qui est réellement calculé ici, et que rien n'écrit à la main : la
 * géométrie envoyée au modèle, ce que le code refuse avant de l'appeler, ce
 * qu'il réessaie quand une passe tombe, la lecture d'un montant ou d'une date
 * dans la ligne désignée, et le seuil sous lequel un champ part en relecture.
 * Les scores du modèle, eux, sont simulés : c'est le partage que la fiche
 * déclare avec sa mention « testé, modèle simulé ».
 *
 * Le dernier cas est le point de rupture du niveau, et le plus utile de la
 * page : le code rend un montant faux sans lever le moindre drapeau.
 */
import { FakeClassifier } from '../../snippets/_harness/fake-model.mjs';
import {
  MAX_LINES,
  extractFields,
} from '../../snippets/extract-fields-from-invoice/n2.js';

/**
 * Une facture de fournitures de bureau, dans la mise en page que l'affinage
 * connaît : l'en-tête, la référence, la date, une ligne d'article, puis le bloc
 * des totaux. Un exemplaire par langue, avec la date écrite comme elle l'est
 * dans chaque pays.
 */
const FACTURE = {
  fr: [
    'NORD FOURNITURES SAS',
    '                            N° 2024-000431',
    '                            Émise le 3 avril 2024',
    'Cartouche encre noire            2    38,50      77,00',
    '                    Sous-total                     77,00',
    '                    TVA (20 %)                     15,40',
    '                    NET A PAYER                    92,40 EUR',
  ],
  en: [
    'NORTHERN SUPPLIES LTD',
    '                            Invoice 2024-000431',
    '                            Issued 03/04/2024',
    'Black ink cartridge              2    38.50      77.00',
    '                    Subtotal                       77.00',
    '                    VAT (20 %)                     15.40',
    '                    TOTAL DUE                      92.40 EUR',
  ],
};

/**
 * La même facture avec un acompte déjà versé : trois montants au lieu d'un, et
 * une mise en page que l'affinage n'a jamais vue.
 */
/* données-fictives:début — une facture d'exemple. Ses montants sont les
   données que l'extrait doit lire, pas un tarif que le site affirme
   (interdit 2). */
const ACOMPTE = {
  fr: [
    'VERRERIE DU CENTRE',
    'Facture V-2451 du 12/09/2024',
    'Bocaux 500 ml x 200                          264,00',
    'Total TTC                                    360,00 €',
    'Acompte versé le 02/09                       120,00 €',
    'Solde à régler                               240,00 €',
  ],
  en: [
    'CENTRAL GLASSWORKS',
    'Invoice V-2451 of 12/09/2024',
    'Jars 500 ml x 200                            264.00',
    'Total incl. VAT                              360.00',
    'Deposit paid on 02/09                        120.00',
    'Balance to pay                               240.00',
  ],
};
/* données-fictives:fin */

/**
 * Les étiquettes sont celles qu'un modèle de facture expose ; les scores sont
 * les nôtres, pour que l'essai mette à l'épreuve nos seuils et non les opinions
 * du modèle.
 */
const SCORES = {
  juste: (lignes) => ({
    [lignes[1]]: { invoice_number: 0.97, date: 0.11 },
    [lignes[2]]: { date: 0.95 },
    [lignes[6]]: { total: 0.93, invoice_number: 0.02 },
  }),
  enTete: (lignes) => ({ ...SCORES.juste(lignes), [lignes[0]]: { total: 0.99 } }),
  acompte: (lignes) => ({
    [lignes[1]]: { invoice_number: 0.95, date: 0.9 },
    [lignes[3]]: { total: 0.41 },
    [lignes[4]]: { total: 0.96 },
  }),
};

/** Un modèle qui laisse tomber une passe, comme une machine sous charge. */
class ModeleCapricieux {
  constructor(modele, chutes) {
    this.modele = modele;
    this.chutes = chutes;
    this.passes = 0;
  }

  async predict(lignes) {
    this.passes += 1;
    if (this.chutes > 0) {
      this.chutes -= 1;
      throw new Error('le modèle n’était pas chargé');
    }
    return this.modele.predict(lignes);
  }
}

const CHAMPS = {
  fr: { invoice_number: 'Numéro de facture', date: 'Date', total: 'Montant dû' },
  en: { invoice_number: 'Invoice number', date: 'Date', total: 'Amount due' },
};

/** Un nombre tel qu'on l'écrit dans chaque langue. Le montant garde ses centimes. */
function nombre(valeur, lang, decimales = 2) {
  const ecrit = valeur.toFixed(decimales);
  return lang === 'fr' ? ecrit.replace('.', ',') : ecrit;
}

const T = {
  fr: {
    colonnes: ['Champ', 'Valeur lue', 'Score', 'Relecture humaine'],
    rien: '— rien lu',
    oui: 'oui',
    non: 'non',
    passe: (n, lignes) => `${n === 1 ? 'Une passe' : `${n} passes`} pour les ${lignes} lignes de la facture, et rien n’a quitté la machine : les poids sont en local.`,
    reprise: (n) => `${n} passes : la première est tombée, la seconde a répondu. Rien n’a quitté la machine.`,
    aucuneRelecture: 'Aucun champ n’est envoyé en relecture : le modèle n’a hésité sur rien.',
    refus: 'Refusé avant la première passe',
    refusNote: 'Aucune passe envoyée, aucune seconde de calcul dépensée.',
  },
  en: {
    colonnes: ['Field', 'Value read', 'Score', 'Human review'],
    rien: '— nothing read',
    oui: 'yes',
    non: 'no',
    passe: (n, lignes) => `${n === 1 ? 'One pass' : `${n} passes`} for the ${lignes} lines of the invoice, and nothing left the machine: the weights are local.`,
    reprise: (n) => `${n} passes: the first one dropped, the second answered. Nothing left the machine.`,
    aucuneRelecture: 'Not one field is sent to review: the model hesitated over nothing.',
    refus: 'Refused before the first pass',
    refusNote: 'No pass sent, not a second of computation spent.',
  },
};

/** Exécute l'extrait sur un cas décrit, et rend ce qui s'est réellement passé. */
async function execute(entree, lang, { scores, chutes = 0, threshold }) {
  const t = T[lang];
  const modele = new FakeClassifier(scores);
  const double = chutes ? new ModeleCapricieux(modele, chutes) : modele;
  const passes = () => (chutes ? double.passes : modele.calls.length);
  try {
    const champs = await extractFields(entree, double, threshold ? { threshold } : {});
    const relus = Object.values(champs).filter((champ) => champ.review).length;
    return {
      rows: {
        columns: t.colonnes,
        rows: Object.entries(champs).map(([nom, champ]) => [
          CHAMPS[lang][nom],
          champ.value === null
            ? t.rien
            : typeof champ.value === 'number' ? nombre(champ.value, lang) : champ.value,
          nombre(champ.score, lang),
          /* La cellule surlignée est la décision qui compte : ce champ-là ne
             part pas en production sans qu'une personne l'ait regardé. */
          champ.review ? { v: t.oui, caught: true } : t.non,
        ]),
      },
      note: relus === 0
        ? `${chutes ? t.reprise(passes()) : t.passe(passes(), entree.split('\n').length)} ${t.aucuneRelecture}`
        : (chutes ? t.reprise(passes()) : t.passe(passes(), entree.split('\n').length)),
    };
  } catch (erreur) {
    return {
      verdict: { label: t.refus, detail: erreur.message },
      note: t.refusNote,
    };
  }
}

export default {
  level: 'N2',

  note: {
    fr: 'Les scores du modèle sont simulés par le double local qui sert aux tests. Ce qui est calculé ici, c’est ce que le code envoie, ce qu’il refuse, ce qu’il réessaie, ce qu’il lit dans la ligne désignée et ce qu’il envoie en relecture.',
    en: 'The model’s scores are simulated by the local double the tests use. What is computed here is what the code sends, what it refuses, what it retries, what it reads out of the line it was pointed at, and what it sends to review.',
  },

  async run(entree, lang, cas = {}) {
    const simulation = cas.simulate ?? {};
    const lignes = (simulation.facture === 'acompte' ? ACOMPTE : FACTURE)[lang];
    return execute(entree, lang, {
      scores: SCORES[simulation.scores ?? 'juste'](lignes),
      chutes: simulation.chutes ?? 0,
      threshold: simulation.threshold,
    });
  },

  cases: [
    {
      label: { fr: 'Une facture de fournitures', en: 'An office-supplies invoice' },
      input: { fr: FACTURE.fr.join('\n'), en: FACTURE.en.join('\n') },
    },
    {
      label: { fr: 'Le seuil de relecture relevé à 0,99', en: 'The review threshold raised to 0.99' },
      input: { fr: FACTURE.fr.join('\n'), en: FACTURE.en.join('\n') },
      simulate: { threshold: 0.99 },
    },
    {
      label: { fr: 'Le modèle désigne l’en-tête comme montant', en: 'The model points at the letterhead for the amount' },
      input: { fr: FACTURE.fr.join('\n'), en: FACTURE.en.join('\n') },
      simulate: { scores: 'enTete' },
    },
    {
      label: { fr: 'Une passe tombe', en: 'A pass drops' },
      input: { fr: FACTURE.fr.join('\n'), en: FACTURE.en.join('\n') },
      simulate: { chutes: 1 },
    },
    {
      label: { fr: 'Un document de 121 lignes', en: 'A 121-line document' },
      input: 'ligne\n'.repeat(MAX_LINES + 1),
      shown: {
        fr: 'un relevé de 121 lignes, une de trop pour une passe',
        en: 'a statement of 121 lines, one too many for a single pass',
      },
    },
    {
      label: { fr: 'Une facture portant un acompte', en: 'An invoice carrying a deposit' },
      input: { fr: ACOMPTE.fr.join('\n'), en: ACOMPTE.en.join('\n') },
      simulate: { facture: 'acompte', scores: 'acompte' },
      fails: true,
      why: {
        fr: 'Le montant dû est de 360,00 : le code rend 120,00, l’acompte déjà versé, avec un score de 0,96 et aucun drapeau de relecture. Le seuil attrape l’hésitation, et le modèle n’a pas hésité : cette mise en page ne figurait pas dans son affinage, et il s’est trompé avec assurance. Relever le seuil n’y change rien, l’erreur score au-dessus de la bonne réponse. Ce qui la rattraperait, c’est un affinage sur des factures à acompte — donc un corpus annoté à soi, le coût qu’on suppose absent de ce barreau.',
        en: 'The amount due is 360.00: the code returns 120.00, the deposit already paid, with a score of 0.96 and no review flag at all. The threshold catches hesitation, and the model did not hesitate: this layout was not in its fine-tuning, and it got it wrong with confidence. Raising the threshold changes nothing, because the mistake outscores the right answer. What would catch it is fine-tuning on invoices that carry deposits — an annotated corpus of your own, the cost this rung is assumed not to have.',
      },
    },
  ],
};
