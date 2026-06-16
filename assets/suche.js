/* Suche.html — dedizierte Such-Seite mit voller Code-Zellen-Anzeige */

const PAGE_SIZE = 24;

const els = {
  input:   document.querySelector('[data-suche-input]'),
  count:   document.querySelector('[data-suche-count]'),
  results: document.querySelector('[data-suche-results]'),
  chapterFilters: document.querySelector('[data-filter-chapter]'),
  typeFilters:    document.querySelector('[data-filter-type]'),
  more:    document.querySelector('[data-suche-more]'),
};

const state = {
  index: [],
  query: '',
  chapter: 'alle',
  type: 'alle',
  shown: PAGE_SIZE,
};

const TYPE_LABELS = { code: '🐍 Code', konzept: '💡 Konzept', formel: '∑ Formel' };

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const resolveUrl = (url) => url === 'index.html' ? './index.html' : './' + url;

// Link zur Fundstelle: Anker + ?hl=<query>, damit die Zielseite den Treffer markieren
// und automatisch zu ihm scrollen kann.
const resultHref = (entry, query) => {
  const base = resolveUrl(entry.url);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}hl=${encodeURIComponent(query)}${entry.anchor || ''}`;
};

// Ausschnitt um die Fundstelle herum extrahieren
const snippetAround = (text, query, radius = 90) => {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
};

const highlight = (text, query) => {
  if (!query) return escapeHtml(text);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(text);
  return escapeHtml(text.slice(0, idx)) + '<mark>' + escapeHtml(text.slice(idx, idx + query.length)) + '</mark>' + escapeHtml(text.slice(idx + query.length));
};

// Alle Vorkommen von `query` in einem bereits gerenderten <code>-Element
// markieren, ohne die hljs-Syntaxhervorhebung zu zerstören.
function highlightCodeMatches(codeEl, query) {
  if (!query) return;
  const q = query.toLowerCase();
  const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);
  for (const tn of textNodes) {
    const lower = tn.nodeValue.toLowerCase();
    if (!lower.includes(q)) continue;
    const frag = document.createDocumentFragment();
    let rest = tn.nodeValue;
    let restLower = lower;
    let idx;
    while ((idx = restLower.indexOf(q)) !== -1) {
      if (idx > 0) frag.appendChild(document.createTextNode(rest.slice(0, idx)));
      const mark = document.createElement('mark');
      mark.textContent = rest.slice(idx, idx + q.length);
      frag.appendChild(mark);
      rest = rest.slice(idx + q.length);
      restLower = restLower.slice(idx + q.length);
    }
    if (rest) frag.appendChild(document.createTextNode(rest));
    tn.parentNode.replaceChild(frag, tn);
  }
}

function scoreEntry(entry, q) {
  let score = 0;
  let context = null;
  let contextIsCode = false;

  if (entry.title && entry.title.toLowerCase().includes(q)) { score += 4; context = entry.title; }
  if (entry.h1 && entry.h1.toLowerCase().includes(q)) { score += 3; if (!context) context = entry.h1; }

  const tag = (entry.tags || []).find(t => t.toLowerCase().includes(q));
  if (tag) { score += 2; if (!context) context = tag; }

  if (entry.text && entry.text.toLowerCase().includes(q)) {
    score += 1;
    if (!context) context = snippetAround(entry.text, q);
  }

  if (entry.code && entry.code.toLowerCase().includes(q)) {
    score += 3;
    context = null; contextIsCode = true;
  }

  if (entry.chapter && entry.chapter.toLowerCase().includes(q)) { score += 1; }

  return { score, context, contextIsCode };
}

function buildCodeCard(entry, query) {
  const lang = entry.lang || 'python';
  return `
    <div class="code-cell">
      <div class="code-cell-header">
        <span class="cell-lang">${escapeHtml(entry.cell_label || '🐍 Code')}</span>
        <button class="copy-btn" onclick="copyCode(this)">Kopieren</button>
      </div>
      <pre><code class="language-${escapeHtml(lang)}" data-suche-query="${escapeHtml(query)}">${escapeHtml(entry.code)}</code></pre>
    </div>`;
}

function renderResultCard(entry, query, matchInfo) {
  const { context, contextIsCode } = matchInfo;
  const typeLabel = TYPE_LABELS[entry.type] || '';
  const titleHtml = highlight(entry.title || entry.h1 || '(ohne Titel)', query);

  let bodyHtml;
  if (contextIsCode && entry.code) {
    bodyHtml = buildCodeCard(entry, query);
  } else if (entry.type === 'code' && entry.code) {
    // Treffer kam aus Titel/Tag/Text, aber es ist eine Code-Zelle → volle Zelle zeigen
    bodyHtml = buildCodeCard(entry, query);
  } else {
    const snippet = context || entry.text || '';
    bodyHtml = `<p class="result-snippet">${highlight(snippet, query)}</p>`;
  }

  return `
    <article class="result-card" data-type="${escapeHtml(entry.type || '')}">
      <div class="result-card-head">
        <div class="result-card-meta">
          <span class="result-chapter">${escapeHtml(entry.chapter || '')}</span>
          ${entry.h1 ? `<span class="result-page">${escapeHtml(entry.h1)}</span>` : ''}
          ${typeLabel ? `<span class="result-type">${typeLabel}</span>` : ''}
        </div>
        <h3 class="result-title">${titleHtml}</h3>
      </div>
      ${bodyHtml}
      <div class="result-card-expand-hint">⤢ Antippen für mehr</div>
      <a class="result-link" href="${resultHref(entry, query)}">
        → Zur Stelle springen
      </a>
    </article>`;
}

function uniqueChapters(index) {
  const seen = new Map();
  for (const e of index) {
    if (e.chapter && !seen.has(e.chapter)) seen.set(e.chapter, true);
  }
  return Array.from(seen.keys());
}

function renderFilters() {
  if (els.chapterFilters) {
    const chapters = uniqueChapters(state.index);
    els.chapterFilters.innerHTML = ['alle', ...chapters].map(c => `
      <button class="filter-chip ${state.chapter === c ? 'is-active' : ''}" data-chapter="${escapeHtml(c)}">
        ${c === 'alle' ? 'Alle Kapitel' : escapeHtml(c)}
      </button>`).join('');
  }
  if (els.typeFilters) {
    const types = [['alle', 'Alles'], ['konzept', '💡 Konzepte'], ['code', '🐍 Code'], ['formel', '∑ Formeln']];
    els.typeFilters.innerHTML = types.map(([t, label]) => `
      <button class="filter-chip ${state.type === t ? 'is-active' : ''}" data-type="${t}">${label}</button>`).join('');
  }
}

function render() {
  const query = state.query.trim();
  if (!query) {
    els.results.innerHTML = `<div class="suche-empty">Gib einen Suchbegriff ein — z.B. einen Fachbegriff, eine Variable oder eine sklearn-Funktion.</div>`;
    els.count.textContent = '';
    if (els.more) els.more.hidden = true;
    return;
  }

  const q = query.toLowerCase();
  let matches = [];
  for (const entry of state.index) {
    if (state.chapter !== 'alle' && entry.chapter !== state.chapter) continue;
    if (state.type !== 'alle' && entry.type !== state.type) continue;
    const { score, context, contextIsCode } = scoreEntry(entry, q);
    if (score > 0) matches.push({ entry, context, contextIsCode, score });
  }

  // Eine Seite (.stufe) erzeugt Stufen-, H3- und Code-Zellen-Einträge mit
  // demselben Anker — das führt zu vielen Dubletten auf dieselbe Stelle.
  // Pro Seite+Anker nur den relevantesten Treffer behalten. Ein Treffer, der
  // direkt in einer Code-Zelle gefunden wurde, hat dabei Vorrang, weil er die
  // konkrete Stelle am genauesten zeigt.
  const bestByLocation = new Map();
  for (const m of matches) {
    const key = `${m.entry.url}${m.entry.anchor || ''}`;
    const prev = bestByLocation.get(key);
    if (!prev) { bestByLocation.set(key, m); continue; }
    const mBetter = m.contextIsCode && !prev.contextIsCode
      ? true
      : (prev.contextIsCode && !m.contextIsCode ? false : m.score > prev.score);
    if (mBetter) bestByLocation.set(key, m);
  }
  matches = Array.from(bestByLocation.values());
  matches.sort((a, b) => b.score - a.score);

  els.count.textContent = matches.length === 0
    ? `Keine Treffer für „${query}“`
    : `${matches.length} Treffer für „${query}“`;

  if (matches.length === 0) {
    els.results.innerHTML = `<div class="suche-empty">Keine Treffer für „${escapeHtml(query)}“. Versuch einen anderen Begriff oder entferne Filter.</div>`;
    if (els.more) els.more.hidden = true;
    return;
  }

  const visible = matches.slice(0, state.shown);

  // Treffer nach Seite gruppieren — Reihenfolge der Gruppen folgt dem besten
  // Treffer (Matches sind bereits nach Score sortiert), Karten innerhalb der
  // Gruppe behalten ebenfalls ihre Score-Reihenfolge.
  const groups = new Map();
  for (const m of visible) {
    const key = m.entry.url;
    if (!groups.has(key)) {
      groups.set(key, { chapter: m.entry.chapter, h1: m.entry.h1, url: m.entry.url, items: [] });
    }
    groups.get(key).items.push(m);
  }

  els.results.innerHTML = Array.from(groups.values()).map(g => `
    <section class="result-group">
      <h2 class="result-group-title">
        <span class="result-group-chapter">${escapeHtml(g.chapter || '')}</span>
        <span class="result-group-page">${escapeHtml(g.h1 || '')}</span>
        <a class="result-group-link" href="${resolveUrl(g.url)}">Seite öffnen →</a>
      </h2>
      <div class="result-grid">
        ${g.items.map(m => renderResultCard(m.entry, query, m)).join('')}
      </div>
    </section>`).join('');

  // Syntax-Highlighting + Treffer-Markierung in Code-Karten
  if (window.hljs) {
    els.results.querySelectorAll('pre code[data-suche-query]').forEach(block => {
      window.hljs.highlightElement(block);
      highlightCodeMatches(block, block.dataset.sucheQuery);
    });
  }

  if (els.more) {
    els.more.hidden = matches.length <= state.shown;
    els.more.textContent = `Weitere Treffer laden (${Math.min(PAGE_SIZE, matches.length - state.shown)})`;
  }

  // Karten per Klick auf-/zuklappen (für Touch-Geräte ohne Hover)
  els.results.querySelectorAll('.result-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      card.classList.toggle('is-expanded');
    });
  });
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.chapter !== 'alle') params.set('kapitel', state.chapter);
  if (state.type !== 'alle') params.set('typ', state.type);
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

async function init() {
  try {
    const res = await fetch(new URL('../search-index.json', import.meta.url));
    state.index = await res.json();
  } catch {
    state.index = [];
  }

  const params = new URLSearchParams(location.search);
  state.query = params.get('q') || '';
  state.chapter = params.get('kapitel') || 'alle';
  state.type = params.get('typ') || 'alle';
  if (els.input) els.input.value = state.query;

  renderFilters();
  render();

  els.input?.addEventListener('input', () => {
    state.query = els.input.value;
    state.shown = PAGE_SIZE;
    syncUrl();
    render();
  });

  els.chapterFilters?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chapter]');
    if (!btn) return;
    state.chapter = btn.dataset.chapter;
    state.shown = PAGE_SIZE;
    renderFilters();
    syncUrl();
    render();
  });

  els.typeFilters?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    state.type = btn.dataset.type;
    state.shown = PAGE_SIZE;
    renderFilters();
    syncUrl();
    render();
  });

  els.more?.addEventListener('click', () => {
    state.shown += PAGE_SIZE;
    render();
  });
}

init();
