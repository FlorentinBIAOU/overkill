import sys
sys.path.insert(0, 'content/snippets/extract-key-terms-from-a-document')
from n0 import extract_key_terms
from n1 import extract_key_terms_in_corpus

VIDES_FR = ("de des du la le les un une et ou à au aux en dans sur pour par avec sans "
            "sous est sont a ont ce cette ces qui que dont se son sa ses leur leurs ne "
            "pas plus il elle nous vous ils elles on y d l s n c j m t qu sera seront "
            "été étaient était").split()

CONSEIL = [
    "Le conseil municipal a approuvé le budget de la nouvelle médiathèque, rue des"
    " Frères-Lumière. Les travaux commenceront au printemps. Le maire a rappelé que la"
    " salle de lecture accueillera les scolaires.",
    "Le conseil municipal a voté la création d'une piste cyclable le long du canal. La"
    " piste cyclable reliera la gare au parc des sports, et sa mise en service est"
    " prévue pour septembre.",
    "Le conseil municipal a décidé d'étendre le stationnement payant au centre-ville. Le"
    " stationnement payant s'appliquera du lundi au samedi, et les riverains garderont"
    " leur abonnement annuel.",
    "Le conseil municipal a validé la rénovation de l'école élémentaire Jean-Moulin."
    " L'école accueillera deux classes de plus à la rentrée, et la cantine de l'école"
    " sera agrandie.",
]
r = extract_key_terms_in_corpus(CONSEIL, VIDES_FR, top=3)
for d in r["documents"]:
    print("N1 doc", d["index"], "tied", d["tied_at_cut"],
          [f"{t['text']} ({t['score']})" for t in d["terms"]])
for i, texte in enumerate(CONSEIL):
    print("N0 doc", i, [t["text"] for t in extract_key_terms(texte, VIDES_FR, top=3)["terms"]])
