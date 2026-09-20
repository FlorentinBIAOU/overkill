# extract-fields-from-a-log-line — avis du relecteur

## Tour 1 — REFUSÉE

L'argument du volume est imparable et bien posé, la notation nommée écrite une
fois pour les deux langages est la bonne idée, et le journal des rejets est
exactement ce qu'il faut : une ligne qui ne correspond pas n'est jamais perdue.
J'ai cherché un effondrement d'expression régulière sur une ligne hostile — une
ligne sans deux-points de trois mille caractères, une ligne Apache tronquée au
milieu d'un champ entre guillemets — et il n'y en a pas. Le refus porte sur les
motifs livrés et sur l'exemple du point de rupture.

### Raisons du refus

1. **Le motif `syslog-3164` livré rejette la totalité d'un fichier de journal
   ordinaire.** `n0.py:52-54` : le motif commence par `<%{INT:priority}>`. Or
   la priorité entre chevrons n'existe que sur le fil — le paquet UDP 514 — et
   elle est retirée par le collecteur avant écriture. Une ligne de
   `/var/log/syslog`, de `/var/log/auth.log` ou de la sortie de `journalctl`
   s'écrit `Oct 10 13:55:36 serveur1 sshd[1234]: …`, sans chevrons. Mesuré :

   ```
   syslog : lues 1, rejetées 2
      rejet ligne 2  Oct 10 13:55:36 serveur1 sshd[1234]: Failed password for root
      rejet ligne 3  Oct 10 13:55:36 serveur1 systemd[1]: Started Session 3 of user jean.
   ```

   Seule la ligne avec `<34>` passe, et c'est la seule que le test contient.
   Le commentaire qui introduit les trois motifs dit : « Three formats that
   cover most of what lands in a log directory ». Un motif qui rejette cent
   pour cent des lignes du répertoire de journaux de n'importe quelle machine
   ne couvre rien. C'est R1 : l'extrait n'a pas été passé sur l'entrée
   ordinaire de son lecteur avant d'être publié.

   Correctif : rendre la priorité facultative — `(?:<%{INT:priority}>)?` dans
   la notation, ce qui demande d'ajouter un morceau optionnel —, ou livrer deux
   motifs, `syslog-3164-wire` et `syslog-3164-file`, et dire lequel sert quand.
   On saura que c'est fait quand les trois lignes ci-dessus seront lues toutes
   les trois, et quand le test contiendra une ligne sans chevrons.

2. **Le point de rupture attribue son résultat à un changement qu'il n'a pas
   fait.** `breaking_point`, fr et en : « décrire l'horodatage par
   `%{DATA:timestamp}` rend timestamp « Oct », host « 10 » et tag
   « 13:55:36 serveur1 sshd[1234] » ». Le motif réellement exécuté par le test
   (`n0.test.py:23`, constante `LACHE`) relâche **deux** morceaux : le
   `timestamp` *et* le `tag`, qui passe de `%{NOTCOLON:tag}` à `%{DATA:tag}`.
   Si l'on ne relâche que l'horodatage, comme la phrase le dit, le découpage
   obtenu est différent — je l'ai exécuté :

   | | fiche | en ne relâchant que l'horodatage |
   |---|---|---|
   | `timestamp` | `Oct` | `Oct 10` |
   | `host` | `10` | `13:55:36` |
   | `tag` | `13:55:36 serveur1 sshd[1234]` | `serveur1 sshd[1234]` |

   La démonstration reste vraie dans les deux cas — un motif lâche découpe faux
   sans rien rejeter — mais un lecteur qui reproduit l'exemple tel qu'il est
   écrit n'obtient pas les valeurs publiées. La charte demande que l'exemple du
   point de rupture soit celui du test, mot pour mot. Écrire « décrire
   l'horodatage **et l'étiquette** par `%{DATA}` », ce qui est ce qui a été
   mesuré.

### Remarques non bloquantes

1. **Apache échappe les guillemets, et `%{QUOTED}` ne le sait pas.**
   `QUOTED = [^"]*` : une ligne dont l'agent ou la requête contient un `\"` —
   ce qu'`mod_log_config` écrit, et que produisent quotidiennement les
   scanners — est rejetée. Vérifié :
   `… "GET /a\"b HTTP/1.1" 404 512 "-" "curl/8.5.0"` part au rejet. Le refus
   est bruyant, donc conforme à l'esprit de la fiche, mais c'est du trafic
   ordinaire et le morceau se corrige en `(?:[^"\\]|\\.)*`. À défaut, le dire.

2. **Le `%{DATA}` lâche mérite mieux qu'un exemple.** Puisque la fiche démontre
   qu'un morceau trop lâche découpe faux en silence, `compile_pattern` pourrait
   refuser `%{DATA}` et `%{GREEDY}` ailleurs qu'en dernière position, ou au
   moins le signaler dans le rapport. C'est une suggestion, pas une exigence ;
   mais la fiche a l'argument sous la main et ne s'en sert pas.

3. **R11 — `breaking_point` de 72 mots et trois phrases.** La règle en demande
   deux. Voir la synthèse.

### Ce qui est solide

- Le journal des rejets, avec le numéro de ligne et la ligne elle-même, et la
  phrase qui le justifie : « a log parser that quietly loses one line in twenty
  is worse than one that parses none ». C'est R2 appliquée à la lettre, et
  c'est ce qui rend les deux défauts ci-dessus réparables plutôt que
  dangereux.
- Le refus de transformer « Oct 10 13:55:36 » en instant, parce que la RFC 3164
  ne porte ni année ni fuseau : l'ambiguïté est rendue à l'appelant au lieu
  d'être tranchée. C'est la bonne décision et elle est expliquée.
- La notation nommée écrite une fois pour les deux langages, avec la raison
  exacte — `(?P<name>…)` contre `(?<name>…)` — est la meilleure justification
  du lot pour réimplémenter plutôt qu'emprunter.
- Les morceaux sont délibérément lâches, et le commentaire dit pourquoi : « a
  log parser that refuses a line because an address was unusual has lost the
  line ». C'est le bon arbitrage, et il est assumé par écrit.
- L'`escalate_when` est le meilleur du lot : la liste des rejets qui grossit
  est un événement observable, mesurable, et la suite qu'il indique n'est pas
  un niveau supérieur mais la lecture de ces lignes.
- Le test de la trace d'exception — une ligne qui correspond et trois qui ne
  correspondent pas mais portent l'information — est un vrai cas de
  production, et il montre que le rejet n'est pas une perte.
