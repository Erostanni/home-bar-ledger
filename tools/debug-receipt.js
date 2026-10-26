// 一次性调试脚本：定位小票「单据编号 undefined」问题
const { chromium } = require('/workspace/home-bar-ledger/node_modules/playwright');

const SEED = {
  version: 1,
  settings: { barName: '巷口小吧', barSub: 'HOME BAR LEDGER', owner: '阿伦', theme: 'light' },
  ingredients: [
    { name: '金酒', amount: 700, unit: 'ml', price: 180, ml: 700 },
    { name: '金汤力', amount: 1, unit: '瓶', price: 0, ml: 0 }
  ],
  recipes: [],
  ledger: [
    { id: 'e1', name: '金汤力', ts: Date.now() - 3600e3, items: [{ name: '金酒', ml: 45, unit: 'ml' }, { name: '金汤力', ml: 100, unit: 'ml' }] }
  ]
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(x => localStorage.setItem('hbl.v1', JSON.stringify(x)), SEED);
  await p.goto('http://localhost:8080/');
  await p.waitForTimeout(1400);
  await p.click('#tabs button[data-v="statement"]');
  await p.waitForTimeout(800);

  const r = await p.evaluate(() => {
    const out = {};
    const D = statementData(ui.stmtMonth);
    out.statementData_receiptNo = D.receiptNo;
    out.keys = Object.keys(D);

    // 直接调 receiptHTML
    const m1 = /单据编号<\/span><span class="v">([^<]*)</.exec(receiptHTML(D));
    out.direct = m1 && m1[1];

    // 模拟 viewStatement 里的传参
    const obj = {
      m: D.m, ents: D.ents, byIng: D.byIng, ingRows: D.ingRows, recRows: D.recRows,
      cups: D.cups, vol: D.vol, cost: D.cost, ingCost: D.ingCost,
      unpriced: D.unpriced, sv: D.sv, prevCups: D.prevCups, receiptNo: D.receiptNo
    };
    const m2 = /单据编号<\/span><span class="v">([^<]*)</.exec(receiptHTML(obj));
    out.viaObj = m2 && m2[1];

    // 页面实际渲染
    const m3 = /单据编号<\/span><span class="v">([^<]*)</.exec(document.getElementById('receiptHost').innerHTML);
    out.rendered = m3 && m3[1];

    // viewStatement 源码里 receiptHost 那段
    out.srcHasReceiptNo = /receiptHost/.test(viewStatement.toString());
    out.srcSnippet = (viewStatement.toString().match(/receiptHost[^\n]*/) || [''])[0];
    out.srcDef = (viewStatement.toString().match(/const cups=[^\n]*/) || [''])[0];
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();

// 第二段：对比 viewStatement() 产物 与 页面 DOM
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(x => localStorage.setItem('hbl.v1', JSON.stringify(x)), SEED);
  await p.goto('http://localhost:8080/');
  await p.waitForTimeout(1400);
  await p.click('#tabs button[data-v="statement"]');
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const grab = s => { const i = s.indexOf('单据编号'); return i < 0 ? '(没找到)' : s.slice(i - 40, i + 90); };
    const vs = viewStatement();
    const dom = document.getElementById('receiptHost').innerHTML;
    return {
      fromViewStatement: grab(vs),
      fromDOM: grab(dom),
      vsHasHost: vs.indexOf('receiptHost') >= 0,
      domHostId: document.getElementById('receiptHost').id,
      // 页面上有几个 receiptHost？
      count: document.querySelectorAll('#receiptHost').length,
      receiptClass: document.querySelectorAll('.receipt').length,
      // 页面上的 .receipt 是从哪来的？打印它的前 300 字符
      receiptHead: (document.querySelector('.receipt') || {}).outerHTML?.slice(0, 300)
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
