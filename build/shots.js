/** 用 playwright 截图，检验真实渲染效果 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'preview');
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.join(ROOT, 'index.html');

// 造一份有内容的初始数据
const now = Date.now();
const ING = ['Gin', 'Sweet Vermouth', 'Campari', 'Vodka', 'Bourbon Whiskey', 'Tequila Blanco',
  'Cointreau', 'Aperol', 'Angostura aromatic bitters', 'Lemon juice', 'Lime juice', 'Simple Syrup',
  'Club soda', 'Tonic water', 'Dry Vermouth', 'Light Rum', 'Cranberry juice', 'Egg White', 'Coffee liqueur', 'Mint'];
const seed = {
  stock: {}, ledger: [],
  settings: { barName: '巷口小吧', barSub: 'HOME BAR · 巷口', owner: '阿伦', currency: '¥' },
};
const PRICE = { 'Gin': 180, 'Sweet Vermouth': 100, 'Campari': 130, 'Vodka': 120, 'Bourbon Whiskey': 220, 'Tequila Blanco': 180, 'Cointreau': 130, 'Aperol': 120, 'Angostura aromatic bitters': 60, 'Lemon juice': 18, 'Lime juice': 18, 'Simple Syrup': 0, 'Club soda': 25, 'Tonic water': 30, 'Dry Vermouth': 110, 'Light Rum': 120, 'Cranberry juice': 30, 'Egg White': 15, 'Coffee liqueur': 130, 'Mint': 5 };
ING.forEach(n => seed.stock[n] = { name: n, sizeMl: n.includes('bitters') ? 100 : 750, price: PRICE[n] ?? null, unopened: 1, openedMl: 320, note: '' });
seed.stock['Gin'].unopened = 2;
seed.stock['Lime juice'].unopened = 3;

const LEDGER = [
  { name: 'Negroni', servings: 2, lines: [['Gin', 60], ['Sweet Vermouth', 60], ['Campari', 60]] },
  { name: 'Margarita', servings: 1, lines: [['Tequila Blanco', 60], ['Cointreau', 22.5], ['Lime juice', 22.5]] },
  { name: 'Mojito', servings: 3, lines: [['Light Rum', 60], ['Lime juice', 22.5], ['Simple Syrup', 22.5], ['Mint', 0]] },
  { name: 'Espresso Martini', servings: 1, lines: [['Vodka', 40], ['Coffee liqueur', 20]] },
  { name: 'Whiskey Sour', servings: 1, lines: [['Bourbon Whiskey', 60], ['Lemon juice', 25], ['Simple Syrup', 20], ['Egg White', 15]] },
  { name: 'Aperol Spritz', servings: 2, lines: [['Aperol', 60], ['Club soda', 100]] },
  { name: 'Dry Martini', servings: 1, lines: [['Gin', 60], ['Dry Vermouth', 10]] },
  { name: 'Cosmo', servings: 1, lines: [['Vodka', 45], ['Cointreau', 15], ['Cranberry juice', 15], ['Lime juice', 15]] },
];
let seq = 0;
LEDGER.forEach((r, i) => {
  const lines = r.lines.filter(l => l[1] > 0).map(([n, ml]) => ({ n, ml, before: { unopened: 0, openedMl: 0 } }));
  const totalMl = lines.reduce((s, l) => s + l.ml, 0);
  const cost = lines.reduce((s, l) => s + (seed.stock[l.n].price ? l.ml * seed.stock[l.n].price / seed.stock[l.n].sizeMl : 0), 0);
  seed.ledger.push({ id: 'e' + i, seq: ++seq, ts: now - i * 3600 * 1000 * 9, recipeId: 'x', name: r.name, servings: r.servings, lines, totalMl, cost, complete: true });
});

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('hbl.v1', JSON.stringify(s)), seed);
  await page.goto(URL);
  await page.waitForTimeout(600);

  const shot = async (name, opts) => {
    await page.waitForTimeout(350);
    await page.screenshot(Object.assign({ path: path.join(OUT, name + '.png') }, opts || {}));
    console.log('  ▸ ' + name + '.png');
  };

  console.log('截图：');
  await shot('01-cabinet');

  await page.click('#tabs button[data-v="mix"]');
  await page.waitForTimeout(400);
  await shot('02-mix');

  // 选 Negroni
  const n = await page.locator('.recitem').filter({ has: page.locator('.rn', { hasText: /^Negroni$/ }) }).first();
  if (await n.count()) { await n.click(); await page.waitForTimeout(300); }
  await shot('03-recipe');

  await page.click('#tabs button[data-v="ledger"]');
  await page.waitForTimeout(400);
  await shot('04-ledger');

  await page.click('#tabs button[data-v="statement"]');
  await page.waitForTimeout(500);
  await shot('05-statement');

  // 只截小票
  const rec = await page.locator('.receipt');
  if (await rec.count()) {
    await rec.screenshot({ path: path.join(OUT, '06-receipt.png') });
    console.log('  ▸ 06-receipt.png');
  }

  // 移动端
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.addInitScript(s => localStorage.setItem('hbl.v1', JSON.stringify(s)), seed);
  await m.goto(URL);
  await m.waitForTimeout(500);
  await m.screenshot({ path: path.join(OUT, '07-mobile.png') });
  console.log('  ▸ 07-mobile.png');

  await browser.close();
  console.log('\n完成 → ' + OUT);
})();
