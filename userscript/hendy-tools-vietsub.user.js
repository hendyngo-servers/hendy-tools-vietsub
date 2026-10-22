// ==UserScript==
// @name         Hendy Tools Vietsub Offline Launcher
// @namespace    https://github.com/hendyngo-servers/hendy-tools-vietsub
// @version      2.2.2
// @description  Nút mở nhanh bộ biên tập Vietsub offline: dịch bằng mô hình tích hợp, Whisper và FFmpeg.
// @match        http://*/*
// @match        https://*/*
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';
  if (window.top !== window.self || document.getElementById('hendy-vietsub-launcher')) return;
  const appUrl = 'https://hendyngo-servers.github.io/hendy-tools-vietsub/';
  const button = document.createElement('button');
  button.id = 'hendy-vietsub-launcher';
  button.type = 'button';
  button.textContent = '🎬 HENDY VIETSUB OFFLINE';
  button.title = 'Mở bộ công cụ Vietsub offline tích hợp, không cần API key';
  Object.assign(button.style, {
    position: 'fixed', right: '18px', bottom: '18px', zIndex: '2147483647',
    padding: '11px 15px', border: '1px solid #5eead4', borderRadius: '12px',
    background: 'linear-gradient(135deg,#082f49,#312e81)', color: '#e6fffb',
    font: '800 12px system-ui,sans-serif', cursor: 'pointer',
    boxShadow: '0 8px 28px #0007'
  });
  button.addEventListener('click', () => {
    if (typeof GM_openInTab === 'function') GM_openInTab(appUrl, { active: true, insert: true });
    else window.open(appUrl, '_blank', 'noopener,noreferrer');
  });
  document.documentElement.appendChild(button);
})();
