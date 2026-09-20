import json, subprocess, sys
sys.path.insert(0,'content/snippets/repair-text-with-broken-encoding')
from n0 import repair_encoding

CASSES = ["CrÃ©dit Agricole","Rue des FrÃ¨res-LumiÃ¨re","ThÃ©Ã¢tre","Ã€ bientÃ´t","naÃ¯ve",
"MÃ¼ller","Ã‰quipe","câ€™est","â‚¬ 12,50","ÃŸ","Ã…ngstrÃ¶m","ÐŸÑ€Ð¸Ð²ÐµÑ‚","ÃƒÂ©tÃƒÂ©"]
CORRECTES = ["Crédit Agricole","Île-de-France","À bientôt","naïve","Ångström","Đà Nẵng","Привет",
"Müller","cœur","garçon","€ 12,50","« Bonjour »","L’été à Nice","São Paulo","Mãe","Ãs vezes","Ål","Ærø","Þór","Boulogne-Billancourt"]
DECLINE = ["ÃŽle-de-France","ÃŽles Canaries","ÃŽlot","Å’uvre","Ã\ufffdambe"]
TICKET = "Bug : on voit « Ã© » au lieu de « é » dans le PDF"
A = "Le caractère Ã se prononce a-tilde"
q = "été"
for _ in range(5): q = q.encode('utf8').decode('windows-1252', errors='replace')
entrees = CASSES + CORRECTES + DECLINE + [TICKET, A, "Ã tout de suite", "Cr�dit Agricole",
    "Un mélange : Crédit Agricole et CrÃ©dit Mutuel", "", "Ã", "Ã©", q]
py = [repair_encoding(e) for e in entrees]
script = ("import { repairEncoding } from 'file://" + __import__('os').path.abspath('content/snippets/repair-text-with-broken-encoding/n0.js') + "';"
          "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{process.stdout.write(JSON.stringify(JSON.parse(d).map(repairEncoding)));});")
out = subprocess.run(['node','--input-type=module','-e',script], input=json.dumps(entrees), capture_output=True, text=True, check=True)
js = json.loads(out.stdout)
ecarts = [(e,p['text'],j['text']) for e,p,j in zip(entrees,py,js) if p != j]
print('total', len(entrees), 'écarts', len(ecarts), 'accords', len(entrees)-len(ecarts))
for e,p,j in ecarts: print('  ', repr(e)[:45].ljust(46), 'py=', repr(p)[:28].ljust(29), 'js=', repr(j)[:28])
