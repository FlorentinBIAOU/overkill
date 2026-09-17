# Matrice des extraits

Pour chacune des 25 fiches de lancement : quels niveaux sont disponibles, quelle approche
chaque niveau met en œuvre, et quel niveau de preuve d'exécution est atteignable.

Cette matrice est le **contrat** des extraits. Elle est arrêtée avant leur écriture pour que
25 auteurs indépendants produisent un ensemble cohérent, et pour que la fiche décrive ce que
le code fait réellement.

**Un niveau marqué absent l'est pour une raison réelle, écrite ici.** Elle sera reprise
telle quelle dans le champ `unavailable_reason` de la fiche.

---

## Légende

| Symbole | Sens |
|---|---|
| **E** | `executed` — l'extrait tourne tel quel, avec ses vraies dépendances |
| **S** | `stubbed` — il tourne, un service ou un modèle externe étant remplacé par un double local |
| **—** | niveau absent, avec sa raison |

Les quatre niveaux : N0 règle et algorithme classique · N1 modèle classique léger ·
N2 petit modèle spécialisé auto-hébergé · N3 API de LLM généraliste.

---

## Détecter et filtrer

### 1. `mask-personal-data-in-chat` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Normalisation Unicode puis expressions régulières sur les motifs à forte structure : adresse électronique, numéro de téléphone, IBAN | **E** |
| N1 | Régression logistique sur des traits de jetons, pour rattraper les formes obfusquées que la règle rate | **E** |
| N2 | — Un modèle de reconnaissance d'entités auto-hébergé coûte un service permanent pour un gain nul sur des motifs aussi structurés que N1 traite déjà | — |
| N3 | Extraction structurée par appel à un modèle généraliste | **S** |

**Point de rupture N0** : l'obfuscation volontaire, chiffres écrits en lettres, caractères
sosies, emojis intercalés.

### 2. `detect-spam-in-contact-form` — verdict attendu **N1**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Pot de miel, délai minimal de soumission, plafond de liens, motifs interdits | **E** |
| N1 | Régression logistique sur n-grammes de caractères en TF-IDF | **E** |
| N2 | — Un encodeur distillé auto-hébergé n'apporte rien sur des textes courts et très typés, face au coût d'un service permanent | — |
| N3 | Classement par appel à un modèle généraliste | **S** |

**Point de rupture N0** : un robot qui remplit lentement et évite les liens passe.

### 3. `find-duplicate-records` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Normalisation, clé de blocage, puis distance d'édition sur les seuls candidats du même bloc | **E** |
| N1 | TF-IDF sur n-grammes de caractères et plus proches voisins par cosinus | **E** |
| N2 | Embeddings de phrases auto-hébergés et recherche du plus proche voisin | **S** |
| N3 | — Comparer les paires par appel à un modèle généraliste est quadratique : sur dix mille fiches, cela fait cinquante millions d'appels | — |

**Point de rupture N0** : deux graphies qui ne partagent pas la clé de blocage ne sont
jamais comparées.

### 4. `moderate-user-comments` — verdict attendu **N2**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Liste de termes après normalisation, avec fenêtre de contexte | **E** |
| N1 | Classifieur linéaire entraîné sur un corpus étiqueté | **E** |
| N2 | Modèle de classification de toxicité auto-hébergé | **S** |
| N3 | Point de terminaison de modération d'un fournisseur | **S** |

**Point de rupture N0** : le contournement par graphie, et les faux positifs sur les
citations et le second degré.

---

## Extraire

### 5. `extract-dates-from-text` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Expressions régulières par format, puis validation calendaire réelle | **E** |
| N1 | Génération de candidats par règle, puis classifieur pour lever l'ambiguïté jour-mois | **E** |
| N2 | — Un modèle de reconnaissance d'entités dédié aux dates n'apporte rien de plus que N1 sur du texte de gestion | — |
| N3 | Extraction structurée par appel à un modèle généraliste | **S** |

**Point de rupture N0** : les dates relatives, « jeudi prochain », « dans quinze jours ».

