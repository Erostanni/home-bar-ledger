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

  console.log('\nJS 错误:', errors.length ? errors.join('\n  ') : '无');
  await browser.close();
  process.exit(errors.length || junkHits.length ? 1 : 0);
})();
