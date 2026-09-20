import sys, base64, zlib
sys.path.insert(0,'content/snippets/convert-a-pdf-to-plain-text')
from n0 import read_text
src = open('content/snippets/convert-a-pdf-to-plain-text/n0.test.py', encoding='utf8').read()
def _pdf(*m): return zlib.decompress(base64.b64decode(''.join(m)))
ns = {'_pdf': _pdf, '__file__': 'x'}
exec(src.split('# ----')[0].replace('from n0 import', '#'), ns)
f = open('/tmp/claude-1000/-home-florentin-overkill/54d54234-5674-4a5c-a2bf-ae5ad086796d/scratchpad/facture.pdf','rb').read()
for nom, d in [('COLONNES', ns['COLONNES']), ('PROSE', ns['PROSE']), ('CESURE', ns['CESURE']), ('FACTURE', f)]:
    p = read_text(d)['pages'][0]
    print('==', nom, 'columns', p['columns'], 'reason', p['reason'], 'cesures', p['hyphenated_lines'])
    print('  ', p['text'][:260].replace('\n', ' | '))
