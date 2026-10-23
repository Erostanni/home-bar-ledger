#!/usr/bin/env python3
"""
批量生成鸡尾酒像素风横截面图 → 压缩为 128px WebP

用法: python3 build/gen_images.py [起始序号] [结束序号] [每批数量]
产物: assets/cocktails/<id>.webp  +  assets/cocktails/manifest.json
"""
import json, os, re, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'cocktails')
os.makedirs(OUT, exist_ok=True)

# 原料 → 颜色（十六进制）与描述
COLOR = {
    'gin': ('#cfe3e0', 'pale translucent spirit'), 'vodka': ('#e8eef0', 'clear spirit'),
    'rum': ('#e3c98d', 'golden aged rum'), 'whiskey': ('#c07a2c', 'deep amber whiskey'),
    'bourbon': ('#c07a2c', 'deep amber bourbon'), 'scotch': ('#b96b22', 'golden brown scotch'),
    'tequila': ('#eef0d8', 'pale agave spirit'), 'mezcal': ('#dfd4a8', 'cloudy agave spirit'),
    'cognac': ('#a45a1e', 'rich amber cognac'), 'brandy': ('#a45a1e', 'rich amber brandy'),
    'campari': ('#c0392b', 'vivid red bitter'), 'amaro': ('#8e2f2a', 'deep red bitter amaro'),
    'aperol': ('#e8743c', 'bright orange aperitivo'), 'vermouth': ('#d8b877', 'golden herbal vermouth'),
    'sweet vermouth': ('#d8b877', 'golden herbal vermouth'), 'dry vermouth': ('#ded3b0', 'pale dry vermouth'),
    'coffee': ('#4a2c19', 'dark espresso'), 'espresso': ('#3d2415', 'near black espresso'),
    'lime': ('#a8c93f', 'bright green citrus'), 'lemon': ('#e3d34a', 'pale yellow citrus'),
    'orange': ('#e8913a', 'orange citrus'), 'grapefruit': ('#d97a8c', 'pink grapefruit'),
    'pineapple': ('#e8c84a', 'golden pineapple'), 'cranberry': ('#b0243c', 'deep cranberry red'),
    'tomato': ('#c0392b', 'bright tomato red'), 'beet': ('#7a1a4a', 'deep magenta beet'),
    'cream': ('#f2ead6', 'thick pale cream'), 'milk': ('#f0e8d8', 'creamy white milk'),
    'soda': ('#cfe6ea', 'clear carbonated bubbles'), 'tonic': ('#b9d8dd', 'pale fizzy tonic'),
    'ginger': ('#d9b26a', 'warm ginger'), 'cinnamon': ('#9a5a2c', 'warm cinnamon brown'),
    'cacao': ('#3d2415', 'dark chocolate'), 'chartreuse': ('#9dbb4a', 'herbal green chartreuse'),
    'sherry': ('#b06a22', 'amber sherry'), 'prosecco': ('#e0d68a', 'pale sparkling wine'),
    'champagne': ('#e0d68a', 'pale sparkling wine'), 'absinthe': ('#7ea04a', 'herbal green absinthe'),
    'grenadine': ('#c0392b', 'bright red grenadine'), 'honey': ('#dfa63c', 'golden honey'),
    'blue': ('#3f6fa8', 'deep blue liqueur'), 'green': ('#4f8f3c', 'green liqueur'),
}
GLASS = {
    'Lowball': 'short rocks glass', 'Highball': 'tall highball glass', 'Coupe': 'shallow coupe glass',
    'Cocktail': 'stemmed cocktail glass', 'Nick and Nora': 'nick and nora glass',
    'Wine': 'wine glass', 'Hurricane': 'hurricane glass', 'Glass mug': 'heavy glass mug',
    'Tiki': 'tiki mug', 'Champagne': 'champagne flute', 'Fizzio': 'tall fizz glass',
    'Mason Jar': 'mason jar', 'Absinthe': 'absinthe glass', 'Shot': 'shot glass',
    'Nick & Nora': 'nick and nora glass', 'Julep': 'julep cup', 'Flute': 'champagne flute',
    'Oyster': 'oyster glass', 'Goblet': 'goblet', 'Snifter': 'snifter',
}


