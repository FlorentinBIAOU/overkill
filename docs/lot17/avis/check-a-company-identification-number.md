# check-a-company-identification-number — avis du relecteur

## Tour 1 — ACCEPTÉE

Fiche solide. Le cas est réel — tout formulaire d'inscription B2B français
demande un SIREN —, l'outil retenu est bien celui qu'on branche en premier
(R3), et le verdict est démontré et non seulement affirmé : le test
réimplémente la clé de Luhn à la main et montre qu'elle répond faux sur
`35600000009075`. C'est exactement ce que R4 demande, et c'est rare.

### Remarques non bloquantes

1. **Parité — `expected` non trié en JavaScript.** `n0.js:70`,
   `if (!(kind in VALIDATORS))` : l'opérateur `in` remonte la chaîne de
   prototypes, donc `checkCompanyNumber('732829320', { expected: 'toString' })`
   passe le test, puis `const [length, isValid] = VALIDATORS['toString']`
   lève `TypeError: function is not iterable`. Même chose avec `constructor`
   et `__proto__`. Python, lui, rend `{valid: false, reason: "9 digits:
   expected nine or fourteen"}`. Deux conséquences : la docstring « Nothing
   here throws on bad input » est fausse d'un côté, et les deux extraits ne
   rendent pas la même chose sur la même entrée. Le test
   `aucune entrée ne lève` (`n0.test.js:141`) ne fait varier que `raw`, jamais
   `expected` — il ne pouvait pas l'attraper. Correctif d'une ligne :
   `Object.hasOwn(VALIDATORS, kind)`. Non bloquant parce que `expected` est
   fourni par le développeur, pas par l'utilisateur du formulaire ; à corriger
   au prochain passage, avec l'entrée ajoutée au test de parité.

2. **Un retour à la ligne collé n'est pas un séparateur.** `732 829 320\n`,
   ce qu'on obtient en copiant un numéro depuis une page web ou un PDF de
   Kbis, revient `valid: false`, `reason: "not digits and separators only"`.
   Le refus est bruyant, donc conforme à R2 — le lecteur n'est pas trompé —,
   mais c'est une entrée ordinaire du public visé (R1) qui échoue pour rien.
   Soit `\n`, `\r` et `\t` entrent dans `SEPARATORS`, soit un blanc de bord
   est retiré avant le nettoyage.

3. **R11 — `breaking_point` de 67 mots.** Deux phrases, un exemple, un
   témoin : la structure est respectée, la longueur non. La charte cite
   soixante mots comme le seuil au-delà duquel un point de rupture « ne se lit
   plus ». Celui-ci est le plus court du lot ; le problème est général et est
   traité dans la synthèse.

### Ce qui est solide

- Le témoin du point de rupture est exhaustif, pas anecdotique : les 36
  substitutions d'un chiffre sur quatre numéros, toutes refusées. Un test de
  rupture qui porte son témoin de cette façon ne peut pas passer sur un
  extrait cassé partout.
- `test_lexception_ne_vaut_que_pour_le_siren_de_la_poste` est le bon réflexe :
  il vérifie que l'exception n'a pas été écrite trop large.
- L'exclusion des chiffres Unicode non ASCII (`isascii()` avant `isdigit()`)
  est un piège Python réel, traité, commenté et testé.
- Le plafond de 64 caractères refuse et n'explose pas sur un mégaoctet collé
  (R8), et le test le mesure.
- `sources` porte la phrase lue pour chaque chiffre avancé (R12), y compris la
  règle INSEE du multiple de cinq.
- Le renvoi vers Sirene est dans le verdict et l'`escalate_when`, pas dans
  l'échelle : un service public n'est pas une méthode, et la fiche s'y tient.
