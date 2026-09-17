# rank-products-by-relevance — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs rank-products-by-relevance` : vert, 2 py, 2 js.

### Raisons du refus

1. **[pertinence technique]** `n1.py` / `n1.js`, `pairs`. Chaque produit cliqué
   est apparié à **chaque** produit non cliqué de la page, y compris ceux
   affichés sous le clic, que l'acheteur n'a peut-être jamais vus. La
   docstring justifie la méthode par « shown these two side by side, a shopper
   took that one » ; c'est faux pour un produit en vingtième position sous un
   clic en deuxième. C'est le biais de position, et l'article de Joachims que
   la fiche cite en `further_reading` (« Accurately Interpreting Clickthrough
   Data as Implicit Feedback ») le mesure précisément et en tire la stratégie
   « Click > Skip Above » : on n'apprend qu'à partir des produits **placés
   au-dessus** du clic et ignorés. Avec la méthode de l'extrait, le poids de
   popularité absorbe l'ordre qu'affichait le classement précédent : le modèle
   apprend à reproduire N0, ce qui est l'inverse de ce pour quoi on monte.

   Ce qu'il faut faire : journaliser la position de chaque produit dans
   `impressions`, et ne former une paire (cliqué, ignoré) que si l'ignoré était
   affiché au-dessus du cliqué. Ajouter un test, deux langages, où un produit
   ignoré sous le clic ne produit aucune paire et où un produit ignoré au-dessus
   en produit une. Corriger la docstring. Si le rédacteur préfère garder
   l'appariement complet, la fiche doit dire le biais dans le `breaking_point`
   de N1, avec un test qui le montre (un journal où l'on clique toujours en
   première position apprend la popularité du classement précédent), et
   citer l'article pour ce qu'il dit réellement.

2. **[pertinence technique]** `n0.py` / `n0.js`, `signals` : une marge ou une
   popularité hors de [0, 1] lève `ValueError`, et `rank` ne l'attrape pas. Un
   seul produit mal renseigné fait tomber **toute la page de catégorie**.
   Exécuté : un produit à marge `-0.05` — un déstockage vendu à perte, cas
   ordinaire en fin de saison — et `rank` lève pour les deux produits de la
   liste. Dans une fonction appelée sur chaque page de résultats, une donnée de
   gestion sale est une certitude, pas une hypothèse.

   Ce qu'il faut faire : décider et écrire la politique pour **un** produit
   invalide sans faire échouer les autres — le borner à [0, 1] (une marge
   négative devient 0) en le signalant dans les `signals` rendus, ou l'écarter
   du classement et le rendre à part. Test, deux langages : une liste de trois
   produits dont un à marge négative rend trois (ou deux) lignes, pas une
   exception. Le refus explicite peut rester pour les poids, qui viennent du
   code et pas des données.

### Remarques non bloquantes

- `text_match` compte la part des termes de la requête trouvés en début de mot.
  Sur une requête d'un seul mot, tous les produits qui le contiennent sont à
  1,0, et le classement se joue alors entièrement sur stock, marge et
  popularité. C'est un choix défendable pour un catalogue, mais le lecteur qui
  a un moteur de recherche (BM25 dans PostgreSQL, Elasticsearch, Meilisearch)
  devrait lire que ce signal textuel est à remplacer par le score du moteur,
  normalisé, et que la valeur de la fiche est dans l'arbitrage des quatre
  poids. Une phrase.
- `sources` : le règlement P2B est lié sur `legislation.gov.uk`, qui publie la
  version conservée en droit britannique. Pour un site français, le texte de
  référence est sur EUR-Lex.
- `escalate_when` de N1 (« on change ce qu'on montre ») : juste, mais le nom de
  la pratique aiderait le lecteur à chercher — exploration, interleaving, ou
  une petite part de trafic en ordre perturbé.

### Ce qui est solide

- Le `scenario` et le verdict tiennent le bon argument : un classement se
  réclame, et le livrable est un ordre explicable et rejouable. C'est ce que
  vivent réellement les équipes qui tiennent un catalogue.
- Le tri stable pour que deux chargements de page rendent le même ordre est un
  détail que seuls ceux qui ont traité des réclamations connaissent.
- Le `breaking_point` de N1 sur la colonne constante (poids appris
  exactement nul) est démontré et c'est une vraie leçon : le journal n'apprend
  que ce que le classement a fait varier.
- Le passage de la moyenne (N0) à la somme (N1) parce que les poids appris
  peuvent être négatifs est expliqué et testé : c'est le genre de bug qui
  inverse un classement en silence.
