# 本地开发 & 实时修改

这份文档回答两个问题：

1. **怎么在你自己电脑上跑这个项目，改代码浏览器自动刷新？**
2. **有哪些本地插件/软件能做到类似的事（不依赖 AI）？**

---

## 一、你自己跑（推荐）

```bash
git clone https://github.com/Erostanni/home-bar-ledger.git
cd home-bar-ledger

npm run dev
# → 打开 http://localhost:8080
```

`npm run dev` 做了三件事：

| | |
|---|---|
| **静态服务** | 提供 `index.html`、`bar-data.json` 等文件 |
| **SSE 热重载** | 文件一变，浏览器**自动刷新**（不是手动 F5） |
| **自动重建** | 你改的是 `build/app.template.html`，dev server 会**自动跑编译**生成 `index.html` |

改任何一处源码，**约 1 秒后浏览器自动显示新内容**，全程不用敲命令。

### 完整循环

```
改 build/app.template.html
        ↓  (dev server 检测到，1 秒内)
自动 python3 build/compile.py → 生成 index.html
        ↓
SSE 广播 → 浏览器自动刷新
        ↓
你在页面上点右下角 ✎ 提意见
        ↓
反馈落盘 dev/feedback.json（本地）或开 GitHub Issue
```

### 目录分工

| 路径 | 改它干嘛 |
|---|---|
| `build/app.template.html` | **主战场** —— 应用源码（HTML + CSS + JS）|
| `build/translations.py` | 配方中文翻译 |
| `build/build_data.py` | 配方抽取规则、单位换算、参考价 |
| `index.html` | ⚠️ **自动生成，别手改** |
| `bar-data.json` | ⚠️ **自动生成，别手改** |

---

## 二、反馈怎么到你手里

三种出口，按可靠性排：

### ① 本地文件（零配置）

在 `http://localhost:8080` 上点右下角 ✎ → 反馈直接落盘 `dev/feedback.json`。

```bash
cat dev/feedback.json          # 手动看
bash dev/watch-feedback.sh 0   # 有新反馈就打印并退出
```

### ② GitHub Issue（跨设备）

在 URL 后面加 `?repo=你的用户名/仓库名`，点提交会打开一个**预填好的 Issue 页面**。

或者部署到 Pages 后 —— `version.json` 里写上 `repo` 字段，组件会自动读取，不用带参数。

### ③ 复制到剪贴板（保底）

点「复制最新一条」，直接粘贴给 AI 或同事。

---

## 三、不依赖 AI 的本地工具

这是你要问的重点。**下面这些全都本地跑，各有各的适用场景。**

### A. 只想要「改完自动刷新」

| 工具 | 怎么用 | 特点 |
|---|---|---|
| **VS Code Live Server** | 装扩展 → 右键 HTML → `Open with Live Server` | 最省事，10 万用户 |
| **VS Code Live Preview**（微软官方） | 同上 | 和 VS Code 深度集成 |
| **Python `http.server`** | `python3 -m http.server 8080` | 零依赖，但要手动刷新 |
| **Vite** | `vite --open` | 前端标配，**不刷新页面**（HMR，状态不丢）|
| **BrowserSync** | `browser-sync start --server --files "**/*.html"` | 老牌，CSS 注入不刷新 |

> **本项目已经自带这个能力**（SSE + 自动重建），不需要额外装东西。

### B. 想在浏览器里直接改

| 工具 | 说明 |
|---|---|
| **Chrome DevTools → Local Overrides** | 打开 `Overrides` 面板 → 指定本地文件夹 → 在 DevTools 里改 CSS/JS，**保存直接写回本地文件**。改完手动刷新即可 |
| **Sizzy**（macOS） | 浏览器里点元素直接改样式，标注同步成 CSS/代码粘回项目 |
| **Pastel**（macOS） | 在截图上画标注，代码同步到项目目录 |

### C. 想在浏览器里写代码（不用装 IDE）

| 工具 | 说明 |
|---|---|
| **StackBlitz** | 浏览器里跑完整 VS Code + Node，改完实时预览，本地零安装 |
| **CodeSandbox** | 同上，支持多人协作 |
| **GitHub Codespaces** | 云端 VS Code + Codespace 跑起来（代码在云端，有配额）|
| **v0.dev / Bolt.new / Lovable** | AI 生成/修改 React 应用（这里是 AI 参与）|

### D. 想在编辑器里让 AI 改（不经过我）

| 工具 | 说明 |
|---|---|
| **Claude Code** | 终端里跑，`/watch` 之后它改代码并自动跑起来给你看 |
| **Cursor** | VS Code 分支，内置 AI，能直接改当前文件 |
| **Cline / Roo Code** | VS Code 插件形态的 AI，能读写整个项目 |

### E. 页面标注 → 交给人改

| 工具 | 说明 |
|---|---|
| **Pastel** / **Sizzy** | 截图标注或直接改样式 |
| **Marker.io** | 网页上圈选 → 生成 issue 给开发者 |
| **Figma Dev Mode** | 设计稿 ↔ 代码对照，改设计稿能提示改哪段代码 |
| **`<!-- TODO -->` 注释** | 在 HTML 里写注释，用 `pug-include` / `html-comments` 渲染成可点的气泡 |

---

## 四、怎么选

```
只想要自动刷新？
   └─→ npm run dev（本项目自带） 或 VS Code Live Server

想改样式、立刻看效果？
   └─→ Chrome DevTools Local Overrides

想在浏览器里写完整项目？
   └─→ StackBlitz / CodeSandbox

想让 AI 改？
   └─→ Claude Code / Cursor（本地） 或 本项目的「页内反馈 → GitHub Issue」

想把标注交给别人改？
   └─→ Pastel / Sizzy / Marker.io
```

---

## 五、这个项目自带方案的取舍

**做了什么**

- SSE 热重载（比 Live Server 轻，零依赖）
- **自动重建**（改模板不用手动跑编译 —— 这是大多数教程没做的一环）
- 页内点击标注 → 生成精确到 `nth-of-type` 的 CSS 选择器
- 三种反馈出口（本地文件 / GitHub Issue / 剪贴板）

**没做什么 / 限制**

- **没有增量热更新（HMR）**：改完整页刷新，页面状态（当前选中的酒、已填的表单）会丢。
  对这个项目影响不大（状态本来就在 localStorage），但如果你之后要做复杂表单，得自己上 Vite。
- **只监听特定路径**：`build/app.template.html`、`index.html`、`bar-data.json`、`ui/`、`core/`。
  新增顶层文件不会被热重载，手动刷新即可。
- **沙箱里的隧道不稳**：`localhost.run` 免费额度限流，实测约 50% 失败。
  **要稳定访问就自己跑 `npm run dev`**，别依赖隧道。
- **没有真正的后端**：反馈落本地文件或 GitHub Issue，没有数据库。
  这是刻意的设计（见 README「数据与隐私」）。
