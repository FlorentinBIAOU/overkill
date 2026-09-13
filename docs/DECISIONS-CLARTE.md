# Décisions de clarté et de vocabulaire

Prises le 12 septembre 2026. Ne pas rouvrir sans raison nouvelle.

## 1. Langue du code

- La **docstring d'en-tête** de chaque extrait est traduite : deux versions,
  française et anglaise, servies selon la langue de la page.
- Les **commentaires en ligne** restent en anglais. Ils sont courts et
  accompagnent le code ; les traduire doublerait la maintenance de 154 fichiers.
- Les **identifiants** (noms de fonctions, variables, constantes) restent en
  anglais, comme partout dans le métier.
- Chaque barreau porte en plus, dans la fiche elle-même et non dans le code,
  **deux lignes en français** qui disent ce que fait l'approche et pourquoi.
  C'est là que se joue la compréhension, avant l'ouverture du code.

## 2. Vocabulaire de l'interface

- « **Niveau** » dans toute l'interface : tableau, badges, filtres, navigation.
- « **Barreau** » ~~conservé uniquement dans la page méthodologie~~ —
  **révisé au lot 14** : le mot disparaît aussi de la page « Comment ça
  marche » et des vingt-cinq fiches. La métaphore de l'échelle reste, mais elle
  se dit « échelle » et « niveau » : personne n'appelle « barreau » ce qu'il
  vient de choisir, et le mot obligeait à une traduction mentale à chaque
  lecture. `rung` reste l'identifiant dans le code et le schéma, comme les
  autres identifiants, qui sont en anglais.
- Règle générale : un mot ordinaire là où l'on n'a rien lu, un mot imagé là
  où l'on lit.

## 3. Formulation du verdict

Chaque fiche affiche en tête, en grand, la réponse en toutes lettres. Le code
N0–N3 devient un marqueur secondaire.

Phrases par défaut :

| Niveau | Français | Anglais |
|---|---|---|
| N0 | Non, du code ordinaire suffit. | No, ordinary code is enough. |
| N1 | Non, pas d'IA générative. Un modèle classique léger suffit. | No generative AI needed. A lightweight classic model is enough. |
| N2 | Oui, mais un petit modèle spécialisé chez vous, pas une API. | Yes, but a small specialised model on your own infrastructure, not an API. |
| N3 | Oui, c'est un cas où un modèle généraliste se justifie. | Yes, this is a case where a general-purpose model earns its place. |

Ces phrases sont des valeurs par défaut. Une fiche peut les préciser lorsque
c'est plus parlant : « Non, une expression régulière suffit » vaut mieux que
le générique sur la fiche de masquage.

## 4. Questionnaire d'orientation

- Cible : **non-développeurs uniquement**. Un développeur sait nommer sa tâche
  et va directement au catalogue.
- Arbre **déterministe**, sans appel de modèle. Un site qui prêche la sobriété
  ne met pas un LLM à son accueil.
- Piloté par **la donnée des fiches** (famille, sortie de données,
  déterminisme, verdict), jamais codé en dur, pour qu'une nouvelle fiche
  devienne atteignable sans retoucher l'arbre.
- Aboutit toujours à des fiches, ou à un message honnête quand la fiche
  n'existe pas encore.

## 5. Essai de code

**Révisé au lot 14.** La décision initiale — aucune exécution dans le
navigateur — visait un bac à sable WebAssembly de plusieurs mégaoctets, qui
aurait contredit la thèse du site. Elle ne tient plus dès lors qu'on exécute
**l'extrait lui-même** : quelques kilooctets de JavaScript, sans dépendance,
qui sont précisément ce que la fiche recommande. Refuser de le faire tourner
aurait été un aveu.

Deux formes, donc :

- **interactive** quand l'extrait du niveau recommandé existe en JavaScript et
  tourne sans dépendance : le module est chargé à la demande, l'extrait
  s'exécute à chaque frappe, et ce qui a été transformé est surligné de part et
  d'autre. Le résultat du premier exemple est calculé à la construction du
  site, donc la zone dit déjà quelque chose de vrai sans JavaScript.
- **figée** quand l'exécution en navigateur est impossible — modèle à
  télécharger, service externe : cinq à six cas dont les sorties sont calculées
  à la construction du site en exécutant le vrai code avec le double local des
  tests. Aucune sortie n'est écrite à la main.

Dans les deux cas, au moins un cas échoue : celui du point de rupture de la
fiche. Contrat dans `content/tryouts/README.md`.

## 6. Preuve d'exécution

**Décidé au lot 14.** La mention « Code exécuté tel quel », affichée en bloc
au-dessus du code, disparaît sous cette forme. L'information reste vraie et
utile — sur 74 extraits publiés, 29 sont testés contre un double local et non
contre le vrai service — et elle est désormais posée dans la barre du bloc de
code, au plus près de l'extrait qu'elle qualifie : forme courte visible, phrase
complète au survol et pour les lecteurs d'écran. Le lecteur peut savoir qu'un
extrait N3 n'a pas été prouvé contre le vrai fournisseur, sans que la page le
lui assène.