### 6. `extract-fields-from-invoice` — verdict attendu **N2**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Ancrage par mots-clés et expressions régulières sur le texte déjà extrait | **E** |
| N1 | Traits de position et de mise en forme, puis classifieur de lignes | **E** |
| N2 | Modèle de compréhension de document auto-hébergé, tenant compte de la mise en page | **S** |
| N3 | Extraction structurée par modèle généraliste multimodal | **S** |

**Point de rupture N0** : chaque fournisseur a sa mise en page ; la règle écrite pour l'un
échoue sur le suivant.

### 7. `parse-address-into-fields` — verdict attendu **N1**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Expressions régulières, dictionnaire de types de voie, ancrage sur le code postal | **E** |
| N1 | Étiquetage de jetons par régression logistique sur traits de contexte | **E** |
| N2 | Analyseur d'adresses statistique auto-hébergé, entraîné sur données ouvertes mondiales | **S** |
| N3 | Découpage structuré par appel à un modèle généraliste | **S** |

**Point de rupture N0** : les compléments d'adresse, les adresses étrangères, l'ordre inversé.

---

## Classer et router

### 8. `route-support-tickets` — verdict attendu **N1**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Règles par mots-clés, avec priorité explicite et équipe par défaut | **E** |
| N1 | TF-IDF et classifieur linéaire entraîné sur l'historique de tickets | **E** |
| N2 | Encodeur de phrases auto-hébergé et plus proches voisins sur les tickets résolus | **S** |
| N3 | Classement par appel à un modèle généraliste | **S** |

**Point de rupture N0** : un ticket qui contient les mots-clés de deux équipes, ou aucun.

### 9. `tag-articles-by-topic` — verdict attendu **N1**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Vocabulaire contrôlé, correspondance de termes après lemmatisation simple | **E** |
| N1 | TF-IDF et classification multi-étiquette un contre tous | **E** |
| N2 | Étiquetage sans exemple par similarité d'embeddings avec les libellés | **S** |
| N3 | Étiquetage par appel à un modèle généraliste | **S** |

**Point de rupture N0** : un article qui traite d'un thème sans jamais employer son nom.

### 10. `detect-language-of-text` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Profils de trigrammes de caractères par langue, distance de rang | **E** |
| N1 | Classifieur bayésien naïf sur n-grammes de caractères | **E** |
| N2 | Identifiant de langue dédié embarqué avec son modèle (CLD3), avec son plancher d'octets | **S** |
| N3 | Détection par appel à un modèle généraliste | **S** |

**Point de rupture N0** : les textes très courts, et les textes mélangeant deux langues.

---

## Chercher

### 11. `search-in-your-own-documents` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Index plein texte de la base de données, avec classement BM25 intégré | **E** |
| N1 | Index inversé et classement BM25 écrit à la main, pour comprendre ce que fait N0 | **E** |
| N2 | Embeddings auto-hébergés et recherche vectorielle, en complément du plein texte | **S** |
| N3 | Génération augmentée par récupération : le modèle rédige la réponse à partir des passages trouvés | **S** |

**Point de rupture N0** : une recherche par le sens, quand le document n'emploie aucun des
mots de la requête.

### 12. `add-autocomplete-to-a-search-bar` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Arbre de préfixes, tri par fréquence d'usage | **E** |
| N1 | Réordonnancement appris sur les clics passés | **E** |
| N2 | — La latence d'un modèle auto-hébergé est incompatible avec une suggestion à chaque frappe | — |
| N3 | — Un appel réseau par caractère frappé : la latence et le coût rendent l'approche inutilisable | — |

**Point de rupture N0** : une faute de frappe dès le premier caractère ne remonte rien.

### 13. `fuzzy-match-company-names` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Normalisation, retrait des formes juridiques, similarité de Jaro-Winkler | **E** |
| N1 | TF-IDF sur n-grammes de caractères et plus proches voisins par cosinus | **E** |
| N2 | — Sa seule raison d'être serait le sigle, et rien ne démontre qu'un encodeur généraliste le rapproche de sa raison sociale ; une table de sigles (répertoire Sirene) le règle de façon déterministe | — |
| N3 | — L'appariement est quadratique et doit être déterministe et rejouable : un modèle généraliste ne l'est pas | — |

**Point de rupture N0** : deux noms de la même entreprise sans caractères communs, sigle
contre raison sociale développée.

