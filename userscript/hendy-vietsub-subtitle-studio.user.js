// ==UserScript==
// @name         Hendy VietSub Tools - Subtitle Studio v2.1
// @namespace    https://github.com/hendyngo-servers
// @version      2.1.0
// @description  Hendy VietSub Tools v2.1: biên tập phụ đề song ngữ, căn timeline, kiểm tra và dịch AI tùy chọn ngay trong trình duyệt.
// @author       Hendy
// @match        https://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // Không chạy trong iframe để tránh tạo nhiều bảng công cụ trên cùng trang.
  if (window.top !== window.self || document.getElementById('hendy-vietsub-host')) return;

  const STORAGE_KEY = 'hendy_vietsub_tools_settings_v2';
  const host = document.createElement('div');
  host.id = 'hendy-vietsub-host';
  host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial;color-scheme:dark;font-family:Inter,Roboto,Arial,sans-serif}
    *{box-sizing:border-box}
    button,input,textarea,select{font:inherit}
    button{cursor:pointer}
    .launcher{border:1px solid #5eead4;background:linear-gradient(135deg,#082f49,#312e81);color:#e6fffb;padding:12px 16px;border-radius:14px;font-weight:800;box-shadow:0 8px 30px #0008;letter-spacing:.2px}
    .launcher:hover{filter:brightness(1.18);transform:translateY(-1px)}
    .overlay{display:none;position:fixed;inset:0;background:rgba(3,7,18,.86);backdrop-filter:blur(7px);padding:18px;z-index:2147483646;color:#e5e7eb}
    .overlay.open{display:flex;align-items:center;justify-content:center}
    .app{width:min(1280px,100%);height:min(900px,96vh);min-height:420px;background:#0b1120;border:1px solid #334155;border-radius:18px;box-shadow:0 24px 90px #000a;overflow:hidden;display:flex;flex-direction:column}
    .top{display:flex;align-items:center;gap:14px;justify-content:space-between;padding:14px 18px;background:linear-gradient(110deg,#0f172a,#172554);border-bottom:1px solid #334155}
    .brand{display:flex;align-items:center;gap:10px;min-width:0}.logo{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#14b8a6;color:#042f2e;font-weight:1000;font-size:18px}
    .brand h1{font-size:17px;margin:0;font-weight:900;letter-spacing:.2px}.subtitle{font-size:11px;color:#94a3b8;margin-top:4px}
    .top-actions{display:flex;gap:8px;align-items:center}.status{font-size:11px;color:#5eead4;border:1px solid #115e59;padding:6px 9px;border-radius:999px;white-space:nowrap}
    .icon-btn{background:#172033;color:#cbd5e1;border:1px solid #475569;border-radius:9px;width:34px;height:34px;font-size:18px}
    .nav{display:flex;gap:7px;padding:10px 14px;border-bottom:1px solid #273449;background:#0f172a;overflow-x:auto}
    .nav button{border:1px solid transparent;background:transparent;color:#94a3b8;border-radius:9px;padding:9px 12px;white-space:nowrap;font-size:12px;font-weight:800}
    .nav button.active{color:#ccfbf1;background:#134e4a66;border-color:#0f766e}
    .content{flex:1;overflow:auto;padding:16px;background:radial-gradient(ellipse at top right,#152547 0%,#0b1120 52%)}
    .pane{display:none}.pane.active{display:block}
    .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}.card{grid-column:span 12;background:#111b2e;border:1px solid #29384f;border-radius:13px;padding:14px;min-width:0}.half{grid-column:span 6}.third{grid-column:span 4}.two-third{grid-column:span 8}
    .card h2{font-size:13px;margin:0 0 12px;color:#99f6e4;letter-spacing:.4px;text-transform:uppercase}.muted{color:#94a3b8;font-size:12px;line-height:1.5}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:6px;min-width:0}.field label{font-size:11px;color:#a5b4fc;font-weight:700}.field input,.field textarea,.field select,.tool-input{min-width:0;width:100%;background:#080e19;color:#e2e8f0;border:1px solid #384860;border-radius:8px;padding:9px 10px;outline:none}.field input:focus,.field textarea:focus,.field select:focus,.tool-input:focus{border-color:#2dd4bf;box-shadow:0 0 0 2px #2dd4bf22}.field textarea{resize:vertical;min-height:76px;line-height:1.45}
    .btn{border:1px solid #3b536c;background:#1e293b;color:#e2e8f0;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:800}.btn:hover{filter:brightness(1.16)}.btn.primary{background:#0f766e;border-color:#2dd4bf;color:#ecfeff}.btn.purple{background:#4338ca;border-color:#818cf8}.btn.danger{background:#7f1d1d;border-color:#f87171}.btn.small{padding:6px 8px;font-size:11px}.btn:disabled{opacity:.45;cursor:not-allowed}
    .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.stat{border:1px solid #2e4057;background:#0a1221;border-radius:10px;padding:12px}.stat b{display:block;font-size:21px;color:#f0fdfa}.stat span{font-size:10px;color:#94a3b8}
    .video-wrap{background:#020617;border:1px dashed #334155;border-radius:10px;overflow:hidden;min-height:145px;display:grid;place-items:center}.video-wrap video{display:block;width:100%;max-height:350px;background:#000}.empty-video{text-align:center;padding:32px 10px;color:#64748b;font-size:12px}
    .toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.toolbar .search{flex:1;min-width:180px}.toolbar .search input{width:100%;background:#080e19;color:#e2e8f0;border:1px solid #384860;border-radius:9px;padding:9px 11px}
    .sub-list{display:flex;flex-direction:column;gap:9px}.cue{border:1px solid #2e4057;background:#0e1728;border-radius:11px;padding:10px}.cue-head{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:8px}.cue-num{font-size:11px;font-weight:900;color:#5eead4}.cue-time{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.cue-time input{width:92px;background:#060b14;color:#cbd5e1;border:1px solid #334155;border-radius:6px;padding:6px;font-size:11px}.cue-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cue-grid label{display:block;font-size:10px;color:#94a3b8;margin-bottom:5px;font-weight:800}.cue-grid textarea{width:100%;min-height:78px;background:#060b14;color:#e2e8f0;border:1px solid #334155;border-radius:7px;padding:8px;resize:vertical;font-size:12px;line-height:1.45}.cue-grid textarea.vi{border-color:#0f766e}
    .empty-state{border:1px dashed #475569;border-radius:12px;padding:32px;text-align:center;color:#94a3b8;font-size:12px}.progress{height:6px;background:#1e293b;border-radius:99px;overflow:hidden}.progress>span{display:block;width:0;height:100%;background:linear-gradient(90deg,#14b8a6,#818cf8);transition:width .15s}
    .notice{border:1px solid #475569;background:#0a1221;border-radius:10px;padding:10px 12px;font-size:11px;line-height:1.55;color:#cbd5e1}.notice.warn{border-color:#92400e;color:#fde68a}.notice.good{border-color:#0f766e;color:#99f6e4}
    .footer{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid #273449;background:#0f172a;color:#64748b;font-size:10px}.toast{position:fixed;right:22px;top:20px;max-width:min(420px,80vw);background:#0f766e;color:#ecfeff;padding:11px 14px;border:1px solid #5eead4;border-radius:10px;font-size:12px;box-shadow:0 10px 30px #0008;z-index:2147483647;display:none}.toast.show{display:block}
    @media(max-width:800px){.overlay{padding:5px}.app{height:99vh;border-radius:12px}.top{padding:10px}.brand h1{font-size:14px}.status{display:none}.content{padding:9px}.half,.third,.two-third{grid-column:span 12}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.cue-grid{grid-template-columns:1fr}.cue-time input{width:79px}.nav{padding:7px}}
  `;

  root.appendChild(style);
  const appTemplate = document.createElement('template');
  appTemplate.innerHTML = `
    <button class="launcher" id="launch">🎬 HENDY VIETSUB TOOLS</button>
    <div class="overlay" id="overlay" role="dialog" aria-modal="true" aria-label="Hendy VietSub Tools">
      <main class="app">
        <header class="top">
          <div class="brand"><div class="logo">V</div><div><h1>HENDY VIETSUB TOOLS</h1><div class="subtitle">Subtitle Studio · Biên tập phụ đề ngay trên trình duyệt</div></div></div>
          <div class="top-actions"><span class="status" id="status">● SẴN SÀNG</span><button class="icon-btn" id="close" title="Đóng">×</button></div>
        </header>
        <nav class="nav" aria-label="Điều hướng">
          <button class="active" data-tab="overview">Tổng quan</button><button data-tab="editor">Trình biên tập</button><button data-tab="tools">Công cụ phụ đề</button><button data-tab="translate">Cấu hình dịch AI</button>
        </nav>
        <section class="content">
          <div class="pane active" id="pane-overview">
            <div class="grid">
              <section class="card half"><h2>01 · Video nguồn</h2><div class="field"><label for="videoFile">Chọn video từ máy tính</label><input id="videoFile" type="file" accept="video/*"></div><div class="video-wrap" id="videoWrap" style="margin-top:10px"><div class="empty-video">Chưa chọn video<br>Video được đọc cục bộ trong trình duyệt.</div></div><div class="row" style="margin-top:9px"><button class="btn small" data-action="clear-video">Gỡ video</button><span class="muted" id="videoInfo">Chưa có tệp video</span></div></section>
              <section class="card half"><h2>02 · Nạp phụ đề</h2><div class="field"><label for="subtitleFile">Nhập tệp SRT hoặc VTT</label><input id="subtitleFile" type="file" accept=".srt,.vtt,text/plain,text/vtt,application/x-subrip"></div><div class="row" style="margin-top:10px"><button class="btn primary" data-action="new-cue">＋ Thêm một dòng</button><button class="btn" data-action="sample">Tạo dữ liệu mẫu</button><button class="btn danger" data-action="clear-all">Xóa toàn bộ</button></div><div class="notice" style="margin-top:12px">Hỗ trợ nhập/xuất SRT và WebVTT. Video và tệp phụ đề được xử lý trong trình duyệt; script không tự tải video lên máy chủ.</div><div class="field" style="margin-top:12px"><label for="exportMode">Nội dung khi xuất</label><select id="exportMode"><option value="vi">Bản tiếng Việt</option><option value="bi">Song ngữ (Việt + gốc)</option><option value="original">Bản gốc</option></select></div><div class="row" style="margin-top:9px"><button class="btn primary" data-action="export-srt">Tải SRT</button><button class="btn" data-action="export-vtt">Tải VTT</button></div></section>
              <section class="card"><h2>03 · Trạng thái dự án</h2><div class="stats"><div class="stat"><b id="statCount">0</b><span>Dòng phụ đề</span></div><div class="stat"><b id="statTranslated">0%</b><span>Đã có bản dịch</span></div><div class="stat"><b id="statDuration">00:00</b><span>Thời lượng cuối</span></div><div class="stat"><b id="statWords">0</b><span>Từ nguồn</span></div></div><div style="margin-top:13px"><div class="progress"><span id="translateProgress"></span></div></div><div class="row" style="margin-top:12px"><button class="btn primary" data-action="go-editor">Mở trình biên tập →</button><button class="btn purple" data-action="go-translate">Dịch tự động (cấu hình API)</button><button class="btn" data-action="export-json">Sao lưu dự án JSON</button><label class="btn" for="projectFile">Khôi phục JSON</label><input id="projectFile" type="file" accept=".json,application/json" hidden></div></section>
            </div>
          </div>

          <div class="pane" id="pane-editor">
            <div class="toolbar"><input class="search" id="searchCues" placeholder="Tìm trong lời gốc hoặc bản dịch…"><select id="filterCues" class="tool-input" style="width:auto"><option value="all">Tất cả dòng</option><option value="missing">Chưa dịch</option><option value="translated">Đã dịch</option></select><button class="btn small" data-action="prev-cue">◀ Trước</button><button class="btn small" data-action="next-cue">Tiếp ▶</button></div>
            <div class="row" style="justify-content:space-between;margin-bottom:10px"><span class="muted" id="listSummary">0 dòng phụ đề</span><div class="row"><button class="btn small" data-action="add-end">＋ Thêm dòng</button><button class="btn small" data-action="export-srt">Xuất SRT</button></div></div>
            <div id="cueList" class="sub-list"><div class="empty-state">Hãy nhập tệp SRT/VTT ở tab Tổng quan hoặc thêm một dòng phụ đề để bắt đầu.</div></div>
          </div>

          <div class="pane" id="pane-tools">
            <div class="grid">
              <section class="card half"><h2>Căn chỉnh thời gian</h2><div class="field"><label for="shiftSeconds">Dịch thời gian (giây, số âm = sớm hơn)</label><input id="shiftSeconds" type="number" step="0.1" value="0"></div><div class="row" style="margin-top:9px"><button class="btn primary" data-action="shift-time">Áp dụng cho mọi dòng</button><button class="btn" data-action="reset-shift">Đặt lại ô</button></div><p class="muted">Ví dụ: nhập 1.2 để dời toàn bộ phụ đề muộn hơn 1,2 giây.</p></section>
              <section class="card half"><h2>Tìm và thay thế</h2><div class="field"><label for="findText">Tìm nội dung</label><input id="findText" placeholder="Từ hoặc cụm từ cần tìm"></div><div class="field" style="margin-top:8px"><label for="replaceText">Thay bằng</label><input id="replaceText" placeholder="Nội dung thay thế (để trống nếu muốn xóa)"></div><div class="row" style="margin-top:9px"><label class="muted"><input type="checkbox" id="replaceOriginal" checked> Lời gốc</label><label class="muted"><input type="checkbox" id="replaceVi" checked> Bản tiếng Việt</label><button class="btn primary" data-action="replace-all">Thay thế toàn bộ</button></div></section>
              <section class="card half"><h2>Làm sạch văn bản</h2><p class="muted">Chuẩn hóa khoảng trắng thừa và khoảng trắng đầu/cuối trong cả hai cột.</p><button class="btn primary" data-action="clean-text">Làm sạch toàn bộ lời thoại</button></section>
              <section class="card half"><h2>Chuyển đổi và kiểm tra</h2><div class="row"><button class="btn" data-action="validate-times">Kiểm tra timeline</button><button class="btn" data-action="copy-all-vi">Sao chép toàn bộ bản dịch</button></div><p class="muted" style="margin-top:9px">Kiểm tra thời gian kết thúc lớn hơn thời gian bắt đầu; phát hiện dòng trống hoặc chưa dịch.</p><div id="validationResult" class="notice" style="margin-top:8px">Chưa chạy kiểm tra.</div></section>
            </div>
          </div>

          <div class="pane" id="pane-translate">
            <div class="grid">
              <section class="card half"><h2>Kết nối dịch AI tương thích OpenAI</h2><div class="notice warn">Đây là kết nối tùy chọn. Bạn tự cấu hình nhà cung cấp, endpoint, tên model và API key. API key chỉ giữ trong bộ nhớ của tab hiện tại, không lưu vào localStorage và không nằm trong file xuất dự án.</div><div class="field" style="margin-top:12px"><label for="apiEndpoint">Chat Completions endpoint</label><input id="apiEndpoint" placeholder="https://your-provider.example/v1/chat/completions"></div><div class="field" style="margin-top:9px"><label for="apiModel">Model</label><input id="apiModel" placeholder="Tên model từ nhà cung cấp"></div><div class="field" style="margin-top:9px"><label for="apiKey">API key (chỉ dùng trong phiên này)</label><input id="apiKey" type="password" autocomplete="off" placeholder="Dán API key tại đây"></div><div class="field" style="margin-top:9px"><label for="sourceLanguage">Ngôn ngữ nguồn</label><input id="sourceLanguage" value="tự nhận diện" placeholder="Ví dụ: Japanese, Korean, English"></div><div class="row" style="margin-top:12px"><button class="btn" data-action="test-api">Kiểm tra cấu hình</button><button class="btn primary" data-action="translate-missing">Dịch các dòng chưa dịch</button><button class="btn purple" data-action="translate-all">Dịch lại tất cả</button><button class="btn danger" data-action="stop-translation">Dừng dịch</button></div><p class="muted" style="margin-top:10px">Yêu cầu endpoint cho phép gọi từ trình duyệt (CORS) và hỗ trợ định dạng Chat Completions. Chi phí API (nếu có) do tài khoản nhà cung cấp của bạn chi trả.</p></section>
              <section class="card half"><h2>Quy trình dịch</h2><ol class="muted" style="padding-left:18px;line-height:1.8"><li>Nhập phụ đề nguồn ở tab Tổng quan.</li><li>Cấu hình endpoint, model và API key của bạn.</li><li>Nhấn “Dịch các dòng chưa dịch” để dịch theo nhóm nhỏ.</li><li>Rà soát thủ công tên riêng, cách xưng hô và ngữ cảnh.</li><li>Xuất SRT/VTT sau khi kiểm tra timeline.</li></ol><div class="progress" style="margin:12px 0"><span id="apiProgress"></span></div><div id="apiLog" class="notice">Chưa chạy tác vụ dịch.</div><div class="row" style="margin-top:12px"><button class="btn" data-action="clear-api-key">Xóa API key khỏi phiên</button><button class="btn" data-action="save-settings">Lưu endpoint/model</button></div></section>
              <section class="card"><h2>Quyền riêng tư</h2><p class="muted">Tệp video không được gửi tới API dịch. Khi bạn chủ động chạy dịch AI, chỉ văn bản phụ đề của các dòng được chọn sẽ được gửi đến endpoint đã nhập. Không nhập thông tin bí mật vào lời thoại phụ đề.</p></section>
            </div>
          </div>
        </section>
        <footer class="footer"><span>Hendy VietSub Tools · Local-first subtitle editor</span><span id="footerStats">0 dòng · Chưa có dự án</span></footer>
      </main>
    </div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `;
  root.appendChild(appTemplate.content);

  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => Array.from(root.querySelectorAll(selector));
  const overlay = $('#overlay');
  const cueList = $('#cueList');
  let cues = [];
  let nextId = 1;
  let currentVideoUrl = '';
  let activeCueIndex = 0;
  let toastTimer = 0;
  let translating = false;
  let cancelTranslation = false;
  let apiKeyMemory = '';

  const defaultSettings = { endpoint: '', model: '', sourceLanguage: 'tự nhận diện' };
  let settings = loadSettings();
  $('#apiEndpoint').value = settings.endpoint || '';
  $('#apiModel').value = settings.model || '';
  $('#sourceLanguage').value = settings.sourceLanguage || 'tự nhận diện';

  function loadSettings() {
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch (_) { return { ...defaultSettings }; }
  }
  function saveSettings(showMessage = true) {
    settings = {
      endpoint: $('#apiEndpoint').value.trim(),
      model: $('#apiModel').value.trim(),
      sourceLanguage: $('#sourceLanguage').value.trim() || 'tự nhận diện'
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
    catch (_) { /* Trang có thể chặn localStorage; cấu hình vẫn giữ trong phiên. */ }
    if (showMessage) notify('Đã lưu endpoint/model; API key không được lưu.', 'good');
  }

  function notify(message, kind = 'good') {
    const t = $('#toast');
    t.textContent = message;
    t.style.background = kind === 'warn' ? '#92400e' : kind === 'bad' ? '#7f1d1d' : '#0f766e';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
  }
  function setStatus(text, bad = false) {
    $('#status').textContent = `● ${text}`;
    $('#status').style.color = bad ? '#fda4af' : '#5eead4';
    $('#status').style.borderColor = bad ? '#9f1239' : '#115e59';
  }
  function openApp(tab = 'overview') {
    overlay.classList.add('open');
    switchTab(tab);
  }
  function closeApp() { overlay.classList.remove('open'); }
  function switchTab(tab) {
    $$('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.pane').forEach((p) => p.classList.toggle('active', p.id === `pane-${tab}`));
    if (tab === 'editor') renderCues();
  }
  function makeCue(start = 0, end = 2, original = '', vi = '') {
    return { id: nextId++, start: Math.max(0, start), end: Math.max(Math.max(0, start) + 0.1, end), original, vi };
  }
  function parseTimestamp(value) {
    const s = String(value || '').trim().replace(',', '.');
    const m = s.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
    const short = s.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (!m && !short) return NaN;
    if (short && !m) {
      const minutes = Number(short[1]), seconds = Number(short[2]);
      const fraction = Number((short[3] || '').padEnd(3, '0')) / 1000;
      if (minutes > 59 || seconds > 59) return NaN;
      return minutes * 60 + seconds + fraction;
    }
    const hours = Number(m[1] || 0), minutes = Number(m[2]), seconds = Number(m[3]);
    const fraction = Number((m[4] || '').padEnd(3, '0')) / 1000;
    if (minutes > 59 || seconds > 59) return NaN;
    return hours * 3600 + minutes * 60 + seconds + fraction;
  }
  function formatTimestamp(seconds, comma = true) {
    const safe = Math.max(0, Number(seconds) || 0);
    const msTotal = Math.round(safe * 1000);
    const h = Math.floor(msTotal / 3600000);
    const m = Math.floor((msTotal % 3600000) / 60000);
    const s = Math.floor((msTotal % 60000) / 1000);
    const ms = msTotal % 1000;
    const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${base}${comma ? ',' : '.'}${String(ms).padStart(3, '0')}`;
  }
  function parseSubtitleText(text) {
    const cleaned = String(text || '').replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
    const blocks = cleaned.split(/\n\s*\n+/);
    const parsed = [];
    for (const block of blocks) {
      const lines = block.split('\n');
      const timeIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeIndex < 0) continue;
      const timeMatch = lines[timeIndex].match(/([^\s]+)\s*-->\s*([^\s]+)/);
      if (!timeMatch) continue;
      const start = parseTimestamp(timeMatch[1]);
      const end = parseTimestamp(timeMatch[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const textLines = lines.slice(timeIndex + 1).filter((line) => !/^\s*(?:NOTE|STYLE|REGION)\b/i.test(line));
      const original = textLines.join('\n').trim();
      parsed.push(makeCue(start, end, original, ''));
    }
    return parsed.sort((a, b) => a.start - b.start);
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function wordCount(text) {
    const s = String(text || '').trim();
    return s ? s.split(/\s+/).length : 0;
  }
  function updateStats() {
    const count = cues.length;
    const translated = cues.filter((c) => c.vi.trim()).length;
    const pct = count ? Math.round((translated / count) * 100) : 0;
    const duration = count ? Math.max(...cues.map((c) => c.end)) : 0;
    const words = cues.reduce((sum, c) => sum + wordCount(c.original), 0);
    $('#statCount').textContent = String(count);
    $('#statTranslated').textContent = `${pct}%`;
    $('#statDuration').textContent = formatDuration(duration);
    $('#statWords').textContent = String(words);
    $('#translateProgress').style.width = `${pct}%`;
    $('#footerStats').textContent = `${count} dòng · ${pct}% đã dịch`;
  }
  function formatDuration(seconds) {
    const s = Math.floor(Math.max(0, seconds || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  function renderCues() {
    const query = $('#searchCues').value.trim().toLocaleLowerCase();
    const filter = $('#filterCues').value;
    const filtered = cues.filter((c) => {
      if (filter === 'missing' && c.vi.trim()) return false;
      if (filter === 'translated' && !c.vi.trim()) return false;
      if (query && !`${c.original}\n${c.vi}`.toLocaleLowerCase().includes(query)) return false;
      return true;
    });
    $('#listSummary').textContent = `${filtered.length} / ${cues.length} dòng đang hiển thị`;
    if (!filtered.length) {
      cueList.innerHTML = `<div class="empty-state">${cues.length ? 'Không có dòng nào khớp bộ lọc.' : 'Chưa có phụ đề. Hãy nhập tệp SRT/VTT ở tab Tổng quan hoặc thêm dòng mới.'}</div>`;
      return;
    }
    cueList.innerHTML = filtered.map((c) => `
      <article class="cue" data-cue-id="${c.id}">
        <div class="cue-head"><span class="cue-num">DÒNG ${cues.indexOf(c) + 1}${c.vi.trim() ? ' · ĐÃ DỊCH' : ' · CHƯA DỊCH'}</span><div class="cue-time"><input aria-label="Thời gian bắt đầu" data-field="start" data-id="${c.id}" value="${formatTimestamp(c.start)}" title="Bắt đầu HH:MM:SS,mmm"><span class="muted">→</span><input aria-label="Thời gian kết thúc" data-field="end" data-id="${c.id}" value="${formatTimestamp(c.end)}" title="Kết thúc HH:MM:SS,mmm"><button class="btn small" data-action="seek" data-id="${c.id}" title="Phát từ dòng này">▶</button><button class="btn small danger" data-action="delete-cue" data-id="${c.id}" title="Xóa dòng">Xóa</button></div></div>
        <div class="cue-grid"><div><label>NGUYÊN BẢN</label><textarea data-field="original" data-id="${c.id}" placeholder="Lời thoại gốc…">${escapeHtml(c.original)}</textarea></div><div><label>TIẾNG VIỆT (VIETSUB)</label><textarea class="vi" data-field="vi" data-id="${c.id}" placeholder="Nhập bản dịch tiếng Việt…">${escapeHtml(c.vi)}</textarea></div></div>
      </article>`).join('');
  }
  function exportContent(cue, mode) {
    if (mode === 'original') return cue.original;
    if (mode === 'bi') return [cue.vi.trim(), cue.original.trim()].filter(Boolean).join('\n');
    return cue.vi;
  }
  function buildSrt(mode) {
    return cues.map((c, i) => `${i + 1}\n${formatTimestamp(c.start)} --> ${formatTimestamp(c.end)}\n${exportContent(c, mode)}\n`).join('\n').trim() + '\n';
  }
  function buildVtt(mode) {
    return 'WEBVTT\n\n' + cues.map((c) => `${formatTimestamp(c.start, false)} --> ${formatTimestamp(c.end, false)}\n${exportContent(c, mode)}\n`).join('\n').trim() + '\n';
  }
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  function exportSubtitle(kind) {
    if (!cues.length) return notify('Chưa có phụ đề để xuất.', 'warn');
    const mode = $('#exportMode').value;
    if (mode === 'vi' && cues.some((c) => !c.vi.trim())) {
      const missing = cues.filter((c) => !c.vi.trim()).length;
      if (!window.confirm(`Còn ${missing} dòng chưa có bản dịch. Xuất tiếp (các dòng đó sẽ trống)?`)) return;
    }
    const content = kind === 'vtt' ? buildVtt(mode) : buildSrt(mode);
    downloadFile(`hendy-vietsub.${kind}`, content, kind === 'vtt' ? 'text/vtt' : 'application/x-subrip');
    notify(`Đã tạo tệp ${kind.toUpperCase()}.`, 'good');
  }
  function getCueById(id) { return cues.find((c) => c.id === Number(id)); }
  function seekCue(id) {
    const video = $('#videoWrap video');
    const cue = getCueById(id);
    if (!cue) return;
    activeCueIndex = cues.indexOf(cue);
    if (!video) return notify('Chưa nạp video; thời gian phụ đề đã được giữ nguyên.', 'warn');
    try { video.currentTime = cue.start; video.play().catch(() => {}); } catch (_) { notify('Không thể tua video tại thời điểm này.', 'warn'); }
  }
  function newCueAtEnd() {
    const last = cues[cues.length - 1];
    const start = last ? last.end : 0;
    cues.push(makeCue(start, start + 2, '', ''));
    activeCueIndex = cues.length - 1;
    updateStats(); renderCues();
    switchTab('editor');
    const target = cueList.querySelector(`[data-cue-id="${cues[cues.length - 1].id}"] textarea`);
    if (target) target.focus();
  }
  function loadSample() {
    cues = [
      makeCue(0, 2.4, 'Hello, everyone. Welcome back.', 'Xin chào mọi người. Chào mừng các bạn quay trở lại.'),
      makeCue(2.4, 5.1, 'Today, we are going to talk about this story.', 'Hôm nay, chúng ta sẽ cùng nói về câu chuyện này.'),
      makeCue(5.1, 7.8, 'Let us get started!', 'Chúng ta bắt đầu nhé!')
    ];
    activeCueIndex = 0; updateStats(); renderCues(); notify('Đã tạo 3 dòng dữ liệu mẫu.', 'good');
  }
  function clearAll() {
    if (cues.length && !window.confirm('Xóa toàn bộ phụ đề trong dự án hiện tại?')) return;
    cues = []; activeCueIndex = 0; updateStats(); renderCues();
    $('#validationResult').textContent = 'Chưa chạy kiểm tra.';
    notify('Đã xóa phụ đề khỏi phiên hiện tại.', 'good');
  }
  async function readSubtitleFile(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return notify('Tệp phụ đề quá lớn (giới hạn 25 MB).', 'warn');
    try {
      const text = await file.text();
      const parsed = parseSubtitleText(text);
      if (!parsed.length) return notify('Không nhận diện được dòng phụ đề hợp lệ trong tệp.', 'bad');
      if (cues.length && !window.confirm(`Tệp có ${parsed.length} dòng. Thay thế ${cues.length} dòng đang mở?`)) return;
      cues = parsed; activeCueIndex = 0; updateStats(); renderCues();
      setStatus('ĐÃ NẠP PHỤ ĐỀ');
      notify(`Đã nhập ${parsed.length} dòng từ ${file.name}.`, 'good');
      switchTab('editor');
    } catch (err) { notify(`Không đọc được tệp: ${err.message}`, 'bad'); }
  }
  function readProject(jsonText) {
    let data;
    try { data = JSON.parse(jsonText); } catch (_) { return notify('Tệp JSON không hợp lệ.', 'bad'); }
    const entries = Array.isArray(data) ? data : data && data.cues;
    if (!Array.isArray(entries)) return notify('JSON không chứa mảng cues hợp lệ.', 'bad');
    if (entries.length > 100000) return notify('Dự án vượt quá giới hạn 100.000 dòng.', 'warn');
    try {
      const next = entries.map((c, i) => {
        if (!c || typeof c !== 'object') throw new Error(`Dòng ${i + 1} không hợp lệ.`);
        const start = Number(c.start); const end = Number(c.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error(`Mốc thời gian dòng ${i + 1} không hợp lệ.`);
        return { id: nextId++, start, end, original: String(c.original ?? c.source ?? ''), vi: String(c.vi ?? c.vietsub ?? '') };
      });
      cues = next;
    } catch (err) { return notify(`Không thể khôi phục dự án: ${err.message}`, 'bad'); }
    activeCueIndex = 0; updateStats(); renderCues(); notify(`Đã khôi phục ${cues.length} dòng từ JSON.`, 'good');
  }
  function validateTimeline() {
    const issues = [];
    cues.forEach((c, i) => {
      if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start) issues.push(`Dòng ${i + 1}: thời gian không hợp lệ.`);
      if (!c.original.trim()) issues.push(`Dòng ${i + 1}: lời gốc đang trống.`);
      if (!c.vi.trim()) issues.push(`Dòng ${i + 1}: chưa có bản dịch.`);
      if (i > 0 && c.start < cues[i - 1].end) issues.push(`Dòng ${i + 1}: chồng thời gian với dòng trước.`);
    });
    const box = $('#validationResult');
    if (!issues.length) {
      box.className = 'notice good'; box.textContent = `Kiểm tra hoàn tất: ${cues.length} dòng, không phát hiện lỗi phổ biến.`;
      notify('Timeline và nội dung cơ bản hợp lệ.', 'good');
    } else {
      box.className = 'notice warn'; box.innerHTML = `<b>Phát hiện ${issues.length} vấn đề:</b><br>${issues.slice(0, 40).map(escapeHtml).join('<br>')}${issues.length > 40 ? '<br>… còn các vấn đề khác.' : ''}`;
      notify(`Phát hiện ${issues.length} vấn đề cần rà soát.`, 'warn');
    }
  }
  function shiftTimeline() {
    const shift = Number($('#shiftSeconds').value);
    if (!Number.isFinite(shift) || !cues.length) return notify('Nhập số giây hợp lệ và bảo đảm đã có phụ đề.', 'warn');
    cues.forEach((c) => { c.start = Math.max(0, c.start + shift); c.end = Math.max(c.start + 0.1, c.end + shift); });
    updateStats(); renderCues(); notify(`Đã dịch timeline ${shift >= 0 ? '+' : ''}${shift} giây.`, 'good');
  }
  function replaceAllText() {
    const find = $('#findText').value;
    if (!find) return notify('Nhập nội dung cần tìm trước khi thay thế.', 'warn');
    const replacement = $('#replaceText').value;
    let count = 0;
    for (const c of cues) {
      if ($('#replaceOriginal').checked) { const next = c.original.split(find).join(replacement); if (next !== c.original) { c.original = next; count++; } }
      if ($('#replaceVi').checked) { const next = c.vi.split(find).join(replacement); if (next !== c.vi) { c.vi = next; count++; } }
    }
    updateStats(); renderCues(); notify(`Đã thay thế ${count} trường văn bản.`, 'good');
  }
  function cleanText() {
    for (const c of cues) {
      c.original = c.original.split('\n').map((s) => s.replace(/[ \t]+/g, ' ').trim()).join('\n').trim();
      c.vi = c.vi.split('\n').map((s) => s.replace(/[ \t]+/g, ' ').trim()).join('\n').trim();
    }
    updateStats(); renderCues(); notify('Đã làm sạch khoảng trắng.', 'good');
  }
  async function copyAllVietnamese() {
    const content = cues.map((c) => c.vi).join('\n');
    if (!content) return notify('Chưa có nội dung để sao chép.', 'warn');
    try { await navigator.clipboard.writeText(content); notify('Đã sao chép toàn bộ bản dịch.', 'good'); }
    catch (_) { notify('Trình duyệt chặn Clipboard API; hãy dùng nút Sao lưu JSON hoặc xuất SRT.', 'warn'); }
  }
  function parseModelJson(text) {
    const clean = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
      const result = JSON.parse(clean);
      if (Array.isArray(result)) return result;
      if (result && Array.isArray(result.translations)) return result.translations;
    } catch (_) { /* Cố gắng trích mảng JSON từ câu trả lời. */ }
    const m = clean.match(/\[[\s\S]*\]/);
    if (m) {
      const result = JSON.parse(m[0]);
      if (Array.isArray(result)) return result;
    }
    throw new Error('Phản hồi không phải mảng JSON. Hãy kiểm tra định dạng đầu ra của model.');
  }
  function validateApiEndpoint(value) {
    let url;
    try { url = new URL(String(value || '').trim()); } catch (_) { throw new Error('Endpoint phải là URL hợp lệ.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Endpoint chỉ được dùng HTTP hoặc HTTPS.');
    if (url.username || url.password) throw new Error('Không nhúng thông tin xác thực vào URL endpoint.');
    return url.href;
  }

  async function callTranslationApi(batch, batchIndex, totalBatches) {
    const endpoint = validateApiEndpoint($('#apiEndpoint').value);
    const model = $('#apiModel').value.trim();
    const key = apiKeyMemory || $('#apiKey').value.trim();
    const language = $('#sourceLanguage').value.trim() || 'tự nhận diện';
    if (!endpoint || !model || !key) throw new Error('Cần nhập endpoint, model và API key.');
    const payload = {
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Bạn là biên dịch viên phụ đề chuyên nghiệp. Dịch sang tiếng Việt tự nhiên, giữ nguyên ý, tên riêng, số lượng phần tử và thứ tự. Không thêm giải thích. Trả về CHỈ một mảng JSON các chuỗi, có đúng số phần tử như đầu vào.' },
        { role: 'user', content: `Ngôn ngữ nguồn: ${language}. Dịch các câu sau sang tiếng Việt cho phụ đề. Giữ câu ngắn gọn, tự nhiên. Mỗi phần tử đầu vào tương ứng chính xác một phần tử đầu ra.\n${JSON.stringify(batch.map((c) => c.original))}` }
      ]
    };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`API trả HTTP ${response.status}: ${detail || response.statusText}`);
    }
    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('Không tìm thấy choices[0].message.content trong phản hồi API.');
    const translations = parseModelJson(text);
    if (translations.length !== batch.length) throw new Error(`API trả ${translations.length} bản dịch cho ${batch.length} dòng.`);
    return translations.map((v) => typeof v === 'string' ? v : String(v ?? ''));
  }
  async function translateCues(translateAll) {
    if (translating) return notify('Tác vụ dịch đang chạy.', 'warn');
    saveSettings(false);
    apiKeyMemory = $('#apiKey').value.trim();
    if (!apiKeyMemory) return notify('Nhập API key trong tab Cấu hình dịch AI.', 'warn');
    const targets = cues.filter((c) => c.original.trim() && (translateAll || !c.vi.trim()));
    if (!targets.length) return notify(translateAll ? 'Không có dòng nguồn để dịch.' : 'Tất cả dòng có lời gốc đã có bản dịch.', 'good');
    if (!window.confirm(`Gửi ${targets.length} dòng phụ đề đến endpoint đã cấu hình để dịch?`)) return;
    translating = true;
    cancelTranslation = false;
    $('#apiLog').textContent = `Đang bắt đầu: ${targets.length} dòng.`;
    const batches = [];
    for (let i = 0; i < targets.length; i += 10) batches.push(targets.slice(i, i + 10));
    let completed = 0;
    $('#apiProgress').style.width = '0%';
    setStatus('ĐANG DỊCH');
    try {
      for (let i = 0; i < batches.length; i++) {
        if (cancelTranslation) break;
        const batch = batches[i];
        const result = await callTranslationApi(batch, i, batches.length);
        batch.forEach((cue, index) => { cue.vi = result[index].trim(); });
        completed += batch.length;
        const pct = Math.round((completed / targets.length) * 100);
        $('#apiProgress').style.width = `${pct}%`;
        $('#translateProgress').style.width = `${cues.length ? Math.round(cues.filter((c) => c.vi.trim()).length / cues.length * 100) : 0}%`;
        $('#apiLog').textContent = `Đã dịch ${completed}/${targets.length} dòng (${pct}%).`;
        updateStats();
        if (i % 2 === 0) await new Promise((resolve) => setTimeout(resolve, 250));
      }
      renderCues();
      if (cancelTranslation) { $('#apiLog').textContent = `Đã dừng sau ${completed}/${targets.length} dòng.`; notify('Đã dừng tác vụ dịch sau khi hoàn tất nhóm hiện tại.', 'warn'); }
      else { $('#apiLog').textContent = `Hoàn tất: ${completed}/${targets.length} dòng.`; notify(`Đã nhận ${completed} bản dịch. Hãy rà soát trước khi xuất.`, 'good'); }
    } catch (err) {
      $('#apiLog').textContent = `Lỗi sau ${completed}/${targets.length} dòng: ${err.message}`;
      notify(`Dịch bị lỗi: ${err.message}`, 'bad');
    } finally {
      translating = false; cancelTranslation = false; setStatus('SẴN SÀNG'); updateStats();
    }
  }
  async function testApi() {
    saveSettings(false);
    apiKeyMemory = $('#apiKey').value.trim();
    if (!apiKeyMemory || !$('#apiEndpoint').value.trim() || !$('#apiModel').value.trim()) return notify('Cần đủ endpoint, model và API key.', 'warn');
    $('#apiLog').textContent = 'Đang kiểm tra endpoint…';
    try {
      const endpoint = validateApiEndpoint($('#apiEndpoint').value);
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyMemory}` }, body: JSON.stringify({ model: $('#apiModel').value.trim(), messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 8 }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
      $('#apiLog').textContent = 'Endpoint phản hồi thành công. Cấu hình xác thực và kết nối cơ bản có vẻ hoạt động.';
      notify('Kết nối API thành công.', 'good');
    } catch (err) {
      $('#apiLog').textContent = `Không kiểm tra được: ${err.message}. Có thể endpoint không hỗ trợ CORS hoặc sai cấu hình.`;
      notify('Không kết nối được API. Xem nhật ký bên phải.', 'bad');
    }
  }
  function goToNearestCue(direction) {
    if (!cues.length) return;
    activeCueIndex = (activeCueIndex + direction + cues.length) % cues.length;
    const cue = cues[activeCueIndex];
    $('#searchCues').value = '';
    $('#filterCues').value = 'all';
    renderCues();
    const el = cueList.querySelector(`[data-cue-id="${cue.id}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.borderColor = '#2dd4bf'; setTimeout(() => { if (el.isConnected) el.style.borderColor = ''; }, 1200); }
  }

  $('#launch').addEventListener('click', () => openApp());
  $('#close').addEventListener('click', closeApp);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeApp(); });
  $$('.nav button').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
  $('#videoFile').addEventListener('change', (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
    currentVideoUrl = URL.createObjectURL(file);
    $('#videoWrap').innerHTML = `<video controls preload="metadata" src="${currentVideoUrl}"></video>`;
    $('#videoInfo').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    setStatus('VIDEO ĐÃ NẠP');
  });
  $('#subtitleFile').addEventListener('change', (event) => readSubtitleFile(event.target.files?.[0]));
  $('#projectFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0]; if (file) readProject(await file.text()); event.target.value = '';
  });
  $('#searchCues').addEventListener('input', renderCues);
  $('#filterCues').addEventListener('change', renderCues);

  root.addEventListener('input', (event) => {
    const el = event.target;
    if (!el.matches('[data-field][data-id]')) return;
    const cue = getCueById(el.dataset.id); if (!cue) return;
    const field = el.dataset.field;
    if (field === 'original' || field === 'vi') cue[field] = el.value;
    if (field === 'start' || field === 'end') {
      const n = parseTimestamp(el.value);
      if (Number.isFinite(n)) cue[field] = n;
    }
    const card = el.closest('.cue');
    if (card && (field === 'vi' || field === 'original')) {
      const badge = card.querySelector('.cue-num');
      if (badge) badge.textContent = `DÒNG ${cues.indexOf(cue) + 1}${cue.vi.trim() ? ' · ĐÃ DỊCH' : ' · CHƯA DỊCH'}`;
    }
    updateStats();
  });
  root.addEventListener('change', (event) => {
    const el = event.target;
    if (el.matches('[data-field="start"], [data-field="end"]')) {
      const cue = getCueById(el.dataset.id); if (!cue) return;
      const n = parseTimestamp(el.value);
      if (!Number.isFinite(n)) { el.value = formatTimestamp(cue[el.dataset.field]); return notify('Định dạng thời gian phải là HH:MM:SS,mmm.', 'warn'); }
      cue[el.dataset.field] = n;
      if (cue.end <= cue.start) {
        if (el.dataset.field === 'start') cue.end = cue.start + 0.1;
        else cue.start = Math.max(0, cue.end - 0.1);
      }
      renderCues(); updateStats();
    }
  });
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'clear-video') {
      if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl); currentVideoUrl = '';
      $('#videoFile').value = ''; $('#videoWrap').innerHTML = '<div class="empty-video">Chưa chọn video<br>Video được đọc cục bộ trong trình duyệt.</div>'; $('#videoInfo').textContent = 'Chưa có tệp video';
    } else if (action === 'new-cue' || action === 'add-end') newCueAtEnd();
    else if (action === 'sample') loadSample();
    else if (action === 'clear-all') clearAll();
    else if (action === 'export-srt') exportSubtitle('srt');
    else if (action === 'export-vtt') exportSubtitle('vtt');
    else if (action === 'go-editor') switchTab('editor');
    else if (action === 'go-translate') switchTab('translate');
    else if (action === 'shift-time') shiftTimeline();
    else if (action === 'reset-shift') $('#shiftSeconds').value = '0';
    else if (action === 'replace-all') replaceAllText();
    else if (action === 'clean-text') cleanText();
    else if (action === 'validate-times') validateTimeline();
    else if (action === 'copy-all-vi') await copyAllVietnamese();
    else if (action === 'translate-missing') await translateCues(false);
    else if (action === 'translate-all') await translateCues(true);
    else if (action === 'stop-translation') { if (translating) { cancelTranslation = true; $('#apiLog').textContent = 'Đang yêu cầu dừng sau nhóm hiện tại…'; } else notify('Không có tác vụ dịch đang chạy.', 'warn'); }
    else if (action === 'test-api') await testApi();
    else if (action === 'clear-api-key') { apiKeyMemory = ''; $('#apiKey').value = ''; notify('Đã xóa API key khỏi giao diện và bộ nhớ phiên.', 'good'); }
    else if (action === 'save-settings') saveSettings(true);
    else if (action === 'prev-cue') goToNearestCue(-1);
    else if (action === 'next-cue') goToNearestCue(1);
    else if (action === 'seek') seekCue(button.dataset.id);
    else if (action === 'delete-cue') {
      const cue = getCueById(button.dataset.id); if (!cue) return;
      cues = cues.filter((c) => c.id !== cue.id); activeCueIndex = Math.max(0, Math.min(activeCueIndex, cues.length - 1)); updateStats(); renderCues();
    } else if (action === 'export-json') {
      const data = { app: 'Hendy VietSub Tools', version: '2.1.0', exportedAt: new Date().toISOString(), cues };
      downloadFile('hendy-vietsub-project.json', JSON.stringify(data, null, 2), 'application/json');
      notify('Đã sao lưu dự án JSON (không kèm API key).', 'good');
    }
  });
  root.addEventListener('change', (event) => {
    if (event.target.id === 'apiEndpoint' || event.target.id === 'apiModel' || event.target.id === 'sourceLanguage') saveSettings(false);
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('open')) closeApp();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && overlay.classList.contains('open')) {
      event.preventDefault(); exportSubtitle('srt');
    }
  });
  window.addEventListener('beforeunload', () => { if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl); });
  updateStats();
})();
