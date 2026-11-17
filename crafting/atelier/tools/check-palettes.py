# Palette check: distinctness between themes (Lab distance) and WCAG contrast. Usage: python3 tools/check-palettes.py proposals/themes proposals/themes/themes.json (palettes.py copied as new.py)
import json, sys, math, itertools, colorsys
sys.path.insert(0, sys.argv[1]); from new import NEW
def rgb(h): return [int(h[i:i+2],16)/255 for i in (1,3,5)]
def lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def lum(h): r,g,b=[lin(c) for c in rgb(h)]; return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b): A,B=sorted([lum(a),lum(b)]); return (B+0.05)/(A+0.05)
def lab(h):
    r,g,b=[lin(c) for c in rgb(h)]
    x=(0.4124*r+0.3576*g+0.1805*b)/0.95047; y=0.2126*r+0.7152*g+0.0722*b; z=(0.0193*r+0.1192*g+0.9505*b)/1.08883
    f=lambda t: t**(1/3) if t>0.008856 else 7.787*t+16/116
    return (116*f(y)-16, 500*(f(x)-f(y)), 200*(f(y)-f(z)))
def de(a,b): return math.dist(lab(a),lab(b))
def pal_dist(p,q): # how different two themes look: background weighted most, then accent, then progress
    return 1.0*de(p[0],q[0]) + 0.6*de(p[2],q[2]) + 0.3*de(p[3],q[3])
def report(T, label):
    worst=[]
    for mode in (0,1):
        ds=sorted((pal_dist(T[a][1+mode],T[b][1+mode]),a,b) for a,b in itertools.combinations(T,2))
        worst.append(ds[:4])
    print(label)
    for m,w in zip(('light','dark'),worst): print('  closest pairs ('+m+'):', ', '.join(f'{a}~{b} {d:.0f}' for d,a,b in w))
    fails=[]
    for k,(logic,L,D) in T.items():
        for m,(bg,fg,ac,pg) in (('light',L),('dark',D)):
            if cr(fg,bg)<7: fails.append(f'{k} {m} text {cr(fg,bg):.1f}')
            if cr(ac,bg)<3: fails.append(f'{k} {m} accent {cr(ac,bg):.1f}')
            if cr(pg,bg)<3: fails.append(f'{k} {m} progress {cr(pg,bg):.1f}')
            if de(ac,pg)<25: fails.append(f'{k} {m} accent~progress {de(ac,pg):.0f}')
            d = max(255-int(bg[i:i+2],16) for i in (1,3,5)) if m=='light' else max(int(bg[i:i+2],16) for i in (1,3,5))
            if d<24: fails.append(f'{k} {m} background too plain')
    print('  readability/tint problems:', fails or 'none')
old=json.load(open(sys.argv[2]))
OLD={t['id']:('',tuple(t['light'][k] for k in ('bg','fg','accent','progress')),tuple(t['dark'][k] for k in ('bg','fg','accent','progress'))) for t in old}
report(OLD,'BEFORE'); report(NEW,'AFTER')
