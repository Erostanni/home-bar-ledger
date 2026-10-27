# Issue #17 设计规范（第二轮）· 酒柜页 + 调制页

> 范围：仅「酒柜」与「调制」两页的**视觉与排版**。
> 不新增/删除功能、不改数据结构、不改交互流程、不改信息架构与页面区块顺序。
> 唯一入口：`build/app.template.html`（内联 CSS），编译产物为根目录 `index.html`。
> 基线：HEAD = `f2d5024`（第一轮改动已被 revert，当前为设计前状态）。

---

## 0. 前置事实（务必先读）

1. **`--serif` 里的 `"Playfair Display"` 是死声明**：`build/app.template.html` 中没有 `@font-face`、没有 `@import`、没有外链字体，实际生效的是 `"Songti SC","STSong",Georgia,"Times New Roman",serif`（macOS/iOS → 宋体；Windows → Georgia + 系统宋体；Android → Noto Serif CJK）。
   → **本轮的"酒单感"100% 靠排版细节实现**（字号、字重、字距、行高、细分隔线、留白、颜色层级、材质与光影），不靠换字体。任何"换成某款衬线体"的写法都不允许。
2. **`--sans` / `--mono` 已是系统字体栈**（PingFang SC / Segoe UI / Microsoft YaHei；SFMono-Regular / Menlo / Consolas），复用不新增外部依赖。
3. **建议**把 `--serif` 改成不含未加载字体的栈（见 §2 T0），避免后来者误以为已加载 Playfair。这是 CSS 变量值的覆盖，不涉及外部资源。
4. **禁止大面积 `backdrop-filter`**：全文保持既有 `backdrop-filter:blur(12px)`（仅 topbar）与 `blur(4px)`（仅 `.mask`）不变；本轮所有新效果一律用 `gradient` / `box-shadow` / `text-shadow` 实现。
5. **纹理限制**：`body::after` 的 EROS 满印水印（260px tile，opacity .5）本轮**不改**（属于全局品牌层，超出本轮范围）；但酒柜/调制页内部新增的纹理必须用 **SVG data-URI 或 CSS 渐变**，tile 尺寸 ≤ 128px，不得用大尺寸 `repeating-linear-gradient` 铺满全页。

---

## 1. 现状诊断（基于实际截图 + 源码逐条）

### 1.1 酒柜页（`preview/01-cabinet.png` 深色 / `preview/25-light-cabinet.png` 浅色）

| # | 现象（截图位置） | 代码依据 | 为什么"不够高级" |
|---|---|---|---|
| C1 | 20 张原料卡像一排"塑料方块"贴在背景上，看不出是"柜子里的一格一格" | `.stockcard{background:linear-gradient(180deg,var(--panel),var(--panel3));border:1px solid var(--line)}` | 深色下 `--panel:#1d1712` → `--panel3:#1a1410`，两端色差 ≈ 2/255，肉眼等于纯色块；`--line:#3a2f24` 与背景同色系，描边不产生"格子"边界 |
| C2 | 卡片没有任何材质，全页只有 EROS 水印一层噪声 | 全局无 wood/材质 token | 酒柜是"木头 + 玻璃柜 + 顶灯"的场景，却用了纯 CSS 面板色，材质缺失是"廉价感"最大来源 |
| C3 | 卡片左上角看不到任何高光/受光面，像平面印刷 | `.card`/`.stockcard` 仅有 `box-shadow:0 1px 0 var(--inset) inset`，而 `--inset:rgba(255,255,255,.035)` | 1px、3.5% 透明度的内高光在 2x 屏几乎不可见，等于没有顶光 |
| C4 | 酒名与说明文字"浮"在色块上，没有被光打亮的感觉 | `.stockcard .nm{font-weight:600;font-size:13px}` 无 `text-shadow` | 深色底 + 亮字，缺少"光从上方来"的暗部过渡，文字发飘 |
| C5 | 卡片间距只有 9px，几乎贴在一起，网格感为零 | `.stocklist{gap:9px;grid-template-columns:repeat(auto-fill,minmax(196px,1fr))}` | 缝隙过窄 → 木纹/隔板/搁板阴影没有呼吸空间，"网格化"被压缩成"列表" |
| C6 | 余量进度条看不见轨道 | `.bar{background:var(--panel3)}`，而 `--panel3` 正是卡片底色 | 轨道与卡面同色 → 进度条像"半截浮线"，缺少金属/玻璃质感的凹槽 |
| C7 | 左侧 3px 竖条是"色块"而非"瓶位标" | `.stockcard::before{width:3px;background:var(--line2)}` | `--line2:#4a3b2c` 与边框同色，宽 3px 直贯到底，看起来像描边失误而不是设计元素 |
| C8 | 页面标题"酒柜"与正文同族同级，缺少主标题气势 | `.pagehead h2{font-family:var(--serif);font-size:var(--fs-xl);letter-spacing:.2px}` | `--fs-xl:25px`、字距 .2px、无字重变化、无字色层级，读起来和 `.card h3` 一个量级 |
| C9 | 分类筛选是一排圆角胶囊（20px radius），与"酒单分类标签"审美相反 | `.sfcat{border-radius:20px;border:1px solid var(--line);background:var(--panel3)}` | 胶囊按钮是"Web App 筛选器"语言；顶级酒单的分类是极小、字距拉开的文字标签 |
| C10 | 浅色主题下木质感更弱：白卡片 + 浅灰描边，像 Excel 单元格 | `--panel:#fffdf8` / `--line:#ded4c2` | 浅色主题完全没有材质层次，只剩色块 |
| C11 | 移动端（`preview/07-mobile.png`）卡片高度被压扁，`420 ml / ¥60.00` 两行挤在一起 | `@media` 下 `.stockcard` 只放大按钮 | 移动端仍用桌面同一套 13px/11.5px 字号，层级不可读 |

