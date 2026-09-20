# check-a-password-against-a-policy — avis du relecteur

## Tour 1 — REFUSÉE

La fiche est bien documentée et le choix du k-anonymat est le bon. Le test qui
lit l'adresse demandée et vérifie que ni le mot de passe, ni son empreinte, ni
même son suffixe n'y figurent est exactement ce qu'on attend d'un niveau
`stubbed` : il prouve la plomberie, et il prouve la seule chose qui compte ici.
Les sources portent les citations exactes de la norme.

Le refus porte sur un champ de risque qui dit le contraire de ce que fait le
code, et sur le seul chemin d'exécution que la fiche n'a pas écrit.

### Raisons du refus

1. **`data_egress: none` est faux.** Le niveau N0 émet une requête HTTPS vers
   `api.pwnedpasswords.com` à chaque inscription acceptable. Le schéma du site
   (`src/content/schema/rung.ts`, `DATA_EGRESS`) propose `third-party`, qui est
   la valeur juste. La fiche se contredit d'ailleurs elle-même dans le même
   bloc : `vendor_lock: provider`, et la deuxième ligne du `regulatory` —
   « Dépendance à un service tiers pour la liste de fuites ». Ce champ n'est
   pas décoratif : `RiskBlock.astro` l'affiche comme badge, et
   `CatalogLayout.astro` en fait un filtre du catalogue. Un lecteur qui filtre
   sur « aucune sortie de données » pour choisir une méthode dans un contexte
   contraint trouvera cette fiche et enverra du trafic sortant à chaque
   inscription. Ce que le `regulatory` explique correctement — le mot de passe
   ne sort pas, cinq caractères d'empreinte sortent — est exactement ce que
   `third-party` veut dire : quelque chose sort, et la fiche dit quoi.

2. **Rien ne dit, ni ne teste, ce qui se passe quand le service ne répond
   pas.** Le `fetch` par défaut (`n0.py:52-58`) fait un `urlopen` avec cinq
   secondes de délai, sans reprise ; `check_password` ne l'entoure d'aucun
   `try`. Une panne ou une lenteur de Have I Been Pwned remonte donc en
   exception dans le chemin d'inscription : cinq secondes d'attente puis une
   erreur serveur, pour chaque nouvel utilisateur, sur un contrôle que la norme
   classe en `SHALL` mais que personne ne veut voir bloquer une inscription.
   C'est la règle R8 — dégrader plutôt que lever dans un chemin de requête — et
   c'est aussi ce que la charte des tests exige d'un niveau `stubbed` : la
   panne fait partie des chemins à démontrer. Le `regulatory` dit que
   « l'appelant doit décider quoi faire quand il ne répond pas », mais le
   rapport ne lui donne rien pour décider : il n'existe aucune valeur de
   retour qui signifie « la liste n'a pas pu être interrogée ». Correctif :
   attraper l'échec, rendre `breaches: None` avec une raison distincte —
   `blocklist-unavailable` — que l'appelant peut traiter comme il l'entend, et
   un test qui passe un `fetch` qui lève. On saura que c'est fait quand
   `check_password(mot, fetch=lambda _: (_ for _ in ()).throw(OSError))` rendra
   un rapport et non une pile.

### Remarques non bloquantes

1. **`MAXIMUM = 64` est appliqué comme un plafond, et la source citée dit
   l'inverse.** La citation portée par la fiche est « SHOULD permit a maximum
   password length of **at least** 64 characters » : soixante-quatre est un
   plancher sur le plafond. Le commentaire du code le sait — « not a ceiling to
   be proud of: raise it, never lower it » — et le code le prend quand même
   comme plafond par défaut. Conséquence : une phrase de passe de soixante-dix
   caractères, ce que produit un gestionnaire de mots de passe réglé sur six
   mots, revient `too-long`. C'est un refus d'un bon mot de passe par une règle
   de longueur, dans une fiche dont la thèse est que les règles de forme
   poussent aux mauvais mots de passe. Soit la valeur par défaut monte (256 est
   l'usage), soit le point de rupture nomme ce refus.

2. **`context` ne teste que l'égalité.** `check_password("Boulangerie-Martin-2026", context=["Boulangerie-Martin"])`
   passe. La docstring est explicite — « the short list of words a password
   must not **be** » — donc rien n'est caché, mais un lecteur pressé lira
   « blocklist contextuelle » et attendra l'inclusion. Une phrase dans le
   `breaking_point` ou l'`escalate_when` le fermerait.

3. **R11 — `breaking_point` de 59 mots, deux phrases.** Voir la synthèse.

### Ce qui est solide

- Le test `test_le_mot_de_passe_ne_sort_jamais_seuls_cinq_caracteres_de_son_hache`
  est le meilleur test de niveau `stubbed` du lot : il ne vérifie pas que le
  code « appelle bien le service », il lit l'adresse construite et affirme que
  ni le mot de passe, ni son empreinte complète, ni son suffixe ne s'y trouvent.
  C'est la démonstration de l'argument de confidentialité, pas son illustration.
- Ne pas interroger la liste quand la longueur a déjà tranché — « a request
  that will change nothing is a request not to make » — est du bon sens
  d'exploitation, et il est testé en comptant les appels.
- Le point de rupture est juste et il est le bon : « Clementine-2019-Martin »,
  vingt-deux caractères, qui n'est dans aucune liste. L'`escalate_when` en tire
  la seule conclusion honnête — un second facteur, pas une règle de plus — et
  c'est la conclusion de la norme elle-même.
- Le choix de `lower()` plutôt que `casefold()`, avec la raison écrite (le
  « ß » allemand, et l'absence de pliage en JavaScript) : c'est une divergence
  entre langages repérée, fermée et expliquée, avec « STRASSE ist eine Straße »
  dans le test de parité.
- La NFC appliquée avant tout, avec la raison : deux écritures du même mot de
  passe sont le même mot de passe. Peu de codes de production le font.
- Les sources portent les citations `SHALL` et `SHOULD` mot pour mot, avec
  l'adresse de la norme. C'est R12 telle qu'elle devrait être appliquée
  partout.
