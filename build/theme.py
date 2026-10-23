#!/usr/bin/env python3
"""把 app.template.html 里的硬编码颜色变量化，并加上浅色主题。"""
import re, sys

P = '/workspace/home-bar-ledger/build/app.template.html'
s = open(P, encoding='utf-8').read()

# ---------- 1) 扩充 :root 变量 ----------
old_root = """:root{
  --bg:#14100d; --panel:#1d1712; --panel2:#241d17; --line:#3a2f24; --line2:#4a3b2c;
  --tx:#ece3d5; --mu:#a08d75; --mu2:#7d6c58;
  --gold:#d9a441; --gold-d:#8a6420; --ok:#7fa35c; --warn:#d38b3a; --bad:#c0553f;
  --paper:#f6f1e4; --ink:#2b2620;
  --r:10px; --mono:"SFMono-Regular",Menlo,Consolas,"Courier New",monospace;
  --serif:"Playfair Display","Songti SC","STSong",Georgia,"Times New Roman",serif;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  --ease:cubic-bezier(.22,.61,.36,1);
}"""
new_root = """:root{
  /* 表面 */
  --bg:#14100d; --panel:#1d1712; --panel2:#241d17; --panel3:#1a1410;
  --line:#3a2f24; --line2:#4a3b2c;
  /* 前景 */
  --tx:#ece3d5; --tx2:#ddd3c4; --mu:#a08d75; --mu2:#7d6c58;
  /* 强调色（可换） */
  --gold:#d9a441; --gold-d:#8a6420; --gold-l:#e0ae4b; --gold-ink:#1a1409;
  --ok:#7fa35c; --warn:#d38b3a; --bad:#c0553f;
  /* 纸面（小票，独立配色，不随主题变） */
  --paper:#f6f1e4; --ink:#2b2620;
  /* 背景纹理 */
  --tex-opacity:.5; --tex-filter:none; --tex-size:240px;
  /* 其它 */
  --r:10px; --mono:"SFMono-Regular",Menlo,Consolas,"Courier New",monospace;
  --serif:"Playfair Display","Songti SC","STSong",Georgia,"Times New Roman",serif;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  --ease:cubic-bezier(.22,.61,.36,1);
  --fs:15px;
  --sh:0 10px 26px rgba(0,0,0,.24);
}

/* ============ 浅色主题 ============ */
html[data-theme="light"]{
  --bg:#ece6db; --panel:#fffdf8; --panel2:#f6f1e7; --panel3:#f0e9dc;
  --line:#ded4c2; --line2:#c6b9a2;
  --tx:#2b2620; --tx2:#4a4238; --mu:#6d6153; --mu2:#8b8070;
  --gold:#a9761f; --gold-d:#7d5615; --gold-l:#c08a2c; --gold-ink:#fffdf8;
  --ok:#4f7a35; --warn:#a8641c; --bad:#a63f2b;
  --tex-opacity:.28; --tex-filter:invert(1);
  --sh:0 8px 22px rgba(80,60,30,.10);
}
html[data-theme="light"] body{color:var(--tx)}
html[data-theme="light"] body::before{
  background:radial-gradient(900px 500px at 15% -5%, rgba(169,118,31,.10), transparent 60%),
             radial-gradient(700px 500px at 95% 105%, rgba(79,122,53,.08), transparent 60%);
  opacity:1;
}"""
assert old_root in s, 'root 块未匹配'
s = s.replace(old_root, new_root, 1)

# ---------- 2) 硬编码色 → 变量（UI 部分；小票纸张保持原样） ----------
REPL = [
    # 卡片渐变
    ('background:linear-gradient(180deg,#201a15,#1a1510)', 'background:linear-gradient(180deg,var(--panel),var(--panel3))'),
    ('background:linear-gradient(180deg,#1f1914,#1a1510)', 'background:linear-gradient(180deg,var(--panel),var(--panel3))'),
    ('background:linear-gradient(90deg,#201a15,#1b1611)', 'background:linear-gradient(90deg,var(--panel),var(--panel3))'),
    ('background:linear-gradient(90deg,#241d17,#1e1813)', 'background:linear-gradient(90deg,var(--panel2),var(--panel3))'),
    # 通用面板色
    ('background:#1a1410', 'background:var(--panel3)'),
    ('background:#16110d', 'background:var(--panel3)'),
    ('background:#2b2219', 'background:var(--panel2)'),
    ('background:#2a211a', 'background:var(--panel3)'),
    ('background:#2a2118', 'background:var(--panel2)'),
    ('background:#241d17', 'background:var(--panel2)'),
    ('background:#0f0c0a', 'background:var(--panel3)'),
    # 边框
    ('border:1px solid #3a2f24', 'border:1px solid var(--line)'),
    ('border:1px solid #4a3b2c', 'border:1px solid var(--line2)'),
    ('border-color:#4a3b2c', 'border-color:var(--line2)'),
    # 前景
    ('color:#ece3d5', 'color:var(--tx)'),
    ('color:#ddd3c4', 'color:var(--tx2)'),
    ('color:#7d6c58', 'color:var(--mu2)'),
    # 强调色上的文字
    ('color:#1a1409', 'color:var(--gold-ink)'),
    ('background:var(--gold);color:var(--gold-ink)', 'background:var(--gold);color:var(--gold-ink)'),
    # 金色渐变
    ('background:linear-gradient(180deg,#e0ae4b,#c89433)', 'background:linear-gradient(180deg,var(--gold-l),var(--gold))'),
    ('background:#e8b556', 'background:var(--gold-l)'),
    # 低库存红
    ('background:linear-gradient(90deg,#7a3a2c,var(--bad))', 'background:linear-gradient(90deg,var(--bad),var(--bad))'),
]
for a, b in REPL:
    s = s.replace(a, b)

# ---------- 3) 阴影变量化 ----------
s = s.replace('box-shadow:0 1px 0 rgba(255,255,255,.035) inset, 0 10px 26px rgba(0,0,0,.24)',
              'box-shadow:0 1px 0 rgba(255,255,255,.035) inset, var(--sh)')
s = s.replace('box-shadow:0 10px 30px rgba(0,0,0,.4)', 'box-shadow:var(--sh)')
s = s.replace('box-shadow:0 1px 0 rgba(255,255,255,.03) inset, 0 12px 30px rgba(0,0,0,.28)',
              'box-shadow:0 1px 0 rgba(255,255,255,.03) inset, var(--sh)')

# ---------- 4) 背景纹理用变量控制 ----------
s = s.replace("""  background-size:240px 240px;
  background-repeat:repeat;
  opacity:var(--bgtex,.5);
  transition:opacity .2s;""",
"""  background-size:var(--tex-size) var(--tex-size);
  background-repeat:repeat;
  opacity:var(--tex-opacity,.5);
  filter:var(--tex-filter,none);
  transition:opacity .25s, filter .25s;""")

# ---------- 5) 主题相关：body 背景跟随变量 ----------
s = s.replace('body{\n  background:var(--bg); color:var(--tx); min-height:100vh;',
              'body{\n  background:var(--bg); color:var(--tx); min-height:100vh;')

open(P, 'w', encoding='utf-8').write(s)
print('  ✓ 颜色变量化 + 浅色主题已写入')
