# summarise-a-long-document — vérification du lot 16

Avis d'origine : `docs/lot15/avis/summarise-a-long-document.md` (REFUSÉE).

## Motif 1 — le verdict promettait ce que le plafond de N3 refusait

**Le refus.** Le verdict donne N3 comme « le seul niveau qui écrive une phrase
que personne n'a écrite sans vous coûter […] une découpe en plusieurs passes ».
Or `MAX_CHARACTERS = 40000` levait au-delà d'une quinzaine de pages, c'est-à-dire
exactement sur le document que le `need` décrit : un rapport de cinquante pages,
un contrat avec annexes. Pour eux, N3 refusait, et le lecteur retombait sur la
découpe que le verdict prétendait lui épargner.

**Ce qui a été fait.** La seconde branche de l'avis : le plafond est relevé à ce
que la fenêtre du modèle d'exemple accepte, et il devient explicitement le
plafond de l'appelant.

- **`max_characters` / `maxCharacters` est un paramètre**, refusé avant l'appel.
  La docstring le dit : « refused before the call, not after: the provider bills
  the input whether the answer is useful or not ».
- **Le défaut est dérivé de la fenêtre, pas choisi au hasard**, et le commentaire
  donne la dérivation : « that window is 1,047,576 tokens, and a token never
  stands for less than one character, so a million characters cannot overflow
  it. It is not a cost ceiling. » Un jeton ne codant jamais moins d'un
  caractère, un million de caractères ne peut pas déborder cette fenêtre : c'est
  une borne sûre, pas une estimation du nombre de jetons.
- **La fenêtre est vérifiée à la source et citée** : fiche du modèle gpt-4.1-mini
  chez OpenAI, « 1,047,576 context window », « 32,768 max output tokens ».
- **Le verdict porte la conséquence** : « la fenêtre du modèle d'exemple fait
  1 047 576 jetons, de sorte qu'un rapport de cinquante pages part en un appel et
  en entier ».
- **L'essai figé se donne son propre plafond** (2 000 caractères, qui tient sur
  la page) au lieu de fabriquer un document d'un million de caractères ; son cas
  de refus s'appelle désormais « un document au-dessus du plafond fixé ».

