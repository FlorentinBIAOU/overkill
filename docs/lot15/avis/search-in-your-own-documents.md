# search-in-your-own-documents — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs search-in-your-own-documents` : vert, 4 py, 4 js.

### Raisons du refus

1. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs (`xfail(strict=True)` en Python, `assert.rejects` en JavaScript). La charte des tests et la mission sont nettes : une fiche publiée n'en garde aucun à la fin du lot. Un marquage strict passe dès que le corps du test lève, **pour n'importe quelle raison** : un marquage oublié ne prouve plus rien et peut masquer une régression.

   - `n3.test.py` / `n3.test.js`, `DÉFAUT` : du texte après la clôture, ou une
     clôture non refermée, est décodé. **Vivant**, et vérifié : `_decode`
     rend l'objet pour « ```json {…} ``` suivi de prose », et pour une clôture
     jamais refermée. C'est contraire à la décision 12 du lot reprise par la
     charte des tests (« tout autre écart […] lève »). Le compte rendu du tri
     l'avait signalé comme « à trancher au tour suivant » : c'est ce tour.
   - `n2.test.js`, `DÉFAUT` : un vecteur refusé empoisonne le cache d'un
     encodeur déjà servi. **Vivant**, et c'est un vrai défaut d'exploitation :
     `vectorRanking` écrit le vecteur dans la `Map` avant de le vérifier ; un
     seul `NaN` passager rend la page définitivement introuvable et fait lever
     **toutes** les recherches qui la contiennent, jusqu'au redémarrage du
     processus. Python n'a pas le défaut : les deux langages divergent.

   Ce qu'il faut faire : `_decode` en N3 recopie la forme stricte des extraits
   corrigés (une seule clôture qui enveloppe toute la réponse, sinon lever) ;
   `n2.js` ne met en cache un vecteur qu'après l'avoir validé. Démarquer les
   trois tests. C'est fait quand le dossier ne contient plus aucun marquage.

### Remarques non bloquantes

- **La morphologie est un réglage de N0 chez PostgreSQL, pas un chantier de
  N1.** Le `scenario` nomme PostgreSQL ; `to_tsvector('french', …)` y
  désuffixe avec Snowball et retire les mots vides, de sorte que « congé »
  trouve « congés » sans une ligne de règle. L'`escalate_when` de N1 (« vous
  vous mettez à écrire des règles de désuffixation […] langue par langue »)
  laisse croire que c'est inévitable. Une phrase — « avec PostgreSQL, une
  configuration de langue le fait ; avec FTS5, le tokenizer `porter` ne vaut
  que pour l'anglais » — rendrait le conseil exact pour les deux bases que la
  fiche cite. À vérifier sur la documentation de chacune avant de l'écrire.
- **Le ET implicite est un choix, pas une fatalité.** La pratique courante est
  d'essayer d'abord tous les termes, puis de retomber sur n'importe lequel
  quand la première requête ne rend rien. Le `breaking_point` le présente
  comme un aggravant subi ; le dire comme un réglage aiderait le lecteur.
- **Recherche à la frappe.** FTS5 accepte les requêtes par préfixe
  (`"cong"*`) ; un lecteur qui branche N0 sur une barre de recherche le
  cherchera. Une ligne dans la docstring.
- `breaking_point` de N2 : le point est juste et important (le cosinus a
  toujours une réponse, « aucun résultat » disparaît, et le score fusionné ne
  porte pas de seuil), mais il fait cinq phrases. Garder la première et la
  dernière.
- N1 n'est pas une montée en capacité — la fiche le dit elle-même, et le
  verdict dit quand le prendre (changer le tokenizer ou la règle
  d'appariement). C'est honnête ; la position de ce niveau dans l'échelle reste
  étrange pour qui lit l'échelle comme une progression. Rien à changer si la
  méthodologie du site assume qu'un niveau puisse être un pas de côté.

### Ce qui est solide

- **Le cas est réel, et c'est l'un des plus utiles du catalogue.** Une base
  vectorielle montée pour quelques centaines de pages avant d'avoir allumé
  l'index plein texte de la base existante : on le voit dans toutes les
  équipes. Le `scenario` dit exactement comment trancher — le journal des
  requêtes sans résultat.
- **Le verdict tient sur des arguments d'exploitation**, pas de préférence :
  l'index vit dans la même transaction que le document, se sauvegarde avec lui,
  n'ajoute aucun service ; et surtout, il sait dire « rien », ce que N2 perd.
- **Le code tient en production.** Les termes de l'utilisateur sont mis entre
  guillemets avant `MATCH` (pas d'erreur de syntaxe ni d'opérateur injecté), le
  signe de `bm25()` est expliqué, `LIMIT -1` est refusé, la requête vide rend
  une liste vide au lieu d'une erreur FTS5, et le reste d'élision d'une lettre
  est retiré pour ne pas vider les résultats. Chacun de ces pièges est réel.
- **Les points de rupture sont démontrés avec leurs exemples et sont exacts**,
  y compris N3 : le contrôle d'ancrage lit les citations, pas la réponse, et la
  fiche le montre sur une contradiction chiffrée plutôt que d'affirmer que
  « le modèle peut halluciner ».
- La fusion par rangs réciproques est sourcée sur l'article d'origine.
