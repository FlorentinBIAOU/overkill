# Vérifie l adaptateur contre le vrai kit Python, sans réseau : le transport
# est remplacé, tout le reste est le code publié du kit.
#   pip install openai==3.14.0 && python verify.py
import json, httpx2
from openai import OpenAI
from provider import ProviderClient
seen = {}
def handler(req):
    seen["url"], seen["body"] = str(req.url), json.loads(req.content)
    return httpx2.Response(200, json={"id":"c","object":"chat.completion","created":0,"model":"gpt-4.1-mini","choices":[{"index":0,"finish_reason":"stop","message":{"role":"assistant","content":"[]"}}]})
sdk = OpenAI(api_key="test", http_client=httpx2.Client(transport=httpx2.MockTransport(handler)))
out = ProviderClient(sdk).complete(prompt="hello", temperature=0)
assert out == "[]", out
assert seen["url"].endswith("/v1/chat/completions")
assert seen["body"] == {"model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}],"temperature":0}, seen
print("python ok", seen)
