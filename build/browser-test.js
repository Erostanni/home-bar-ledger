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

  console.log('\nJS 错误:', errors.length ? errors.join('\n  ') : '无');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
