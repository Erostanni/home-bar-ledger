#!/bin/bash
# 查「待处理」的反馈（详见 check_feedback.py 里的说明）
exec python3 "$(dirname "$0")/check_feedback.py" "$@"
