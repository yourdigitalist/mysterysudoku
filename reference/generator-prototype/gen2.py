import sys, random, time, itertools, json
from eng import P
from maps import MAPS, BLOCKING
def build(m):
    objs={}
    for i,(t,cells) in enumerate(m['objects']): objs[f'o{i}']=(t,cells)
    N=len(m['rooms'])
    chars=[chr(65+i) for i in range(len(m['names']))]
    return P(m['rooms'],objs,BLOCKING,chars,chars[-1])
def check_map(m):
    p=build(m); N=p.N
    assert len(m['names'])==N, m['id']
    for r in p.rooms:
        cells=[(i,j) for i in range(N) for j in range(N) if p.room((i,j))==r]
        seen={cells[0]}; st=[cells[0]]
        while st:
            a=st.pop()
            for q in [(a[0]+1,a[1]),(a[0]-1,a[1]),(a[0],a[1]+1),(a[0],a[1]-1)]:
                if q in cells and q not in seen: seen.add(q); st.append(q)
        assert len(seen)==len(cells),(m['id'],r)
        assert r in m['roomNames'] and r in m['floors'],(m['id'],r)
    for i in range(N):
        assert any((i,j) in p.FREE for j in range(N)); assert any((j,i) in p.FREE for j in range(N))
    return p
nice={'on':5,'beside':5,'besideChar':4,'inRoom':2,'corner':3,'dir':3,'notBeside':2,'diag':3}
def placed_count(p,cs):
    ok,pl,_=p.logical(cs); return len(pl),ok
def search(p,secs,seed,maxglob):
    random.seed(seed); t0=time.time(); best=None
    C=p.chars
    while time.time()-t0<secs:
        perm=list(range(p.N)); random.shuffle(perm)
        cells=[(r,perm[r]) for r in range(p.N)]
        if any(c not in p.FREE for c in cells): continue
        ch=C[:]; random.shuffle(ch); sol=dict(zip(ch,cells))
        if not p.twist(sol): continue
        pools={c:[x for x in p.clues_for(c) if p.ev(x,sol)] for c in C if c!=p.victim}
        em=[r for r in p.rooms if all(p.room(q)!=r for q in sol.values())]
        def rnd(c): return random.choices(pools[c],[nice.get(x[0],1) for x in pools[c]])[0]
        cur={c:rnd(c) for c in pools}; glob=set(random.sample(em,min(len(em),random.randint(0,maxglob))))
        def cs(cur,glob): return list(cur.values())+[('empty',r) for r in sorted(glob)]
        sc,ok=placed_count(p,cs(cur,glob))
        for it in range(250 if p.N<10 else 120):
            if ok: break
            nc=dict(cur); ng=set(glob)
            if em and random.random()<0.25:
                r=random.choice(em)
                if r in ng: ng.discard(r)
                elif len(ng)<maxglob: ng.add(r)
            else:
                c=random.choice(list(pools)); nc[c]=rnd(c)
            s2,ok2=placed_count(p,cs(nc,ng))
            if s2>=sc: cur,glob,sc,ok=nc,ng,s2,ok2
        if ok:
            final=cs(cur,glob)
            # minimize globals
            for r in sorted(glob):
                t=[x for x in final if x!=('empty',r)]
                if p.logical(t)[0]: final=t
            score=sum(nice.get(x[0],0) for x in final)+2*len(set(x[0] for x in final))-3*sum(1 for x in final if x[0]=='empty')
            if best is None or score>best[0]: best=(score,final,sol); print('found',score,time.time()-t0,file=sys.stderr)
    return best
if __name__=='__main__':
    idx=int(sys.argv[1]); secs=float(sys.argv[2]); mg=int(sys.argv[3])
    m=MAPS[idx]; p=check_map(m)
    b=search(p,secs,idx*7+int(sys.argv[4]) if len(sys.argv)>4 else idx*7+1,mg)
    print(json.dumps({'id':m['id'],'clues':b[1] if b else None,'sol':{k:list(v) for k,v in b[2].items()} if b else None}))
