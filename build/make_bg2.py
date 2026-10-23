#!/usr/bin/env python3
"""
生成 EROS 背景图案的两份 SVG（深色 / 浅色），供 CSS 按主题切换。

深色底：浮雕凸起 —— 左上受光（亮）、右下背光（暗）
浅色底：凹陷刻纹 —— 左上被遮挡（暗）、右下受光（亮）
两者是真正的物理反色，不是简单取反。
"""
import os
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'build')

TILE = 260
FS = 44
C = TILE / 2

LETTER = (
    f"<text x='{C}' y='{C + FS * 0.36:.1f}' font-family='Helvetica Neue,Helvetica,Arial,sans-serif' "
    f"font-size='{FS}' font-weight='700' letter-spacing='{FS * 0.16:.1f}' text-anchor='middle' "
    f"fill='%F%' opacity='%O%'>EROS</text>"
)
DIAMOND = (
    f"<path d='M{C} {C - FS * 1.02:.1f} l{FS * 0.30:.1f} {FS * 0.30:.1f} l-{FS * 0.30:.1f} {FS * 0.30:.1f} "
    f"l-{FS * 0.30:.1f} -{FS * 0.30:.1f} z' fill='none' stroke='%F%' stroke-width='2' opacity='%O%'/>"
)
SHAPE = LETTER + DIAMOND


def layer(dx, dy, color, op):
    body = SHAPE.replace('%F%', color).replace('%O%', str(op))
    return (f"<g transform='translate({dx},{dy})' fill='{color}' stroke='{color}' "
            f"opacity='{op}'>{body}</g>")


def svg(dark_layer, light_layer, face_color, face_op):
    return (
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{TILE}' height='{TILE}' "
        f"viewBox='0 0 {TILE} {TILE}'>"
        f"<g transform='rotate(45 {C} {C})'>"
        + dark_layer + light_layer + layer(0, 0, face_color, face_op) +
        "</g></svg>"
    )


# 深色底：亮部左上(受光)、暗部右下(背光) → 凸起
DARK = svg(
    layer(2.0, 2.0, '#000000', 0.30),     # 暗部：右下
    layer(-1.4, -1.4, '#ffffff', 0.10),   # 亮部：左上
    '#e6cf96', 0.17,                        # 面：米金
)
# 浅色底：暗部左上(遮挡)、亮部右下(受光) → 凹陷刻纹
LIGHT = svg(
    layer(-1.4, -1.4, '#3b2c15', 0.16),    # 暗部：左上
    layer(2.0, 2.0, '#ffffff', 0.75),      # 亮部：右下（纸面本身很亮，用白做高光）
    '#6b5326', 0.22,                        # 面：深棕
)

for name, content in [('eros-dark.svg', DARK), ('eros-light.svg', LIGHT)]:
    uri = 'data:image/svg+xml,' + urllib.parse.quote(content, safe='')
    p = os.path.join(OUT, name)
    open(p, 'w', encoding='utf-8').write(uri)
    print(f'  ✓ {name}  ({len(uri)} B)')

print('\n  把下面的 uri 填进 app.template.html 的 body::after 与 light 主题覆盖：')
print('  DARK :', 'data:image/svg+xml,' + urllib.parse.quote(DARK, safe='')[:80], '…')
