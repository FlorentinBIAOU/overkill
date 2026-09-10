# Pourquoi la recherche n'emploie pas Pagefind

La section 9.1 du cahier des charges demande un index construit au build et exécuté côté
client, « Pagefind ou équivalent ». La section 10.1 nomme Pagefind. La section 12 fixe un
budget de **25 Ko de JavaScript sur le catalogue, index de recherche exclu**.

Ces deux exigences ne sont pas compatibles. Voici la mesure.

## Ce que pèse Pagefind

Pagefind 1.5.2, index construit sur une page d'exemple, poids transféré après compression :

| Fichier | Rôle | Transféré |
|---|---|---|
| `wasm.fr.pagefind` | moteur de recherche, WebAssembly | 72,3 Ko |
| `pagefind.js` | interface de programmation | 12,8 Ko |
| `pagefind-worker.js` | fil d'exécution de recherche | 11,9 Ko |
| **Total du moteur** | | **97,0 Ko** |

L'index proprement dit, c'est-à-dire les fichiers `.pf_index` et `.pf_fragment`, ne pèse
que quelques centaines d'octets sur cet exemple et croît avec le contenu. Il est exclu du
budget par le cahier des charges.

Le moteur, lui, ne l'est pas. Même en écartant le WebAssembly de la mesure, ce qui serait
généreux puisqu'il s'agit de code exécutable et non de données, `pagefind.js` et son fil
d'exécution totalisent **24,7 Ko**, soit le budget entier, avant d'avoir écrit une ligne de
filtre.

## Ce qu'on fait à la place

Un index construit au build et une recherche écrite à la main, soit l'« équivalent »
qu'autorise explicitement la section 9.1.

| | Pagefind | L'équivalent retenu |
|---|---|---|
| Moteur, transféré | 97,0 Ko | mesuré en fin de projet, voir `RAPPORT.md` |
| Index construit au build | oui | oui |
| Exécution côté client, sans serveur | oui | oui |
| Insensible aux accents et à la casse | oui | oui |
| Tolérance aux fautes légères | oui | oui, distance d'édition de 1 sur les mots longs |
| Cloisonnement par langue | par configuration | un index par langue |

## Pourquoi c'est cohérent

Overkill soutient qu'on doit choisir l'option la plus frugale qui fait le travail, et que le
réflexe d'attraper l'outil le plus puissant coûte cher sans qu'on le calcule au moment de la
décision.

Un site qui défend cette thèse et qui embarque cent kilooctets de moteur de recherche pour
deux cents fiches se contredit à sa propre page d'accueil.

Le budget de la section 12 n'est pas négociable ; le choix de bibliothèque de la section
10.1 est assorti d'un « ou équivalent » en section 9.1. C'est donc la bibliothèque qui cède.

Cet écart est signalé dans `RAPPORT.md`.
