#!/bin/bash
# 反馈监听器：等待新反馈出现后退出，触发 agent 继续
# 用法: watch-feedback.sh [起始条数]
START=${1:-0}
F=/workspace/home-bar-ledger/dev/feedback.json
for i in $(seq 1 600); do
  if [ -f "$F" ]; then
    N=$(python3 -c "
import json,sys
try:
    print(len(json.load(open('$F'))))
except Exception:
    print(0)
" 2>/dev/null)
    if [ -n "$N" ] && [ "$N" -gt "$START" ]; then
      echo "=== 检测到 $N 条反馈（起始 $START）==="
      python3 -c "
import json
d=json.load(open('$F'))
for x in d[$START:]:
    print('---')
    print('优先级:', x.get('priority'), '| 视图:', x.get('view'))
    print('意见  :', x.get('note'))
    print('元素  :', x.get('selText'))
    print('选择器:', x.get('selector'))
    print('视口  :', x.get('viewport'))
"
      exit 0
    fi
  fi
  sleep 3
done
echo "超时：未检测到新反馈"
exit 1
