# Lot 15 — décisions prises seul

Tenu au fil du lot. Chaque décision, avec l'alternative écartée.

1. **Commits par fiche à chaque passe, contrôle complet en fin de passe.** La
   mission demande à la fois « une passe se termine par un commit » et « un
   commit par fiche ». Chaque rôle commite chaque fiche qu'il termine ; la passe
   se clôt par `npm run check` vert et un repère (`lot15-passe1`). Écarté : un
   commit par passe, qui ferait perdre une passe entière sur une coupure.
2. **Un marquage strict pour les affirmations fausses.** Le testeur ne touche ni
   fiche ni code, mais la suite doit rester verte : un test d'affirmation
   infirmée est marqué `INFIRMÉ :` (`xfail(strict=True)` en Python, enveloppe
   `assert.rejects` en JavaScript), et passe au rouge dès que la correction
   arrive. Écarté : laisser les tests rouges (la passe 1 ne pourrait pas se
   clore) ou `todo` en JavaScript (non strict, oubliable).
3. **Le rédacteur retire un marquage, rien d'autre.** Seule entorse au partage
   des rôles, mécanique et sans changement d'assertion. Tout autre test à
   reprendre va à une contre-épreuve du testeur avant la relecture. Écarté :
   laisser le rédacteur ajuster les tests, ce qui lui ferait valider son travail.
4. **Une contre-épreuve du testeur entre passe 2 et passe 3.** « Toute
   correction repasse par les tests » : les tests contredits par une réparation
   ne peuvent être repris que par le testeur. Les commits de fiche du rédacteur
   peuvent donc être rouges sur les seuls tests listés « À retester » ; la passe
   2 se clôt verte après la contre-épreuve. Écarté : faire relire des fiches
   dont les tests décrivent encore l'ancien code.
5. **Le client N3 par défaut devient un adaptateur écrit dans chaque extrait.**
   Les trente-deux extraits N3 appelaient une méthode `complete` que le kit
   `openai` n'a pas. Écarté : un module partagé dans `_harness/` ou ailleurs —
   l'extrait ne serait plus autonome et le lecteur ne verrait plus le vrai code
   d'appel. Écarté aussi : garder `complete` et l'expliquer, ce qui publie du
   code faux.
6. **L'adaptateur ne compte pas dans les quarante lignes.** Il est identique
   d'une fiche à l'autre et ne porte aucune logique de fiche. Écarté : réduire
   la plomberie des N3 (plafond, réessai, décodage) pour tenir la limite, alors
   que c'est précisément ce que ces niveaux doivent montrer.
7. **`gpt-4.1-mini` comme identifiant d'exemple.** Présent dans la liste des
   modèles du kit publié, et il accepte `temperature`, que tous les extraits
   passent. Le commentaire dit que c'est un exemple et qu'il faut vérifier les
   paramètres du modèle choisi. Écarté : un modèle de raisonnement plus récent,
   dont la prise en charge de `temperature` n'est pas garantie ; un identifiant
   lu dans une variable d'environnement, qui cache la valeur au lecteur.
8. **Un double à la forme du vrai kit dans le harnais** (`fake_sdk.py`,
   `fake-sdk.mjs`), sans méthode `complete`. Écarté : les vingt-six copies
   locales écrites par les testeurs, qui divergeraient.
9. **`extract-fields-from-invoice` en brouillon au tour 1.** Son niveau
   recommandé ne peut pas tourner tel qu'écrit. Écarté pour l'instant : changer
   le verdict sans relecture, ou publier un N2 dans un seul langage.
