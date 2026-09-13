/**
 * Chaînes d'interface, français.
 *
 * Toute chaîne visible passe par ici. Une chaîne écrite en dur dans un
 * composant est signalée par `scripts/check-i18n.mjs`.
 *
 * Le dictionnaire anglais doit avoir exactement les mêmes clés : une clé
 * manquante d'un côté fait échouer le build.
 */
export default {
  site: {
    name: 'Overkill',
    tagline: 'Le bon outil pour la bonne tâche',
    skipToContent: 'Aller au contenu',
  },

  nav: {
    catalogue: 'Catalogue',
    families: 'Familles',
    methodology: 'Comment ça marche',
    guide: 'Par où commencer',
    roadmap: 'Feuille de route',
    about: 'À propos',
    contribute: 'Contribuer',
    help: 'Contact',
    legal: 'Mentions légales',
    privacy: 'Confidentialité',
    credits: 'Crédits',
    main: 'Navigation principale',
    footer: 'Navigation de pied de page',
    language: 'Langue',
    theme: 'Basculer le thème',
  },

  /** Les quatre niveaux (CDC 4.1). */
  rung: {
    N0: 'Règle et algorithme classique',
    N1: 'Modèle classique léger',
    N2: 'Petit modèle spécialisé auto-hébergé',
    N3: 'API de LLM généraliste',
    short: {
      N0: 'Règle',
      N1: 'Modèle léger',
      N2: 'Petit modèle',
      N3: 'API de LLM',
    },
    /** La réponse en toutes lettres, affichée avant le code du niveau. */
    answer: {
      N0: 'Pas besoin d’IA',
      N1: 'Pas besoin d’IA générative',
      N2: 'De l’IA, mais un petit modèle chez vous',
      N3: 'Oui, un modèle généraliste se justifie',
    },
    unavailable: 'Niveau sans objet ici',
    scaleLabel: 'Niveaux documentés',
  },

  family: {
    missingHeading: 'Il manque une fiche ici ?',
    missingBody: 'Le catalogue grandit parce que des gens y versent ce qu’ils ont vu. Si vous avez vu quelqu’un employer un modèle généraliste là où une règle aurait suffi, dites-le.',
    missingAction: 'Proposer un besoin',
    missingHow: 'Comment écrire une fiche',
  },

  verdict: {
    badge: 'Recommandé',
    label: 'Verdict',
    heading: 'Le verdict',
    onRung: 'Recommandé sur ce besoin',
  },

  /** Le tableau récapitulatif (CDC 7.5). */
  table: {
    caption: 'Les options, du plus léger au plus lourd',
    rung: 'Niveau',
    approach: 'Approche',
    cost: 'Coût',
    latency: 'Latence',
    data: 'Données',
    deterministic: 'Déterministe',
    verdict: 'Verdict',
  },

  /** Le bloc risques, six champs (CDC 4.2). */
  risk: {
    heading: 'Risques',
    data_egress: 'Sortie de données',
    deterministic: 'Déterminisme',
    testability: 'Testabilité',
    vendor_lock: 'Dépendance fournisseur',
    footprint: 'Empreinte',
    regulatory: 'Périmètre réglementaire',
  },

  riskValue: {
    data_egress: {
      none: 'Rien ne sort',
      'own-infra': 'Reste dans votre infrastructure',
      'third-party': 'Part chez un tiers',
    },
    deterministic: { true: 'Oui', false: 'Non' },
    testability: {
      unit: 'Testable unitairement',
      statistical: 'Testable statistiquement',
      hard: 'Difficilement testable',
    },
    vendor_lock: {
      none: 'Aucune',
      library: 'Bibliothèque',
      provider: 'Fournisseur externe',
    },
    footprint: {
      negligible: 'Négligeable',
      low: 'Faible',
      moderate: 'Modérée',
      high: 'Élevée',
    },
  },

  /** Vocabulaire de coût imposé (CDC 4.5). */
  cost: {
    nul: 'Nul',
    négligeable: 'Négligeable',
    faible: 'Faible',
    modéré: 'Modéré',
    élevé: 'Élevé',
  },

  entry: {
    fourOptions: 'Les quatre options',
    otherLevels: 'Les autres options',
    need: 'Le besoin',
    scenario: 'Le scénario',
    family: 'Famille',
    updated: 'Révisée le',
    contributors: 'Contributeurs',
    breakingPoint: 'Point de rupture',
    escalateWhen: 'Quand passer au niveau suivant',
    furtherReading: 'Pour aller plus loin',
    sources: 'Source des chiffres',
    metadata: 'Métadonnées',
    neighbours: 'Fiches voisines',
    contents: 'Sur cette page',
    draft: 'Brouillon',
    draftNote: 'Cette fiche est un brouillon. Son contenu n’est pas encore vérifié.',
  },

  /* La zone d'essai (partie 1.2 du lot 14). Deux formes : interactive quand
     l'extrait tourne dans un navigateur, figée quand il ne peut pas. */
  tryout: {
    heading: 'Essayer',
    leadLive: 'Le code ci-dessus tourne dans votre navigateur. Changez le texte, le résultat suit.',
    leadFrozen: 'Ce code ne peut pas tourner dans un navigateur. Les sorties ci-dessous sont calculées à la construction du site, en exécutant le vrai code.',
    inputLabel: 'Votre texte',
    caught: 'Ce que le code a repéré',
    output: 'Ce qu’il renvoie',
    empty: 'rien',
    examples: 'Ou partez d’un exemple',
    given: 'Donné',
    noJs: 'La saisie libre et les autres exemples ont besoin de JavaScript. L’exemple affiché ci-dessous, lui, a été calculé à la construction du site.',
    failed: 'L’essai n’a pas abouti sur ce texte.',
    failsHere: 'Là, ça casse',
    nextLevel: 'Voir le niveau au-dessus',
  },

  code: {
    python: 'Python',
    javascript: 'JavaScript',
    copy: 'Copier',
    copied: 'Copié',
    copyFailed: 'Copie impossible',
    tabsLabel: 'Langage de l’exemple',
    source: 'Source',
    /* La preuve d’exécution, posée dans la barre du bloc de code et nulle part
       ailleurs : au plus près de l’extrait concerné, discrète, sans bloc
       explicatif. La forme courte est visible, la longue est lue par les
       lecteurs d’écran et affichée au survol. */
    proof: {
      executed: {
        short: 'Testé tel quel',
        full: 'Cet extrait s’exécute avec ses vraies dépendances, et son test tourne à chaque construction du site.',
      },
      stubbed: {
        short: 'Testé, service simulé',
        full: 'Cet extrait s’exécute à chaque construction du site, mais son test remplace le service externe par un double local : la requête envoyée, la réponse décodée et les cas d’erreur sont vérifiés, la réponse du vrai fournisseur ne l’est pas.',
      },
    },
  },

  costShort: {
    nul: 'gratuit',
    negligeable: 'coût négligeable',
    faible: 'coût faible',
    modere: 'coût modéré',
    eleve: 'coût élevé',
  },

  /* Le survol d'une carte : trois faits en langage courant. */
  plainCost: {
    nul: 'Gratuit',
    negligeable: 'Presque gratuit',
    faible: 'Peu coûteux',
    modere: 'Coûteux',
    eleve: 'Cher',
  },
  plainLatency: {
    '<1 ms': 'Instantané',
    '~10 ms': 'Instantané',
    '~100 ms': 'Rapide',
    '~1 s': 'Une seconde',
    '>1 s': 'Plus d’une seconde',
  },
  plainEgress: {
    none: 'Vos données ne sortent pas',
    'own-infra': 'Vos données restent chez vous',
    'third-party': 'Vos données partent chez un tiers',
  },

  families: {
    ctaHeading: 'Vous ne trouvez pas ?',
    ctaBody: 'Le catalogue est rangé en dix familles, une par verbe. Si vous ne savez pas quoi taper, partez de ce que vous voulez faire.',
    browse: 'Parcourir par famille',
    title: 'Dix familles, rangées par verbe',
    lead: 'Chaque tâche du catalogue appartient à une famille. Choisissez celle qui décrit ce que vous voulez faire.',
  },

  catalogue: {
    title: 'Catalogue',
    search: 'Rechercher une fiche',
    searchPlaceholder: 'Un besoin, un mot, une famille',
    filters: 'Filtres',
    filterFamily: 'Famille',
    filterVerdict: 'Verdict',
    filterEgress: 'Sortie de données',
    filterDeterministic: 'Déterminisme',
    apply: 'Filtrer',
    reset: 'Tout effacer',
    anyFamily: 'Toutes les familles',
    anyVerdict: 'Tous les verdicts',
    anyEgress: 'Toutes les sorties',
    anyDeterministic: 'Les deux',
    results: 'fiches',
    resultsOne: 'fiche',
    empty: 'Aucune fiche ne correspond',
    emptyHelp: 'Ce besoin manque au catalogue. Proposez-le, c’est comme cela qu’il grandit.',
    emptyAction: 'Proposer cette fiche',
    noJs: 'La recherche a besoin de JavaScript. Les filtres, non : validez le formulaire.',
  },

  help: {
    heading: 'Un cas que le catalogue ne couvre pas ?',
    body: 'Dites-moi ce que fait la tâche et ce qui vous fait douter. Un cas réel fait souvent une bonne fiche.',
    action: 'Écrire un message',
    subjectPrefix: 'Overkill',
  },

  legal: {
    notice:
      'Information générale, tenue à jour au mieux. Ce n’est pas un avis juridique. Faites valider votre situation par un professionnel.',
  },

  footer: {
    weight: 'Poids de cette page',
    weightNote: 'Mesuré à la construction du site, ressources comprises.',
    noTracking: 'Aucun cookie, aucun traceur, aucune mesure d’audience.',
    contentLicence: 'Contenu sous licence CC BY 4.0',
    codeLicence: 'Code des exemples sous licence MIT',
  },

  error: {
    notFoundTitle: 'Cette page n’existe pas',
    notFoundBody: 'Le lien est peut-être ancien, ou la fiche n’est pas encore écrite.',
    notFoundAction: 'Aller au catalogue',
  },
} as const;
