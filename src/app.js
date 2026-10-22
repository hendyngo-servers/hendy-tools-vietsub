(function () {
  'use strict';
  const Core = window.HendySubtitles;
  if (!Core) throw new Error('Không tải được mô-đun phụ đề.');
  
  const $ = (selector, scope = document) => scope.querySelector(selector); const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const DRAFT_KEY = 'hendy_vietsub_draft_v2_1';
  const SETTINGS_KEY = 'hendy_vietsub_settings_v2_1';
  
  let cues = [], undoStack = [], redoStack = [];
  let activeCueId = null;
  let currentVideoUrl = '', currentVideoFile = null;
  let saveTimer = null, toastTimer = null;
  let apiController = null, isTranslating = false;
  let settings = loadSettings();

  function defaultBackendUrl() {
    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (isLocal && location.port === '8080') return location.origin;
    if (isLocal) return 'http://localhost:10000';
    return '';
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return {
        backendUrl: saved.backendUrl || saved.endpoint || defaultBackendUrl(),
        sourceLanguage: saved.sourceLanguage || 'auto',
        transcriptionLanguage: saved.transcriptionLanguage || 'auto'
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (showToast) notify('Đã lưu cấu hình.', 'good');
  }

  function notify(message, kind = 'good') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: '2.1.0', savedAt: new Date().toISOString(), cues }));
      $('#saveStatus').textContent = '● ĐÃ LƯU';
    }, 500);
    $('#saveStatus').textContent = '● ĐANG LƯU...';
  }

  function snapshot() { return JSON.stringify(cues); }
  function checkpoint() {
    undoStack.push(snapshot());
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  }

  function restoreSnapshot(value) {
    cues = Core.normalizeCues(JSON.parse(value));
    renderCues(); updateStats(); queueSave();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restoreSnapshot(undoStack.pop());
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restoreSnapshot(redoStack.pop());
  }

  function formatDuration(ms) {
    const s = Math.floor(Math.max(0, ms || 0) / 1000);
    const m = Math.floor((s % 3600) / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  function updateStats() {
    const translated = cues.filter(c => c.vi.trim()).length;
    $('#statCount').textContent = cues.length;
    $('#statTranslated').textContent = cues.length ? Math.round((translated / cues.length) * 100) + '%' : '0%';
    $('#progressBar').style.width = $('#statTranslated').textContent;
    $('#statDuration').textContent = formatDuration(cues.reduce((m, c) => Math.max(m, c.end || 0), 0));
  }

  // TỐI ƯU RENDER: Sử dụng DocumentFragment để tránh Reflow liên tục
  function renderCues() {
    const list = $('#cueList');
    const query = $('#searchInput').value.trim().toLowerCase();
    const filter = $('#filterSelect').value;
    
    const filtered = cues.filter(c => {
      if (filter === 'missing' && c.vi.trim()) return false;
      if (filter === 'translated' && !c.vi.trim()) return false;
      if (query && !`${c.original}\n${c.vi}`.toLowerCase().includes(query)) return false;
      return true;
    });

    list.innerHTML = '';
    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><h3>Trống</h3><p>Không có dữ liệu hiển thị.</p></div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((cue, index) => {
      const card = document.createElement('article');
      card.className = `cue ${cue.id === activeCueId ? 'active' : ''}`;
      card.dataset.cueId = cue.id;
      
      card.innerHTML = `
        <div class="cue-head">
          <div class="cue-title">
            <span class="cue-number">DÒNG ${index + 1}</span>
            <span class="cue-badge ${cue.vi.trim() ? 'done' : ''}">${cue.vi.trim() ? 'ĐÃ DỊCH' : 'CHƯA DỊCH'}</span>
          </div>
          <div class="cue-actions">
            <button class="mini-btn" data-action="seek" data-id="${cue.id}">▶</button>
            <button class="mini-btn delete" data-action="delete" data-id="${cue.id}">×</button>
          </div>
        </div>
        <div class="cue-times">
          <label>Bắt đầu <input type="text" value="${Core.formatTimestamp(cue.start)}" data-field="start" data-id="${cue.id}"></label>
          <span class="arrow">→</span>
          <label>Kết thúc <input type="text" value="${Core.formatTimestamp(cue.end)}" data-field="end" data-id="${cue.id}"></label>
        </div>
        <div class="cue-fields">
          <div class="cue-field-wrap">
            <label>LỜI GỐC</label>
            <textarea class="cue-field" data-field="original" data-id="${cue.id}">${cue.original}</textarea>
          </div>
          <div class="cue-field-wrap">
            <label>VIETSUB</label>
            <textarea class="cue-field vi" data-field="vi" data-id="${cue.id}" placeholder="Nhập bản dịch...">${cue.vi}</textarea>
          </div>
        </div>
      `;
      fragment.appendChild(card);
    });
    
    list.appendChild(fragment);
  }

  function seekCue(id) {
    const cue = cues.find(c => c.id === id);
    if (!cue) return;
    activeCueId = cue.id;
    const video = $('#video');
    if (video.src) { video.currentTime = cue.start / 1000; video.play().catch(()=>{}); }
    renderCues();
  }

  async function translateCues(all = false) {
    if (isTranslating || !cues.length) return;
    
    const targets = cues.filter(c => c.original.trim() && (all || !c.vi.trim()));
    if (!targets.length) { notify('Tất cả đã được dịch.', 'good'); return; }
    
    checkpoint();
    isTranslating = true;
    apiController = new AbortController();
    let completed = 0;
    
    try {
      for (let i = 0; i < targets.length; i += 20) {
        const batch = targets.slice(i, i + 20);
        const res = await fetch(`${settings.backendUrl}/api/translate-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: batch.map(c => c.original), source: settings.sourceLanguage, target: 'vi' }),
          signal: apiController.signal
        });
        const data = await res.json();
        
        batch.forEach((c, idx) => c.vi = String(data.translations[idx] || '').trim());
        completed += batch.length;
        $('#apiProgress').style.width = Math.round((completed / targets.length) * 100) + '%';
        renderCues(); queueSave();
      }
      notify('Dịch hoàn tất.', 'good');
    } catch (e) {
      if (e.name !== 'AbortError') notify('Lỗi dịch: ' + e.message, 'bad');
    } finally {
      isTranslating = false;
      updateStats();
    }
  }

  // TỐI ƯU COPY: Dùng API hiện đại
  async function copyAllVietnamese() {
    const text = cues.map(c => c.vi).join('\n').trim();
    if (!text) return notify('Không có dữ liệu.', 'warn');
    try {
      await navigator.clipboard.writeText(text);
      notify('Đã copy.', 'good');
    } catch (e) {
      notify('Không thể copy tự động.', 'bad');
    }
  }

  function bindEvents() {
    $('#saveOfflineSettingsBtn').addEventListener('click', saveSettings);
    $('#translateMissingBtn').addEventListener('click', () => translateCues(false));
    $('#copyViBtn').addEventListener('click', copyAllVietnamese);
    
    $('#cueList').addEventListener('input', e => {
      if (e.target.tagName !== 'TEXTAREA') return;
      const cue = cues.find(c => c.id === e.target.dataset.id);
      if (cue) { cue[e.target.dataset.field] = e.target.value; queueSave(); updateStats(); }
    });

    $('#cueList').addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'seek') seekCue(btn.dataset.id);
      if (btn.dataset.action === 'delete') {
        checkpoint();
        cues = cues.filter(c => c.id !== btn.dataset.id);
        renderCues(); updateStats(); queueSave();
      }
    });

    // Thêm các sự kiện Import/Export/Video tương tự gốc ở đây (giữ nguyên logic gốc)...
  }

  function init() {
    $('#offlineBackendUrl').value = settings.backendUrl;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) cues = Core.normalizeCues(JSON.parse(raw).cues || []);
    renderCues(); updateStats(); bindEvents();
  }

  init();
})();
