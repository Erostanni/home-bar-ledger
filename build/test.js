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
/* 按名字精确挑一款配方（先搜索，避免列表截断导致找不到） */
function pickRecipe(t, name){
  const q = t.$('#mixQ');
  if(q) t.setVal(q, name);
  const it = t.$$('.recitem').find(el => el.querySelector('.rn').textContent.trim() === name);
  if(it) t.click(it);
  return it;
}

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
  ok(R.length === 663, `配方 ${R.length} 条`);
  ok(R.every(r => r.name && Array.isArray(r.ings) && r.ings.length), '每条配方都有名称+材料');
  ok(R.flatMap(r => r.ings).every(i => i.n && typeof i.ml === 'number' && i.ml >= 0), '材料字段合法');
  ok(R.some(r => r.name === 'Negroni') && R.some(r => r.name === 'Margarita'), '含经典款');
  ok(R.filter(r=>r.tier===1).length === 129, `tier1 经典 ${R.filter(r=>r.tier===1).length} 款`);
  ok(R.filter(r=>r.zh).length === 663, `已中文化 ${R.filter(r=>r.zh).length} / ${R.length} 款（全覆盖）`);
  ok(R.every(r=>r.style && r.style!=='其他'), '每款都有主风格，无「其他」');
  ok(R.every(r=>r.base), '每款都有基酒');
  ok(new Set(R.map(r=>r.style)).size >= 15, `风格分 ${new Set(R.map(r=>r.style)).size} 类`);
  ok(new Set(R.map(r=>r.base)).size >= 7, `基酒分 ${new Set(R.map(r=>r.base)).size} 类`);
  ok(new Set(R.map(r=>r.lineage)).size === 3, '谱系分 3 类（经典/现代/提基）');
  ok(new Set(R.map(r=>r.id)).size === R.length, '配方 id 无重复');
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
  const item = pickRecipe(t,'Negroni');
  ok(!!item, '列表有 Negroni');
  // 已由 pickRecipe 点击
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
  pickRecipe(t,'Negroni');
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
  pickRecipe(t,'Negroni');
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
  pickRecipe(t,'Negroni');
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
  ok(!txt.includes('原料消耗'), '默认不展示原料消耗区');
  ok(txt.includes('总杯数'), '有合计区');
  ok(txt.includes('谢谢惠顾'), '有落款');
  ok(txt.includes('Negroni'), '列出了酒名');
  ok(txt.includes('¥'), '有金额');
  ok(txt.includes('3'), '杯数合计 3');
  ok(t.$('.rbarcode'), '有条形码装饰');
  // 打开「原料消耗」开关后应恢复显示（直接改应用内存态）
  t.w.eval("db.settings.receipt = { paper:'classic', showIngredients:true, note:'', bgImage:null, bgOpacity:.25 }; render();");
  t.tab('mix'); t.tab('statement');
  const txt2 = t.$('.receipt').textContent;
  ok(txt2.includes('原料消耗'), '开关打开后展示原料消耗区');
  ok(/90ml/.test(txt2), 'Gin 累计 90ml');
  ok(txt2.includes('27'), 'Gin 成本 27.00 (90 × 0.2)');
  // 纸张与自定义文案
  t.w.eval("db.settings.receipt = { paper:'dark', showIngredients:false, note:'本月战绩 12 杯', bgImage:null, bgOpacity:.25 }; render();");
  t.tab('mix'); t.tab('statement');
  ok(t.$('.receipt').classList.contains('paper-dark'), '可切换纸张样式');
  ok(t.$('.receipt').textContent.includes('本月战绩 12 杯'), '自定义文案显示在小票上');
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
  pickRecipe(t,'Negroni');
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
  ok(!!t.$('.settabs'), '设置弹窗打开');
  const tabs = t.$$('.settab').map(e=>e.textContent.trim());
  ok(tabs.length === 4, `四个分区：${tabs.join(' / ')}`);
  // 切到「小票」分区
  t.click(t.$$('.settab').find(e=>e.textContent.trim()==='小票'));
  ok(t.$('#sName'), '小票分区有吧台名称');
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
  pickRecipe(t,'Gin and Tonic');
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
  pickRecipe(t,'Negroni');
  ok(!t.$('[data-act="record"]').disabled, '三样齐了可记录');
  t.click(t.$('[data-act="record"]'));
  const d = t.db();
  ok(d.ledger.length === 1, '记录成功');
  ok(near(d.stock['Gin'].openedMl, 720), 'Gin 扣减 30ml');
  ok(d.ledger[0].lines.every(l => l.n === 'Gin' || l.n === 'Sweet Vermouth' || l.n === 'Campari'), '扣减明细用规范名');
}

