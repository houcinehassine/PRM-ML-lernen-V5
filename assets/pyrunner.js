/* ════════════════════════════════════════════════════════
   pyrunner.js – Python im Browser ausführen (Pyodide)
   ────────────────────────────────────────────────────────
   Stellt für jedes .code-exercise-Element einen "▶ Ausführen"-
   Button bereit, der den Inhalt der <textarea class="code-input">
   per Pyodide (WebAssembly-Python mit numpy/pandas/scikit-learn/
   matplotlib) ausführt und stdout/stderr in <pre class="code-output">
   sowie evtl. erzeugte matplotlib-Plots als <img> anzeigt.

   Pyodide wird erst beim ersten Klick geladen (lazy), danach
   für die ganze Seite wiederverwendet.
   ════════════════════════════════════════════════════════ */

let _pyodidePromise = null;

async function getPyodide(onStatus) {
  if (!_pyodidePromise) {
    _pyodidePromise = (async () => {
      onStatus?.('Lade Python-Umgebung (Pyodide) …');
      const pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      });
      onStatus?.('Lade numpy, pandas, scikit-learn, matplotlib … (einmalig, ca. 10-20s)');
      await pyodide.loadPackage(['numpy', 'pandas', 'scikit-learn', 'matplotlib']);
      await pyodide.runPythonAsync(`
import matplotlib
matplotlib.use('AGG')
`);
      return pyodide;
    })();
  }
  return _pyodidePromise;
}

const COLLECT_FIGURES_CODE = `
def __collect_figures_as_png_base64():
    import matplotlib.pyplot as plt
    import io, base64
    images = []
    for num in plt.get_fignums():
        fig = plt.figure(num)
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=110)
        buf.seek(0)
        images.append(base64.b64encode(buf.read()).decode('ascii'))
    plt.close('all')
    return images

__collect_figures_as_png_base64()
`;

async function runPython(code, outputEl, plotEl, statusEl, runBtn) {
  outputEl.textContent = '';
  outputEl.classList.remove('has-error');
  if (plotEl) plotEl.innerHTML = '';
  runBtn.disabled = true;
  statusEl.textContent = '⏳ wird vorbereitet …';

  try {
    const pyodide = await getPyodide(msg => { statusEl.textContent = '⏳ ' + msg; });

    statusEl.textContent = '⏳ wird ausgeführt …';
    pyodide.setStdout({ batched: (s) => { outputEl.textContent += s + '\n'; } });
    pyodide.setStderr({ batched: (s) => { outputEl.textContent += s + '\n'; } });

    await pyodide.runPythonAsync(code);

    if (plotEl) {
      const images = await pyodide.runPythonAsync(COLLECT_FIGURES_CODE);
      const imageList = images?.toJs ? images.toJs() : images;
      if (imageList && imageList.length) {
        imageList.forEach(b64 => {
          const img = document.createElement('img');
          img.src = 'data:image/png;base64,' + b64;
          img.className = 'code-output-plot-img';
          plotEl.appendChild(img);
        });
      }
    }

    statusEl.textContent = '✓ fertig';
    if (!outputEl.textContent.trim() && !(plotEl && plotEl.childElementCount)) {
      outputEl.textContent = '(kein Output – nutze print(), um Werte anzuzeigen)';
    }
  } catch (err) {
    outputEl.classList.add('has-error');
    outputEl.textContent += '\n' + String(err);
    statusEl.textContent = '✗ Fehler – siehe Ausgabe';
  } finally {
    runBtn.disabled = false;
  }
}

function initCodeExercises() {
  document.querySelectorAll('.code-exercise').forEach(ex => {
    const textarea = ex.querySelector('.code-input');
    const runBtn   = ex.querySelector('.run-btn');
    const resetBtn = ex.querySelector('.reset-btn');
    const output   = ex.querySelector('.code-output');
    const status   = ex.querySelector('.run-status');
    if (!textarea || !runBtn || !output) return;

    /* Container für matplotlib-Plots direkt nach der Ausgabe einfügen */
    let plot = ex.querySelector('.code-output-plot');
    if (!plot) {
      plot = document.createElement('div');
      plot.className = 'code-output-plot';
      output.insertAdjacentElement('afterend', plot);
    }

    const original = textarea.value;

    runBtn.addEventListener('click', () => runPython(textarea.value, output, plot, status, runBtn));

    resetBtn?.addEventListener('click', () => {
      textarea.value = original;
      output.textContent = '';
      output.classList.remove('has-error');
      plot.innerHTML = '';
      status.textContent = '';
    });

    /* Tab-Taste fügt 4 Leerzeichen ein statt Fokus zu wechseln */
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.slice(0, start) + '    ' + textarea.value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }
    });
  });
}

