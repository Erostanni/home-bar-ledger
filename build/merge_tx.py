#!/usr/bin/env python3
"""把 tx/out*.py、tx2/out*.py 的翻译深合并进 translations.py。

注意：不能直接 TR.update() —— 补译批次只含 "d" 键，
直接 update 会把已有条目的 "g"（装饰）和 "s"（步骤）冲掉。
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TP = os.path.join(HERE, 'translations.py')

src = open(TP, encoding='utf-8').read()
# ⚠️ translations.py 里有多个 TR.update() 块，必须全部解析
blocks = re.findall(r'TR\.update\((\{.*?\n\})\)\n', src, re.S)
if not blocks:
    print('❌ 找不到 TR.update', file=sys.stderr); sys.exit(1)
TR = {}
for b in blocks:
    TR.update(eval(b))
print('  从 %d 个 TR.update 块解析出 %d 条' % (len(blocks), len(TR)))

added, patched = 0, 0
for d in ['tx', 'tx2']:
    dd = os.path.join(HERE, d)
    if not os.path.isdir(dd):
        continue
    for f in sorted(os.listdir(dd)):
        if not (f.startswith('out') and f.endswith('.py')):
            continue
        txt = open(os.path.join(dd, f), encoding='utf-8').read()
        mm = re.search(r'TR\.update\((\{.*\})\)\s*$', txt, re.S)
        if not mm:
            print('  ⚠️ 解析失败:', f); continue
        chunk = eval(mm.group(1))
        for k, v in chunk.items():
            if k in TR:
                # 深合并：只覆盖出现的键，保留其它
                TR[k] = {**TR[k], **v}
                patched += 1
            else:
                TR[k] = v
                added += 1
        print('  ✓ %s: %d 条' % (f, len(chunk)))

# 回写：保留文件头注释，替换所有 TR.update 块
head = src[:src.index('TR.update(')]
body = '\nTR.update(' + repr(TR) + ')\n'
open(TP, 'w', encoding='utf-8').write(head + body)
print('  新增 %d 条，覆盖 %d 条，合计 %d 条' % (added, patched, len(TR)))
