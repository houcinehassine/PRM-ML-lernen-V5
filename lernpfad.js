/* ════════════════════════════════════════════════════════
   lernpfad.js – 5-Stufen-Navigationsleiste + Fortschritt
   ════════════════════════════════════════════════════════ */

const STUFEN_DEFAULT = [
  { id: 'ziel',    icon: '🎯', label: 'Ziel & Kontext',       cls: 'lp-ziel'    },
  { id: 'theorie', icon: '🧠', label: 'Theorie',              cls: 'lp-theorie' },
  { id: 'algo',    icon: '⚙️', label: 'Algorithmus',          cls: 'lp-algo'    },
  { id: 'scratch', icon: '🛠️', label: 'Von Scratch',          cls: 'lp-scratch' },
  { id: 'sklearn', icon: '🚀', label: 'Mit sklearn',          cls: 'lp-sklearn' },
];

class LernPfad extends HTMLElement {
  connectedCallback() {
    const topicKey = this.getAttribute('topic') ?? location.pathname;
    this._topicKey = 'prm-v5:' + topicKey;

    /* Seiten mit mehreren Methoden (Einleitung → Methode 1..n → Vergleich)
       können ihre eigenen Stufen über window.__lernpfadSteps__ definieren */
    this._stufen = window.__lernpfadSteps__ ?? STUFEN_DEFAULT;

    this._done = new Set(JSON.parse(localStorage.getItem(this._topicKey) ?? '[]'));

    this.innerHTML = `
      <nav class="lernpfad-bar" aria-label="Lernpfad-Stufen">
        ${this._stufen.map((s, i) => `
          <a href="#stufe-${s.id}"
             class="lernpfad-step ${s.cls} ${this._done.has(s.id) ? 'done' : ''}"
             data-stufe="${s.id}"
             title="${s.label}">
            <span class="lp-icon">${s.icon}</span>
            <span>${s.label}</span>
            <span class="lp-check" aria-label="erledigt">✓</span>
          </a>
          ${i < this._stufen.length - 1 ? '<span class="lp-sep" aria-hidden="true">›</span>' : ''}
        `).join('')}
      </nav>`;

    this._initScroll();
    this._initMarkButtons();
  }

