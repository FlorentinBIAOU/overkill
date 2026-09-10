# Outillage de vérification

Les contrôles du dépôt, ce qu'ils vérifient, et pourquoi ils existent.

## Contrôles du système de design

| Commande | Vérifie |
|---|---|
| `npm run check:fonts` | le poids total des polices, budget de 90 Ko (CDC 12) |
| `npm run check:contrast` | tous les couples texte-fond atteignent AA (CDC 8.3, 8.7) |
| `npm run check:colour` | les règles d'emploi de la couleur (CDC 8.3, interdit 4) |

`check-contrast` lit les valeurs dans `src/styles/tokens.css` plutôt que de les recopier :
le contrôle suit la source unique, il ne la duplique pas.

`check-colour-usage` refuse toute couleur écrite en dur hors de `tokens.css`, interdit au
jaune de marque d'être une couleur de texte, réserve le vert au badge « recommandé », et
signale toute cohabitation entre la rampe des barreaux et un nom de classe évoquant un
jugement de valeur.

## Contrôle orthographique du français

Le site est bilingue et l'une de ses deux langues est le français. Un texte français sans
accents est une faute, dans le contenu comme dans les commentaires du code.

```bash
npm run check:french          # signale les mots hors dictionnaire
npm run fix:accents           # corrige les accents manquants sans ambiguïté
```

Le contrôle s'appuie sur le dictionnaire `hunspell-fr-classical` et sur `spylls`. Il ne
relit que la prose : le texte des documents Markdown, et les commentaires des fichiers de
code. Le code lui-même est masqué.

Le masquage conserve les positions des caractères, si bien que `fix-accents` corrige un mot
à sa position exacte. Un identifiant de code qui s'écrirait comme un mot français mal
accentué n'est jamais touché. Les mots dont plusieurs accentuations existent, comme
`regles` qui peut donner `règles` ou `réglés`, sont signalés et jamais corrigés d'office.

Les termes techniques légitimes vivent dans `scripts/lexique-projet.txt`.

### Installer les prérequis

```bash
sudo apt install hunspell-fr-classical
python3 -m venv .venv-tools && .venv-tools/bin/pip install spylls fonttools[woff] brotli
```

Si l'un des deux manque, le contrôle passe en affichant la raison plutôt que de bloquer.
En intégration continue, ils sont installés et le contrôle est bloquant.

## Polices

```bash
npm run fonts                 # regénère les woff2 sous-ensemblés
```

À lancer seulement quand une police change de version. Le résultat est commité.

## Rendu

```bash
node scripts/shot.mjs /dev/tokens 360 dark sortie.png
```

Sert la sortie de `dist/` et capture une page, pour vérifier un rendu de ses propres yeux
plutôt que sur la foi du build.
