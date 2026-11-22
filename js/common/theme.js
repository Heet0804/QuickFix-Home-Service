/* ===== QuickFix — Theme (Light / Dark / System) =====
   Plain classic script, same global-variable architecture as the other
   js/common/*.js files. Load it in <head> (NOT at the bottom of <body>)
   so the saved theme is applied before first paint — no light flash.

   Three choices, saved in localStorage under 'qf_theme':
     'light'  / 'dark'  = the person picked one
     'system' (default) = follow the phone / computer setting, live
   Old saved values ('light' / 'dark') keep working unchanged.

   The page always gets <html data-theme="light|dark"> (what the CSS uses)
   and <html data-theme-pref="light|dark|system"> (what the person chose).

   The existing <button class="theme-toggle"> elements are reused: this
   script turns each one into a small menu button, so the HTML does not
   need to change. */
(function(){
  'use strict';
  var KEY    = 'qf_theme';
  var ORDER  = ['light', 'dark', 'system'];
  var LABEL  = { light: 'Light', dark: 'Dark', system: 'System' };
  var ICON   = { light: '☀️', dark: '🌙', system: '🌗' };
  var COLORS = { light: '#faf8f3', dark: '#14100b' };   /* browser bar colour */

  var mq = null;
  try { mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null; } catch(e){}

  var pref = 'system';
  var menu = null, openBtn = null, fadeTimer = null;

  function readPref(){
    try {
      var v = localStorage.getItem(KEY);
      return (v === 'light' || v === 'dark' || v === 'system') ? v : 'system';
    } catch(e){ return 'system'; }
  }
  function resolve(p){ return p === 'system' ? (mq && mq.matches ? 'dark' : 'light') : p; }

  function setMeta(t){
    if(!document.head) return;
    var m = document.querySelector('meta[name="theme-color"]');
    if(!m){ m = document.createElement('meta'); m.setAttribute('name', 'theme-color'); document.head.appendChild(m); }
    m.setAttribute('content', COLORS[t]);
  }

  function paintButtons(){
    var t = resolve(pref);
    var label = 'Theme: ' + LABEL[pref] + (pref === 'system' ? ' (currently ' + t + ')' : '') + '. Change theme';
    var btns = document.querySelectorAll('.theme-toggle');
    for(var i = 0; i < btns.length; i++){
      btns[i].textContent = ICON[pref];
      btns[i].setAttribute('aria-label', label);
      btns[i].title = label;
    }
  }

  function paintMenu(){
    if(!menu) return;
    var items = menu.querySelectorAll('.qf-theme-item');
    for(var i = 0; i < items.length; i++){
      var on = items[i].getAttribute('data-pref') === pref;
      items[i].setAttribute('aria-checked', on ? 'true' : 'false');
      items[i].tabIndex = on ? 0 : -1;
    }
  }

  function apply(p, animate){
    pref = p;
    var t = resolve(p), root = document.documentElement;
    if(animate){
      root.classList.add('theme-switching');
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(function(){ root.classList.remove('theme-switching'); }, 320);
    }
    root.setAttribute('data-theme', t);
    root.setAttribute('data-theme-pref', p);
    setMeta(t);
    paintButtons();
    paintMenu();
  }

  function emit(){
    try {
      document.dispatchEvent(new CustomEvent('qf-theme-change', { detail: { preference: pref, theme: resolve(pref) } }));
    } catch(e){}
  }

  /* ---------- public API ---------- */
  window.setTheme = function(p){
    p = (p === 'light' || p === 'dark') ? p : 'system';
    try { localStorage.setItem(KEY, p); } catch(e){}
    apply(p, true);
    emit();
  };
  window.getThemePreference = function(){ return pref; };
  window.toggleTheme = function(){            /* kept for old code: cycles the 3 choices */
    window.setTheme(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]);
  };

  /* ---------- the menu ---------- */
  function buildMenu(){
    if(menu) return menu;
    menu = document.createElement('div');
    menu.className = 'qf-theme-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Choose theme');
    ORDER.forEach(function(p){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'qf-theme-item';
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('data-pref', p);
      b.innerHTML = '<span class="qf-theme-ico" aria-hidden="true">' + ICON[p] + '</span>' +
                    '<span class="qf-theme-txt">' + LABEL[p] + '</span>' +
                    '<span class="qf-theme-tick" aria-hidden="true">✓</span>';
      b.addEventListener('click', function(){ window.setTheme(p); closeMenu(true); });
      menu.appendChild(b);
    });
    menu.addEventListener('keydown', onMenuKey);
    document.body.appendChild(menu);
    paintMenu();
    return menu;
  }

  function isOpen(){ return !!(menu && menu.classList.contains('open')); }

  function openMenu(btn){
    buildMenu();
    openBtn = btn;
    menu.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    var r = btn.getBoundingClientRect();
    var w = menu.offsetWidth || 176, h = menu.offsetHeight || 150;
    var vw = window.innerWidth || 360, vh = window.innerHeight || 640;
    var left = Math.max(8, Math.min(r.right - w, vw - w - 8));
    var top  = r.bottom + 8;
    if(top + h > vh - 8) top = Math.max(8, r.top - h - 8);
    menu.style.left = left + 'px';
    menu.style.top  = top + 'px';
    var cur = menu.querySelector('.qf-theme-item[aria-checked="true"]');
    if(cur) cur.focus();
  }

  function closeMenu(returnFocus){
    if(!isOpen()) return;
    menu.classList.remove('open');
    if(openBtn){
      openBtn.setAttribute('aria-expanded', 'false');
      if(returnFocus) openBtn.focus();
    }
  }

  function onMenuKey(e){
    var items = Array.prototype.slice.call(menu.querySelectorAll('.qf-theme-item'));
    var i = items.indexOf(document.activeElement);
    if(e.key === 'Escape'){ e.preventDefault(); closeMenu(true); }
    else if(e.key === 'ArrowDown'){ e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if(e.key === 'Home'){ e.preventDefault(); items[0].focus(); }
    else if(e.key === 'End'){ e.preventDefault(); items[items.length - 1].focus(); }
    else if(e.key === 'Tab'){ closeMenu(false); }
  }

  function enhance(){
    var btns = document.querySelectorAll('.theme-toggle');
    for(var i = 0; i < btns.length; i++){
      (function(b){
        if(b.__qfTheme) return;
        b.__qfTheme = true;
        b.removeAttribute('onclick');               /* old inline handler just flipped the theme */
        b.setAttribute('aria-haspopup', 'menu');
        b.setAttribute('aria-expanded', 'false');
        b.addEventListener('click', function(e){
          e.preventDefault();
          if(isOpen() && openBtn === b) closeMenu(true); else { closeMenu(false); openMenu(b); }
        });
      })(btns[i]);
    }
    paintButtons();
  }

  /* ---------- wiring ---------- */
  apply(readPref(), false);                         /* before first paint */

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();

  if(mq){                                            /* phone switches to dark at night */
    var onSys = function(){ if(pref === 'system'){ apply('system', true); emit(); } };
    if(mq.addEventListener) mq.addEventListener('change', onSys);
    else if(mq.addListener) mq.addListener(onSys);
  }
  window.addEventListener('storage', function(e){    /* other tab changed it */
    if(e.key === KEY || e.key === null){ apply(readPref(), false); emit(); }
  });
  document.addEventListener('pointerdown', function(e){
    if(!isOpen()) return;
    if(menu.contains(e.target) || (openBtn && openBtn.contains(e.target))) return;
    closeMenu(false);
  });
  window.addEventListener('resize', function(){ closeMenu(false); });
  window.addEventListener('scroll', function(e){ if(isOpen() && !menu.contains(e.target)) closeMenu(false); }, true);
})();