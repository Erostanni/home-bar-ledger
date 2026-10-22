#!/bin/bash
# 查新反馈（agent 每轮开头跑一次；也可让用户手动执行）
cd "$(dirname "$0")/.."
REPO="Erostanni/home-bar-ledger"
WM=/workspace/issue_watermark.txt
[ -f "$WM" ] || echo 0 > "$WM"
RES=$(curl -sS --max-time 30 \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/issues?state=all&per_page=100" 2>/dev/null)
OUT=$(echo "$RES" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print('ERR'); raise SystemExit
if not isinstance(d, list):
    print('ERR'); raise SystemExit
wm = int(open('$WM').read().strip() or 0)
new = [x for x in d if x['number'] > wm and '反馈' in x['title']]
if not new:
    print('NONE'); raise SystemExit
for x in sorted(new, key=lambda y: y['number']):
    print('=== 新反馈 #%d ===' % x['number'])
    print('标题:', x['title'])
    print(x.get('body') or '(无正文)')
    print('链接:', x['html_url'])
    print()
print('WATERMARK', max(x['number'] for x in new))
" 2>/dev/null)
case "$OUT" in
  ERR)   echo "❌ 查询失败（GitHub API 暂时不可用）"; exit 1 ;;
  NONE)  echo "✅ 没有新反馈"; exit 0 ;;
  *)     echo "$OUT" | grep -v '^WATERMARK'
         NEW=$(echo "$OUT" | grep '^WATERMARK' | awk '{print $2}')
         [ -n "$NEW" ] && echo "$NEW" > "$WM"
         echo "（已记录水位 $NEW）"
         exit 0 ;;
esac
