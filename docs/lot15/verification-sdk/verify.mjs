// Vérifie l'adaptateur contre le vrai kit JavaScript, sans réseau : le
// transport est remplacé, tout le reste est le code publié du kit.
//   npm i openai@7.15.0 && node verify.mjs
import { OpenAI } from 'openai';
import { providerClient } from './provider.mjs';

let seen;
const sdk = new OpenAI({
  apiKey: 'test',
  fetch: async (url, init) => {
    seen = [String(url), JSON.parse(init.body)];
    const body = { id: 'c', object: 'chat.completion', created: 0, model: 'm',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '[]' } }] };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
const out = await (await providerClient(sdk)).complete({ prompt: 'hello', temperature: 0 });
if (out !== '[]' || !seen[0].endsWith('/v1/chat/completions')) throw new Error('adaptateur faux');
console.log('js ok', JSON.stringify(seen));