### 1.2 调制页（`preview/02-mix.png`）

| # | 现象（截图位置） | 代码依据 | 为什么"不够高级" |
|---|---|---|---|
| M1 | 左栏不像"酒单"，像"筛选器 + 列表" | `.recitem{padding:9px 12px;border-radius:8px;border:1px solid transparent}`，条目间无分隔线 | 顶级酒单的核心是**条目节奏**：细分隔线 + 留白 + 字号对比。这里 663 条挤成一坨，无法扫读 |
| M2 | 左栏条目里，菜名、杯型/做法、标签三种信息几乎同字号同色 | `.recitem .rn{13.5px/500}`、`.rg{11px;--mu2}`、`.rt .pill{9.5px}` | 全是同一套 sans，缺少"酒名最大最醒目"的层级 |
| M3 | 分类维度（风格/基酒/谱系）用小灰字标签 + 胶囊 chip，像后台筛选器 | `.mixflabel{font-size:10.5px;color:--mu2}` + `.mixfrow .sfcat` 胶囊 | 酒单的分类是"章节标题"，筛选器是"控件"，两种语言混在一栏里 |
| M4 | 右栏酒名（`h3` inline 20px）与下方原料名（`.rd .l1` 13.5px）虽然族不同（h3 走 `.card h3{font-family:var(--serif)}`），但字重/行距/颜色几乎一致，肉眼看不出"这是一道菜的名字" | `.card h3` 基础 14px，被 inline `font-size:20px` 覆盖；`.rd .l1{font-size:13.5px}` | 只靠"字体族"区分，但宋体 vs 无衬线的差异被小字号和缺字距吃掉了 |
| M5 | 材料区标题"材料 / 装饰 / 做法"是 inline style 写的 10.5px 金色字，没有酒单式的分节规则线 | `style="color:var(--gold);font-size:10.5px;letter-spacing:1.6px"` | 分节之间没有"细横线 + 留白"的节奏，读起来是连续流 |
| M6 | 用量与成本挤在右列 12px mono 里，`≈ ¥14.40` 缩到 `--mu2` 几乎不可读 | `.rd .l2{font-family:var(--mono);font-size:12px;color:--mu)}` | 数字是酒单里最有价值的信息（用量/成本），却做得比正文还小 |
| M7 | 做法步骤与普通段落同级 | `.steps li{font-size:13.5px;color:var(--tx2);border-bottom:1px dashed var(--line)}` | 虚线分隔太"软"，且步骤没有"指令感"（行距 1.6 太紧、序号圆盘与 pill 同款） |
| M8 | 份数控件是 30px 实心金色方块，与整页金色按钮同款，没有层级 | `.servings button.on{background:var(--gold);color:var(--gold-ink)}` | "记录这一杯"（主 CTA）与"份数 2"（参数选择）同款视觉权重，页面没有主次 |
| M9 | 右栏底部的成本与总量挤在一行 `tiny dim` 里 | `<div class="tiny dim">单杯用量 ... · 成本 ...</div>` | 一道酒的收尾信息（总用量、总成本）被埋在最小字号里 |
| M10 | 右栏顶部酒名与"英文原文 / 份数"控件挤在同一行的两端，标题区没有仪式感 | `.spread` + inline `h3` | 标题与操作控件平级，缺少"菜单抬头"的独立区块 |

---

## 2. 设计 token 表

> 命名约定：酒柜相关 `--cab-*`，酒单/调制相关 `--menu-*`，共用材质 `--wood-*`。
> 全部为**新增变量**（除 T0–T2 标注为覆盖），插在 `build/app.template.html` 的 `:root{}` 与 `html[data-theme="light"]{}` 两处对应位置。

### T0（覆盖）字体栈

| 变量 | 主题 | 取值 | 说明 |
|---|---|---|---|
| `--serif` | 深浅通用 | `"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","Noto Serif SC",Georgia,"Times New Roman",serif` | **删除未加载的 `"Playfair Display"`**，保留宋体优先。加注释：`/* 只用系统衬线，禁止引入网络字体 */` |

### T1 材质与光（木纹 / 顶光）

| 变量 | 深色取值 | 浅色取值 | 用途 |
|---|---|---|---|
| `--wood-face` | `#241c14` | `#e7d9c0` | 木板卡面主色（顶） |
| `--wood-face-2` | `#18120c` | `#d9c6a5` | 木板卡面渐变底色（底） |
| `--wood-edge` | `#3b2c1d` | `#c3ab84` | 木板描边 / 隔板色 |
| `--wood-grain-ink` | `#0b0703` | `#8a6a3f` | 木纹线条色（写进 SVG data-URI） |
| `--wood-grain-a` | `.20` | `.13` | 木纹整体透明度（SVG 内 opacity） |
| `--wood-grain-tile` | `96px 96px` | `96px 96px` | 木纹 tile 尺寸 |
| `--wood-sheen` | `rgba(255,226,176,.13)` | `rgba(255,255,255,.55)` | 顶部受光高光（1px 线） |
| `--wood-lamp` | `rgba(255,214,150,.16)` | `rgba(255,246,214,.28)` | 射灯光锥颜色 |
| `--wood-lamp-2` | `rgba(255,214,150,.05)` | `rgba(255,246,214,.08)` | 光锥外缘 |
| `--shelf-shadow` | `rgba(0,0,0,.55)` | `rgba(96,72,40,.34)` | 搁板下方内阴影 |

### T2 酒柜排版与阴影

