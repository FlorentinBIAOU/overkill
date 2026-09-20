import { repairEncoding } from '../content/snippets/repair-text-with-broken-encoding/n0.js';
const mots = ['Île-de-France','Îles Canaries','Île Maurice','Îlot','Œuvre','Ïambe','Œil','Île','Œuvres complètes','Région Île-de-France'];
const enc = new TextEncoder();
const W1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
const casser = (s) => [...enc.encode(s)].map(b => (b >= 0x80 && b <= 0x9f) ? W1252[b - 0x80] : String.fromCharCode(b)).join('');
for (const m of mots) {
  const c = casser(m);
  const r = repairEncoding(c);
  console.log(JSON.stringify(m).padEnd(26), JSON.stringify(c).padEnd(30), JSON.stringify(r.text).padEnd(26), r.changed, r.lossy);
}
