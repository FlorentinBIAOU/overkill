# Contribuer à Overkill

Merci d'y penser. Ce catalogue n'a de valeur que si son contenu est juste, et
la façon la plus efficace de l'améliorer est de signaler ce qui est faux.

---

## La règle qui prime sur tout

**Aucune fiche n'est publiée si son code n'a pas été exécuté et vérifié.**

Un catalogue dont le code ne tourne pas n'a aucune valeur, et une seule fiche
fausse jette le doute sur toutes les autres.

Concrètement : chaque extrait vit dans un fichier réel du dépôt, avec un test à
côté de lui. La fiche importe le fichier, elle ne contient pas de code recopié.
Si un test échoue, la construction du site échoue.

En cas de doute sur un point, proposez la fiche en `status: draft`. Un brouillon
assumé est utile ; une fiche plausible mais fausse ne l'est pas.

---

## Trois façons de contribuer

### 1. Signaler une erreur

C'est le service le plus utile. Ouvrez une issue en citant la fiche et le point
contesté. Une correction de fond passe avant tout ajout de contenu.

### 2. Proposer une fiche sans écrire de code

Vous n'avez pas besoin d'être développeur. Si vous avez vu quelqu'un employer un
modèle généraliste là où une règle aurait suffi, ouvrez une issue avec le
gabarit « proposer une fiche ». Quatre questions, rien d'autre.

### 3. Écrire une fiche

Voir plus bas.

---

## Installer

```bash
npm install
python3 -m venv .venv-tools
.venv-tools/bin/pip install -r content/snippets/requirements-snippets.txt
```

Pour le contrôle orthographique du français, facultatif en local :

```bash
sudo apt install hunspell-fr-classical
.venv-tools/bin/pip install spylls
```

## Vérifier

```bash
npm run check
```

Cette commande enchaîne exactement les contrôles de l'intégration continue, dans
le même ordre. Si elle passe en local, elle passera en CI.

---

## Écrire une fiche

### 1. Choisir un besoin

Prenez-en un dans la [feuille de route](content/roadmap.yaml), ou proposez le
vôtre par une issue avant d'écrire. Cela évite d'écrire quelque chose qui sera
refusé pour une raison qu'on aurait pu dire plus tôt.

### 2. Écrire le code d'abord

Le contenu d'une fiche vient du code, pas de ce qu'on croit savoir du sujet.

```
content/snippets/<identifiant>/
    n0.py   n0.test.py   n0.js   n0.test.js
    n1.py   n1.test.py   n1.js   n1.test.js
```

Un fichier par niveau et par langage. Les deux langages sont systématiques :
Python et JavaScript, jamais l'un sans l'autre.

Chaque extrait a **trois cas de test au minimum** : le cas nominal, un cas
limite réaliste, et **le point de rupture** — un test qui démontre que
l'approche échoue là où la fiche le dira. C'est le test le plus important :
sans lui, ce que la page raconte sur les limites de l'approche est une opinion.

La charte complète est dans [`docs/sprints/CHARTE-EXTRAITS.md`](docs/sprints/CHARTE-EXTRAITS.md).

```bash
npm run test:snippets -- <identifiant>
```

### 3. Écrire la fiche

Copiez [`content/entries/_TEMPLATE.mdx`](content/entries/_TEMPLATE.mdx) sous
`content/entries/<identifiant>.mdx` et remplissez chaque champ.

La charte de rédaction est dans
[`docs/sprints/CHARTE-REDACTION.md`](docs/sprints/CHARTE-REDACTION.md).
Lisez-la : elle dit exactement ce qui est attendu champ par champ, et ce qui
est refusé.

### 4. Ouvrir une pull request

Le gabarit vous demandera de confirmer que le code a été exécuté, avec quelle
commande, que les deux langues sont renseignées, et d'où viennent les chiffres.

---

## Ce qui est refusé

**Du contenu non vérifié.** Un extrait qui n'a pas été exécuté, un point de
rupture affirmé sans test, une affirmation dont vous n'êtes pas sûr.

**La promotion d'un outil.** Si votre fiche existe pour faire connaître un
produit, elle sera refusée, même si le produit est bon. Le site n'a aucun
partenariat et n'en aura pas.

**Des chiffres sans source.** Pas de prix absolu, pas de gramme de CO₂, pas de
pourcentage de performance qui ne vient pas d'un banc d'essai que vous avez
réellement fait tourner. Le vocabulaire d'ordre de grandeur est imposé et
documenté sur la page méthodologie.

**Du conseil juridique.** Le bloc réglementaire est factuel et daté. Aucune
fiche ne dit à personne qu'il est conforme ou non.

**Un jugement de valeur sur l'IA.** Ni dans le texte, ni dans la couleur. Le
site compare des outils sur des tâches ; il ne milite pas. Le badge
« recommandé » peut se poser sur n'importe quel niveau, N3 compris.

**Du texte de remplissage.** Un paragraphe creux qui tient lieu de contenu est
pire qu'un champ marqué brouillon.

---

## Style

**Commits** en français, format conventionnel : `feat:`, `fix:`, `docs:`,
`style:`, `refactor:`, `test:`, `chore:`. Sujet à l'impératif, moins de
72 caractères. Corps de message quand le pourquoi n'est pas évident.

**Code des extraits** : commentaires et noms en anglais, dans les deux langages.
L'anglais est la version canonique du site.

**Code du site** : commentaires en français.

---

## Licences

En contribuant, vous acceptez que votre contribution soit publiée sous les
licences du projet : MIT pour le code, CC BY 4.0 pour le contenu. Voir
[`LICENSE`](LICENSE) et [`LICENSE-CONTENT`](LICENSE-CONTENT).
