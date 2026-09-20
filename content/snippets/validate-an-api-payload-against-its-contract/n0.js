/**
 * Check a request body against the OpenAPI document that describes the endpoint.
 *
 * Rung N0. An OpenAPI document is the contract, and inside it every request
 * body is a JSON Schema. So validating a payload is two lookups and one
 * validation: find the operation the request is aimed at, take the schema it
 * declares, apply it. All three are exact, and the same document validates the
 * same way on the client side and on the server side.
 *
 * The operation is found the way the standard says: an exact path wins over a
 * templated one, so `/factures/resume` is the summary endpoint and not an
 * invoice whose identifier happens to be « resume ». Getting that precedence
 * wrong validates a request against the wrong schema and says yes.
 *
 * References are left to the validator. Putting the whole document at the root
 * of the schema and pointing at the operation with a JSON Pointer means every
 * `$ref: '#/components/schemas/…'` inside it resolves on its own, however deep
 * and however recursive.
 *
 * One count is normalised. The two libraries do not report an unexpected
 * property the same way — `ajv` gives one failure per property, `jsonschema` a
 * single one for all of them — so `additionalProperties` failures at the same
 * place are collapsed into one. Every other rule is left as it comes.
 *
 * One conversion is done by hand, because the two libraries disagree about it.
 * OpenAPI 3.0 writes an optional null as `nullable: true`, which is not JSON
 * Schema: `ajv` honours it, `jsonschema` ignores it and refuses a null the
 * contract allows. It is rewritten here into the `type` the standard uses, so
 * both languages answer the same thing.
 */

import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

const Ajv = AjvModule.default ?? AjvModule;
const addFormats = addFormatsModule.default ?? addFormatsModule;

// The methods an operation can be written under, as OpenAPI spells them.
export const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export const MAX_ERRORS = 200;

// This runs on a request path, and compiling a document costs more than
// checking one body against it — far more here, where `ajv` generates code,
// than in Python, where `jsonschema` interprets. The compiled validators are
// kept here, keyed by the document and the operation; the cap is what stops a
// caller that builds a new document per request from filling memory.
const COMPILED = new Map();
export const MAX_COMPILED = 64;

/** The compiled validator for this operation, or null when it is not usable. */
function compiled(document, pointer) {
  let key;
  try {
    key = `${JSON.stringify(document)}\u0000${pointer}`;
  } catch {
    return null;
  }
  if (!COMPILED.has(key)) {
    let validate = null;
    try {
      const ajv = new Ajv({ allErrors: true, strictSchema: false });
      addFormats(ajv);
      validate = ajv.compile({ ...withoutNullable(document), $ref: pointer });
    } catch {
      validate = null;
    }
    COMPILED.set(key, validate);
    if (COMPILED.size > MAX_COMPILED) COMPILED.delete(COMPILED.keys().next().value);
  }
  return COMPILED.get(key);
}

/**
 * Say whether `body` matches what the document declares for this endpoint.
 *
 * `operation` in the report is the operation that was matched, so a caller can
 * see which schema the answer came from: a request validated against the wrong
 * path is a yes that means nothing.
 *
 * @param {object} document  the parsed OpenAPI document
 * @param {string} method
 * @param {string} path
 * @param {unknown} body
 */
export function validateRequest(document, method, path, body) {
  if (typeof document !== 'object' || document === null || typeof path !== 'string') {
    return report(false, null, [], 0, 'this document is not usable');
  }

  const paths = document.paths ?? {};
  const template = matchPath(paths, path);
  if (template === null) {
    return report(false, null, [], 0, `no path in the document matches ${path}`);
  }
  const verb = String(method).toLowerCase();
  const operation = (paths[template] ?? {})[verb];
  if (typeof operation !== 'object' || operation === null) {
    return report(false, null, [], 0, `${method} is not declared on ${template}`);
  }

  const name = `${verb} ${template}`;
  const schema = operation.requestBody?.content?.['application/json']?.schema;
  if (schema === undefined) {
    // No body declared: anything sent is outside the contract, and the
    // contract is what this function answers about.
    const nothing = body === null || body === undefined;
    return report(nothing, name, [], 0, nothing ? null : 'no body is declared');
  }

  const pointer = `#/paths/${escape(template)}/${verb}`
    + `/requestBody/content/${escape('application/json')}/schema`;
  const validate = compiled(document, pointer);
  if (!validate) return report(false, name, [], 0, 'this document is not usable');

  validate(body);
  const key = (error) => [error.instancePath, error.keyword];
  const failures = [...(validate.errors ?? [])].sort((a, b) => (
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0
  ));
  const kept = [];
  for (const error of failures) {
    const entry = { path: error.instancePath, rule: error.keyword };
    const deja = kept.some((k) => k.path === entry.path && k.rule === entry.rule);
    if (entry.rule === 'additionalProperties' && deja) continue;
    kept.push(entry);
  }
  return report(kept.length === 0, name, kept.slice(0, MAX_ERRORS), kept.length, null);
}

/** The path template this request belongs to, exact match winning. */
function matchPath(paths, path) {
  if (path in paths) return path;
  const wanted = path.replace(/^\/|\/$/g, '').split('/');
  for (const template of Object.keys(paths).sort()) {
    const steps = template.replace(/^\/|\/$/g, '').split('/');
    if (steps.length !== wanted.length) continue;
    const fits = steps.every((step, i) => (
      (step.startsWith('{') && step.endsWith('}')) || step === wanted[i]
    ));
    if (fits) return template;
  }
  return null;
}

/** OpenAPI 3.0's `nullable: true`, rewritten into the type JSON Schema uses. */
function withoutNullable(value) {
  if (Array.isArray(value)) return value.map(withoutNullable);
  if (typeof value !== 'object' || value === null) return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key !== 'nullable') out[key] = withoutNullable(item);
  }
  if (value.nullable === true && typeof out.type === 'string') out.type = [out.type, 'null'];
  return out;
}

const escape = (step) => step.replaceAll('~', '~0').replaceAll('/', '~1');

const report = (valid, operation, errors, total, reason) => ({
  valid, operation, errors, error_count: total, truncated: total > errors.length, reason,
});
