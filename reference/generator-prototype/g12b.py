import sys, random, time, json
from gen2 import build, check_map, nice
from maps import MAPS
idx=int(sys.argv[3]) if len(sys.argv)>3 else 5
m=MAPS[idx]; p=check_map(m); C=p.chars
random.seed(int(sys.argv[1])); t0=time.time(); best=None; LIM=float(sys.argv[2])
def run(cs):
    ok,pl,_=p.logical(cs); tot=sum(len(v) for v in p.last_cand.values())
    return ok, len(pl)*1000-tot
while time.time()-t0<LIM:
    perm=list(range(p.N)); random.shuffle(perm)
    cells=[(r,perm[r]) for r in range(p.N)]
    if any(c not in p.FREE for c in cells): continue
    ch=C[:]; random.shuffle(ch); sol=dict(zip(ch,cells))
    if not p.twist(sol): continue
    pools={c:[x for x in p.clues_for(c) if p.ev(x,sol)] for c in C if c!=p.victim}
    em=[r for r in p.rooms if all(p.room(q)!=r for q in sol.values())]
    glob=[('empty',r) for r in em]
    clues={c:[] for c in pools}
    ok=False
    for step in range(3*len(pools)):
        cs=[x for v in clues.values() for x in v]+glob
        ok,sc=run(cs)
        if ok: break
        cand=p.last_cand
        order=sorted(pools,key=lambda c:(len(clues[c]),-len(cand[c]),random.random()))
        c=order[0]
        if len(clues[c])>=2: break
        opts=random.sample(pools[c],min(20,len(pools[c])))
        bestx=None
        for x in opts:
            if x in clues[c]: continue
            o2,s2=run(cs+[x]); s2+=nice.get(x[0],1)*30
            if bestx is None or s2>bestx[0]: bestx=(s2,x)
        clues[c].append(bestx[1])
    if not ok: print('fail',round(time.time()-t0),file=sys.stderr); continue
    for c in pools:
        if not clues[c]: clues[c].append(random.choices(pools[c],[nice.get(x[0],1) for x in pools[c]])[0])
    final=[x for v in clues.values() for x in v]+glob
    assert p.logical(final)[0]
    for g in list(glob):
        t=[x for x in final if x!=g]
        if p.logical(t)[0]: final=t
    for x in list(final):
        if x[0]!='empty' and sum(1 for y in final if y[0]!='empty' and y[1]==x[1])>1:
            t=[y for y in final if y!=x]
            if p.logical(t)[0]: final=t
    two=sum(1 for c in pools if sum(1 for y in final if y[0]!='empty' and y[1]==c)>1)
    ng=sum(1 for y in final if y[0]=='empty')
    kinds=len(set(x[0] for x in final))
    sc=-two*10-ng*2+kinds*3
    print('found two=%d glob=%d kinds=%d'%(two,ng,kinds),round(time.time()-t0),file=sys.stderr)
    if best is None or sc>best[0]: best=(sc,final,sol)
    if two==0 and ng<=4 and kinds>=6: break
print(json.dumps({'id':m['id'],'clues':best[1] if best else None,'sol':{k:list(v) for k,v in best[2].items()} if best else None}))
