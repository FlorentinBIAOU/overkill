import ast
import statistics
import time
import unicodedata
from pathlib import Path

import numpy as np
import pytest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

from n0 import reasons
from n1 import fold, is_spam, spam_score, train

# Un petit jeu étiqueté, ce qu'un après-midi dans la boîte de réception produit.
SPAM = [
    "Hello, we offer guaranteed first page ranking on Google for your website.",
    "Boost your traffic with our premium backlink packages at cheap prices.",
    "Dear sir, I can improve your website ranking within one month, low cost.",
    "Earn passive income trading crypto, join our telegram channel right now.",
    "We provide guest posting services on high authority blogs, best rates.",
    "Buy cheap followers and likes for your social media accounts today.",
    "Your website design looks outdated, we redesign it for a very low price.",
    "Congratulations, you have won a prize, click the link below to claim it.",
    "We are an offshore web development company, hire our developers cheap.",
    "Increase your sales with our bulk email marketing database of contacts.",
    "Dear owner, your domain is expiring, renew it today at a discount price.",
    "We sell verified leads for your industry, guaranteed results, free trial.",
    "Hello dear, I have a business proposal worth millions, reply for details.",
    "Get thousands of visitors to your website every month, no effort needed.",
    "Our agency offers unlimited traffic and top rankings, first month free.",
    "Special offer this week only, cheap logo design and unlimited revisions.",
]

GENUINE = [
    "Hello, I ordered a lamp last week and it arrived damaged, what should I do?",
    "Could you tell me if the workshop on tuesday is still open for registration?",
    "I would like a quote for repainting the shutters of a house near Nantes.",
    "Your online form refused my postcode, I live abroad, can you help me?",
    "Good morning, is the shop open on saturday afternoon during august?",
    "I sent an invoice three weeks ago and it is still unpaid, who do I contact?",
    "Do you deliver to Belgium, and how long does the delivery usually take?",
    "The instructions in the manual mention a part that was not in the box.",
    "I lost the receipt for a purchase made in june, can you send a copy?",
    "Hello, my order number 4512 has not moved for ten days, is it lost?",
    "Is the blue model still available in size medium, or is it discontinued?",
    "We are a school and would like to visit your workshop with fifteen pupils.",
    "The battery of the device I bought in march no longer holds a charge.",
    "Can I change the delivery address of an order that was placed yesterday?",
    "Hello, I would like to cancel my subscription before the next renewal.",
    "Your newsletter arrives twice, could you remove the duplicate address?",
]

LABELS = [1] * len(SPAM) + [0] * len(GENUINE)
MODEL = train(SPAM + GENUINE, LABELS)

PATIENT_BOT = (
    "Good morning, I came across your company and I would like to discuss "
    "a partnership to increase your visibility. When would suit you?"
)
VERDICT_SOLICITATION = "Hi, we can boost your google ranking with quality links, cheap offer."
ENQUIRY = "Hello, my parcel arrived yesterday but the box was open."


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_sollicitation_ecrite_dans_le_registre_d_un_client():
    """
    breaking_point : « un envoi court, poli, sans offre, sans prix et sans lien
    score comme une demande de client, et le test le laisse sous le seuil ».
    Témoin : la sollicitation du verdict est au-dessus.
    """
    assert spam_score(MODEL, PATIENT_BOT) < 0.5
    assert not is_spam(MODEL, PATIENT_BOT)
    assert spam_score(MODEL, VERDICT_SOLICITATION) > 0.5


def test_point_de_rupture_c_est_mot_pour_mot_le_message_qui_traverse_n0():
    """breaking_point : « C'est mot pour mot le message qui traverse déjà N0 »."""
    assert reasons({"message": PATIENT_BOT, "website": ""}, 30) == []
    assert not is_spam(MODEL, PATIENT_BOT)


