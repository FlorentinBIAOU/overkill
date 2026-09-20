import sys, time, json, copy
sys.path.insert(0, 'content/snippets/validate-an-api-payload-against-its-contract')
from n0 import validate_request

def gros_document(chemins: int, proprietes: int = 42):
    props = {f"champ_{i}": {"type": "string"} for i in range(proprietes)}
    schema = {"type": "object", "required": ["numero"],
              "properties": {"numero": {"type": "string"}, **props}}
    paths = {}
    for i in range(chemins):
        paths[f"/ressource{i}/{{id}}"] = {
            m: {"requestBody": {"content": {"application/json": {"schema": copy.deepcopy(schema)}}}}
            for m in ("post", "put")}
    paths["/factures"] = {"post": {"requestBody": {"content": {"application/json": {
        "schema": {"type": "object", "required": ["numero"],
                   "properties": {"numero": {"type": "string"}}}}}}}}
    return {"openapi": "3.0.3", "paths": paths}

doc = gros_document(42)
taille = len(json.dumps(doc))
corps = {"numero": "FA-2026-0412"}
validate_request(doc, "post", "/factures", corps)  # chauffe le cache
N = 300
debut = time.perf_counter()
for _ in range(N):
    validate_request(doc, "post", "/factures", corps)
par_appel = (time.perf_counter() - debut) / N
debut = time.perf_counter()
for _ in range(N):
    json.dumps(doc, sort_keys=True)
cle = (time.perf_counter() - debut) / N
print(f"document {taille/1000:.0f} ko : {par_appel*1000:.3f} ms par appel ; "
      f"la clé seule aurait coûté {cle*1000:.3f} ms")
petit = gros_document(2)
validate_request(petit, "post", "/factures", corps)
debut = time.perf_counter()
for _ in range(N):
    validate_request(petit, "post", "/factures", corps)
petit_par_appel = (time.perf_counter() - debut) / N
print(f"document {len(json.dumps(petit))/1000:.0f} ko : {petit_par_appel*1000:.3f} ms par appel")
print(f"rapport gros/petit : {par_appel/petit_par_appel:.2f}")
