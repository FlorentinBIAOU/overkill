# extract-main-content-from-a-web-page — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « le HTML servi ne porte qu’une balise vide et un script, et rien n’en sort » | démontrée | test_point_de_rupture_une_page_construite_par_son_javascript_na_rien_a_extraire |
| 2 | N0 breaking_point | « le témoin : le même article servi en HTML ressort avec ses deux paragraphes » | démontrée | test_point_de_rupture_temoin_le_meme_article_servi_en_html_est_extrait |
| 3 | N0 docstring | « the article’s sentences are in, the navigation and the footer are out » | démontrée | test_les_phrases_de_larticle_sont_gardees_et_le_reste_jete |
| 4 | Essai | « Les commentaires des lecteurs ne font pas partie de l’article » | démontrée | test_les_commentaires_des_lecteurs_ne_font_pas_partie_de_larticle |
| 5 | N0 docstring, verdict_rationale | « above half the page is not an article whatever the extractor said » | démontrée | test_une_page_de_liens_ne_passe_pas_pour_un_article |
| 6 | N0 — réglage (R7) | ce que le plancher produit, et ce que le changer produit | démontrée | test_le_plancher_est_reglable_et_son_effet_est_visible |
| 7 | Les deux langages | même verdict et même raison sur toutes les pages ; texte différent | démontrée | test_les_deux_extraits_gardent_larticle_et_jettent_le_reste_sans_rendre_le_meme_texte |
| 8 | N0 latency `~10 ms` | classe de latence | mesurée | voir ci-dessous |
| 9 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## La mesure de latence

Deux mille extractions du même article, après une passe de chauffe :
**1,943 ms en Python, 0,502 ms en JavaScript**. La classe affichée est
`~10 ms`, qui couvre les deux et laisse de la marge pour une vraie page de
presse, plus grosse que la page d’exemple. Le test ne garde qu’une borne
d’effondrement : mille extractions en moins de soixante secondes.

## Le désaccord entre les deux bibliothèques, mesuré puis fermé

Sur la page de catégorie — quarante liens et rien d’autre — :

| | texte rendu | verdict |
|---|---|---|
| `trafilatura` seul | 0 caractère | rien à lire |
| `Readability` seul | 830 caractères | un article |

C’est une sortie fausse et silencieuse côté JavaScript : le menu revient
comme un article. La règle qui ferme l’écart est écrite dans les deux
extraits — la part du texte de la page située à l’intérieur de liens, au-delà
de la moitié la page n’est pas un article — et le test de parité vérifie
désormais que les deux rendent la même raison sur les cinq pages.

## Ce que les deux extraits ne garantissent pas

Le texte, au caractère près. Les deux algorithmes diffèrent : `trafilatura`
garde le titre dans le corps, `Readability` le met à part ; les retours à la
ligne ne tombent pas aux mêmes endroits. Le test l’épingle en affirmant
l’inégalité, pour qu’une convergence future ne passe pas inaperçue. Ce qui est
garanti et testé : le verdict, sa raison, les phrases gardées, le bruit jeté,
et le titre.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. Une page vide, un balisage cassé et une page de cinq cents paragraphes
rendent chacun une réponse nommée.
