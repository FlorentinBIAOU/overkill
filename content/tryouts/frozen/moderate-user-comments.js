/**
 * Essai figé — modérer les commentaires avec un classifieur auto-hébergé.
 *
 * Cet extrait ne peut pas tourner dans un navigateur : il charge un modèle
 * dont les poids se téléchargent. Les six cas ci-dessous sont donc exécutés
 * à la construction du site, avec le double local qui sert déjà aux tests — le
 * même que `n2.test.js`.
 *
 * Ce qui est réellement calculé ici, et que rien n'écrit à la main : ce que le
 * code fait des notes qu'il reçoit. Le lot part en un appel, la note la plus
 * forte devient la décision, les deux seuils la déplacent, et une réponse
 * inexploitable part chez un humain au lieu d'être publiée. Les notes, elles,
 * sont celles que le cas déclare : c'est le partage que la fiche annonce avec
 * sa mention « testé, service simulé ».
 *
 * Le dernier cas est le point de rupture du niveau : le code est juste, et le
 * commentaire passe quand même, parce que le préjudice n'a pas d'étiquette
 * dans la liste du modèle.
 */
import { FakeClassifier } from '../../snippets/_harness/fake-model.mjs';
import { DEFAULT_THRESHOLDS, moderate } from '../../snippets/moderate-user-comments/n2.js';

const T = {
  fr: {
    bloque: 'Bloqué, jamais publié',
    relire: 'Mis de côté pour un humain',
    publie: 'Publié',
    detail: (etiquette, note) =>
      `Note la plus forte : « ${etiquette} » à ${nombre(note, 'fr')}.`,
    inexploitable:
      'Le modèle n’a renvoyé aucune note utilisable. Le code ne publie pas pour autant : il appelle un humain.',
    seuils: (bloc, relire) =>
      `Seuils de cette exécution : blocage à ${nombre(bloc, 'fr')}, relecture à ${nombre(relire, 'fr')}. Un appel pour le lot.`,
  },
  en: {
    bloque: 'Blocked, never published',
    relire: 'Set aside for a human',
    publie: 'Published',
    detail: (etiquette, note) => `Strongest score: “${etiquette}” at ${nombre(note, 'en')}.`,
    inexploitable:
      'The model returned no usable score. The code does not publish anyway: it calls a human.',
    seuils: (bloc, relire) =>
      `Thresholds for this run: block at ${nombre(bloc, 'en')}, review at ${nombre(relire, 'en')}. One call for the batch.`,
  },
};

function nombre(valeur, lang) {
  const texte = valeur.toFixed(2);
  return lang === 'fr' ? texte.replace('.', ',') : texte;
}

const VERDICTS = { block: 'bloque', review: 'relire', allow: 'publie' };

export default {
  level: 'N2',

  note: {
    fr: 'Les notes du modèle sont simulées par le double local qui sert aux tests. Ce qui est calculé ici, c’est ce que le code en fait : la décision qu’il en tire, les seuils qu’il applique, et ce qu’il fait quand la réponse est inutilisable.',
    en: 'The model’s scores are simulated by the local double the tests use. What is computed here is what the code does with them: the decision it draws, the thresholds it applies, and what it does when the answer is unusable.',
  },

  /* Les notes et les seuils sont portés par le cas : plusieurs cas partagent le
     même commentaire et ne se distinguent que par ce qu'on simule autour. */
  async run(commentaire, lang, cas = {}) {
    const t = T[lang];
    const simulation = cas.simulate ?? {};
    const seuils = simulation.thresholds ?? DEFAULT_THRESHOLDS;
    const classifieur = new FakeClassifier({ [commentaire]: simulation.scores ?? {} });
    const [decision] = await moderate([commentaire], classifieur, seuils);
    return {
      verdict: {
        label: t[VERDICTS[decision.action]],
        detail: decision.label
          ? t.detail(decision.label, decision.score)
          : t.inexploitable,
      },
      note: t.seuils(seuils.block, seuils.review),
    };
  },

  cases: [
    {
      label: { fr: 'Une insulte adressée à quelqu’un', en: 'An insult aimed at someone' },
      input: {
        fr: 'dégage de ce forum espèce de blorptard',
        en: 'get off this forum you blorptard',
      },
      simulate: { scores: { toxicity: 0.96, insult: 0.91, threat: 0.04 } },
    },
    {
      label: { fr: 'Un commentaire de lecteur ordinaire', en: 'An ordinary reader comment' },
      input: {
        fr: 'le schéma est bien plus clair que le texte, merci',
        en: 'the diagram is much clearer than the text, thank you',
      },
      simulate: { scores: { toxicity: 0.02, insult: 0.01, threat: 0 } },
    },
    {
      label: { fr: 'Un avis cinglant, mais pas une insulte', en: 'A scathing opinion, but not an insult' },
      input: {
        fr: 'franchement, c’est une idée spectaculairement mauvaise',
        en: 'that was a spectacularly bad take, honestly',
      },
      simulate: { scores: { toxicity: 0.71, insult: 0.35, threat: 0.01 } },
    },
    {
      label: { fr: 'Le même avis, seuils resserrés', en: 'The same opinion, thresholds tightened' },
      input: {
        fr: 'franchement, c’est une idée spectaculairement mauvaise',
        en: 'that was a spectacularly bad take, honestly',
      },
      simulate: {
        scores: { toxicity: 0.71, insult: 0.35, threat: 0.01 },
        thresholds: { block: 0.7, review: 0.3 },
      },
      shown: {
        fr: 'le même commentaire, avec un blocage abaissé à 0,70',
        en: 'the same comment, with blocking lowered to 0.70',
      },
    },
    {
      label: { fr: 'Le modèle ne renvoie rien d’utilisable', en: 'The model returns nothing usable' },
      input: {
        fr: 'dégage de ce forum espèce de blorptard',
        en: 'get off this forum you blorptard',
      },
      simulate: { scores: {} },
      shown: {
        fr: 'la même insulte, mais le modèle répond un tableau de notes vide',
        en: 'the same insult, but the model answers an empty set of scores',
      },
    },
    {
      label: { fr: 'Une adresse personnelle livrée en passant', en: 'A home address handed out in passing' },
      input: {
        fr: 'au fait, il habite au coin de la rue des Lilas, allez donc lui dire bonjour',
        en: 'he lives at the corner of rue des Lilas by the way, go and say hello',
      },
      simulate: { scores: { toxicity: 0.08, insult: 0.03, threat: 0.06 } },
      fails: true,
      why: {
        fr: 'Ce commentaire désigne le domicile de quelqu’un et invite à s’y rendre. Aucune des sept nuisances que note le modèle ne nomme ce préjudice. Les notes basses de ce cas sont simulées, et le code publie ce qui est noté bas : rien n’est faux dans le code, le préjudice n’a pas d’étiquette. Vous héritez de la taxonomie de quelqu’un d’autre, et l’élargir demande un corpus étiqueté à vous.',
        en: 'This comment points at someone’s home and invites people to turn up. None of the seven harms the model scores names it. The low scores of this case are simulated, and the code publishes what scores low: nothing in the code is wrong, the harm has no label. You inherit somebody else’s taxonomy, and widening it takes a labelled corpus of your own.',
      },
    },
  ],
};
