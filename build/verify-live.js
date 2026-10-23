const { chromium } = require('/workspace/home-bar-ledger/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('https://erostanni.github.io/home-bar-ledger/', { waitUntil:'load', timeout:120000 });
  await p.waitForTimeout(2000);
  console.log('  线上标题:', await p.title());
  const d = await p.evaluate(()=>({
    theme: document.documentElement.getAttribute('data-theme'),
    recipes: eval('DATA').recipes.length,
    zh: eval('DATA').recipes.filter(r=>r.zh).length,
  }));
  console.log('  主题:', d.theme, '| 配方:', d.recipes, '| 已中文化:', d.zh);
  // 设置页
  await p.click('#btnSettings'); await p.waitForTimeout(800);
  console.log('  设置分区:', (await p.$$eval('.settab',e=>e.map(x=>x.textContent.trim()))).join(' | '));
  console.log('  主题卡片:', await p.locator('[data-theme-pick]').count(), '| 强调色:', await p.locator('[data-accent]').count(), '| 开关:', await p.locator('[data-sw]').count());
  // 切浅色
  await p.click('[data-theme-pick="light"]'); await p.waitForTimeout(700);
  console.log('  切浅色后 data-theme:', await p.evaluate(()=>document.documentElement.getAttribute('data-theme')));
  console.log('  topbar 背景:', await p.evaluate(()=>getComputedStyle(document.querySelector('.topbar')).backgroundColor));
  await p.screenshot({ path: '/workspace/home-bar-ledger/preview/30-online-settings.png' });
  console.log('  ▸ 30-online-settings.png');
  console.log('  JS 错误:', errs.length?errs.join('|'):'无 ✅');
  await b.close();
})();
