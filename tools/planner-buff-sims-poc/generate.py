#!/usr/bin/env python3
from __future__ import annotations
import argparse, datetime as dt, itertools, json, math, os, re, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_CONFIG = HERE / 'config.json'
DEFAULT_OUTPUT = HERE / 'generated' / 'midnight-s2-buff-impact-poc.json'
DEFAULT_WORK = HERE / 'work'

class GenError(RuntimeError): pass

def load(path: Path):
    try: return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e: raise GenError(f'No pude leer {path}: {e}')

def run(cmd, cwd=None):
    return subprocess.run(cmd, cwd=str(cwd) if cwd else None, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)

def git_commit(repo: Path|None):
    if not repo: return None
    p=run(['git','rev-parse','HEAD'], repo)
    return p.stdout.strip() if p.returncode==0 else None

def simc_version(simc: Path):
    p=run([str(simc),'spell_query=spell.id=1'])
    for line in p.stdout.splitlines():
        if 'SimulationCraft' in line: return line.strip()
    return next((x.strip() for x in p.stdout.splitlines() if x.strip()), 'unknown')

def validate_config(c):
    for k in ('specs','buffs','scenarios'):
        if not isinstance(c.get(k), list) or not c[k]: raise GenError(f'config.{k} inválido')
    ids=[x['specId'] for x in c['specs']]
    if len(ids)!=len(set(ids)): raise GenError('specId duplicados')
    bids=[x['id'] for x in c['buffs']]
    if len(bids)!=len(set(bids)): raise GenError('buff ids duplicados')
    total=sum(float(c['mplusWeights'].get(s['id'],0)) for s in c['scenarios'])
    if not math.isclose(total,1.0,abs_tol=1e-9): raise GenError(f'Los pesos M+ suman {total}, no 1.0')

def find_profile(root: Path, filename: str):
    for p in (root/filename, root/'MID2'/filename):
        if p.is_file(): return p
    hits=list(root.rglob(filename))
    if len(hits)==1: return hits[0]
    raise GenError(f'No encontré un perfil único {filename} dentro de {root}')

def combos(buff_ids, mode):
    if mode=='single': return [(x,) for x in buff_ids]
    out=[]
    for n in range(1,len(buff_ids)+1): out += list(itertools.combinations(buff_ids,n))
    return out

def pname(combo): return '__'.join(combo)
def safe(s): return re.sub(r'[^A-Za-z0-9_-]+','_',s)

def build_input(profile_text, scenario, buffs, variants, outdir, iterations, threads, work_threads):
    outdir.mkdir(parents=True, exist_ok=True)
    baseline=outdir/'baseline.json'
    lines=[profile_text.rstrip(),'','# --- Keystone Planner generated options ---',
           f'iterations={iterations}','target_error=0',f'threads={threads}',
           f'profileset_work_threads={work_threads}','profileset_metric=dps','report_details=0',
           f"fight_style={scenario['fightStyle']}",f"desired_targets={int(scenario['desiredTargets'])}",
           'optimal_raid=0']
    for b in buffs: lines.append(f"override.{b['override']}=0")
    lines.append(f'json2={baseline.as_posix()}')
    byid={b['id']:b for b in buffs}; outputs={}
    for combo in variants:
        name=pname(combo); out=outdir/f'{safe(name)}.json'; outputs[name]=out
        for i,bid in enumerate(combo):
            op='=' if i==0 else '+='
            lines.append(f'profileset."{name}"{op}override.{byid[bid]["override"]}=1')
        lines.append(f'profileset."{name}"+=json2={out.as_posix()}')
    return '\n'.join(lines)+'\n', baseline, outputs

def nnum(x):
    return float(x) if isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(float(x)) else None

def player_dps(node):
    if not isinstance(node,dict): return None
    c=node.get('collected_data')
    if not isinstance(c,dict): return None
    d=c.get('dps')
    if isinstance(d,dict):
        for k in ('mean','avg','average'):
            v=nnum(d.get(k))
            if v and v>0: return v
    v=nnum(d)
    return v if v and v>0 else None

def extract_dps(data):
    roots=[]
    for k in ('sim','simulation'):
        if isinstance(data.get(k),dict): roots.append(data[k])
    roots.append(data)
    for r in roots:
        if isinstance(r,dict) and isinstance(r.get('players'),list):
            for p in r['players']:
                v=player_dps(p)
                if v: return v
    hits=[]
    def walk(x):
        if isinstance(x,dict):
            v=player_dps(x)
            if v: hits.append(v)
            for y in x.values(): walk(y)
        elif isinstance(x,list):
            for y in x: walk(y)
    walk(data)
    vals=sorted({round(v,8) for v in hits})
    if len(vals)==1: return vals[0]
    if not vals: raise GenError('No encontré collected_data.dps.mean en JSON2')
    raise GenError(f'JSON2 ambiguo: múltiples DPS candidatos {vals[:6]}')

def parse_report(path):
    if not path.is_file(): raise GenError(f'No se generó {path}')
    return extract_dps(load(path))

def run_sim(simc,input_file):
    p=run([str(simc),str(input_file)])
    low=p.stdout.lower()
    if p.returncode!=0 or any(x in low for x in ('unknown option','initialization error','simulation runtime error')):
        raise GenError(f'SimC falló en {input_file}\n\n{p.stdout[-7000:]}')

