# dev —— 本地预览与反馈闭环

开发这个项目时的两件套：**实时预览**（改代码，浏览器自动刷新）+ **页内反馈**（点哪都能提意见，agent 直接收到）。

---

## 快速开始

```bash
cd home-bar-ledger
node dev/server.js 8080        # 启动 dev server
# 浏览器打开 http://localhost:8080
```

dev server 相比直接开 `index.html` 多了三件事：

1. **注入实时重载** —— 改了 `index.html` / `bar-data.json` / `ui/` / `core/`，浏览器自动刷新
2. **注入反馈组件** —— 右下角铅笔按钮（快捷键 `F`）
3. **接收反馈** —— `POST /__feedback` → 落盘到 `dev/feedback.json`

> 只改了 `build/app.template.html` 的话，先 `python3 build/compile.py` 再刷新。

---

## 反馈组件怎么用

1. 点右下角 **✎**（或按 `F`）进入反馈模式
2. 鼠标划过页面，元素会**金色描边高亮**
3. **点击**目标元素 → 弹出输入框
4. 选优先级（细节 / 一般 / 必改），写意见
5. 点「提交」

提交后：
- 反馈会 `POST` 到 dev server，落盘 `dev/feedback.json`
- 如果 URL 带 `?repo=owner/name`，**同时会打开一个预填好的 GitHub Issue**（登录 GitHub 后点确认即可创建）

提交的内容包含：意见文字、优先级、CSS 选择器（精确到 `nth-of-type`）、元素文本、当前视图、视口尺寸、URL。

### agent 怎么收

```bash
# 等新反馈（阻塞直到有新的，然后打印并退出）
bash dev/watch-feedback.sh 0

# 或者直接读
cat dev/feedback.json
```

`dev/watch-feedback.sh` 可以挂成后台任务，**有反馈就自动唤醒 agent**，形成闭环。

---

## 公网访问（手机也能看）

本地 8080 端口在沙箱里，需要隧道才能从外网访问：

```bash
bash tools/tunnel-daemon.sh      # 自动重连，URL 写入 /workspace/tunnel_url.txt
```

> ⚠️ `localhost.run` 免费额度有限流，实测连续请求约 50% 失败率，**仅作调试用，别当正式预览**。
> 正式预览请用 GitHub Pages（见根目录 README「在线体验」）。

---

## 生产预览：GitHub Pages

推到 GitHub 后开 Pages，拿到稳定 URL。在那个 URL 上：

```text
https://<用户名>.github.io/home-bar-ledger/?repo=<用户名>/home-bar-ledger
```

带 `?repo=` 参数时，反馈组件会额外打开预填的 GitHub Issue —— 这是**离线环境下最可靠的反馈通道**，
因为 Issue 直接进仓库，agent 用 API 就能读到。

---

## 目录

```
dev/
├── server.js        # 静态服务 + SSE 热重载 + /__feedback 接口
├── feedback.js      # 反馈组件（点击标注、优先级、GitHub Issue 兜底）
├── watch-feedback.sh# 反馈监听器（有新反馈就退出，唤醒 agent）
└── feedback.json    # 反馈落盘（已 gitignore）
```
