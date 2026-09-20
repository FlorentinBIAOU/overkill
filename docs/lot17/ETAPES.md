# Lot 17 — étapes

Une ligne par fiche terminée : la fiche, son verdict, l'outil standard entré
dans l'échelle s'il y en a un, ce qui reste ouvert.

Une reprise après coupure se fait en lisant ce fichier et en repartant de la
fiche suivante.

| # | Fiche | Verdict | Outil standard | Reste ouvert |
|---|---|---|---|---|
| 1 | `check-a-company-identification-number` | N0 | `python-stdnum` 2.2 / `stdnum-js` 1.12.6 — la clé, et l’exception La Poste qu’un Luhn écrit à la main rate | Le répertoire Sirene est nommé dans le verdict et les liens, il n’est pas un niveau : ce n’est pas un modèle. N1, N2 et N3 fermés. |
| 2 | `check-bank-details-before-a-transfer` | N0 | `python-stdnum` 2.2 / `ibantools` 4.5.4 pour ISO 13616 et le registre ; la clé RIB française est écrite dans l’extrait, faute de couverture identique des deux côtés | La vérification du bénéficiaire (règlement UE 2024/886) est nommée dans le verdict, elle n’est pas un niveau : c’est un service du prestataire. N1, N2 et N3 fermés. |
| 3 | `validate-a-phone-number-and-its-country-code` | N0 | `phonenumbers` 9.0.39 / `libphonenumber-js` 1.13.13 (lot « max ») | Deux divergences entre les deux bibliothèques fermées dans l’extrait (espace fine, lettres lues au clavier téléphonique). N1, N2 et N3 fermés. |
| 4 | `validate-an-email-address-without-sending-a-message` | N0 | Aucune : les deux bibliothèques (`email-validator` 2.3.0, `validator.js` 13.15.35) sont écartées avec une raison mesurée — quatre désaccords entre elles et quatorze avec le navigateur sur trente-deux adresses. L’extrait transcrit l’expression régulière du standard HTML. | Le contrôle DNS/MX est nommé dans le verdict, il n’est pas un niveau. Essai interactif, le premier du lot. N1, N2 et N3 fermés. |