| 变量 | 深色取值 | 浅色取值 | 用途 |
|---|---|---|---|
| `--cab-title-shadow` | `0 2px 10px rgba(0,0,0,.55), 0 0 24px rgba(217,164,65,.12)` | `0 1px 2px rgba(96,72,40,.28)` | 页面主标题 |
| `--cab-name-shadow` | `0 1px 0 rgba(0,0,0,.60), 0 0 14px rgba(255,206,140,.10)` | `0 1px 0 rgba(255,255,255,.75)` | 卡片酒名 |
| `--cab-meta-shadow` | `0 1px 0 rgba(0,0,0,.45)` | `none` | 卡片副信息 |
| `--cab-track` | `#120d09` | `#cbb694` | 余量进度条轨道（凹槽） |
| `--cab-track-h` | `3px` | `3px` | 轨道高 |
| `--cab-r` | `12px` | `12px` | 卡片圆角（由 11px 提升到 12px，与 `.card` 的 13px 拉开） |
| `--cab-gap` | `14px 16px` | 同 | `.stocklist` 行列间距（由 `gap:9px` 覆盖） |
| `--cab-col` | `210px` | 同 | `.stocklist` 最小列宽（由 196px 覆盖） |

### T3 酒单（调制页）语义色与规则线

| 变量 | 深色取值 | 浅色取值 | 用途 |
|---|---|---|---|
| `--menu-paper` | `#171310` | `#fffdf8` | 酒单面板底色 |
| `--menu-paper-2` | `#100d0a` | `#f7f1e4` | 酒单面板渐变底 |
| `--menu-rule` | `rgba(236,227,213,.10)` | `rgba(43,38,32,.14)` | 极细分隔线（1px 实线） |
| `--menu-rule-strong` | `rgba(217,164,65,.34)` | `rgba(169,118,31,.40)` | 分节下的金色短线 |
| `--menu-kicker` | `#a08d75` | `#6d6153` | 分类小标题 / 分节标题色 |
| `--menu-name` | `#f2e9db` | `#2b2620` | 酒名色（比正文 `--tx` 更"亮"，在深色上抬起一级） |
| `--menu-sub` | `#a08d75` | `#6d6153` | 副标题 / 做法描述色 |
| `--menu-price` | `#d9a441` | `#a9761f` | 数字类强调（用量、成本） |
| `--menu-letter` | `.3em` | `.3em` | 分类/分节小标题字距 |

### T4 字号字阶（调制页右栏）

| 变量 | 取值 | 用途 |
|---|---|---|
| `--fs-drink` | `30px`（移动 `22px`） | 酒名 |
| `--fs-kicker` | `10px` | 分节标题 / 分类标题 |
| `--fs-ing` | `14.5px` | 原料中文名 |
| `--fs-ing-en` | `12.5px` | 原料英文名（衬线） |
| `--fs-step` | `13.5px` | 做法步骤 |
| `--fs-qty` | `15px` | 用量数字（mono，右对齐） |
| `--fs-cost` | `10.5px` | 单位成本 |
| `--lh-drink` | `1.15` | 酒名行高 |
| `--lh-step` | `1.9` | 做法行高 |

> 说明：`--fs-*` 已有同名系列（`--fs-xs`…`--fs-xl`）。本轮新增变量一律带 `--fs-` 前缀但用**不同名字**（`--fs-drink` 等），避免与既有 `--fs-lg` 混淆；既有 `--fs-*` 保持不变。

---

## 3. 酒柜页规格

### 3.1 木纹材质（核心）

**做法 A（推荐，主方案）**：一个 **96×96 的 SVG turbulence tile**，横向纹理（木纹沿卡片横向延伸），作为 `.stockcard` 的最上层 `background-image`，用 `background-blend-mode` 与木色底融合。

SVG 源（需 URL-encode：`#`→`%23`，`<`→`%3C`，`>`→`%3E`，`"`→`'`）：

```svg
<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'>
  <filter id='g' x='0' y='0' width='100%' height='100%'>
    <feTurbulence type='fractalNoise' baseFrequency='0.006 0.55'
                  numOctaves='3' seed='7' stitchTiles='stitch'/>
    <feColorMatrix type='matrix'
      values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.62 0.26 0.12 0 0'/>
  </filter>
  <rect width='96' height='96' filter='url(#g)' opacity='0.20'/>
</svg>
```

- `baseFrequency="0.006 0.55"`：x 方向频率极低、y 方向频率高 → 生成**横向细条纹**（像顺纹木板）。
- `feColorMatrix` 把 RGB 归零、alpha 设为 `0.62R+0.26G+0.12B` → 输出纯黑带透明度的噪点，用 `rect opacity` 控制整体强度（深色 .20，浅色把矩阵颜色换成 `1 0 0 0 0` 之类的暖色行并把 opacity 降到 .13 → 浅色木纹）。
- 深/浅两套各自一份 data-URI，存为变量 `--wood-grain-url`（深）/ `--wood-grain-url-l`（浅），或直接写成两个 `background-image` 声明（推荐后者，避免再引一层变量）。

**做法 B（兜底，纯 CSS 渐变，无 SVG）**：三段低透明度横向条纹叠加，作为不支持/性能降级时的替换：

```css
background-image:
  repeating-linear-gradient(180deg, rgba(0,0,0,.055) 0 1px, transparent 1px 6px),
  repeating-linear-gradient(180deg, rgba(0,0,0,.035) 0 1px, transparent 1px 13px);
background-size:100% 6px, 100% 13px;
```
> 禁止把 1000px+ 的 `repeating-linear-gradient` 铺满全页；tile 必须在 6–16px 量级。

**应用位置与写法**：

