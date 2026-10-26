// 移动端布局体检：检测横向溢出、元素重叠、点击目标过小
const { chromium } = require('/workspace/home-bar-ledger/node_modules/playwright');
const fs = require('fs');

const SEED = {
  stock: {
    'Gin': { name: 'Gin', sizeMl: 750, price: 180, unopened: 0, openedMl: 450, note: '' },
    'Sweet Vermouth': { name: 'Sweet Vermouth', sizeMl: 750, price: 95, unopened: 1, openedMl: 0, note: '' },
    'Campari': { name: 'Campari', sizeMl: 750, price: 120, unopened: 0, openedMl: 200, note: '' }
  },
  ledger: [
    { id: 'e1', ts: Date.now() - 3600e3, name: '尼格罗尼', servings: 2, totalMl: 180, cost: 9.8, seq: 1, lines: [{ n: 'Gin', ml: 60 }] },
    { id: 'e2', ts: Date.now() - 86400e3, name: '金汤力', servings: 1, totalMl: 145, cost: 3.2, seq: 2, lines: [{ n: 'Gin', ml: 45 }] }
  ],
  settings: { barName: '巷口小吧', barSub: 'HOME BAR LEDGER', owner: '阿伦' }
};

const VIEWPORTS = [
  { name: '手机 375', w: 375, h: 812 },
  { name: '手机 390', w: 390, h: 844 },
  { name: '平板 768', w: 768, h: 1024 },
  { name: '桌面 1440', w: 1440, h: 900 }
];

(async () => {
  const b = await chromium.launch();
  let issues = 0;
  for (const vp of VIEWPORTS) {
    const isPhone = vp.w <= 420;
    const p = await b.newPage({ viewport: { width: vp.w, height: vp.h },
      hasTouch: isPhone, isMobile: isPhone,
      userAgent: isPhone ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
    await p.addInitScript(x => localStorage.setItem('hbl.v1', JSON.stringify(x)), SEED);
    await p.goto('http://localhost:8080/');
    await p.waitForTimeout(1400);
    const r = await p.evaluate((isPhone) => {
      const out = [];
      const doc = document.documentElement;
      for (const v of ['cabinet', 'ledger', 'mix', 'statement']) {
        document.querySelector(`#tabs button[data-v="${v}"]`).click();
        // 同步渲染
        const h = document.querySelector('#app');
        const overflowX = h.scrollWidth - h.clientWidth;
        if (overflowX > 2) {
          // 找出真正超宽的元素
          const wide = [...h.querySelectorAll('*')]
            .filter(e => e.getBoundingClientRect().right > doc.clientWidth + 2)
            .slice(0, 3)
            .map(e => `${e.tagName}.${(e.className || '').toString().split(' ')[0]}(${Math.round(e.getBoundingClientRect().right)}px)`);
          out.push({ page: v, kind: '横向溢出', px: overflowX, wide });
        }
        // 触摸目标过小
        if (isPhone) {
          const small = [...h.querySelectorAll('button')]
            .filter(e => e.offsetParent !== null)
            .map(e => ({ t: (e.textContent || e.title || '').trim().slice(0, 8), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }))
            .filter(e => e.h > 0 && e.h < 28);
          if (small.length) out.push({ page: v, kind: '点击目标过小', list: small.slice(0, 4) });
        }
      }
      return out;
    }, isPhone);
    console.log(`\n${vp.name} (${vp.w}px)`);
    if (!r.length) console.log('  ✅ 无溢出 / 无过小目标');
    else { issues += r.length; r.forEach(x => console.log('  ⚠️ ', JSON.stringify(x))); }
    await p.close();
  }
  console.log(`\n合计问题 ${issues} 处`);
  await b.close();
})();
