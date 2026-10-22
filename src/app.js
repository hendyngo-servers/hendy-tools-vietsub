(function () {
  'use strict';
  const Core = window.HendySubtitles;
  if (!Core) throw new Error('Không tải được mô-đun phụ đề.');
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const DRAFT_KEY = 'hendy_vietsub_draft_v2_1';
  const SETTINGS_KEY = 'hendy_vietsub_settings_v2_1';
  const HISTORY_LIMIT = 100;
  let cues = [];
  let undoStack = [];
  let redoStack = [];
  let activeCueId = null;
  let currentVideoUrl = '';
  let currentVideoFile = null;
  let saveTimer = null;
  let toastTimer = null;
  let apiController = null;
  let isTranslating = false;
  let settings = loadSettings();

  function isLoopbackHostname(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    return host === 'localhost' || host.endsWith('.localhost') ||
      host === '::1' || host === '0.0.0.0' ||
      /^127(?:\.\d{1,3}){3}$/.test(host);
  }

  function isLoopbackBackendUrl(value) {
    try { return isLoopbackHostname(new URL(String(value)).hostname); }
    catch (_) { return false; }
  }

  function defaultBackendUrl() {
    const localHost = isLoopbackHostname(location.hostname);
    // The local Docker Compose frontend proxies /api and /health to the bundled backend.
    if (localHost && location.port === '8080') return location.origin;
    if (localHost) return 'http://localhost:10000';
    // A public static site must be explicitly connected to a publicly reachable backend.
    return '';
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      let backendUrl = typeof saved.backendUrl === 'string' ? saved.backendUrl :
        (typeof saved.endpoint === 'string' ? saved.endpoint : defaultBackendUrl());
      // Older releases could leave a localhost URL in storage. On a public website,
      // that URL refers to each visitor's own computer, not to the deployed backend.
      if (!isLoopbackHostname(location.hostname) && isLoopbackBackendUrl(backendUrl)) {
        backendUrl = '';
      }
      return {
        backendUrl,
        sourceLanguage: typeof saved.sourceLanguage === 'string' ? saved.sourceLanguage : 'auto',
        transcriptionLanguage: typeof saved.transcriptionLanguage === 'string' ? saved.transcriptionLanguage : 'auto'
      };
    } catch (_) {
      return { backendUrl: defaultBackendUrl(), sourceLanguage: 'auto', transcriptionLanguage: 'auto' };
    }
  }
  function saveSettings(showToast = true) {
    settings = {
      backendUrl: $('#offlineBackendUrl').value.trim(),
      sourceLanguage: $('#offlineSourceLanguage').value || 'auto',
      transcriptionLanguage: $('#transcribeLanguage').value || 'auto'
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      if (showToast) notify('Đã lưu cấu hình bộ máy Vietsub. Không cần khóa API dịch bên ngoài.', 'good');
    } catch (_) {
      if (showToast) notify('Không lưu được cài đặt; cấu hình vẫn có hiệu lực trong phiên này.', 'warn');
    }
  }

  function applySettings() {
    $('#offlineBackendUrl').value = settings.backendUrl || defaultBackendUrl();
    $('#offlineSourceLanguage').value = settings.sourceLanguage || 'auto';
    $('#transcribeLanguage').value = settings.transcriptionLanguage || 'auto';
  }

  function notify(message, kind = 'good') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast show${kind === 'warn' ? ' warn' : kind === 'bad' ? ' bad' : ''}`;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function setSaveStatus(text, warning = false) {
    const node = $('#saveStatus');
    node.textContent = `● ${text}`;
    node.style.color = warning ? '#f6ce84' : '';
    node.style.borderColor = warning ? '#806437' : '';
  }

  function snapshot() { return JSON.stringify(cues); }

  function checkpoint() {
    const current = snapshot();
    if (undoStack[undoStack.length - 1] !== current) undoStack.push(current);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    $('#undoBtn').disabled = undoStack.length === 0;
    $('#redoBtn').disabled = redoStack.length === 0;
  }

  function restoreSnapshot(value) {
    try { cues = Core.normalizeCues(JSON.parse(value)); }
    catch (error) { notify(`Không thể khôi phục lịch sử: ${error.message}`, 'bad'); return; }
    activeCueId = cues.some((cue) => cue.id === activeCueId) ? activeCueId : (cues[0]?.id || null);
    renderCues();
    updateStats();
    updateCaption();
    queueSave();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restoreSnapshot(undoStack.pop());
    updateHistoryButtons();
    notify('Đã hoàn tác.', 'good');
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restoreSnapshot(redoStack.pop());
    updateHistoryButtons();
    notify('Đã làm lại.', 'good');
  }

  function queueSave() {
    setSaveStatus('ĐANG LƯU…');
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 280);
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: '2.1.0', savedAt: new Date().toISOString(), cues }));
      setSaveStatus('NHÁP ĐÃ LƯU');
    } catch (_) {
      setSaveStatus('LỖI LƯU NHÁP', true);
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      cues = Core.normalizeCues(Array.isArray(parsed) ? parsed : parsed.cues);
      activeCueId = cues[0]?.id || null;
      return true;
    } catch (_) {
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* Storage may be disabled by browser policy. */ }
      notify('Nháp cũ không hợp lệ nên đã bỏ qua.', 'warn');
      return false;
    }
  }

  function wordCount(text) {
    const value = String(text || '').trim();
    return value ? value.split(/\s+/u).length : 0;
  }

  function formatDuration(milliseconds) {
    const seconds = Math.floor(Math.max(0, milliseconds || 0) / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateStats() {
    const translated = cues.filter((cue) => cue.vi.trim()).length;
    const pct = cues.length ? Math.round((translated / cues.length) * 100) : 0;
    const duration = cues.reduce((max, cue) => Math.max(max, cue.end || 0), 0);
    const words = cues.reduce((total, cue) => total + wordCount(cue.original), 0);
    $('#statCount').textContent = String(cues.length);
    $('#statTranslated').textContent = `${pct}%`;
    $('#progressBar').style.width = `${pct}%`;
    $('#statDuration').textContent = formatDuration(duration);
    $('#statWords').textContent = String(words);
    $('#listSummary').textContent = `${cues.length} dòng phụ đề`;
  }

  function makeButton(text, className, title, action, cueId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.title = title;
    button.dataset.action = action;
    if (cueId) button.dataset.id = cueId;
    return button;
  }

  function makeCueField(cue, field, label, isTranslation = false) {
    const wrap = document.createElement('div');
    wrap.className = 'cue-field-wrap';
    const title = document.createElement('label');
    title.textContent = label;
    title.htmlFor = `cue-${cue.id}-${field}`;
    const textarea = document.createElement('textarea');
    textarea.id = title.htmlFor;
    textarea.className = `cue-field${isTranslation ? ' vi' : ''}`;
    textarea.dataset.field = field;
    textarea.dataset.id = cue.id;
    textarea.placeholder = isTranslation ? 'Nhập bản dịch tiếng Việt…' : 'Lời thoại gốc…';
    textarea.value = cue[field];
    textarea.spellcheck = true;
    wrap.append(title, textarea);
    return wrap;
  }

  function makeTimeInput(cue, field, title) {
    const label = document.createElement('label');
    label.textContent = title;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', title);
    input.value = Core.formatTimestamp(cue[field]);
    input.dataset.field = field;
    input.dataset.id = cue.id;
    label.append(input);
    return label;
  }

  function renderCues() {
    const list = $('#cueList');
    const query = $('#searchInput').value.trim().toLocaleLowerCase();
    const filter = $('#filterSelect').value;
    const filtered = cues.filter((cue) => {
      if (filter === 'missing' && cue.vi.trim()) return false;
      if (filter === 'translated' && !cue.vi.trim()) return false;
      if (query && !`${cue.original}\n${cue.vi}`.toLocaleLowerCase().includes(query)) return false;
      return true;
    });
    $('#listSummary').textContent = `${filtered.length} / ${cues.length} dòng`;
    list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const symbol = document.createElement('div'); symbol.className = 'empty-symbol'; symbol.textContent = 'SRT';
      const heading = document.createElement('h3'); heading.textContent = cues.length ? 'Không có dòng phù hợp' : 'Không gian làm việc đang trống';
      const paragraph = document.createElement('p'); paragraph.textContent = cues.length ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Nhập tệp SRT/VTT hoặc tạo dòng đầu tiên để bắt đầu.';
      empty.append(symbol, heading, paragraph);
      if (!cues.length) {
        const importLabel = document.createElement('label'); importLabel.className = 'button primary'; importLabel.htmlFor = 'subtitleFile'; importLabel.textContent = 'Nhập phụ đề'; empty.append(importLabel);
      }
      list.append(empty);
      return;
    }
    filtered.forEach((cue) => {
      const card = document.createElement('article');
      card.className = `cue${cue.id === activeCueId ? ' active' : ''}`;
      card.dataset.cueId = cue.id;
      const header = document.createElement('div'); header.className = 'cue-head';
      const titleGroup = document.createElement('div'); titleGroup.className = 'cue-title';
      const number = document.createElement('span'); number.className = 'cue-number'; number.textContent = `DÒNG ${cues.indexOf(cue) + 1}`;
      const badge = document.createElement('span'); badge.className = `cue-badge${cue.vi.trim() ? ' done' : ''}`; badge.textContent = cue.vi.trim() ? 'ĐÃ DỊCH' : 'CHƯA DỊCH';
      titleGroup.append(number, badge);
      const actionGroup = document.createElement('div'); actionGroup.className = 'cue-actions';
      actionGroup.append(makeButton('▶', 'mini-btn', 'Phát từ dòng này', 'seek', cue.id));
      actionGroup.append(makeButton('×', 'mini-btn delete', 'Xóa dòng này', 'delete-cue', cue.id));
      header.append(titleGroup, actionGroup);
      const timeRow = document.createElement('div'); timeRow.className = 'cue-times';
      timeRow.append(makeTimeInput(cue, 'start', 'Bắt đầu'), Object.assign(document.createElement('span'), { className: 'arrow', textContent: '→' }), makeTimeInput(cue, 'end', 'Kết thúc'));
      const fields = document.createElement('div'); fields.className = 'cue-fields';
      fields.append(makeCueField(cue, 'original', 'LỜI GỐC'), makeCueField(cue, 'vi', 'TIẾNG VIỆT · VIETSUB', true));
      card.append(header, timeRow, fields);
      list.append(card);
    });
  }

  function activeCue() { return cues.find((cue) => cue.id === activeCueId) || null; }

  function addCue() {
    checkpoint();
    const last = cues[cues.length - 1];
    const start = last ? last.end : 0;
    const cue = Core.createCue(start, start + 2000, '', '');
    cues.push(cue);
    activeCueId = cue.id;
    renderCues(); updateStats(); queueSave();
    const target = $(`[data-cue-id="${cue.id}"] textarea`);
    if (target) target.focus();
  }

  function loadSample() {
    checkpoint();
    cues = [
      Core.createCue(0, 2400, 'Hello, everyone. Welcome back.', 'Xin chào mọi người. Chào mừng các bạn quay trở lại.'),
      Core.createCue(2400, 5100, 'Today, we are going to talk about this story.', 'Hôm nay, chúng ta sẽ cùng nói về câu chuyện này.'),
      Core.createCue(5100, 7800, 'Let us get started!', 'Chúng ta bắt đầu nhé!')
    ];
    activeCueId = cues[0].id;
    renderCues(); updateStats(); queueSave();
    notify('Đã tạo 3 dòng mẫu để thử nghiệm.', 'good');
  }

  function clearProject() {
    if (!cues.length) return;
    if (!window.confirm(`Xóa toàn bộ ${cues.length} dòng phụ đề khỏi dự án hiện tại?`)) return;
    checkpoint(); cues = []; activeCueId = null; renderCues(); updateStats(); queueSave();
    $('#quickValidation').textContent = 'Chưa chạy kiểm tra.';
    $('#quickValidation').className = 'validation-mini';
    $('#validationDetails').textContent = 'Chưa có kết quả kiểm tra.';
    notify('Đã xóa phụ đề khỏi dự án.', 'good');
  }

  async function importSubtitle(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { notify('Tệp quá lớn. Vui lòng chọn tệp phụ đề dưới 25 MB.', 'warn'); return; }
    try {
      const parsed = Core.parseSubtitleText(await file.text());
      if (!parsed.length) throw new Error('Không nhận diện được cue hợp lệ trong tệp.');
      if (cues.length && !window.confirm(`Nạp ${parsed.length} dòng từ “${file.name}” và thay thế ${cues.length} dòng hiện tại?`)) return;
      checkpoint(); cues = parsed; activeCueId = cues[0].id;
      renderCues(); updateStats(); queueSave(); switchTab('editorPane');
      notify(`Đã nhập ${parsed.length} dòng từ ${file.name}.`, 'good');
    } catch (error) { notify(`Không thể nhập phụ đề: ${error.message}`, 'bad'); }
    finally { $('#subtitleFile').value = ''; }
  }

  async function importProject(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { notify('Tệp JSON lớn hơn giới hạn 25 MB.', 'warn'); return; }
    try {
      const data = JSON.parse(await file.text());
      const entries = Array.isArray(data) ? data : data.cues;
      const next = Core.normalizeCues(entries);
      if (cues.length && !window.confirm(`Khôi phục ${next.length} dòng và thay thế dự án hiện tại?`)) return;
      checkpoint(); cues = next; activeCueId = cues[0]?.id || null;
      renderCues(); updateStats(); queueSave(); switchTab('editorPane');
      notify(`Đã khôi phục ${cues.length} dòng từ JSON.`, 'good');
    } catch (error) { notify(`JSON không hợp lệ: ${error.message}`, 'bad'); }
    finally { $('#projectFile').value = ''; }
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.rel = 'noopener'; anchor.style.display = 'none';
    document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function exportSubtitle(kind) {
    if (!cues.length) { notify('Chưa có phụ đề để xuất.', 'warn'); return; }
    const mode = $('#exportMode').value;
    if (mode === 'vi') {
      const missing = cues.filter((cue) => !cue.vi.trim()).length;
      if (missing && !window.confirm(`Còn ${missing} dòng chưa dịch. Xuất tiếp? Dòng thiếu bản dịch sẽ để trống.`)) return;
    }
    const content = kind === 'vtt' ? Core.buildVtt(cues, mode) : Core.buildSrt(cues, mode);
    downloadFile(`hendy-vietsub.${kind}`, `\uFEFF${content}`, kind === 'vtt' ? 'text/vtt' : 'application/x-subrip');
    notify(`Đã tạo tệp ${kind.toUpperCase()}.`, 'good');
  }

  function exportProject() {
    const project = { app: 'Hendy VietSub Tools', version: '2.1.0', exportedAt: new Date().toISOString(), cues: cues.map((cue) => ({ ...cue })) };
    downloadFile('hendy-vietsub-project.json', JSON.stringify(project, null, 2), 'application/json');
    notify('Đã sao lưu dự án JSON. API key không nằm trong file.', 'good');
  }

  function updateCaption() {
    const video = $('#video');
    if (video.classList.contains('hidden')) { $('#liveCaption').textContent = 'Bản xem trước phụ đề'; return; }
    const timestamp = Math.round((video.currentTime || 0) * 1000);
    const cue = cues.find((item) => timestamp >= item.start && timestamp <= item.end);
    if (!cue) { $('#liveCaption').textContent = ''; return; }
    const mode = $('#previewMode').value;
    let text = mode === 'original' ? cue.original : mode === 'bi' ? [cue.original, cue.vi].filter(Boolean).join('\n') : (cue.vi || cue.original);
    $('#liveCaption').textContent = text;
  }

  function loadVideo(file) {
    if (!file) return;
    currentVideoFile = file;
    if (!file.type.startsWith('video/')) { notify('Tệp đã chọn không phải video.', 'warn'); return; }
    if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
    currentVideoUrl = URL.createObjectURL(file);
    const video = $('#video');
    video.src = currentVideoUrl;
    video.classList.remove('hidden');
    $('.video-placeholder').classList.add('hidden');
    $('#videoName').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    video.load();
    notify('Video được nạp cục bộ trong trình duyệt.', 'good');
  }

  function removeVideo() {
    currentVideoFile = null;
    const video = $('#video');
    video.pause(); video.removeAttribute('src'); video.load(); video.classList.add('hidden');
    $('.video-placeholder').classList.remove('hidden');
    $('#videoName').textContent = 'Chưa nạp video';
    if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
    currentVideoUrl = '';
    updateCaption();
  }

  function seekCue(id) {
    const cue = cues.find((item) => item.id === id);
    if (!cue) return;
    activeCueId = cue.id;
    const video = $('#video');
    if (!video.classList.contains('hidden')) {
      video.currentTime = cue.start / 1000;
      video.play().catch(() => {});
    } else notify('Video chưa được nạp; mốc thời gian phụ đề vẫn được giữ.', 'warn');
    renderCues(); updateCaption();
  }

  function parseTimeInput(input) {
    const parsed = Core.parseTimestamp(input.value);
    if (!Number.isFinite(parsed)) return NaN;
    return parsed;
  }

  function handleTimeChange(input) {
    const cue = cues.find((item) => item.id === input.dataset.id);
    if (!cue) return;
    const field = input.dataset.field;
    const parsed = parseTimeInput(input);
    if (!Number.isFinite(parsed)) {
      input.value = Core.formatTimestamp(cue[field]);
      notify('Thời gian phải theo dạng HH:MM:SS,mmm hoặc MM:SS,mmm.', 'warn');
      return;
    }
    cue[field] = Math.max(0, parsed);
    if (cue.end <= cue.start) {
      if (field === 'start') cue.end = cue.start + Core.MIN_CUE_MS;
      else cue.start = Math.max(0, cue.end - Core.MIN_CUE_MS);
    }
    input.value = Core.formatTimestamp(cue[field]);
    const card = input.closest('.cue');
    if (card) {
      const fields = $$('input[data-field="start"],input[data-field="end"]', card);
      fields.forEach((element) => { const current = cues.find((item) => item.id === element.dataset.id); if (current) element.value = Core.formatTimestamp(current[element.dataset.field]); });
    }
    queueSave(); updateStats(); updateCaption();
  }

  function switchTab(id) {
    $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === id));
    $$('.tab-pane').forEach((pane) => pane.classList.toggle('active', pane.id === id));
    if (id === 'editorPane') renderCues();
  }

  function showValidation() {
    const issues = Core.validateTimeline(cues);
    const quick = $('#quickValidation');
    const detail = $('#validationDetails');
    if (!issues.length) {
      quick.className = 'validation-mini good';
      quick.textContent = `Hợp lệ cơ bản: ${cues.length} dòng, không phát hiện vấn đề.`;
      detail.className = 'validation-details';
      detail.textContent = `Kiểm tra hoàn tất: ${cues.length} cue. Không phát hiện lỗi thời gian, thứ tự, dòng trống hoặc bản dịch còn thiếu.`;
      notify('Kiểm tra timeline hoàn tất.', 'good');
      return;
    }
    quick.className = 'validation-mini warn';
    quick.textContent = `Có ${issues.length} vấn đề cần xem lại.`;
    detail.className = 'validation-details';
    const intro = document.createElement('p'); intro.textContent = `Phát hiện ${issues.length} vấn đề:`;
    const list = document.createElement('ul');
    issues.slice(0, 100).forEach((issue) => { const li = document.createElement('li'); li.className = 'bad'; li.textContent = issue.message; list.append(li); });
    if (issues.length > 100) { const li = document.createElement('li'); li.textContent = `Còn ${issues.length - 100} vấn đề chưa hiển thị.`; list.append(li); }
    detail.replaceChildren(intro, list);
    notify(`Phát hiện ${issues.length} vấn đề cần rà soát.`, 'warn');
  }

  function setTranslateLog(message, kind = '') {
    const log = $('#apiLog');
    log.textContent = message;
    log.style.color = kind === 'bad' ? 'var(--red)' : kind === 'good' ? 'var(--teal)' : '';
  }

  function getOfflineBackendUrl() {
    const raw = $('#offlineBackendUrl').value.trim().replace(/\/+$/, '');
    if (!raw) throw new Error('Nhập URL HTTPS của backend Vietsub đã triển khai. Không cần API key.');
    let url;
    try { url = new URL(raw); } catch (_) { throw new Error('URL backend chưa hợp lệ.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Backend chỉ hỗ trợ HTTP hoặc HTTPS.');
    if (url.username || url.password) throw new Error('Không nhúng thông tin đăng nhập vào URL backend.');
    if (!isLoopbackHostname(location.hostname) && isLoopbackHostname(url.hostname)) {
      throw new Error('URL backend đang trỏ về localhost trên máy tính của bạn. Website workers.dev là trang công khai nên không thể dùng localhost. Hãy triển khai backend Vietsub riêng và nhập URL HTTPS công khai (ví dụ https://ten-dich-vu.onrender.com).');
    }
    if (location.protocol === 'https:' && url.protocol === 'http:' && !isLoopbackHostname(url.hostname)) {
      throw new Error('Website đang chạy HTTPS nên trình duyệt chặn backend HTTP. Hãy dùng URL HTTPS của backend.');
    }
    return url.href.replace(/\/+$/, '');
  }
  async function readBackendJson(response) {
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { throw new Error('Backend trả về dữ liệu không hợp lệ.'); }
    if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
    return data;
  }

  async function checkOfflineBackend() {
    let base;
    try { base = getOfflineBackendUrl(); saveSettings(false); }
    catch (error) {
      setTranslateLog(error.message, 'bad');
      notify(error.message, 'warn');
      return;
    }
    $('#checkOfflineBtn').disabled = true;
    setTranslateLog('Đang kiểm tra mô hình dịch, Whisper và FFmpeg…');
    try {
      const response = await fetch(base + '/health', { method: 'GET', cache: 'no-store' });
      const data = await readBackendJson(response);
      if (!data.ok) throw new Error('Backend chưa sẵn sàng.');
      const lines = [
        'Backend kết nối được.',
        'Dịch offline: ' + (data.offlineTranslation ? 'SẴN SÀNG' : 'CHƯA SẴN SÀNG'),
        'Whisper nhận dạng giọng nói: ' + (data.speechRecognition ? 'SẴN SÀNG' : 'CHƯA SẴN SÀNG'),
        'FFmpeg ghép video: ' + (data.videoRendering ? 'SẴN SÀNG' : 'CHƯA SẴN SÀNG'),
        data.translationLanguages ? 'Ngôn ngữ nguồn: ' + data.translationLanguages.join(', ') : ''
      ].filter(Boolean).join('\n');
      setTranslateLog(lines, data.offlineTranslation && data.speechRecognition && data.videoRendering ? 'good' : 'bad');
      if (!data.offlineTranslation || !data.speechRecognition || !data.videoRendering) {
        notify('Backend đang chạy nhưng một hoặc nhiều mô hình chưa sẵn sàng.', 'warn');
      } else {
        notify('Bộ máy Vietsub tích hợp đã sẵn sàng; không cần API key.', 'good');
      }
    } catch (error) {
      const detail = error instanceof TypeError
        ? 'Trình duyệt không gọi được backend. Kiểm tra backend đã chạy công khai chưa, URL HTTPS và CORS có cho phép origin ' + location.origin + '.'
        : error.message;
      setTranslateLog('Không kết nối được backend: ' + detail, 'bad');
      notify('Chưa kết nối được bộ máy Vietsub.', 'bad');
    } finally {
      $('#checkOfflineBtn').disabled = false;
    }
  }

  async function testApi() {
    return checkOfflineBackend();
  }

  async function translateCues(all = false) {
    if (isTranslating) return;
    if (!cues.length) { notify('Hãy nhập phụ đề trước khi dịch.', 'warn'); return; }
    let base;
    try { base = getOfflineBackendUrl(); }
    catch (error) { notify(error.message, 'warn'); return; }

    const source = $('#offlineSourceLanguage').value || 'auto';
    const targets = cues.filter((cue) => cue.original.trim() && (all || !cue.vi.trim()));
    if (!targets.length) { notify(all ? 'Không có lời gốc để dịch.' : 'Tất cả dòng có lời gốc đã được dịch.', 'good'); return; }
    if (!window.confirm('Dịch ' + targets.length + ' dòng bằng mô hình offline tích hợp sẵn? Không dùng API key hoặc gửi văn bản đến nhà cung cấp dịch bên thứ ba.')) return;

    saveSettings(false);
    checkpoint();
    isTranslating = true;
    apiController = new AbortController();
    $('#translateMissingBtn').disabled = true;
    $('#translateAllBtn').disabled = true;
    $('#stopTranslateBtn').disabled = false;
    $('#apiProgress').style.width = '0%';
    let completed = 0;
    let stopped = false;
    setTranslateLog('Đang khởi chạy bộ dịch offline cho ' + targets.length + ' dòng…');

    try {
      const batches = [];
      for (let i = 0; i < targets.length; i += 20) batches.push(targets.slice(i, i + 20));
      for (const batch of batches) {
        const response = await fetch(base + '/api/translate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: batch.map((cue) => cue.original), source: source, target: 'vi' }),
          signal: apiController.signal
        });
        const data = await readBackendJson(response);
        if (!Array.isArray(data.translations) || data.translations.length !== batch.length) {
          throw new Error('Số lượng bản dịch nhận về không khớp số dòng đã gửi.');
        }
        batch.forEach((cue, index) => { cue.vi = String(data.translations[index] || '').trim(); });
        completed += batch.length;
        updateTranslationProgress(completed, targets.length);
        setTranslateLog('Đã dịch offline ' + completed + '/' + targets.length + ' dòng (' +
          Math.round(completed / targets.length * 100) + '%).');
      }
      setTranslateLog('Hoàn tất ' + completed + '/' + targets.length + ' dòng bằng mô hình offline. Hãy rà soát bản dịch.', 'good');
      notify('Đã dịch ' + completed + ' dòng Vietsub offline.', 'good');
    } catch (error) {
      stopped = error.name === 'AbortError';
      const message = stopped
        ? 'Đã dừng sau ' + completed + '/' + targets.length + ' dòng.'
        : 'Lỗi sau ' + completed + '/' + targets.length + ' dòng: ' + error.message;
      setTranslateLog(message, stopped ? '' : 'bad');
      notify(message, stopped ? 'warn' : 'bad');
    } finally {
      isTranslating = false;
      apiController = null;
      $('#translateMissingBtn').disabled = false;
      $('#translateAllBtn').disabled = false;
      $('#stopTranslateBtn').disabled = true;
      renderCues(); updateStats(); updateCaption(); queueSave();
    }
  }

  function updateTranslationProgress(done, total) {
    $('#apiProgress').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    updateStats();
  }

  async function transcribeVideo() {
    if (!currentVideoFile) { notify('Chọn video ở tab Studio trước khi tạo phụ đề.', 'warn'); return; }
    let base;
    try { base = getOfflineBackendUrl(); }
    catch (error) { notify(error.message, 'warn'); return; }
    if (currentVideoFile.size > 200 * 1024 * 1024) {
      notify('Video vượt quá giới hạn tải lên 200 MB.', 'warn'); return;
    }
    if (cues.length && !window.confirm('Tạo phụ đề mới sẽ thay thế ' + cues.length + ' dòng đang có. Tiếp tục?')) return;

    const form = new FormData();
    form.append('video', currentVideoFile, currentVideoFile.name);
    form.append('language', $('#transcribeLanguage').value || 'auto');
    $('#transcribeBtn').disabled = true;
    setTranslateLog('Đang gửi video đến backend của bạn để nhận dạng giọng nói bằng Whisper offline…');
    try {
      const response = await fetch(base + '/api/transcribe', { method: 'POST', body: form });
      const data = await readBackendJson(response);
      if (!Array.isArray(data.cues) || !data.cues.length) throw new Error('Không có dòng phụ đề nào được tạo.');
      checkpoint();
      cues = Core.normalizeCues(data.cues.map((cue) => Core.createCue(
        Number(cue.start), Number(cue.end), String(cue.original || ''), String(cue.vi || '')
      )));
      activeCueId = cues[0]?.id || null;
      renderCues(); updateStats(); updateCaption(); queueSave(); switchTab('editorPane');
      const language = data.detectedLanguage || 'không rõ';
      setTranslateLog('Đã nhận dạng ' + cues.length + ' dòng. Ngôn ngữ âm thanh: ' + language +
        '. Bản ghi đang ở cột lời gốc; chạy dịch offline để tạo Vietsub.', 'good');
      notify('Đã tạo ' + cues.length + ' dòng phụ đề từ video.', 'good');
    } catch (error) {
      setTranslateLog('Không tạo được phụ đề: ' + error.message, 'bad');
      notify('Nhận dạng giọng nói thất bại.', 'bad');
    } finally {
      $('#transcribeBtn').disabled = false;
    }
  }

  async function burnVideo() {
    if (!currentVideoFile) { notify('Chọn video trước khi ghép phụ đề.', 'warn'); return; }
    if (!cues.length) { notify('Chưa có phụ đề để ghép.', 'warn'); return; }
    let base;
    try { base = getOfflineBackendUrl(); }
    catch (error) { notify(error.message, 'warn'); return; }
    if (currentVideoFile.size > 200 * 1024 * 1024) {
      notify('Video vượt quá giới hạn tải lên 200 MB.', 'warn'); return;
    }
    const mode = $('#exportMode').value;
    const subtitleSrt = Core.buildSrt(cues, mode);
    if (!subtitleSrt.trim()) { notify('Không tạo được dữ liệu SRT.', 'warn'); return; }
    const form = new FormData();
    form.append('video', currentVideoFile, currentVideoFile.name);
    form.append('subtitleSrt', subtitleSrt);
    form.append('fontSize', $('#fontSize').value);
    $('#burnVideoBtn').disabled = true;
    setTranslateLog('Đang tải video đến backend của bạn; FFmpeg sẽ ghép phụ đề vĩnh viễn vào file MP4 mới…');
    try {
      const response = await fetch(base + '/api/render', { method: 'POST', body: form });
      if (!response.ok) await readBackendJson(response);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'hendy-vietsub.mp4'; anchor.rel = 'noopener';
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setTranslateLog('Đã xuất hendy-vietsub.mp4 có phụ đề vĩnh viễn.', 'good');
      notify('Đã tạo video Vietsub mới.', 'good');
    } catch (error) {
      setTranslateLog('Không ghép được phụ đề: ' + error.message, 'bad');
      notify('Xuất video Vietsub thất bại.', 'bad');
    } finally {
      $('#burnVideoBtn').disabled = false;
    }
  }

  async function copyAllVietnamese() {
    const content = cues.map((cue) => cue.vi).join('\n');
    if (!content.trim()) { notify('Chưa có bản dịch để sao chép.', 'warn'); return; }
    try {
      await navigator.clipboard.writeText(content);
      notify('Đã sao chép toàn bộ Vietsub.', 'good');
    } catch (_) {
      const area = document.createElement('textarea'); area.value = content; document.body.append(area); area.select();
      const ok = document.execCommand('copy'); area.remove();
      notify(ok ? 'Đã sao chép toàn bộ Vietsub.' : 'Trình duyệt chặn sao chép; hãy xuất SRT/JSON.', ok ? 'good' : 'warn');
    }
  }

  function sortCues() {
    checkpoint();
    cues.sort((a, b) => a.start - b.start || a.end - b.end);
    renderCues(); updateStats(); queueSave();
    notify('Đã sắp xếp phụ đề theo thời gian bắt đầu.', 'good');
  }

  function applyShift() {
    const seconds = Number($('#shiftSeconds').value);
    if (!Number.isFinite(seconds) || Math.abs(seconds) > 3600) { notify('Nhập số giây trong khoảng -3600 đến 3600.', 'warn'); return; }
    if (!cues.length) { notify('Chưa có dòng phụ đề.', 'warn'); return; }
    checkpoint(); cues = Core.shiftTimeline(cues, seconds * 1000);
    renderCues(); updateStats(); updateCaption(); queueSave();
    notify(`Đã dịch timeline ${seconds >= 0 ? '+' : ''}${seconds} giây.`, 'good');
  }

  function replaceAllText() {
    const find = $('#findText').value;
    if (!find) { notify('Nhập nội dung cần tìm trước.', 'warn'); return; }
    const options = { original: $('#replaceOriginal').checked, vi: $('#replaceVi').checked };
    if (!options.original && !options.vi) { notify('Chọn ít nhất một cột để thay thế.', 'warn'); return; }
    checkpoint();
    const result = Core.replaceText(cues, find, $('#replaceText').value, options);
    cues = result.cues; renderCues(); updateStats(); queueSave();
    notify(`Đã thay thế ${result.replacements} trường văn bản.`, 'good');
  }

  function cleanAllText() {
    checkpoint(); cues = Core.cleanText(cues);
    renderCues(); updateStats(); queueSave();
    notify('Đã làm sạch khoảng trắng trong phụ đề.', 'good');
  }

  function bindEvents() {
    $('#subtitleFile').addEventListener('change', (event) => importSubtitle(event.target.files?.[0]));
    $('#projectImportBtn').addEventListener('click', () => $('#projectFile').click());
    $('#projectFile').addEventListener('change', (event) => importProject(event.target.files?.[0]));
    $('#videoFile').addEventListener('change', (event) => loadVideo(event.target.files?.[0]));
    $('#removeVideoBtn').addEventListener('click', removeVideo);
    $('#undoBtn').addEventListener('click', undo);
    $('#redoBtn').addEventListener('click', redo);
    $('#exportTop').addEventListener('click', () => exportSubtitle('srt'));
    $('#exportSrtBtn').addEventListener('click', () => exportSubtitle('srt'));
    $('#exportVttBtn').addEventListener('click', () => exportSubtitle('vtt'));
    $('#exportJsonBtn').addEventListener('click', exportProject);
    $('#newCueBtn').addEventListener('click', addCue);
    $('#addBottomBtn').addEventListener('click', addCue);
    $('#sampleBtn').addEventListener('click', loadSample);
    $('#clearBtn').addEventListener('click', clearProject);
    $('#searchInput').addEventListener('input', renderCues);
    $('#filterSelect').addEventListener('change', renderCues);
    $('#sortBtn').addEventListener('click', sortCues);
    $('#video').addEventListener('timeupdate', updateCaption);
    $('#video').addEventListener('seeked', updateCaption);
    $('#previewMode').addEventListener('change', updateCaption);
    $('#fontSize').addEventListener('input', (event) => { $('#liveCaption').style.fontSize = `${event.target.value}px`; });
    $('#validateBtn').addEventListener('click', showValidation);
    $('#validateDetailedBtn').addEventListener('click', showValidation);
    $('#shiftBtn').addEventListener('click', applyShift);
    $('#replaceBtn').addEventListener('click', replaceAllText);
    $('#cleanBtn').addEventListener('click', cleanAllText);
    $('#copyViBtn').addEventListener('click', copyAllVietnamese);
    ['offlineBackendUrl', 'offlineSourceLanguage', 'transcribeLanguage'].forEach((id) =>
      $('#' + id).addEventListener('change', () => saveSettings(false)));
    $('#saveOfflineSettingsBtn').addEventListener('click', () => saveSettings(true));
    $('#checkOfflineBtn').addEventListener('click', checkOfflineBackend);
    $('#translateMissingBtn').addEventListener('click', () => translateCues(false));
    $('#translateAllBtn').addEventListener('click', () => translateCues(true));
    $('#stopTranslateBtn').addEventListener('click', () => {
      if (apiController) { apiController.abort(); setTranslateLog('Đang yêu cầu dừng…'); }
    });
    $('#transcribeBtn').addEventListener('click', transcribeVideo);
    $('#burnVideoBtn').addEventListener('click', burnVideo);
    $$('.tab').forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

    $('#cueList').addEventListener('focusin', (event) => {
      const input = event.target.closest('[data-field][data-id]');
      if (input && !input.dataset.historyAdded) { checkpoint(); input.dataset.historyAdded = '1'; }
    });
    $('#cueList').addEventListener('focusout', (event) => {
      const input = event.target.closest('[data-field][data-id]');
      if (input) delete input.dataset.historyAdded;
    });
    $('#cueList').addEventListener('input', (event) => {
      const element = event.target;
      if (!element.matches('textarea[data-field][data-id]')) return;
      const cue = cues.find((item) => item.id === element.dataset.id);
      if (!cue) return;
      cue[element.dataset.field] = element.value;
      const badge = $('.cue-badge', element.closest('.cue'));
      if (badge) { const translated = !!cue.vi.trim(); badge.classList.toggle('done', translated); badge.textContent = translated ? 'ĐÃ DỊCH' : 'CHƯA DỊCH'; }
      updateStats(); updateCaption(); queueSave();
    });
    $('#cueList').addEventListener('change', (event) => {
      const element = event.target;
      if (element.matches('input[data-field="start"], input[data-field="end"]')) handleTimeChange(element);
    });
    $('#cueList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const cue = cues.find((item) => item.id === button.dataset.id);
      if (!cue) return;
      if (button.dataset.action === 'seek') seekCue(cue.id);
      if (button.dataset.action === 'delete-cue') {
        checkpoint(); cues = cues.filter((item) => item.id !== cue.id);
        if (activeCueId === cue.id) activeCueId = cues[0]?.id || null;
        renderCues(); updateStats(); queueSave();
        notify('Đã xóa dòng phụ đề.', 'good');
      }
    });

    document.addEventListener('keydown', (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      else if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); exportSubtitle('srt'); }
    });
    window.addEventListener('beforeunload', () => {
      if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
      if (saveTimer) { window.clearTimeout(saveTimer); saveDraft(); }
    });
  }

  function init() {
    applySettings();
    if (!isLoopbackHostname(location.hostname) && !settings.backendUrl) {
      setTranslateLog('Website đang chạy trên tên miền công khai. URL localhost cũ đã được xóa vì nó trỏ tới máy tính của bạn. Hãy triển khai backend Vietsub và nhập URL HTTPS công khai rồi bấm Kiểm tra bộ máy.', 'bad');
    }
    const restored = loadDraft();
    renderCues(); updateStats(); bindEvents(); updateHistoryButtons(); updateCaption();
    if (restored) { setSaveStatus('NHÁP ĐÃ KHÔI PHỤC'); notify('Đã khôi phục nháp cục bộ từ lần trước.', 'good'); }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
  }

  init();
})();
