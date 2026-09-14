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
    latest: 'Latest entries',
    about: 'About',
    contribute: 'Contribute',
    help: 'Contact',
    legal: 'Legal notice',
    privacy: 'Privacy',
    credits: 'Credits',
    main: 'Main navigation',
    breadcrumb: 'Breadcrumb',
    footer: 'Footer navigation',
    language: 'Language',
    theme: 'Switch theme',
    themeToDark: 'Switch to the dark theme',
    themeToLight: 'Switch to the light theme',
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
    /* Le mot qui dit, avant tout le reste, que cette zone se manipule. */
    interactive: 'interactive',
    leadLive: 'The code above runs in your browser. Type in the box: the result is redone in front of you.',
    leadFrozen: 'This code cannot run in a browser. The outputs below are computed when the site is built, by running the real code.',
    inputLabel: 'Your text',
    /* L'étiquette du champ dit qu'on peut y écrire, et le champ vide le redit. */
    editable: 'yours to edit',
    placeholder: 'Type or paste your text here, or pick an example below.',
    run: 'Run the code',
    ran: 'Recomputed',
    liveHint: 'Recomputed on every keystroke.',
    resultTitle: 'What the code makes of it',
    /* Le compte des passages surlignés, à la manière de regex101. */
    matchOne: '1 match',
    matchMany: '{n} matches',
    matchNone: 'nothing matched in this text',
    emptyReset: 'Field empty: here is the starting example again.',
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

  /* L'appel à l'action de fin des pages éditoriales. */
  pageCta: {
    methodology: {
      heading: 'The method at work',
      body: 'Twenty-five needs, their verdict, the code that goes with them, and a try zone that runs it in front of you.',
      action: 'Browse the catalogue',
    },
    contribute: {
      heading: 'Propose an entry without writing code',
      body: 'Four questions: the need in one sentence, the family that looks right to you, what you saw someone do, and what you think would be enough.',
      action: 'Open a proposal',
      secondary: 'Report a wrong entry',
    },
    credits: {
      heading: 'The repository is the record',
      body: 'The site’s code, the code of the examples, the checks and the full history of changes are all public.',
      action: 'See the repository',
    },
  },

  /* The orientation questionnaire. Eight questions, four screens, an
     explanatory verdict. "I don't know" is always available and counts. */
  guide: {
    title: 'Where to start',
    lead: 'Eight questions, two minutes, to find out whether your task needs AI and which kind. Nothing is sent anywhere: it is all computed in your browser, and no model is called.',
    start: 'Start',
    screens: [
      'What you want to do',
      'Your task',
      'Your constraints',
      'What you have',
    ],
    remaining: '{n} questions left',
    remainingOne: '{n} question left',
    step: 'Step {n} of {total}',
    next: 'Continue',
    back: 'Back',
    finish: 'See the answer',
    restart: 'Start over',
    required: 'Pick an answer to continue. “I don’t know” is one of them.',
    unknown: 'I don’t know',
    yes: 'Yes',
    no: 'No',
    noJs: 'This questionnaire needs JavaScript to chain the questions and work out the answer. Without it, start from the ten families: they sort the catalogue by what you want to do.',
    q: {
      family: {
        label: 'Broadly, what do you want to do?',
        help: 'The verb, not the solution. If two answers fit, take the one that describes the result you expect.',
        unknown: 'I don’t know yet',
      },
      frequence: {
        label: 'How often does this task happen?',
        help: 'This is what decides the cost: a rare task and a continuous one are not solved the same way.',
        basse: 'A few times a day, or less',
        moyenne: 'Hundreds of times a day',
        haute: 'Thousands of times a day, or continuously',
      },
      entry: {
        label: 'Which of these tasks is closest to yours?',
        help: 'These are the tasks the catalogue already covers in this family.',
        none: 'None of those',
      },
      egress: {
        label: 'Can the data you handle be sent to an outside provider?',
        help: 'Answer no if it is customer data, health data, employee data, or anything a contract forbids you to pass on.',
      },
      meme: {
        label: 'Do you need the same input to give exactly the same result, every time?',
        help: 'Yes, if a test has to pass, if someone can dispute the decision, or if two people must get the same answer.',
      },
      verifier: {
        label: 'Do you need to be able to check, case by case, that the result is right?',
        help: 'No, if an error rate measured on a sample is enough for you.',
      },
      exemples: {
        label: 'Do you already have examples of the task done by hand, with the right answer next to them?',
        help: 'This is what separates a rule from a trained model: with no labelled examples, there is nothing to learn from.',
        beaucoup: 'Hundreds, or more',
        quelques: 'A few dozen',
        aucun: 'None',
      },
      heberger: {
        label: 'Can someone install and run software on your own servers?',
        help: 'A model on your own machines costs no subscription, but it needs a machine and someone to keep it.',
      },
    },
    verdict: {
      heading: 'Your answer',
      forThisTask: 'For this task: {nom}',
      whyDefaultTitle: 'Why the entry recommends {de} by default',
      whyTitle: 'Why',
      changesTitle: 'What your answers change',
      entryTitle: 'The entry that covers this need',
      neighboursTitle: 'Nearby, in the same family',
      readEntry: 'Read the entry',
      moved: 'The catalogue recommends {de} for this need. Your constraints move the answer.',
      conflict: 'Careful: none of the options documented on this entry satisfies what you asked for.',
      gapHeading: 'The catalogue does not cover this need yet',
      gapBody: 'You picked a family, but none of the tasks written there matches. Rather than give you an answer at random, we say so. Two ways to move things along, and the first needs no account.',
      noTaskHeading: 'Without the task, there is no honest answer',
      noTaskBody: 'Naming an option at random would be worse than saying nothing. What we can do is narrow the catalogue down to what respects the constraints you have just stated.',
      mailAction: 'Describe the need by email',
      mailHelp: 'A message pre-filled with your answers. It is the shortest route, and it needs no account.',
      issueAction: 'Open a proposal on GitHub',
      issueHelp: 'If you have an account, the proposal is public and can be followed.',
      browseAction: 'See the filtered catalogue',
      familyAction: 'See the entries in this family',
      mailSubject: 'Overkill — a need the catalogue does not cover',
      mailIntro: 'Here is what I am trying to do, and what the questionnaire kept from my answers:',
      notes: {
        egressBloque: 'Your data cannot leave. Option {de} sends it to a third party: {vers} is the one to look at — {nom} — which stays with you.',
        egressSansIssue: 'Your data cannot leave, and no option documented on this entry does without. Read the whole entry before committing.',
        egressInconnu: 'You do not know whether your data can leave: that is the question to settle before all the others. On the option kept, {sortie}.',
        memeBloque: 'You need the same result every time. Option {de} does not guarantee it; {vers} does — {nom}.',
        memeSansIssue: 'You need the same result every time, and no option documented here guarantees it.',
        memeInconnu: 'You do not know whether the result has to be reproducible. On the option kept: {determinisme}.',
        verifierBloque: 'You must be able to check each case. Option {de} can only be checked statistically; {vers} can be checked case by case — {nom}.',
        verifierSansIssue: 'You must be able to check each case, and no option documented here allows it other than on a sample.',
        verifierInconnu: 'You do not know whether each case has to be checkable. On the option kept: {verifiabilite}.',
        contraintesSatisfaites: 'What you asked for holds on this option: {liste}.',
        exemplesInutiles: 'You have no labelled examples, and this option asks for none: that is precisely what makes it free to run.',
        exemplesManquants: 'Option {niveau} learns from labelled examples, and you have none. They have to be built first, or stay on the option below until the material exists.',
        exemplesPeu: 'A few dozen examples rarely hold a model up. Expect to label more before the result is stable.',
        hebergementImpossible: 'Option {niveau} assumes software installed on your side, and nobody can do it. Either find that person, or give up that option.',
        frequenceHaute: 'At that frequency, the recurring cost is what decides. Look at what the entry says about cost before settling into this option.',
        frequenceBasse: 'At that frequency, the cost of a model call stays low: this is the case where the heaviest option is easiest to defend.',
      },
    },
  },

  /* The latest entries, and the feed nobody knew about. */
  latest: {
    title: 'The latest entries',
    lead: 'The catalogue’s entries, from the most recently revised to the oldest. A revision counts as much as a publication: an entry whose verdict changes concerns you more than a new one.',
    revised: 'Revised on',
    feedTitle: 'The feed, so you need not come back to look',
    feedLead: 'Every publication and every revision goes through it. The feed is a file served from this domain: no account, no tracker, no measure of who reads it.',
    feedAction: 'Open the feed',
    feedAddress: 'The address to paste into your reader',
    count: '{n} published entries',
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
    pages: 'Catalogue pagination',
    pageOf: 'Page {n} of {total}',
    pageNumber: 'Page {n}',
    previous: 'Previous',
    next: 'Next',
    allResults: 'across the whole catalogue',
    noJs: 'Search needs JavaScript. Filters do not: submit the form.',
  },

  /* What an entry gives you to paste elsewhere: the two share links, and the
     README badge that earns inbound links. */
  share: {
    heading: 'Share, or paste into a README',
    lead: 'Two plain links, no third-party script: nothing is loaded from a social network on this page.',
    linkedin: 'Share on LinkedIn',
    x: 'Share on X',
    badgeVerified: 'Checked on Overkill',
    badgeTitle: 'The badge, for a README',
    badgeLead: 'Paste this line into a repository’s README: the image links back to this entry.',
    badgeAlt: 'Badge: checked on Overkill — {reponse}',
    snippet: 'Markdown to copy',
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
    noTracking: 'No cookies, no trackers. Anonymous, cookieless analytics.',
    contentLicence: 'Content under CC BY 4.0',
    codeLicence: 'Example code under MIT',
  },

  error: {
    notFoundTitle: 'This page does not exist',
    notFoundBody: 'The link may be old, or the entry may not be written yet.',
    notFoundAction: 'Go to the catalogue',
  },
} as const;
