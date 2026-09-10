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
| Node | 22 ou plus |
| npm | 10 ou plus |
| Python | 3.13 ou plus, pour les tests des extraits |

## Installation

```bash
npm install
```

## Construire le site

```bash
npm run build          # sortie statique dans dist/
npm run preview        # servir la sortie localement
npm run dev            # serveur de developpement
```

## Vérifier

```bash
npm run check          # enchaine les controles, dans le meme ordre que la CI
```

Les contrôles individuels :

| Commande | Ce qu'elle vérifie |
|---|---|
| `npm run check:fonts` | budget de poids des polices, 90 Ko au total |
| `npm run check:contrast` | tous les couples texte-fond atteignent AA |
| `npm run check:colour` | règles d'emploi de la couleur, aucune valeur en dur |

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

Le site est statique. N'importe quel hébergeur de fichiers convient ; la
configuration fournie vise Cloudflare Pages, comme le prévoit le cahier des
charges.

| Réglage | Valeur |
|---|---|
| Commande de construction | `npm run build` |
| Répertoire de sortie | `dist` |
| Version de Node | 22 |
| Variables d'environnement | aucune |

Deux fichiers sont servis tels quels depuis `public/` :

- `_redirects` — la racine négocie la langue sur l'en-tête `Accept-Language`,
  avec l'anglais par défaut, qui est la version canonique.
- `_headers` — politique de sécurité du contenu, en-têtes de cache immuables
  sur les polices et les ressources versionnées.

La politique de sécurité du contenu n'autorise que l'origine du site. Elle rend
opposable ce que la page confidentialité affirme : aucune ressource tierce
n'est chargée à l'exécution.

**Avant la première mise en ligne**, voir la section « ce qu'il reste à faire »
de [`RAPPORT.md`](RAPPORT.md) : le nom de domaine, le statut juridique de
l'éditeur et les coordonnées de l'hébergeur ne sont pas encore arrêtés, et les
pages concernées le disent au lieu de les inventer.

## Licences

Le code est sous licence MIT. Le contenu des fiches est sous licence CC BY 4.0.