```css
/* 深色 */
.stockcard{
  background-color:var(--wood-face-2);
  background-image:
    url("data:image/svg+xml,...grain..."),        /* 木纹 */
    linear-gradient(180deg,var(--wood-face),var(--wood-face-2));
  background-size:var(--wood-grain-tile) var(--wood-grain-tile), 100% 100%;
  background-blend-mode:soft-light,normal;        /* 深色：木纹压在木色上 */
  border:1px solid var(--wood-edge);
  border-radius:var(--cab-r);
  box-shadow:
    inset 0 1px 0 var(--wood-sheen),              /* 顶部受光 */
    inset 0 -10px 14px -10px var(--shelf-shadow), /* 搁板下方内阴影 */
    0 1px 2px rgba(0,0,0,.35),
    0 8px 18px -8px rgba(0,0,0,.45);
}
```
- `background-blend-mode` 在小面积卡片上开销可接受；**若开发 agent 判断低端机有压力**，可退回做法 B（去掉 turbulence 与 blend，纯渐变 + 条纹），视觉降级但仍保留"木"的方向感。
- 浅色主题：`background-blend-mode:multiply,normal`，木纹图换成暖棕 alpha .13。

### 3.2 网格化

| 选择器 | 现状 | 规范 |
|---|---|---|
| `.stocklist` | `grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:9px` | 覆盖为 `grid-template-columns:repeat(auto-fill,minmax(var(--cab-col),1fr));gap:var(--cab-gap)`（210px / 14px×16px） |
| `.stocklist` 容器背景 | 无 | 加一层"柜体阴影"：`.stocklist{background:radial-gradient(120% 60% at 50% 0%, rgba(0,0,0,.28), transparent 70%)}`（浅色用 `rgba(96,72,40,.10)`），让整片区域像"柜内"而不是"白底上摆卡片" |
| `.stockcard` | `min-height:112px` | 保持 112px；**不再压低**，保证三行信息（标题 / 副信息 / 两行数值）都舒展 |
| 移动端 | `@media` 未针对 `.stocklist` | 加 `@media (max-width:640px){.stocklist{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px 10px}}`；`.stockcard .nm` 字号提到 13.5px，`.amt` 提到 12px |

- **竖向"格线"不画**：列宽由 `auto-fill` 计算，不可预测，用固定 `repeating-linear-gradient` 画竖线会在不同屏宽错位。**改用"缝隙即格缝"**：卡片之间 16px 的深色空隙 + 卡片自身的木纹与边框 = 柜格。禁止为此引入 JS 测量。

### 3.3 顶光（每张卡片一盏射灯）

三层叠加，全部为渐变 / 阴影，无 blur：

1. **卡片内顶光带**（`.stockcard::after`，覆盖在文字下层）：
   ```css
   .stockcard::after{
     content:"";position:absolute;inset:0 0 auto 0;height:58%;pointer-events:none;z-index:0;
     border-radius:inherit;
     background:
       linear-gradient(180deg,var(--wood-lamp) 0%,var(--wood-lamp-2) 34%,transparent 78%);
     opacity:1;
   }
   .stockcard > *{position:relative;z-index:1}   /* 保证文字在光之上 */
   ```
2. **射灯光锥**（卡片顶部中央向下的锥形）——同一层里再加一枚径向渐变：
   ```css
   background:
     radial-gradient(90% 46% at 50% -12%, var(--wood-lamp), transparent 66%),
     linear-gradient(180deg,var(--wood-lamp) 0%,var(--wood-lamp-2) 34%,transparent 78%);
   ```
   → 视觉上：卡片最上方最亮，越往下越暗，模拟"柜顶灯从正上方打下来"。
3. **1px 受光边**：`inset 0 1px 0 var(--wood-sheen)`（见 §3.1 box-shadow），是"光落在木板上沿"的物理证据；浅色主题用 `rgba(255,255,255,.55)`，表现为高光而非发光。

> `.stockcard::before` 已被"左侧瓶位竖条"占用，光效走 `::after`。
> `.stockcard` 已有 `overflow:hidden`，光层不会溢出圆角，**无需**额外裁剪。

### 3.4 文字阴影

| 元素 | 选择器 | 深色 | 浅色 |
|---|---|---|---|
| 页面主标题「酒柜」 | `.pagehead h2` | `var(--cab-title-shadow)`；另加 `letter-spacing:1.5px`（现状 .2px 提升）、`font-weight:600` | `var(--cab-title-shadow)`；`letter-spacing:1.5px` |
| 卡片酒名 | `.stockcard .nm` | `var(--cab-name-shadow)` | `var(--cab-name-shadow)` |
| 卡片副信息（分类/ABV） | `.stockcard .cat` | `var(--cab-meta-shadow)`；`color` 由 `--mu2` 提到 `--mu` 以拉开与底纹对比 | `color:var(--mu)`；无阴影 |
| 指标条大数字 | `.metric .v` | `text-shadow:0 2px 6px rgba(0,0,0,.5)` | `text-shadow:none` |

> 阴影一律**两层以内**；第三层阴影会让 2x 屏上的小字发糊。

### 3.5 卡片层级与悬停反馈

