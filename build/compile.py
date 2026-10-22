#!/usr/bin/env python3
"""把 bar-data.json 注入 app.template.html，产出可直接双击打开的 index.html"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

data = json.load(open(os.path.join(ROOT, 'bar-data.json'), encoding='utf-8'))
tpl = open(os.path.join(HERE, 'app.template.html'), encoding='utf-8').read()

# 防止 JSON 内容里的 </script> 截断脚本块
blob = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
blob = blob.replace('</', '<\\/')

if '/*__DATA__*/' not in tpl:
    print('模板缺少 /*__DATA__*/ 占位符', file=sys.stderr)
    sys.exit(1)

out = tpl.replace('/*__DATA__*/', 'const DATA = ' + blob + ';')

# 注入反馈组件（内联，产物零外部依赖，file:// 与 Pages 都能用）
fb_path = os.path.join(HERE, '..', 'dev', 'feedback.js')
fb = open(fb_path, encoding='utf-8').read()
if '/*__FEEDBACK_JS__*/' not in out:
    print('模板缺少 /*__FEEDBACK_JS__*/ 占位符', file=sys.stderr); sys.exit(1)
out = out.replace('/*__FEEDBACK_JS__*/', fb)
out_path = os.path.join(ROOT, 'index.html')
open(out_path, 'w', encoding='utf-8').write(out)

print(f'✓ {out_path}  {os.path.getsize(out_path)/1024:.0f} KB  ·  {len(data["recipes"])} 配方 / {len(data["ingredients"])} 原料')
