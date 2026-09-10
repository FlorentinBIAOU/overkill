/**
 * Fiches factices pour éprouver les gabarits (lot 04).
 *
 * Elles couvrent volontairement les cas ingrats : un barreau absent, un verdict
 * N3, un titre très long, une fiche sans lien externe, une fiche en brouillon.
 * Les gabarits doivent tenir sur ces cas-là, pas seulement sur le cas moyen.
 */
import { DEMO_RUNGS } from './rungs';

const base = {
  status: 'published' as const,
  updated: new Date('2026-09-01'),
  contributors: ['florentin-biaou'],
  rungs: DEMO_RUNGS,
  further_reading: [
    { label: 'Documentation du module de motifs de Python', url: 'https://docs.python.org/3/library/re.html' },
  ],
  sources: [],
};

export const DEMO_ENTRIES = [
  {
    ...base,
    id: 'mask-personal-data-in-chat',
    family: 'detect-filter',
    verdict: 'N0',
    title: {
      fr: 'Masquer les coordonnées dans un message',
      en: 'Mask personal data in a chat thread',
    },
    need: {
      fr: "Empêcher qu'un numéro de téléphone ou une adresse électronique soit visible dans un message envoyé.",
      en: 'Prevent phone numbers and emails from appearing in a sent message.',
    },
    scenario: {
      fr: "On voit régulièrement un appel de modèle sur chaque message entrant pour repérer les coordonnées. Le besoin est pourtant déterministe, et le motif d'une adresse électronique n'a pas changé depuis vingt ans.",
      en: 'A common pattern is calling a model on every inbound message to spot contact details. The need is deterministic, though, and the shape of an email address has not changed in twenty years.',
    },
    verdict_rationale: {
      fr: "N0 suffit dans l'immense majorité des intégrations. Le besoin est déterministe, le coût marginal est nul, et rien ne sort de votre infrastructure. Montez à N1 seulement quand vos utilisateurs contournent activement le filtre.",
      en: 'N0 is enough for the vast majority of integrations. The need is deterministic, the marginal cost is nil, and nothing leaves your infrastructure. Move up to N1 only once your users are actively working around the filter.',
    },
  },
  {
    ...base,
    id: 'write-product-descriptions',
    family: 'generate',
    verdict: 'N3',
    further_reading: [],
    title: {
      fr: 'Rédiger des descriptions produit',
      en: 'Write product descriptions',
    },
    need: {
      fr: 'Produire une description lisible pour chaque référence d’un catalogue.',
      en: 'Produce a readable description for every item in a catalogue.',
    },
    scenario: {
      fr: "Un catalogue de plusieurs milliers de références, dont personne n'a le temps d'écrire les textes. Le gabarit à trous fonctionne, mais mille descriptions issues du même gabarit se lisent comme mille descriptions issues du même gabarit.",
      en: 'A catalogue of several thousand items that nobody has time to write copy for. A slot-filling template works, but a thousand descriptions from one template read like a thousand descriptions from one template.',
    },
    verdict_rationale: {
      fr: "C'est l'un des cas où le barreau le plus lourd est le bon. Produire de la prose variée et acceptable est exactement ce qu'un modèle généraliste fait mieux que tout le reste. Le coût est réel, la sortie de données aussi, et la relecture humaine reste nécessaire.",
      en: 'This is one of the cases where the heaviest rung is the right one. Producing varied, acceptable prose is exactly what a general-purpose model does better than anything else. The cost is real, so is the data leaving, and human review is still required.',
    },
  },
  {
    ...base,
    id: 'search-in-your-own-documents',
    family: 'search',
    status: 'draft' as const,
    verdict: 'N1',
    title: {
      fr: 'Chercher dans ses propres documents, y compris quand le fonds est très grand et mal structuré',
      en: 'Search your own documents, including when the corpus is large and poorly structured',
    },
    need: {
      fr: 'Retrouver un document dans un fonds interne, sans envoyer ce fonds à un tiers.',
      en: 'Find a document in an internal corpus, without sending that corpus to a third party.',
    },
    scenario: {
      fr: "Le réflexe est d'indexer tout le fonds dans une base vectorielle et d'y brancher un modèle. La base de données que vous avez déjà sait pourtant faire de la recherche plein texte, avec un classement éprouvé, et sans service supplémentaire à exploiter.",
      en: 'The reflex is to index the whole corpus in a vector store and wire a model to it. The database you already run knows how to do full-text search, with a proven ranking, and without a further service to operate.',
    },
    verdict_rationale: {
      fr: "Cette fiche est un brouillon : son contenu n'a pas encore été relu, et elle sert ici à vérifier que le gabarit signale un brouillon de façon visible.",
      en: 'This entry is a draft: its content has not been reviewed yet, and it exists here to check that the template flags a draft visibly.',
    },
  },
] as const;

export const DEMO_FAMILY = {
  id: 'detect-filter',
  order: 1,
  title: { fr: 'Détecter et filtrer', en: 'Detect and filter' },
  description: {
    fr: "Repérer ce qui doit être signalé, masqué ou écarté, dans un flux qui arrive sans qu'on l'ait demandé. C'est la famille où les règles simples tiennent le plus longtemps, parce que ce qu'on cherche a souvent une forme.",
    en: 'Spotting what must be flagged, masked or set aside in a stream that arrives unasked. This is the family where simple rules hold up longest, because what you are looking for usually has a shape.',
  },
  question: {
    fr: 'Comment repérer ce qui ne doit pas passer ?',
    en: 'How do I catch what should not get through?',
  },
  illustration: 'family-detect-filter',
};

export const DEMO_FAMILY_TITLES: Record<string, string> = {
  'detect-filter': 'Détecter et filtrer',
  extract: 'Extraire',
  'classify-route': 'Classer et router',
  search: 'Chercher',
  recommend: 'Recommander',
  predict: 'Prédire',
  generate: 'Générer',
  transform: 'Transformer',
  'recognize-transcribe': 'Reconnaître et transcrire',
  'decide-validate': 'Décider et valider',
};

export const ISSUE_URL =
  'https://github.com/florentin-biaou/overkill/issues/new?template=propose-entry.yml';
