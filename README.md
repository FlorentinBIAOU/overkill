# Overkill

**Avez-vous vraiment besoin d'IA pour ça ?**

Overkill est un catalogue de tâches courantes. Pour chacune, il montre toutes les options
connues, de la règle de quelques lignes à l'appel d'API de modèle généraliste, avec le code
qui tourne, les ordres de grandeur de coût et d'empreinte, les limites réelles de chaque
approche, et la condition précise qui justifie de passer à l'option supérieure.

**On recommande toujours l'option la plus frugale qui fait le travail.**

Overkill n'est pas anti-IA. Certaines fiches recommandent franchement un modèle généraliste,
et c'est ce qui rend crédibles celles qui recommandent l'inverse.

---

## Prérequis

| Outil | Version |
|---|---|
| Node | 22.23.2, épinglée dans `.nvmrc` (`nvm use`) |
| npm | 10 ou plus |
| Python | 3.13 ou plus, pour les tests des extraits |

## Installation

```bash
npm install

# Les extraits de code sont réellement exécutés : ils ont leurs dépendances.
python3 -m venv .venv-tools
.venv-tools/bin/pip install -r content/snippets/requirements-snippets.txt
```

Le contrôle orthographique du français, facultatif en local, demande en plus le
dictionnaire `hunspell-fr-classical` et `spylls`. S'ils manquent, le contrôle
passe en le disant plutôt que d'échouer.

## Construire le site

```bash
npm run build          # sortie statique dans dist/
npm run preview        # servir la sortie localement
npm run dev            # serveur de developpement
```

## Vérifier

Deux passes. La rapide avant chaque commit, la complète avant de pousser — et
c'est celle que lance l'intégration continue.

```bash
npm run check:fast     # une vingtaine de secondes, aucun navigateur
npm run check          # les deux passes, quatre minutes
```

| Passe | Ce qu'elle couvre |
|---|---|
| `check:fast` | schéma des fiches, suites unitaires, système de design, contraste, français, construction, liens, référencement, budgets de poids |
| `check:slow` | exécution des 148 extraits, contrôles dans un vrai navigateur, gabarits, accessibilité, débordements et cibles tactiles, composants interactifs, puis recherche et filtres sur deux cents fiches |

La chaîne est décrite une seule fois, dans `package.json`. `check:chain` refuse
qu'un contrôle reste orphelin : tout script `check:*` ou `test:*` doit figurer
dans l'une des deux passes, ou porter une exemption écrite avec sa raison.

Quelques contrôles individuels, pour travailler sur un sujet précis :

| Commande | Ce qu'elle vérifie |
|---|---|
| `npm run check:fonts` | budget de poids des polices, 90 Ko au total |
| `npm run check:contrast` | tous les couples texte-fond atteignent AA |
| `npm run check:colour` | règles d'emploi de la couleur, aucun token inexistant |
| `npm run check:overflow` | aucun débordement horizontal, aucune cible tactile sous 44 px |
| `npm run check:a11y` | axe sur les six gabarits, dans les deux langues et les deux thèmes |
| `npm run check:seo` | titres et descriptions uniques, canoniques, hreflang, données structurées |

## Pages de contrôle interne

Elles servent à vérifier le système de design et ne font pas partie du site.

```bash
npm run build:dev && npm run preview
```

| Page | Contenu |
|---|---|
| `/dev/tokens` | les couleurs, l'échelle typographique, les espacements, les rayons, le focus |

## Polices

Les trois familles sont auto-hébergées, sous-ensemblées au latin utile au français et à
l'anglais, en woff2. Aucune ressource tierce n'est chargée à l'exécution.

Pour les régénérer après un changement de version :

```bash
npm run fonts
```

| Famille | Rôle | Licence |
|---|---|---|
| Bricolage Grotesque | titres, chiffres mis en avant, aplats | SIL Open Font License 1.1 |
| Inter | corps de texte, interface, tableaux | SIL Open Font License 1.1 |
| JetBrains Mono | blocs de code, valeurs techniques | SIL Open Font License 1.1 |

## Structure

```
content/     les fiches, les familles, le code des exemples, la feuille de route
src/         le site : composants, gabarits, pages, tokens, illustrations
scripts/     les controles automatiques
tests/       les tests du schema et des gabarits
docs/        le cahier des charges et les plans de lot
```

## Documentation

| Fichier | Contenu |
|---|---|
| `docs/CDC.md` | le cahier des charges, source de vérité |
| `docs/sprints/PLAN.md` | le découpage en lots et l'ordre d'exécution |
| `docs/sprints/JOURNAL.md` | l'avancement réel, les décisions, les écarts |
| `RAPPORT.md` | le bilan de fin de mission |

## Déployer

Le site est statique. N'importe quel hébergeur de fichiers convient ;
`isitoverkill.dev` est servi par Vercel, comme l'indiquent les mentions
légales. Le dépôt ne porte aucun fichier de configuration d'hébergement :
la configuration Cloudflare a été retirée avec le changement d'hébergeur.

| Réglage | Valeur |
|---|---|
| Commande de construction | `npm run build` |
| Répertoire de sortie | `dist` |
| Version de Node | 22.12 ou plus |
| Variables d'environnement | aucune |

Deux conséquences de ce retrait, à connaître :

- **La racine `/` ne négocie plus la langue côté serveur.** Elle sert la page
  de repli bilingue, qui fonctionne sans JavaScript et bascule vers l'anglais,
  version canonique. C'est le comportement décrit au lot 10 comme repli ; il
  est devenu le comportement normal.
- **Aucun en-tête de sécurité n'est posé par le dépôt.** La politique de
  sécurité du contenu vivait dans le fichier `_headers` de Cloudflare. Ce que
  la page confidentialité affirme reste vérifié à la construction par
  `check-third-party`, qui échoue si une seule requête part vers un autre
  domaine ; mais plus rien ne le rend opposable à l'exécution. Reposer ces
  en-têtes relève de la configuration de l'hébergeur.

Pour mémoire, ce que la politique retirée garantissait : aucune ressource tierce
n'est chargée à l'exécution. C'est toujours vrai du site produit, et
`check-third-party` le vérifie page par page dans un vrai navigateur.

Le nom de domaine, le statut juridique de l'éditeur et l'hébergeur sont
désormais arrêtés et écrits sur la page des mentions légales, qui ne comporte
plus de mention provisoire.

## Licences

Le code est sous licence MIT. Le contenu des fiches est sous licence CC BY 4.0.
