#!/bin/bash
# 收尾脚本：token 权限补齐后一键完成剩余步骤
#   1. 提交并推送 CI 工作流（需 workflow 权限）
#   2. 开启 GitHub Pages（需 administration 权限，否则请在网页端手动开）
#   3. 验证 Pages 是否可访问
set -u
cd "$(dirname "$0")/.."
REPO="Erostanni/home-bar-ledger"

export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
export GIT_CONFIG_VALUE_0="Authorization: Basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)"
export GIT_CONFIG_KEY_1="http.sslCAInfo"
export GIT_CONFIG_VALUE_1="$SSL_CERT_FILE"

H=(-H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json")

echo "════ 1. 推送 CI 工作流 ════"
if [ -f .github/workflows/ci.yml ]; then
  grep -v '^\.github/workflows/ci\.yml$' .git/info/exclude > /tmp/excl 2>/dev/null || true
  mv /tmp/excl .git/info/exclude 2>/dev/null || true
  git add -f .github/workflows/ci.yml
  git commit -q -m "ci: 启用 GitHub Actions（构建校验 + 85 项测试 + 浏览器端到端）" 2>/dev/null \
    || echo "  (无改动可提交)"
  git push origin main 2>&1 | tail -2
else
  echo "  ci.yml 不在本地"
fi

echo
echo "════ 2. 开启 Pages ════"
CODE=$(curl -sS --max-time 30 -X POST "${H[@]}" -o /tmp/pg.json -w "%{http_code}" \
  -d '{"source":{"branch":"main","path":"/"}}' "https://api.github.com/repos/$REPO/pages")
if [ "$CODE" = "201" ]; then
  python3 -c "import json;d=json.load(open('/tmp/pg.json'));print('  ✅ Pages:',d.get('html_url'))"
else
  echo "  API 无法开启（$CODE）→ 请到网页端 Settings → Pages → branch=main, path=/"
fi

echo
echo "════ 3. 验证 ════"
sleep 5
curl -sS --max-time 25 "${H[@]}" "https://api.github.com/repos/$REPO" | python3 -c "
import sys,json;d=json.load(sys.stdin)
print('  has_pages:', d.get('has_pages'), '| default_branch:', d.get('default_branch'))
"
for u in "https://erostanni.github.io/home-bar-ledger/"; do
  printf "  %s → HTTP " "$u"
  curl -sS -o /dev/null -w "%{http_code}\n" --max-time 25 "$u" 2>/dev/null || echo "未就绪"
done
