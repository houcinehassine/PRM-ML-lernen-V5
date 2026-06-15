class SiteHeader extends HTMLElement {
  connectedCallback() {
    const page  = this.getAttribute('active') ?? '';
    const title = this.getAttribute('title')  ?? 'PRM · Lernen V5';

    document.title = title;

    if (!document.querySelector('link[rel~="icon"]')) {
      const fav = document.createElement('link');
      fav.rel = 'icon'; fav.type = 'image/svg+xml';
      fav.href = new URL('./assets/favicon.svg', import.meta.url).href;
      document.head.appendChild(fav);
    }

    const fontsCss = document.createElement('link');
    fontsCss.rel = 'stylesheet';
    fontsCss.href = new URL('./assets/vendor/fonts.css', import.meta.url).href;
    document.head.appendChild(fontsCss);

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('./assets/style.css', import.meta.url).href;
    document.head.appendChild(css);

    /* Highlight.js – lazy */
    const loadHljs = () => {
      if (window._hljsLoaded) return;
      window._hljsLoaded = true;
      const hljsCss = document.createElement('link');
      hljsCss.rel  = 'stylesheet';
      hljsCss.href = new URL('./assets/vendor/highlight-github.min.css', import.meta.url).href;
      document.head.appendChild(hljsCss);
      const hljsScript = document.createElement('script');
      hljsScript.src   = new URL('./assets/vendor/highlight.min.js', import.meta.url).href;
      hljsScript.onload = () => {
        document.querySelectorAll('pre code').forEach(block => {
          if (!block.className) block.classList.add('language-python');
          window.hljs.highlightElement(block);
        });
      };
      document.head.appendChild(hljsScript);
    };
    if (document.querySelector('pre')) { loadHljs(); }
    else { document.addEventListener('DOMContentLoaded', () => { if (document.querySelector('pre')) loadHljs(); }, { once: true }); }

    const nav = (id, href, label) =>
      `<a href="${href}" ${page === id ? 'class="active"' : ''}>${label}</a>`;

    this.innerHTML = `
      <a href="#main-content" class="skip-link">Zum Inhalt springen</a>
      <header class="header">
        <div class="header-inner container">
          <a href="../index.html" class="brand" title="Alle Kapitel">
            <div class="brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                   width="22" height="22">
                <circle cx="7"  cy="12" r="2.5"/>
                <circle cx="17" cy="7"  r="2.5"/>
                <circle cx="17" cy="17" r="2.5"/>
                <path d="M9.4 10.8l5.2-2.6M9.4 13.2l5.2 2.6"/>
              </svg>
            </div>
            <div class="brand-text">
              <small>Lernpfad</small>
              <strong>PRM · V5</strong>
            </div>
          </a>
          <nav class="chapter-nav-top" aria-label="Kapitelnavigation">
            ${nav('k1','../Kapitel1/Kapitel1.html','1 · Data Prep')}
            ${nav('k2','../Kapitel2/Kapitel2.html','2 · ML Grundlagen')}
            ${nav('k3','../Kapitel3/Kapitel3.html','3 · SVM')}
            ${nav('k4','../Kapitel4/Kapitel4.html','4 · Clustering')}
            ${nav('k5','../Kapitel5/Kapitel5.html','5 · Random Forest')}
            ${nav('k6','../Kapitel6/Kapitel6.html','6 · GMM')}
            ${nav('k7','../Kapitel7/Kapitel7.html','7 · Evaluation')}
            ${nav('pruefung','../Pruefung/Pruefung.html','🆘 Prüfung')}
          </nav>
          <button class="search-btn" data-search-toggle aria-label="Suche öffnen" title="Suche (Strg+K)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                 width="18" height="18">
              <circle cx="11" cy="11" r="7"/>
              <path d="M21 21l-4.3-4.3"/>
            </svg>
          </button>
          <button class="sidebar-toggle-btn" data-sidebar-toggle aria-label="Navigation ein-/ausblenden" title="Navigation ein-/ausblenden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                 width="18" height="18">
              <rect x="3" y="4" width="18" height="16" rx="2"/>
              <line x1="9" y1="4" x2="9" y2="20"/>
            </svg>
          </button>
          <button class="theme-toggle" data-theme-toggle aria-label="Farbschema wechseln">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                 width="18" height="18">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41
                       M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
          </button>
        </div>
      </header>
      <div class="search-overlay" data-search-overlay hidden>
        <div class="search-panel">
          <div class="search-input-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                 width="18" height="18">
              <circle cx="11" cy="11" r="7"/>
              <path d="M21 21l-4.3-4.3"/>
            </svg>
            <input type="text" data-search-input placeholder="Suchen … (Titel, Begriffe, Code)" autocomplete="off" spellcheck="false">
            <kbd>Esc</kbd>
          </div>
          <div class="search-results" data-search-results></div>
        </div>
      </div>`;

    this._initTheme();
    this._initSearch();
    this._initSidebarToggle();
  }

  _initSidebarToggle() {
    const btn = this.querySelector('[data-sidebar-toggle]');
    if (!btn) return;
    const KEY = 'prm-sidebar-hidden';
    if (localStorage.getItem(KEY) === '1') {
      document.body.classList.add('sidebar-hidden');
    }
    btn.addEventListener('click', () => {
      const hidden = document.body.classList.toggle('sidebar-hidden');
      localStorage.setItem(KEY, hidden ? '1' : '0');
    });
  }

  _initSearch() {
    const overlay = this.querySelector('[data-search-overlay]');
    const input   = this.querySelector('[data-search-input]');
    const results = this.querySelector('[data-search-results]');
    const toggle  = this.querySelector('[data-search-toggle]');
    if (!overlay || !input || !results || !toggle) return;

    let index = null;
    let activeIdx = -1;

    const depthPrefix = /\/(Kapitel\d|Pruefung)\//.test(location.pathname) ? '../' : './';
    const resolveUrl = (url) => url === 'index.html'
      ? (depthPrefix === './' ? './index.html' : '../index.html')
      : depthPrefix + url;

    const loadIndex = async () => {
      if (index) return index;
      try {
        const res = await fetch(new URL('./search-index.json', import.meta.url));
        index = await res.json();
      } catch {
        index = [];
      }
      return index;
    };

    const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    const highlight = (text, query) => {
      const idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx === -1) return escapeHtml(text);
      return escapeHtml(text.slice(0, idx)) + '<mark>' + escapeHtml(text.slice(idx, idx + query.length)) + '</mark>' + escapeHtml(text.slice(idx + query.length));
    };

    // Ausschnitt um die Fundstelle in einem langen Text herum extrahieren,
    // damit auch Treffer mitten im Fließtext sinnvoll angezeigt werden.
    const snippetAround = (text, query, radius = 70) => {
      const idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx === -1) return text.slice(0, radius * 2);
      const start = Math.max(0, idx - radius);
      const end = Math.min(text.length, idx + query.length + radius);
      let snippet = text.slice(start, end);
      if (start > 0) snippet = '…' + snippet;
      if (end < text.length) snippet = snippet + '…';
      return snippet;
    };

    const render = (query) => {
      activeIdx = -1;
      if (!query.trim()) {
        results.innerHTML = '<div class="search-empty">Tippe, um in allen Kapiteln zu suchen …</div>';
        return;
      }
      const q = query.toLowerCase();
      const matches = [];
      for (const entry of index) {
        let score = 0;
        let context = null;

        if (entry.title && entry.title.toLowerCase().includes(q)) { score += 4; context = entry.title; }
        if (entry.h1 && entry.h1.toLowerCase().includes(q)) { score += 3; if (!context) context = entry.h1; }

        const tag = (entry.tags || []).find(t => t.toLowerCase().includes(q));
        if (tag) { score += 2; if (!context) context = tag; }

        if (entry.text && entry.text.toLowerCase().includes(q)) {
          score += 1;
          if (!context) context = snippetAround(entry.text, query);
        }

        if (entry.chapter && entry.chapter.toLowerCase().includes(q)) { score += 1; }

        if (score > 0) matches.push({ entry, context: context || entry.text || entry.h1 || '', score });
      }
      matches.sort((a, b) => b.score - a.score);
      const top = matches.slice(0, 10);
      if (top.length === 0) {
        results.innerHTML = '<div class="search-empty">Keine Treffer für „' + escapeHtml(query) + '“</div>';
        return;
      }
      results.innerHTML = top.map(({ entry, context }) => `
        <a class="search-result" href="${resolveUrl(entry.url + (entry.anchor || ''))}">
          <div class="search-result-chapter">${escapeHtml(entry.chapter)}${entry.h1 ? ' · ' + escapeHtml(entry.h1) : ''}</div>
          <div class="search-result-title">${highlight(entry.title || entry.h1 || '', query)}</div>
          <div class="search-result-context">${highlight(context, query)}</div>
        </a>`).join('');
    };

    const setActive = (i) => {
      const items = results.querySelectorAll('.search-result');
      items.forEach(el => el.classList.remove('is-active'));
      if (i >= 0 && i < items.length) {
        items[i].classList.add('is-active');
        items[i].scrollIntoView({ block: 'nearest' });
        activeIdx = i;
      } else {
        activeIdx = -1;
      }
    };

    const open = async () => {
      await loadIndex();
      overlay.hidden = false;
      render(input.value);
      input.focus();
      input.select();
    };
    const close = () => {
      overlay.hidden = true;
      activeIdx = -1;
    };

    toggle.addEventListener('click', open);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      const items = results.querySelectorAll('.search-result');
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const target = activeIdx >= 0 ? items[activeIdx] : items[0];
        if (target) location.href = target.getAttribute('href');
      } else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
      else if (e.key === 'Escape' && !overlay.hidden) { close(); }
    });
  }

  _initTheme() {
    const html = document.documentElement;
    const btn  = this.querySelector('[data-theme-toggle]');
    if (!btn) return;
    const saved = localStorage.getItem('prm-theme');
    if (saved) { html.dataset.theme = saved; }
    else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) { html.dataset.theme = 'dark'; }
    const updateIcon = () => {
      const dark = html.dataset.theme === 'dark';
      btn.innerHTML = dark
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
      btn.setAttribute('aria-label', dark ? 'Light Mode' : 'Dark Mode');
    };
    updateIcon();
    btn.addEventListener('click', () => {
      const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      html.dataset.theme = next;
      localStorage.setItem('prm-theme', next);
      updateIcon();
    });
  }
}
customElements.define('site-header', SiteHeader);
