# -*- coding: utf-8 -*-
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG_PATH = ROOT / 'data' / 'config.json'

EXAMS = [
    'ALL',
    'de-cuong-gk1-2627',
    'de-cuong-ly12-gk1',
    'de-cuong-sinh12-gk1',
    'de-cuong-tin12-gk1',
    'de-cuong-su12-gk1',
    'de-cuong-gdqp12-gk1',
    'de-cuong-hoa12-hk1',
]

buckets = {}
for ex in EXAMS:
    body = json.dumps({'name': f'ptw247_{ex}', 'data': {'submissions': []}}).encode('utf-8')
    req = urllib.request.Request(
        'https://api.restful-api.dev/objects',
        data=body,
        headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        obj = json.loads(r.read().decode('utf-8'))
        buckets[ex] = obj['id']
        print(f"{ex:24s} -> {obj['id']}")

cfg = json.loads(CFG_PATH.read_text(encoding='utf-8'))
cfg['cloudApiBase'] = 'https://api.restful-api.dev/objects'
cfg['cloudBuckets'] = buckets
CFG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')
print('Saved cloudBuckets to', CFG_PATH)
