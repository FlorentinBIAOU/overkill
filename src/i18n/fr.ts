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
    methodology: 'Méthodologie',
    roadmap: 'Feuille de route',
    about: 'À propos',
    contribute: 'Contribuer',
    help: 'Accompagnement',
    legal: 'Mentions légales',
    privacy: 'Confidentialité',
    credits: 'Crédits',
    main: 'Navigation principale',
    language: 'Langue',
    theme: 'Basculer le thème',
  },

  /** Les quatre barreaux (CDC 4.1). */
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
    unavailable: 'Barreau absent',
    scaleLabel: 'Barreaux documentés',
  },

  verdict: {
    badge: 'Recommandé',
    label: 'Verdict',
    heading: 'Le verdict',
    onRung: 'Recommandé sur ce besoin',
  },

  /** Le tableau récapitulatif (CDC 7.5). */
  table: {
    caption: 'Récapitulatif des barreaux',
    rung: 'Barreau',
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
    need: 'Le besoin',
    scenario: 'Le scénario',
    family: 'Famille',
    updated: 'Révisée le',
    contributors: 'Contributeurs',
    breakingPoint: 'Point de rupture',
    escalateWhen: 'Quand monter d’un barreau',
    furtherReading: 'Pour aller plus loin',
    sources: 'Source des chiffres',
    metadata: 'Métadonnées',
    neighbours: 'Fiches voisines',
    contents: 'Sur cette page',
    draft: 'Brouillon',
    draftNote: 'Cette fiche est un brouillon. Son contenu n’est pas encore vérifié.',
  },

  code: {
    python: 'Python',
    javascript: 'JavaScript',
    copy: 'Copier',
    copied: 'Copié',
    copyFailed: 'Copie impossible',
    tabsLabel: 'Langage de l’exemple',
    source: 'Source',
    verification: {
      label: 'Preuve d’exécution',
      executed: 'Code exécuté tel quel',
      executedNote:
        'Cet extrait s’exécute avec ses vraies dépendances, et son test tourne à chaque construction du site.',
      stubbed: 'Code exécuté, service externe simulé',
      stubbedNote:
        'Cet extrait s’exécute à chaque construction du site, mais son test remplace le service externe par un double local. Ce qui est vérifié : la requête envoyée, la réponse décodée et les cas d’erreur. Ce qui ne l’est pas : la qualité de la réponse du modèle.',
    },
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
    results: 'fiches',
    resultsOne: 'fiche',
    empty: 'Aucune fiche ne correspond',
    emptyHelp: 'Ce besoin manque au catalogue. Proposez-le, c’est comme cela qu’il grandit.',
    emptyAction: 'Proposer cette fiche',
    noJs: 'La recherche a besoin de JavaScript. Les filtres, non : validez le formulaire.',
  },

  help: {
    heading: 'Vous voulez mettre ça en place chez vous ?',
    body: 'Audit d’un cas d’usage, mise en place de l’alternative, formation d’équipe.',
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
