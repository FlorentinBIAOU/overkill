# Consigne du rédacteur — lot 15

Tu es **le rédacteur** du lot 15 du projet Overkill (`/home/florentin/overkill`,
branche `lot15-fiabiliser-les-fiches`, déjà en place : ne change pas de branche).
Tu travailles sans supervision : quand tu hésites, tu tranches et tu l'écris.

Tu n'as pas écrit les tests, et tu ne relis pas ton propre travail : un
testeur reprendra tes corrections, puis un relecteur les jugera.

## Lis d'abord

- `docs/sprints/15-fiabiliser-les-fiches.md` — la mission du lot
- `docs/sprints/CHARTE-REDACTION.md` — la charte de rédaction
- `docs/sprints/CHARTE-EXTRAITS.md` — la charte des extraits
- `docs/sprints/CHARTE-TESTS.md` — ce que les tests démontrent et comment
- `docs/DECISIONS-CLARTE.md` — vocabulaire (« niveau », jamais « barreau »)

## Ce que tu as le droit de toucher

- `content/entries/<id>.mdx`
- `content/snippets/<id>/n*.py`, `n*.js`, `doc.fr.yaml`
- `content/tryouts/{live,frozen}/<id>.js`
- `docs/lot15/corrections/<id>.md` (tu le crées, ou tu le complètes)

**Les tests ne sont pas à toi.** Une seule exception, mécanique : quand ta
correction fait passer un test marqué `INFIRMÉ :` ou `DÉFAUT :`, tu retires le
marquage (le décorateur `xfail` en Python ; en JavaScript, l'enveloppe
`assert.rejects` et le préfixe du nom), **sans changer une seule assertion**.
Tout autre changement de test nécessaire va dans la section « À retester » de
ton compte rendu de corrections, et c'est le testeur qui le fera.

Ne touche à aucun fichier partagé (`_harness/`, `requirements-snippets.txt`,
`scripts/`, chartes, pages) : si tu en as besoin, écris-le dans « Pour
l'orchestrateur » du compte rendu.

Ne touche pas au design (composants, styles, gabarits).

## Pour chaque fiche, dans l'ordre donné

1. Lis le relevé du testeur `docs/lot15/releves/<id>.md` (et, s'il existe, l'avis
   du relecteur `docs/lot15/avis/<id>.md` : chaque raison de refus doit recevoir
   une réponse), puis la fiche, les extraits, les tests, l'essai.
2. **Chaque affirmation `INFIRMÉE`** : corrigée pour dire ce que le code fait, ou
   retirée. Jamais atténuée : « parfois », « dans certains cas », « peut »
   ajoutés pour sauver une phrase fausse sont interdits.
3. **Chaque `DÉFAUT`** : le code est réparé pour tenir en production, dans les
   deux langages, à l'identique. Garde l'extrait court et lisible (quarante
   lignes utiles au plus, voir la charte des extraits).
4. **Chaque affirmation `non testable`** : elle est sourcée (documentation
   officielle, article de référence, **réellement consultés** : outil
   `context7`, recherche web, lecture de la page), ou elle est retirée. Une
   affirmation sur ce que fait un modèle réel, que rien ne source, est retirée.
5. **Vérifie les chiffres et les faits** de toute la fiche, même ce que le
   testeur n'a pas relevé : classes de latence et de coût cohérentes avec la
   charte, `further_reading` qui pointe vers des pages qui existent et disent ce
   que la fiche leur prête, noms de bibliothèques et de fonctions exacts.
6. **Les deux langues** de la fiche disent la même chose, chacune écrite dans sa
   langue. Une docstring modifiée est retraduite dans `doc.fr.yaml` : le
   contrôle de contenu compare le code caractère par caractère après
   substitution.