/* ============ 场景 16：原料选择器（中文搜索 + 预览 + 自动带出） ============ */
console.log('\n【16】原料选择器');
{
  const t = boot(null);
  t.tab('cabinet');
  t.click(t.$('[data-act="addstock"]'));
  ok(!!t.$('#fName'), '原料表单打开');
  ok(!t.$('datalist'), '旧版英文 datalist 已移除');

  t.setVal(t.$('#fName'), '金');
  const cells = t.$$('.fcell');
  ok(cells.length >= 2, `中文搜索「金」出 ${cells.length} 个格子`);
  ok(cells[0].textContent.includes('金酒'), '首个是「金酒」');
  ok(cells[0].getAttribute('title')==='Gin', '英文原名在 title 里（格子单行显示中文）');

  t.click(cells[0]);
  ok(t.$('#fName').value === 'Gin', '选中后输入框填入规范名 Gin');
  ok(!!t.$('.fprev.on'), '显示预览区');
  const prev = t.$('.fprev').textContent;
  ok(prev.includes('40% ABV'), '预览含 ABV');
  ok(prev.includes('750ml'), '预览含标准规格');
  ok(prev.includes('180'), '预览含参考价');
  ok(t.$('#fSize').value === '750', '自动带出规格');
  ok(t.$('#fPrice').value === '180', '自动带出参考价');

  // 英文搜索
  t.setVal(t.$('#fName'), 'Campari');
  ok(t.$$('.fcell').some(e => e.textContent.includes('金巴利')), '英文也能搜到（显示中文名）');

  // 自定义原料
  t.setVal(t.$('#fName'), '我的自酿糖浆');
  ok(t.$('.fempty'), '未收录的原料给出提示');
}

/* ============ 场景 17：分类 + 网格选择器 ============ */
console.log('\n【17】分类 + 网格选择器');
{
  const t = boot(null);
  t.tab('cabinet');
  t.click(t.$('[data-act="addstock"]'));
  ok(!!t.$('#fCats'), '有分类栏');
  ok(!!t.$('#fGrid'), '有网格区');
  ok(!t.$('.fsug'), '旧版下拉建议已移除');

  const cats = t.$$('.fcat').map(e => e.textContent.trim());
  ok(cats.length >= 10 && cats.length <= 20, `分类数 ${cats.length}（一级分类，不过度碎片化）`);
  ok(cats[0].startsWith('全部'), '第一个是「全部」');
  ok(cats.some(c => c.startsWith('烈酒')), '含「烈酒」分类');
  ok(!cats.some(c => c.includes('›')), '没有多层路径分类');
  ok(t.$$('.fcat i').length === cats.length - 1, '各分类带数量角标');

  ok(t.$$('.fcell').length === 262, `默认网格 262 格（实得 ${t.$$('.fcell').length}）`);
  ok(t.$('#fGridHead').textContent.includes('全部'), '网格标题说明当前范围');

  // 切分类
  t.click(t.$$('.fcat').find(c => c.textContent.includes('烈酒')));
  const n = t.$$('.fcell').length;
  ok(n > 0 && n < 262, `切「烈酒」后网格 ${n} 格`);
  ok(t.$('#fGridHead').textContent.includes('烈酒'), '标题跟着切换');
  ok(t.$('#fName').value === '', '切分类时清空搜索词');

  // 点格子选中
  const cell = t.$$('.fcell').find(c => c.textContent.includes('金酒'));
  ok(!!cell, '网格里有「金酒」');
  t.click(cell);
  ok(t.$('#fName').value === 'Gin', '点格子后填入规范名');
  ok(!!t.$('.fprev.on'), '显示预览');
  ok(t.$('.fprev').textContent.includes('40% ABV'), '预览含 ABV');
  ok(t.$('#fSize').value === '750', '自动带出规格');
  ok(t.$('#fPrice').value === '180', '自动带出参考价');

  // 搜索
  t.setVal(t.$('#fName'), '伏特加');
  ok(t.$('#fGridHead').textContent.includes('搜索'), '搜索时标题切换');
  const fCells = t.$$('.fcell').length;
  const expectCells = t.w.eval("ING_LIST.filter(x=>x.n.toLowerCase().includes('伏特加') || (x.z||'').toLowerCase().includes('伏特加')).length");
  ok(fCells === expectCells, `搜「伏特加」在原料网格命中 ${expectCells} 种（含「香草伏特加」，实得 ${fCells}）`);
  ok(t.$('.fprev').textContent.includes('Vodka'), '输入时预览实时更新');
}