def generate(a):
    simc=Path(a.simc).expanduser().resolve(); profiles=Path(a.profiles).expanduser().resolve()
    if not simc.is_file(): raise GenError(f'No existe {simc}')
    if not profiles.is_dir(): raise GenError(f'No existe {profiles}')
    c=load(Path(a.config)); validate_config(c)
    variants=combos([b['id'] for b in c['buffs']],a.mode)
    out={'schemaVersion':1,'generatedAtUtc':dt.datetime.now(dt.timezone.utc).isoformat(),
         'generator':'keystone-planner-buff-sims-poc','mode':a.mode,'season':c.get('season'),
         'simulationCraft':{'version':simc_version(simc),'gitCommit':git_commit(Path(a.simc_repo).resolve()) if a.simc_repo else None},
         'settings':{'iterations':a.iterations,'threads':a.threads,'profilesetWorkThreads':a.profileset_work_threads,
                     'mplusWeights':c['mplusWeights'],'scenarios':c['scenarios'],'buffs':c['buffs']},'specs':{}}
    work=Path(a.work_dir).resolve(); work.mkdir(parents=True,exist_ok=True)
    for spec in c['specs']:
        sid=str(spec['specId']); pp=find_profile(profiles,spec['profile']); text=pp.read_text(encoding='utf-8')
        print(f'\n=== {spec["name"]} ({sid}) ==='); per={}
        for sc in c['scenarios']:
            sd=work/sid/sc['id']
            if sd.exists() and not a.keep_existing: shutil.rmtree(sd)
            sd.mkdir(parents=True,exist_ok=True)
            simtxt,basej,files=build_input(text,sc,c['buffs'],variants,sd,a.iterations,a.threads,a.profileset_work_threads)
            inp=sd/'input.simc'; inp.write_text(simtxt,encoding='utf-8')
            print(f'  -> {sc["id"]}: {len(variants)} variantes')
            run_sim(simc,inp); base=parse_report(basej); rows={}
            for combo in variants:
                name=pname(combo); d=parse_report(files[name]); rows[name]={'ratio':d/base,'delta':d/base-1}
            per[sc['id']]=rows
        combined={}
        for combo in variants:
            name=pname(combo); bysc={sc['id']:per[sc['id']][name]['delta'] for sc in c['scenarios']}
            wd=sum(bysc[k]*float(c['mplusWeights'][k]) for k in bysc)
            combined[name]={'deltaByScenario':bysc,'mplusWeightedDelta':wd,'mplusWeightedRatio':1+wd}
        out['specs'][sid]={'name':spec['name'],'profile':spec['profile'],'results':combined}
    Path(a.output).parent.mkdir(parents=True,exist_ok=True)
    Path(a.output).write_text(json.dumps(out,indent=2,sort_keys=True),encoding='utf-8')
    return out

def doctor(a):
    simc=Path(a.simc).expanduser().resolve(); profiles=Path(a.profiles).expanduser().resolve(); c=load(Path(a.config)); validate_config(c)
    if not simc.is_file(): raise GenError('simc.exe no existe')
    if not profiles.is_dir(): raise GenError('profiles no existe')
    print('simc:',simc); print('version:',simc_version(simc)); print('profiles:',profiles)
    for s in c['specs']: print(' OK',s['name'],'->',find_profile(profiles,s['profile']))
    print('Overrides:')
    for b in c['buffs']: print(f'  override.{b["override"]} ({b["id"]})')
    print('Doctor PASS básico. La ejecución real validará que cada override sea soportado.')

def summary(d):
    print('\n=== DELTAS M+ NORMALIZADOS ===')
    for sid,s in d['specs'].items():
        print(f'\n{s["name"]} ({sid})')
        for n,r in sorted(s['results'].items(),key=lambda x:x[1]['mplusWeightedDelta'],reverse=True):
            print(f'  {n:42s} {r["mplusWeightedDelta"]*100:+7.3f}%')

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--simc',required=True); p.add_argument('--profiles',required=True); p.add_argument('--simc-repo')
    p.add_argument('--config',default=str(DEFAULT_CONFIG)); p.add_argument('--output',default=str(DEFAULT_OUTPUT)); p.add_argument('--work-dir',default=str(DEFAULT_WORK))
    p.add_argument('--iterations',type=int,default=5000); p.add_argument('--threads',type=int,default=max(1,os.cpu_count() or 4)); p.add_argument('--profileset-work-threads',type=int,default=1)
    p.add_argument('--mode',choices=('single','powerset'),default='single'); p.add_argument('--keep-existing',action='store_true'); p.add_argument('--doctor',action='store_true')
    a=p.parse_args()
    if a.iterations<100: p.error('--iterations debe ser >= 100')
    try:
        if a.doctor: doctor(a); return 0
        d=generate(a); summary(d); print('\nJSON:',Path(a.output).resolve()); return 0
    except GenError as e: print('\nERROR:',e,file=sys.stderr); return 2
    except KeyboardInterrupt: return 130

if __name__=='__main__': raise SystemExit(main())
