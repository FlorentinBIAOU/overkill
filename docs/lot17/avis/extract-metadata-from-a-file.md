# extract-metadata-from-a-file — avis du relecteur

## Tour 1 — REFUSÉE

La fiche a une idée forte et elle la tient presque partout : ce qui compte
n'est pas la lecture, qui est un décompactage, mais ce que la lecture révèle —
un contrat envoyé à un client porte le nom de tous ceux qui y ont touché. Et
la règle qui en découle, « les parties non lues sont **nommées** », est la
meilleure trouvaille du lot : un document dont les auteurs sont dans ses
commentaires ne doit pas répondre « aucun auteur ».

Le refus porte sur les deux endroits où cette règle n'est pas appliquée à
elle-même.

### Raisons du refus

1. **Une partie de métadonnées illisible rend « aucune métadonnée », en
   silence.** `n0.py:77-78` : `except ElementTree.ParseError: continue`, avec
   le commentaire « a part we cannot read is a part we do not claim ». Le
   commentaire est juste, le rapport ne le dit pas. Mesuré dans les deux
   langages, sur un `docProps/core.xml` tronqué :

   ```
   {"format": "ooxml", "fields": {}, "other_parts": [], "reason": null}
   ```

   Rien ne distingue ce rapport de celui d'un document qui ne déclare
   réellement aucun auteur. C'est exactement la situation que la fiche dit
   vouloir éviter, et elle la produit sur la partie centrale. Le cas n'est pas
   théorique : un `core.xml` hostile — une bombe d'entités de six cents
   octets — passe par le même chemin (l'analyseur de Python 3.13 lève, le code
   avale), et un fichier abîmé en transit aussi.

2. **Même chose pour une partie écartée par le plafond.** `n0.py:71` :
   `if part not in names or archive.getinfo(part).file_size > MAX_PART_BYTES:
   continue`. Un `docProps/core.xml` de plus de quatre mégaoctets — une valeur
   anormale, donc précisément celle qui devrait remonter — disparaît sans
   trace. Le plafond est bien vu et bien commenté (« a ZIP entry can promise a
   hundred megabytes in a kilobyte ») ; c'est son effet qui n'est pas dit.

   Correctif commun aux deux points : nommer. Ajouter la partie à
   `other_parts`, ou un champ `unread_parts` avec la raison — `malformed`,
   `over the cap` —, ce qui est la même mécanique que celle déjà écrite pour
   `comments.xml` et `settings.xml`. On saura que c'est fait quand le document
   au `core.xml` tronqué rendra `docProps/core.xml` parmi les parties non
   lues, et quand le test contiendra les deux cas.

### Remarques non bloquantes

1. **`OTHER_PARTS` cherche des sous-chaînes.** `any(mark in name …)` avec
   `"settings"` attrape aussi `word/webSettings.xml`, ce qui est plutôt
   souhaitable, mais attraperait également un fichier utilisateur nommé
   `media/settings-du-client.png`. Les noms des parties sont fixés par
   ECMA-376 : une liste de noms exacts, ou un préfixe `word/`, serait plus sûr
   et coûterait autant.

2. **`TotalTime` est rendu en minutes et nommé `editing_minutes`,** avec le
   commentaire qui dit que c'est la définition d'OOXML et non un calcul du
   code. C'est exactement la bonne prudence ; la même phrase manque pour
   `revision`, qui est un compteur d'enregistrements et que beaucoup lisent
   comme un numéro de version.

3. **Le périmètre est OOXML et la fiche dit « un fichier ».** Le titre et le
   `need` parlent d'un fichier ; le code répond `"a ZIP, but not an OOXML
   document"` sur un ODT, qui porte pourtant ses métadonnées dans `meta.xml`.
   La raison rendue est claire, donc rien n'est faux ; le `breaking_point`
   gagnerait à dire que le périmètre s'arrête à OOXML.

4. **R11 — `breaking_point` de 82 mots et trois phrases.** Voir la synthèse.

### Ce qui est solide

- La règle « ce qui n'est pas lu est nommé » est la meilleure idée du lot, et
  le point de rupture la démontre exactement comme il faut : le même contrat
  avec ses commentaires rend les mêmes champs, `word/comments.xml` est nommé,
  et le témoin — le document sans ces parties rend une liste vide — donne au
  silence un sens.
- L'écart entre les deux analyseurs XML, trouvé et fermé : `fast-xml-parser`
  ne décode pas `&#232;` sans son option `htmlEntities`, et le même fichier
  rendait deux auteurs différents. J'ai vérifié : les deux extraits rendent
  aujourd'hui `Jean Dupès`. C'est le type de défaut que seul un test de parité
  trouve, et la fiche le dit au lieu de le taire.
- Le plafond par partie, et le fait que seules deux entrées du ZIP soient
  décompressées : c'est la bonne défense contre une archive qui promet plus
  qu'elle ne pèse, et elle est motivée par écrit.
- Le choix de la bibliothèque standard côté Python et de deux paquets sans
  dépendance côté JavaScript, dont l'un était déjà là : c'est la sobriété que
  le site prêche, appliquée au choix de dépendances.
- Le `regulatory` est le plus utile du catalogue : « ce que cette fiche fait
  lire est précisément ce qu'un document publié transmet sans qu'on le sache ».
  Il dit le risque réel sans donner de conseil juridique.
- L'`escalate_when` sort de l'échelle par le bon côté : retirer n'est pas lire,
  c'est un autre travail, et il commence par savoir quelles parties sont là.