def test_point_de_rupture_ce_que_n1_gagne_est_le_flot_entre_les_deux():
    """
    breaking_point : « ce que N1 gagne, c'est le flot entre les deux ». La
    sollicitation du verdict passe N0 et N1 l'écarte ; un robot au pot de miel
    rempli, écrit comme un client, est écarté par N0 et passerait N1.
    """
    assert reasons({"message": VERDICT_SOLICITATION, "website": ""}, 30) == []
    assert is_spam(MODEL, VERDICT_SOLICITATION)
    assert reasons({"message": ENQUIRY, "website": "http://x.com"}, 0.2) == ["honeypot filled", "submitted too fast"]
    assert not is_spam(MODEL, ENQUIRY)


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_le_repli_retire_la_casse_et_les_accents():
    """docstring de fold : « so casing never doubles the feature space »."""
    assert fold("Commande Cassée") == "commande cassee"
    assert spam_score(MODEL, ENQUIRY.upper()) == spam_score(MODEL, ENQUIRY)


def test_verdict_attrape_une_sollicitation_jamais_vue():
    """verdict_rationale : « le classifieur la range du bon côté sans l'avoir jamais vue »."""
    assert VERDICT_SOLICITATION not in SPAM + GENUINE
    assert is_spam(MODEL, VERDICT_SOLICITATION)


def test_laisse_passer_une_nouvelle_demande_de_client():
    assert not is_spam(MODEL, ENQUIRY)


def test_attrape_les_phrases_ou_figurent_les_graphies_contournees():
    """Test d'origine, gardé : les deux phrases sont classées spam. Ce qu'il ne démontre pas est au test suivant."""
    for written in (
        "we sell b a c k l i n k s and cheap traffic, boost your rankings today",
        "we sell backl1nks and cheap seo packages, boost your ranking now",
    ):
        assert is_spam(MODEL, written), written


def test_un_mot_epele_ne_partage_aucun_n_gramme_avec_le_mot_entier():
    """
    docstring : « a word spelled out letter by letter shares none: no n-gram
    crosses a space ». C'est la limite du niveau, et non son point fort : ce qui
    classe « b a c k l i n k s » dans une phrase, c'est le reste de la phrase.
    """
    analyzer = MODEL.named_steps["tfidfvectorizer"].build_analyzer()
    entier = set(analyzer("backlinks"))
    epele = set(analyzer("b a c k l i n k s"))
    assert entier & epele == set()
    # Et le score le dit : le mot épelé ne pèse pas plus qu'un mot neutre épelé.
    assert spam_score(MODEL, "b a c k l i n k s") < spam_score(MODEL, "l a m p s")


def test_char_wb_ne_forme_aucun_n_gramme_a_travers_une_espace():
    """Commentaire : « `char_wb` keeps n-grams inside word boundaries »."""
    analyzer = MODEL.named_steps["tfidfvectorizer"].build_analyzer()
    assert [gram for gram in analyzer("b a c k l i n k s") if "bac" in gram] == []
    assert all(" " not in gram.strip() for gram in analyzer("ab cd efgh"))


def test_backl1nks_garde_une_partie_de_sa_forme():
    """Démontré en Python seulement : « backl1nks » seul score plus que « lamps », et un peu plus dans la phrase."""
    assert spam_score(MODEL, "backl1nks") > spam_score(MODEL, "lamps")
    assert spam_score(MODEL, "we sell backl1nks and cheap seo packages, boost your ranking now") > spam_score(
        MODEL, "we sell lamps and cheap seo packages, boost your ranking now"
    )


def test_la_decision_est_une_somme_ponderee_dont_on_peut_imprimer_les_traits():
    """docstring : « The decision is a weighted sum, so you can print the features that pushed a message over the line »."""
    vectoriser = MODEL.named_steps["tfidfvectorizer"]
    classifier = MODEL.named_steps["logisticregression"]
    row = vectoriser.transform([fold(VERDICT_SOLICITATION)]).toarray()[0]
    contributions = row * classifier.coef_[0]
    names = vectoriser.get_feature_names_out()
    top = [names[i] for i in np.argsort(contributions)[::-1][:5]]
    assert top[0] == "ran"
    # Pas « cheap dans les cinq premiers » : ses n-grammes (cheap, chea, che,
    # heap…) ne se rencontrent qu'ensemble dans les exemples, ont donc le même
    # poids, et sont ex æquo au bit près. np.argsort départage les ex æquo
    # selon le jeu d'instructions du processeur, pas selon une règle : en AVX2
    # « cheap » sort deuxième, en AVX-512 il sort des cinq. Sa contribution,
    # elle, ne dépend pas de la machine.
    assert contributions[list(names).index("cheap")] >= np.sort(contributions)[-5]
    z = contributions.sum() + classifier.intercept_[0]
    assert spam_score(MODEL, VERDICT_SOLICITATION) == pytest.approx(1 / (1 + np.exp(-z)))


