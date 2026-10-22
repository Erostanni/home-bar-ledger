#!/usr/bin/env node
/**
 * 开发预览服务器 —— vibe coding 用
 *
 *   node dev/server.js [port]
 *
 * 功能：
 *   1. 静态服务工作区文件
 *   2. SSE 实时重载：文件一变，浏览器自动刷新
 *   3. POST /__feedback  接收页面里的反馈，落盘到 dev/feedback.json
 *   4. GET  /__feedback  读取反馈
 *   5. 注入反馈组件（仅 dev 模式）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = +(process.argv[2] || process.env.PORT || 8080);
const FEEDBACK_FILE = path.join(__dirname, 'feedback.json');
const WATCH = ['index.html', 'bar-data.json', 'build/app.template.html', 'ui', 'core', 'dev/feedback.js'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

const clients = new Set();

function log(...a) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}]`, ...a);
}

/* ---------------- SSE ---------------- */
function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 1500\n\n');
  res.write('event: hello\ndata: {"ok":true}\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

function broadcast(msg) {
  for (const c of clients) {
    try { c.write(`event: reload\ndata: ${JSON.stringify(msg)}\n\n`); } catch (e) { /* 忽略 */ }
  }
}

/* ---------------- 反馈存储 ---------------- */
function readFeedback() {
  try { return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8')); }
  catch (e) { return []; }
}
function writeFeedback(list) {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(list, null, 2));
}

/* ---------------- 注入 ---------------- */
function injectFeedback(html) {
  // 反馈组件已由 compile.py 内联进产物，这里只做兜底
  if (html.includes('fb-root') || html.includes('__FEEDBACK_JS__')) return html;
  return html.replace(
    '</body>',
    `<script src="/__dev/feedback.js"></script>\n</body>`
  );
}

/* ---------------- 自动重建 ---------------- */
/** 模板改动时自动重新编译 index.html —— 这样改源码就能直接刷新，不用手动跑 compile.py */
function rebuild(reason) {
  const tpl = path.join(ROOT, 'build', 'app.template.html');
  if (!fs.existsSync(tpl)) return false;
  const before = (() => { try { return fs.statSync(path.join(ROOT, 'index.html')).mtimeMs; } catch (e) { return 0; } })();
  try {
    execSync(`python3 "${path.join(ROOT, 'build', 'compile.py')}"`, { cwd: ROOT, stdio: 'ignore' });
    const after = fs.statSync(path.join(ROOT, 'index.html')).mtimeMs;
    if (after !== before) { log('已重新构建 index.html（' + reason + '）'); return true; }
  } catch (e) {
    log('构建失败：', (e.stderr || e.message || '').toString().slice(0, 300));
  }
  return false;
}

/* ---------------- 文件监听 ---------------- */
let timer = null;
function scheduleReload(reason) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    log('文件变化 →', reason, '，广播重载');
    broadcast({ at: Date.now(), reason });
  }, 200);
}

/** 模板变了 → 先重建，再广播 */
let lastTplMtime = 0;
function checkTemplate() {
  const tpl = path.join(ROOT, 'build', 'app.template.html');
  if (!fs.existsSync(tpl)) return;
  const m = fs.statSync(tpl).mtimeMs;
  if (m !== lastTplMtime) {
    const first = lastTplMtime === 0;
    lastTplMtime = m;
    if (!first) rebuild('app.template.html');
  }
}

function watch() {
  // 无论用 inotify 还是轮询，都先做一次模板检查
  checkTemplate();

  try {
    execSync('command -v inotifywait', { stdio: 'ignore' });
    const dirs = WATCH.filter(w => fs.existsSync(path.join(ROOT, w)));
    execSync(`inotifywait -m -r -e modify,create,delete ${dirs.map(d => `'${path.join(ROOT, d)}'`).join(' ')}`,
      { stdio: 'ignore' });
  } catch (e) {
    // 退化为轮询
    let sig = '';
    setInterval(() => {
      let cur = '';
      for (const w of WATCH) {
        const p = path.join(ROOT, w);
        if (!fs.existsSync(p)) continue;
        const st = fs.statSync(p);
        cur += w + ':' + (st.isDirectory() ? st.mtimeMs : st.mtimeMs) + ';';
      }
      if (sig && cur !== sig) {
        const changed = cur !== sig;
        checkTemplate();
        if (changed) scheduleReload('轮询检测');
      }
      sig = cur;
    }, 700);
  }

  // 兜底：无论哪种监听方式，都定期检查模板是否改动（inotify 分支也靠它）
  setInterval(checkTemplate, 1200);
}

/* ---------------- 服务器 ---------------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p === '/__livereload') return sseHandler(req, res);

  if (p === '/__feedback' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const item = JSON.parse(body);
        item.id = 'fb' + Date.now();
        item.at = new Date().toISOString();
        item.status = 'open';
        const list = readFeedback();
        list.push(item);
        writeFeedback(list);
        log('收到反馈:', item.note || '(无文字)', '|', item.selector || '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: item.id }));
      } catch (e) {
        res.writeHead(400); res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (p === '/__feedback' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(readFeedback()));
    return;
  }

  if (p === '/__dev/feedback.js') {
    const js = fs.readFileSync(path.join(__dirname, 'feedback.js'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(js);
    return;
  }

  // 静态文件
  let rel = decodeURIComponent(p);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404 ' + rel); }
    const ext = path.extname(file);
    if (ext === '.html') {
      let html = buf.toString('utf8');
      html = injectFeedback(html);
      html = html.replace('</head>', '<script>/*dev livereload*/window.__FB_DEV__=true;new EventSource("/__livereload").addEventListener("reload",()=>location.reload());</script></head>');
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return res.end(html);
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  log(`dev server → http://localhost:${PORT}`);
  log(`反馈落盘 → ${FEEDBACK_FILE}`);
  watch();
});
