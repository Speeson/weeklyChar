#!/usr/bin/env python3
import argparse, json, math
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('file')
p.add_argument('--max-abs-delta',type=float,default=0.30)
a=p.parse_args()
d=json.loads(Path(a.file).read_text(encoding='utf-8'))
errs=[]
if d.get('schemaVersion')!=1: errs.append('schemaVersion != 1')
specs=d.get('specs')
if not isinstance(specs,dict) or not specs: errs.append('No hay specs')
for sid,s in (specs or {}).items():
    rs=s.get('results')
    if not isinstance(rs,dict) or not rs: errs.append(f'{sid}: sin results'); continue
    for name,r in rs.items():
        x=r.get('mplusWeightedDelta')
        if not isinstance(x,(int,float)) or not math.isfinite(x): errs.append(f'{sid}/{name}: delta inválido')
        elif abs(x)>a.max_abs_delta: errs.append(f'{sid}/{name}: delta sospechoso {x:.4f}')
if errs:
    print('VALIDATION FAIL')
    for e in errs: print(' -',e)
    raise SystemExit(2)
print(f'VALIDATION PASS: {len(specs)} specs')
