const { chromium } = require('/workspace/home-bar-ledger/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  for (const [label, url] of [['本地', 'http://localhost:8080/'], ['线上', 'https://erostanni.github.io/home-bar-ledger/']]) {
    const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url, { waitUntil: 'load', timeout: 90000 });
    await p.waitForTimeout(1500);
    await p.click('#tabs button[data-v="mix"]'); await p.waitForTimeout(500);
    await p.fill('#mixQ', 'Negroni'); await p.waitForTimeout(500);
    const firstName = await p.locator('.recitem .rn').first().textContent();
    await p.locator('.recitem').first().click(); await p.waitForTimeout(500);
    const title = (await p.locator('#recipeDetail h3').textContent()).trim();
    const rows = await p.$$eval('#recipeDetail .rd', e => e.map(x => x.querySelector('.l1') ? x.querySelector('.l1').textContent.trim().replace(/\s+/g, ' ').slice(0, 26) : '(装饰/备料行)'));
    console.log(`  [${label}] 列表首项="${firstName.trim()}" 详情标题="${title}"  .rd 行数=${rows.length}`);
    rows.forEach((r, i) => console.log(`           ${i + 1}. ${r}`));
    // 英文原文
    await p.click('#showEn'); await p.waitForTimeout(2500);
    const t = await p.locator('#recipeDetail').textContent();
    const hasEn = /This is|classic|Whiskey|A\.S\.|Kingston/i.test(t);
    console.log(`           英文原文: ${hasEn ? '✅ 有' : '❌ 无'} | 复选框=${await p.locator('#showEn').isChecked()} | toast="${(await p.locator('#toast').textContent() || '').trim()}"`);
    console.log(`           错误: ${errs.length ? errs.join('|') : '无'}`);
    await p.close();
  }
  await b.close();
})();
