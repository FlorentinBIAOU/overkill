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
    latest: 'Dernières fiches',
    about: 'À propos',
    contribute: 'Contribuer',
    help: 'Contact',
    legal: 'Mentions légales',
    privacy: 'Confidentialité',
    credits: 'Crédits',
    main: 'Navigation principale',
    breadcrumb: 'Fil d’Ariane',
    footer: 'Navigation de pied de page',
    language: 'Langue',
    theme: 'Basculer le thème',
    themeToDark: 'Passer au thème sombre',
    themeToLight: 'Passer au thème clair',
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

  /* Le bloc risques en langage clair : des phrases qui se comprennent seules,
     sans légende. La version courte de `riskValue` reste employée par les
     filtres du catalogue, où il faut un libellé et non une phrase. */
  riskPlain: {
    heading: 'Ce que ça implique',
    data_egress: {
      none: 'Vos données ne sortent pas',
      'own-infra': 'Vos données restent chez vous',
      'third-party': 'Vos données partent chez un tiers',
    },
    deterministic: {
      true: 'Résultat toujours identique',
      false: 'Résultat variable d’un appel à l’autre',
    },
    testability: {
      unit: 'Se teste unitairement, cas par cas',
      statistical: 'Se mesure sur un échantillon, pas cas par cas',
      hard: 'Difficile à tester',
    },
    vendor_lock: {
      none: 'Aucun fournisseur dans la boucle',
      library: 'Dépend d’une bibliothèque',
      provider: 'Dépend d’un fournisseur externe',
    },
    footprint: {
      negligible: 'Empreinte négligeable',
      low: 'Empreinte faible',
      moderate: 'Empreinte modérée',
      high: 'Empreinte élevée',
    },
    regulatory: 'Ce que cela ajoute à votre périmètre réglementaire',
  },

  /** Vocabulaire de coût imposé (CDC 4.5). */
  cost: {
    nul: 'Nul',
    négligeable: 'Négligeable',
    faible: 'Faible',
    modéré: 'Modéré',
    élevé: 'Élevé',
  },

  /* La nature d'un lien, déduite de son adresse par src/lib/links.ts. Le
     repli « page web » est vrai de n'importe quelle adresse. */
  linkKind: {
    repo: 'Dépôt de code',
    doc: 'Documentation',
    spec: 'Spécification',
    paper: 'Article de recherche',
    academic: 'Publication universitaire',
    law: 'Texte réglementaire',
    reference: 'Encyclopédie',
    page: 'Page web',
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
    conclusion: 'Ce qu’il en conclut',
    image: 'L’image produite',
    detail: 'Le détail',
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

  /* L'appel à l'action de fin des pages éditoriales. Une page qui n'a rien à
     proposer n'en porte pas : les pages légales s'arrêtent sur leur contenu. */
  pageCta: {
    methodology: {
      heading: 'La méthode à l’œuvre',
      body: 'Vingt-cinq besoins, leur verdict, le code qui va avec, et une zone d’essai qui le fait tourner devant vous.',
      action: 'Parcourir le catalogue',
    },
    contribute: {
      heading: 'Proposer une fiche sans écrire de code',
      body: 'Quatre questions : le besoin en une phrase, la famille qui vous semble la bonne, ce que vous avez vu faire, et ce qui vous semble suffire.',
      action: 'Ouvrir une proposition',
      secondary: 'Signaler une fiche fausse',
    },
    credits: {
      heading: 'Le dépôt fait foi',
      body: 'Le code du site, celui des exemples, les contrôles et l’historique complet des modifications sont publics.',
      action: 'Voir le dépôt',
    },
  },

  /* Le questionnaire d'orientation (lot 14, partie 3). Huit questions, quatre
     écrans, un verdict explicatif. « Je ne sais pas » est toujours disponible
     et compte dans la réponse. */
  guide: {
    title: 'Par où commencer',
    lead: 'Huit questions, deux minutes, pour savoir si votre tâche a besoin d’IA et laquelle. Rien n’est envoyé : tout se calcule dans votre navigateur, et aucun modèle n’est appelé.',
    start: 'Commencer',
    screens: [
      'Ce que vous voulez faire',
      'Votre tâche',
      'Vos contraintes',
      'Ce dont vous disposez',
    ],
    remaining: '{n} questions restantes',
    remainingOne: '{n} question restante',
    step: 'Étape {n} sur {total}',
    next: 'Continuer',
    back: 'Revenir',
    finish: 'Voir la réponse',
    restart: 'Reprendre depuis le début',
    required: 'Choisissez une réponse pour continuer. « Je ne sais pas » en est une.',
    unknown: 'Je ne sais pas',
    yes: 'Oui',
    no: 'Non',
    noJs: 'Ce questionnaire a besoin de JavaScript pour enchaîner les questions et calculer la réponse. Sans lui, partez des dix familles : elles rangent le catalogue par ce que vous voulez faire.',
    q: {
      family: {
        label: 'Qu’est-ce que vous voulez faire, dans les grandes lignes ?',
        help: 'Le verbe, pas la solution. Si deux réponses conviennent, prenez celle qui décrit le résultat attendu.',
        unknown: 'Je ne sais pas encore',
      },
      frequence: {
        label: 'À quelle fréquence cette tâche a-t-elle lieu ?',
        help: 'C’est ce qui décide du coût : une tâche rare et une tâche continue ne se règlent pas pareil.',
        basse: 'Quelques fois par jour, ou moins',
        moyenne: 'Des centaines de fois par jour',
        haute: 'Des milliers de fois par jour, ou en continu',
      },
      entry: {
        label: 'Laquelle de ces tâches ressemble le plus à la vôtre ?',
        help: 'Ce sont les tâches déjà traitées par le catalogue dans cette famille.',
        none: 'Aucune de celles-là',
      },
      egress: {
        label: 'Les données que vous traitez peuvent-elles être envoyées à un prestataire extérieur ?',
        help: 'Répondez non s’il s’agit de données de clients, de santé, de salariés, ou de quoi que ce soit qu’un contrat vous interdit de transmettre.',
      },
      meme: {
        label: 'Avez-vous besoin que la même entrée donne exactement le même résultat, à chaque fois ?',
        help: 'Oui, si un test doit passer, si quelqu’un peut contester la décision, ou si deux personnes doivent obtenir la même réponse.',
      },
      verifier: {
        label: 'Devez-vous pouvoir vérifier, cas par cas, que le résultat est le bon ?',
        help: 'Non, si vous vous contentez d’un taux d’erreur mesuré sur un échantillon.',
      },
      exemples: {
        label: 'Avez-vous des exemples de la tâche déjà faits à la main, avec la bonne réponse à côté ?',
        help: 'C’est ce qui sépare une règle d’un modèle entraîné : sans exemples étiquetés, il n’y a rien à apprendre.',
        beaucoup: 'Des centaines, ou plus',
        quelques: 'Quelques dizaines',
        aucun: 'Aucun',
      },
      heberger: {
        label: 'Quelqu’un peut-il installer et faire tourner un logiciel sur vos propres serveurs ?',
        help: 'Un modèle chez vous ne coûte pas d’abonnement, mais il demande une machine et quelqu’un qui la tienne.',
      },
    },
    verdict: {
      heading: 'Votre réponse',
      forThisTask: 'Pour cette tâche : {nom}',
      whyDefaultTitle: 'Pourquoi la fiche recommande {de} par défaut',
      whyTitle: 'Pourquoi',
      changesTitle: 'Ce que vos réponses changent',
      entryTitle: 'La fiche qui traite ce besoin',
      neighboursTitle: 'À côté, dans la même famille',
      readEntry: 'Lire la fiche',
      moved: 'Le catalogue recommande {de} sur ce besoin. Vos contraintes déplacent la réponse.',
      conflict: 'Attention : aucune des options documentées sur cette fiche ne satisfait ce que vous avez demandé.',
      gapHeading: 'Le catalogue ne couvre pas encore ce besoin',
      gapBody: 'Vous avez désigné une famille, mais aucune des tâches écrites ne correspond. Plutôt que de vous donner une réponse au hasard, on vous le dit. Deux façons de faire avancer les choses, et la première ne demande aucun compte.',
      noTaskHeading: 'Sans la tâche, pas de réponse honnête',
      noTaskBody: 'Désigner une option au hasard serait pire que ne rien dire. Ce qu’on peut faire, en revanche, c’est réduire le catalogue à ce qui respecte les contraintes que vous venez d’exprimer.',
      mailAction: 'Décrire le besoin par message',
      mailHelp: 'Un message pré-rempli avec vos réponses. C’est la voie la plus courte, et elle ne demande pas de compte.',
      issueAction: 'Ouvrir une proposition sur GitHub',
      issueHelp: 'Si vous avez un compte, la proposition est publique et suivable.',
      browseAction: 'Voir le catalogue filtré',
      familyAction: 'Voir les fiches de cette famille',
      mailSubject: 'Overkill — un besoin que le catalogue ne couvre pas',
      mailIntro: 'Voici ce que je cherche à faire, et ce que le questionnaire a retenu de mes réponses :',
      notes: {
        egressBloque: 'Vos données ne peuvent pas sortir. L’option {de} les envoie chez un tiers : c’est {vers} qu’il faut regarder — {nom} — qui reste chez vous.',
        egressSansIssue: 'Vos données ne peuvent pas sortir, et aucune option documentée sur cette fiche ne s’en passe. Lisez la fiche entière avant de vous engager.',
        egressInconnu: 'Vous ne savez pas si vos données peuvent sortir : c’est la question à trancher avant toutes les autres. Sur l’option retenue, {sortie}.',
        memeBloque: 'Vous avez besoin du même résultat à chaque fois. L’option {de} ne le garantit pas ; {vers} le garantit — {nom}.',
        memeSansIssue: 'Vous avez besoin du même résultat à chaque fois, et aucune option documentée ici ne le garantit.',
        memeInconnu: 'Vous ne savez pas si le résultat doit être reproductible. Sur l’option retenue : {determinisme}.',
        verifierBloque: 'Vous devez pouvoir vérifier chaque cas. L’option {de} ne se vérifie que statistiquement ; {vers} se vérifie cas par cas — {nom}.',
        verifierSansIssue: 'Vous devez pouvoir vérifier chaque cas, et aucune option documentée ici ne le permet autrement que sur un échantillon.',
        verifierInconnu: 'Vous ne savez pas si chaque cas doit être vérifiable. Sur l’option retenue : {verifiabilite}.',
        contraintesSatisfaites: 'Ce que vous avez demandé tient sur cette option : {liste}.',
        exemplesInutiles: 'Vous n’avez pas d’exemples déjà étiquetés, et cette option n’en demande aucun : c’est précisément ce qui la rend gratuite à faire tourner.',
        exemplesManquants: 'L’option {niveau} apprend sur des exemples étiquetés, et vous n’en avez pas. Il faut d’abord les constituer, ou rester à l’option du dessous le temps que la matière existe.',
        exemplesPeu: 'Quelques dizaines d’exemples suffisent rarement à tenir un modèle. Attendez-vous à devoir en étiqueter davantage avant que le résultat soit stable.',
        hebergementImpossible: 'L’option {niveau} suppose un logiciel installé chez vous, et personne ne peut le faire. Il faut soit trouver cette personne, soit renoncer à cette option.',
        frequenceHaute: 'À cette fréquence, c’est le coût récurrent qui décide. Regardez ce que la fiche dit du coût avant de vous installer dans cette option.',
        frequenceBasse: 'À cette fréquence, le coût d’un appel à un modèle reste faible : c’est le cas où l’option la plus lourde se défend le plus facilement.',
      },
    },
  },

  /* La page des dernières fiches, et le flux que personne ne connaissait. */
  latest: {
    title: 'Les dernières fiches',
    lead: 'Les fiches du catalogue, de la plus récemment révisée à la plus ancienne. Une révision compte autant qu’une publication : une fiche dont le verdict change vous concerne davantage qu’une fiche nouvelle.',
    revised: 'Révisée le',
    feedTitle: 'Le flux, pour ne pas revenir voir',
    feedLead: 'Chaque publication et chaque révision y passe. Le flux est un fichier servi depuis ce domaine : aucun compte, aucun traceur, aucune mesure de qui le lit.',
    feedAction: 'Ouvrir le flux',
    feedAddress: 'L’adresse à coller dans votre lecteur',
    count: '{n} fiches publiées',
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
    pages: 'Pagination du catalogue',
    pageOf: 'Page {n} sur {total}',
    pageNumber: 'Page {n}',
    previous: 'Précédentes',
    next: 'Suivantes',
    allResults: 'sur tout le catalogue',
    noJs: 'La recherche a besoin de JavaScript. Les filtres, non : validez le formulaire.',
  },

  /* Ce qu'une fiche donne à coller ailleurs : les deux partages, et le badge
     de README qui fait les liens entrants. */
  share: {
    heading: 'Partager, ou coller dans un README',
    lead: 'Deux liens simples, sans script tiers : rien n’est chargé depuis un réseau social sur cette page.',
    linkedin: 'Partager sur LinkedIn',
    x: 'Partager sur X',
    badgeVerified: 'Vérifié sur Overkill',
    badgeTitle: 'Le badge, pour un README',
    badgeLead: 'Collez cette ligne dans le README d’un dépôt : l’image renvoie à cette fiche.',
    badgeAlt: 'Badge : vérifié sur Overkill — {reponse}',
    snippet: 'Markdown à copier',
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
    noTracking: 'Aucun cookie, aucun traceur. Mesure d’audience anonyme et sans cookie.',
    contentLicence: 'Contenu sous licence CC BY 4.0',
    codeLicence: 'Code des exemples sous licence MIT',
  },

  error: {
    notFoundTitle: 'Cette page n’existe pas',
    notFoundBody: 'Le lien est peut-être ancien, ou la fiche n’est pas encore écrite.',
    notFoundAction: 'Aller au catalogue',
  },
} as const;
