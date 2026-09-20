"""
Les documents d'exemple des tests de cette fiche.

Ils vivent ici plutôt que dans l'un des deux fichiers de test parce que N0 et
N1 travaillent sur les mêmes pages : N0 les trie, N1 relit celles qu'il a
déclarées lisibles. Le fichier `fixtures.mjs` à côté porte exactement les mêmes
octets, ce qui épingle les deux implémentations l'une à l'autre.
"""

import base64
import zlib


def _pdf(*morceaux: str) -> bytes:
    """Les PDF de ce test, fabriques pour lui, compresses pour tenir dans le fichier."""
    return zlib.decompress(base64.b64decode("".join(morceaux)))


# Sept documents minimaux, tous de vrais PDF. Le test JavaScript porte
# exactement les memes octets : c'est ce qui epingle les deux implementations
# l'une a l'autre.
NUMERIQUE = _pdf(
    "eNrtUs1u2kAYvPsp5oKaVoBZgzFIUaSQgiqVKlHwLephsT/oImOj3TWifckc+gbti/RbQ02Ec2ylHmpZlnd2"
    "5vud1sP7WUd0B17rx8/n755AD8Vy411fw4+/7gj+nbQyK9bwH+SaDAImPOLmxqM8dcSgITjy/I8qNXgKK/rI"
    "fT9zrKLMLYc4y/tnOfw55Wv7Bf1B5BjGapJbbxLDnwmIAPEKYYRo1EOcQgwRz72ruyK3WlqkhJ0mY6VVRe5O"
    "hvReJWTeIt4gfuddTZlIyCRMkSiyhOmBtruMsLhdtCFLJHKnuNXqXma1jmNtVcY8KnVh2kg5I/hoFK0ZNBYS"
    "k6LkEeXUqVUTlsg8KUpt26BKkGSKclepUUxFojrSldytNbfaqoSJAh3cLzesSrmqY4NdzOsOpdJUi8wbHhpP"
    "nKvgcWWK++ZkBizay/LA6RKtrAHlkHlOB6rzTWO3hNOUT+sYNLY5c+36i3Jpq6MDBfyJNHS8+UDZnrhu+WKp"
    "4auecF9N1f6dJ/xPlCo5KQ546jEQjkOMBgGb5JEMj41XB6evslQ/AoOT99zru81zNIP+hSOH/y31L1kq+iOW"
    "Gv0lS0WvWmp4YamDppXXw9jr1Q+GYdgPsUKNCbZ9dZOfseGggYkgamBhMGxi4yYWBcElJkQgmtj4BcZrUxnp"
    "anQL9Y0w5oEUhYX43SU7QNuqR9EXkddqTe9n3i81Y8bw")
SCAN = _pdf(
    "eNrdUT1v1EAQFRLVCokWpYhGQicqWH+sfbYIKZLjSBSiHLlIRIpS7NmTy0a291jvoQs1P4MCiR/AT+AfkJPS"
    "UkFLQ0eZXXO5i7IpSRPLmrWe38zOe6/V63Sf+s8Yaf38dXZOfPBADk7IygrQvdMRAl3nmhdyCLTHh1hDYAi7"
    "sLpKsMotMXAa/vHolshrOIgaemLroZklx5U2Ixbt4aId6GushvoYQs8Saq2Ql+QdRKkd4kHCgubMSqCbpQ8d"
    "CW/smBlxNpA5++zvDE4w00D744FukM3SrAj0rcjNbcwDuoFieKwhiu2KhVT9Ec8MoYPvRYavFD8FuiZ03UO1"
    "LsuRrNCoSIB2RaFRmbPgGjuYyRznIlh4RcTk0/l0Ov378P7S44/LD6rPT148+uEtffvy5/m8bJXhve9fyW9X"
    "UXSjw7YqbNy0DtNtzAVfkxM4sB5Zz4xfxvJdrOVYZSYR23/phf22HrJZmvY10ittJtYQXss4/t8hte9cSMkt"
    "htS+MaT4WkgThUfEg5R48wfiKAojOII55puUmj/VAouZg/lB28ECL3Ew5rtYxFwsDlIHS8IrmFZcFKga+/ri"
    "A0JqTJFSg3+pstZc6UZjGqek1Xq50yUXk9he3A==")
