import sys
sys.path.insert(0, 'content/snippets/extract-key-terms-from-a-document')
from n0 import extract_key_terms
from n1 import extract_key_terms_in_corpus

VIDES_FR = ("de des du la le les un une et ou à au aux en dans sur pour par avec sans "
            "sous est sont a ont ce cette ces qui que dont se son sa ses leur leurs ne "
            "pas plus il elle nous vous ils elles on y d l s n c j m t qu").split()

def cgv(produit, detail):
    return f"""Conditions générales de vente

La société Lumière, immatriculée au registre du commerce, vend {produit}.
{detail} Le client dispose d'un délai de rétractation de quatorze jours.
Les présentes conditions générales de vente sont soumises au droit français."""

CORPUS = [
    cgv("des moulins à café", "Le moulin est garanti deux ans."),
    cgv("des vélos électriques", "La batterie du vélo est garantie deux ans."),
    cgv("des imprimantes laser", "La cartouche laser est garantie six mois."),
    cgv("des casques audio", "Le casque audio est garanti deux ans."),
]
r = extract_key_terms_in_corpus(CORPUS, VIDES_FR)
for d in r["documents"]:
    print(d["index"], "tied", d["tied_at_cut"])
    for t in d["terms"]:
        print(f"   {t['score']:.4f} {t['count']} first={t['first']} {t['text']}")
