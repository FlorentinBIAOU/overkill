/**
 * Essai interactif — proposer des articles proches.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * On tape un titre, et l'extrait le compare au fonds. La table de voisinage est
 * recalculée à chaque frappe et non une fois pour toutes, parce que la
 * pondération TF-IDF dépend du corpus entier : ajouter un article change le
 * poids de chaque mot. Huit articles courts, c'est immédiat ; c'est aussi
 * pourquoi la vraie table se construit hors ligne, à la publication.
 */
import { buildNeighbourTable } from '../../snippets/show-similar-articles/n1.js';

// Le plancher par défaut de l'extrait. En dessous, deux articles ne partagent
// que des mots ordinaires, et ne rien afficher vaut mieux qu'afficher faux.
const PLANCHER = 0.05;

const VOTRE_TITRE = 'votre-titre';

/**
 * Le fonds d'un blog de cuisine qui publie dans deux langues, comme beaucoup.
 * Deux paires disent la même chose de part et d'autre — le levain et le
 * sourdough, le seigle et le rye — et deux annonces de service ne parlent de
 * cuisine ni dans l'une ni dans l'autre.
 */
const FONDS = [
  {
    id: 'Entretenir un levain naturel',
    title: 'Entretenir un levain naturel',
    body: 'Un levain, c’est de la farine, de l’eau et du temps. Nourrissez le levain '
      + 'deux fois par jour avec le même poids de farine et d’eau, jetez la moitié, et '
      + 'la pâte lèvera toute seule. Un levain qui sent l’acétone réclame de la farine.',
  },
  {
    id: 'Cuire un pain de seigle dense',
    title: 'Cuire un pain de seigle dense',
    body: 'La farine de seigle contient peu de gluten, et un pain de seigle ne lèvera '
      + 'jamais comme un pain de froment. Montez la pâte sur un levain bien actif, '
      + 'gardez la pâte humide, et laissez pousser longtemps avant la cuisson. La mie '
      + 'reste dense et le pain se garde une semaine.',
  },
  {
    id: 'Kimchi en bocal',
    title: 'Kimchi en bocal',
    body: 'Salez le chou une nuit entière, rincez-le, puis tassez le chou dans un bocal '
      + 'avec de l’ail, du gingembre et du piment. Laissez le bocal sur le plan de '
      + 'travail et laissez le chou fermenter. Le kimchi est prêt quand la saumure se '
      + 'trouble et devient acide.',
  },
  {
    id: 'Comment nous joindre pendant les travaux',
    title: 'Comment nous joindre pendant les travaux',
    body: 'Le standard reste ouvert pendant toute la durée des travaux. Le courrier est '
      + 'relevé une fois par jour, et les livraisons passent par la porte de derrière.',
  },
  {
    id: 'Keeping a sourdough starter alive',
    title: 'Keeping a sourdough starter alive',
    body: 'A sourdough starter is flour, water and time. Feed the starter twice a day '
      + 'with equal weights of flour and water, discard half, and the dough will rise '
      + 'on wild yeast alone. A starter that smells of acetone wants more flour.',
  },
  {
    id: 'Baking a dense rye loaf',
    title: 'Baking a dense rye loaf',
    body: 'Rye flour holds little gluten, so a rye loaf never rises like a wheat loaf. '
      + 'Build the dough on a lively sourdough starter, keep the dough wet, and let it '
      + 'proof slowly before baking. The crumb stays dense and the loaf keeps for a week.',
  },
  {
    id: 'Pickled cucumbers in brine',
    title: 'Pickled cucumbers in brine',
    body: 'Pack small cucumbers into a jar with dill, garlic and a spoon of salt, then '
      + 'cover them with brine. Leave the jar on the counter for a week and let the '
      + 'cucumbers ferment. The brine turns cloudy, which is the sign that it worked.',
  },
  {
    id: 'The office is moving in June',
    title: 'The office is moving in June',
    body: 'The office moves in June. The lift will be out of service for a day, so bring '
      + 'nothing heavy that day. The archive boxes go into storage until the move is done.',
  },
];

/**
 * Une liste de mots vides par langue, comme l'extrait le demande : elle
 * appartient à l'appelant, parce qu'il n'y en a pas une seule pour tous les
 * fonds. Sans elle, deux titres qui ne partagent que de la grammaire se
 * ressemblent, et le français en partage beaucoup.
 */
const MOTS_VIDES = {
  fr: ('au aux avec ce ces dans de des du elle en et eux il je la le les leur lui ma mais '
    + 'me même mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son '
    + 'sur ta te tes toi ton tu un une vos votre vous est été être ai as avons avez ont sont').split(' '),
  en: ('an and are as at be but by for from in into is it its of on or so that the then '
    + 'this to until when while with you').split(' '),
};