**La preuve.** Trois tests par langage :
`le plafond est celui de l'appelant, et il est refusé avant toute dépense`
(2 001 caractères refusés sans appel, 2 000 acceptés — témoin),
`un rapport de cinquante pages part en un seul appel` (150 000 caractères, un
appel, le document entier dans l'invite), et
`le plafond par défaut est celui de la fenêtre du modèle d'exemple`
(`MAX_CHARACTERS == 1 000 000`, un caractère de plus est refusé sans appel).

## Motif 2 — N2 ne résume que l'anglais, et la fiche ne le disait pas

**Le refus.** `sshleifer/distilbart-cnn-12-6` est distillé d'un modèle affiné sur
CNN/DailyMail : des dépêches anglophones. Le site est d'abord francophone, les
exemples de la fiche sont en français, et rien n'avertissait le lecteur.

**Ce qui a été fait.** La première branche, augmentée de ce que la seconde
demandait de vérifier.

- **Le `name` du niveau porte la langue** : « Modèle de résumé abstractif
  auto-hébergé (anglais) ».
- **Le `breaking_point` commence par là**, avant l'invention : « sa fiche déclare
  `language: en` […] Rien dans l'extrait ne le refuse : un document français y
  entre, et une réponse en sort — le test le montre. »
- **Les deux docstrings et leur traduction le disent aussi**, avec l'alternative
  et son prix : mT5 affiné sur XL-Sum, quarante-cinq langues dont le français,
  sous CC BY-NC-SA 4.0, qui exclut l'usage commercial. « Read the card before you
  pick, and read it for the language first. »
- **Le verdict en tient compte** : « Pour un lecteur francophone, cela départage
  aussi N2 […] tant que le modèle n'est pas changé, N2 n'est pas une option sur
  un document français. »
- **Le périmètre réglementaire du niveau** distingue les deux licences : Apache
  2.0 pour le point de contrôle nommé, usage commercial exclu pour l'équivalent
  multilingue.
- **Tout est vérifié sur les fiches des modèles et cité en `sources`** : pour
  distilbart, `language: en`, jeux `cnn_dailymail` et `xsum`, licence Apache 2.0,
  306 M de paramètres et 307 ms par inférence sur le banc de l'auteur (ce qui
  source aussi `latency: >1 s` et `cost: modéré`, que l'avis notait non sourcés) ;
  pour mT5 XL-Sum, les 45 langues, la licence et les ROUGE français publiés.

**La preuve.** `point de rupture : un document français part au modèle anglais
sans un mot`, dans les deux langages : le texte français arrive intact au modèle
(`model.calls == [french]`), la réponse est rendue telle quelle, et l'anglais
suit le même chemin — témoin. Ce que le test établit est le silence de la
plomberie, pas ce qu'un vrai modèle écrirait, et sa docstring le dit.

## Motif 3 — marquages périmés et adaptateur N3 non testé

**Le refus.** Trois `INFIRMÉ` encore actifs sur des phrases retirées de la
fiche, et aucun test ne faisait tourner `ProviderClient` / `providerClient`.

**Ce qui a été fait.**

- **`n1.test.js`, `INFIRMÉ : la régression logistique « is a dozen lines »`** :
  supprimé. La phrase n'existe plus, et aucun test n'épingle plus un nombre de
  lignes ; `l'extrait n'importe rien` couvre ce que la docstring dit désormais.
- **Les deux `INFIRMÉ : le modèle découvre que la conclusion compte, et N0
  jamais`** (py, js) deviennent
  `une conclusion ne gagne que par ce qu'elle porte, jamais par sa place`, qui
  démontre la nouvelle docstring : la même conclusion avec « Overall » est
  retenue, sans l'indice elle sort du résumé ; le trait de position vaut
  `1 / (rang + 1)`, soit 1 pour la première phrase et 1/11 pour la dernière, et
  ne sait pas dire « la dernière » ; témoin, N0 garde la conclusion dans les deux
  cas.
- **L'adaptateur N3 est exercé** contre `_harness/fake_sdk.py` et `fake-sdk.mjs`,
  dans les deux langages (règle T2) : `chat.completions.create` avec `model`,
  `messages` et `temperature: 0`, réponse lue dans `choices[0].message.content`,
  un `content` nul qui lève `SummaryUnavailable` après trois appels, et une panne
  du kit retentée deux fois puis trois.
- **Les noms qui décrivaient encore un défaut réparé** sont réécrits sur ce
  qu'ils prouvent, dans les deux langages : « un document NFD coupe ses mots
  accentués » → « est découpé comme sa forme composée » ; « un document sans
  ponctuation finale est rendu entier » → « une transcription sans ponctuation
  finale est découpée par lignes » ; « la seconde passe dépasse la fenêtre » →
  « les passes suivantes tiennent elles aussi dans la fenêtre » ; les préfixes
  `test_defaut_` restants sont retirés.
- **Deux tests toléraient encore les deux comportements** (`try` / `except
  ValueError: pass` autour d'un nombre de phrases négatif, en N0 et N1) : ils
  affirment maintenant le refus, et que zéro rend une chaîne vide.

**La preuve.** `node scripts/test-snippets.mjs summarise-a-long-document` :
**8 extraits, 4 py, 4 js, aucun échec**, et plus aucun `INFIRMÉ`, `DÉFAUT` ni
`xfail` dans le dossier.

## Remarques non bloquantes de l'avis

- **N2 `cost` et `latency` non sourcés** : sourcés, voir le motif 2.
- **`scenario` qui assume un verdict N3** : gardé tel quel, l'avis le donne pour
  une qualité.
- **Points de rupture de N0 et N1 en plus de deux phrases** : ils en font quatre
  chacun, et n'ont pas été raccourcis davantage. Chacune porte un fait distinct
  et mesuré — la phrase la moins bien notée des onze, tombée la première même
  quand on en demande huit ; la phrase retenue pour ses quatre signes alors
  qu'elle annonce une commande de porte-blocs. Les fondre en deux phrases
  retirerait la mesure, pas des mots.

## État

**Levée.** `test-snippets` vert (8 extraits) ; `check-content`, `check-figures`,
`check-french` verts (`sum`, de XL-Sum, ajouté au lexique) ; `npm run
check:fast` vert.