---

## Recommander

### 14. `show-similar-articles` — verdict attendu **N1**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Chevauchement d'étiquettes, pondéré par la rareté de l'étiquette | **E** |
| N1 | TF-IDF sur le texte et similarité cosinus, calculée hors ligne | **E** |
| N2 | Embeddings de documents auto-hébergés | **S** |
| N3 | — Recalculer une similarité par appel de modèle à chaque affichage de page, pour un résultat qui ne change pas, est un gaspillage | — |

**Point de rupture N0** : un fonds d'articles mal étiqueté ne produit aucune similarité.

### 15. `rank-products-by-relevance` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Score pondéré déterministe : correspondance textuelle, disponibilité, marge, popularité | **E** |
| N1 | Apprentissage du classement sur les interactions passées | **E** |
| N2 | — Face au poids du signal métier, un modèle sémantique n'apporte rien qui justifie un service permanent | — |
| N3 | — Un classement doit être déterministe, explicable et rejouable ; un modèle généraliste ne l'est pas | — |

**Point de rupture N0** : les pondérations sont réglées à la main et vieillissent sans
que personne ne s'en aperçoive.

---

## Prédire

### 16. `forecast-weekly-sales` — verdict attendu **N1**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Moyenne mobile et coefficient saisonnier calculé sur l'historique | **E** |
| N1 | Régression linéaire sur variables calendaires, tendance et saisonnalité | **E** |
| N2 | — Les modèles profonds de séries temporelles exigent bien plus d'historique que n'en a une PME | — |
| N3 | — Un modèle de langue ne prédit pas une série numérique de façon fiable, et une prévision non testable n'a pas d'usage | — |

**Point de rupture N0** : une rupture de tendance, un changement de gamme, une promotion
exceptionnelle.

### 17. `detect-anomalies-in-metrics` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Seuil robuste sur médiane et écart absolu médian, avec fenêtre glissante | **E** |
| N1 | Forêt d'isolement sur plusieurs métriques conjointes | **E** |
| N2 | — Une alerte doit être explicable à trois heures du matin ; un service supplémentaire à surveiller est une charge, pas une aide | — |
| N3 | — Une alerte non déterministe est une alerte à laquelle personne ne fera confiance | — |

**Point de rupture N0** : une dérive lente entre dans la fenêtre glissante et devient la
nouvelle normale.

---

## Générer

### 18. `generate-test-data` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Générateur déterministe à graine, respectant les contraintes du schéma | **E** |
| N1 | Échantillonnage des distributions marginales observées en production | **E** |
| N2 | — Un modèle génératif auto-hébergé pour remplir un tableau est disproportionné | — |
| N3 | Rédaction de champs textuels réalistes par appel à un modèle généraliste | **S** |

**Point de rupture N0** : les données restent visiblement synthétiques et ne révèlent pas
les bugs que provoquent les vraies.

### 19. `write-product-descriptions` — verdict attendu **N3**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Gabarits à trous alimentés par les attributs du produit | **E** |
| N1 | — Aucun modèle classique léger ne produit de la prose commercialement acceptable ; ce n'est pas ce pour quoi ils sont faits | — |
| N2 | Petit modèle génératif auto-hébergé, spécialisé par affinage | **S** |
| N3 | Rédaction par appel à un modèle généraliste | **S** |

**Point de rupture N0** : mille descriptions issues du même gabarit se lisent comme mille
descriptions issues du même gabarit.

### 20. `generate-placeholder-images` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | SVG déterministe dérivé d'un hachage de l'identifiant | **E** |
| N1 | — Il n'y a rien à apprendre : la sortie voulue est décorative et arbitraire | — |
| N2 | — Un modèle de diffusion pour produire un aplat coloré est l'exemple même du sur-dimensionnement | — |
| N3 | — Idem, avec en plus un coût par image et une latence de plusieurs secondes | — |

**Point de rupture N0** : une image de remplacement reste une image de remplacement ; si
vous avez besoin d'une vraie photographie, aucune approche de cette fiche ne convient.

---

## Transformer

