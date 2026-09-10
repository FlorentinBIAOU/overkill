/**
 * Énumérations contractuelles du modèle de contenu.
 * Référence : CDC sections 4.1, 4.2, 4.4, 4.5, 5.1.
 * Aucune de ces listes ne se modifie sans modification du cahier des charges.
 */

/** Les dix familles, rangées par verbe (CDC 4.4). */
export const FAMILIES = [
  'detect-filter',
  'extract',
  'classify-route',
  'search',
  'recommend',
  'predict',
  'generate',
  'transform',
  'recognize-transcribe',
  'decide-validate',
] as const;
export type Family = (typeof FAMILIES)[number];

/** Les quatre barreaux, ordre fixe (CDC 4.1). */
export const LEVELS = ['N0', 'N1', 'N2', 'N3'] as const;
export type Level = (typeof LEVELS)[number];

/**
 * Vocabulaire de coût impose (CDC 4.5). Ordres de grandeur, jamais de prix
 * absolus. Les cinq valeurs sont reprises littéralement du cahier des charges,
 * accents compris : ce sont des valeurs contractuelles, pas des libelles.
 */
export const COSTS = ['nul', 'négligeable', 'faible', 'modéré', 'élevé'] as const;
export type Cost = (typeof COSTS)[number];

/**
 * Libelles d'affichage du coût, et leur définition chiffrée telle que donnée
 * en section 4.5. La définition est affichée au survol et sur la page
 * méthodologie, pour qu'un ordre de grandeur ne reste jamais opaque.
 */
export const COST_LABELS: Record<Cost, { fr: string; en: string }> = {
  nul: { fr: 'nul', en: 'none' },
  négligeable: { fr: 'négligeable', en: 'negligible' },
  faible: { fr: 'faible', en: 'low' },
  modéré: { fr: 'modéré', en: 'moderate' },
  élevé: { fr: 'élevé', en: 'high' },
};

export const COST_DEFINITIONS: Record<Cost, { fr: string; en: string }> = {
  nul: {
    fr: 'Aucun coût marginal.',
    en: 'No marginal cost.',
  },
  négligeable: {
    fr: "Moins d'un euro par million d'opérations.",
    en: 'Less than one euro per million opérations.',
  },
  faible: {
    fr: "De l'ordre de l'euro par million d'opérations.",
    en: 'On the order of one euro per million opérations.',
  },
  modéré: {
    fr: "De l'ordre de la dizaine d'euros par million d'opérations.",
    en: 'On the order of ten euros per million opérations.',
  },
  élevé: {
    fr: "De l'ordre de la centaine d'euros par million d'opérations, ou plus.",
    en: 'On the order of a hundred euros per million opérations, or more.',
  },
};

/** Classes de latence fixes (CDC 4.5). */
export const LATENCIES = ['<1 ms', '~10 ms', '~100 ms', '~1 s', '>1 s'] as const;
export type Latency = (typeof LATENCIES)[number];

/** Sortie de données (CDC 4.2, champ 1 du bloc risques). */
export const DATA_EGRESS = ['none', 'own-infra', 'third-party'] as const;

/** Testabilité (CDC 4.2, champ 3). */
export const TESTABILITY = ['unit', 'statistical', 'hard'] as const;

/** Dépendance fournisseur (CDC 4.2, champ 4). */
export const VENDOR_LOCK = ['none', 'library', 'provider'] as const;

/** Empreinte, ordre de grandeur relatif (CDC 4.2, champ 5). */
export const FOOTPRINT = ['negligible', 'low', 'moderate', 'high'] as const;

/** Statut de publication (CDC 5.1). */
export const STATUSES = ['published', 'draft'] as const;

/**
 * Niveau de preuve d'exécution d'un extrait de code.
 *
 * Extension additive au schéma de la section 5.1, décidée en autonomie
 * (décision D3 du plan). Le CDC exige qu'aucune fiche ne soit publiée sans que
 * son code ait été exécuté. Un extrait qui appelle une API de LLM ou qui charge
 * un modèle de plusieurs centaines de mégaoctets ne peut pas être exécuté a
 * l'identique en intégration continue. Plutôt que de laisser croire que tous
 * les extraits ont le même niveau de preuve, le niveau réel est déclare, et
 * affiché sur la fiche.
 *
 *   executed  l'extrait s'exécuté tel quel, avec ses vraies dépendances
 *   stubbed   l'extrait s'exécuté, un service ou un modèle externe étant
 *             remplacé par un double local dans le test
 */
export const VERIFICATION = ['executed', 'stubbed'] as const;
export type Vérification = (typeof VERIFICATION)[number];

/** Noms des barreaux, dans les deux langues (CDC 4.1). */
export const LEVEL_NAMES: Record<Level, { fr: string; en: string }> = {
  N0: { fr: 'Règle et algorithme classique', en: 'Rule and classic algorithm' },
  N1: { fr: 'Modèle classique léger', en: 'Lightweight classic model' },
  N2: {
    fr: 'Petit modèle spécialisé auto-hébergé',
    en: 'Small self-hosted specialised model',
  },
  N3: { fr: 'API de LLM généraliste', en: 'General-purpose LLM API' },
};
