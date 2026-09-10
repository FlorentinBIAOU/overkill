/**
 * Local double for a general-purpose LLM API. JavaScript counterpart of
 * _harness/fake_llm.py. See that file for why this exists.
 */

export class FakeLLMError extends Error {}

export class FakeLLM {
  /**
   * @param {object} options
   * @param {string|object} [options.response] what `complete` should return
   * @param {number} [options.failTimes] how many calls should fail first
   * @param {string} [options.model]
   */
  constructor({ response = '', failTimes = 0, model = 'fake-model' } = {}) {
    this.response = response;
    this.model = model;
    this.requests = [];
    this._failTimes = failTimes;
  }

  get lastRequest() {
    if (this.requests.length === 0) {
      throw new Error('the snippet never called the client');
    }
    return this.requests.at(-1);
  }

  get callCount() {
    return this.requests.length;
  }

  _record(request) {
    this.requests.push(request);
    if (this._failTimes > 0) {
      this._failTimes -= 1;
      throw new FakeLLMError('simulated provider failure');
    }
  }

  async complete(request) {
    this._record(request);
    return typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
  }

  async completeJson(request) {
    this._record(request);
    return typeof this.response === 'string' ? JSON.parse(this.response) : this.response;
  }

  /**
   * Deterministic pseudo-embeddings. Same text gives the same vector, and
   * texts sharing words land closer together.
   */
  async embed(texts, options = {}) {
    this._record({ texts, ...options });
    return texts.map((t) => bagOfWordsVector(t));
  }
}

/**
 * FNV-1a, 32 bits. Must agree exactly with its Python counterpart, so that a
 * snippet's two language versions score the same inputs identically.
 *
 * Math.imul is what makes that true: a plain `*` on numbers this large loses
 * precision past 2^53 and silently drifts from Python's exact integers.
 */
export function hashWord(word) {
  let h = 2166136261;
  for (const char of word) {
    h = Math.imul(h ^ char.codePointAt(0), 16777619) >>> 0;
  }
  return h;
}

function bagOfWordsVector(text, dimensions = 16) {
  const vector = new Array(dimensions).fill(0);
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    vector[hashWord(word) % dimensions] += 1;
  }
  const norm = Math.hypot(...vector);
  return norm ? vector.map((v) => v / norm) : vector;
}
