/**
 * Barreaux factices pour la page de contrôle des composants et pour les tests
 * de gabarit.
 *
 * Ils couvrent volontairement les cas ingrats : un barreau absent, un barreau
 * qui part chez un tiers, un non déterministe, une liste réglementaire à
 * plusieurs entrées.
 *
 * Les chemins de code pointent sur des extraits réels du dépôt : un composant
 * qui affiche du code doit être éprouvé sur du vrai code (CDC 4.6).
 */
export const DEMO_RUNGS = [
  {
    level: 'N0',
    available: true,
    name: {
      fr: 'Normalisation puis expressions régulières',
      en: 'Normalisation then regular expressions',
    },
    cost: 'nul',
    latency: '<1 ms',
    risks: {
      data_egress: 'none',
      deterministic: true,
      testability: 'unit',
      vendor_lock: 'none',
      footprint: 'negligible',
      regulatory: {
        fr: ['Aucun périmètre spécifique ajouté'],
        en: ['No specific scope added'],
      },
    },
    code: {
      python: 'snippets/mask-personal-data-in-chat/n0.py',
      javascript: 'snippets/mask-personal-data-in-chat/n0.js',
      verification: 'executed',
    },
    breaking_point: {
      fr: "L'obfuscation volontaire : chiffres écrits en lettres, caractères sosies, emojis intercalés.",
      en: 'Deliberate obfuscation: spelled-out digits, lookalike characters, interspersed emoji.',
    },
    escalate_when: {
      fr: 'Vos utilisateurs contournent activement le filtre.',
      en: 'Your users are actively working around the filter.',
    },
  },
  {
    level: 'N1',
    available: true,
    name: {
      fr: 'Régression logistique sur des traits de jetons',
      en: 'Logistic regression on token features',
    },
    cost: 'négligeable',
    latency: '~10 ms',
    risks: {
      data_egress: 'own-infra',
      deterministic: true,
      testability: 'statistical',
      vendor_lock: 'library',
      footprint: 'low',
      regulatory: {
        fr: [
          'Traitement de données personnelles sur votre infrastructure',
          "Obligation de tenir un registre des traitements si vous en avez l'obligation par ailleurs",
        ],
        en: [
          'Processing of personal data on your own infrastructure',
          'A record of processing activities, where you are otherwise required to keep one',
        ],
      },
    },
    code: {
      python: 'snippets/mask-personal-data-in-chat/n1.py',
      javascript: 'snippets/mask-personal-data-in-chat/n1.js',
      verification: 'executed',
    },
    breaking_point: {
      fr: "Le modèle ne connaît que les contournements qu'on lui a montrés.",
      en: 'The model only knows the evasions it was shown.',
    },
    escalate_when: {
      fr: 'Les contournements changent plus vite que vous ne pouvez étiqueter.',
      en: 'Evasions change faster than you can label them.',
    },
  },
  {
    level: 'N2',
    available: false,
    unavailable_reason: {
      fr: "Sans intérêt ici : un modèle de reconnaissance d'entités auto-hébergé coûte un service permanent pour un gain nul sur des motifs aussi structurés que N1 traite déjà.",
      en: 'Not useful here: a self-hosted entity recogniser costs a permanent service for no gain on patterns as structured as the ones N1 already handles.',
    },
  },
  {
    level: 'N3',
    available: true,
    name: {
      fr: 'Extraction structurée par appel à un modèle généraliste',
      en: 'Structured extraction through a general-purpose model',
    },
    cost: 'élevé',
    latency: '~1 s',
    risks: {
      data_egress: 'third-party',
      deterministic: false,
      testability: 'hard',
      vendor_lock: 'provider',
      footprint: 'high',
      regulatory: {
        fr: [
          "Transfert de données personnelles à un sous-traitant, avec l'encadrement contractuel que cela suppose",
          'Localisation du traitement à vérifier auprès du fournisseur',
        ],
        en: [
          'Transfer of personal data to a processor, with the contractual framing that implies',
          'Processing location to be confirmed with the provider',
        ],
      },
    },
    code: {
      python: 'snippets/mask-personal-data-in-chat/n3.py',
      javascript: 'snippets/mask-personal-data-in-chat/n3.js',
      verification: 'stubbed',
    },
    breaking_point: {
      fr: "Le modèle peut répondre n'importe quoi, y compris de la prose là où du JSON était demandé.",
      en: 'The model can answer anything, including prose where JSON was asked for.',
    },
    escalate_when: {
      fr: "Il n'y a pas de barreau au-dessus.",
      en: 'There is no rung above this one.',
    },
  },
] as const;
