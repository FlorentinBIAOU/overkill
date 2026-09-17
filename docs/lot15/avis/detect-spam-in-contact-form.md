# detect-spam-in-contact-form — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs detect-spam-in-contact-form` : vert, 3 py, 3 js.

### Raisons du refus

1. **[pertinence technique]** N0, `reasons(fields, seconds_on_page)`, et le
   `scenario` : un script « se trahit […] s'il envoie plus vite qu'une personne
   ne tape ». Le contrôle de délai ne vaut que si `seconds_on_page` est **mesuré
   par le serveur** à partir d'une valeur que le client ne peut pas forger.
   L'extrait le reçoit en argument et ni la docstring, ni la fiche, ni l'essai
   ne disent d'où il vient. La mise en œuvre que le lecteur écrira spontanément
   — un champ caché rempli en JavaScript avec l'heure d'affichage — est
   contournée par n'importe quel script, qui enverra `seconds_on_page=10`. C'est
   un contrôle de sécurité dont l'implémentation naïve ne contrôle rien, et la
   fiche le présente comme un des deux contrôles « qui ne coûtent rien ».

   Ce qu'il faut faire : dire dans la docstring d'en-tête et dans le
   `breaking_point` ou le `name` que le délai se calcule côté serveur depuis un
   horodatage émis au rendu du formulaire et **signé** (HMAC avec un secret du
   serveur), vérifié à la soumission ; idéalement fournir les quelques lignes
   (`hmac` et `time` en Python, `node:crypto` en JavaScript, sans dépendance)
   avec un test : un horodatage modifié ou non signé compte comme « trop
   rapide ». Même précision pour le pot de miel : il doit être masqué par la
   feuille de style, pas par `type="hidden"`, que les scripts savent ignorer
   (la page de Ned Batchelder citée le dit).

2. **[preuves]** Marquages `INFIRMÉ` encore actifs, et adaptateur N3 non testé.
   - `n1` (py, js), `INFIRMÉ` : « les graphies contournées survivent aux
     n-grammes » (`b a c k l i n k s`). **Périmé** : la docstring dit désormais
     l'inverse (« shares none: no n-gram crosses a space »).
   - `n1.test.js`, `INFIRMÉ` : « un n-gramme que tout message porte says
     nothing ». **Périmé**, la phrase n'est plus dans l'extrait.
   - `n3` : **aucun test ne fait tourner `ProviderClient` / `providerClient`**
     sur `_harness/fake_sdk.py` / `fake-sdk.mjs`.

   Ce qu'il faut faire : réécrire les deux tests `n1` sur la phrase actuelle
   (un mot épelé ne partage aucun n-gramme avec le mot entier : c'est
   démontrable), sans marquage ; ajouter le test de l'adaptateur. C'est fait
   quand le dossier ne contient plus aucun marquage et que l'adaptateur a son
   test dans les deux langages.

### Remarques non bloquantes

- **Volume d'étiquetage.** Le verdict N1 suppose des envois étiquetés « pris
  parmi ceux que la boîte de réception a déjà reçus ». Un formulaire de contact
  de PME en reçoit quelques dizaines par mois ; un classifieur utile en demande
  des centaines par classe. La fiche gagnerait une phrase qui dit à partir de
  quel flux N1 devient réaliste, et que N0 reste la réponse en dessous.
- **L'alternative que le lecteur a en tête n'est pas nommée.** Les défis
  anti-robots gérés (Turnstile, hCaptcha, reCAPTCHA) et les services de
  filtrage de commentaires sont ce que la plupart des sites branchent. Ils
  font sortir des données vers un tiers et ajoutent une friction ; la fiche a
  les arguments pour les écarter, elle ne les donne pas.
- Le « robot patient » est désormais souvent un message écrit par un modèle de
  langue, poli et sans lien : c'est exactement le point de rupture des deux
  niveaux, et la fiche a raison de le dire.

### Ce qui est solide

- Le `scenario` a le bon ordre : regarder l'expéditeur avant le texte, et ne
  lire que ce qui passe les contrôles gratuits.
- N0 rend des motifs, pas un booléen : « a rejection you cannot explain is a
  rejection you cannot tune » est une leçon d'exploitation réelle. Les gardes
  sont sérieuses (délai `NaN` compté comme trop rapide, un lien compté une
  fois, domaine d'une adresse électronique non compté comme lien).
- Le `breaking_point` de N3 sur l'injection est exemplaire : il dit ce que le
  double simule, et ce que le test prouve réellement — que le code n'a aucune
  parade si le modèle obéit.
