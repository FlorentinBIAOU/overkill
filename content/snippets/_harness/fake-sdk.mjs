/**
 * Local double with the surface of the provider SDK the N3 snippets name.
 * JavaScript counterpart of _harness/fake_sdk.py. See that file for why this
 * exists.
 *
 * Mirrors the published `openai` package (7.x), checked against it with its
 * fetch replaced (docs/lot15/verification-sdk/):
 *
 * - `sdk.chat.completions.create({ model, messages, temperature })`, answer
 *   read from `choices[0].message.content`, which may be `null`;
 * - `sdk.embeddings.create({ model, input })`, vectors read from
 *   `data[i].embedding`, each item carrying its `index`.
 *
 * It has no `complete` method, on purpose: the real SDK has none either.
 */

export class FakeSDKError extends Error {}

export class FakeSDK {
  constructor({ content = '', failTimes = 0, vectors = null, shuffleEmbeddings = false } = {}) {
    this.content = content;
    this.vectors = vectors;
    this.shuffleEmbeddings = shuffleEmbeddings;
    this.requests = [];
    this._failTimes = failTimes;
    this.chat = { completions: { create: async (request) => this._chat(request) } };
    this.embeddings = { create: async (request) => this._embed(request) };
  }

  get lastRequest() {
    if (this.requests.length === 0) throw new Error('the adapter never called the SDK');
    return this.requests.at(-1);
  }

  _record(endpoint, request) {
    this.requests.push({ endpoint, ...request });
    if (this._failTimes > 0) {
      this._failTimes -= 1;
      throw new FakeSDKError('simulated provider failure');
    }
  }

  _chat(request) {
    this._record('chat.completions', request);
    const message = { role: 'assistant', content: this.content };
    return { choices: [{ index: 0, message, finish_reason: 'stop' }] };
  }

  _embed(request) {
    this._record('embeddings', request);
    const vectors = this.vectors ?? request.input.map((t) => [t.length, 1]);
    const data = vectors.map((embedding, index) => ({ index, embedding: [...embedding] }));
    if (this.shuffleEmbeddings) data.reverse();
    return { data };
  }
}
