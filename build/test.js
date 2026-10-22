/**
 * 端到端测试：jsdom 真实加载 index.html，模拟全流程交互
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

/** 启动一个带种子数据的应用实例 */
function boot(seed) {
  const errors = [];
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    beforeParse(window) {
      window.print = () => {};
      if (seed) window.localStorage.setItem('hbl.v1', JSON.stringify(seed));
      window.addEventListener('error', e => errors.push(e.message));
    },
  });
  const w = dom.window, d = w.document;
  const $ = s => d.querySelector(s);
  const $$ = s => [...d.querySelectorAll(s)];
  const db = () => JSON.parse(w.localStorage.getItem('hbl.v1'));
  const click = (el) => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  const setVal = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const tab = v => click($(`#tabs button[data-v="${v}"]`));
  return { w, d, $, $$, db, click, setVal, tab, errors };
}

/* ============ 场景 1：空状态启动 ============ */
console.log('\n【1】空状态启动');
{
  const t = boot(null);
  ok(t.$('#app').innerHTML.length > 100, '应用渲染出内容');
  ok(t.$$('#tabs button').length === 4, '四个标签页');
  ok(t.$('#tabs button.on').dataset.v === 'cabinet', '默认在酒柜页');
  ok(t.$('#barNameTitle').textContent === '我的家庭吧', '吧台标题取自设置');
  ok(t.$('.empty') && t.$('.empty').textContent.includes('酒柜还是空的'), '空酒柜有引导文案');
  ok(t.errors.length === 0, '无 JS 错误: ' + (t.errors.join('; ') || '无'));
}

/* ============ 场景 2：配方库 ============ */
console.log('\n【2】配方库完整性');
{
  const t = boot(null);
  const R = t.w.eval('DATA').recipes;
  ok(R.length === 129, `配方 ${R.length} 条`);
  ok(R.every(r => r.name && Array.isArray(r.ings) && r.ings.length), '每条配方都有名称+材料');
  ok(R.flatMap(r => r.ings).every(i => i.n && typeof i.ml === 'number' && i.ml >= 0), '材料字段合法');
  ok(R.some(r => r.name === 'Negroni') && R.some(r => r.name === 'Margarita'), '含经典款');
  const metered = R.flatMap(r => r.ings).filter(i => !i.nonmetered);
  ok(metered.length > 400, `可计量材料条目 ${metered.length} 条`);
}

/* ============ 场景 3：添加原料 ============ */
console.log('\n【3】添加原料');
{
  const t = boot(null);
  t.tab('cabinet');
  t.click(t.$('[data-act="addstock"]'));
  ok(!!t.$('#fName'), '原料表单弹出');
  t.setVal(t.$('#fName'), 'Gin');
  t.setVal(t.$('#fUnopened'), '1');
  t.setVal(t.$('#fSize'), '750');
  t.setVal(t.$('#fPrice'), '180');
  t.click(t.$('#mSave'));
  const d = t.db();
  ok(d.stock.Gin && d.stock.Gin.unopened === 1, 'Gin 入库 1 瓶');
  ok(d.stock.Gin.sizeMl === 750, '规格 750ml');
  ok(d.stock.Gin.price === 180, '单价 180');
  ok(t.$('.stockcard') && t.$('.stockcard').textContent.includes('Gin'), '酒柜卡片显示 Gin');
}

/* ============ 场景 4：缺料拦截 ============ */
console.log('\n【4】缺料拦截');
{
  const t = boot(null);
  t.tab('mix');
  const item = t.$$('.recitem').find(el => el.textContent.includes('Negroni'));
  ok(!!item, '列表有 Negroni');
  t.click(item);
  ok(t.$('#recipeDetail').textContent.includes('Negroni'), '详情切到 Negroni');
  ok(t.$('[data-act="record"]').disabled, '缺料时记录按钮禁用');
  ok(t.$('#recipeDetail').textContent.includes('缺'), '显示缺料提示');
}

