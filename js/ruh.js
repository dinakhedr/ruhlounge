/* Ruh website prototype runtime
   Renders the design boards (templates + logic) as live pages, links pages together
   and provides a dummy sign-in for member-only pages. */
(function () {
  'use strict';

  /* ---------- dummy account ---------- */
  var DEMO = { phone: '+201005716027', password: 'pass@1234', name: 'Nour' };
  var KEY = 'ruh-demo-auth';
  var mem = null;
  var Auth = {
    get: function () {
      try { var v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch (e) { return mem; }
    },
    signIn: function (phone, pw) {
      var p = String(phone || '').replace(/[^\d+]/g, '');
      if (p.indexOf('+') !== 0) { p = p.replace(/^0+/, ''); p = p.indexOf('20') === 0 ? '+' + p : '+20' + p; }
      if (p !== DEMO.phone || pw !== DEMO.password) return false;
      var u = { phone: DEMO.phone, name: DEMO.name, at: Date.now() };
      mem = u;
      try { localStorage.setItem(KEY, JSON.stringify(u)); } catch (e) {}
      return true;
    },
    signOut: function () {
      mem = null;
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };
  window.RuhAuth = Auth;

  /* ---------- routes ---------- */
  var R = {
    Main: 'index.html', HomeSelected: 'index.html',
    MenuBookDesktop: 'menu.html', MenuBookMobile: 'menu.html',
    EventsPageB: 'whats-on.html', EventsPageBMobile: 'whats-on.html',
    EventBook: 'event-request.html', EventBookMobile: 'event-request.html',
    CirclePageA2: 'circle.html', CirclePageA2Mobile: 'circle.html',
    BookTable: 'book.html', BookTableMobile: 'book.html',
    BookConfirm: 'booking-received.html', BookConfirmMobile: 'booking-received.html',
    SignIn: 'sign-in.html', SignInMobile: 'sign-in.html', SignInPass: 'sign-in.html',
    Profile: 'profile.html', ProfilePending: 'profile-pending.html',
    BuildBox: 'ruh-at-home.html', BoxConfirm: 'box-received.html',
    TableQrB: 'table.html', TableQrB2: 'table.html', MemberTableQr: 'table-member.html',
    CheckInSignIn: 'sign-in.html?next=check-in.html', CheckInConfirm: 'check-in.html', CheckedIn: 'checked-in.html',
    WalkInJoin: 'walk-in.html', WalkInConfirm: 'walk-in-confirm.html', WalkInCheckedIn: 'walk-in-welcome.html',
    MemberWalkInConfirm: 'member-check-in.html', MemberWalkInCheckedIn: 'member-checked-in.html',
    LeaderboardA: 'leaderboard.html', LeaderboardA2: 'leaderboard.html'
  };
  var TEXT = [
    [/^menu$/i, 'menu.html'], [/^see the (full )?menu/i, 'menu.html'], [/^skip, just show me the menu/i, 'menu.html'],
    [/^what's on$/i, 'whats-on.html'], [/^this week at ruh/i, 'whats-on.html'], [/^see all events/i, 'whats-on.html'],
    [/^(hangouts|celebrations|workshops)$/i, 'whats-on.html'],
    [/^ruh at home$/i, 'ruh-at-home.html'], [/^take ruh home/i, 'ruh-at-home.html'], [/^build your box/i, 'ruh-at-home.html'],
    [/^ruh circle$/i, 'circle.html'], [/^join ruh circle/i, 'circle.html'],
    [/^book a table$/i, 'book.html'], [/^book$/i, 'book.html'], [/^see all bookings/i, 'profile.html'],
    [/^sign in$/i, 'sign-in.html'], [/leaderboard/i, 'leaderboard.html'],
    [/^get directions/i, 'https://maps.app.goo.gl/S6GhMiyUsmuUvEjm8']
  ];
  var CFG = window.RUH_PAGE || {};
  var HERE = (location.pathname.split('/').pop() || 'index.html');

  function mapHref(h) {
    var m = /^([A-Za-z0-9]+)\.dc\.html(.*)$/.exec(h || '');
    if (m && R[m[1]]) return R[m[1]] + m[2];
    return null;
  }
  function fixLinks(root) {
    var signed = !!Auth.get();
    root.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      var n = mapHref(h);
      if (n) a.setAttribute('href', n);
      else if (h === '#') {
        var t = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (a.getAttribute('aria-label') === 'Ruh home') { a.setAttribute('href', 'index.html'); return; }
        for (var i = 0; i < TEXT.length; i++) if (TEXT[i][0].test(t)) { a.setAttribute('href', TEXT[i][1]); if (/^https?:/.test(TEXT[i][1])) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); } break; }
      }
      var hh = a.getAttribute('href') || '';
      if (hh === 'sign-in.html' && !signed && ['index.html', 'sign-in.html', ''].indexOf(HERE) < 0 && !/^(walk-in|booking-received|box-received)/.test(HERE)) {
        a.setAttribute('href', 'sign-in.html?next=' + encodeURIComponent(HERE)); hh = 'sign-in.html';
      }
      if (signed && /^sign-in\.html/.test(hh) && /^sign in$/i.test(a.textContent.trim())) {
        a.textContent = 'My profile'; a.setAttribute('href', 'profile.html');
      }
      if (/^profile\.html/.test(hh) && !signed && a.getAttribute('aria-label') && /profile/i.test(a.getAttribute('aria-label'))) {
        a.setAttribute('href', 'sign-in.html?next=profile.html');
      }
    });
  }
  window.RuhFixLinks = fixLinks;

  /* ---------- tiny template renderer ---------- */
  function get(scope, expr) {
    return expr.trim().split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, scope);
  }
  var EXP = /\{\{([^}]+)\}\}/g;
  function interp(str, scope) {
    return str.replace(EXP, function (m, e) {
      var v = get(scope, e);
      return typeof v === 'function' ? '' : (v == null ? '' : String(v));
    });
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
        list.forEach(function (it, i) {
          var s = Object.create(scope); s[as] = it; s.$index = i;
          frag.appendChild(build(ch, s, handlers));
        });
        return;
      }
      if (tag === 'SC-IF') {
        var v = get(scope, (ch.getAttribute('value') || '').replace(/[{}]/g, ''));
        if (v) frag.appendChild(build(ch, scope, handlers));
        return;
      }
      if (tag === 'HELMET') return;
      var el = document.createElementNS(ch.namespaceURI, ch.localName);
      for (var i = 0; i < ch.attributes.length; i++) {
        var a = ch.attributes[i], name = a.name, val = a.value;
        if (/^on[a-z]+$/i.test(name) && /^\s*\{\{[^}]+\}\}\s*$/.test(val)) {
          var fn = get(scope, val.replace(/[{}\s]/g, ''));
          if (typeof fn === 'function') {
            var ev = name.slice(2).toLowerCase();
            handlers.push(fn);
            el.setAttribute('data-on-' + ev, String(handlers.length - 1));
          }
          continue;
        }
        if (name.indexOf('hint-') === 0) continue;
        el.setAttribute(name, val.indexOf('{{') > -1 ? interp(val, scope) : val);
      }
      if (tag === 'TEXTAREA' || tag === 'SCRIPT' || tag === 'STYLE') { el.textContent = interp(ch.textContent, scope); }
      else el.appendChild(build(ch, scope, handlers));
      frag.appendChild(el);
    });
    return frag;
  }

  /* morph: update old DOM to match new DOM, keeping focus and running animations */
  function morph(oldP, newP) {
    var o = oldP.firstChild, n = newP.firstChild;
    while (n) {
      var next = n.nextSibling;
      if (!o) { oldP.appendChild(n); n = next; continue; }
      if (o.nodeType !== n.nodeType || (o.nodeType === 1 && o.tagName !== n.tagName)) {
        oldP.insertBefore(n, o); n = next; continue;
      }
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
        if (o.tagName === 'INPUT' && (o.type === 'checkbox' || o.type === 'radio')) o.checked = n.hasAttribute('checked');
        morph(o, n);
      }
      o = o.nextSibling; n = next;
    }
    while (o) { var x = o.nextSibling; oldP.removeChild(o); o = x; }
  }

  var helmetDone = {};
  function mount(app, tplId, jsId) {
    var tpl = document.getElementById(tplId);
    var js = document.getElementById(jsId);
    var src = tpl.content.querySelector('x-dc') || tpl.content;
    var helm = src.querySelector('helmet');
    if (helm && !helmetDone[tplId]) {
      helmetDone[tplId] = true;
      var h = document.createElement('div'); h.innerHTML = helm.innerHTML;
      [].slice.call(h.childNodes).forEach(function (c) {
        if (c.nodeType !== 1) return;
        c.setAttribute('data-view', tplId);
        document.head.appendChild(c);
      });
    }
    document.querySelectorAll('[data-view]').forEach(function (c) {
      if (c.tagName === 'STYLE') c.media = c.getAttribute('data-view') === tplId ? 'all' : 'not all';
    });
    function DCLogic(props) { this.props = props || {}; this.state = {}; }
    var comp = null;
    DCLogic.prototype.setState = function (p) {
      var self = this;
      if (typeof p === 'function') p = p(self.state);
      Object.assign(self.state, p || {});
      if (comp) render();
    };
    var C = js ? new Function('DCLogic', js.textContent + '\n;return Component;')(DCLogic) : null;
    var inst = C ? new C({}) : null;
    var handlers = [];
    function render() {
      handlers = [];
      var vals = inst ? inst.renderVals() : {};
      var frag = build(src, vals, handlers);
      var wrap = document.createElement('div'); wrap.appendChild(frag);
      morph(app, wrap);
      app.__h = handlers;
      fixLinks(app);
      enhance(app);
    }
    comp = inst || {};
    render();
    if (inst && typeof inst.componentDidMount === 'function') inst.componentDidMount();
    return inst;
  }

  function delegate(app) {
    ['click', 'input', 'change', 'submit', 'keydown'].forEach(function (type) {
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
  }

  /* ---------- shared site chrome ---------- */
  var NAV = [['Menu', 'menu.html'], ["What's on", 'whats-on.html'], ['Ruh at Home', 'ruh-at-home.html'], ['Ruh Circle', 'circle.html']];
  function enhance(app) {
    app.querySelectorAll('nav[aria-label="Main"]').forEach(function (nav) {
      if (nav.getAttribute('data-std') === '1') return;
      var first = nav.querySelector('a');
      var cls = first ? first.getAttribute('class') || '' : '';
      nav.innerHTML = NAV.map(function (x) {
        var on = HERE === x[1] || (CFG.section && CFG.section === x[1]);
        return '<a href="' + x[1] + '"' + (cls ? ' class="' + cls + '"' : '') + (on ? ' aria-current="page" style="color:#F2B9A6"' : '') + '>' + x[0] + '</a>';
      }).join('');
      nav.setAttribute('data-std', '1');
    });
    app.querySelectorAll('button[aria-label="Open menu"]').forEach(function (b) {
      if (b.__m) return; b.__m = 1;
      b.addEventListener('click', function (e) { e.preventDefault(); openDrawer(); });
    });
    // desktop-only boards on a phone: add a menu button to the header
    if (CFG.narrowFix && window.innerWidth < (CFG.bp || 760)) {
      var hd = app.querySelector('header');
      if (hd && !hd.querySelector('.ruh-burger')) {
        var bt = document.createElement('button');
        bt.type = 'button'; bt.className = 'ruh-burger'; bt.setAttribute('aria-label', 'Open menu');
        bt.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>';
        bt.addEventListener('click', openDrawer);
        hd.appendChild(bt);
      }
    }
  }

  function openDrawer() {
    var d = document.getElementById('ruh-drawer');
    if (!d) {
      d = document.createElement('div'); d.id = 'ruh-drawer';
      document.body.appendChild(d);
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) d.classList.remove('on'); });
    }
    var signed = Auth.get();
    var links = [['Home', 'index.html']].concat(NAV).concat([signed ? ['My profile', 'profile.html'] : ['Sign in', 'sign-in.html'], ['Leaderboard', 'leaderboard.html'], ['At your table', 'table.html']]);
    d.innerHTML = '<div class="pn" role="dialog" aria-label="Site menu"><div class="tp"><img src="images/logo.png" alt="Ruh"><button type="button" data-close aria-label="Close menu">×</button></div>' +
      links.map(function (x) { return '<a href="' + x[1] + '"' + (HERE === x[1] ? ' aria-current="page"' : '') + '>' + x[0] + '</a>'; }).join('') +
      '<a href="book.html" class="bk">Book a table</a>' + (signed ? '<button type="button" class="so" data-signout>Sign out</button>' : '') + '</div>';
    var so = d.querySelector('[data-signout]');
    if (so) so.addEventListener('click', function () { Auth.signOut(); location.href = 'index.html'; });
    requestAnimationFrame(function () { d.classList.add('on'); });
  }
  window.RuhOpenMenu = openDrawer;

  function chromeCSS() {
    var s = document.createElement('style');
    s.textContent =
      '#ruh-drawer{position:fixed;inset:0;z-index:1000;background:rgba(16,22,18,.55);opacity:0;pointer-events:none;transition:opacity .25s}' +
      '#ruh-drawer.on{opacity:1;pointer-events:auto}' +
      '#ruh-drawer .pn{position:absolute;right:0;top:0;bottom:0;width:min(340px,86vw);background:#1F2E24;color:#FFF8EE;padding:18px 22px;display:flex;flex-direction:column;gap:4px;transform:translateX(100%);transition:transform .3s;font-family:Figtree,"Segoe UI",sans-serif;overflow:auto}' +
      '#ruh-drawer.on .pn{transform:none}' +
      '#ruh-drawer .tp{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}#ruh-drawer .tp img{height:44px}' +
      '#ruh-drawer .tp button{width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(255,248,238,.35);background:none;color:#FFF8EE;font-size:24px;cursor:pointer}' +
      '#ruh-drawer a{color:#FFF8EE;text-decoration:none;font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:22px;padding:12px 0;border-bottom:1px solid rgba(255,248,238,.1)}' +
      '#ruh-drawer a[aria-current]{color:#F2B9A6}' +
      '#ruh-drawer a.bk{margin-top:18px;border:0;text-align:center;background:#F2B9A6;color:#1F2E24;border-radius:999px;font-size:17px;padding:15px}' +
      '#ruh-drawer .so{margin-top:10px;background:none;border:1.5px solid rgba(255,248,238,.35);color:#FFF8EE;border-radius:999px;padding:13px;font:700 15px Figtree,sans-serif;cursor:pointer}' +
      '.ruh-burger{width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(255,248,238,.4);background:transparent;color:#FFF8EE;display:grid;place-items:center;cursor:pointer}' +
      '#ruh-demo{position:fixed;left:14px;bottom:14px;z-index:900;display:flex;align-items:center;gap:8px;background:rgba(31,46,36,.92);color:#FFF8EE;font:600 12px Figtree,sans-serif;padding:8px 12px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.2)}' +
      '#ruh-demo button{background:none;border:0;color:#F2B9A6;font:700 12px Figtree,sans-serif;cursor:pointer;padding:0}' +
      '#app{overflow-x:clip}#app fieldset{min-width:0}' +
      'body.ruh-phone-only{background:#1F2E24!important}' +
      'body.ruh-phone-only #app{max-width:430px;margin:0 auto;box-shadow:0 0 60px rgba(0,0,0,.35);min-height:100vh}';
    document.head.appendChild(s);
  }

  function demoBadge() {
    var u = Auth.get();
    if (!u) return;
    var b = document.createElement('div'); b.id = 'ruh-demo';
    b.innerHTML = '<span>Signed in as ' + u.name + ' (demo)</span><button type="button">Sign out</button>';
    b.querySelector('button').addEventListener('click', function () { Auth.signOut(); location.href = 'index.html'; });
    document.body.appendChild(b);
  }

  /* ---------- boot ---------- */
  function pickView() {
    var signed = !!Auth.get();
    var views = CFG.views || [];
    for (var i = 0; i < views.length; i++) {
      var v = views[i];
      if (v.auth === true && !signed) continue;
      if (v.auth === false && signed) continue;
      return v;
    }
    return views[0];
  }
  function boot() {
    chromeCSS();
    if (CFG.home) {
      fixLinks(document.body);
      if (Auth.get()) document.querySelectorAll('.desk-signin').forEach(function (a) { a.textContent = 'My profile'; a.setAttribute('href', 'profile.html'); });
      demoBadge();
      return;
    }
    if (CFG.gate && !Auth.get()) { location.replace('sign-in.html?next=' + encodeURIComponent(HERE + location.search)); return; }
    var app = document.getElementById('app');
    delegate(app);
    var bp = CFG.bp || 760;
    var current = null;
    function choose() {
      var v = pickView();
      var phone = window.innerWidth < bp;
      var key = (phone && v.m) ? v.m : (v.d || v.m);
      document.body.classList.toggle('ruh-phone-only', !v.d);
      if (CFG.narrowFix) document.documentElement.classList.toggle('ruh-narrow', phone && !v.m);
      if (key === current) return;
      current = key;
      app.innerHTML = '';
      mount(app, 'tpl-' + key, 'js-' + key);
    }
    choose();
    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(choose, 150); });
    demoBadge();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
