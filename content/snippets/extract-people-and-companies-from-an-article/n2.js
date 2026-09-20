/**
 * Type the names with a small pre-trained recogniser, on your own machine.
 *
 * Rung N2. This is the level that answers the half rung N0 cannot: what a name
 * *is*, when the sentence does not say. The model is a few tens of megabytes,
 * it runs on a processor in milliseconds, and nothing leaves the machine —
 * which matters more here than elsewhere, because what is being extracted is a
 * list of people.
 *
 * What you own on this rung is not the model. It is the cap, the batch, the
 * map from its label set to yours, and the answer to « what does the code do
 * with a label we do not map ». The multilingual pipelines carry four labels —
 * person, organisation, place, and a fourth that means « something else » —
 * where this entry has three meanings. `MISC` is therefore dropped rather than
 * guessed, and counted so that the caller sees how much was dropped.
 *
 * The limit to keep in mind is the shape of the answer, not its quality: the
 * pipeline returns a label for every name it finds. Rung N0 answers `unknown`
 * when the sentence proves nothing; here, something is always claimed.
 */

// The model name is an example: pick one trained for your language, and read
// its licence, which is not the licence of the runtime that loads it.
export const MODEL = 'Xenova/bert-base-multilingual-cased-ner-hrl';

// A document longer than this is cut, not refused: a recogniser that throws on
// a long article returns nothing at all.
export const MAX_CHARACTERS = 20000;

// Their label set is theirs, and wider than ours. What is not mapped is
// dropped on purpose: an unmapped label that silently became a type would be a
// surprise in a list of people.
export const LABELS = {
  PER: 'person', PERSON: 'person', ORG: 'company', LOC: 'place', GPE: 'place',
};

/** The real recogniser: a pipeline loaded once, then fed in batches. */
export async function transformersRecogniser(model = MODEL) {
  const { pipeline } = await import('@huggingface/transformers'); // a large local install
  const run = await pipeline('token-classification', model, { aggregation_strategy: 'simple' });
  return {
    async predict(texts) {
      const answers = await run(texts);
      return answers.map((entities) => ({
        entities: entities.map((entity) => ({
          text: entity.word,
          label: entity.entity_group,
          start: entity.start,
          end: entity.end,
        })),
      }));
    },
  };
}

export class RecognitionUnavailable extends Error {}

/**
 * For each text, the names the model found, with its labels mapped to ours.
 *
 * `recogniser` is injected so this function can be tested without the model.
 * In production it defaults to the real pipeline.
 */
export async function extractNames(texts, recogniser) {
  recogniser ??= await transformersRecogniser();
  const cut = texts.map((text) => (typeof text === 'string' ? text.slice(0, MAX_CHARACTERS) : ''));
  let answers;
  try {
    answers = await recogniser.predict(cut);
  } catch (error) {
    throw new RecognitionUnavailable(String(error));
  }
  if (!Array.isArray(answers) || answers.length !== cut.length) {
    throw new RecognitionUnavailable('the recogniser did not answer once per text');
  }

  return cut.map((text, index) => {
    const names = [];
    const unmapped = [];
    for (const entity of (answers[index] ?? {}).entities ?? []) {
      const label = String(entity.label ?? '');
      const found = String(entity.text ?? '');
      if (!(label in LABELS)) {
        unmapped.push(label);
      } else if (found && text.includes(found)) {
        names.push({
          text: found,
          type: LABELS[label],
          evidence: label,
          start: Number(entity.start ?? text.indexOf(found)),
          end: Number(entity.end ?? text.indexOf(found) + found.length),
        });
      }
    }
    return { names, unmapped, characters_read: text.length };
  });
}
