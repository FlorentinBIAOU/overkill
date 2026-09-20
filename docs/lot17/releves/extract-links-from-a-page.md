# extract-links-from-a-page — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « la même page rend « …/blog/article » ou « …/blog/2026/article » selon ce qu’on a déclaré » | démontrée | test_point_de_rupture_une_base_fausse_rend_des_adresses_valides_et_fausses |
| 2 | N0 breaking_point | « le témoin : la base employée est rendue, et `<base href>` la remplace » | démontrée | test_point_de_rupture_temoin_la_base_declaree_est_rendue_dans_le_rapport |
| 3 | verdict_rationale | « `href="\\chemin"` donne un chemin de votre site avec la RFC 3986 et l’hôte `chemin` avec la norme WHATWG » | démontrée | test_verdict_un_antislash_ne_va_pas_ou_on_croit |
| 4 | verdict_rationale | « les six autres divergences mesurées sont fermées » | démontrées une à une | test_verdict_les_six_autres_divergences_mesurees_sont_fermees |
| 5 | N0 docstring | « elle est exigée, pas devinée » — la base | démontrée | test_la_base_est_exigee |
| 6 | N0 docstring | ce qui n’est pas une adresse est écarté **avec sa raison** | démontrée | test_ce_qui_nest_pas_une_adresse_est_ecarte_avec_sa_raison |
| 7 | N0 — le rapport | chaque lien porte son genre, son texte et son `rel` | démontrées | test_chaque_lien_porte_son_genre, test_le_texte_du_lien_est_rendu…, test_le_rel_est_rendu_tel_quel |
| 8 | Les deux langages | rapport identique sur quarante-deux cas, dont les trente-huit adresses | démontrée | test_python_et_javascript_rendent_le_meme_rapport |
| 9 | N0 latency `~10 ms` | classe de latence | mesurée | voir ci-dessous |
| 10 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## La mesure de latence

Sur la machine de travail, pour une page de soixante liens (1 506 caractères) :
**1,42 ms en Python et 0,31 ms en JavaScript**. La classe affichée est
`~10 ms`, qui est celle d’une page de presse réelle, cent fois plus lourde en
balisage. Les tests ne gardent que des bornes d’effondrement : cinquante mille
liens en moins de soixante secondes.

## Le chiffre qui porte le verdict

**Sept divergences sur trente-huit adresses** entre `urllib.parse.urljoin` et
`new URL`, mesurées avant d’écrire une ligne de la fiche :

| Href | RFC 3986 (`urljoin`) | WHATWG (`new URL`) |
|---|---|---|
| `\\chemin` | `https://exemple.fr/blog/\\chemin` | `https://chemin/` |
| ` https://exemple.fr/espace ` | garde les espaces | les retire |
| `https://café.fr/page` | garde l’accent dans l’hôte | `xn--caf-dma.fr` |
| `HTTPS://EXEMPLE.FR/MAJ` | garde la casse de l’hôte | la met en minuscules |
| `/a b c` | garde l’espace | `%20` |
| `/é` | garde l’accent | `%C3%A9` |
| `https://exemple.fr:443/p` | garde le port | le retire |

Deux autres écarts ont été trouvés en durcissant la mesure — une requête vide
(`?`) que `urlunsplit` supprimait, et l’antislash dans un fragment — et fermés
de la même façon. Les deux extraits rendent aujourd’hui le même rapport sur
les trente-huit adresses du test de parité.

## Décidé seul

- **L’extrait Python suit le navigateur, pas la bibliothèque standard de son
  langage.** La question posée est « où le lecteur va-t-il atterrir », et la
  réponse est celle du navigateur. L’alternative écartée : suivre la RFC 3986
  des deux côtés, ce qui aurait demandé de défaire dans `new URL` un
  comportement qu’il n’expose pas.
- **La normalisation est écrite dans l’extrait plutôt qu’empruntée.**
  `urlstd` met en œuvre la norme WHATWG en Python, mais il n’a pas été
  republié depuis septembre 2023 ; les quinze lignes de l’extrait ferment les
  écarts que cette fiche mesure, et elles ne prétendent pas à plus — c’est dit
  dans la docstring, et `urlstd` y est nommé.
- **`mailto:` et `tel:` sont des liens, pas des déchets.** Ils reviennent avec
  un genre. Seuls `javascript:`, `data:`, `blob:`, `about:` et un href vide
  sont écartés, chacun avec sa raison.
- **Une ancre interne est un genre à part.** Un lien qui ne mène qu’à un autre
  endroit de la même page n’est pas un lien sortant, et la plupart des usages
  de cette fiche — un plan de site, un contrôle de liens morts — veulent les
  distinguer.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure : l’adresse est
écrite dans un attribut que la norme nomme. Aucune page n’est visitée par
l’extrait, donc rien ne dit si une adresse rendue répond — c’est un autre
travail, et la fiche ne le promet pas.

## Infirmé, et ce que le code fait réellement

Rien d’infirmé. Deux ajustements pendant la mise au point, l’un et l’autre
trouvés par la mesure et non par le raisonnement : `urlunsplit` supprime une
requête vide, là où le navigateur garde le point d’interrogation que l’auteur
a écrit ; et l’antislash, converti en barre oblique dans le chemin, doit être
laissé tel quel dans la requête et le fragment.

## Défauts de production

Le reste : une entrée qui n’est pas du texte rend un rapport avec sa raison,
une page vide rend une liste vide, un href impossible n’empêche pas de lire
les autres, et un fragment de HTML mal formé — `<a href=` sans fin — ne fait
pas tomber l’analyse. Les deux analyseurs employés sont ceux qui étaient déjà
là : `html.parser` de la bibliothèque standard en Python, `linkedom` en
JavaScript, déjà dépendance de la fiche sur le contenu principal d’une page.
