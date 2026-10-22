#!/bin/bash
# 监听 GitHub 上的 [反馈] Issue，有新反馈就打印并退出（用于唤醒 agent）
#
# 水位文件 /workspace/issue_watermark.txt 记录已处理过的最大 issue 号，
# 因此可以反复重启而不会重复上报。
#
# 用法: watch-issues.sh [循环次数, 默认 200] [每次间隔秒, 默认 8]
ROUNDS=${1:-200}
SLEEP=${2:-8}
REPO="Erostanni/home-bar-ledger"
WM=/workspace/issue_watermark.txt

[ -f "$WM" ] || echo 0 > "$WM"

for i in $(seq 1 "$ROUNDS"); do
  RES=$(curl -sS --max-time 30 \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/issues?state=all&per_page=100" 2>/dev/null)

  OUT=$(echo "$RES" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print('PARSE_FAIL'); raise SystemExit
if not isinstance(d, list):
    print('PARSE_FAIL'); raise SystemExit
wm = int(open('$WM').read().strip() or 0)
new = [x for x in d if x['number'] > wm]
if not new:
    print('NO_NEW'); raise SystemExit
for x in sorted(new, key=lambda y: y['number']):
    print('---')
    print('#' + str(x['number']), x['title'])
    print(x.get('body') or '(无正文)')
    print('链接:', x['html_url'])
print('WATERMARK', max(x['number'] for x in new))
" 2>/dev/null)

  case "$OUT" in
    PARSE_FAIL)
      # API 偶发失败，重试即可
      sleep "$SLEEP"; continue ;;
    NO_NEW)
      sleep "$SLEEP"; continue ;;
    *)
      echo "=== 检测到新反馈 ==="
      echo "$OUT" | grep -v '^WATERMARK'
      NEWWM=$(echo "$OUT" | grep '^WATERMARK' | awk '{print $2}')
      [ -n "$NEWWM" ] && echo "$NEWWM" > "$WM"
      exit 0 ;;
  esac
done
echo "本轮监听结束（$ROUNDS 次），无新反馈"
exit 0