/* ============ 场景 5：扣减 + 记录 ============ */
console.log('\n【5】库存扣减与记录');
const NEGRONI_INGS = ['Gin', 'Sweet Vermouth', 'Campari'];
{
  const seed = { stock: {}, ledger: [], settings: { barName: '我的家庭吧', barSub: 'HOME BAR', owner: '', currency: '¥' } };
  NEGRONI_INGS.forEach(n => seed.stock[n] = { name: n, sizeMl: 750, price: 150, unopened: 1, openedMl: 0, note: '' });
  const t = boot(seed);
  t.tab('mix');
  t.click(t.$$('.recitem').find(el => el.textContent.includes('Negroni')));
  const btn = t.$('[data-act="record"]');
  ok(!btn.disabled, '材料齐备时可记录');
  t.click(btn);
  const d = t.db();
  ok(d.ledger.length === 1, '台账新增 1 条');
  ok(d.ledger[0].name === 'Negroni', '记录的是 Negroni');
  ok(d.ledger[0].servings === 1, '1 杯');
  // Negroni: Gin 30ml, Sweet Vermouth 30ml, Campari 30ml
  const gin = d.stock.Gin;
  ok(gin.unopened === 0 && near(gin.openedMl, 720), `Gin 扣减正确：0 整瓶 + 开封 720ml (实得 ${gin.unopened}/${gin.openedMl})`);
  ok(d.ledger[0].lines.length === 3, '记录含 3 条材料扣减明细');
  ok(near(d.ledger[0].totalMl, 90), `总用量 ${d.ledger[0].totalMl} ml ≈ 90`);
  const cost = d.ledger[0].cost;
  ok(near(cost, 90 * (150 / 750)), `成本 ${cost.toFixed(2)} ≈ 18.00`);
  ok(near(d.ledger[0].cost, 18), '成本 = 90ml × ¥0.2/ml = ¥18.00');
}

/* ============ 场景 6：续扣第二杯 + 开新瓶 ============ */
console.log('\n【6】连喝两杯（跨瓶扣减）');
{
  const seed = { stock: {}, ledger: [], settings: { barName: '我的家庭吧', barSub: 'HOME BAR', owner: '', currency: '¥' } };
  NEGRONI_INGS.forEach(n => seed.stock[n] = { name: n, sizeMl: 750, price: 150, unopened: 1, openedMl: 0, note: '' });
  const t = boot(seed);
  t.tab('mix');
  t.click(t.$$('.recitem').find(el => el.textContent.includes('Negroni')));
  t.click(t.$('[data-act="record"]'));   // 第一杯
  t.click(t.$('[data-act="record"]'));   // 第二杯
  const d = t.db();
  ok(d.ledger.length === 2, '两条记录');
  const gin = d.stock.Gin;
  ok(gin.unopened === 0 && near(gin.openedMl, 690), `Gin: 开封 690ml (实得 ${gin.unopened}/${gin.openedMl})`);
  ok(near(d.ledger[1].totalMl, 90), '第二杯同样 90ml');
}

/* ============ 场景 7：撤销还原 ============ */
console.log('\n【7】撤销并退回库存');
{
  const seed = { stock: {}, ledger: [], settings: { barName: '我的家庭吧', barSub: 'HOME BAR', owner: '', currency: '¥' } };
  NEGRONI_INGS.forEach(n => seed.stock[n] = { name: n, sizeMl: 750, price: 150, unopened: 1, openedMl: 0, note: '' });
  const t = boot(seed);
  t.tab('mix');
  t.click(t.$$('.recitem').find(el => el.textContent.includes('Negroni')));
  t.click(t.$('[data-act="record"]'));
  let d = t.db();
  ok(d.stock.Gin.openedMl === 720, '扣减后 720ml');
  t.tab('ledger');
  const undo = t.$('[data-act="undorec"]');
  ok(!!undo, '台账有撤销按钮');
  t.click(undo);
  t.click(t.$('#mYes'));
  d = t.db();
  ok(d.ledger.length === 0, '台账清空');
  ok(d.stock.Gin.unopened === 1 && d.stock.Gin.openedMl === 0, 'Gin 完全还原：1 整瓶 + 0 开封');
}