| 状态 | 规范 |
|---|---|
| 静止 | 上述木纹 + 顶光 + 搁板内阴影；左侧竖条 `.stockcard::before` 改为 **4px** 且改为**上亮下暗的渐变**：`background:linear-gradient(180deg,var(--gold-d),rgba(217,164,65,.15) 60%,transparent)`（深色）/ `linear-gradient(180deg,var(--gold-d),rgba(169,118,31,.25))`（浅色），语义＝"这一格的瓶位标" |
| hover | `transform:translateY(-2px)`；`box-shadow` 追加 `0 14px 28px -12px rgba(0,0,0,.6)`；`inset 0 1px 0 var(--wood-sheen)` 提到更亮一档（用 `filter:brightness(1.04)` 作用于卡面，**不**加 backdrop-filter）；竖条 `::before` 整体变 `var(--gold)`（保留现状行为，但改为渐变而非纯色） |
| 进度条 | `.bar{height:var(--cab-track-h);background:var(--cab-track);box-shadow:inset 0 1px 2px rgba(0,0,0,.5)}` —— 轨道变成凹槽，与木面拉开；填充 `i` 保持 `linear-gradient(90deg,var(--gold-d),var(--gold))` |
| 焦点 | 保持 `:focus-visible{outline:2px solid var(--gold)}` 不变；`.stockcard` 本身不可聚焦，无需额外处理 |

### 3.6 分类筛选（`.sfcat`）在酒柜页的改造

- 现状圆角胶囊 → 改为**文字标签**：`.stockfilter .sfcat{border:1px solid transparent;background:none;border-radius:0;padding:5px 11px;font-size:12px;color:var(--mu);letter-spacing:.4px}`。
- 选中态：不使用实心金色胶囊（太重、与 `--gold` 主按钮撞车），改为**金色下划线 + 金色文字**：
  `.sfcat.on{color:var(--gold);border-color:transparent;background:none;box-shadow:inset 0 -2px 0 var(--gold);font-weight:600}`。
- `box-shadow:0 0 0 2px rgba(217,164,65,.20)` 现状描边环去掉。
- 数量角标 `.sfcat i` 保持现状（`opacity:.6`），但字号收到 10px。

> ⚠️ 该改动同时作用于调制页左栏的 `.mixfrow .sfcat`。**调制页的 chip 需要保留"可选中"的可点感** → 调制页另行覆盖（见 §4.2）。

---

## 4. 调制页规格

### 4.1 整体

- `.mixwrap{grid-template-columns:340px 1fr;gap:16px}` → 覆盖为 **`380px 1fr`，gap 24px**。左栏变宽是酒单感的物理前提（酒单条目需要放得下"名称 + 右对齐数字"）。移动端（`<980px`）仍为单列堆叠，**不改**。
- 右栏容器 `#recipeDetail` 的 `.card` 改为酒单纸面：`.card` 内 `background:linear-gradient(180deg,var(--menu-paper),var(--menu-paper-2))`，`border-radius:14px`，内边距 `28px 34px`（移动端 `20px 18px`）。

### 4.2 左栏：酒单感

**4.2.1 面板与抬头**
- 左栏 `.card`（sticky, top:74px）背景改为酒单纸面（同上），`padding:22px 26px`。
- 在 `.searchbar` 上方加一行**酒单抬头**（纯 CSS/HTML 内新增一行静态文本，**不新增数据、不改交互**）：
  - 文本：`MENU · 调制单`（英文部分用 `--mono`，10px，`letter-spacing:.42em`，`color:var(--menu-kicker)`）
  - 下方一条 1px 实线 `--menu-rule`，再下方一条 32px 宽 2px 的 `--menu-rule-strong` 金色短横（酒单经典的双线抬头）。
  - ⚠️ 若开发 agent 认为新增文案等于改信息架构，可改为**纯装饰**（双线 + 留白，不加文字）。**需开发确认**。

**4.2.2 分类维度（`.mixfrow`）**
- `.mixflabel`（"风格/基酒/谱系"）→ 酒单章节标题：`font-size:var(--fs-kicker);letter-spacing:var(--menu-letter);color:var(--menu-kicker);font-weight:600;padding-top:2px`。
  - 中文没有 uppercase 效果，靠**字距**拉开（.3em）+ 小字号实现"极小标签"感。
- `.mixfrow .sfcat`（chip）→ 文字项，去边框去底：
  ```css
  .mixfrow .sfcat{border:1px solid transparent;background:none;border-radius:0;
    padding:3px 0;margin-right:14px;font-size:12px;color:var(--mu);letter-spacing:.3px}
  .mixfrow .sfcat:hover{color:var(--tx)}
  .mixfrow .sfcat.on{color:var(--gold);background:none;font-weight:600;
    box-shadow:inset 0 -2px 0 var(--gold)}
  ```
- 数量数字 `.sfcat i` → 放在词后，`font-family:var(--mono);font-size:10px;opacity:.55`。
- 每一行维度之间加 1px `--menu-rule` 细线（`.mixfrow + .mixfrow{border-top:1px solid var(--menu-rule);padding-top:8px}`），形成"目录分节"。

**4.2.3 条目节奏（`.recitem`）**