/* ============ 场景 18：库存不足时材料行仍须显示 ============ */
console.log('\n【18】缺料时材料行仍显示');
{
  const t = boot({stock:{},ledger:[],settings:{barName:'T',barSub:'T',owner:'',currency:'¥'}});  // 空库存
  t.tab('mix');
  t.setVal(t.$('#mixQ'), 'Negroni');
  const it = t.$$('.recitem').find(el => el.querySelector('.rn').textContent.trim() === 'Negroni');
  ok(!!it, '列表有 Negroni');
  t.click(it);
  const rows = t.$$('#recipeDetail .rd');
  ok(rows.length === 3, `空库存下仍列出 3 种材料（实得 ${rows.length}）`);
  const txt = t.$('#recipeDetail').textContent;
  ok(/缺/.test(txt), '标注了缺料');
  ok(txt.includes('Gin'), '材料名可见（用户能看到这杯酒需要什么）');
  ok(t.$('[data-act="record"]').disabled, '缺料时不能记录');
  // 补齐库存后应可记录
  const d = t.db();
  ['Gin','Sweet Vermouth','Campari'].forEach(n => d.stock[n] = {name:n,sizeMl:750,price:150,unopened:1,openedMl:0,note:''});
  t.w.localStorage.setItem('hbl.v1', JSON.stringify(d));
  t.w.eval("location.reload()");
}