const T = {
  fr: {
    colonnes: ['Article du fonds', 'Proximité', 'Dans le bloc'],
    oui: 'oui',
    non: 'non',
    note: (retenus, total) => {
      const plancher = PLANCHER.toString().replace('.', ',');
      if (retenus === 0) return `Aucun des ${total} articles ne passe le plancher de ${plancher}.`;
      return retenus > 1
        ? `${retenus} articles sur ${total} passent le plancher de ${plancher}.`
        : `Un article sur ${total} passe le plancher de ${plancher}.`;
    },
    vide: 'Rien à comparer',
    videDetail: 'Le titre est vide : il n’en reste aucun mot à peser.',
  },
  en: {
    colonnes: ['Article in the corpus', 'Closeness', 'In the block'],
    oui: 'yes',
    non: 'no',
    note: (retenus, total) => {
      if (retenus === 0) return `None of the ${total} articles clears the floor of ${PLANCHER}.`;
      return retenus > 1
        ? `${retenus} articles out of ${total} clear the floor of ${PLANCHER}.`
        : `One article out of ${total} clears the floor of ${PLANCHER}.`;
    },
    vide: 'Nothing to compare',
    videDetail: 'The title is empty: not one word left to weigh.',
  },
};

/** Deux décimales, et la virgule du français : un score n'est pas du code. */
const nombre = (valeur, lang) =>
  valeur.toFixed(2).replace('.', lang === 'fr' ? ',' : '.');

export default {
  level: 'N1',

  note: {
    fr: 'Le tableau montre tout le classement, plancher compris : les articles au-dessus du plancher sont ceux qui s’afficheraient sous l’article, les autres sont écartés. Un zéro n’est pas un score faible, c’est l’absence de tout mot commun, mots vides mis à part.',
    en: 'The table shows the whole ranking, floor included: the articles above the floor are the ones that would appear under the article, the others are dropped. A zero is not a low score, it is the absence of any shared word, stop words aside.',
  },

  run(titre, lang) {
    const t = T[lang];
    if (titre.trim() === '') return { verdict: { label: t.vide, detail: t.videDetail } };

    /* `minimum: -1` garde toutes les paires : c'est ce qui rend le zéro visible
       au lieu de le filtrer, et le plancher se lit alors dans le tableau. */
    const table = buildNeighbourTable(
      [{ id: VOTRE_TITRE, title: titre, body: '' }, ...FONDS],
      { k: FONDS.length, minimum: -1, stopWords: MOTS_VIDES[lang] },
    );
    const voisins = table[VOTRE_TITRE];
    const retenus = voisins.filter(([, score]) => score > PLANCHER);
    return {
      rows: {
        columns: t.colonnes,
        rows: voisins.map(([id, score]) => [
          id,
          { v: nombre(score, lang), caught: score > PLANCHER },
          score > PLANCHER ? t.oui : t.non,
        ]),
      },
      note: t.note(retenus.length, FONDS.length),
    };
  },

  cases: [
    {
      label: { fr: 'Un titre proche d’un article du fonds', en: 'A title close to an article in the corpus' },
      input: {
        fr: 'Réussir un pain de seigle bien dense',
        en: 'Baking a really dense rye loaf',
      },
    },
    {
      label: { fr: 'Des mots du corps, pas du titre', en: 'Words from the body, not the title' },
      input: {
        fr: 'Saler le chou avant de le faire fermenter',
        en: 'Garlic and dill before letting them ferment',
      },
    },
    {
      label: { fr: 'Un sujet que le fonds ne traite pas', en: 'A subject the corpus never covers' },
      input: {
        fr: 'Choisir un couteau de cuisine japonais',
        en: 'Choosing a Japanese kitchen knife',
      },
    },
    {
      label: { fr: 'Le même sujet, dans l’autre langue', en: 'The same subject, in the other language' },
      input: {
        fr: 'Nourrir un levain deux fois par jour',
        en: 'Feeding a sourdough starter twice a day',
      },
      fails: true,
      why: {
        fr: 'L’article anglais du fonds dit exactement cela — « Feed the starter twice a day » — et sa proximité vaut zéro, pas une valeur basse : zéro. Aucun mot commun, donc rien à compter. Pendant ce temps, l’annonce sur les travaux passe le plancher et s’afficherait sous l’article, parce qu’elle contient « une fois par jour ». TF-IDF compare des chaînes de caractères, pas des sens, et aucun réglage de plancher ne rattrape cela.',
        en: 'The French article in the corpus says exactly this — « Nourrissez le levain deux fois par jour » — and its closeness is zero, not merely low: zero. No shared word, so nothing to count. Meanwhile the office-move announcement clears the floor and would appear under the article, because it mentions a day. TF-IDF compares strings, not meanings, and no setting of the floor rescues that.',
      },
    },
  ],
};
