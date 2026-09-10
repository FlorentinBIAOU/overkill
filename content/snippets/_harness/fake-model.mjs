/**
 * Local doubles for self-hosted specialised models (rung N2).
 * JavaScript counterpart of _harness/fake_model.py.
 */

export class FakeClassifier {
  constructor(scores, defaultScores = {}) {
    this.scores = scores;
    this.default = defaultScores;
    this.calls = [];
  }

  async predict(texts) {
    this.calls.push([...texts]);
    return texts.map((t) => this.scores[t] ?? this.default);
  }
}

export class FakeEncoder {
  constructor(dimensions = 32) {
    this.dimensions = dimensions;
    this.calls = [];
  }

  async encode(texts) {
    this.calls.push([...texts]);
    return texts.map((t) => this.#vector(t));
  }

  #vector(text) {
    const vector = new Array(this.dimensions).fill(0);
    for (const word of words(text)) {
      vector[stableHash(word) % this.dimensions] += 1;
    }
    const norm = Math.hypot(...vector);
    return norm ? vector.map((v) => v / norm) : vector;
  }
}

export class FakeSeq2Seq {
  constructor(outputs, defaultOutput = '') {
    this.outputs = outputs;
    this.default = defaultOutput;
    this.calls = [];
  }

  async generate(text) {
    this.calls.push(text);
    return this.outputs[text] ?? this.default;
  }
}

export class FakeOCR {
  constructor(pages, confidence = 0.92) {
    this.pages = pages;
    this.confidence = confidence;
    this.calls = [];
  }

  async read(imagePath) {
    this.calls.push(imagePath);
    return { text: this.pages[imagePath] ?? '', confidence: this.confidence };
  }
}

export function stableHash(word) {
  let h = 2166136261;
  for (const char of word) {
    h = ((h ^ char.codePointAt(0)) * 16777619) >>> 0;
  }
  return h;
}

function words(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}
