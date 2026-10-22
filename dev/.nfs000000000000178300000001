#!/bin/bash
# 监听 GitHub 上的 [反馈] Issue，有新反馈就打印并退出（用于唤醒 agent）
# 用法: watch-issues.sh [已知的最大 issue 号，默认 0]
LAST=${1:-0}
REPO="Erostanni/home-bar-ledger"
LOG=/tmp/watch-issues.log
for i in $(seq 1 600); do
  RES=$(curl -sS --max-time 30 \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/issues?state=open&per_page=50" 2>/dev/null)
  MAX=$(echo "$RES" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(max([x['number'] for x in d], default=0))
except Exception:
    print(0)
" 2>/dev/null)
  if [ -n "$MAX" ] && [ "$MAX" -gt "$LAST" ]; then
    echo "=== 发现新反馈 Issue（最大编号 $MAX，起始 $LAST）==="
    echo "$RES" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for x in sorted(d, key=lambda y:y['number']):
    if x['number'] > $LAST:
        print('---')
        print('#'+str(x['number']), x['title'])
        print(x.get('body') or '(无正文)')
        print('链接:', x['html_url'])
"
    exit 0
  fi
  sleep 6
done
echo "超时：未检测到新反馈"
exit 1