MIXTE = _pdf(
    "eNrtU81qE1EYRXA1CG6lC/lAQqs0nbmZnySohaZJtLTSmgwoFBe3M1/TW2bmxrk3JXXtY7gQfAAfwTfQQreu"
    "dOvGnUu/O2mnsdNlBReGMD9nvt9zzq3tdPt1tuJZtW/fv5xaDByQe4fWo0dgh8djBHuda57IEdg7fIQKGhQw"
    "gNVVC7PYBDYqCbM4e1PECnb9IrxVXJkpPnhFJeUk0+DOVXEvqoC9hdlIH4DrNU2E0jny1OqEYPcZsAaE++A3"
    "odlyIIyBBRBuWUvrMtM51xAjjHNUmmshM/OmMD8SEar7EB5C+MBa6lEgQsJByUigRuhNMR0nCMO14TLwCUR8"
    "LGjj4jtPyjyqlYqE4nCSS7UMMXUEelUCRwQqDRw6ckJMZVgvszqUwrNITnK9DFgkRInAzEyqBIVCJOrcjLxS"
    "5qzlWkQUyKAO23uHlBXTVLMFV2Cr3JCLHMsktUikEfE0BdGVCNqbmimgpCM+mVK7KBdaAWbAswynWPbrhUaE"
    "M5bP5PAqovbNuvZwsqeLVwMysDtc4ezLU0yOkObmc6L6V1rDXHPDwMxJ9jOMBe/IKew6BPhtH1peg0wyQEW0"
    "kXRg8osuxQMD78yC5m8b5amaAveSMYOrLOXMOep10cw0pYbFPUrB3kgZdCU8r5LSrKzz0sgTzfOykRYbvhAx"
    "dfMcw4sYHWjwAzNpIvPhmEcU0EXjyic5PyYSSZcdzNdlOpaZIaZFW4pEk4J2P+EauxhJst/5Ep47t8T03enJ"
    "ycmv2zcX7r29eyt7v/j4zldn4dOHnw/Ly2bq3vj80fpR3ah1jQKdc2GeDYfNK0UKLonU/n/u/6Vzz5xrOfiM"
    "/aWTX8xXdVX7kqumOe5bDnnGcsofBL7v+rAPJcbo8Bdfsgss8CoYc6uY77oVLHCqWLPRrmAts8SfGHMaVYz5"
    "Vcz3KvVYMJ9LsosE84L4oXiD5tzYAyk1sHOOyEK5LhhiTa9l1Wq97b71G7FNWAk=")
ENTETE_SCAN = _pdf(
    "eNptU8tu00AUFRKrERJb1AW6Eop4SGU8tscJolRqXlC1qKG2BFLFYmLfpI5sTxhPqpQ1n8ECiQ/gE/gDiNQt"
    "K9iyYceSGSckEcaL8fjc17nnXjcG3f4ue+iTxvcfX68IAwfkcEL29oBGl1ME2hFaZHIMdCDGWIJrHE5hf59g"
    "kVhHtxaw9KNHaVLCWWDdX5ssclZoYFuB3iYQ6DEWY30OzGlZj1IrFDl5A/wRN14OtHy3esc50MOcQVfCC9KO"
    "gPYZMBeiEfAmNFsORAmwAKJjcq83x3yaIYQHIeyCKAqcI3jmOjX0TBflTIF7H6IJRA9IL7KsVmVX/PxaY31p"
    "WqDhbKirTwsyoG1R4tLyDLML1GkstrrktSyvToYTjLcTHeaWEn2ZJkYC37GJ0vG5Bh5Y3TKpwqmIjUMXL9IY"
    "nypxaaqmuhyg6sh8Kgs01VuGX5ppVOadCY1djGWCa2V9b0vY+furxWLx++b1nTvvbt8oPtx9cuubs/P546/H"
    "6+Mo9659+UR+1nUJ/jtweyrLY7kf9DkmqWjLOZzZudk5mhmaPTjFUs5UbBbExle6VRcG/mqxNgpZg502/2ux"
    "xo4JMXVK8P5ZxLnCEXGgSZz1AwHnHocRrDFmclWWYoMFfg1jLqthbquOebyO8WAL00qkGapKrDB9i9A0Ekhp"
    "/4QV+1ILpSvuTeaRRqN30id/ACBgAWc=")
MOJIBAKE = _pdf(
    "eNqVkt9OgzAUxu/7FJ9RjP9LgbJN59TNsRk1GuXOeFFdNzETDHRGfUkvfAN9EVuGuIk3EkLK1985PT3fsc4P"
    "g0225RHr4/PtnTDYSG7uSbMJGr48StCOUGKcjEDPxUhmcDRwgVaLyHhgQKcSMOXocTTIcMUNfq2zJJNYgc0E"
    "uj+BoCcyHqk7OH7DEJlKpXgg7RA0YGAOwiF4DbW6jXAA5iM8ISuLS9bywtr6xuYWtZnjetzXQGN7p7nb2ts/"
    "aHdw2A16/VWE9wjXyMocWatjhtQgev2jPGHJz233+jiaOw9FmkbJl2QOYr6yGr4rK/n/ld8NTduKvhQN9Cqd"
    "DxLdY3o5uVH5rxEZaFtkcrrTl+MnqaJbMWMD/9M/802ljpnaTU/lIBLt5BlXthZ4g6PuOdrWC5klk/RW+23i"
    "81PyBYNXzIl5tfux0tkyuL+m5zmVQ2LDJ3b5wOfc5Rii1JiuMd+JfzTfq2jMYRXN85yKxtmMplIRjWWaX/8y"
    "epXw9aWSxIxqUWmmRKryOn23TiyrexaQLwApyoU=")
