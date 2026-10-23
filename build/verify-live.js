const { chromium } = require('/workspace/home-bar-ledger/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const reqs = []; p.on('request', r => reqs.push(r.url().replace('https://erostanni.github.io/home-bar-ledger', '') || '/'));
  await p.goto('https://erostanni.github.io/home-bar-ledger/', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(2500);
  console.log('  线上标题:', await p.title());
  const info = await p.evaluate(() => {
    const D = eval('DATA');
    return { recipes: D.recipes.length, zh: D.recipes.filter(r => r.zh).length,
             styles: new Set(D.recipes.map(r => r.style)).size,
             bases: new Set(D.recipes.map(r => r.base)).size,
             withImg: D.recipes.filter(r => r.img).length };
  });
  console.log('  配方:', info.recipes, '| 已中文化:', info.zh, '| 风格:', info.styles, '| 基酒:', info.bases, '| 带图:', info.withImg);
  console.log('  网络请求:', reqs.length, '→', reqs.join(' '));
  console.log('  指标条:', await p.locator('.metrics').count(), '| 指标格:', await p.locator('.metric').count());
  await p.click('#tabs button[data-v="mix"]'); await p.waitForTimeout(800);
  console.log('  筛选行:', await p.locator('.mixfrow').count(), '| 条目:', await p.locator('.recitem').count());
  console.log('  列表缩略图残留:', await p.locator('.recthumb').count());
  await p.fill('#mixQ', 'Negroni'); await p.waitForTimeout(500);
  if (await p.locator('.recitem').count()) { await p.locator('.recitem').first().click(); await p.waitForTimeout(500); }
  console.log('  详情标题:', (await p.locator('#recipeDetail h3').textContent()).trim());
  console.log('  详情大图残留:', await p.locator('.rcup').count());
  await p.click('#tabs button[data-v="statement"]'); await p.waitForTimeout(800);
  console.log('  账单小票:', await p.locator('.receipt').count() ? '✅' : '❌');
  await p.click('#btnSettings'); await p.waitForTimeout(700);
  console.log('  设置分区:', (await p.$$eval('.settab', e => e.map(x => x.textContent.trim()))).join(' | '));
  console.log('  小票预览:', await p.locator('#setPreview .receipt').count() ? '✅' : '❌');
  await p.screenshot({ path: '/workspace/home-bar-ledger/preview/23-live-final.png' });
  console.log('  JS 错误:', errs.length ? errs.join('|') : '无 ✅');
  await b.close();
})();
