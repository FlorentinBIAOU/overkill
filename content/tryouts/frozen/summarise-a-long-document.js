/**
 * Essai figé — résumer un document long par appel à un modèle généraliste.
 *
 * Cet extrait ne peut pas tourner dans un navigateur : il appelle un
 * fournisseur externe. Les six cas ci-dessous sont donc exécutés à la
 * construction du site, avec le double local qui sert déjà aux tests — le même
 * que `n3.test.js`.
 *
 * Ce qui est réellement calculé ici, et que rien n'écrit à la main : ce que le
 * code envoie, ce qu'il refuse, ce qu'il réessaie, ce qu'il accepte. La
 * réponse du modèle, elle, est simulée, et chaque cas le dit. C'est
 * exactement le partage que la fiche déclare avec sa mention « testé, service
 * simulé » : la plomberie est prouvée, la qualité de la réponse ne l'est pas.
 *
 * Le dernier cas est le point de rupture du niveau, et il est le plus utile de
 * la page : le code accepte sans broncher un résumé que le document ne dit
 * pas.
 */
import { FakeLLM } from '../../snippets/_harness/fake-llm.mjs';
import { summarise } from '../../snippets/summarise-a-long-document/n3.js';

/* Le plafond est celui de l'appelant : celui-ci, volontairement bas, tient sur
   la page. Le plafond par défaut de l'extrait, lui, est la fenêtre du modèle. */
const PLAFOND = 2000;

const RAPPORT = {
  fr: 'L’équipe support a migré le système de tickets vers une nouvelle plateforme en mars. Chaque agent a été formé pendant les deux semaines précédant la bascule. L’ancienne plateforme est restée disponible en lecture seule pendant un mois.',
  en: 'The support team migrated the ticketing system to a new platform in March. Every agent was trained during the two weeks before the switch. The old platform stayed available in read-only mode for a month afterwards.',
};

const BONNE_REPONSE = {
  fr: {
    summary: 'Le système de tickets a migré vers une nouvelle plateforme en mars.',
    key_points: ['agents formés avant la bascule', 'ancienne plateforme en lecture seule'],
  },
  en: {
    summary: 'The ticketing system moved to a new platform in March.',
    key_points: ['agents trained beforehand', 'old platform kept read-only'],
  },
};

const FAUSSE_REPONSE = {
  fr: {
    summary: 'La migration a fait perdre trois jours de tickets.',
    key_points: ['incident de migration'],
  },
  en: {
    summary: 'The migration lost three days of tickets.',
    key_points: ['migration incident'],
  },
};

const T = {
  fr: {
    envoye: (n, c) => `${n} appel envoyé, ${c} caractères de document partis chez le fournisseur.`,
    aucunAppel: 'Aucun appel envoyé, donc rien dépensé.',
    refuse: 'Refusé avant le premier appel',
    refuseNote: 'Rien n’est parti, rien n’est dû.',
    retries: (n) => `${n} appels envoyés : les deux premiers ont échoué, le troisième a répondu.`,
    perdus: (n) => `${n} appels envoyés et facturés, aucune réponse exploitable.`,
    rejet: 'Réponse rejetée',
    rejetDetail: 'Le modèle a répondu en prose là où le code demandait du JSON. Le code refuse plutôt que de rendre un résumé vide.',
  },
  en: {
    envoye: (n, c) => `${n} call sent, ${c} characters of document left for the provider.`,
    aucunAppel: 'No call sent, so nothing spent.',
    refuse: 'Refused before the first call',
    refuseNote: 'Nothing left, nothing owed.',
    retries: (n) => `${n} calls sent: the first two failed, the third answered.`,
    perdus: (n) => `${n} calls sent and billed, no usable answer.`,
    rejet: 'Answer rejected',
    rejetDetail: 'The model answered in prose where the code asked for JSON. The code refuses rather than returning an empty summary.',
  },
};

const PROSE = {
  fr: 'Bien sûr ! Voici un résumé de votre document :',
  en: 'Sure! Here is a summary of your document:',
};