def test_c_au_dessus_de_un_ecarte_les_scores_du_demi():
    """
    Commentaire : « `C` above one because a few hundred examples with a heavy
    regulariser leave every score sitting near a half ». Sur le jeu des tests,
    à C = 1 les scores d'entraînement restent entre 0,35 et 0,66 ; à C = 10,
    entre 0,11 et 0,90.
    """
    def spread(c):
        model = make_pipeline(
            TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, min_df=1),
            LogisticRegression(class_weight="balanced", C=c, max_iter=1000),
        )
        model.fit([fold(m) for m in SPAM + GENUINE], LABELS)
        return statistics.fmean(abs(p - 0.5) for p in model.predict_proba([fold(m) for m in SPAM + GENUINE])[:, 1])
    assert spread(1.0) < 0.15 < 0.3 < spread(10.0)
    scores = [spam_score(MODEL, m) for m in SPAM + GENUINE]
    assert round(min(scores), 2) == 0.11 and round(max(scores), 2) == 0.9


def test_le_seuil_est_a_vous():
    """docstring d'is_spam : « Move it towards 1 when losing a real enquiry is the expensive mistake »."""
    assert is_spam(MODEL, ENQUIRY, threshold=0.0)
    assert not is_spam(MODEL, VERDICT_SOLICITATION, threshold=1.0)
    exact = spam_score(MODEL, VERDICT_SOLICITATION)
    assert is_spam(MODEL, VERDICT_SOLICITATION, threshold=exact)  # supérieur ou égal


def test_le_score_est_une_probabilite():
    """docstring de spam_score : « between zero and one »."""
    assert all(0.0 <= spam_score(MODEL, m) <= 1.0 for m in SPAM + GENUINE + ["anything at all", ""])


def test_deux_entrainements_rendent_les_memes_scores():
    """risks.deterministic : true."""
    assert spam_score(train(SPAM + GENUINE, LABELS), PATIENT_BOT) == spam_score(MODEL, PATIENT_BOT)


def test_l_extrait_n_importe_que_scikit_learn_et_unicodedata():
    """risks.data_egress : none."""
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    modules = {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    modules |= {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    assert modules == {"unicodedata", "sklearn.feature_extraction.text", "sklearn.linear_model", "sklearn.pipeline"}


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_accents_nfd_espace_insecable_et_message_d_un_megaoctet():
    assert not is_spam(MODEL, "Bonjour, ma commande est arrivée cassée, que dois-je faire ?")
    assert spam_score(MODEL, unicodedata.normalize("NFD", ENQUIRY + " é")) == spam_score(MODEL, ENQUIRY + " é")
    assert not is_spam(MODEL, ENQUIRY.replace(" ", " "))
    assert not is_spam(MODEL, "Hello, I ordered a lamp last week and it arrived damaged. " * 20)
    started = time.monotonic()
    spam_score(MODEL, "Hello I have a question. " * 40000)
    assert time.monotonic() - started < 10


def test_defaut_un_message_vide_n_est_pas_tranche_par_hasard():
    assert not is_spam(MODEL, "")
    assert spam_score(MODEL, "") < 0.5 - 0.05


def test_production_un_entrainement_degenere_leve():
    """
    Jeu vide, une seule classe, étiquettes de longueur différente : trois façons
    de rendre un modèle qui répond n'importe quoi sans le dire. JavaScript lève
    de même, sur les mêmes trois cas.
    """
    with pytest.raises(ValueError):
        train([], [])
    with pytest.raises(ValueError):
        train(SPAM, [1] * len(SPAM))
    with pytest.raises(ValueError):
        train(SPAM + GENUINE, [1])


def test_production_trois_mille_deux_cents_envois_etiquetes():
    started = time.monotonic()
    train((SPAM + GENUINE) * 100, LABELS * 100)
    assert time.monotonic() - started < 30
