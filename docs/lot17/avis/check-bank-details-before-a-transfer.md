# check-bank-details-before-a-transfer — avis du relecteur

## Tour 1 — REFUSÉE

Le cas est réel, l'approche est la bonne, le code tient. Le refus porte sur
trois chiffres publiés que le dépôt ne produit pas, et sur les tests qui
auraient dû les tenir et ne les tiennent pas.

### Raisons du refus

1. **Chiffre faux — « 0,6 % » dans `verdict_rationale` (fr et en) et dans la
   docstring de `n0.py:24`.** La mesure, rejouée telle quelle avec le
   générateur du test (`ibans_francais(500)`, graine 3, `stdnum.iban.is_valid`
   pour la clé ISO seule), donne **31 passages sur 6 882 essais, soit
   0,450 %**. Côté JavaScript, avec le générateur de `n0.test.js` (graine 3) :
   **32 sur 6 892, soit 0,464 %**. Les deux mesures sont déterministes, je les
   ai rejouées deux fois. Aucune des deux ne donne 0,6 %. Écrire 0,6 % surévalue
   d'un tiers le seul chiffre qui justifie d'écrire la clé RIB à la main
   plutôt que de s'en remettre à la bibliothèque. Corriger la phrase en
   « 0,45 % » (ou « moins d'un demi pour cent »), des deux côtés et dans la
   docstring anglaise.

2. **Chiffre faux — « les 6 887 cas mesurés » dans `verdict_rationale`.** Ni
   6 882 (Python) ni 6 892 (JavaScript). Le nombre publié n'est produit par
   aucune des deux suites ; il se trouve être exactement leur moyenne, ce qui
   suggère une addition faite à la main plutôt qu'un relevé. Publier le
   nombre du langage cité, ou écrire « près de sept mille », qui reste vrai
   quand la graine bouge.

3. **Chiffre faux — « Measured on five hundred generated French IBANs »,
   docstring `n0.py:22-25`.** Sur les trois mesures que la phrase rassemble,
   une seule porte sur cinq cents IBAN. Les « twenty thousand digit-for-digit
   slips » viennent de `test_point_de_rupture_temoin_...`, qui tourne sur
   **cent** IBAN (20 700 essais ; sur cinq cents il y en aurait 103 500), et
   les « two thousand adjacent transpositions » viennent de
   `test_aucune_transposition_...`, également sur **cent**. Écrire l'effectif
   de chaque mesure, ou ramener les trois tests au même effectif.

4. **Tests écrits pour passer, pas pour démontrer.**
   `n0.test.py:141` assert `0.002 < seule_iso / ensemble < 0.02` et
   `n0.test.py:140` assert `ensemble > 6_000` ; `n0.test.js:147-149` fait de
   même. Ces bornes laissent passer 0,2 % comme 2 % : la fiche pourrait
   annoncer n'importe quel taux dans une décade, le test resterait vert. C'est
   précisément ce que la charte des tests appelle un test décoratif. Les deux
   générateurs sont à graine fixe et leurs sorties sont reproductibles à
   l'unité près : l'assertion doit être exacte (`ensemble == 6_882`,
   `seule_iso == 31` côté Python, les valeurs jumelles côté JavaScript), avec
   la graine en commentaire. À défaut, retirer le chiffre précis de la fiche
   et n'y laisser qu'un ordre de grandeur — mais alors les deux se tiennent,
   et la démonstration de la règle R4 perd son chiffre.

5. **`test_la_cle_rib_est_celle_de_la_norme_bancaire_francaise` ne teste pas
   ce qu'il annonce.** `n0.test.py:155-157` : la « fausse clé RIB » est
   fabriquée en changeant les deux derniers chiffres de l'IBAN, ce qui casse
   d'abord la clé ISO ; l'assertion finale le reconnaît elle-même
   (`... is False or rapport["reason"].startswith("ISO 13616")`) et se
   satisfait donc du mauvais chemin. Un cas qui passe la clé ISO et échoue à
   la seule clé RIB existe et se construit en trois lignes — j'en ai vérifié
   un : `FR0630006000011234567890188` rend bien
   `national_key: false`, `reason: "the French RIB key inside the account
   number does not match"`. C'est celui-là qu'il faut affirmer, sans `or`.

### Remarques non bloquantes

1. **Monaco porte la même clé RIB, et la fiche le sait à moitié.**
   `MC58 1122 2000 0101 2345 6789 030` est dans la liste des entrées banales
   du test, et `national_key_ok` rend `None` pour elle. J'ai vérifié : la
   partie nationale monégasque est de vingt-trois caractères et satisfait le
   même modulo 97 (`MC5811222000010123456789030` et
   `MC1112739000700011111000H79` donnent toutes deux 0). Le rapport déclare
   son ignorance, donc rien n'est faux ; mais un caractère de plus dans le
   test `country != "FR"` rendrait à un IBAN monégasque le contrôle que la
   fiche promet aux IBAN français.

2. **Le choix de ne pas appeler la clé nationale des bibliothèques est le bon,
   et il est sous-documenté.** J'ai vérifié les deux : `python-stdnum` 2.2
   n'a pas de module `stdnum/fr/iban.py` — donc `iban.is_valid` ne contrôle
   que l'ISO et le format du registre — tandis qu'`ibantools` refuse bien
   `FR0630006000011234567890188`, c'est-à-dire qu'il porte la clé RIB. La
   docstring dit « the two libraries do not cover the same countries » ;
   nommer les deux comportements constatés vaudrait mieux qu'une généralité,
   et c'est la preuve directe que l'écrire soi-même était nécessaire à la
   parité.

3. **R11 — `breaking_point` de 70 mots, deux phrases.** Voir la synthèse.

### Ce qui est solide

- Le point de rupture est le bon et il est exactement le bon : deux comptes du
  même établissement qui passent tous les deux, c'est la forme réelle de la
  fraude au changement de RIB, pas un cas exotique. Le témoin — vingt mille
  fautes d'un chiffre, deux mille transpositions, aucune qui passe — est
  exhaustif.
- `expected_country` est la bonne idée de production : c'est la seule chose
  que du code peut encore voir de ce détournement, et la fiche le dit sans
  promettre plus.
- `country` rendu même sur un refus, et l'exemple brésilien : un IBAN
  parfaitement valide où aucun virement SEPA n'arrivera. C'est le genre de
  détail qu'on n'apprend qu'en exploitation.
- Le renvoi au règlement (UE) 2024/886 est daté, sourcé sur EUR-Lex, et rangé
  là où il faut : dans `escalate_when` et le `regulatory`, jamais présenté
  comme un niveau de l'échelle ni comme un conseil juridique.
- Le refus plutôt que le silence sur tout caractère non prévu, et l'absence
  d'exception sur toute entrée : les deux sont testés.