/* ════════════════════════════════════════════════════════
   Run-Button für statische Code-Zellen (.code-cell)
   ────────────────────────────────────────────────────────
   Fügt jeder .code-cell mit data-runnable="true" einen
   "▶ Ausführen"-Button neben "Kopieren" hinzu. Beim Klick
   wird der <code>-Text per Pyodide ausgeführt, Ausgabe und
   evtl. Plots erscheinen in einem aufklappbaren Live-Bereich
   direkt unter der Zelle.
   ════════════════════════════════════════════════════════ */
function initCodeCellRunners() {
  document.querySelectorAll('.code-cell[data-runnable="true"]').forEach(cell => {
    const codeEl = cell.querySelector('pre code');
    const header = cell.querySelector('.code-cell-header');
    if (!codeEl || !header) return;

    let actions = header.querySelector('.code-cell-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'code-cell-actions';
      const existingBtn = header.querySelector('.copy-btn');
      if (existingBtn) {
        existingBtn.replaceWith(actions);
        actions.appendChild(existingBtn);
      } else {
        header.appendChild(actions);
      }
    }

    const runBtn = document.createElement('button');
    runBtn.className = 'run-btn';
    runBtn.type = 'button';
    runBtn.textContent = '▶ Ausführen';
    actions.insertBefore(runBtn, actions.firstChild);

    const status = document.createElement('span');
    status.className = 'run-status';
    actions.insertBefore(status, runBtn.nextSibling);

    const live = document.createElement('div');
    live.className = 'code-cell-live';
    live.innerHTML = `
      <div class="code-cell-live-header">▶ Live-Ausgabe</div>
      <div class="code-cell-live-body">
        <pre class="live-output"></pre>
        <div class="code-output-plot"></div>
      </div>`;
    cell.appendChild(live);

    const outputEl = live.querySelector('.live-output');
    const plotEl = live.querySelector('.code-output-plot');

    runBtn.addEventListener('click', async () => {
      live.classList.add('active');
      await runPython(codeEl.textContent, outputEl, plotEl, status, runBtn);
    });
  });
}

/* ════════════════════════════════════════════════════════
   "Alles ausführen"-Button
   ────────────────────────────────────────────────────────
   Führt alle .code-cell[data-runnable="true"] der Seite
   sequenziell in Dokumentreihenfolge aus (gemeinsamer
   Pyodide-Namespace, wie beim einzelnen Ausführen) und
   blendet dabei jeweils die Live-Ausgabe ein.
   ════════════════════════════════════════════════════════ */
function initRunAllButton() {
  const cells = [...document.querySelectorAll('.code-cell[data-runnable="true"]')];
  if (!cells.length) return;

  const btn = document.createElement('button');
  btn.className = 'run-all-btn';
  btn.type = 'button';
  const originalLabel = `▶ Alle ${cells.length} Code-Zellen ausführen`;
  btn.textContent = originalLabel;
  document.body.appendChild(btn);

  btn.addEventListener('click', async () => {
    btn.disabled = true;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const codeEl  = cell.querySelector('pre code');
      const live    = cell.querySelector('.code-cell-live');
      const status  = cell.querySelector('.run-status');
      const runBtn  = cell.querySelector('.run-btn');
      const outputEl = live?.querySelector('.live-output');
      const plotEl   = live?.querySelector('.code-output-plot');
      if (!codeEl || !live || !outputEl || !runBtn) continue;

      btn.textContent = `⏳ Zelle ${i + 1}/${cells.length} …`;
      live.classList.add('active');
      cell.scrollIntoView({ behavior: 'smooth', block: 'center' });

      await runPython(codeEl.textContent, outputEl, plotEl, status, runBtn);
    }

    btn.textContent = '✓ Alle Zellen ausgeführt';
    setTimeout(() => { btn.textContent = originalLabel; btn.disabled = false; }, 2500);
  });
}

if (document.readyState !== 'loading') { initCodeExercises(); initCodeCellRunners(); initRunAllButton(); }
else document.addEventListener('DOMContentLoaded', () => { initCodeExercises(); initCodeCellRunners(); initRunAllButton(); });
