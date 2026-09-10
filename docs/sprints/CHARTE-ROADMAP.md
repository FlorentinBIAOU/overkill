# Charte de la feuille de route

Les 200 intitulés de `content/roadmap.yaml` (CDC 6.2).

---

## Ce que c'est, et ce que ce n'est pas

Ce ne sont **pas** des fiches. Aucun contenu de barreau n'est produit pour eux. Ils servent
à trois choses :

1. montrer l'ampleur du catalogue visé
2. vérifier que l'architecture tient à 200 entrées
3. donner aux contributeurs une liste dans laquelle se servir

Un intitulé est donc une **promesse de fiche** : quelqu'un doit pouvoir la prendre et
l'écrire sans avoir à deviner ce qu'on attendait.

---

## Format

```yaml
- id: extract-dates-from-text
  family: extract
  title:
    fr: "Extraire des dates d'un texte libre"
    en: "Extract dates from free text"
  need:
    fr: "Retrouver les dates mentionnées dans un message ou un document, quel que soit leur format."
    en: "Find the dates mentioned in a message or a document, whatever their format."
```

| Champ | Règle |
|---|---|
| `id` | anglais, kebab-case, unique dans tout le fichier, stable et définitif |
| `family` | une des dix familles, exactement |
| `title` | les deux langues, formulées comme un titre, pas comme une phrase |
| `need` | les deux langues, une phrase complète, ce que la personne veut faire |

---

## Ce qui fait un bon intitulé

- **Un besoin, pas une technologie.** « Trier des tickets », pas « Utiliser BERT ».
- **Formulé comme l'utilisateur le dirait**, pas comme un ingénieur le classerait.
- **Assez précis pour qu'on sache quoi écrire.** « Traiter du texte » ne veut rien dire.
  « Découper un texte long en passages cohérents » se comprend.
- **Réellement susceptible d'avoir plusieurs barreaux.** Un besoin qui n'a qu'une réponse
  possible fait une fiche courte mais valable ; un besoin qui n'a aucune alternative
  classique n'a pas sa place ici, parce que la fiche n'aurait rien à comparer.
- **Le français et l'anglais se lisent chacun comme écrit dans sa langue.** Ce n'est pas
  une traduction automatique de l'autre.

## Ce qui est refusé

- Un intitulé creux, générique ou redondant avec un autre. En cas de doute, on en met moins.
- Un intitulé qui promet un contenu qu'on ne saurait pas écrire honnêtement.
- Un intitulé qui est une variante cosmétique d'un autre : « Trier des tickets » et
  « Classer des tickets » sont le même besoin.
- La promotion d'un outil, d'un fournisseur ou d'une bibliothèque.
- Un chiffre, un prix, une promesse de performance.

## Le ton

Direct, concret, sans jargon inutile. Le titre tient en moins de dix mots. Le besoin tient
en une phrase de vingt-cinq mots au plus, et commence par un verbe à l'infinitif en
français, par un verbe à l'infinitif sans « to » ou par une forme directe en anglais.