| 现状 | 规范 |
|---|---|
| `padding:9px 12px;border-radius:8px;border:1px solid transparent`，条目间无分隔 | `padding:12px 6px 12px 14px;border-radius:0;border-bottom:1px solid var(--menu-rule)`；`.reclist` 内条目 `gap:0`（当前 `.recitem` 本身无 margin，靠 padding 呼吸） |
| 名称 `.rn{13.5px/500}` | `.recitem .rn{font-family:var(--serif);font-size:15px;font-weight:600;letter-spacing:.4px;color:var(--menu-name);line-height:1.3}` |
| 副行 `.rg{11px;--mu2}` | `.recitem .rg{font-size:11.5px;color:var(--menu-sub);letter-spacing:.3px;margin-top:3px}` |
| 标签 `.rt .pill{9.5px;border-radius:20px}` | `.recitem .rt .pill{font-size:9.5px;padding:1px 7px;border-radius:3px;letter-spacing:.4px}`（**圆角从胶囊改小方**——酒单标签是方形小签） |
| 选中态 `.recitem.on{background:var(--panel2);border-color:var(--gold-d)}` | `.recitem.on{background:linear-gradient(90deg,rgba(217,164,65,.12),transparent 70%);border-bottom-color:var(--menu-rule)}` + 左侧 2px 金色竖条：`.recitem.on::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:2px;background:var(--gold);border-radius:2px}` |
| hover `.recitem:hover{background:var(--panel)}` | hover 只加极淡底 `rgba(236,227,213,.04)`（深）/ `rgba(43,38,32,.03)`（浅），**不动边框** |
| ABV 只混在 `.rg` 里 | 把 **ABV 数值移到条目右端右对齐**（数据已在 `.rg` 里，去重不新增字段）：`.recitem` 改 `display:grid;grid-template-columns:1fr auto;`，新增一个承载 ABV 的 `span`（由 `.rg` 的 ABV 片段迁出，**同一份数据、同一位置含义，只改排版**）→ 样式：`font-family:var(--mono);font-size:10.5px;color:var(--menu-kicker);font-variant-numeric:tabular-nums;align-self:center` |
| 无 dot leader | **不做**点引线（中文 + 无价格时点线反而杂乱） |

> ⚠️ "把 ABV 移到右列"是**视觉重排**，不新增字段、不改筛选逻辑，但需要动 `viewMix()` 里的模板字符串（把 `.rg` 中的 ABV 片段拆出来单独放一个 `span`）。**需开发 agent 判断**是否接受这一处模板改动；若不接受，退化方案是 ABV 继续留在 `.rg` 内，仅靠 `.rg` 的次级色区分（其余所有规范不受影响）。

**4.2.4 左栏滚动区**
- `.reclist{max-height:calc(100vh - 230px)}` 保持（不改布局），但因为左栏面板变高、抬头与分节线增加，`max-height` 建议调整为 `calc(100vh - 268px)`，避免页面出现双滚动条。**需开发确认**。

### 4.3 右栏：酒名 / 原料 / 做法 的排版区分

> **核心约束**：字体只有两族可用（`--sans` 无衬线、`--serif` 系统衬线）+ `--mono` 等宽数字。所以"区分"靠 **族 + 字号 + 字重 + 字距 + 行高 + 颜色** 六维组合，而不是三种字体。

**4.3.1 酒名（`.card h3`，配方详情里的标题）**

| 属性 | 规范 |
|---|---|
| 字体族 | `var(--serif)`（宋体/Georgia）—— **与原料名（无衬线）不同族** |
| 字号 | `var(--fs-drink)` = 30px（移动端 22px）。现状 inline `font-size:20px` 必须去掉，改为类控制 |
| 字重 | 600（不要 700，宋体 700 在 Windows 会退化成伪粗） |
| 字距 | `letter-spacing:.6px`（中文大字号需要正字距，负字距会让笔画糊） |
| 行高 | `var(--lh-drink)` = 1.15 |
| 颜色 | `var(--menu-name)`（深色下比正文 `--tx` 更亮一级） |
| 阴影 | `text-shadow:var(--cab-title-shadow)` |
| 装饰 | 标题下方 28px 宽、2px 高的金色短横（`::after`），与左侧 `.pagehead` 的风格呼应；下方 1px `--menu-rule` |

**4.3.2 副标题（杯型 · 做法 · ABV）**
- 现状 `.sub`（`tiny` 级）→ `font-family:var(--sans);font-size:12px;color:var(--menu-sub);letter-spacing:.8px;line-height:1.6`。
- 去掉 `font-size:11.5px` 的 `.card .sub` 默认值覆盖。

**4.3.3 一句话描述（`.tiny dim`，`r.desc`）**
- 改为**衬线、放大、加行距**，与"做法"的无衬线正文形成第三层区分：
  `font-family:var(--serif);font-size:14px;line-height:1.95;color:var(--tx2);letter-spacing:.3px;margin-top:12px;max-width:60ch`。
- 英文原文（`r.descEn`）保持 `var(--serif)` + `font-style:italic` + `color:var(--menu-sub)`，字号 12.5px。

**4.3.4 材料区（`.rd` 行）**

| 元素 | 规范 |
|---|---|
| 分节标题（"材料 / 装饰 / 做法"） | 抽成 `.sec-head`（可新增一个 class，不改结构）：`font-size:var(--fs-kicker);letter-spacing:var(--menu-letter);color:var(--menu-kicker);font-weight:600;text-transform:none`，下方 1px `--menu-rule` + 32px 金色短横（与酒名同款处理，形成"分节"节奏） |
| 原料中文名 `.rd .l1` | `font-family:var(--sans);font-size:var(--fs-ing);font-weight:600;color:var(--tx);letter-spacing:.2px` |
| 原料英文名 | **无衬线正文里混排衬线英文**：`.rd .l1 .en{font-family:var(--serif);font-size:var(--fs-ing-en);font-weight:400;color:var(--menu-sub);letter-spacing:.2px;margin-left:6px}`。现状 `.l1` 内是 `${label(l.n)}` 纯中文 + `.pill`；**英文名需从 `ING_META`/数据里的英文字段取** —— 若数据里没有稳定的英文字段，则**跳过本条**，只靠中文名与英文标签（"金酒 Gin"）的现有结构做区分。**需开发 agent 确认数据里是否有英文原料名** |
| 分类 pill（"烈酒"/"利口酒"） | `.rd .l1 .pill{border-radius:3px;font-size:9.5px;letter-spacing:.4px;padding:1px 6px}` —— 与酒柜页统一为小方签 |
| 用量 `.rd .l2` | `font-family:var(--mono);font-size:var(--fs-qty);color:var(--tx);font-variant-numeric:tabular-nums;text-align:right;letter-spacing:0`（现状 12px `--mu` → 15px `--tx`，用量是这张单子里最重要的数字） |
| 单位成本 `≈ ¥14.40` | `font-size:var(--fs-cost);color:var(--menu-kicker);font-family:var(--mono)`；**独占一行**，与用量之间 2px |
| 缺料提示 `可选·按 30 ml 扣` | 同上，成本级 |
| 分隔线 `.rd{border-bottom:1px dashed var(--line)}` | 改为 **1px 实线** `var(--menu-rule)`（虚线在深色下太重，且和步骤区的虚线重复）；`.rd` 的 `padding:9px 0` → `padding:13px 0`（酒单条目呼吸感） |
| 库存行 `.rd .st` | 保留 pill（`库存充足`/`缺 X ml`）；`现有 1820 ml` 用 `var(--mono);font-size:11px;color:var(--menu-kicker);font-variant-numeric:tabular-nums`；`.stockbar` 高 3px → 2px，轨道 `var(--cab-track)` |
| 网格 | `.rd{grid-template-columns:1fr auto;gap:6px 18px}` —— 列间距加大，右列数字与左列名字拉开 |

