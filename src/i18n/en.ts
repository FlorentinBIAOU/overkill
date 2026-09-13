/**
 * Chaînes d'interface, anglais. L'anglais est la version canonique du site
 * (CDC 9.3).
 *
 * Les clés doivent correspondre exactement à celles de src/i18n/fr.ts : une clé
 * présente d'un côté et absente de l'autre fait échouer le build.
 */
export default {
  site: {
    name: 'Overkill',
    tagline: 'The right tool for the job',
    skipToContent: 'Skip to content',
  },

  nav: {
    catalogue: 'Catalogue',
    families: 'Families',
    methodology: 'How it works',
    guide: 'Where to start',
    roadmap: 'Roadmap',
    about: 'About',
    contribute: 'Contribute',
    help: 'Contact',
    legal: 'Legal notice',
    privacy: 'Privacy',
    credits: 'Credits',
    main: 'Main navigation',
    footer: 'Footer navigation',
    language: 'Language',
    theme: 'Switch theme',
  },

  rung: {
    N0: 'Rule and classic algorithm',
    N1: 'Lightweight classic model',
    N2: 'Small self-hosted specialised model',
    N3: 'General-purpose LLM API',
    short: {
      N0: 'Rule',
      N1: 'Light model',
      N2: 'Small model',
      N3: 'LLM API',
    },
    /** The answer in plain words, shown before the level code. */
    answer: {
      N0: 'No AI needed',
      N1: 'No generative AI needed',
      N2: 'AI, but a small model on your own machines',
      N3: 'Yes, a general-purpose model earns its place',
    },
    unavailable: 'Not worth it here',
    scaleLabel: 'Documented levels',
  },

  family: {
    missingHeading: 'Is an entry missing here?',
    missingBody: 'The catalogue grows on what people put into it. If you have seen someone reach for a general-purpose model where a rule would have done, say so.',
    missingAction: 'Suggest a need',
    missingHow: 'How to write an entry',
  },

  verdict: {
    badge: 'Recommended',
    label: 'Verdict',
    heading: 'The verdict',
    onRung: 'Recommended for this need',
  },

  table: {
    caption: 'The options, from lightest to heaviest',
    rung: 'Level',
    approach: 'Approach',
    cost: 'Cost',
    latency: 'Latency',
    data: 'Data',
    deterministic: 'Deterministic',
    verdict: 'Verdict',
  },

  risk: {
    heading: 'Risks',
    data_egress: 'Data leaving',
    deterministic: 'Determinism',
    testability: 'Testability',
    vendor_lock: 'Vendor dependency',
    footprint: 'Footprint',
    regulatory: 'Regulatory scope',
  },

  riskValue: {
    data_egress: {
      none: 'Nothing leaves',
      'own-infra': 'Stays on your infrastructure',
      'third-party': 'Goes to a third party',
    },
    deterministic: { true: 'Yes', false: 'No' },
    testability: {
      unit: 'Unit testable',
      statistical: 'Statistically testable',
      hard: 'Hard to test',
    },
    vendor_lock: {
      none: 'None',
      library: 'Library',
      provider: 'External provider',
    },
    footprint: {
      negligible: 'Negligible',
      low: 'Low',
      moderate: 'Moderate',
      high: 'High',
    },
  },

  /* Le bloc risques en langage clair : des phrases qui se comprennent seules.
     Les libellés courts de `riskValue` restent employés par les filtres du
     catalogue, où il faut un libellé et non une phrase. */
  riskPlain: {
    heading: 'What this means for you',
    data_egress: {
      none: 'Your data stays put',
      'own-infra': 'Your data stays on your own machines',
      'third-party': 'Your data goes to a third party',
    },
    deterministic: {
      true: 'Always the same result',
      false: 'The result varies from one call to the next',
    },
    testability: {
      unit: 'Unit-testable, case by case',
      statistical: 'Measured on a sample, not case by case',
      hard: 'Hard to test',
    },
    vendor_lock: {
      none: 'No provider in the loop',
      library: 'Depends on a library',
      provider: 'Depends on an outside provider',
    },
    footprint: {
      negligible: 'Negligible footprint',
      low: 'Low footprint',
      moderate: 'Moderate footprint',
      high: 'High footprint',
    },
    regulatory: 'What this adds to your regulatory scope',
  },

  cost: {
    nul: 'None',
    négligeable: 'Negligible',
    faible: 'Low',
    modéré: 'Moderate',
    élevé: 'High',
  },

  /* La nature d'un lien, déduite de son adresse par src/lib/links.ts. Le
     repli « page web » est vrai de n'importe quelle adresse. */
  linkKind: {
    repo: 'Code repository',
    doc: 'Documentation',
    spec: 'Specification',
    paper: 'Research paper',
    academic: 'University publication',
    law: 'Regulatory text',
    reference: 'Encyclopaedia',
    page: 'Web page',
  },

  entry: {
    fourOptions: 'The four options',
    otherLevels: 'The other options',
    need: 'The need',
    scenario: 'The scenario',
    family: 'Family',
    updated: 'Reviewed on',
    contributors: 'Contributors',
    breakingPoint: 'Breaking point',
    escalateWhen: 'When to move up a level',
    furtherReading: 'Further reading',
    sources: 'Where the figures come from',
    metadata: 'Metadata',
    neighbours: 'Nearby entries',
    contents: 'On this page',
    draft: 'Draft',
    draftNote: 'This entry is a draft. Its content has not been verified yet.',
  },

  /* La zone d'essai. Deux formes : interactive quand l'extrait tourne dans un
     navigateur, figée quand il ne peut pas. */
  tryout: {
    heading: 'Try it',
    leadLive: 'The code above runs in your browser. Change the text and the result follows.',
    leadFrozen: 'This code cannot run in a browser. The outputs below are computed when the site is built, by running the real code.',
    inputLabel: 'Your text',
    caught: 'What the code picked up',
    output: 'What it returns',
    conclusion: 'What it concludes',
    image: 'The image produced',
    detail: 'In detail',
    empty: 'nothing',
    examples: 'Or start from an example',
    given: 'Given',
    noJs: 'Free typing and the other examples need JavaScript. The example shown below was computed when the site was built.',
    failed: 'The try did not complete on this text.',
    failsHere: 'Here it breaks',
    nextLevel: 'See the level above',
  },

  code: {
    python: 'Python',
    javascript: 'JavaScript',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Could not copy',
    tabsLabel: 'Example language',
    source: 'Source',
    /* La preuve d'exécution, posée dans la barre du bloc de code et nulle part
       ailleurs : au plus près de l'extrait concerné, sans bloc explicatif. */
    proof: {
      executed: {
        short: 'Tested as shown',
        full: 'This snippet runs with its real dependencies, and its test runs on every build of the site.',
      },
      stubbed: {
        short: 'Tested, service simulated',
        full: 'This snippet runs on every build of the site, but its test replaces the external service with a local double: the request sent, the response decoded and the error paths are verified, the real provider’s answer is not.',
      },
    },
  },

  costShort: {
    nul: 'free',
    negligeable: 'negligible cost',
    faible: 'low cost',
    modere: 'moderate cost',
    eleve: 'high cost',
  },

  /* Le survol d'une carte : trois faits en langage courant. */
  plainCost: {
    nul: 'Free',
    negligeable: 'Almost free',
    faible: 'Inexpensive',
    modere: 'Costly',
    eleve: 'Expensive',
  },
  plainLatency: {
    '<1 ms': 'Instant',
    '~10 ms': 'Instant',
    '~100 ms': 'Fast',
    '~1 s': 'About a second',
    '>1 s': 'Over a second',
  },
  plainEgress: {
    none: 'Your data never leaves',
    'own-infra': 'Your data stays with you',
    'third-party': 'Your data goes to a third party',
  },

  families: {
    ctaHeading: 'Not finding it?',
    ctaBody: 'The catalogue is sorted into ten families, one per verb. If you do not know what to type, start from what you want to do.',
    browse: 'Browse by family',
    title: 'Ten families, sorted by verb',
    lead: 'Every task in the catalogue belongs to a family. Pick the one that describes what you want to do.',
  },

  catalogue: {
    title: 'Catalogue',
    search: 'Search the catalogue',
    searchPlaceholder: 'A need, a word, a family',
    filters: 'Filters',
    filterFamily: 'Family',
    filterVerdict: 'Verdict',
    filterEgress: 'Data leaving',
    filterDeterministic: 'Determinism',
    apply: 'Filter',
    reset: 'Clear all',
    anyFamily: 'All families',
    anyVerdict: 'All verdicts',
    anyEgress: 'Any data flow',
    anyDeterministic: 'Either',
    results: 'entries',
    resultsOne: 'entry',
    empty: 'No entry matches',
    emptyHelp: 'This need is missing from the catalogue. Propose it, that is how it grows.',
    emptyAction: 'Propose this entry',
    noJs: 'Search needs JavaScript. Filters do not: submit the form.',
  },

  help: {
    heading: 'A case the catalogue does not cover?',
    body: 'Tell me what the task does and what makes you doubt it. A real case often makes a good entry.',
    action: 'Send a message',
    subjectPrefix: 'Overkill',
  },

  legal: {
    notice:
      'General information, kept up to date as best we can. It is not legal advice. Have a professional review your situation.',
  },

  footer: {
    weight: 'Weight of this page',
    weightNote: 'Measured at build time, resources included.',
    noTracking: 'No cookies, no trackers, no analytics.',
    contentLicence: 'Content under CC BY 4.0',
    codeLicence: 'Example code under MIT',
  },

  error: {
    notFoundTitle: 'This page does not exist',
    notFoundBody: 'The link may be old, or the entry may not be written yet.',
    notFoundAction: 'Go to the catalogue',
  },
} as const;