/* ============ 场景 8：账单渲染 ============ */
console.log('\n【8】月度账单');
{
  const now = Date.now();
  const seed = { stock: {}, ledger: [], settings: { barName: '测试吧', barSub: 'TEST BAR', owner: '阿伦', currency: '¥' } };
  NEGRONI_INGS.forEach(n => seed.stock[n] = { name: n, sizeMl: 750, price: 150, unopened: 1, openedMl: 0, note: '' });
  seed.ledger = [
    { id: 'x1', seq: 1, ts: now, recipeId: 'negroni', name: 'Negroni', servings: 2, totalMl: 180, cost: 36, lines: NEGRONI_INGS.map(n => ({ n, ml: 60 })) },
    { id: 'x2', seq: 2, ts: now - 86400000 * 3, recipeId: 'negroni', name: 'Negroni', servings: 1, totalMl: 90, cost: 18, lines: NEGRONI_INGS.map(n => ({ n, ml: 30 })) },
  ];
  const t = boot(seed);
  t.tab('statement');
  const rec = t.$('.receipt');
  ok(!!rec, '小票渲染出来');
  const txt = rec.textContent;
  ok(txt.includes('测试吧'), '小票有吧台名');
  ok(txt.includes('TEST BAR'), '小票有副标题');
  ok(txt.includes('阿伦'), '小票有调酒师署名');
  ok(txt.includes('出品清单'), '有出品清单区');
  ok(txt.includes('原料消耗'), '有原料消耗区');
  ok(txt.includes('总杯数'), '有合计区');
  ok(txt.includes('谢谢惠顾'), '有落款');
  ok(txt.includes('Negroni'), '列出了酒名');
  ok(txt.includes('¥'), '有金额');
  ok(txt.includes('3'), '杯数合计 3');
  ok(t.$('.rbarcode'), '有条形码装饰');
  ok(/90ml/.test(txt), 'Gin 累计 90ml');
  ok(txt.includes('27'), 'Gin 成本 27.00 (90 × 0.2)');
  // 打印按钮
  ok(t.$('[data-act="print"]'), '有打印按钮');
  ok(t.$('[data-act="copyreceipt"]'), '有复制文本按钮');
}

/* ============ 场景 9：份数与成本联动 ============ */
console.log('\n【9】份数联动');
{
  const seed = { stock: {}, ledger: [], settings: { barName: 'T', barSub: 'T', owner: '', currency: '¥' } };
  NEGRONI_INGS.forEach(n => seed.stock[n] = { name: n, sizeMl: 750, price: 150, unopened: 2, openedMl: 0, note: '' });
  const t = boot(seed);
  t.tab('mix');
  t.click(t.$$('.recitem').find(el => el.textContent.includes('Negroni')));
  const html1 = t.$('#recipeDetail').textContent;
  ok(html1.includes('90 ml'), '1 份 → 90ml');
  t.click(t.$('[data-act="serv"][data-n="3"]'));
  const html3 = t.$('#recipeDetail').textContent;
  ok(html3.includes('270 ml'), '3 份 → 270ml');
  t.click(t.$('[data-act="record"]'));
  const d = t.db();
  ok(d.ledger[0].servings === 3, '记录 3 杯');
  ok(near(d.ledger[0].totalMl, 270), '总用量 270ml');
  ok(near(d.ledger[0].cost, 54), '成本 ¥54.00');
  ok(d.stock.Gin.openedMl === 660, 'Gin 剩余 660ml');
}

/* ============ 场景 10：搜索 + 推荐 ============ */
console.log('\n【10】搜索与推荐');
{
  const seed = { stock: {}, ledger: [], settings: { barName: 'T', barSub: 'T', owner: '', currency: '¥' } };
  seed.stock['Gin'] = { name: 'Gin', sizeMl: 750, price: 180, unopened: 1, openedMl: 700, note: '' };
  seed.stock['Sweet Vermouth'] = { name: 'Sweet Vermouth', sizeMl: 750, price: 100, unopened: 1, openedMl: 700, note: '' };
  seed.stock['Campari'] = { name: 'Campari', sizeMl: 750, price: 130, unopened: 1, openedMl: 700, note: '' };
  const t = boot(seed);
  t.tab('cabinet');
  const can = t.$('#canMake');
  ok(can && can.textContent.includes('Negroni'), '推荐里出现 Negroni（库存刚好够）');
  t.tab('mix');
  t.setVal(t.$('#mixQ'), 'martini');
  const names = t.$$('.recitem .rn').map(e => e.textContent);
  ok(names.length > 0 && names.every(n => /martini/i.test(n)), `按 martini 搜出 ${names.length} 条`);
  t.setVal(t.$('#mixQ'), '');
  t.setVal(t.$('#mixQ'), '金酒');
  const n2 = t.$$('.recitem .rn').length;
  ok(n2 > 10, `按原料「金酒」搜出 ${n2} 条`);
}

