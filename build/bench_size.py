#!/usr/bin/env python3
"""体积优化基准：对比几种数据编码方案在 原始体积 / gzip 体积 上的差异。"""
import json, gzip, os, io

D = json.load(open('/workspace/home-bar-ledger/bar-data.json', encoding='utf-8'))
R = D['recipes']


def gz(b):
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=9) as f:
        f.write(b if isinstance(b, bytes) else b.encode())
    return len(buf.getvalue())


def js(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':')).encode()


def report(name, data):
    raw = len(js(data))
    g = gz(js(data))
    print(f'  {name:<38} 原始 {raw//1024:>5} KB   gzip {g//1024:>5} KB')


print('=== 当前（A）===')
report('A 现状：对象 + 长键名 + 含英文', D)

# ---- B: 短键名 + ings 数组化 ----
ING_SHORT = {'n': 'n', 'ml': 'm', 'amt': 'a', 'u': 'u', 'opt': 'o', 'nonmetered': 'x', 'note': 'nt'}
def b_build(r):
    ings = [[i['n'], i['ml'], i['amt'], i['u'], 1 if i['opt'] else 0, 1 if i['nonmetered'] else 0,
              i.get('note') or '', i.get('refSize') or 0, i.get('refPrice') if i.get('refPrice') is not None else -1,
              i.get('zh') or ''] for i in r['ings']]
    return {'i': r['id'], 'n': r['name'], 'd': r['desc'], 'g': r['garnish'] or '', 's': r['steps'],
            'v': r['abv'], 'gl': r['glass'] or '', 'gz': r['glassZh'] or '', 'md': r['method'] or '',
            'mz': r['methodZh'] or '', 't': r.get('tags') or [], 'sy': r.get('styles') or [],
            'st': r['style'], 'b': r['base'], 'ln': r['lineage'], 'tr': r['tier'], 'z': 1 if r['zh'] else 0,
            'dE': r.get('descEn') or '', 'sE': r.get('stepsEn') or [], 'gE': r.get('garnishEn') or ''}

B = {'r': [b_build(r) for r in R], 'ing': ING_SHORT}
print('\n=== B：短键名 + ings 数组化（仍含英文）===')
report('B 短键名+数组化', B)

# ---- C: B 去掉英文原文 ----
C = json.loads(json.dumps(B))
for x in C['r']:
    x.pop('dE', None); x.pop('sE', None); x.pop('gE', None)
print('\n=== C：B 再去掉英文原文 ===')
report('C = B - 英文原文', C)

# ---- D: C 顶层也数组化 ----
Darr = {'r': [[x['i'], x['n'], x['d'], x['g'], x['s'], x['v'], x['gl'], x['gz'], x['md'], x['mz'],
               x['t'], x['sy'], x['st'], x['b'], x['ln'], x['tr'], x['z']] for x in C['r']], 'ing': ING_SHORT}
print('\n=== D：C 再把顶层也数组化 ====')
report('D = C 顶层数组化', Darr)

# ---- E: D + tags 去重 ----
alltags = sorted({t for r in R for t in (r.get('tags') or [])})
tid = {t: i for i, t in enumerate(alltags)}
E = {'r': [], 'ing': ING_SHORT, 'tg': alltags}
for x in C['r']:
    E['r'].append([x['i'], x['n'], x['d'], x['g'], x['s'], x['v'], x['gl'], x['gz'], x['md'], x['mz'],
                   [tid[t] for t in x['t']], x['sy'], x['st'], x['b'], x['ln'], x['tr'], x['z']])
print('\n=== E：D + tags 全局去重 ====')
report('E = D + tags 去重', E)

print('\n=== 对比 ===')
base_g = gz(js(D))
for nm, d in [('B', B), ('C', C), ('D', Darr), ('E', E)]:
    g = gz(js(d))
    print(f'  {nm}: gzip {g//1024:>4} KB  （较现状 {(g-base_g)*100//base_g:+d}%）')
