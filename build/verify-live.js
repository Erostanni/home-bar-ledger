const { chromium } = require('/workspace/home-bar-ledger/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const reqs=[]; p.on('request',r=>reqs.push(r.url().replace('https://erostanni.github.io/home-bar-ledger','')||'/'));
  const t0=Date.now();
  await p.goto('https://erostanni.github.io/home-bar-ledger/', { waitUntil:'load', timeout:90000 });
  const load=Date.now()-t0;
  await p.waitForTimeout(1200);
  const info = await p.evaluate(()=>{ const D=eval('DATA');
    return {n:D.recipes.length, zh:D.recipes.filter(r=>r.zh).length,
      st:new Set(D.recipes.map(r=>r.style)).size, bs:new Set(D.recipes.map(r=>r.base)).size,
      ing:D.recipes.reduce((s,r)=>s+r.ings.length,0)};});
  console.log('  首屏 load:', load, 'ms');
  console.log('  配方:', info.n, '| 已中文化:', info.zh, '| 风格:', info.st, '| 基酒:', info.bs, '| 材料条目:', info.ing);
  console.log('  首屏请求:', reqs.join(' '));
  await p.click('#tabs button[data-v="mix"]'); await p.waitForTimeout(500);
  await p.fill('#mixQ','Negroni'); await p.waitForTimeout(400);
  if(await p.locator('.recitem').count()){await p.locator('.recitem').first().click();await p.waitForTimeout(400);}
  const t=await p.locator('#recipeDetail').textContent();
  console.log('  详情中文:', t.slice(0,44).replace(/\s+/g,' '));
  console.log('  材料渲染:', await p.locator('#recipeDetail .rd').count(), '条');
  await p.click('#showEn'); await p.waitForTimeout(1500);
  const t2=await p.locator('#recipeDetail').textContent();
  console.log('  英文原文按需加载:', /This is|classic|Whiskey|gin/i.test(t2)?'✅':'❌');
  console.log('  追加请求:', reqs.slice(-1)[0]);
  await p.click('#tabs button[data-v="statement"]'); await p.waitForTimeout(600);
  console.log('  账单小票:', await p.locator('.receipt').count()?'✅':'❌');
  await p.click('#btnSettings'); await p.waitForTimeout(600);
  console.log('  设置分区:', (await p.$$eval('.settab',e=>e.map(x=>x.textContent.trim()))).join(' | '), '| 预览:', await p.locator('#setPreview .receipt').count()?'✅':'❌');
  console.log('  JS 错误:', errs.length?errs.join('|'):'无 ✅');
  await b.close();
})();