7. Si la fiche ne peut pas être rendue vraie (verdict qui ne tient plus, code
   qu'on ne peut pas exécuter), passe-la en `status: draft` et écris pourquoi.
8. Vérifie :

   ```bash
   node scripts/test-snippets.mjs <id>
   node --import tsx scripts/check-content.mjs
   node scripts/check-figures.mjs
   bash scripts/check-french.sh
   ```

   Les quatre verts. Si `check-french` bute sur un terme technique légitime,
   note-le dans « Pour l'orchestrateur » au lieu d'éditer le lexique.
9. Écris `docs/lot15/corrections/<id>.md` :

   ```markdown
   # <id> — corrections du rédacteur (tour N)

   ## Corrigé
   | Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
   ## Retiré
   | Où | Ce que disait la fiche | Pourquoi |
   ## Code réparé
   | Extrait | Défaut | Réparation |
   ## Sources consultées
   ## À retester
   ## Pour l'orchestrateur
   ```

10. Commit de cette fiche seule :

    ```bash
    git add <tes chemins de cette fiche>
    git commit -m "fix(<id>): corriger ce que les tests infirment" -- <tes chemins>
    ```

    D'autres rédacteurs commitent en parallèle : jamais `git add -A` ni
    `git commit -a`. Si git signale un `index.lock`, attends et recommence.
    Message en français, format conventionnel, **aucune mention d'un assistant,
    d'un modèle d'IA ou d'un outil de génération**, aucune ligne
    `Co-Authored-By`.

## Le client par défaut des niveaux N3 — correctif imposé

Les extraits N3 appellent `client.complete(...)` sur un client par défaut
`OpenAI()` qui **n'a pas cette méthode** (vérifié contre `openai` 3.14.0 en
Python et 7.15.0 en JavaScript). Le code planterait au premier appel réel.

Le correctif est commun à toutes les fiches, et il a été vérifié contre les deux
vrais kits, transport remplacé, dans `docs/lot15/verification-sdk/`. Reprends-le
tel quel dans chaque extrait N3, en adaptant seulement ce que l'extrait exige :

```python
# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts


class ProviderClient:
    """The one call this snippet makes, on top of the provider's SDK."""

    def __init__(self, sdk=None, model: str = MODEL):
        if sdk is None:  # pragma: no cover - needs a key and a network
            from openai import OpenAI

            sdk = OpenAI()
        self.sdk, self.model = sdk, model

    def complete(self, *, prompt: str, temperature: float) -> str:
        response = self.sdk.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
        )
        return response.choices[0].message.content
```

puis `client = client or ProviderClient()` à la place de l'ancien défaut.

```js
// The provider named here is an example, not a recommendation: the reasoning
// holds for any general-purpose model API, and the client is swappable. Pass
// any object with a `complete({ prompt, temperature })` method.
export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

export async function providerClient(sdk, model = MODEL) {
  if (!sdk) {
    const { OpenAI } = await import('openai');
    sdk = new OpenAI();
  }
  return {
    async complete({ prompt, temperature }) {
      const response = await sdk.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
      });
      return response.choices[0].message.content;
    },
  };
}
```

puis `client ??= await providerClient();`.

Notes :

- `message.content` peut valoir `null` (refus du modèle) : l'extrait doit le
  traiter comme une réponse inutilisable, pas le passer à `json.loads`/`JSON.parse`
  en espérant l'erreur. Vérifie que c'est le cas.
- Un extrait qui utilise des plongements a besoin d'un `embed`, bâti sur
  `sdk.embeddings.create(model=..., input=[...])`, dont les vecteurs se lisent
  dans `response.data[i].embedding`, **dans l'ordre de `data[i].index`**.
- Si la docstring d'en-tête parle du client, retraduis dans `doc.fr.yaml`.
- Dans « À retester », demande le test de l'adaptateur avec un double qui a la
  forme du vrai kit (`chat.completions.create`, `choices[0].message.content`).

## Les niveaux N2

Chaque N2 charge par défaut une bibliothèque réelle (`transformers`,
`sentence_transformers`, `@huggingface/transformers`, `@xenova/transformers`,
`tesseract.js`, `postal`, `node-postal`…). Vérifie dans la documentation actuelle
de la bibliothèque que **le nom du paquet, l'import, le constructeur, la méthode
appelée et la forme de la réponse existent**. Le relevé du testeur dit ce qu'il
a trouvé ; ne le crois pas sur parole, vérifie. `@xenova/transformers` est
l'ancien nom de `@huggingface/transformers` : tranche, et sois cohérent au sein
de la fiche.

Établi par un testeur, source vérifiée (`MIGRATION_GUIDE_V5.md` de
`transformers`, tâche présente en 4.57.3, absente en 5.0.0) : **`transformers` 5
a retiré les pipelines `translation`, `summarization` et
`text2text-generation`**. Un extrait Python qui les charge échoue sur une
installation courante. Tranche pour chaque extrait concerné : un autre appel qui
existe en version 5 (vérifié dans la documentation), ou une contrainte de
version écrite dans le code et dans la fiche. Transformers.js garde ces tâches.

## Ce que tu rends à la fin

Un compte rendu court : pour chaque fiche, nombre d'affirmations corrigées,
retirées, de défauts réparés, statut final, hash du commit, et le contenu des
sections « À retester » et « Pour l'orchestrateur ».