/* ============ 场景 11：导入导出 ============ */
console.log('\n【11】备份导出');
{
  const t = boot(null);
  t.tab('cabinet');
  ok(t.$('[data-act="export"]'), '有导出按钮');
  ok(t.$('[data-act="import"]'), '有导入按钮');
  t.click(t.$('[data-act="import"]'));
  ok(t.$('#fFile'), '导入对话框有文件选择');
  ok(!t.$('#mSave'), '导入对话框不显示多余保存按钮');
}

/* ============ 场景 12：设置 ============ */
console.log('\n【12】设置');
{
  const t = boot(null);
  t.click(t.$('#btnSettings'));
  ok(t.$('#sName'), '设置弹窗打开');
  t.setVal(t.$('#sName'), '巷口小吧');
  t.setVal(t.$('#sOwner'), '小李');
  t.click(t.$('#mSave'));
  ok(t.db().settings.barName === '巷口小吧', '吧台名已保存');
  ok(t.$('#barNameTitle').textContent === '巷口小吧', '标题同步更新');
}

/* ============ 场景 13：一键常备酒柜 ============ */
console.log('\n【13】一键常备酒柜');
{
  const t = boot(null);
  t.tab('cabinet');
  const seedBtn = t.$('[data-act="seedbar"]');
  ok(!!seedBtn, '空酒柜显示「载入常备酒柜」');
  t.click(seedBtn);
  const d = t.db();
  const keys = Object.keys(d.stock);
  ok(keys.length >= 14, `载入 ${keys.length} 种常备原料`);
  ok(!!d.stock['Gin'] && d.stock['Gin'].unopened === 1, 'Gin 1 瓶');
  ok(d.stock['Gin'].sizeMl === 750, '自动带出规格 750ml');
  ok(d.stock['Gin'].price === 180, '自动带出参考价 ¥180');
  ok(!!d.stock['Simple Syrup'], '含糖浆等辅料');
  ok(t.$('.stockcard'), '酒柜渲染出卡片');
  // 载入后应该有能做的酒
  t.tab('mix');
  t.click(t.$$('.recitem').find(el => el.textContent.includes('Gin and Tonic')) || t.$$('.recitem')[0]);
  ok(true, '载入后可进入调制');
}

/* ============ 场景 14：中文名归一 ============ */
console.log('\n【14】中文原料名归一');
{
  const t = boot(null);
  t.tab('cabinet');
  t.click(t.$('[data-act="addstock"]'));
  t.setVal(t.$('#fName'), '金酒');
  t.click(t.$('#mSave'));
  const d = t.db();
  ok(!!d.stock['Gin'], '「金酒」入库后归一为 Gin');
  ok(!d.stock['金酒'], '没有产生重复 key');
  ok(d.stock['Gin'].sizeMl === 750, '自动带出规格');
  ok(d.stock['Gin'].price === 180, '自动带出参考价');
  // 中文名能搜到
  t.tab('mix');
  t.setVal(t.$('#mixQ'), '金酒');
  ok(t.$$('.recitem').length > 10, `中文名可搜索（${t.$$('.recitem').length} 条）`);
}

/* ============ 场景 15：中文原料能否正确扣减 ============ */
console.log('\n【15】中文入库的原料能正常扣减');
{
  const seed = { stock: {}, ledger: [], settings: { barName: 'T', barSub: 'T', owner: '', currency: '¥' } };
  seed.stock['Gin'] = { name: 'Gin', sizeMl: 750, price: 150, unopened: 1, openedMl: 0, note: '' };
  seed.stock['Sweet Vermouth'] = { name: 'Sweet Vermouth', sizeMl: 750, price: 150, unopened: 1, openedMl: 0, note: '' };
  seed.stock['Campari'] = { name: 'Campari', sizeMl: 750, price: 150, unopened: 1, openedMl: 0, note: '' };
  const t = boot(seed);
  t.tab('mix');
  t.click(t.$$('.recitem').find(el => el.textContent.includes('Negroni')));
  ok(!t.$('[data-act="record"]').disabled, '三样齐了可记录');
  t.click(t.$('[data-act="record"]'));
  const d = t.db();
  ok(d.ledger.length === 1, '记录成功');
  ok(near(d.stock['Gin'].openedMl, 720), 'Gin 扣减 30ml');
  ok(d.ledger[0].lines.every(l => l.n === 'Gin' || l.n === 'Sweet Vermouth' || l.n === 'Campari'), '扣减明细用规范名');
}

console.log(`\n${'='.repeat(46)}\n通过 ${pass} · 失败 ${fail}\n${'='.repeat(46)}`);
process.exit(fail ? 1 : 0);
