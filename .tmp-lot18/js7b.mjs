import { repairEncoding, ROUNDS } from '../content/snippets/repair-text-with-broken-encoding/n0.js';
const W1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
const enc = new TextEncoder();
const casser = (s) => [...enc.encode(s)].map(b => (b >= 0x80 && b <= 0x9f) ? W1252[b - 0x80] : String.fromCharCode(b)).join('');
let x = 'été';
for (let n = 1; n <= 5; n++) { x = casser(x); console.log(n, JSON.stringify(x), '->', JSON.stringify(repairEncoding(x).text)); }
console.log('ROUNDS', ROUNDS);
