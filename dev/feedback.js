/**
 * 反馈组件 —— 仅在 dev server 下注入
 *
 * 用法：右下角按钮进入「反馈模式」→ 鼠标划过元素高亮 → 点击选中 → 写意见 → 提交
 * 提交后 POST 到 /__feedback，落盘到 dev/feedback.json，agent 可直接读取
 */
(function () {
  'use strict';

  if (window.__FB__) return;
  window.__FB__ = true;

  const CSS = `
  .fb-root{position:fixed;right:16px;bottom:16px;z-index:9999;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}
  .fb-btn{width:44px;height:44px;border-radius:50%;border:1px solid #d9a441;background:#1d1712;color:#d9a441;
    display:grid;place-items:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4);font-size:19px;transition:.15s}
  .fb-btn:hover{background:#d9a441;color:#1d1712;transform:scale(1.06)}
  .fb-btn.on{background:#d9a441;color:#1d1712}
  .fb-badge{position:absolute;top:-4px;right:-4px;min-width:19px;height:19px;border-radius:10px;background:#c0553f;color:#fff;
    font-size:11px;display:grid;place-items:center;padding:0 5px;font-weight:700;border:2px solid #1d1712}
  .fb-panel{position:fixed;right:16px;bottom:72px;width:340px;max-height:72vh;background:#1d1712;border:1px solid #3a2f24;
    border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.55);display:none;flex-direction:column;overflow:hidden}
  .fb-panel.open{display:flex}
  .fb-head{padding:12px 14px;border-bottom:1px solid #3a2f24;display:flex;justify-content:space-between;align-items:center}
  .fb-head b{font-size:13.5px;color:#ece3d5}
  .fb-head span{font-size:11px;color:#a08d75}
  .fb-body{padding:12px 14px;overflow-y:auto;flex:1}
  .fb-item{border:1px solid #3a2f24;border-radius:8px;padding:9px 11px;margin-bottom:8px;background:#241d17}
  .fb-item .fb-t{font-size:12.5px;color:#ece3d5;margin-bottom:4px;word-break:break-word}
  .fb-item .fb-s{font-size:10.5px;color:#7d6c58;font-family:ui-monospace,Menlo,monospace;word-break:break-all}
  .fb-item .fb-m{display:flex;gap:6px;margin-top:6px;align-items:center}
  .fb-pill{font-size:10px;padding:1px 7px;border-radius:9px;border:1px solid #4a3b2c;color:#a08d75}
  .fb-pill.p1{color:#d9a441;border-color:#8a6420}
  .fb-pill.p2{color:#c0553f;border-color:#c0553f}
  .fb-pill.ok{color:#7fa35c;border-color:#7fa35c}
  .fb-empty{color:#7d6c58;font-size:12px;text-align:center;padding:18px 8px}
  .fb-pop{position:fixed;z-index:10000;width:300px;background:#1d1712;border:1px solid #d9a441;border-radius:10px;
    box-shadow:0 16px 50px rgba(0,0,0,.6);padding:12px;display:none}
  .fb-pop.open{display:block}
  .fb-pop textarea{width:100%;min-height:74px;background:#16110d;border:1px solid #3a2f24;border-radius:7px;color:#ece3d5;
    padding:8px;font:12.5px/1.5 inherit;resize:vertical;outline:none;box-sizing:border-box}
  .fb-pop textarea:focus{border-color:#8a6420}
  .fb-pop .fb-sel{font-size:10.5px;color:#a08d75;margin-bottom:7px;font-family:ui-monospace,Menlo,monospace;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fb-row{display:flex;gap:6px;margin-top:9px;align-items:center}
  .fb-btn2{padding:5px 11px;border-radius:6px;border:1px solid #4a3b2c;background:#241d17;color:#ece3d5;font-size:12px;cursor:pointer}
  .fb-btn2:hover{border-color:#d9a441}
  .fb-btn2.pri{font-size:11px}
  .fb-btn2.pri.on{background:#8a6420;border-color:#d9a441;color:#f5e6c8}
  .fb-btn2.send{background:#d9a441;color:#1a1409;border-color:#d9a441;font-weight:600}
  .fb-hl{outline:2px solid #d9a441 !important;outline-offset:2px !important;cursor:crosshair !important}
  .fb-toast{position:fixed;left:50%;top:22px;transform:translateX(-50%);background:#1d1712;border:1px solid #7fa35c;color:#ece3d5;
    padding:9px 18px;border-radius:8px;font-size:13px;z-index:10001;display:none;box-shadow:0 10px 30px rgba(0,0,0,.5)}
  .fb-toast.open{display:block}
  .fb-hint{position:fixed;left:50%;top:14px;transform:translateX(-50%);background:#d9a441;color:#1a1409;padding:6px 16px;
    border-radius:20px;font-size:12.5px;font-weight:600;z-index:10001;display:none;box-shadow:0 6px 20px rgba(0,0,0,.4)}
  .fb-hint.open{display:block}
  `;

  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  const root = document.createElement('div');
  root.className = 'fb-root';
  root.innerHTML = `<button class="fb-btn" title="反馈模式 (F)">✎</button>`;
  document.body.appendChild(root);

  const panel = document.createElement('div');
  panel.className = 'fb-panel';
  panel.innerHTML = `
    <div class="fb-head"><b>反馈</b><span id="fb-count">0 条待处理</span></div>
    <div id="fb-links" style="padding:8px 14px 0"></div>
    <div class="fb-body" id="fb-list"></div>`;
  document.body.appendChild(panel);

  const pop = document.createElement('div');
  pop.className = 'fb-pop';
  pop.innerHTML = `
    <div class="fb-sel" id="fb-sel">—</div>
    <textarea id="fb-note" placeholder="这里哪里不对？想要什么？"></textarea>
    <div class="fb-row">
      <button class="fb-btn2 pri" data-p="3">细节</button>
      <button class="fb-btn2 pri" data-p="2">一般</button>
      <button class="fb-btn2 pri" data-p="1">必改</button>
      <div style="flex:1"></div>
      <button class="fb-btn2" id="fb-cancel">取消</button>
      <button class="fb-btn2 send" id="fb-send">提交</button>
    </div>`;
  document.body.appendChild(pop);

  const toast = document.createElement('div');
  toast.className = 'fb-toast';
  document.body.appendChild(toast);

  const hint = document.createElement('div');
  hint.className = 'fb-hint';
  hint.textContent = '反馈模式：点击页面上的任意元素来标注 · 再按 F 退出';
  document.body.appendChild(hint);

  const btn = root.querySelector('.fb-btn');
  let mode = false;
  let items = [];
  let sel = null;      // {el, path, text, tag}
  let pri = 2;

  /* ---------- 工具 ---------- */
  function cssPath(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let p = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(p + '#' + el.id); break; }
      const cls = (el.className && typeof el.className === 'string')
        ? el.className.split(/\s+/).filter(c => c && !c.startsWith('fb-')).slice(0, 2) : [];
      if (cls.length) p += '.' + cls.join('.');
      const par = el.parentElement;
      if (par) {
        const sibs = [...par.children].filter(c => c.tagName === el.tagName);
        if (sibs.length > 1) p += ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')';
      }
      parts.unshift(p);
      el = par;
    }
    return parts.join(' > ');
  }
  function txt(el) {
    return (el.innerText || el.textContent || '').trim().slice(0, 80).replace(/\s+/g, ' ');
  }
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('open');
    setTimeout(() => toast.classList.remove('open'), 2200);
  }

  /* ---------- 反馈列表 ---------- */
  function renderList() {
    const open = items.filter(i => i.status === 'open');
    document.getElementById('fb-count').textContent = open.length + ' 条待处理';
    let badge = root.querySelector('.fb-badge');
    if (open.length) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'fb-badge'; root.appendChild(badge); }
      badge.textContent = open.length;
    } else if (badge) badge.remove();

    const box = document.getElementById('fb-list');
    if (!items.length) { box.innerHTML = '<div class="fb-empty">还没有反馈<br>点右下角按钮开始标注</div>'; return; }
    box.innerHTML = items.slice().reverse().map(i => `
      <div class="fb-item" data-id="${i.id}">
        <div class="fb-t">${escapeHtml(i.note || '(无文字)')}</div>
        <div class="fb-s">${escapeHtml(i.selText || '')}</div>
        <div class="fb-s" style="opacity:.7">${escapeHtml(i.selector || '')}</div>
        <div class="fb-m">
          <span class="fb-pill ${i.priority === 1 ? 'p2' : i.priority === 3 ? 'ok' : 'p1'}">${priName(i.priority)}</span>
          <span class="fb-pill">${escapeHtml(i.view || '')}</span>
          <div style="flex:1"></div>
          <button class="fb-btn2" data-act="done" data-id="${i.id}">标记已改</button>
        </div>
      </div>`).join('');
    box.querySelectorAll('[data-act="done"]').forEach(b => b.onclick = () => {
      const it = items.find(x => x.id === b.dataset.id);
      if (it) { it.status = 'done'; saveLocal(); renderList(); say('已标记为「已改」'); }
    });
  }
  function priName(p) { return p === 1 ? '必改' : p === 3 ? '细节' : '一般'; }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- 本地缓存（离线也能看到） ---------- */
  function saveLocal() { try { localStorage.setItem('fb.items', JSON.stringify(items)); } catch (e) { } }
  function loadLocal() { try { return JSON.parse(localStorage.getItem('fb.items') || '[]'); } catch (e) { return []; } }

  /* ---------- 模式切换 ---------- */
  function setMode(on) {
    mode = on;
    btn.classList.toggle('on', on);
    panel.classList.toggle('open', on);
    hint.classList.toggle('open', on);
    if (!on) { sel = null; pop.classList.remove('open'); clearHl(); }
  }
  let hl = null;
  function clearHl() { if (hl) { hl.classList.remove('fb-hl'); hl = null; } }

  document.addEventListener('mouseover', e => {
    if (!mode) return;
    if (e.target.closest('.fb-root,.fb-panel,.fb-pop,.fb-hint,.fb-toast')) return;
    if (hl && hl !== e.target) hl.classList.remove('fb-hl');
    hl = e.target;
    hl.classList.add('fb-hl');
  }, true);

  document.addEventListener('click', e => {
    if (!mode) return;
    if (e.target.closest('.fb-root,.fb-panel,.fb-pop,.fb-toast')) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    sel = { el, path: cssPath(el), text: txt(el), tag: el.tagName.toLowerCase() };
    document.getElementById('fb-sel').textContent = sel.path;
    document.getElementById('fb-note').value = '';
    const r = el.getBoundingClientRect();
    pop.classList.add('open');
    const w = 300, h = pop.offsetHeight || 200;
    let x = r.left + r.width / 2 - w / 2;
    let y = r.top - h - 12;
    if (y < 70) y = r.bottom + 12;
    x = Math.max(10, Math.min(x, window.innerWidth - w - 10));
    y = Math.max(70, Math.min(y, window.innerHeight - h - 10));
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    setTimeout(() => document.getElementById('fb-note').focus(), 30);
  }, true);

  /* ---------- 优先级 ---------- */
  pop.querySelectorAll('.pri').forEach(b => b.onclick = () => {
    pop.querySelectorAll('.pri').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    pri = +b.dataset.p;
  });
  pop.querySelector('.pri[data-p="2"]').classList.add('on');

  document.getElementById('fb-cancel').onclick = () => { pop.classList.remove('open'); sel = null; };

  // 反馈出口：优先 POST 到 dev server；配置了 repo 时可改为开 GitHub Issue
  const qs = new URLSearchParams(location.search);
  const REPO = qs.get('repo') || (window.__FB_REPO__ || '');
  const GH = REPO ? 'https://github.com/' + REPO + '/issues/new' : '';

  document.getElementById('fb-send').onclick = async () => {
    if (!sel) return;
    const note = document.getElementById('fb-note').value.trim();
    const item = {
      note,
      priority: pri,
      selector: sel.path,
      selText: sel.text,
      view: currentView(),
      url: location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
      ts: Date.now(),
      status: 'open',
    };
    items.push(item);
    saveLocal();
    renderList();
    pop.classList.remove('open');
    sel = null;
    say('已提交，反馈已送到 agent');
    try {
      await fetch('/__feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
    } catch (e) { /* 本地已存 */ }

    if (GH) {
      const body = [
        '### ' + (note || '(无文字描述)'),
        '',
        '| 字段 | 值 |',
        '| --- | --- |',
        '| 优先级 | ' + priName(pri) + ' |',
        '| 视图 | ' + currentView() + ' |',
        '| 元素文本 | ' + (sel.text || '') + ' |',
        '| CSS 选择器 | `' + sel.path + '` |',
        '| 视口 | ' + window.innerWidth + '×' + window.innerHeight + ' |',
        '',
        '<!-- 由应用内反馈组件自动生成 -->',
      ].join('\n');
      const u = GH + '?title=' + encodeURIComponent('[反馈] ' + (sel.text || '未命名元素').slice(0, 40) + ' — ' + (note || '').slice(0, 60))
        + '&body=' + encodeURIComponent(body);
      window.open(u, '_blank');
      say('已开 GitHub Issue，确认后 agent 就能收到');
    }
  };

  function currentView() {
    const on = document.querySelector('#tabs button.on');
    return on ? on.dataset.v : 'unknown';
  }

  btn.onclick = () => setMode(!mode);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { pop.classList.remove('open'); sel = null; }
    if ((e.key === 'f' || e.key === 'F') && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); setMode(!mode);
    }
  });

  function renderLinks() {
    const box = document.getElementById('fb-links');
    if (!box) return;
    const qs2 = new URLSearchParams(location.search);
    const repo = qs2.get('repo') || (window.__FB_REPO__ || '');
    if (!repo) { box.style.display = 'none'; return; }
    box.innerHTML = '<a class="fb-btn2" style="display:inline-block;text-decoration:none" target="_blank" '
      + 'href="https://github.com/' + repo + '/issues?q=label:%E5%8F%8D%E9%A6%88">查看全部反馈 Issue</a>';
  }

  /* ---------- 初始加载 ---------- */
  items = loadLocal();
  renderList();
  renderLinks();
  fetch('/__feedback').then(r => r.json()).then(list => {
    if (Array.isArray(list) && list.length) {
      const merged = [...items];
      for (const it of list) if (!merged.some(x => x.id === it.id)) merged.push(it);
      items = merged;
      saveLocal();
      renderList();
    }
  }).catch(() => { });
})();