VIDE = _pdf(
    "eNptUUFPwjAYvfdXvMuO2nVbhySEA8piIkYCuxEPhRWcwdW0xaB/0oP/QP+IbVmAOJumaV/f+/re12h6U1yw"
    "y4xE3z+fX4Qhhlo+k8EAtHx/laDXwoqt2oBOxUYaJI4ww3BIZFN5YtIRHHj0rq4MFtzTH10VtWss2JkwPQlB"
    "J7LZ2CekgWCsluKFjErQgoElKNfgPfSuYpQVWI5yQsalr9My24pZx0qh3KN0vlvacPQgAx0JIw83t3L7Jm29"
    "Eme++L+B/Kql0xzy03tZ1WKk9ljEDuB9jqsscTln0qidXrkGeH14JWwYsrZxfrp2NNZVM0j/tHOv5ZrEyEl8"
    "HMg5TznWOGLMeQw3zQnLsw7GEtbBkjjtYr0zzGpRb6UO8ef1h0TuQinl/651aqzQNvhM+30SReOHgvwCoxWY"
    "+w==")
NUMERO_PAGE = _pdf(
    "eNptUdFOwjAUfe9XnJclaoJdt3ZgQnhAWUzUSKBvxIfCCo7garZi0J/0wT/QH7EdCxBn0zTt6Tm3554G45u0"
    "wy45Cb5/Pr8IQwgzX5N+H1S+v2rQa2XVxqxAx2qlK0SOMMFgQHSReWLUEux59C7PKsyEpz+5KmZbWLATYXwU"
    "gt7rYmWfwYUnVLbU6oUMJWjKwCLIJUQX3V4ImYElkPfkrAOOzjnkGvKCjKSv2uia+rxlLDXOAp1u57Y+epCB"
    "DlWl9ze3evOmbb5QJy7Fv+35tdROs0+DPugsV0Ozwyx0gLgS6PHIdT3RldmWCxeH19ev1BsG3sTopwunsK5a"
    "hfhPuLtSL0mIhISHgUSIWGCJA8acx/qmOGIJb2EsYi0sYt021jvBbKnyjS7r9qf5h0bimjLG/2TjtLKqtLVP"
    "zmISBKPHlPwCoXKbog==")

CORPUS = [
    "Contrat de prestation de services conclu entre la societe Exemple SAS, au capital"
    " social de mille euros, dont le siege social est situe a Boulogne-Billancourt,"
    " immatriculee au registre du commerce et des societes, representee par son president"
    " en exercice, ci-apres denommee le prestataire.",
    "Article premier. Objet du contrat. Le prestataire s'engage a realiser pour le compte"
    " du client les travaux decrits en annexe du present contrat. Les parties conviennent"
    " que cette annexe fait partie integrante du contrat et que toute modification fera"
    " l'objet d'un avenant ecrit.",
    "Article deux. Duree. Le present contrat est conclu pour une duree de douze mois a"
    " compter de sa signature. Il se renouvelle par tacite reconduction pour des periodes"
    " de meme duree, sauf denonciation par lettre recommandee avec accuse de reception.",
    "Article trois. Prix et modalites de reglement. Le prix des prestations est fixe dans"
    " l'annexe financiere. Les factures sont payables a trente jours fin de mois. Tout"
    " retard de paiement entraine de plein droit l'application de penalites.",
    "Article quatre. Confidentialite. Chacune des parties s'engage a ne pas divulguer les"
    " informations dont elle aurait connaissance a l'occasion de l'execution du contrat, et"
    " a prendre toutes mesures utiles pour en preserver le caractere confidentiel.",
    "Article cinq. Resiliation. En cas de manquement grave de l'une des parties a ses"
    " obligations, l'autre partie pourra resilier le contrat de plein droit apres mise en"
    " demeure restee sans effet pendant un delai de trente jours.",
]

# Ce qu'extrait une page dont la police n'a pas de table de caracteres : les
# index de glyphes lus comme de l'ASCII.
MOJIBAKE_TEXTE = (
    "#$%&!*+,-./0123456 789:;<=>?@ABC DEFGH\n*+,-./012345678 9:;<=>?@ABCDEF GHI#$%&!\n"
    ":;<=>?@ABCDEFGH I#$%&!*+,-./01 23456789\n@ABCDEFGHI#$%& !*+,-./01234567 89:;<=>?\n"
    "#$%&!*+,-./0123456 789:;<=>?@ABC DEFGH"
)
TABLEAU_DE_CHIFFRES = "12/01/2026 1 250,00 4 300,50 12/02/2026 980,00 2 145,75"
PAGE_ANGLAISE = "This agreement is made between Example Ltd and the client named below."
