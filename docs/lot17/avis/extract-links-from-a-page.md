# extract-links-from-a-page — avis du relecteur

## Tour 1 — ACCEPTÉE

Une fiche qui devait être banale et qui ne l'est pas, pour une raison mesurée :
la bibliothèque standard de Python n'est pas la norme du web. Le choix
d'aligner l'extrait Python sur la réponse du navigateur plutôt que sur la
RFC 3986 est le bon, parce que la question posée est « où le lecteur
atterrit-il », et il est assumé par écrit.

J'ai passé aux deux extraits une page portant un `<base href>`, un lien
relatif, un chemin racine avec une espace, un `../`, un double antislash, un
protocole implicite, un `mailto:`, un `javascript:`, un href vide, une ancre,
un hôte en majuscules avec port 443, un domaine accentué et une requête
accentuée. **Les deux rendent exactement le même rapport, au champ près**, et
chaque résolution est celle d'un navigateur : `\\chemin` mène à l'hôte
`chemin`, `https://éxemple.fr/café` devient
`https://xn--xemple-9ua.fr/caf%C3%A9`, le port 443 disparaît, l'hôte passe en
minuscules, les espaces de bord sautent, et `javascript:` comme l'href vide
sont écartés avec leur raison.

J'ai aussi vérifié les divergences à la source, en appelant `urljoin`
directement :

| href | `urllib.parse.urljoin` | l'extrait (et le navigateur) |
|---|---|---|
| `\\chemin` | `…/blog/\\chemin` | `https://chemin/` |
| `  /espaces  ` | `…/espaces  ` | `…/espaces` |
| `https://EXEMPLE.FR:443/Page` | inchangé | `https://exemple.fr/Page` |
| `?q=café` | `…?q=café` | `…?q=caf%C3%A9` |
| `https://éxemple.fr/café` | inchangé | `https://xn--xemple-9ua.fr/caf%C3%A9` |

La mesure qui porte la fiche est donc vraie.

### Remarques non bloquantes

1. **Le nombre publié — sept divergences sur trente-huit — n'est tenu par
   aucun test.** `test_verdict_un_antislash_ne_va_pas_ou_on_croit` et
   `test_verdict_les_six_autres_divergences_mesurees_sont_fermees` affirment
   les **réponses de l'extrait**, jamais celles d'`urljoin` : le lecteur du
   test voit la résolution, pas la divergence. Or c'est la divergence qui
   justifie toute la fiche. Trois lignes suffisent — appeler `urljoin` sur les
   trente-huit adresses, compter les écarts, asserter `== 7` —, et le jour où
   une version de Python rapproche `urljoin` de la norme, le test le dira au
   lieu de laisser la fiche affirmer un chiffre périmé.

2. **Le commentaire d'`ADRESSES` dit « vingt et un cas », la liste en porte
   trente-huit.** `n0.test.py:30`. La fiche, elle, dit trente-huit, qui est le
   bon nombre. Commentaire à mettre à jour.

3. **R11 — `breaking_point` de 110 mots et trois phrases.** C'est le troisième
   plus long du lot. Le contenu est juste — une base fausse rend des adresses
   valides et fausses, et la cause ordinaire est une redirection — mais la
   deuxième phrase, qui explique le cas de la redirection, tient dans
   l'`escalate_when` ou la docstring. Voir la synthèse.

4. **La base relative reste ouverte, et le rapport de lot le dit.** Un
   `<base href="../">` n'est pas traité comme un navigateur le traiterait.
   Le cas est rare et le rapport le nomme dans « ce qui reste ouvert » ; à
   défaut de le traiter, une phrase dans la docstring fermerait la question
   pour le lecteur qui ne lit pas les rapports de lot.

### Ce qui est solide

- La décision de porter l'extrait Python à la norme WHATWG plutôt qu'à la RFC,
  avec la raison — c'est celle des navigateurs, et la question est où le
  lecteur atterrit — est une décision d'architecture, pas un rattrapage, et
  elle est écrite noir sur blanc dans le verdict.
- L'antislash est le meilleur exemple du lot : `href="\\chemin"` mène à un
  chemin de votre site sous une norme et à l'hôte `chemin` sous l'autre. Le
  test porte en plus le cas de l'antislash simple et le témoin à barre
  oblique.
- La base exigée, rendue dans le rapport, et remplacée par `<base href>` quand
  la page en porte un : les trois font un tout cohérent, et le point de rupture
  porte exactement sur ce que le code ne peut pas vérifier.
- Ce qui n'est pas une adresse — `javascript:`, href vide — est écarté **avec
  sa raison** dans un champ séparé, pas rendu comme un lien ni tu. C'est la
  règle « ce qui n'est pas lu est nommé », appliquée sans qu'on la demande.
- L'`escalate_when` ne propose pas un meilleur analyseur mais un navigateur
  sans affichage : la sortie de l'échelle est honnête.
- Le `regulatory` précise « aucune adresse n'est visitée », ce qui est la
  différence pertinente ici, et il répète le rappel sur les conditions
  d'utilisation sans donner de conseil juridique.