### 21. `summarise-a-long-document` — verdict attendu **N3**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Résumé extractif : notation des phrases par position et fréquence des termes | **E** |
| N1 | Notation supervisée des phrases sur des traits de surface | **E** |
| N2 | Modèle de résumé abstractif auto-hébergé | **S** |
| N3 | Résumé par appel à un modèle généraliste | **S** |

**Point de rupture N0** : le résumé extractif ne relie pas deux idées séparées de dix pages,
et il ne reformule jamais.

### 22. `translate-interface-strings` — verdict attendu **N2**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Mémoire de traduction : correspondance exacte, puis correspondance approchée signalée pour relecture | **E** |
| N1 | — La traduction statistique par segments exige un corpus aligné hors de portée d'une petite équipe, pour un résultat en deçà de N2 | — |
| N2 | Modèle de traduction neuronale auto-hébergé, par paire de langues | **S** |
| N3 | Traduction par appel à un modèle généraliste, avec le contexte d'interface | **S** |

**Point de rupture N0** : toute chaîne nouvelle n'a aucune correspondance et reste à traduire.

### 23. `convert-messy-csv-to-clean-data` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Détection du dialecte, normalisation d'encodage, coercition typée avec journal des rejets | **E** |
| N1 | Inférence du type de colonne par classifieur sur des traits d'échantillon | **E** |
| N2 | — Un modèle auto-hébergé pour deviner qu'une colonne contient des dates est hors sujet | — |
| N3 | Traitement des seules lignes rejetées par N0, par appel à un modèle généraliste | **S** |

**Point de rupture N0** : un fichier dont les colonnes changent de sens en cours de route,
ou dont les séparateurs sont incohérents d'une ligne à l'autre.

---

## Reconnaître et transcrire

### 24. `read-text-from-a-scanned-page` — verdict attendu **N2**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Vérifier d'abord qu'une couche de texte existe déjà dans le document et l'extraire | **E** |
| N1 | — Un OCR par segmentation de caractères écrit à la main est un projet de plusieurs mois, pour un résultat très inférieur aux moteurs existants | — |
| N2 | Moteur de reconnaissance optique auto-hébergé | **S** |
| N3 | Lecture par appel à un modèle généraliste multimodal | **S** |

**Point de rupture N0** : une page réellement scannée n'a pas de couche de texte.
C'est le premier réflexe à avoir, pas une solution générale.

---

## Décider et valider

### 25. `validate-a-form-server-side` — verdict attendu **N0**

| Niveau | Approche | Preuve |
|---|---|---|
| N0 | Schéma de validation déclaratif, avec messages d'erreur par champ | **E** |
| N1 | — Une règle métier n'a rien à apprendre : elle est écrite, connue et opposable | — |
| N2 | — Idem | — |
| N3 | — Une validation doit refuser de façon déterministe et justifiable. Un modèle qui accepte parfois et refuse parfois la même saisie ne valide rien | — |

**Point de rupture N0** : aucune règle ne dit si une adresse existe réellement ; cela
demande une vérification externe, qui est un autre besoin.

---

## Récapitulatif

Chiffres obtenus en analysant ce fichier, par `node scripts/build-snippet-manifest.mjs`.

| Niveau | Disponibles | Absents | `executed` | `stubbed` |
|---|---|---|---|---|
| N0 | 25 | 0 | 25 | 0 |
| N1 | 20 | 5 | 20 | 0 |
| N2 | 13 | 12 | 0 | 13 |
| N3 | 16 | 9 | 0 | 16 |
| **Total** | **74** | **26** | **45** | **29** |

74 niveaux disponibles × 2 langages = **148 extraits**, plus autant de tests, soit
**296 fichiers**.

Les 45 extraits `executed` couvrent la totalité des niveaux N0 et N1, c'est-à-dire
exactement les approches que le site recommande le plus souvent. Les 29 extraits `stubbed`
sont tous sur N2 et N3, où l'exécution en intégration continue exigerait un modèle de
plusieurs centaines de mégaoctets ou une clé d'API payante.

Vingt-six niveaux sont déclarés absents, chacun avec une raison écrite. C'est un quart de
la grille : une fiche qui présenterait quatre niveaux disponibles à chaque fois serait une
fiche qui n'a pas choisi.
