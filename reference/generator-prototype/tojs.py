import json, sys
from gen2 import build, MAPS
DISP={'panel':'control panel','skirack':'ski rack','slot':'slot machine','ferris':'Ferris wheel','pole':'carousel pole','candy':'candy floss stand',
'float':'pool float','armour':'suit of armour','dinosaur':'dinosaur skeleton','gem':'gem case','washer':'laundry basket','cart':'luggage cart',
'lounger':'sun lounger','duck':'duck boat','horse':'carousel horse','tent':'circus drum','wheel':"ship's wheel",'fountain':'fountain','lift':'lift',
'boiler':'boiler','TV':'TV','bathtub':'bathtub','lifeboat':'lifeboat','sarcophagus':'sarcophagus','painting':'painting','telescope':'telescope'}
COLORS=['#B5475A','#3D6FB0','#2F7F72','#9A5A16','#7A4FA0','#1F7A8C','#A23E83','#5E7A1F','#C0572B','#34568B','#8C5A3C']
VICTIM='#6B6478'
ORD=lambda n: str(n)+({1:'st',2:'nd',3:'rd'}.get(n if n<20 else n%10,'th'))
def disp(t): return DISP.get(t,t)
def art(p,t):
    cnt=sum(1 for o in p.otype.values() if o==t)
    d=disp(t)
    if cnt==1: return 'the '+d
    return ('an ' if d[0].lower() in 'aeiou' else 'a ')+d
def clue_text(p,m,cl,names):
    k=cl[0]
    if k=='on': return 'was on %s.'%art(p,cl[2])
    if k=='beside': return 'was beside %s.'%art(p,cl[2])
    if k=='notBeside':
        return 'was not beside %s.'%(art(p,cl[2]) if art(p,cl[2]).startswith('the') else 'any '+disp(cl[2]))
    if k=='inRoom': return 'was in the %s.'%m['roomNames'][cl[2]]
    if k=='corner': return 'was in a corner of a room.'
    if k=='besideChar': return 'was beside %s.'%names[cl[2]]
    if k=='diag': return 'was diagonal to %s.'%names[cl[2]]
    if k=='dir':
        d={'N':'north','S':'south','E':'east','W':'west'}[cl[2]]; ref=cl[3]
        return 'was %s of %s.'%(d, 'the '+disp(ref[1:]) if ref.startswith('#') else names[ref])
def convert(idx,res):
    m=MAPS[idx]; p=build(m); N=p.N
    names={chr(65+i):n for i,n in enumerate(m['names'])}
    clues=[tuple(c) for c in res['clues']]; sol={k:tuple(v) for k,v in res['sol'].items()}
    ok,pl,log=p.logical(clues,True); assert ok
    cnt=p.count(clues,2) if N<=8 else None
    if cnt is not None: assert len(cnt)==1 and cnt[0]==sol,(cnt)
    assert all(pl[k]==sol[k] for k in sol) and p.twist(sol)
    per={c:[] for c in p.chars}
    for c in clues:
        if c[0]!='empty': per[c[1]].append(c)
    def ctext(ch):
        pr={'on':0,'inRoom':1,'beside':2,'corner':3}
        ts=[clue_text(p,m,c,names) for c in sorted(per[ch],key=lambda c:pr.get(c[0],5))]
        if len(ts)==1: return ts[0]
        return ts[0][:-1]+', and '+ts[1][4:]
    chars=[]
    for i,c in enumerate(p.chars):
        victim=c==p.victim
        chars.append(dict(id=c,name=names[c],color=VICTIM if victim else COLORS[i%len(COLORS)],
            clue='was alone with the murderer.' if victim else ctext(c),victim=victim))
    general=['Nobody was in the %s.'%m['roomNames'][c[1]] for c in clues if c[0]=='empty']
    # steps
    steps=[]; reasons={c:[] for c in p.chars}; placed=[]
    def line(ax,i): return 'the %s %s'%(ORD(i+1),'row' if ax=='row' else 'column')
    for e in log:
        if e[0]=='rel':
            cl=e[1]; a=cl[1]; b=cl[3] if cl[0]=='dir' else cl[2]
            txt='%s %s'%(names[a],clue_text(p,m,cl,names))
            if e[2]: reasons[a].append(('rel',txt))
            if e[3]: reasons[b].append(('rel',txt))
        elif e[0]=='hidden':
            ch,ax,i=e[1],e[2],e[3]
            reasons[ch].append(('hidden','%s is the only one who can still fill %s.'%(names[ch],line(ax,i).replace('the ','the ',1))))
        elif e[0]=='pair':
            a,b,ax,lines,o=e[1],e[2],e[3],e[4],e[5]
            kind='rows' if ax=='rows' else 'columns'
            reasons[o].append(('pair','%s and %s lock the %s and %s %s between them, so nobody else fits there.'%(names[a],names[b],ORD(lines[0]+1),ORD(lines[1]+1),kind)))
        elif e[0]=='place':
            ch=e[1]; parts=[]
            if ch==p.victim: parts.append('%s was alone with the murderer, so they share a room with exactly one other person.'%names[ch])
            else: parts.append('%s %s'%(names[ch],ctext(ch)))
            seen=set()
            for kind,t in reasons[ch][::-1]:
                if t in seen or t==parts[0]: continue
                seen.add(t); parts.append(t)
                if len(parts)>=3: break
            if general and not placed: parts.append(general[0])
            if placed: parts.append('Rows and columns already taken are out.')
            parts.append('That leaves one open cell.')
            steps.append(dict(id=ch,text=' '.join(parts))); placed.append(ch)
    k=[c for c in p.chars if c!=p.victim and p.room(sol[c])==p.room(sol[p.victim])][0]
    rm=m['roomNames'][p.room(sol[p.victim])]
    rmtxt=('in the '+rm) if not rm.endswith('deck') else ('on the '+rm)
    out=dict(id=m['id'],num=m['num'],title=m['title'],difficulty=m['difficulty'],size=N,rooms=m['rooms'],roomNames=m['roomNames'],
        floors=m['floors'],objects=[[t,[list(c) for c in cells]] for t,cells in m['objects']],general=general,chars=chars,
        sol={c:'%d-%d'%sol[c] for c in sol},murderer=k,
        winText='%s was alone with %s %s. Nobody else was there.'%(names[k],names[p.victim],rmtxt),steps=steps)
    return out
if __name__=='__main__':
    outs=[]
    for i in range(len(MAPS)):
        try: res=json.load(open('out%d.json'%i))
        except Exception as ex: print('missing',i,ex,file=sys.stderr); continue
        if not res['clues']: print('none',i,file=sys.stderr); continue
        outs.append(convert(i,res))
    json.dump(outs,open('new_puzzles.json','w'),ensure_ascii=False,indent=1)
    for o in outs:
        print(o['id'],o['title'],o['general']); 
        for c in o['chars']: print('  ',c['name'],c['clue'])
        for s in o['steps'][:3]: print('   >',s['id'],s['text'])
