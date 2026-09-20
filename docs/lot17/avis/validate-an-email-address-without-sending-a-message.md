# validate-an-email-address-without-sending-a-message — avis du relecteur

## Tour 1 — REFUSÉE

La thèse de la fiche est la bonne et elle est courageuse : écarter les deux
bibliothèques mûres, mesure à l'appui, pour transcrire la définition que le
navigateur du visiteur vient d'appliquer. J'ai vérifié la transcription
caractère par caractère contre la source vivante
(`html.spec.whatwg.org/multipage/input.html`) : elle est exacte, au `\/` près
que le littéral JavaScript du standard impose et que le code n'a pas à porter.
Les trois chiffres — trente-deux adresses, quatre désaccords, quatorze écarts —
sont assertés à l'unité dans le test, ce qui est exactement ce qu'il faut.

Le refus porte sur deux endroits où la fiche s'écarte de sa propre règle.

### Raisons du refus

1. **L'algorithme du standard est appliqué à moitié, et l'autre moitié est
   celle qui change le résultat.** `n0.py:63-66` et `n0.js:55-58` :
   « The HTML value sanitisation algorithm strips leading and trailing
   whitespace from an email field before the browser validates it ». Le texte
   complet du standard, pour `input type=email`, est : « Strip newlines from
   the value, **then** strip leading and trailing ASCII whitespace from the
   value » (je l'ai relu à la source, section *E-mail state*). Deux
   conséquences que j'ai reproduites dans les deux langages :

   - `"jean@ex\nemple.fr"` — un retour à la ligne **au milieu**, ce que produit
     une adresse collée depuis une signature ou un PDF coupé en deux lignes.
     Le navigateur retire le saut et valide. L'extrait rend
     `valid: false, reason: "does not match the HTML definition of an email
     address"`. C'est très exactement la faute que le `verdict_rationale`
     reproche à qui n'applique pas la même définition : « un serveur qui
     applique autre chose refuse ce que le champ a accepté ».
   - `"jean@exemple.fr\x0b"` — la tabulation verticale, qui **n'est pas** un
     *ASCII whitespace* au sens du standard. L'extrait la retire et rend
     `valid: true` ; le navigateur, lui, refuse. L'écart est dans l'autre
     sens, et la fiche le nomme aussi : « ou l'inverse ».

   Correctif : retirer les `U+000A` et `U+000D` partout dans la chaîne, puis
   ne raboter aux extrémités que les cinq blancs ASCII du standard
   (`\t \n \f \r` et l'espace), sans `\v`. Deux lignes dans chaque langage.
   Et citer l'algorithme en entier dans le commentaire, puisque c'est de lui
   que la fiche tire toute son autorité. On saura que c'est fait quand
   `check_email_syntax("jean@ex\nemple.fr")["valid"]` sera vrai, que
   `check_email_syntax("jean@exemple.fr\x0b")["valid"]` sera faux, et que les
   deux cas seront dans le test de parité.

2. **L'essai interactif affirme une résolution DNS qu'il ne fait pas, et il le
   fait sur le cas vedette de la fiche.**
   `content/tryouts/live/validate-an-email-address-without-sending-a-message.js:19`
   : `routable: (domaine) => 'Normalisée en … Le domaine a un point : il se
   résout sur l'internet public.'` (et l'anglais, ligne 25 : « it resolves on
   the public internet »). Avoir un point n'est pas se résoudre. Sur le cas
   `jean.dupont@gmial.com`, que l'essai propose lui-même, la page affichera
   donc côte à côte « il se résout sur l'internet public » et le `why` qui dit
   « la syntaxe ne consulte rien ». C'est le point de rupture de la fiche
   contredit par son propre essai, à deux centimètres de distance. Le
   commentaire du code, lui, est juste — « A domain with no dot is a host name
   on the local network » — et c'est ce registre qu'il faut : écrire « Le
   domaine porte un point : rien ici ne dit qu'il existe, seulement qu'il n'est
   pas un nom d'hôte local ». La charte des tests met les libellés et les
   `why` d'un essai dans le périmètre des affirmations à démontrer (§ Le
   périmètre, point 4) ; celui-ci n'est démontré par rien et il est faux.

### Remarques non bloquantes

1. **Rien ne tient la transcription dans le temps.** Toute la fiche repose sur
   « transcribed character for character », et aucun test ne compare `WHATWG`
   à la chaîne publiée. Trois lignes suffisent : garder la source du standard
   en constante dans le test et asserter l'égalité avec `WHATWG.pattern` /
   `WHATWG.source`. Le jour où quelqu'un « améliore » l'expression régulière,
   le test tombe — ce qui est tout l'intérêt.

2. **`routable` est vrai pour `jean@1.2.3.4`.** Un domaine en quatre nombres
   séparés par des points passe la définition HTML et ressort routable. Rien
   n'est faux — c'est bien ce que la règle « au moins un point » dit —, mais
   le rapport gagnerait à ne pas promettre plus qu'un test de point.

3. **R11 — `breaking_point` de 57 mots**, le plus court du lot, deux phrases,
   un exemple, trois témoins. C'est le modèle à suivre ; voir la synthèse.

### Ce qui est solide

- Écarter deux bibliothèques mûres est la décision la plus risquée du lot, et
  c'est la mieux étayée : quatre désaccords entre elles, quatorze avec la
  définition du navigateur, sur trente-deux adresses, et les trois nombres sont
  assertés à l'égalité stricte dans le test. C'est ainsi qu'on fait — la fiche
  `check-bank-details-before-a-transfer` publie ses chiffres avec des bornes
  qui les laisseraient varier du simple au décuple.
- Le cas de la partie locale de soixante-cinq caractères est le bon argument :
  `email-validator` l'accepte, la RFC 5321 la plafonne à soixante-quatre, donc
  la longueur est contrôlée ici plutôt que déléguée. Vérifié.
- Ne pas mettre la partie locale en minuscules, et le dire : c'est le genre de
  réécriture silencieuse que R2 vise, et la fiche la refuse explicitement.
- `routable` séparé de `valid` : deux questions distinctes, deux champs, aucune
  confusion. `jean@localhost` est valide et inatteignable, et la fiche le dit.
- L'`escalate_when` est un événement observable, daté et vérifiable — un
  utilisateur qui signale `jéan@exemple.fr` refusée —, avec la RFC 6531 comme
  suite. C'est le meilleur `escalate_when` des quatre premières fiches.
