import sys, base64, zlib, json, subprocess, os
sys.path.insert(0, 'content/snippets/convert-a-pdf-to-plain-text')
from n0 import read_text
src = open('content/snippets/convert-a-pdf-to-plain-text/n0.test.py', encoding='utf8').read()
def _pdf(*m): return zlib.decompress(base64.b64decode(''.join(m)))
ns = {'_pdf': _pdf, '__file__': 'x'}
debut = src.index('PROSE = _pdf(')
exec(src[debut:src.index('\n\n# ---------')], ns)
docs = {k: ns[k] for k in ['PROSE', 'CESURE', 'SCAN', 'DEUX_PAGES', 'FACTURE'] if k in ns}
script = ("import { readText } from 'file://" + os.path.abspath('content/snippets/convert-a-pdf-to-plain-text/n0.js') + "';"
          "let d='';process.stdin.on('data',c=>d+=c).on('end',async()=>{const f=JSON.parse(d);const out={};"
          "for (const [k,b64] of Object.entries(f)) out[k]=await readText(Buffer.from(b64,'base64'));"
          "process.stdout.write(JSON.stringify(out));});")
out = subprocess.run(['node','--input-type=module','-e',script],
    input=json.dumps({k: base64.b64encode(v).decode() for k, v in docs.items()}),
    capture_output=True, text=True, check=True)
js = json.loads(out.stdout[out.stdout.index('{'):])
for k, v in docs.items():
    py = read_text(v)
    if py != js[k]:
        print('ÉCART', k)
        print('  py', json.dumps(py, ensure_ascii=False)[:400])
        print('  js', json.dumps(js[k], ensure_ascii=False)[:400])
    else:
        print('ok', k)
