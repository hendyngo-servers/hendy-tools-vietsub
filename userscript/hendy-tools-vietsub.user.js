// ==UserScript==
// @name         Hendy Tools Vietsub v2.0
// @namespace    https://hendyngo-servers.github.io/hendy-tools-vietsub/
// @version      2.0.0
// @description  Nút mở nhanh trang Hendy Tools Vietsub Studio.
// @match        http://*/*
// @match        https://*/*
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==
(function(){'use strict';if(window.top!==window.self||document.getElementById('hendy-vietsub-launcher'))return;var b=document.createElement('button');b.id='hendy-vietsub-launcher';b.textContent='HENDY VIETSUB';b.title='Mở Hendy Tools Vietsub';Object.assign(b.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',padding:'11px 15px',border:'1px solid #5eead4',borderRadius:'12px',background:'#101a28',color:'#5eead4',font:'700 12px system-ui',cursor:'pointer',boxShadow:'0 8px 28px #0007'});b.onclick=function(){var url='https://github.com/hendyngo-servers/hendy-tools-vietsub';if(typeof GM_openInTab==='function')GM_openInTab(url,{active:true,insert:true});else window.open(url,'_blank','noopener,noreferrer')};document.documentElement.appendChild(b)})();