def palette_for(ings):
    """按配方主料取 2-3 个主色"""
    seen, cols = set(), []
    for i in ings:
        n = (i.get('n') or '').lower()
        for k, (hexc, desc) in COLOR.items():
            if k in n and k not in seen:
                seen.add(k); cols.append((hexc, desc))
        if len(cols) >= 3:
            break
    if not cols:
        cols = [('#c9b98f', 'amber spirit'), ('#8a5a2c', 'dark amber'), ('#e8d9a0', 'pale gold')]
    return cols


def prompt_for(rec):
    cols = palette_for(rec.get('ings') or [])
    g = GLASS.get(rec.get('glass') or '', 'cocktail glass')
    desc = ', '.join(d for _, d in cols)
    pal = ', '.join(c for c, _ in cols)
    name = rec.get('name') or ''
    return (f"Pixel art top-down cross-section of a {g} filled with a {name} cocktail, "
            f"seen from directly above, showing {desc} as concentric liquid layers, "
            f"chunky 8-bit pixel grid, limited retro palette of {pal}, "
            f"solid very dark background, crisp hard pixel edges, no text, no labels, "
            f"retro video game sprite style, centered")


def call_batch(items):
    """items: [(id, prompt)] → 返回 {id: node_id}"""
    payload = {"requests": [
        {"prompt": p, "aspect_ratio": "1:1", "resolution": "1K", "output_file": f"{rid}.png"}
        for rid, p in items
    ]}
    f = '/tmp/imgbatch.json'
    json.dump(payload, open(f, 'w'), ensure_ascii=False)
    r = subprocess.run(['mcode-tools', 'connector', 'call', 'connector__matrix__generate_image', '--args-file', f],
                       capture_output=True, text=True, timeout=1200)
    try:
        d = json.loads(r.stdout)
    except Exception:
        print('    调用失败:', (r.stdout or r.stderr)[:200]); return {}
    out = {}
    for it in d.get('success_items') or []:
        out[it['file_name'].rsplit('.', 1)[0]] = it['node_id']
    return out


def download(node_id, dest):
    r = subprocess.run(['mcode-tools', 'get_asset_url', node_id], capture_output=True, text=True, timeout=120)
    try:
        u = json.loads(r.stdout).get('download_url')
    except Exception:
        return False
    if not u:
        return False
    try:
        urllib.request.urlretrieve(u, dest)
        return True
    except Exception:
        return False


def main():
    data = json.load(open(os.path.join(ROOT, 'bar-data.json'), encoding='utf-8'))
    recipes = data['recipes']
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    end = int(sys.argv[2]) if len(sys.argv) > 2 else len(recipes)
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    todo = []
    for r in recipes[start:end]:
        p = os.path.join(OUT, r['id'] + '.webp')
        if os.path.exists(p):
            continue
        todo.append(r)

    from PIL import Image
    done = 0
    for i in range(0, len(todo), size):
        chunk = todo[i:i + size]
        items = [(r['id'], prompt_for(r)) for r in chunk]
        res = call_batch(items)
        for rid, nid in res.items():
            tmp = os.path.join(OUT, rid + '.raw')
            if not download(nid, tmp):
                continue
            try:
                im = Image.open(tmp).convert('RGB').resize((128, 128), Image.NEAREST)
                im.save(os.path.join(OUT, rid + '.webp'), 'WEBP', quality=82, method=6)
                os.remove(tmp)
                done += 1
            except Exception as e:
                print('    处理失败', rid, e)
        print('  进度: %d / %d (本批 %d 条)' % (done, len(todo), len(chunk)), flush=True)
        time.sleep(1)

    # manifest
    man = {}
    for r in recipes:
        if os.path.exists(os.path.join(OUT, r['id'] + '.webp')):
            man[r['id']] = r['id'] + '.webp'
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    print('  完成：%d 张图，manifest.json 已写' % len(man))


if __name__ == '__main__':
    main()
