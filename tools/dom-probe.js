// 开发辅助：用真实结构的 seed 启动页面，dump DOM 结构与计算样式（不靠截图判断）
const { chromium } = require('/workspace/home-bar-ledger/node_modules/playwright');

const SEED = {
  stock: {
    '金酒': { name: '金酒', sizeMl: 700, price: 180, unopened: 0, openedMl: 450, note: '常备' },
    '金汤力': { name: '金汤力', sizeMl: 0, price: 12, unopened: 6, openedMl: 0, note: '' },
    '甜味美思': { name: '甜味美思', sizeMl: 500, price: 95, unopened: 0, openedMl: 120, note: '' }
  },
  ledger: [
    { id: 'e1', ts: Date.now() - 3600e3, recipeId: 'r1', name: '金汤力', servings: 1, totalMl: 145, cost: 3.2, lines: [{ n: '金酒', ml: 45, unit: 'ml' }, { n: '金汤力', ml: 100, unit: 'ml' }] },
    { id: 'e2', ts: Date.now() - 86400e3, recipeId: 'r2', name: '尼格罗尼', servings: 2, totalMl: 180, cost: 9.8, lines: [{ n: '金酒', ml: 60, unit: 'ml' }, { n: '甜味美思', ml: 60, unit: 'ml' }] }
  ],
  settings: { barName: '巷口小吧', barSub: 'HOME BAR LEDGER', owner: '阿伦', currency: '¥' }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(x => localStorage.setItem('hbl.v1', JSON.stringify(x)), SEED);
  await p.goto('http://localhost:8080/');
  await p.waitForTimeout(1500);

  await p.click('#tabs button[data-v="ledger"]');
  await p.waitForTimeout(600);

  const r = await p.evaluate(() => {
    const o = {};
    const slim = h => h.replace(/\s+/g, ' ');

    // ---- 台账行 ----
    const led = document.querySelector('.led');
    o.led = led ? {
      html: slim(led.outerHTML).slice(0, 420),
      box: { w: led.offsetWidth, h: led.offsetHeight },
      cs: (() => { const c = getComputedStyle(led); return { cols: c.gridTemplateColumns, gap: c.gap, pad: c.padding }; })()
    } : '(无)';

    // ---- 酒柜卡片 ----
    const sc = document.querySelector('.stockcard');
    o.stockcard = sc ? {
      html: slim(sc.outerHTML).slice(0, 520),
      box: { w: sc.offsetWidth, h: sc.offsetHeight }
    } : '(无)';

    // 酒柜里所有可能的「名称」元素
    o.nameEls = sc ? [...sc.querySelectorAll('*')]
      .filter(e => e.children.length === 0 && e.textContent.trim())
      .map(e => ({ tag: e.tagName, cls: e.className, txt: e.textContent.trim().slice(0, 20) })) : [];

    return o;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
