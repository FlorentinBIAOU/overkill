# generate-placeholder-images — corrections du rédacteur (tour 1)

Relevé : aucune affirmation infirmée, un `DÉFAUT`, cinq points non testables.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 docstring (py, js, `doc.fr.yaml`) | « on every machine, in every language, for ever » / « sur chaque machine, dans chaque langage, pour toujours » | Le test ne démontre que l'accord Python / Node et l'épinglage du balisage (relevé, rang 7) ; « chaque machine » et « pour toujours » ne se démontrent pas | « in Python as in JavaScript, for as long as this code is left unchanged » / « en Python comme en JavaScript, tant que ce code reste inchangé » |
| N0 docstring de `stable_hash` / `stableHash` | « FNV-1a on 32 bits » | La page de référence de Landon Curt Noll définit FNV-1a sur des octets ; l'extrait itère sur les points de code. Identique sur ASCII (vecteurs `""`, `"a"`, `"foobar"` du test), différent au-delà (« é » vaut un point de code, deux octets UTF-8) | « FNV-1a on 32 bits, fed code points rather than UTF-8 bytes: identical to the reference on ASCII, different from it on any other character » |
| N0 commentaire de `_escape` / `escape` | « it is markup until escaped » (l'échappement suffirait) | XML 1.0, production [2] `Char` : U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, les demi-codets isolés, U+FFFE et U+FFFF n'ont aucune forme permise, échappée ou non | Le commentaire dit que l'échappement ne suffit pas et que ces caractères sont retirés |
| essai, `stable` (fr, en) | « sur toutes les machines, aujourd'hui et dans dix ans » | Même raison que la docstring | « en JavaScript comme en Python, tant que ce code ne change pas » |
| N2 unavailable_reason | « une image dont on ne retrouve pas l'exacte réplique en changeant de version de bibliothèque ou de pilote » | Documentation PyTorch, *Reproducibility* : « Completely reproducible results are not guaranteed across PyTorch releases, individual commits, or different platforms. Furthermore, results may not be reproducible between CPU and GPU executions, even when using identical seeds. » ; Diffusers, *Reproducibility* : les pipelines reposent sur `torch.randn`, et la reproductibilité « is not guaranteed even with an identical seed » | La phrase cite ce que PyTorch ne garantit pas : d'une version à l'autre, d'une plateforme à l'autre, entre processeur et carte graphique, même à graine identique |
| N3 unavailable_reason | « rien ne garantit que le même identifiant redonnera la même image, le modèle du fournisseur changeant sous vos pieds. Un catalogue rendu de nouveau le mois suivant n'aurait plus les mêmes remplaçants. » | Page *Deprecations* du fournisseur : `dall-e-2` et `dall-e-3` arrêtés le 2026-05-12. Page *Pricing* : les modèles de génération d'image sont facturés (au jeton). Rien de consulté ne soutient « le mois suivant » ni « tous changés » | « le modèle qui la dessine a une date de fin. Le fournisseur pris en exemple a arrêté DALL·E 2 et DALL·E 3 le 12 mai 2026 : un catalogue dont les remplaçants venaient de ces modèles ne peut plus les redemander. » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N0 docstring (py, js, `doc.fr.yaml`) | « A placeholder that changed on each render would flicker in a grid and defeat every HTTP cache » | Non testable (relevé, rang 9) et non sourcé ; « defeat every HTTP cache » est de plus discutable : une URL stable se met en cache quel que soit le contenu. La propriété utile est déjà dite par le scénario |
| N2 unavailable_reason | « un service permanent, un accélérateur graphique » | Aucune source consultée n'en fait une nécessité ; la documentation Diffusers montre des exécutions sur processeur |
| N2 unavailable_reason | « que le lecteur prendra pour la vraie » | Prédiction sur le comportement des lecteurs, rien ne la source. Reste : « une image vraisemblable de l'objet absent », qui est ce que produit un modèle de diffusion |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py, n0.js | Un caractère interdit par XML 1.0 (tabulation verticale collée depuis un tableur, etc.) était recopié dans `aria-label` : le SVG servi en `image/svg+xml` n'était plus lisible | Constante `NOT_XML` (même classe de caractères dans les deux langages, drapeau `u` en JavaScript pour ne viser que les demi-codets isolés) ; `_escape`/`escape` retire ces caractères avant d'échapper. Le hachage porte toujours sur l'identifiant brut : l'image ne change pas, seul le nom accessible perd ces caractères. Tabulation, saut de ligne et retour chariot restent (permis, normalisés en espaces par le parseur). Test `DÉFAUT` démarqué dans les deux langages, assertions inchangées |

## Sources consultées

- PyTorch, *Reproducibility* — https://docs.pytorch.org/docs/stable/notes/randomness.html (lue, citation ci-dessus)
- Hugging Face Diffusers, *Reproducibility* — https://huggingface.co/docs/diffusers/using-diffusers/reusing_seeds (lue)
- OpenAI, *Deprecations* — https://developers.openai.com/api/docs/deprecations (lue : lignes `dall-e-2`, `dall-e-3`, arrêt 2026-05-12)
- OpenAI, *Pricing* — https://developers.openai.com/api/docs/pricing (lue : section « Image generation models », facturation au jeton)
- W3C, XML 1.0, production [2] `Char` — https://www.w3.org/TR/xml/#charsets (lue)
- FNV, page de Landon Curt Noll — http://www.isthe.com/chongo/tech/comp/fnv/index.html (lue : FNV-1a sur octets, base 2166136261, premier 16777619)
- W3C SVG-AAM — https://www.w3.org/TR/svg-aam-1.0/ (lue : `aria-label` fournit le nom accessible)
- `further_reading` : les quatre liens répondent 200 et disent ce que la fiche leur prête (SVG 2, FNV, SVG-AAM, Identicon)

## À retester

- Test démarqué (py `test_un_caractere_de_controle_rend_le_svg_mal_forme`, js `un caractère de contrôle est recopié tel quel et rend le SVG mal formé`) : le préfixe seul a été retiré, le nom et le commentaire du test JavaScript disent maintenant le contraire de ce que le test prouve. À renommer, par exemple « production : un caractère de contrôle est retiré et le SVG reste bien formé ».
- Ajouter : U+FFFE, U+FFFF et un demi-codet isolé (JavaScript ; en Python `"\ud800"`) sont retirés du `aria-label` ; tabulation et saut de ligne ne rendent pas le SVG mal formé ; l'image (hors `aria-label`) d'un identifiant avec caractère de contrôle est celle de l'identifiant brut.
- Ajouter : « FNV-1a fed code points rather than UTF-8 bytes » — sur « é », `stable_hash` diffère du FNV-1a 32 bits de référence calculé sur les octets UTF-8, et l'égale sur une chaîne ASCII.
- Rang 7 : l'affirmation n'est plus « on every machine, for ever » mais « in Python as in JavaScript, for as long as this code is left unchanged » ; le test d'accord existant la couvre.

## Pour l'orchestrateur

- Rien.
