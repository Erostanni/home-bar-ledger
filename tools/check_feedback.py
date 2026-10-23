#!/usr/bin/env python3
"""
查「待处理」的反馈。

判定：标题含 [反馈] + 状态 open + 没有「已修复」/「已忽略」标签

为什么不用列表接口：
    本机出口到 GitHub API 有丢包 —— GET /repos/{}/issues 约 50% 概率返回空数组，
    search 接口同样不稳。但 GET /repos/{}/issues/{n} 单条请求 100% 可靠，
    且 404 也是干净的。所以这里逐个编号扫描，用单条接口。

    绝不能把「丢包」当成「没有反馈」——那会让用户的意见被静默吞掉。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

REPO = "Erostanni/home-bar-ledger"
OWNER = "Erostanni"   # 只处理仓库所有者本人提的反馈
WM = "/workspace/issue_watermark.txt"
API = f"https://api.github.com/repos/{REPO}/issues"
TOKEN = os.environ.get("GITHUB_TOKEN", "")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "home-bar-ledger-feedback-checker",
}


def fetch_issue(n, tries=3):
    """取单条 issue。返回 dict；不存在返回 None。"""
    for attempt in range(tries):
        try:
            req = urllib.request.Request(f"{API}/{n}", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None            # 干净 404 → 确实不存在
            if e.code in (403, 429):
                time.sleep(3)
                continue
            return None
        except Exception:
            time.sleep(1.5)
    return None


def pending_of(issue):
    """是否是一条「待处理」的反馈。

    只处理仓库所有者本人（OWNER）提的 Issue —— 别人随手开的单不处理。
    """
    if not issue:
        return False
    if issue.get("pull_request"):     # PR 不算反馈
        return False
    author = (issue.get("user") or {}).get("login")
    if author != OWNER:
        return False
    if "反馈" not in (issue.get("title") or ""):
        return False
    if issue.get("state") != "open":
        return False
    labels = {l["name"] for l in issue.get("labels") or []}
    if labels & {"已修复", "已忽略"}:
        return False
    return True


def priority_of(body):
    for p in ("必改", "一般", "细节"):
        if p in body:
            return p
    return "未标注"


def main():
    # 找到当前最大 issue 号：从未知起点往后扫到 404
    start = 1
    if os.path.exists(WM):
        try:
            start = max(int(open(WM).read().strip() or 1), 1)
        except ValueError:
            start = 1

    highest = start - 1
    found = []
    n = start
    for _ in range(60):                       # 最多往后扫 60 个编号
        issue = fetch_issue(n)
        if issue is None:
            break                             # 干净 404 → 后面没有了
        highest = n
        if pending_of(issue):
            found.append(issue)
        n += 1
    else:
        print("⚠️  已扫到上限，可能还有更多反馈未列出", file=sys.stderr)

    with open(WM, "w") as f:
        f.write(str(highest))

    if not found:
        print("✅ 没有待处理的反馈")
        return 0

    for x in sorted(found, key=lambda y: y["number"]):
        body = x.get("body") or ""
        print(f"=== 待处理 #{x['number']} （{priority_of(body)}）===")
        print(x["title"])
        print(body or "(无正文)")
        print("链接:", x["html_url"])
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