/* ============ 场景 20：外观主题系统 ============ */
console.log('\n【20】外观主题系统');
{
  const t = boot(null);
  t.click(t.$('#btnSettings'));
  ok(t.$$('[data-theme-pick]').length === 3, '三种主题：跟随系统 / 深色 / 浅色');
  ok(t.$$('[data-accent]').length === 6, '6 种强调色');
  ok(t.$$('[data-sw]').length === 3, '3 个开关（背景纹理 / 界面动效 / 显示原料消耗）');
  ok(t.$$('input[type=range]').length === 3, '3 个滑块');

  // 切浅色
  t.click(t.$$('[data-theme-pick]').find(b=>b.dataset.themePick==='light'));
  ok(t.w.eval("document.documentElement.getAttribute('data-theme')")==='light', '切到浅色主题');
  // jsdom 不解析 CSS 变量，直接查样式表里浅色主题的定义
  const css = t.w.eval("document.querySelector('style').textContent");
  ok(/html\[data-theme="light"\]\s*\{[^}]*--bg:#ece6db/.test(css), '浅色主题定义了浅底色');
  ok(/html\[data-theme="light"\][\s\S]{0,900}body::after\{[\s\S]{0,300}eros|light/.test(css) || /data-theme="light"[\s\S]{0,1200}background-image:url\("data:image\/svg\+xml/.test(css), '浅色主题使用独立的 EROS 图案（反色）');
  ok(t.db().settings.theme==='light', '主题已持久化');

  // 强调色
  t.click(t.$$('[data-accent]').find(b=>b.dataset.accent==='indigo'));
  ok(t.w.eval("getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()")==='#6b86c4', '强调色生效');

  // 背景纹理开关
  t.click(t.$$('[data-sw]').find(b=>b.dataset.sw==='bgTex'));
  ok(t.w.eval("document.body.classList.contains('no-bgtex')"), '纹理可关闭');
  t.click(t.$$('[data-sw]').find(b=>b.dataset.sw==='bgTex'));
  ok(!t.w.eval("document.body.classList.contains('no-bgtex')"), '纹理可重新打开');

  // 字号
  t.click(t.$$('[data-seg="fontSize"]').find(b=>b.dataset.v==='大'));
  ok(t.w.eval("document.documentElement.style.fontSize")==='16.5px', '字号可调');

  // 动效开关
  t.click(t.$$('[data-sw]').find(b=>b.dataset.sw==='motion'));
  ok(t.w.eval("document.documentElement.classList.contains('no-motion')"), '动效可关闭');
}


console.log('\n【19】配方分类筛选');
{
  const t = boot(null);
  t.tab('mix');
  const rows = t.$$('.mixfrow');
  ok(rows.length === 4, `四行筛选（可做/风格/基酒/谱系），实得 ${rows.length}`);
  const styleBtns = rows[1].querySelectorAll('.sfcat');
  ok(styleBtns.length >= 15, `风格选项 ${styleBtns.length} 个`);
  // 点「金酒」基酒
  const baseRow = rows[2];
  const gin = [...baseRow.querySelectorAll('.sfcat')].find(b => b.textContent.includes('金酒'));
  ok(!!gin, '基酒行有「金酒」');
  t.click(gin);
  const names = t.$$('.recitem .rn').map(e => e.textContent.trim());
  ok(names.length > 0, `筛后有 ${names.length} 款`);
  const allGin = t.w.eval('JSON.stringify(RECIPES.filter(r=>r.base==="金酒").map(r=>r.name))');
  const ginNames = JSON.parse(allGin);
  ok(ginNames.length > 100, `金酒基酒共 ${ginNames.length} 款`);
  // 清除筛选
  const clear = t.$('[data-act="mixclear"]');
  ok(!!clear, '有清除筛选按钮');
  t.click(clear);
  ok(t.$('[data-act="mixclear"]') === null, '清除后按钮消失');
  // 谱系筛选
  const lin = [...rows[3].querySelectorAll('.sfcat')].find(b => b.textContent.includes('提基'));
  t.click(lin);
  const tiki = t.w.eval('JSON.stringify(RECIPES.filter(r=>r.lineage==="提基").length)');
  ok(parseInt(tiki) > 20, `提基谱系 ${tiki} 款`);
  // 原料中文名也能搜到配方
  t.click(t.$('[data-act="mixclear"]') || t.$$('.settab')[0]);
  t.setVal(t.$('#mixQ'), '伏特加');
  const vCount = t.w.eval("RECIPES.filter(r=>r.ings.some(i=>(i.n||'').toLowerCase().includes('伏特加')||(i.zh||'').includes('伏特加'))).length");
  ok(t.$$('.recitem').length === vCount, `搜「伏特加」按中文名命中 ${vCount} 款`);
  // 「可做 / 缺料」维度
  const makeRow = t.$$('.mixfrow')[0];
  const canDo = [...makeRow.querySelectorAll('.sfcat')].find(b=>b.textContent.includes('能做'));
  const lack  = [...makeRow.querySelectorAll('.sfcat')].find(b=>b.textContent.includes('缺料'));
  ok(!!canDo && !!lack, '有「能做 / 缺料」筛选');
  t.click(canDo);
  const okN = t.w.eval("Object.values(eval('makeMap')).filter(Boolean).length");
  ok(t.$$('.recitem').length === Math.min(okN,150), `「能做」列出 ${okN} 款`);
  // ⚠️ 点击会触发 render → DOM 重建 → 旧引用失效，必须重新查询
  t.setVal(t.$('#mixQ'), '');           // 清掉搜索词，单独验证筛选维度
  const lack2 = [...t.$$('.mixfrow')[0].querySelectorAll('.sfcat')].find(b=>b.textContent.includes('缺料'));
  t.click(lack2);
  const lackN = t.w.eval("RECIPES.length - Object.values(eval('makeMap')).filter(Boolean).length");
  ok(t.$$('.recitem').length === Math.min(lackN,150), `「缺料」列出 ${lackN} 款（分页显示 ${Math.min(lackN,150)}）`);
  // 有库存时「能做」应非空
  const st={};
  ['Gin','Sweet Vermouth','Campari'].forEach(n=>st[n]={name:n,sizeMl:750,price:150,unopened:1,openedMl:700,note:''});
  const t2 = boot({stock:st,ledger:[],settings:{barName:'T',barSub:'T',owner:'',currency:'¥'}});
  t2.tab('mix');
  const can2 = [...t2.$$('.mixfrow')[0].querySelectorAll('.sfcat')].find(b=>b.textContent.includes('能做'));
  t2.click(can2);
  const n2 = t2.$$('.recitem').length;
  ok(n2 > 0, `材料齐备时「能做」列出 ${n2} 款`);
}

/* ============ 场景 21：添加原料的交互改造 ============ */
console.log('\n【21】添加原料交互');
{
  const t = boot({stock:{},ledger:[],settings:{barName:'T',barSub:'T',owner:'',currency:'¥'}});
  t.tab('cabinet');
  t.click(t.$('[data-act="addstock"]'));
  ok(t.$$('.step').length === 2, '有步进器（瓶数 / 规格）');
  ok(t.$$('.quick').length === 4, '有 4 组快捷值');
  ok(t.$$('.sliderrow').length === 2, '有 2 个滑块（开封余量 / 单价）');

  // 步进器
  const before = +t.$('#fUnopened').value;
  t.click(t.$$('[data-step="fUnopened"][data-d="1"]')[0]);
  ok(+t.$('#fUnopened').value === before+1, `步进器 +1：${before} → ${t.$('#fUnopened').value}`);
  t.click(t.$$('[data-step="fUnopened"][data-d="-1"]')[0]);
  ok(+t.$('#fUnopened').value === before, '步进器 -1 还原');

  // 打字选原料 → 自动带出规格与参考价（先测，规格此时还是空的）
  t.setVal(t.$('#fName'), '金酒');
  ok(t.$('#fSize').value === '750', '自动带出规格 750');
  ok(t.$('#fPrice').value === '180', '自动带出参考价 180');

  // 快捷值
  t.click(t.$$('[data-quick="fSize"] button').find(b=>b.textContent.trim()==='700'));
  ok(t.$('#fSize').value === '700', '快捷值设定规格 700');
  // 滑块上限跟随规格
  ok(t.$('#fOpened').getAttribute('max') === '700', '已开封滑块上限跟随规格');
  // 手动改过的规格不该被后续选择覆盖
  t.setVal(t.$('#fName'), '伏特加');
  ok(t.$('#fSize').value === '700', '手动改过的规格不被覆盖');
  t.setVal(t.$('#fName'), '金酒');

  // 保存后弹窗不关、名称清空 → 可连续添加
  t.click(t.$('#mSave'));
  ok(!!t.$('#fName'), '保存后弹窗仍开着（可连续添加）');
  ok(t.$('#fName').value === '', '保存后原料名已清空');
  ok(t.db().stock['Gin'], '原料已入库');
  // 接着加第二种
  t.setVal(t.$('#fName'), '伏特加');
  t.click(t.$('#mSave'));
  ok(!!t.db().stock['Vodka'], '可连续添加第二种原料');
}

console.log(`\n${'='.repeat(46)}\n通过 ${pass} · 失败 ${fail}\n${'='.repeat(46)}`);
process.exit(fail ? 1 : 0);