**4.3.5 做法（`.steps`）**

| 元素 | 规范 |
|---|---|
| 步骤文字 `.steps li` | `font-family:var(--sans);font-size:var(--fs-step);line-height:var(--lh-step);color:var(--tx2);padding:10px 0 10px 34px` |
| 序号圆盘 `::before` | 保持 counter，但改样式：`width:20px;height:20px;border-radius:50%;background:none;border:1px solid var(--gold-d);color:var(--gold);font-family:var(--mono);font-size:10px` —— **去掉实心 `--panel2` 底**，改成"铜环"，更像酒单编号 |
| 分隔线 `li{border-bottom:1px dashed var(--line)}` | 改为 1px 实线 `var(--menu-rule)`；最后一条去掉 |
| 子步骤 `.steps li.sub-step` | `font-size:12px;color:var(--menu-sub);letter-spacing:.3px`（现状已有 `color:var(--mu2)`，改为 menu-sub） |
| 英文步骤（`opacity:.55`） | 改为 `font-family:var(--serif);font-style:italic;font-size:12.5px;color:var(--menu-sub)`，去掉 `opacity:.55`（直接用颜色控制层级更可控） |

**4.3.6 装饰 / 备料（`otherRows`）**
- 分节标题同 `.sec-head`（现状是 `.rsec` 且 `color:var(--mu2)` → 统一为 `.sec-head` 规格，但用 `--menu-kicker` 而非金色，避免与"材料/做法"抢层级）。
- `.rd .l1` 里的装饰名保留 sans；量（`1 支 / 1 片`）走 `.l2` 的 mono 规格。

**4.3.7 份数控件（`.servings`）**

| 元素 | 规范 |
|---|---|
| 标签"份数" | `font-size:var(--fs-kicker);letter-spacing:var(--menu-letter);color:var(--menu-kicker)`（去掉 `.tiny.dim`） |
| 按钮 `.servings button` | `width:28px;height:28px;border-radius:4px;border:1px solid var(--menu-rule);background:none;color:var(--menu-sub);font-family:var(--mono);font-size:12px`（方形描边，酒单感） |
| 选中 `.servings button.on` | `background:none;color:var(--gold);border-color:var(--gold);font-weight:700;box-shadow:inset 0 0 0 1px rgba(217,164,65,.18)` —— **不再实心金底**，避免与"记录这一杯"主 CTA 抢权重 |
| hover | `border-color:var(--gold-d);color:var(--tx)` |
| 位置 | 与"英文原文"复选框同在右上角，但**整体下沉 6px** 并加 1px 左侧分隔线，与酒名标题块分离 |

**4.3.8 底部小结与主 CTA**

| 元素 | 规范 |
|---|---|
| 分隔线 `div.rrule2` | 现状 `border-top:1px solid var(--line)` → `1px solid var(--menu-rule)`，但**上方再加一条 2px 的 `--menu-rule-strong` 金色短线**（宽度 60px），形成"账单封口" |
| 总用量 | `font-size:12px;color:var(--menu-sub);letter-spacing:.4px`，`单杯用量 180 ml` |
| 总成本 | **提升一级**：`font-family:var(--mono);font-size:16px;color:var(--menu-price);font-variant-numeric:tabular-nums;letter-spacing:0`；`¥` 号用 `--gold-d`（深色）/ `--gold`（浅色），数字用 `--menu-price`。成本独立成行，**不再与用量挤在同一行** |
| 缺料提示 | `font-size:11.5px;color:var(--bad)`，保持 |
| 主 CTA「记录这一杯」 | `.btn.gold` 保持不变（唯一实心金色主按钮）；仅加 `box-shadow:0 8px 20px -8px rgba(217,164,65,.45)` |

---

## 5. 可实现性标注

