# generate-placeholder-images — avis du relecteur

## Tour 1 — ACCEPTÉE

`node scripts/test-snippets.mjs generate-placeholder-images` : vert, 1 py, 1 js.

### Remarques non bloquantes

- **Réalité du cas.** Le `scenario` oppose le hachage à « un appel à un
  générateur d'images, une image par fiche manquante ». Ça existe, mais le
  concurrent qu'on rencontre le plus souvent dans une maquette est un service
  de remplaçants distant (une URL d'image grise avec des dimensions) : appel
  réseau à chaque rendu, dépendance à un tiers qui peut disparaître ou pister
  les visiteurs. La fiche gagnerait une phrase sur ce cas, qui est celui que
  son lecteur a vraisemblablement déjà dans son code. Le verdict n'en serait
  que plus fort.
- **Accessibilité.** `aria-label` reçoit l'identifiant brut : un lecteur d'écran
  annoncera « sku-48213-b ». Pour une image provisoire, un libellé qui dit
  qu'elle l'est (« image à venir ») ou `aria-hidden` sur une vignette
  décorative sert mieux l'utilisateur. Le choix est défendable ; le dire dans
  la docstring éviterait qu'on le recopie sans y penser.
- **Garde sur `size`.** `placeholder_svg("x", size=3)` produit des cellules de
  largeur nulle, `size=-10` un SVG aux dimensions négatives. La taille vient du
  code appelant, pas de l'utilisateur, donc ce n'est pas un risque ; un
  `ValueError` en dessous de `GRID` coûterait une ligne et suivrait la charte
  des tests (valeurs aux limites).
- `stable_hash` hache des points de code et non des octets UTF-8, et la
  docstring le dit franchement (« different from [the reference] on any other
  character ») : c'est honnête, mais le mot « FNV-1a » dans le nom de l'approche
  laisse croire à la compatibilité avec une autre implémentation. Une demi-
  phrase dans le `name` ou la docstring d'en-tête suffit.

### Ce qui est solide

- Le verdict est juste et assumé : une seule marche, parce que le besoin est
  arbitraire, et la sortie de la fiche « ne se fait pas par le haut ». C'est
  exactement le genre de fiche qui justifie le site.
- Les raisons d'indisponibilité ne sont pas des postures : N1 (« rien à
  apprendre »), N2 (reproductibilité non garantie par PyTorch, sourcée), N3
  (retrait daté des modèles du fournisseur, sourcé sur sa page *Deprecations*).
  Chacune est un argument qu'on peut vérifier.
- Le code tient en production : arithmétique entière pour la parité entre
  langages, rejet des caractères interdits par XML 1.0 en plus de
  l'échappement, hachage non salé explicitement préféré au `hash` intégré —
  trois pièges réels, tous nommés et testés.
- Le point de rupture (« red velvet sofa » hors des rouges, sofa-1 et sofa-2
  éloignés) est démontré et c'est bien là, et seulement là, que l'approche
  cesse de servir.
- Le style est direct, sans remplissage, dans les deux langues.
