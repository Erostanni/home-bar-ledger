const { chromium } = require('/workspace/home-bar-ledger/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8080/');
  await p.waitForTimeout(700);
  // 进入反馈模式并悬停一个元素
  await p.click('.fb-btn');
  await p.waitForTimeout(300);
  await p.hover('.stat:nth-of-type(1) .v');
  await p.waitForTimeout(200);
  await p.click('.stat:nth-of-type(1) .v');
  await p.waitForTimeout(400);
  await p.fill('#fb-note', '这里希望显示「0 款」，现在只有个数字看不出是啥');
  await p.click('.fb-btn2.pri[data-p="2"]');
  await p.waitForTimeout(200);
  await p.screenshot({ path: '/workspace/home-bar-ledger/preview/10-feedback-mode.png' });
  console.log('已截图 10-feedback-mode.png');

  // 再来一张：带真实数据的台账页
  await p.keyboard.press('Escape');
  await p.evaluate(() => {
    const d = { stock: {}, ledger: [], settings: { barName: '巷口小吧', barSub: 'HOME BAR', owner: '阿伦', currency: '¥' } };
    const ING = { 'Gin': 180, 'Sweet Vermouth': 100, 'Campari': 130, 'Lime juice': 18, 'Simple Syrup': 0, 'Club soda': 25 };
    Object.entries(ING).forEach(([n, pr]) => d.stock[n] = { name: n, sizeMl: 750, price: pr, unopened: 1, openedMl: 300, note: '' });
    const L = [['Negroni', 2, [['Gin', 60], ['Sweet Vermouth', 60], ['Campari', 60]]],
               ['Mojito', 3, [['Gin', 60], ['Lime juice', 22.5], ['Simple Syrup', 22.5]]],
               ['Aperol Spritz', 2, [['Campari', 60], ['Club soda', 100]]]];
    L.forEach(([name, sv, ings], i) => {
      const lines = ings.map(([n, ml]) => ({ n, ml, before: { unopened: 0, openedMl: 0 } }));
      const totalMl = lines.reduce((s, l) => s + l.ml, 0);
      const cost = lines.reduce((s, l) => s + (d.stock[l.n].price ? l.ml * d.stock[l.n].price / 750 : 0), 0);
      d.ledger.push({ id: 'e' + i, seq: i + 1, ts: Date.now() - i * 7200000, recipeId: 'x', name, servings: sv, lines, totalMl, cost, complete: true });
    });
    localStorage.setItem('hbl.v1', JSON.stringify(d));
  });
  await p.reload();
  await p.waitForTimeout(700);
  await p.click('#tabs button[data-v="statement"]');
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/workspace/home-bar-ledger/preview/11-statement-filled.png' });
  console.log('已截图 11-statement-filled.png');
  await b.close();
})();