  _initScroll() {
    const bar   = this.querySelector('.lernpfad-bar');
    const links = [...this.querySelectorAll('.lernpfad-step')];

    const activate = id => {
      links.forEach(l => l.classList.toggle('active', l.dataset.stufe === id));
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const id = e.target.id.replace('stufe-', '');
          activate(id);
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

    this._stufen.forEach(s => {
      const el = document.getElementById('stufe-' + s.id);
      if (el) observer.observe(el);
    });

    /* Smooth scroll on click */
    links.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = document.getElementById('stufe-' + link.dataset.stufe);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  _initMarkButtons() {
    /* After DOM ready, wire up "Als erledigt markieren" buttons */
    document.addEventListener('DOMContentLoaded', () => this._wireMarkButtons());
    if (document.readyState !== 'loading') this._wireMarkButtons();
  }

  _wireMarkButtons() {
    document.querySelectorAll('[data-mark-stufe]').forEach(btn => {
      const id = btn.dataset.markStufe;
      this._updateMarkBtn(btn, id);
      btn.addEventListener('click', () => {
        if (this._done.has(id)) {
          this._done.delete(id);
        } else {
          this._done.add(id);
        }
        localStorage.setItem(this._topicKey, JSON.stringify([...this._done]));
        this._updateMarkBtn(btn, id);

        /* update check in nav bar */
        const navLink = this.querySelector(`[data-stufe="${id}"]`);
        if (navLink) navLink.classList.toggle('done', this._done.has(id));

        /* fire progress event for sidebar */
        document.dispatchEvent(new CustomEvent('lernpfad:progress', {
          detail: { topicKey: this._topicKey, done: [...this._done] }
        }));
      });
    });
  }

  _updateMarkBtn(btn, id) {
    const isDone = this._done.has(id);
    btn.textContent = isDone ? '✓ Erledigt' : '○ Als erledigt markieren';
    btn.style.setProperty('--btn-color', isDone ? 'var(--color-success)' : 'var(--color-text-faint)');
    btn.setAttribute('aria-pressed', isDone ? 'true' : 'false');
  }
}
customElements.define('lern-pfad', LernPfad);

/* ── Sidebar Web Component ─────────────────────────────── */
class SiteSidebar extends HTMLElement {
  connectedCallback() {
    const active = this.getAttribute('active') ?? '';
    const chapterData = window.__sidebarData__;

    if (!chapterData) {
      this.innerHTML = '<div class="sidebar"></div>';
      return;
    }

    const completedTopics = this._loadProgress(chapterData);

    this.innerHTML = `
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
      <nav class="sidebar" id="main-sidebar" aria-label="Kapitel-Navigation">
        <button class="sidebar-close" id="sidebar-close" aria-label="Sidebar schließen">✕</button>

        <div class="sidebar-progress-wrap">
          <div class="sidebar-progress-label">
            <span>Fortschritt</span>
            <span id="progress-text">0 / ${chapterData.topics.length}</span>
          </div>
          <div class="sidebar-progress-bar">
            <div class="sidebar-progress-fill" id="progress-fill" style="width:0%"></div>
          </div>
        </div>

        <div class="toc-chapter-head">
          <span class="sidebar-chapter-num">${chapterData.num}</span>
          <span>${chapterData.title}</span>
        </div>

        <div class="toc-section-label">Themen</div>

        ${chapterData.topics.map(t => {
          const isDone = completedTopics.has(t.id);
          return `<a href="${t.href}" class="toc-link ${active === t.id ? 'active' : ''}" data-topic-id="${t.id}">
            ${t.icon ?? ''} ${t.title}
            ${isDone ? '<span class="toc-done" aria-label="abgeschlossen">✓</span>' : ''}
          </a>`;
        }).join('')}

        ${chapterData.extras ? `
          <div class="toc-divider">Prüfung</div>
          ${chapterData.extras.map(e =>
            `<a href="${e.href}" class="toc-link ${active === e.id ? 'active' : ''}">${e.icon ?? ''} ${e.title}</a>`
          ).join('')}
        ` : ''}
      </nav>
      <button class="sidebar-fab" id="sidebar-fab" aria-label="Navigation öffnen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>`;

    this._updateProgress(chapterData, completedTopics);
    this._initMobile();
    this._listenProgress(chapterData);
  }

  _loadProgress(chapterData) {
    const done = new Set();
    chapterData.topics.forEach(t => {
      const key  = 'prm-v5:' + t.id;
      const data = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (data.length >= 5) done.add(t.id);
    });
    return done;
  }

  _updateProgress(chapterData, done) {
    const fill = this.querySelector('#progress-fill');
    const text = this.querySelector('#progress-text');
    if (!fill || !text) return;
    const pct = Math.round((done.size / chapterData.topics.length) * 100);
    fill.style.width = pct + '%';
    text.textContent = `${done.size} / ${chapterData.topics.length}`;
  }

  _initMobile() {
    const fab     = this.querySelector('#sidebar-fab');
    const overlay = this.querySelector('#sidebar-overlay');
    const close   = this.querySelector('#sidebar-close');
    const sidebar = this.querySelector('#main-sidebar');
    if (!fab) return;
    const open  = () => { sidebar.classList.add('sidebar--open'); overlay.classList.add('sidebar--open'); document.body.classList.add('sidebar--open'); };
    const shut  = () => { sidebar.classList.remove('sidebar--open'); overlay.classList.remove('sidebar--open'); document.body.classList.remove('sidebar--open'); };
    fab.addEventListener('click', open);
    overlay.addEventListener('click', shut);
    close?.addEventListener('click', shut);
  }

  _listenProgress(chapterData) {
    document.addEventListener('lernpfad:progress', () => {
      const done = this._loadProgress(chapterData);
      this._updateProgress(chapterData, done);
      done.forEach(id => {
        const link = this.querySelector(`[data-topic-id="${id}"]`);
        if (link && !link.querySelector('.toc-done')) {
          const span = document.createElement('span');
          span.className = 'toc-done';
          span.setAttribute('aria-label', 'abgeschlossen');
          span.textContent = '✓';
          link.appendChild(span);
        }
      });
    });
  }
}
customElements.define('site-sidebar', SiteSidebar);

/* ── Quiz Self-Check ────────────────────────────────────── */
function initQuizSelfCheck() {
  const fragen = document.querySelectorAll('.frage');
  if (!fragen.length) return;

  const quizKey = document.querySelector('site-sidebar')?.getAttribute('active');
  if (!quizKey) return;
  const storageKey = 'prm-v5:' + quizKey + ':selfcheck';
  const state = JSON.parse(localStorage.getItem(storageKey) ?? '{}');

  const firstSection = document.querySelector('#main-content section');
  const banner = document.createElement('div');
  banner.className = 'quiz-progress-banner';
  firstSection?.after(banner);

  const renderBanner = () => {
    const total = fragen.length;
    const answered = Object.keys(state).length;
    const correct = Object.values(state).filter(v => v === 'yes').length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const passed = answered === total && correct / total >= 0.8;

    banner.innerHTML = `
      <div class="quiz-progress-row">
        <span class="quiz-progress-text">${correct} / ${total} sicher beantwortet (${answered}/${total} bewertet)</span>
        <span class="quiz-progress-pct">${pct}%</span>
      </div>
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
      ${passed ? '<div class="quiz-progress-passed">✅ Bestanden! Lernpfad-Fortschritt für dieses Kapitel wurde aktualisiert.</div>' : ''}
    `;

    if (passed) markChapterDone();
  };

  const markChapterDone = () => {
    const chapterData = window.__sidebarData__;
    if (!chapterData) return;
    const allStufen = ['ziel', 'theorie', 'algo', 'scratch', 'sklearn'];
    let changed = false;
    chapterData.topics.forEach(t => {
      const key  = 'prm-v5:' + t.id;
      const done = new Set(JSON.parse(localStorage.getItem(key) ?? '[]'));
      if (done.size < allStufen.length) {
        allStufen.forEach(s => done.add(s));
        localStorage.setItem(key, JSON.stringify([...done]));
        changed = true;
      }
    });
    if (changed) {
      document.dispatchEvent(new CustomEvent('lernpfad:progress', { detail: {} }));
    }
  };

  fragen.forEach((frage, i) => {
    const qid     = 'q' + (i + 1);
    const antwort = frage.querySelector('.frage-antwort');
    if (!antwort) return;

    const row = document.createElement('div');
    row.className = 'quiz-selfcheck';
    row.innerHTML = `
      <span class="quiz-selfcheck-label">Konntest du das beantworten?</span>
      <button class="qc-btn qc-yes" data-val="yes">✓ Ja</button>
      <button class="qc-btn qc-no" data-val="no">✗ Nein</button>
    `;
    antwort.after(row);

    const update = () => {
      row.querySelectorAll('.qc-btn').forEach(b => b.classList.toggle('active', b.dataset.val === state[qid]));
    };
    update();

    row.querySelectorAll('.qc-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (state[qid] === btn.dataset.val) delete state[qid];
        else state[qid] = btn.dataset.val;
        localStorage.setItem(storageKey, JSON.stringify(state));
        update();
        renderBanner();
      });
    });
  });

  renderBanner();
}

if (document.readyState !== 'loading') initQuizSelfCheck();
else document.addEventListener('DOMContentLoaded', initQuizSelfCheck);
