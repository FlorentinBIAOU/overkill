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
    methodology: 'Methodology',
    roadmap: 'Roadmap',
    about: 'About',
    contribute: 'Contribute',
    help: 'Get help',
    legal: 'Legal notice',
    privacy: 'Privacy',
    credits: 'Credits',
    main: 'Main navigation',
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
    unavailable: 'Rung not applicable',
    scaleLabel: 'Documented rungs',
  },

  verdict: {
    badge: 'Recommended',
    label: 'Verdict',
    heading: 'The verdict',
    onRung: 'Recommended for this need',
  },

  table: {
    caption: 'Rungs at a glance',
    rung: 'Rung',
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

  cost: {
    nul: 'None',
    négligeable: 'Negligible',
    faible: 'Low',
    modéré: 'Moderate',
    élevé: 'High',
  },

  entry: {
    need: 'The need',
    scenario: 'The scenario',
    family: 'Family',
    updated: 'Reviewed on',
    contributors: 'Contributors',
    breakingPoint: 'Breaking point',
    escalateWhen: 'When to move up a rung',
    furtherReading: 'Further reading',
    sources: 'Where the figures come from',
    metadata: 'Metadata',
    neighbours: 'Nearby entries',
    contents: 'On this page',
    draft: 'Draft',
    draftNote: 'This entry is a draft. Its content has not been verified yet.',
  },

  code: {
    python: 'Python',
    javascript: 'JavaScript',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Could not copy',
    tabsLabel: 'Example language',
    source: 'Source',
    verification: {
      label: 'Proof of execution',
      executed: 'Code runs as shown',
      executedNote:
        'This snippet runs with its real dependencies, and its test runs on every build of the site.',
      stubbed: 'Code runs, external service simulated',
      stubbedNote:
        'This snippet runs on every build of the site, but its test replaces the external service with a local double. What is verified: the request sent, the response decoded, and the error paths. What is not: how good the model’s answer is.',
    },
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
    results: 'entries',
    resultsOne: 'entry',
    empty: 'No entry matches',
    emptyHelp: 'This need is missing from the catalogue. Propose it, that is how it grows.',
    emptyAction: 'Propose this entry',
    noJs: 'Search needs JavaScript. Filters do not: submit the form.',
  },

  help: {
    heading: 'Want to put this in place where you work?',
    body: 'Audit of one use case, building the alternative, team training.',
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
