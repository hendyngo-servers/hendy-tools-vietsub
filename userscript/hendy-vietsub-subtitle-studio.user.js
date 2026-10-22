// ==UserScript==
// @name         Hendy VietSub Offline Studio v2.2
// @namespace    https://github.com/hendyngo-servers
// @version      2.2.0
// @description  Mở Hendy VietSub Studio với bộ dịch offline, Whisper và FFmpeg; không cần API key dịch thuật.
// @match        http://*/*
// @match        https://*/*
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';
  if (window.top !== window.self || document.getElementById('hendy-vietsub-offline-launcher')) return;

  const appUrl = 'https://hendyngo-servers.github.io/hendy-tools-vietsub/';
  const button = document.createElement('button');
  button.id = 'hendy-vietsub-offline-launcher';
  button.type = 'button';
  button.textContent = '🎬 HENDY VIETSUB OFFLINE';
  button.title = 'Mở Hendy VietSub Studio — dịch offline, nhận dạng lời thoại và xuất MP4';
  button.setAttribute('aria-label', 'Mở Hendy VietSub Offline Studio');
  Object.assign(button.style, {
    position: 'fixed',
    right: '18px',
    bottom: '18px',
    zIndex: '2147483647',
    padding: '11px 15px',
    border: '1px solid #5eead4',
    borderRadius: '12px',
    background: 'linear-gradient(135deg,#082f49,#312e81)',
    color: '#e6fffb',
    font: '800 12px system-ui,sans-serif',
    cursor: 'pointer',
    boxShadow: '0 8px 28px #0007'
  });
  button.addEventListener('click', () => {
    if (typeof GM_openInTab === 'function') GM_openInTab(appUrl, { active: true, insert: true });
    else window.open(appUrl, '_blank', 'noopener,noreferrer');
  });
  document.documentElement.appendChild(button);
})();
