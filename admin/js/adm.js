/* Ruh admin prototype runtime
   Renders the admin design boards as live pages, links them together and provides
   two dummy sign-ins (owner and staff). Browser-only demo: nothing is sent anywhere. */
(function () {
  'use strict';

  /* ---------- demo accounts ---------- */
  var ACCOUNTS = [
    { key: 'owner', mobile: '1001112222', password: 'owner@1234', name: 'Ruh owner', role: 'owner', home: 'dashboard.html' },
    { key: 'staff', mobile: '1003334444', password: 'staff@1234', name: 'Salma K.', role: 'staff', home: 'bookings.html' }
  ];
  var KEY = 'ruh-admin-demo';
  var mem = null;
  function digits(p) { var d = String(p || '').replace(/\D/g, ''); return d.slice(-10); }
  var Auth = {
    accounts: ACCOUNTS,
    get: function () { try { var v = localStorage.getItem(KEY); return v ? JSON.parse(v) : mem; } catch (e) { return mem; } },
    set: function (a) { var u = { key: a.key, name: a.name, role: a.role, home: a.home }; mem = u; try { localStorage.setItem(KEY, JSON.stringify(u)); } catch (e) {} return u; },
    signIn: function (mobile, pw) {
      var d = digits(mobile);
      for (var i = 0; i < ACCOUNTS.length; i++) if (ACCOUNTS[i].mobile === d && ACCOUNTS[i].password === pw) return Auth.set(ACCOUNTS[i]);
      return null;
    },
    switchTo: function (key) { for (var i = 0; i < ACCOUNTS.length; i++) if (ACCOUNTS[i].key === key) return Auth.set(ACCOUNTS[i]); return null; },
    signOut: function () { mem = null; try { localStorage.removeItem(KEY); } catch (e) {} }
  };
  window.AdmAuth = Auth;
  window.ADMU = function () { var u = Auth.get(); return u ? u.name : 'Salma K.'; };

  /* ---------- routes ---------- */
  var R = {
    AdminSignIn: 'index.html', AdminDashA: 'dashboard.html', AdminDashB: 'dashboard.html',
    AdminBookings: 'bookings.html', AdminAddBooking: 'add-booking.html', AdminBookings2: 'bookings.html', AdminAddBooking2: 'add-booking.html',
    AdminEvents: 'events.html', AdminHome: 'ruh-at-home.html', AdminAddFreezer: 'add-freezer-item.html',
    AdminCheckins: 'check-ins.html', AdminCircle: 'ruh-circle.html', AdminAddMember: 'add-member.html',
    AdminMenu: 'menu.html', AdminAddDish: 'add-dish.html', AdminMedia: 'dish-photos.html',
    AdminProgramme: 'events-programme.html', AdminAddEvent: 'add-event.html',
    AdminTeam: 'team.html', AdminAddTeam: 'add-team-member.html', AdminSettings: 'settings.html'
  };
  var CFG = window.ADM_PAGE || {};
  var HERE = (location.pathname.split('/').pop() || 'index.html');

  function fixLinks(root) {
    root.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '';
      var m = /^([A-Za-z0-9]+)\.dc\.html(.*)$/.exec(h);
      if (m && R[m[1]]) a.setAttribute('href', R[m[1]] + m[2]);
    });
  }

  /* ---------- tiny template renderer ---------- */
  var BOOL = { disabled: 1, checked: 1, selected: 1, hidden: 1, required: 1, readonly: 1 };
  function get(scope, expr) { return expr.trim().split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, scope); }
  var EXP = /\{\{([^}]+)\}\}/g;
  function interp(str, scope) {
    return str.replace(EXP, function (m, e) { var v = get(scope, e); return typeof v === 'function' ? '' : (v == null ? '' : String(v)); });
  }
  function build(src, scope, handlers) {
    var frag = document.createDocumentFragment();
    src.childNodes.forEach(function (ch) {
      if (ch.nodeType === 3) { frag.appendChild(document.createTextNode(interp(ch.textContent, scope))); return; }
      if (ch.nodeType !== 1) return;
      var tag = ch.tagName;
      if (tag === 'SC-FOR') {
        var list = get(scope, (ch.getAttribute('list') || '').replace(/[{}]/g, '')) || [];
        var as = ch.getAttribute('as') || 'item';
        list.forEach(function (it, i) { var s = Object.create(scope); s[as] = it; s.$index = i; frag.appendChild(build(ch, s, handlers)); });
        return;
      }
      if (tag === 'SC-IF') { if (get(scope, (ch.getAttribute('value') || '').replace(/[{}]/g, ''))) frag.appendChild(build(ch, scope, handlers)); return; }
      if (tag === 'HELMET') return;
      var el = document.createElementNS(ch.namespaceURI, ch.localName);
      for (var i = 0; i < ch.attributes.length; i++) {
        var a = ch.attributes[i], name = a.name, val = a.value;
        if (/^on[a-z]+$/i.test(name) && /^\s*\{\{[^}]+\}\}\s*$/.test(val)) {
          var fn = get(scope, val.replace(/[{}\s]/g, ''));
          if (typeof fn === 'function') {
            var ev = name.slice(2).toLowerCase();
            if (ev === 'change' && (tag === 'INPUT' || tag === 'TEXTAREA') && ch.getAttribute('type') !== 'checkbox') ev = 'input';
            handlers.push(fn);
            el.setAttribute('data-on-' + ev, String(handlers.length - 1));
          }
          continue;
        }
        if (name.indexOf('hint-') === 0) continue;
        var out = val.indexOf('{{') > -1 ? interp(val, scope) : val;
        if (BOOL[name] && (out === 'false' || out === '' || out === 'undefined' || out === 'null' || out === '0')) continue;
        el.setAttribute(name, out);
      }
      if (tag === 'TEXTAREA') { el.textContent = interp(ch.textContent, scope); el.setAttribute('value', el.textContent); }
      else if (tag === 'SCRIPT' || tag === 'STYLE') el.textContent = interp(ch.textContent, scope);
      else el.appendChild(build(ch, scope, handlers));
      frag.appendChild(el);
    });
    return frag;
  }

  function morph(oldP, newP) {
    var o = oldP.firstChild, n = newP.firstChild;
    while (n) {
      var next = n.nextSibling;
      if (!o) { oldP.appendChild(n); n = next; continue; }
      if (o.nodeType !== n.nodeType || (o.nodeType === 1 && o.tagName !== n.tagName)) { oldP.insertBefore(n, o); n = next; continue; }
      if (o.nodeType === 3) { if (o.textContent !== n.textContent) o.textContent = n.textContent; }
      else if (o.nodeType === 1) {
        var i, a;
        for (i = o.attributes.length - 1; i >= 0; i--) { a = o.attributes[i].name; if (!n.hasAttribute(a)) o.removeAttribute(a); }
        for (i = 0; i < n.attributes.length; i++) { a = n.attributes[i]; if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value); }
        if ((o.tagName === 'INPUT' || o.tagName === 'TEXTAREA') && o.type !== 'checkbox' && o.type !== 'radio' && n.hasAttribute('value')) {
          var nv = n.getAttribute('value') || '';
          if (o.value !== nv) {
            if (o === document.activeElement) {
              var pos = 0; try { pos = Math.max(0, (o.selectionStart || 0) - (o.value.length - nv.length)); } catch (e) {}
              o.value = nv; try { o.setSelectionRange(pos, pos); } catch (e) {}
            } else o.value = nv;
          }
        }
        if (o.tagName !== 'TEXTAREA') morph(o, n);
      }
      o = o.nextSibling; n = next;
    }
    while (o) { var x = o.nextSibling; oldP.removeChild(o); o = x; }
  }

  function mount(app, key, live) {
    var tpl = document.getElementById('tpl-' + key);
    var js = document.getElementById('js-' + key);
    var src = tpl.content.querySelector('x-dc') || tpl.content;
    var helm = src.querySelector('helmet');
    if (helm) {
      var h = document.createElement('div'); h.innerHTML = helm.innerHTML;
      [].slice.call(h.childNodes).forEach(function (c) { if (c.nodeType === 1) document.head.appendChild(c); });
      helm.parentNode.removeChild(helm);
    }
    var aside = src.querySelector('aside');
    var u = Auth.get();
    if (aside && CFG.sidebars && u && CFG.sidebars[u.role]) {
      var t = document.createElement('template'); t.innerHTML = CFG.sidebars[u.role].trim();
      aside.parentNode.replaceChild(t.content.firstChild, aside);
    }
    function DCLogic(props) { this.props = props || {}; this.state = {}; }
    var ready = false;
    DCLogic.prototype.setState = function (p) {
      if (typeof p === 'function') p = p(this.state);
      Object.assign(this.state, p || {});
      if (ready) render();
    };
    var C = js ? new Function('DCLogic', js.textContent + '\n;return Component;')(DCLogic) : null;
    var inst = C ? new C({}) : null;
    function render() {
      var handlers = [];
      var vals = inst ? inst.renderVals() : {};
      var wrap = document.createElement('div'); wrap.appendChild(build(src, vals, handlers));
      morph(app, wrap);
      app.__h = handlers;
      fixLinks(app);
      if (!live) app.querySelectorAll('a,button,input,textarea').forEach(function (x) { x.setAttribute('tabindex', '-1'); });
    }
    ready = true;
    render();
    if (inst && typeof inst.componentDidMount === 'function') inst.componentDidMount();
    return inst;
  }

  function delegate(app) {
    ['click', 'input', 'change', 'submit'].forEach(function (type) {
      app.addEventListener(type, function (e) {
        var el = e.target.closest && e.target.closest('[data-on-' + type + ']');
        if (!el || !app.contains(el)) return;
        var fn = (app.__h || [])[+el.getAttribute('data-on-' + type)];
        if (typeof fn === 'function') {
          if (type === 'click' && el.tagName === 'A' && (el.getAttribute('href') || '#') === '#') e.preventDefault();
          if (type === 'submit') e.preventDefault();
          fn(e);
        }
      });
    });
    app.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href="#"]');
      if (a && !a.hasAttribute('data-on-click')) { e.preventDefault(); toast('Demo only: this link opens in the live admin.'); }
    });
  }

  function toast(msg) {
    var t = document.getElementById('adm-toast');
    if (!t) { t = document.createElement('div'); t.id = 'adm-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t.__t); t.__t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  window.AdmToast = toast;

  function chromeCSS() {
    var s = document.createElement('style');
    s.textContent =
      '#adm-demo{position:fixed;right:14px;bottom:14px;z-index:900;display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:rgba(31,46,36,.95);color:#FFF8EE;font:600 12px Figtree,sans-serif;padding:9px 14px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25)}' +
      '#adm-demo button{background:none;border:0;color:#F2B9A6;font:700 12px Figtree,sans-serif;cursor:pointer;padding:4px 0}' +
      '#adm-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);opacity:0;z-index:1000;background:#1F2E24;color:#FFF8EE;font:600 14px Figtree,sans-serif;padding:12px 18px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,.25);transition:all .25s;pointer-events:none}' +
      '#adm-toast.on{opacity:1;transform:translate(-50%,0)}' +
      '.sub{display:flex;align-items:center;gap:8px;min-height:36px;padding:0 14px 0 46px;border-radius:10px;color:#C9D3CB!important;text-decoration:none!important;font-size:14px;font-weight:500}.sub:hover{color:#FFF8EE!important}.sub.on{color:#FFF8EE!important;font-weight:700;background:rgba(235,216,203,.1)}' +
      '#app{overflow-x:clip}#app fieldset{min-width:0}' +
      '#bg{pointer-events:none;user-select:none}' +
      'body.adm-modal #app{position:fixed;inset:0;z-index:50;overflow:auto}' +
      'body.adm-modal #app > div{min-height:0!important;display:block!important;background:none!important}' +
      'body.adm-modal #app > div > aside,body.adm-modal #app > div > main{display:none!important}' +
      'body.adm-modal #app .ov{position:relative!important;inset:auto!important;min-height:100vh;background:rgba(20,30,24,.58)}' +
      '@media (max-width:760px){#app main{padding:22px 16px 80px!important}#app aside{max-width:none!important}}';
    document.head.appendChild(s);
  }

  function demoBadge() {
    var u = Auth.get(); if (!u) return;
    var other = u.role === 'owner' ? 'staff' : 'owner';
    var b = document.createElement('div'); b.id = 'adm-demo';
    b.innerHTML = '<span>Signed in as ' + u.name + ' (' + (u.role === 'owner' ? 'owner' : 'staff') + ' demo)</span>' +
      '<button type="button" data-sw>Switch to ' + other + ' view</button><button type="button" data-so>Sign out</button>';
    b.querySelector('[data-sw]').addEventListener('click', function () { var n = Auth.switchTo(other); location.href = (CFG.owner && n.role !== 'owner') ? n.home : (HERE === 'dashboard.html' && n.role !== 'owner' ? n.home : HERE); });
    b.querySelector('[data-so]').addEventListener('click', function () { Auth.signOut(); location.href = 'index.html'; });
    document.body.appendChild(b);
  }

  function boot() {
    chromeCSS();
    var u = Auth.get();
    if (!CFG.public && !u) { location.replace('index.html?next=' + encodeURIComponent(HERE)); return; }
    if (CFG.owner && u && u.role !== 'owner') { location.replace(u.home + '?denied=1'); return; }
    if (/denied=1/.test(location.search)) setTimeout(function () { toast('That page is for the owner. Staff see Bookings, Events, Ruh at Home and Check-ins.'); }, 300);
    if (CFG.under) {
      var bg = document.getElementById('bg');
      bg.setAttribute('aria-hidden', 'true'); bg.setAttribute('inert', '');
      mount(bg, CFG.under, false);
      document.body.classList.add('adm-modal');
    }
    var app = document.getElementById('app');
    delegate(app);
    mount(app, CFG.view, true);
    if (CFG.under) document.addEventListener('keydown', function (e) { if (e.key === 'Escape') location.href = R[CFG.under]; });
    if (!CFG.public) demoBadge();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
