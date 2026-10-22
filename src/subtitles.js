(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HendySubtitles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MIN_CUE_MS = 100;
  const id = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  function parseTimestamp(value) {
    const input = String(value ?? '').trim().replace(',', '.');
    let match = input.match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (!match) return NaN;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const fraction = Number(String(match[4] || '').padEnd(3, '0') || 0);
    if (minutes > 59 || seconds > 59) return NaN;
    return ((hours * 3600 + minutes * 60 + seconds) * 1000) + fraction;
  }

  function formatTimestamp(milliseconds, separator = ',') {
    const ms = Math.max(0, Math.round(Number(milliseconds) || 0));
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${separator}${String(millis).padStart(3, '0')}`;
  }

  function createCue(start, end, original = '', vi = '') {
    const cueStart = Math.max(0, Math.round(Number(start) || 0));
    const cueEnd = Math.max(cueStart + MIN_CUE_MS, Math.round(Number(end) || cueStart + 2000));
    return { id: id(), start: cueStart, end: cueEnd, original: String(original ?? ''), vi: String(vi ?? '') };
  }

  function parseSubtitleText(text) {
    const cleaned = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    if (!cleaned) return [];
    const blocks = cleaned.replace(/^WEBVTT[^\n]*(?:\n|$)/i, '').split(/\n\s*\n+/);
    const parsed = [];
    for (const rawBlock of blocks) {
      const block = rawBlock.trim();
      if (!block || /^(NOTE|STYLE|REGION)(?:\s|$)/i.test(block)) continue;
      const lines = block.split('\n');
      const timeIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeIndex < 0) continue;
      const times = lines[timeIndex].match(/^\s*([^\s]+)\s*-->\s*([^\s]+)(?:\s+.*)?$/);
      if (!times) continue;
      const start = parseTimestamp(times[1]);
      const end = parseTimestamp(times[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const body = lines.slice(timeIndex + 1).filter((line) => !/^\s*(?:NOTE|STYLE|REGION)\b/i.test(line)).join('\n').trim();
      if (!body) continue;
      parsed.push(createCue(start, end, body, ''));
    }
    return parsed.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function normalizeCues(value) {
    if (!Array.isArray(value)) throw new TypeError('Dự án phải chứa mảng cues.');
    return value.map((cue, index) => {
      if (!cue || typeof cue !== 'object') throw new TypeError(`Dòng ${index + 1} không hợp lệ.`);
      const start = Number(cue.start);
      const end = Number(cue.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
        throw new TypeError(`Mốc thời gian ở dòng ${index + 1} không hợp lệ.`);
      }
      return {
        id: String(cue.id || id()),
        start: Math.round(start),
        end: Math.round(end),
        original: String(cue.original ?? cue.source ?? ''),
        vi: String(cue.vi ?? cue.vietsub ?? cue.translation ?? '')
      };
    });
  }

  function exportText(cue, mode = 'vi') {
    if (mode === 'original' || mode === 'src') return cue.original;
    if (mode === 'bi' || mode === 'bilingual') return [cue.vi.trim(), cue.original.trim()].filter(Boolean).join('\n');
    return cue.vi;
  }

  function buildSrt(cues, mode = 'vi') {
    if (!cues.length) return '';
    return `${cues.map((cue, index) => `${index + 1}\n${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${exportText(cue, mode)}`).join('\n\n')}\n`;
  }

  function buildVtt(cues, mode = 'vi') {
    const body = cues.map((cue) => `${formatTimestamp(cue.start, '.')} --> ${formatTimestamp(cue.end, '.')}\n${exportText(cue, mode)}`).join('\n\n');
    return `WEBVTT\n\n${body}${body ? '\n' : ''}`;
  }

  function validateTimeline(cues) {
    const issues = [];
    const lastByTime = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
    cues.forEach((cue, index) => {
      if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start) {
        issues.push({ id: cue.id, index: index + 1, message: `Dòng ${index + 1}: mốc thời gian không hợp lệ.` });
      }
      if (!String(cue.original || '').trim()) issues.push({ id: cue.id, index: index + 1, message: `Dòng ${index + 1}: lời gốc đang trống.` });
      if (!String(cue.vi || '').trim()) issues.push({ id: cue.id, index: index + 1, message: `Dòng ${index + 1}: chưa có bản dịch.` });
      if (index > 0 && cue.start < cues[index - 1].start) {
        issues.push({ id: cue.id, index: index + 1, message: `Dòng ${index + 1}: không được sắp xếp theo thời gian.` });
      }
    });
    let furthestEndingCue = null;
    for (const current of lastByTime) {
      if (furthestEndingCue && current.start < furthestEndingCue.end) {
        const index = cues.findIndex((cue) => cue.id === current.id) + 1;
        issues.push({ id: current.id, index, message: `Dòng ${index}: chồng thời gian với một dòng khác trên timeline.` });
      }
      if (!furthestEndingCue || current.end > furthestEndingCue.end) furthestEndingCue = current;
    }
    return issues;
  }

  function shiftTimeline(cues, deltaMs) {
    const delta = Number(deltaMs);
    if (!Number.isFinite(delta)) throw new TypeError('Khoảng dịch thời gian phải là số.');
    return cues.map((cue) => {
      const duration = Math.max(MIN_CUE_MS, cue.end - cue.start);
      const start = Math.max(0, Math.round(cue.start + delta));
      return { ...cue, start, end: Math.max(start + MIN_CUE_MS, Math.round(start + duration)) };
    });
  }

  function replaceText(cues, find, replacement, options = {}) {
    if (!String(find ?? '')) throw new TypeError('Cần nhập nội dung tìm kiếm.');
    const source = options.original !== false;
    const translated = options.vi !== false;
    let replacements = 0;
    const next = cues.map((cue) => {
      const clone = { ...cue };
      for (const field of ['original', 'vi']) {
        if ((field === 'original' && !source) || (field === 'vi' && !translated)) continue;
        const before = clone[field];
        const after = before.split(String(find)).join(String(replacement ?? ''));
        if (before !== after) replacements += 1;
        clone[field] = after;
      }
      return clone;
    });
    return { cues: next, replacements };
  }

  function cleanText(cues) {
    return cues.map((cue) => ({
      ...cue,
      original: cue.original.split('\n').map((line) => line.replace(/[\t ]+/g, ' ').trim()).join('\n').trim(),
      vi: cue.vi.split('\n').map((line) => line.replace(/[\t ]+/g, ' ').trim()).join('\n').trim()
    }));
  }

  return {
    MIN_CUE_MS,
    parseTimestamp,
    formatTimestamp,
    createCue,
    parseSubtitleText,
    normalizeCues,
    buildSrt,
    buildVtt,
    validateTimeline,
    shiftTimeline,
    replaceText,
    cleanText
  };
});