/** Exécute l'extrait sur un cas décrit, et rend ce qui s'est réellement passé. */
async function execute(entree, lang, { reponse, failTimes = 0, prose = false }) {
  const t = T[lang];
  const client = new FakeLLM({
    response: prose ? reponse : JSON.stringify(reponse),
    failTimes,
  });
  try {
    const { summary, keyPoints } = await summarise(entree, { client, maxCharacters: PLAFOND });
    if (client.callCount === 0) {
      return { verdict: { label: t.aucunAppel } };
    }
    return {
      output: [summary, ...keyPoints.map((p) => `— ${p}`)].join('\n'),
      note: failTimes
        ? t.retries(client.callCount)
        : t.envoye(client.callCount, entree.length),
    };
  } catch (erreur) {
    const refus = erreur instanceof RangeError;
    return {
      verdict: {
        label: refus ? t.refuse : t.rejet,
        detail: refus ? erreur.message : t.rejetDetail,
      },
      note: refus ? t.refuseNote : t.perdus(client.callCount),
    };
  }
}

export default {
  level: 'N3',

  note: {
    fr: 'La réponse du modèle est simulée par le double local qui sert aux tests. Ce qui est calculé ici, c’est ce que le code envoie, ce qu’il refuse, ce qu’il réessaie et ce qu’il accepte.',
    en: 'The model’s answer is simulated by the local double the tests use. What is computed here is what the code sends, what it refuses, what it retries and what it accepts.',
  },

  /* Plusieurs cas partagent le même document et ne diffèrent que par ce que
     le fournisseur répond : la simulation est donc portée par le cas. */
  async run(entree, lang, cas = {}) {
    const simulation = cas.simulate ?? {};
    return execute(entree, lang, {
      failTimes: simulation.failTimes ?? 0,
      reponse:
        simulation.reponse === 'prose'
          ? PROSE[lang]
          : simulation.reponse === 'fausse'
            ? FAUSSE_REPONSE[lang]
            : BONNE_REPONSE[lang],
      prose: simulation.reponse === 'prose',
    });
  },

  cases: [
    {
      label: { fr: 'Un rapport de trois phrases', en: 'A three-sentence report' },
      input: RAPPORT,
    },
    {
      label: { fr: 'Un document vide', en: 'An empty document' },
      input: '   \n  ',
      shown: { fr: '(rien, ou des espaces)', en: '(nothing, or whitespace)' },
    },
    {
      label: {
        fr: 'Un document au-dessus du plafond fixé',
        en: 'A document over the ceiling that was set',
      },
      input: 'x'.repeat(PLAFOND + 1),
      shown: {
        fr: 'un document de 2 001 caractères, pour un plafond fixé à 2 000',
        en: 'a 2,001-character document, for a ceiling set at 2,000',
      },
    },
    {
      label: { fr: 'Le fournisseur échoue deux fois', en: 'The provider fails twice' },
      input: RAPPORT,
      simulate: { failTimes: 2 },
      shown: {
        fr: 'le même rapport, mais les deux premiers appels échouent',
        en: 'the same report, but the first two calls fail',
      },
    },
    {
      label: { fr: 'Le modèle répond en prose', en: 'The model answers in prose' },
      input: RAPPORT,
      simulate: { reponse: 'prose' },
      shown: {
        fr: 'le même rapport ; le modèle répond « Bien sûr ! Voici un résumé… »',
        en: 'the same report; the model answers “Sure! Here is a summary…”',
      },
    },
    {
      label: {
        fr: 'Le modèle résume ce que le document ne dit pas',
        en: 'The model summarises what the document never said',
      },
      input: RAPPORT,
      simulate: { reponse: 'fausse' },
      shown: {
        fr: 'le même rapport, qui ne parle d’aucun ticket perdu',
        en: 'the same report, which mentions no lost tickets',
      },
      fails: true,
      why: {
        fr: 'Le code rend ce résumé sans broncher : il vérifie la forme de la réponse, jamais sa vérité. Aucun test de cette fiche ne peut attraper une phrase fluide et fausse.',
        en: 'The code returns this summary without flinching: it checks the shape of the answer, never its truth. No test on this entry can catch a fluent, false sentence.',
      },
    },
  ],
};
