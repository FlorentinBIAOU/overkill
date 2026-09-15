# validate-a-form-server-side — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets validate-a-form-server-side` **rouge** sur les seuls tests listés
dans « À retester » (3 en Python, 2 en JavaScript). Aucune assertion n'a été
touchée. Le relevé ne portait aucune affirmation infirmée ; trois défauts.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#9, #20) | « compared with the JavaScript one that guards the same form in the browser » | Test : `\d{5}` accepte « ١٢٣٤٥ » en Python et le refuse en JS ; `\w+` accepte « Zoé » en Python et le refuse en JS. `re.ASCII` en Python, essayé, alignait `\d` et `\w` mais désalignait `\s` (U+00A0 accepté en Python, refusé en JS) : écarté. JSON Schema désigne d'ailleurs le dialecte ECMA-262 pour `pattern` | « handed to the JavaScript version […]. A pattern means the same thing on both sides only with explicit classes: the shorthands for a digit and a word character reach beyond ASCII in Python and stop at it in JavaScript, so write [0-9] and [A-Za-z]. » |
| N0 regulatory (#17) | « jamais la valeur saisie : ce qui atterrit dans vos journaux d’erreur reste ce que vous y mettez » | Conséquence de la réparation #21 : un champ non déclaré apparaît en clé de la réponse, avec le nom envoyé | « … à ceci près qu’un champ non déclaré est nommé tel qu’il a été envoyé » |

## Retiré

Rien.

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0 py/js (#19) | bornes comptées en points de code (py) et unités UTF-16 (js) : « é » NFD en vaut deux, « 🙂 » accepté en JS et refusé en Python | Longueur comptée en points de code après composition NFC, dans les deux langages ; limite écrite en commentaire : un emoji fait de plusieurs points de code (drapeau, famille) en compte plusieurs |
| n0 py/js (#21) | champ hors schéma (« is_admin ») rendu `{}` : assignation de masse | Tout champ non déclaré reçoit « is not a field of this form » (liste d'autorisation, aide-mémoire OWASP) |
| n0.py (#25) | motif sur un entier : `TypeError` en Python, accepté en JS | Le motif s'applique au texte de la valeur (`str(value)` / `String(value)`), identique dans les deux |
| n0.py (#14) | `36.0` refusé en Python, entier en JS | Un flottant entier (`is_integer`) est un entier, comme `Number.isInteger` ; NaN et l'infini restent refusés |
| n0 py/js (#20) | même motif, deux sens | Non réparable sans réécrire les motifs ; limite écrite dans la docstring (voir Corrigé) |

Marquages retirés (assertions inchangées) : 2 `DÉFAUT` py, 2 `DÉFAUT` js
(bornes, champ hors schéma). Le `DÉFAUT` « un même motif » reste marqué dans
les deux langages, et échoue toujours : voir « À retester ».

Lignes utiles : sous quarante dans les deux langages (le test « un validateur
tient en quarante lignes » passe).

## Sources consultées

- OWASP, *Input Validation Cheat Sheet* : « Allowlist validation involves defining exactly what IS authorized » ; validation côté serveur obligatoire — conforme au libellé.
- MDN, *Client-side form validation* : « client-side validation should not be considered an exhaustive security measure » — conforme au libellé.
- JSON Schema 2020-12, *Validation* : `minLength` en caractères au sens de RFC 8259, `pattern` en dialecte ECMA-262, non ancré.
- OWASP GenAI, *LLM01 Prompt Injection* : « user prompts alter the LLM's behavior or output in unintended ways » — ajouté en lecture complémentaire, il source la dernière phrase de l'`unavailable_reason` de N3.
- WHATWG HTML, *valid e-mail address* : lien existant.

## À retester

- **`DÉFAUT : un même motif…`** (py/js, toujours marqués) : la réparation est une limite écrite ; retourner le test en démonstration (« \d et \w divergent ; [0-9] et [A-Za-z] rendent le même verdict dans les deux langages »).
- **Bornes** (js `les bornes ne comptent pas des caractères perçus`) : la dernière ligne, hors de l'ancienne enveloppe, attend encore que « 🙂 » passe ; il est désormais refusé comme en Python. Ajouter un drapeau (« 🇫🇷 », deux points de code) accepté à `min: 2` dans les deux langages.
- **Champ hors schéma** : `validate(VALID, {})` (py/js `production : schéma vide…`) rend désormais une erreur par champ ; tester le message exact « is not a field of this form », et une clé héritée (`toString`, `__proto__`) en JS.
- **Imports** (py `test_n0_est_deterministe_et_n_emploie_que_la_bibliotheque_standard`) : `{re, unicodedata}`.
- **Motif sur un entier** (py `test_production_un_motif_sur_un_entier_fait_lever_en_python`) : accepté (« 36 » correspond à `\d+`), comme en JS.
- **36.0** : entier en Python ; 36.5, NaN, `float("inf")` refusés.
- **Noms** : tests démarqués encore nommés d'après le défaut (`test_defaut_…`, « ne comptent pas des caractères perçus », « passe sans un mot »).

## Pour l'orchestrateur

- Les `unavailable_reason` de N1, N2 et N3 sont des arguments de conception sans code ; je les ai gardés, la dernière phrase de N3 étant désormais sourcée (OWASP LLM01).
- Le schéma d'exemple des tests et de l'essai refuse « ada@EXAMPLE.COM » et une adresse entourée d'espaces (précision #24) : c'est de la donnée d'exemple que je n'ai pas le droit de toucher dans les tests ; l'essai (`content/tryouts/live/validate-a-form-server-side.js`) n'a pas été modifié non plus, pour garder le même schéma que les tests.
