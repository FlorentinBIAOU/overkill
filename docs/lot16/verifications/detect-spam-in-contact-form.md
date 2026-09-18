# detect-spam-in-contact-form — vérification du lot 16

Avis d'origine : `docs/lot15/avis/detect-spam-in-contact-form.md` (REFUSÉE).

## Motif 1 — un contrôle de sécurité dont la mise en œuvre naïve ne contrôle rien

**Le refus.** `reasons(fields, seconds_on_page)` recevait le délai en argument,
et rien — ni la docstring, ni la fiche, ni l'essai — ne disait d'où il venait.
La mise en œuvre que le lecteur écrit spontanément, un champ caché rempli en
JavaScript, est contournée par n'importe quel script, qui postera
`seconds_on_page=10`. La fiche présentait cela comme un des deux contrôles
« qui ne coûtent rien ».

**Ce qui a été fait.** Les quelques lignes que l'avis réclamait, dans les deux
langages, sans dépendance.

- **`issue_token(secret)` / `issueToken(secret)`** rend `<secondes>.<signature>`,
  la signature étant un HMAC-SHA256 du timestamp avec un secret du serveur
  (`hmac` et `hashlib` en Python, `node:crypto` en JavaScript).
- **`seconds_on_page(token, secret)` / `secondsOnPage(token, secret)`** recalcule
  la signature, en comparaison à temps constant, et **rend zéro** quand le jeton
  n'est pas le sien. Zéro est la réponse sûre : `reasons` la lit comme
  « submitted too fast ».
- **Les docstrings disent le piège** : « a hidden field holding the time the page
  was rendered is a number the sender writes, and a script writes whatever it
  likes in it », puis ce que fait le serveur à la place, et renvoient au
  « spinner » de Ned Batchelder, qui signe aussi l'adresse du visiteur et
  l'identifiant de la page.
- **Le pot de miel est précisé au même endroit** : « hidden by the stylesheet —
  not with `type="hidden"`, which a script knows to skip ». C'est ce que dit la
  page citée, vérifiée à la source : « Bots understand hidden fields […]
  Invisible fields are ordinary editable fields that have been made invisible in
  the browser. »
- **Le `name` du niveau, le `scenario` et le `breaking_point` portent la
  correction**, dans les deux langues : « Pot de miel masqué en CSS, délai signé
  par le serveur… », et « Le délai ne vaut que ce que vaut sa signature ».
- **Le paramètre de `reasons` est renommé `seconds`**, et sa docstring dit d'où
  il doit venir : « not a number the form carried: this function trusts its
  caller, and the caller must not trust the sender ».

**La preuve.** `le délai est signé par le serveur, et un jeton trafiqué compte
comme trop rapide`, dans les deux langages : le vrai jeton rend bien trente
secondes, et **six formes de jeton trafiqué** rendent zéro et le motif
« submitted too fast » — horodatage reculé avec la signature gardée, signature
remplacée, signature absente, jeton vide, jeton inventé, signature amputée d'un
caractère. Plus : un secret qui n'est pas celui du serveur ne vaut pas mieux, un
jeton daté du futur ne donne pas un délai négatif, et, témoin, le vrai jeton lu
avec le vrai secret traverse le contrôle.

## Motif 2 — deux marquages et l'adaptateur N3

- **N1 (py, js), « les graphies contournées survivent aux n-grammes »** : périmé,
  la docstring dit désormais l'inverse. Devenu `un mot épelé ne partage aucun
  n-gramme avec le mot entier`, qui le démontre sur les ensembles de n-grammes
  eux-mêmes — l'analyseur de scikit-learn d'un côté, une fonction `ngrams`
  désormais exportée de l'autre — et ajoute le score : le mot épelé ne pèse pas
  plus qu'un mot neutre épelé. C'est la limite du niveau, dite comme telle.
- **`n1.test.js`, « un n-gramme que tout message porte says nothing »** : périmé.
  Devenu `un n-gramme que tout message porte pèse le moins, sans jamais peser
  zéro`, qui épingle le plancher de l'IDF lissé à 1 et montre qu'un terme rare
  pèse davantage.
- **Un `DÉFAUT` résiduel dans une docstring de `n1.test.py`** disait que
  JavaScript ne levait pas sur un entraînement dégénéré : c'est faux depuis le
  tour précédent. Les deux tests couvrent maintenant les mêmes trois cas.
- **L'adaptateur N3 est exercé** contre `_harness/fake_sdk.py` et
  `fake-sdk.mjs`, dans les deux langages (règle T2) : la requête complète
  (`chat.completions`, modèle, invite, température nulle), un `content` nul qui
  lève après trois appels, une panne retentée.

**La preuve.** `node scripts/test-snippets.mjs detect-spam-in-contact-form` :
**6 extraits, 3 py, 3 js, aucun échec** ; `check-marquages` et
`check-adaptateur` ne signalent plus cette fiche.

## Remarques non bloquantes de l'avis

- **Le volume d'étiquetage que N1 suppose** : dit dans le verdict, avec l'ordre
  de grandeur et la conséquence — « quelques centaines par classe, ce qu'un
  formulaire qui reçoit quelques dizaines de messages par mois mettra des années
  à réunir — en dessous de ce flux, N0 reste la réponse ».
- **Les défis anti-robots gérés et les services de filtrage** : nommés dans le
  verdict, avec les deux arguments qui les écartent ici — la sortie de données
  chez un tiers, et la friction imposée à chaque visiteur.
- **Le robot patient écrit par un modèle de langue** : gardé, l'avis le juge
  juste.

## État

**Levée.** `test-snippets` vert (6 extraits) ; `check-marquages` et
`check-adaptateur` ne signalent plus cette fiche ; `check-content`,
`check-figures`, `check-french` verts.
