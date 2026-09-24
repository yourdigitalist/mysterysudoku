import itertools, random, time, sys
class P:
    def __init__(s, rooms, objs, blocking, chars, victim):
        s.R=rooms; s.N=len(rooms); s.obj={}; s.otype={}
        for oid,(t,cells) in objs.items():
            s.otype[oid]=t
            for c in cells: s.obj[c]=oid
        s.block=blocking; s.chars=chars; s.victim=victim
        s.free=[(r,c) for r in range(s.N) for c in range(s.N) if s.typ((r,c)) not in blocking]
        s.FREE=set(s.free)
        s.rooms=sorted(set(''.join(rooms)))
        cnt={}
        for oid,t in s.otype.items(): cnt[t]=cnt.get(t,0)+1
        s.single_ref=[t for t in cnt if cnt[t]==1 and len(objs[[o for o in objs if objs[o][0]==t][0]][1])==1]
        s.types=sorted(set(s.otype.values()))
    def room(s,p): return s.R[p[0]][p[1]]
    def typ(s,p): o=s.obj.get(p); return s.otype[o] if o else None
    def nb(s,p):
        r,c=p
        for dr,dc in((0,1),(1,0),(0,-1),(-1,0)):
            q=(r+dr,c+dc)
            if 0<=q[0]<s.N and 0<=q[1]<s.N and s.room(q)==s.room(p): yield q
    def corner(s,p):
        r,c=p; N=s.N
        w=lambda q: not(0<=q[0]<N and 0<=q[1]<N) or s.room(q)!=s.room(p)
        return (w((r-1,c)) or w((r+1,c))) and (w((r,c-1)) or w((r,c+1)))
    def ev(s,cl,pl):
        k=cl[0]; p=pl.get(cl[1]) if len(cl)>1 else None
        if k=='inRoom': return s.room(p)==cl[2]
        if k=='on': return s.typ(p)==cl[2]
        if k=='beside': return any(s.typ(q)==cl[2] and s.obj.get(q)!=s.obj.get(p) for q in s.nb(p))
        if k=='notBeside': return not any(s.typ(q)==cl[2] and s.obj.get(q)!=s.obj.get(p) for q in s.nb(p))
        if k=='corner': return s.corner(p)
        if k=='besideChar': return pl[cl[2]] in list(s.nb(p))
        if k=='diag': q=pl[cl[2]]; return abs(q[0]-p[0])==abs(q[1]-p[1])
        if k=='dir':
            d,ref=cl[2],cl[3]
            q=pl[ref] if not ref.startswith('#') else [c for c in s.obj if s.typ(c)==ref[1:]][0]
            return {'N':p[0]<q[0],'S':p[0]>q[0],'W':p[1]<q[1],'E':p[1]>q[1]}[d]
        if k=='empty': return all(s.room(q)!=cl[1] for q in pl.values())
    def twist(s,pl):
        v=pl[s.victim]; return sum(1 for k in pl if k!=s.victim and s.room(pl[k])==s.room(v))==1
    def unary(s,cl): return cl[0] in('inRoom','on','beside','notBeside','corner') or (cl[0]=='dir' and cl[3].startswith('#'))
    def clues_for(s,ch):
        L=[('inRoom',ch,r) for r in s.rooms]
        for t in s.types: L+=[('on',ch,t),('beside',ch,t),('notBeside',ch,t)]
        L.append(('corner',ch))
        for o in s.chars:
            if o!=ch and o!=s.victim: L+=[('besideChar',ch,o),('diag',ch,o)]+[('dir',ch,d,o) for d in 'NSEW']
        for t in s.single_ref: L+=[('dir',ch,d,'#'+t) for d in 'NSEW']
        return L
    def logical(s,cs,log=False):
        C=s.chars; cand={ch:set(s.FREE) for ch in C}; out=[]
        for cl in cs:
            if cl[0]=='empty':
                for ch in C: cand[ch]={p for p in cand[ch] if s.room(p)!=cl[1]}
            elif s.unary(cl): cand[cl[1]]={p for p in cand[cl[1]] if s.ev(cl,{cl[1]:p})}
        if log: out.append(('init',{k:sorted(v) for k,v in cand.items()}))
        placed={}
        for it in range(80):
            prog=False
            for cl in cs:
                if cl[0] in('besideChar','diag') or (cl[0]=='dir' and not cl[3].startswith('#')):
                    a=cl[1]; b=cl[3] if cl[0]=='dir' else cl[2]
                    na={p for p in cand[a] if any(s.ev(cl,{a:p,b:q}) for q in cand[b] if q!=p)}
                    nb={q for q in cand[b] if any(s.ev(cl,{a:p,b:q}) for p in cand[a] if q!=p)}
                    if na!=cand[a] or nb!=cand[b]:
                        if log: out.append(('rel',cl,sorted(cand[a]-na),sorted(cand[b]-nb)))
                        cand[a],cand[b]=na,nb; prog=True
            for ch in C:
                if ch not in placed and len(cand[ch])==1:
                    p=next(iter(cand[ch])); placed[ch]=p; prog=True
                    if log: out.append(('place',ch,p))
                    for o in C:
                        if o!=ch: cand[o]={q for q in cand[o] if q[0]!=p[0] and q[1]!=p[1]}
            for axis in (0,1):
                for i in range(s.N):
                    if i in [p[axis] for p in placed.values()]: continue
                    who=[ch for ch in C if ch not in placed and any(p[axis]==i for p in cand[ch])]
                    if len(who)==1:
                        ch=who[0]; nc={p for p in cand[ch] if p[axis]==i}
                        if nc!=cand[ch]:
                            if log: out.append(('hidden',ch,'row' if axis==0 else 'col',i,sorted(cand[ch]-nc)))
                            cand[ch]=nc; prog=True
            un=[ch for ch in C if ch not in placed]
            for axis in (0,1):
                for a,b in itertools.combinations(un,2):
                    lines={p[axis] for p in cand[a]|cand[b]}
                    if len(lines)==2:
                        for o in un:
                            if o not in(a,b):
                                nc={p for p in cand[o] if p[axis] not in lines}
                                if nc!=cand[o]:
                                    if log: out.append(('pair',a,b,'rows' if axis==0 else 'cols',sorted(lines),o,sorted(cand[o]-nc)))
                                    cand[o]=nc; prog=True
            s.last_cand=cand
            if len(placed)==len(C): return True,placed,out
            if not prog: return False,placed,out
        return False,placed,out
    def count(s,cs,limit=2):
        n=0; C=s.chars
        # backtracking
        cand={ch:[p for p in s.free if all(s.ev(cl,{ch:p}) for cl in cs if s.unary(cl) and cl[1]==ch) and all(s.room(p)!=cl[1] for cl in cs if cl[0]=='empty')] for ch in C}
        order=sorted(C,key=lambda c:len(cand[c])); sols=[]
        def rec(i,pl,rows,cols):
            if len(sols)>=limit: return
            if i==len(order):
                if all(s.ev(cl,pl) for cl in cs) and s.twist(pl): sols.append(dict(pl))
                return
            ch=order[i]
            for p in cand[ch]:
                if p[0] in rows or p[1] in cols: continue
                pl[ch]=p; rec(i+1,pl,rows|{p[0]},cols|{p[1]}); del pl[ch]
        rec(0,{},set(),set()); return sols
    def search(s,secs,seed,nice,maxglob=1):
        random.seed(seed); res={}; t0=time.time(); C=s.chars
        while time.time()-t0<secs:
            perm=list(range(s.N)); random.shuffle(perm)
            cells=[(r,perm[r]) for r in range(s.N)]
            if any(c not in s.FREE for c in cells): continue
            ch=C[:]; random.shuffle(ch); sol=dict(zip(ch,cells))
            if not s.twist(sol): continue
            cs=[]
            for c in C:
                if c==s.victim: continue
                pool=[x for x in s.clues_for(c) if s.ev(x,sol)]
                cs.append(random.choices(pool,[nice.get(x[0],1) for x in pool])[0])
            em=[r for r in s.rooms if all(s.room(q)!=r for q in sol.values())]
            k=random.randint(0,min(maxglob,len(em))); cs+=[('empty',r) for r in random.sample(em,k)]
            ok,pl,_=s.logical(cs)
            if ok:
                sc=sum(nice.get(x[0],0) for x in cs)-2*k+len(set(x[0] for x in cs))
                res[str(sorted(map(str,cs)))]=(sc,cs,sol)
        return sorted(res.values(),key=lambda x:-x[0])
