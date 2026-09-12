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
- « **Barreau** » conservé uniquement dans la page méthodologie, où la
  métaphore de l'échelle est expliquée.
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

Pas d'exécution dans le navigateur : un bac à sable WebAssembly pèse plusieurs
mégaoctets et contredirait la thèse du site. À la place, une zone d'essai
**statique** : entrée, sortie attendue, calculées au moment de la construction.
