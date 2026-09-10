# Charte d'illustration

Contrat pour les douze illustrations et les quatre pictogrammes du site (CDC 8.6).

---

## Le principe, avant la technique

**Cherche l'idée avant la forme.**

Chaque illustration de famille exprime le **verbe** de sa famille, concrètement. « Chercher »
n'est pas une loupe : une loupe ne dit rien de ce que chercher veut dire. C'est une idée de
tri dans une masse, de quelques éléments retenus parmi beaucoup.

Un symbole de banque d'images est un aveu qu'on n'a pas réfléchi. Loupe, ampoule, engrenage,
cerveau, nuage, robot : refusés d'office.

Avant de dessiner, écris en une phrase ce que le verbe fait vraiment. Puis dessine cette
phrase.

---

## Contraintes techniques

| Contrainte | Valeur |
|---|---|
| Format | SVG écrit à la main, pas d'export d'éditeur |
| `viewBox` des familles | `0 0 400 400`, carré |
| Grille de construction | multiples de 8, entre 16 et 384 |
| Épaisseur de trait | `16` sur les formes principales, `8` sur les détails, jamais autre chose |
| Terminaisons | `stroke-linecap="square"`, `stroke-linejoin="round"` |
| Poids maximal | 8 Ko par fichier, après optimisation |
| Accessibilité | `role="img"` et un `<title>` |

**Interdits** : dégradés, trames, filtres, flous, ombres, opacité partielle, détails fins,
texte, tracés à plus de dix segments, coordonnées à plus d'une décimale.

Lisible à 80 px comme à 400 px. Si une forme disparaît à 80 px, elle est trop petite.

---

## Palette

Exclusivement ces valeurs, écrites en dur dans le SVG :

| Rôle | Valeur | Emploi |
|---|---|---|
| Encre | `#16130E` | traits principaux, aplats sombres |
| Marque | `#FFCE00` | un aplat par illustration, jamais plus |
| Papier | `#FFFDF7` | fond, réserves |
| Papier secondaire | `#F4EFE2` | second plan |
| Accent chaud | un seul de `#EDE7D7`, `#C8BC9E`, `#8A7C5C`, `#4C4432` | choisi par famille |

**Quatre couleurs maximum par illustration**, accent compris. Le jaune ne porte jamais de
trait fin : il sert en aplat, sous ou derrière l'encre.

Le fond de l'illustration est **transparent**, jamais un rectangle plein : la page fournit
son propre fond, qui change en mode sombre.

**Conséquence importante pour le mode sombre** : l'encre `#16130E` sur un fond sombre
disparaîtrait. Les traits principaux emploient donc `currentColor`, que la page définit
selon le thème. Seuls les aplats de marque et l'accent sont en dur.

---

## Structure d'un fichier

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img"
     fill="none" stroke="currentColor" stroke-width="16"
     stroke-linecap="square" stroke-linejoin="round">
  <title>Détecter et filtrer</title>
  <!-- L'idée : ce qui passe, ce qui ne passe pas. -->
  <rect x="64" y="64" width="272" height="80" fill="#FFCE00" stroke="none"/>
  <path d="M64 200h272"/>
</svg>
```

Le `<title>` porte le nom de la famille en français. Le composant qui inclut le fichier le
remplace par le titre localisé au rendu : un SVG ne peut pas porter deux titres, et
dupliquer le fichier par langue coûterait le double du budget pour un mot de différence.

---

## Ce qui fait tenir la série

Douze illustrations produites séparément ne forment pas une série. Ce qui les tient :

1. **La même épaisseur de trait partout.** C'est le premier signe qu'on voit.
2. **La même densité.** Entre trois et sept formes par illustration. Pas deux, pas quinze.
3. **Le même vocabulaire de formes** : rectangle, cercle, ligne droite, arc de cercle,
   triangle. Rien d'autre. Aucune courbe libre.
4. **Un seul aplat de marque par illustration**, de taille comparable d'une image à l'autre.
5. **La même marge** : rien ne touche le bord du `viewBox`, tout tient entre 32 et 368.

---

## Ce qui est interdit par ailleurs

Ne reprends aucune illustration existante, ne t'inspire d'aucune œuvre identifiable, ne
reproduis aucun style de marque existante (CDC, interdit 8). Le style décrit ici est
suffisamment contraint pour qu'on n'ait pas besoin d'aller chercher ailleurs.
