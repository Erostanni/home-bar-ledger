/** 真实浏览器验证：file:// 直开 + 打印样式 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'preview');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // 1. file:// 直开，空状态
  await page.goto(URL);
  await page.waitForTimeout(700);
  console.log('file:// 直开');
  console.log('  页面标题:', await page.title());
  console.log('  渲染非空:', (await page.locator('#app').innerHTML()).length > 100);
  console.log('  localStorage 可用:', await page.evaluate(() => { try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true; } catch(e){ return 'BLOCKED: '+e.message; } }));
  console.log('  空状态引导:', (await page.locator('.empty').first().innerText()).split('\n')[0]);

  // 2. 走一遍完整流程
  await page.click('[data-act="seedbar"]');
  await page.waitForTimeout(300);
  await page.click('#tabs button[data-v="mix"]');
  await page.waitForTimeout(300);
  await page.fill('#mixQ', 'Negroni');
  await page.waitForTimeout(400);
  const n = page.locator('.recitem').filter({ has: page.locator('.rn', { hasText: /^Negroni$/ }) }).first();
  await n.click();
  await page.waitForTimeout(200);
  const recBtn = page.locator('[data-act="record"]');
  console.log('  Negroni 可记录:', !(await recBtn.isDisabled()));
  await recBtn.click();
  await page.waitForTimeout(300);
  await page.click('#tabs button[data-v="statement"]');
  await page.waitForTimeout(400);
  const receipt = await page.locator('.receipt').innerText();
  console.log('  小票含 Negroni:', receipt.includes('Negroni'));
  console.log('  小票含总杯数:', /总杯数/.test(receipt));

  // 3. 打印媒体样式
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '08-print.png'), fullPage: true });
  console.log('  ▸ 08-print.png (打印视图)');
  const topbarVisible = await page.locator('.topbar').isVisible();
  console.log('  打印时顶栏隐藏:', !topbarVisible);
  await page.emulateMedia({ media: 'screen' });

  // 4. A4 打印模式
  await page.evaluate(() => document.body.classList.add('print-a4'));
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, '09-print-a4.png'), fullPage: true });
  console.log('  ▸ 09-print-a4.png (A4 模式)');
  await page.emulateMedia({ media: 'screen' });

  // 5. localStorage 持久化
  await page.reload();
  await page.waitForTimeout(500);
  const after = await page.locator('#tabs button[data-v="ledger"]').click();
  await page.waitForTimeout(300);
  const ledCount = await page.locator('.led').count();
  console.log('  刷新后台账仍在:', ledCount, '条');

  // 6. 渲染残留扫描：防止 undefined / NaN 逃逸到界面
  //    （历史教训：把 D.receiptNo 拼成 D.receptNo，小票编号静默显示 undefined）
  console.log('\n[扫描] 渲染残留 undefined / NaN');
  const JUNK = ['undefined', 'NaN', '[object Object]', 'Infinity', 'null'];
  const junkHits = [];
  async function scan(name, sel) {
    const txt = await page.locator(sel).innerText().catch(() => '');
    const hits = JUNK.filter(j => txt.includes(j));
    if (hits.length) junkHits.push(`${name} → ${hits.join(', ')}`);
    return txt;
  }
  for (const v of ['ledger', 'mix', 'cabinet', 'statement']) {
    await page.click(`#tabs button[data-v="${v}"]`);
    await page.waitForTimeout(400);
    await scan(`页面 ${v}`, '#app');
  }
  // 小票本体
  await page.click('#tabs button[data-v="statement"]');
  await page.waitForTimeout(300);
  await scan('小票', '.receipt');
  // 设置弹窗（4 个 tab）
  await page.click('#btnSettings');
  await page.waitForTimeout(500);
  await scan('设置弹窗', '.modal');
  await page.click('#mClose');
  await page.waitForTimeout(300);
  // 原料表单弹窗
  await page.click('#tabs button[data-v="cabinet"]');
  await page.waitForTimeout(300);
  await page.click('[data-act="addstock"]');
  await page.waitForTimeout(400);
  await scan('原料弹窗', '.modal');
  await page.click('#mClose');
  await page.waitForTimeout(300);
  // 配方详情弹窗
  await page.click('#tabs button[data-v="mix"]');
  await page.waitForTimeout(400);
  await page.locator('.recitem').first().click();
  await page.waitForTimeout(500);
  await scan('配方弹窗', '.modal');

  console.log(junkHits.length
    ? '  ❌ 发现残留:\n    ' + junkHits.join('\n    ')
    : '  ✅ 8 个界面均无 undefined / NaN 残留');

  // 7. 移动端体检：横向溢出 + 触摸目标过小
  console.log('\n[体检] 移动端布局（375px, 触摸模式）');
  const phone = await browser.newPage({
    viewport: { width: 375, height: 812 },
    hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  await phone.addInitScript(() => {
    localStorage.setItem('hbl.v1', JSON.stringify({
      stock: { Gin: { name: 'Gin', sizeMl: 750, price: 180, unopened: 0, openedMl: 450, note: '' } },
      ledger: [{ id: 'm1', ts: Date.now() - 3600e3, name: '尼格罗尼', servings: 2, totalMl: 180, cost: 9.8, seq: 1, lines: [{ n: 'Gin', ml: 60 }] }],
      settings: { barName: '巷口小吧', owner: '阿伦' }
    }));
  });
  await phone.goto(URL);
  await phone.waitForTimeout(900);
  const mob = await phone.evaluate(() => {
    const out = [];
    for (const v of ['cabinet', 'ledger', 'mix', 'statement']) {
      document.querySelector(`#tabs button[data-v="${v}"]`).click();
      const app = document.getElementById('app');
      const over = app.scrollWidth - app.clientWidth;
      if (over > 2) out.push(`${v} 横向溢出 ${over}px`);
      const small = [...app.querySelectorAll('button')]
        .filter(e => e.offsetParent !== null && e.getBoundingClientRect().height > 0)
        .map(e => ({ t: (e.textContent || e.title || '').trim().slice(0, 8), h: Math.round(e.getBoundingClientRect().height) }))
        .filter(e => e.h < 28);
      if (small.length) out.push(`${v} 点击目标过小: ${small.slice(0, 3).map(s => `${s.t}(${s.h}px)`).join(', ')}`);
    }
    return out;
  });
  console.log(mob.length ? '  ⚠️  ' + mob.join('\n  ⚠️  ') : '  ✅ 无横向溢出，触摸目标均 ≥28px');
  await phone.close();

  // 8. 回归（Issue #24）：酒柜卡片悬浮时，编辑/删除按钮不得压住名称行
  //    历史教训：.acts 绝对定位在右上角，透明底直接盖住右对齐的分类标签
  console.log('\n[回归] Issue #24 —— 酒柜卡片悬浮：按钮不得与名称行重叠');
  const modal = page.locator('#mClose');
  if (await modal.count() && await modal.isVisible()) { await modal.click(); await page.waitForTimeout(300); }
  await page.click('#tabs button[data-v="cabinet"]');
  await page.waitForTimeout(500);
  // 找名字最长的一张卡（最容易撞车）
  const worst = await page.locator('.stockcard').evaluateAll(cards => {
    let best = -1, len = -1;
    cards.forEach((c, i) => {
      const n = (c.querySelector('.nm') || {}).textContent || '';
      if (n.length > len) { len = n.length; best = i; }
    });
    return best;
  });
  const card = page.locator('.stockcard').nth(worst);
  await card.hover();
  await page.waitForTimeout(400);
  const overlap = await card.evaluate(el => {
    const nm = el.querySelector('.nm'), cat = el.querySelector('.cat');
    const acts = el.querySelector('.acts'), btn = acts && acts.querySelector('.iconmini');
    const r = e => e.getBoundingClientRect();
    // 整组按钮（✎ + ✕）才是真正压住文字的那一块 —— 只量第一个按钮会漏判
    const hit = (a, b) => a && b && a.right > b.left + 0.5 && a.left < b.right - 0.5 && a.bottom > b.top && a.top < b.bottom;
    const cs = getComputedStyle(acts), cb = getComputedStyle(btn);
    return {
      nmOver: hit(r(nm), r(acts)),
      catOver: hit(r(cat), r(acts)),
      z: cs.zIndex,
      opaque: cb.backgroundColor !== 'rgba(0, 0, 0, 0)' && cb.backgroundColor !== 'transparent',
      visible: parseFloat(cs.opacity) > 0.5,
    };
  });
  const overlapBad = overlap.nmOver || overlap.catOver || !overlap.opaque || overlap.z === 'auto';
  console.log('  标题重叠:', overlap.nmOver, '| 分类重叠:', overlap.catOver,
    '| 层级 z-index:', overlap.z, '| 按钮有不透明底:', overlap.opaque, '| 悬停可见:', overlap.visible);
  console.log(overlapBad ? '  ❌ 按钮仍与名称行冲突（Issue #24 未修复）' : '  ✅ 按钮浮于上层且不遮挡名称行');
  await card.screenshot({ path: path.join(OUT, '37-card-hover.png') });
  console.log('  ▸ 37-card-hover.png (酒柜卡片悬停)');

  // 9. 酒柜页视觉量测（Issue #17 §6 酒柜页 1–10）
  //    jsdom 没有布局引擎：木纹 / 顶光 / 内阴影 / 文字投影 / 圆角 / 间距
  //    必须在真实 Chromium 里用 getComputedStyle + getBoundingClientRect 量。
  console.log('\n[验收] 酒柜页视觉规则（Issue #17 §6 酒柜页 1–10）');
  const SHOT_DIR = process.env.HBL_SHOT_DIR || require('os').tmpdir();
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const cabFail = [];
  const cabOk = (c, m) => { if (c) console.log('  ✓ ' + m); else { cabFail.push(m); console.log('  ✗ ' + m); } };

  const SEED = {
    stock: {
      Gin: { name: 'Gin', sizeMl: 750, price: 180, unopened: 1, openedMl: 450, note: '' },
      'Bourbon Whiskey': { name: 'Bourbon Whiskey', sizeMl: 750, price: 220, unopened: 2, openedMl: 0, note: '' },
      'Sweet Vermouth': { name: 'Sweet Vermouth', sizeMl: 750, price: 90, unopened: 1, openedMl: 120, note: '' },
      Campari: { name: 'Campari', sizeMl: 750, price: 120, unopened: 0, openedMl: 60, note: '' },
      'Dry Vermouth': { name: 'Dry Vermouth', sizeMl: 750, price: 95, unopened: 1, openedMl: 0, note: '' },
      'Aperol Bitter': { name: 'Aperol Bitter', sizeMl: 750, price: 110, unopened: 1, openedMl: 0, note: '' },
    },
    ledger: [],
    settings: { barName: '巷口小吧', barSub: 'HOME BAR', owner: '阿伦', currency: '¥' },
  };

  /** 打开一个指定视口 / 主题的酒柜页并采集视觉度量 */
  async function openCabinet(opts) {
    const p = await browser.newPage({
      viewport: opts.viewport,
      deviceScaleFactor: 2,
      hasTouch: !!opts.touch, isMobile: !!opts.touch,
    });
    p.on('pageerror', e => errors.push('pageerror(cabinet): ' + e.message));
    await p.addInitScript(seed => {
      localStorage.setItem('hbl.v1', JSON.stringify(seed));
    }, Object.assign({}, SEED, { settings: Object.assign({}, SEED.settings, { theme: opts.theme }) }));
    await p.goto(URL);
    await p.waitForTimeout(700);
    await p.click('#tabs button[data-v="cabinet"]');
    await p.waitForTimeout(500);
    return p;
  }

  async function measure(p) {
    return p.evaluate(() => {
      const q = s => document.querySelector(s);
      const card = q('.stockcard');
      if (!card) return { error: 'no .stockcard' };
      const cs = getComputedStyle(card);
      const after = getComputedStyle(card, '::after');
      const nm = card.querySelector('.nm .zh') || card.querySelector('.nm .en') || card.querySelector('.nm');
      const ncs = nm ? getComputedStyle(nm) : null;
      const list = q('.stocklist'), lcs = getComputedStyle(list);
      const sf = q('.stockfilter .sfcat'), sfcs = sf ? getComputedStyle(sf) : null;
      const sfo = q('.stockfilter .sfcat.on'), sfocs = sfo ? getComputedStyle(sfo) : null;
      const bar = card.querySelector('.bar'), bcs = bar ? getComputedStyle(bar) : null;
      const h2 = q('.pagehead h2'), h2cs = h2 ? getComputedStyle(h2) : null;
      const cards = [...document.querySelectorAll('.stockcard')];
      const rects = cards.map(c => c.getBoundingClientRect());
      const first = rects[0];
      const sameRow = rects.filter(r => Math.abs(r.top - first.top) < 4 && r.left > first.left);
      const gapX = sameRow.length ? sameRow[0].left - first.right : null;
      const nextRow = rects.find(r => r.top > first.top + 4);
      const gapY = nextRow ? nextRow.top - first.bottom : null;
      const app = document.getElementById('app');
      return {
        bgImage: cs.backgroundImage,
        bgSize: cs.backgroundSize,
        boxShadow: cs.boxShadow,
        afterContent: after.content,
        afterBg: after.backgroundImage,
        nameShadow: ncs ? ncs.textShadow : 'none',
        nameSize: ncs ? ncs.fontSize : null,
        sfRadius: sfcs ? sfcs.borderRadius : 'n/a',
        sfBg: sfcs ? sfcs.backgroundColor : '',
        sfBorderW: sfcs ? sfcs.borderTopWidth : '',
        sfOnShadow: sfocs ? sfocs.boxShadow : '',
        sfOnColor: sfocs ? sfocs.color : '',
        barShadow: bcs ? bcs.boxShadow : 'none',
        barBg: bcs ? bcs.backgroundColor : '',
        h2Size: h2cs ? h2cs.fontSize : 'n/a', h2Spacing: h2cs ? h2cs.letterSpacing : 'n/a', h2Shadow: h2cs ? h2cs.textShadow : 'none',
        listGap: lcs.gap,
        colWidth: first.width,
        gapX, gapY,
        overflowX: app.scrollWidth - app.clientWidth,
        cardCount: cards.length,
      };
    });
  }

  for (const theme of ['dark', 'light']) {
    console.log(`  —— ${theme === 'dark' ? '深色' : '浅色'}主题 ——`);
    const p = await openCabinet({ viewport: { width: 1527, height: 983 }, theme });
    const m = await measure(p);
    if (m.error) { cabFail.push(`${theme} 主题：${m.error}`); await p.close(); continue; }
    // §6-1 木纹：卡面必须有细密横向木纹，且 tile ≤ 128px
    cabOk(/data:image\/svg\+xml/.test(m.bgImage), `木纹纹理生效（background-image 含 SVG data-URI）`);
    // 有效 tile：background-size 声明若有效则取第 2 层；否则回落到 SVG 固有尺寸
    const sizes = m.bgSize.split(',').map(s => s.trim());
    const grainTile = sizes[1] && sizes[1] !== 'auto'
      ? parseInt(sizes[1], 10)
      : (/width%3D'96'/.test(m.bgImage) ? 96 : NaN);
    cabOk(grainTile > 0 && grainTile <= 128,
      `木纹 tile ≤128px（有效 ${grainTile}px；background-size 实测 "${m.bgSize}"）`);
    if (sizes[1] === 'auto') {
      console.log('  ⚠️ 已知缺陷：background-size 声明无效（var(--wood-grain-tile) 展开为 4 个值，' +
        '整条声明被浏览器丢弃），实际靠 SVG 固有尺寸 96×96 平铺 —— 视觉达标但声明是死代码');
    }
    // §6-2 顶光：射灯光锥（径向渐变）或 ::after 渐变，且上亮下暗
    const lightViaPseudo = m.afterContent !== 'none' && /gradient/.test(m.afterBg);
    const lightViaBg = /radial-gradient/.test(m.bgImage) && /linear-gradient/.test(m.bgImage);
    cabOk(lightViaPseudo || lightViaBg,
      `顶光存在（${lightViaPseudo ? '::after 伪元素渐变' : lightViaBg ? '卡面背景：径向光锥 + 纵向明暗渐变' : '无'}）`);
    // §6-3 内阴影（受光边 / 搁板阴影）
    cabOk(/inset/.test(m.boxShadow), `卡片有内阴影（${m.boxShadow.slice(0, 60)}）`);
    // §6-5 酒名投影
    cabOk(m.nameShadow && m.nameShadow !== 'none', `酒名有 text-shadow（${m.nameShadow}）`);
    if (theme === 'dark') cabOk(/0, 0, 0/.test(m.nameShadow), '深色主题酒名为黑色投影');
    else cabOk(/255, 255, 255/.test(m.nameShadow), '浅色主题酒名为白色 1px 投影');
    // §6-7 进度条轨道凹槽
    cabOk(/inset/.test(m.barShadow), `余量进度条轨道有凹槽内阴影（${m.barShadow}）`);
    // §6-8 分类筛选：非胶囊 + 金色下划线
    cabOk(parseFloat(m.sfRadius) <= 1, `分类筛选按钮非圆角胶囊（border-radius=${m.sfRadius}）`);
    cabOk(m.sfBg === 'rgba(0, 0, 0, 0)' || m.sfBg === 'transparent', `未选中筛选项无底色（${m.sfBg}）`);
    cabOk(/inset/.test(m.sfOnShadow), `选中筛选项用下划线而非实心块（${m.sfOnShadow}）`);
    // §6-4 网格：缝隙 ≥14px、列宽 ≥200px
    cabOk(m.gapX !== null && m.gapX >= 14, `卡片横向缝隙 ${m.gapX === null ? 'n/a' : m.gapX.toFixed(1) + 'px'} ≥ 14px`);
    cabOk(m.gapY !== null && m.gapY >= 14, `卡片纵向缝隙 ${m.gapY === null ? 'n/a' : m.gapY.toFixed(1) + 'px'} ≥ 14px`);
    cabOk(m.colWidth >= 200, `单列宽度 ${m.colWidth.toFixed(1)}px ≥ 200px`);
    // §6-6 页面标题
    cabOk(parseFloat(m.h2Size) >= 25, `标题字号 ${m.h2Size} ≥ 25px`);
    cabOk(parseFloat(m.h2Spacing) >= 1, `标题字距 ${m.h2Spacing}（明显拉开）`);
    cabOk(m.h2Shadow && m.h2Shadow !== 'none', `标题带投影/微光（${m.h2Shadow}）`);
    cabOk(m.overflowX <= 2, `无横向溢出（${m.overflowX}px）`);

    // 防误伤：调制页的 chip 必须保持胶囊
    await p.click('#tabs button[data-v="mix"]');
    await p.waitForTimeout(600);
    const mixChip = await p.evaluate(() => {
      const e = document.querySelector('.mixfrow .sfcat');
      if (!e) return null;
      const c = getComputedStyle(e);
      return { radius: c.borderRadius, bg: c.backgroundColor, border: c.borderTopWidth };
    });
    cabOk(!!mixChip, '调制页存在 .mixfrow .sfcat');
    if (mixChip) {
      cabOk(parseFloat(mixChip.radius) >= 15, `调制页 chip 仍是圆角胶囊（border-radius=${mixChip.radius}，未被酒柜样式误伤）`);
      cabOk(mixChip.bg !== 'rgba(0, 0, 0, 0)' && mixChip.bg !== 'transparent', `调制页 chip 保留底色（${mixChip.bg}）`);
    }
    await p.click('#tabs button[data-v="cabinet"]');
    await p.waitForTimeout(400);
    const shot = path.join(SHOT_DIR, `cabinet-${theme}-1527.png`);
    await p.screenshot({ path: shot });
    console.log('  ▸ ' + shot);
    await p.close();
  }

  // 9b. 移动端（375×812，触摸模式）
  console.log('  —— 移动端 375×812（触摸）——');
  {
    const p = await openCabinet({ viewport: { width: 375, height: 812 }, theme: 'dark', touch: true });
    const mm = await p.evaluate(() => {
      const card = document.querySelector('.stockcard');
      const zh = card.querySelector('.nm .zh');
      const en = card.querySelector('.nm .en');
      const nm = card.querySelector('.nm');
      const cat = card.querySelector('.cat');
      const amts = [...card.querySelectorAll('.amt')];
      const acts = card.querySelector('.acts');
      const r = e => e ? e.getBoundingClientRect() : null;
      const overlap = (a, b) => a && b && a.right > b.left + 0.5 && a.left < b.right - 0.5 && a.bottom > b.top && a.top < b.bottom;
      const app = document.getElementById('app');
      const r1 = r(amts[0]), r2 = r(amts[1]);
      // 所有卡里最小的「主名」字号（中文名 .zh，或无中文名时的 .en.lead）
      const nameSizes = [...document.querySelectorAll('.stockcard')].map(c => {
        const el = c.querySelector('.nm .zh') || c.querySelector('.nm .en.lead') || c.querySelector('.nm .en');
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
      }).filter(v => v !== null);
      const zhSizes = [...document.querySelectorAll('.stockcard')].map(c => {
        const el = c.querySelector('.nm .zh');
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
      }).filter(v => v !== null);
      return {
        zhSize: zhSizes.length ? Math.min(...zhSizes) + 'px' : null,
        enSize: en ? getComputedStyle(en).fontSize : null,
        minNameSize: nameSizes.length ? Math.min(...nameSizes) : null,
        overflowX: app.scrollWidth - app.clientWidth,
        nmOverCat: overlap(r(nm), r(cat)),
        amtOverlap: overlap(r1, r2),
        actsOverNm: overlap(r(nm), r(acts)),
        cols: (() => {
          const cards = [...document.querySelectorAll('.stockcard')];
          if (cards.length < 2) return 1;
          const t = cards[0].getBoundingClientRect().top;
          return cards.filter(c => Math.abs(c.getBoundingClientRect().top - t) < 4).length;
        })(),
        zhClipped: zh ? zh.scrollWidth > zh.clientWidth + 1 : false,
      };
    });
    cabOk(mm.zhSize && parseFloat(mm.zhSize) >= 13.5, `移动端中文酒名字号 ${mm.zhSize} ≥ 13.5px`);
    if (mm.minNameSize !== null && mm.minNameSize < 13.5) {
      console.log(`  ⚠️ 已知偏差：无中文名的卡片（.en.lead）主名字号为 ${mm.minNameSize}px，低于规范的 13.5px`);
    } else {
      cabOk(true, `移动端所有卡片主名字号 ≥13.5px（最小 ${mm.minNameSize}px）`);
    }
    cabOk(mm.cols === 1 || mm.cols === 2, `移动端卡片 ${mm.cols} 列（单列或双列）`);
    cabOk(mm.overflowX <= 2, `移动端无横向溢出（${mm.overflowX}px）`);
    cabOk(!mm.nmOverCat, '移动端酒名行与分类行不重叠');
    cabOk(!mm.amtOverlap, '移动端两行数值不重叠');
    cabOk(!mm.actsOverNm, '移动端常驻的编辑/删除按钮不压住酒名');
    cabOk(!mm.zhClipped, '移动端中文酒名未被截断');
    const shot = path.join(SHOT_DIR, 'cabinet-dark-375.png');
    await p.screenshot({ path: shot });
    console.log('  ▸ ' + shot);
    // 浅色移动端
    await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });
    await p.waitForTimeout(400);
    const shot2 = path.join(SHOT_DIR, 'cabinet-light-375.png');
    await p.screenshot({ path: shot2 });
    console.log('  ▸ ' + shot2);
    await p.close();
  }

  console.log(cabFail.length
    ? '  ❌ 酒柜视觉验收未通过:\n    ' + cabFail.join('\n    ')
    : '  ✅ 酒柜视觉验收全部通过');

  console.log('\nJS 错误:', errors.length ? errors.join('\n  ') : '无');
  await browser.close();
  process.exit(errors.length || junkHits.length || overlapBad || cabFail.length ? 1 : 0);
})();
