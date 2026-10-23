#!/usr/bin/env python3
"""生成 EROS 浮雕背景图案（45° 倾斜平铺），注入 app.template.html。

用法: python3 build/make_bg.py [tile] [font-size] [opacity]
"""
import os, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

TILE = int(sys.argv[1]) if len(sys.argv) > 1 else 300
FS = int(sys.argv[2]) if len(sys.argv) > 2 else 54
OP = float(sys.argv[3]) if len(sys.argv) > 3 else 0.15

C = TILE / 2
# 图案：EROS 字标 + 一个细菱形（做个"设计过的标记"的感觉）
letters = (
    f"<text x='{C}' y='{C + FS * 0.36:.1f}' font-family='Helvetica Neue,Helvetica,Arial,sans-serif' "
    f"font-size='{FS}' font-weight='700' letter-spacing='{FS * 0.16:.1f}' text-anchor='middle' "
    f"fill='%COLOR%' opacity='%OP%'>EROS</text>"
)
diamond = (
    f"<path d='M{C} {C - FS * 1.02:.1f} l{FS * 0.30:.1f} {FS * 0.30:.1f} l-{FS * 0.30:.1f} {FS * 0.30:.1f} "
    f"l-{FS * 0.30:.1f} -{FS * 0.30:.1f} z' fill='none' stroke='%COLOR%' stroke-width='2' opacity='%OP%'/>"
)
shape = letters + diamond

def layer(dx, dy, color, op):
    body = shape.replace('%COLOR%', color).replace('%OP%', str(op))
    return (f"<g transform='translate({dx},{dy})' fill='{color}' stroke='{color}' opacity='{op}'>"
            f"{body}</g>")

svg = (
    f"<svg xmlns='http://www.w3.org/2000/svg' width='{TILE}' height='{TILE}' viewBox='0 0 {TILE} {TILE}'>"
    f"<g transform='rotate(45 {C} {C})'>"
    + layer(2.0, 2.0, '#000', 0.30)      # 暗部：右下
    + layer(-1.4, -1.4, '#ffffff', 0.10) # 亮部：左上
    + layer(0, 0, '#e6cf96', OP)         # 面
    + "</g></svg>"
)
uri = "data:image/svg+xml," + urllib.parse.quote(svg, safe="")

p = os.path.join(HERE, "app.template.html")
s = open(p, encoding="utf-8").read()
import re
new_s, n = re.subn(r"background-image:url\(\"data:image/svg\+xml,[^\"]*\"\);", f'background-image:url("{uri}");', s, count=1)
if n == 0:
    print("❌ 模板里没找到背景 url 占位", file=sys.stderr); sys.exit(1)
new_s = re.sub(r"background-size:\d+px \d+px;", f"background-size:{TILE}px {TILE}px;", new_s, count=1)
open(p, "w", encoding="utf-8").write(new_s)
print(f"✓ 图案已更新：tile={TILE}px 字号={FS} 透明度={OP}")
