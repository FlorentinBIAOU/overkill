/**
 * Essai interactif — rapprocher deux raisons sociales.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel. Il compare deux noms
 * à la fois : la première ligne de la saisie est le nom de référence, chacune
 * des suivantes est un candidat, et l'extrait est appelé une fois par paire.
 *
 * Le tableau est trié par score décroissant, parce que c'est l'ordre qui décide
 * en pratique : ce qu'on regarde d'un rapprochement, ce n'est pas un score
 * absolu, c'est qui arrive devant qui.
 *
 * La colonne normalisée est là parce que la moitié du résultat s'y joue : la
 * forme juridique est retirée avant toute comparaison, et voir « boulangerie
 * martin » sous « Boulangerie Martin SARL » vaut mieux que de l'expliquer.
 */
import { normalise, similarity } from '../../snippets/fuzzy-match-company-names/n0.js';

/* Le seuil qu'une vraie campagne de déduplication emploierait. Il n'est pas
   dans l'extrait : c'est une décision d'exploitation, pas d'algorithme. */
const SEUIL = 0.85;

const T = {
  fr: {
    nom: 'Nom comparé',
    normalise: 'Après normalisation',
    score: (seuil) => `Score (seuil ${seuil})`,
    decision: 'Décision',
    revoir: 'à revoir',
    ecarte: 'écarté',
    reference: (nom, normalise) => `Comparé à « ${nom} », normalisé en « ${normalise} ».`,
    seul: 'Un seul nom saisi',
    seulDetail: 'La première ligne est le nom de référence ; ajoutez une ligne par candidat.',
  },
  en: {
    nom: 'Name compared',
    normalise: 'After normalisation',
    score: (seuil) => `Score (cut at ${seuil})`,
    decision: 'Decision',
    revoir: 'to review',
    ecarte: 'dropped',
    reference: (nom, normalise) => `Compared with “${nom}”, normalised to “${normalise}”.`,
    seul: 'Only one name given',
    seulDetail: 'The first line is the reference name; add one line per candidate.',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Première ligne : le nom de référence. Lignes suivantes : les candidats. Un score au-dessus du seuil est une paire à revoir, jamais une décision prise.',
    en: 'First line: the reference name. Following lines: the candidates. A score above the cut is a pair to review, never a decision already made.',
  },

  run(texte, lang) {
    const t = T[lang];
    const lignes = texte.split('\n').map((ligne) => ligne.trim()).filter(Boolean);
    const [reference, ...candidats] = lignes;
    if (!reference || candidats.length === 0) {
      return { verdict: { label: t.seul, detail: t.seulDetail } };
    }

    const nombre = new Intl.NumberFormat(lang, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const rows = candidats
      .map((candidat) => ({ candidat, score: similarity(reference, candidat) }))
      .sort((a, b) => b.score - a.score)
      .map(({ candidat, score }) => [
        candidat,
        normalise(candidat),
        { v: nombre.format(score), caught: score >= SEUIL },
        score >= SEUIL ? t.revoir : t.ecarte,
      ]);

    return {
      rows: {
        columns: [t.nom, t.normalise, t.score(nombre.format(SEUIL)), t.decision],
        rows,
      },
      note: t.reference(reference, normalise(reference)),
    };
  },

  cases: [
    {
      label: {
        fr: 'La même maison sous trois statuts',
        en: 'One business under three legal forms',
      },
      input: 'Boulangerie Martin SARL\nBOULANGERIE MARTIN\nBoulangerie Martin SAS',
    },
    {
      label: {
        fr: 'Accents, esperluette, pluriel : tout reste au-dessus du seuil',
        en: 'Accents, ampersands, plurals: all still above the cut',
      },
      input: 'Établissements Léon & Fils SA\nETABLISSEMENTS LEON ET FILS\nEtablissement Leon et Fils',
    },
    {
      label: {
        fr: 'Deux boulangeries qui n’ont rien à voir, au-dessus du seuil',
        en: 'Two unrelated bakeries, both above the cut',
      },
      input: 'Boulangerie Martin SARL\nBoulangerie Martinet\nBoulangerie Dupont SARL',
    },
    {
      label: {
        fr: 'Un sigle contre la raison sociale qu’il abrège',
        en: 'An acronym against the name it stands for',
      },
      input: 'SNCF\nSociété Nationale des Chemins de fer Français\nSanofi',
      fails: true,
      why: {
        fr: 'La vraie paire passe sous le seuil, et — plus embarrassant — sous le score de Sanofi, qui partage avec SNCF trois lettres sur quatre. L’extrait compare des caractères ; il ne peut pas savoir que le sigle est fait des initiales de la ligne au-dessus. Aucun seuil ne retient la première en écartant la seconde.',
        en: 'The true pair falls below the cut and — worse — below Sanofi, which shares three of the four letters of SNCF. The snippet compares characters; it cannot know the acronym is built from the initials of the line above. No threshold keeps the first pair and rejects the second.',
      },
    },
  ],
};