| 效果 | 可实现性 | 说明 |
|---|---|---|
| 木纹（feTurbulence SVG data-URI） | ✅ 纯 CSS | 内联 SVG，无外部资源。风险：首次栅格化有 CPU 开销 → tile 96×96、`numOctaves="3"`、不为每张卡片单独生成（浏览器缓存同一 data-URI 的解码结果） |
| 木纹（repeating-linear-gradient 条纹） | ✅ 纯 CSS | 兜底方案，性能最差时优先 |
| 卡片顶光 / 射灯光锥 | ✅ 纯 CSS | `radial-gradient` + `linear-gradient` 叠加在 `::after` |
| 1px 受光边 / 搁板内阴影 | ✅ 纯 CSS | `box-shadow: inset` |
| 文字阴影 | ✅ 纯 CSS | `text-shadow` |
| 酒单分节短线 / 双线抬头 | ✅ 纯 CSS | `::after` 伪元素 |
| 左栏抬头文案 `MENU · 调制单` | ⚠️ 需开发确认 | 新增一行静态文本 = 极轻微的信息新增；若判定不可接受，退化为纯装饰双线 |
| 左栏 ABV 移到右列右对齐 | ⚠️ 需开发确认 | 需要在 `viewMix()` 的 `.recitem` 模板里把 ABV 片段拆到独立 `span`；数据不变、筛选不变，仅重排 |
| 原料英文名（衬线英文） | ⚠️ 需开发 agent 确认数据 | 需确认 `ING_META` / 配方数据里是否有稳定的英文原料名字段；没有就跳过该条 |
| 分节标题抽成 `.sec-head` class | ⚠️ 需开发确认 | 现状是 inline style；抽 class 不改结构，但会动模板字符串 |
| 鼠标跟随的动态顶光（光标位置决定光斑） | ❌ 需 JS，且本轮**不做** | 550KB 单文件 + 滚动掉帧风险；用 CSS 静态顶光替代 |
| 悬停放大 / 卡片抬升 | ✅ 纯 CSS | `transform` + `box-shadow`，无 `backdrop-filter` |
| 竖向"柜格分隔线"随列数自适应 | ❌ 不用做 | `auto-fill` 列宽不可预测，固定 repeating 渐变会错位；用"缝隙即格缝" |

---

## 6. 验收标准（可逐条观察）

### 酒柜页

1. 放大到 200% 查看任一酒柜卡片，**卡面可见细密的横向木纹条带**（不是纯色块），且条纹方向沿卡片横向。
2. 每张卡片**最上沿有一道从上往下渐隐的高光**，越靠下越暗；卡片最上边缘有 1px 亮线。
3. 卡片**底部有向下的内阴影**，视觉上像卡片嵌在柜格/搁板里，而不是浮在背景上。
4. 卡片之间有 **≥14px 的深色缝隙**，整体呈明确的行列网格；单列宽度 ≥ 200px。
5. 酒名（`.stockcard .nm`）**带有一层黑色投影**（深色主题下把名字从木纹上"抬"起来），浅色主题下带一层白色 1px 投影。
6. 页面标题「酒柜」字号 ≥ 25px、字距明显拉开（有肉眼可见的字符间距），带金色微光阴影。
7. 余量进度条**轨道可见**（有独立的深色凹槽线），不再与卡面同色。
8. 分类筛选按钮**不再是圆角胶囊**，选中项是金色文字 + 下划线，未选中项无边框。
9. 移动端（375px）酒柜卡片单列或双列，卡名字号 ≥ 13.5px，数值行不重叠、不截断成乱码。
10. **全页滚动时帧率无明显下降**（木纹为 96px tile，非大尺寸 repeating 渐变铺满）。

### 调制页

11. 左栏**一眼看上去是酒单**：条目之间有 1px 实线细分隔线，条目**没有圆角边框**，选中项是**左侧 2px 金色竖条 + 极淡金色渐变底**，而不是一整块填充圆角框。
12. 左栏分类维度标题（"风格/基酒/谱系"）是**小字号 + 明显拉开的字距**（≥ .25em），chip 无边框、选中为金色下划线。
13. 左栏条目的**酒名明显大于副行**（≥ 15px vs 11.5px），酒名用**衬线族**（宋体/Georgia），副行用**无衬线族**——两者笔形粗细与衬线有无肉眼可辨。
14. 左栏条目右下/右侧有**右对齐的等宽数字**（ABV），纵向对齐成一条线。
15. 右栏**酒名 ≥ 30px 且为衬线族**，与下方原料名（14.5px 无衬线）**明显不同族**；酒名下方有金色短横 + 分节细线。
16. 右栏**原料名（无衬线 14.5px 粗）**、**原料英文（衬线 12.5px 细）**、**做法步骤（无衬线 13.5px 常规、行距 1.9）** 三者**在字体族 / 字号 / 字重 / 行高上至少两项不同**，不需要读内容就能看出是三个层级。
17. 右栏**用量数字（15px 等宽、右对齐）明显大于单位成本（10.5px）**，且右列数字纵向对齐成一条直线。
18. 材料区与做法区的分节之间是 **1px 实线细线**（不是虚线），并配一条短金色横线。
19. 步骤序号是**描边铜环**，不是实心圆盘；步骤行距明显比其他正文松。
20. 份数按钮是**方形描边**，选中为金色描边+金字（**不是实心金块**），与右下角"记录这一杯"实心金按钮**视觉权重明显不同**。
21. 右栏底部**总成本独立成行**、字号 ≥ 16px、为等宽数字、与"单杯用量"行明显分离。
22. **两个主题都要成立**：切到浅色主题后，上述每一条（顶光、木纹、右对齐数字、衬线/无衬线区分、层级）**仍然可见**，浅色下木纹是**浅棕条纹**而不是黑条纹，文字投影为**白色 1px**而不是黑色。

### 硬约束核对

23. 全文**无任何** `@font-face` / `@import` / `url(http...)` / 外链图片 / CDN 引用；新增纹理全部为 `data:image/svg+xml` 或 CSS 渐变。
24. `--serif` 中**不再有未加载的 `"Playfair Display"`**（或保留但有注释明确不依赖）。
25. 新增效果中**没有** `backdrop-filter`（除既有 topbar / mask 外）；无 `filter: blur()` 大面积使用。
26. 页面**功能与交互零变化**：筛选、排序、搜索、选配方、改份数、记录、增删改原料的行为与改版前完全一致；未新增/删除任何区块或按钮。
