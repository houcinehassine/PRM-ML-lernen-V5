#!/usr/bin/env python3
"""
generate_search_index.py
────────────────────────
Liest alle HTML-Seiten der PRM V5-Website und erstellt search-index.json
für die clientseitige Volltext-Suche (header.js).

Im Gegensatz zur alten Version (nur Titel/Headings/Code-Begriffe pro Seite)
wird hier PRO ABSCHNITT (Stufe / Quiz-Sektion / Pruef-Sektion) ein eigener
Eintrag mit Volltext, Tags und Anker-Link erzeugt — die Suche findet also
auch Inhalte mitten in einer Seite und springt direkt dorthin.

Verwendung:
    pip3 install beautifulsoup4
    python3 assets/generate_search_index.py

Ausgabe: search-index.json (im Projekt-Root)
"""

import json
import re
import unicodedata
from pathlib import Path

from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).parent.parent

KAPITEL_NAMEN = {
    "Kapitel1": "K1 · Data Preparation",
    "Kapitel2": "K2 · ML Grundlagen",
    "Kapitel3": "K3 · Support Vector Machines",
    "Kapitel4": "K4 · Clustering & PCA",
    "Kapitel5": "K5 · Random Forest & Boosting",
    "Kapitel6": "K6 · GMM & EM",
    "Kapitel7": "K7 · Evaluation",
    "Pruefung": "🆘 Prüfung",
}

CODE_SIGNALS = re.compile(
    r'\b(sklearn|import|def |class |fit\(|predict\(|numpy|pandas|matplotlib|'
    r'pipeline|GridSearchCV|RandomForest|SVC|KMeans|accuracy_score)\b', re.I)

FORMEL_SIGNALS = re.compile(
    r'(\\frac|\\sum|\\prod|\\int|σ|μ|θ|∑|∫|∂|∝|≈|≤|≥|argmin|argmax)', re.I)

_PY_IDENT = re.compile(r'\b([a-zA-Z_][a-zA-Z0-9_]{2,35})\b')
_PY_STOPWORDS = {
    'True', 'False', 'None', 'import', 'from', 'class', 'def', 'for', 'while',
    'if', 'else', 'elif', 'try', 'except', 'finally', 'with', 'return', 'print',
    'range', 'len', 'self', 'args', 'kwargs', 'pass', 'raise', 'yield', 'lambda',
    'assert', 'break', 'continue', 'and', 'not', 'or', 'in', 'as',
}


def clean_text(text, max_chars=320):
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) > max_chars:
        text = text[:max_chars].rsplit(' ', 1)[0] + '…'
    return text


def slugify(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    text = re.sub(r'[^a-zA-Z0-9]+', '-', text).strip('-').lower()
    return text


def detect_type(el):
    html = str(el)
    if el.find(['pre', 'code']):
        return 'code'
    if FORMEL_SIGNALS.search(html):
        return 'formel'
    if CODE_SIGNALS.search(html):
        return 'code'
    return 'konzept'


def extract_tags(el, title=''):
    tags = set()
    for code in el.find_all('code'):
        if code.find_parent('pre'):
            continue
        t = code.get_text(strip=True)
        if 2 < len(t) < 40:
            tags.add(t)
    for pre in el.find_all('pre'):
        for ident in _PY_IDENT.findall(pre.get_text()):
            if ident not in _PY_STOPWORDS and ('_' in ident or ident[0].isupper()):
                tags.add(ident)
    for word in re.findall(r'\b\w{5,}\b', title):
        tags.add(word)
    return sorted(tags)[:25]


def extract_lang(code_tag):
    for c in code_tag.get('class', []):
        if c.startswith('language-'):
            return c[len('language-'):]
    return 'text'


def attach_code(entry, el):
    """Hängt vollständigen Code (für Code-Karten auf der Suchseite) an einen Eintrag an."""
    pre = el.find('pre')
    if pre:
        code_tag = pre.find('code') or pre
        entry['code'] = code_tag.get_text()
        entry['lang'] = extract_lang(code_tag)
    return entry


def page_h1(soup):
    h1 = soup.find('h1')
    return clean_text(h1.get_text()) if h1 else ''


def make_entry(chapter, page, title, h1, text_el, url, anchor):
    text_el_type = detect_type(text_el)
    return {
        "chapter": chapter,
        "page": page,
        "title": title,
        "h1": h1,
        "text": clean_text(text_el.get_text()),
        "tags": extract_tags(text_el, title),
        "type": text_el_type,
        "url": url,
        "anchor": anchor,
    }


def index_topic_page(soup, chapter, rel_url):
    """T0X-*.html — ein Eintrag pro .stufe-Block."""
    entries = []
    h1 = page_h1(soup)

    for stufe in soup.find_all('div', class_='stufe'):
        stufe_id = stufe.get('id', '')
        if not stufe_id:
            continue
        title_el = stufe.find(class_='stufe-title')
        label_el = stufe.find(class_='stufe-label')
        title = clean_text(title_el.get_text()) if title_el else stufe_id
        if label_el:
            title = f"{clean_text(label_el.get_text())} · {title}"

        body = stufe.find(class_='stufe-body') or stufe
        entries.append(make_entry(chapter, h1, title, h1, body, rel_url, f"#{stufe_id}"))

        # Sub-Abschnitte (h3) zusätzlich als eigene Treffer mit demselben Anker,
        # damit spezifische Begriffe (z.B. "random_state") gut matchen.
        for h3 in body.find_all('h3'):
            sub_title = clean_text(h3.get_text())
            # Geschwister-Elemente bis zum nächsten h3 sammeln (für Text + Tags)
            siblings = []
            for sib in h3.find_next_siblings():
                if sib.name == 'h3':
                    break
                if isinstance(sib, Tag):
                    siblings.append(sib)
            chunk_text = clean_text(' '.join(s.get_text(' ') for s in siblings))
            if len(chunk_text) < 20:
                continue
            tags = set(extract_tags(h3, sub_title))
            sec_type = 'konzept'
            for s in siblings:
                tags |= set(extract_tags(s))
                if detect_type(s) != 'konzept':
                    sec_type = detect_type(s)
            entries.append({
                "chapter": chapter,
                "page": h1,
                "title": f"{title} — {sub_title}",
                "h1": h1,
                "text": chunk_text,
                "tags": sorted(tags)[:25],
                "type": sec_type,
                "url": rel_url,
                "anchor": f"#{stufe_id}",
            })

        # Jede Code-Zelle zusätzlich als eigener Treffer mit vollständigem Code,
        # damit die Suchseite die komplette Zelle anzeigen kann.
        for cell in body.find_all('div', class_='code-cell'):
            pre = cell.find('pre')
            if not pre:
                continue
            code_tag = pre.find('code') or pre
            code_text = code_tag.get_text()
            label_el = cell.find(class_='cell-lang')
            cell_label = clean_text(label_el.get_text()) if label_el else 'Code-Zelle'
            entries.append({
                "chapter": chapter,
                "page": h1,
                "title": f"{title} — {cell_label}",
                "h1": h1,
                "text": clean_text(code_text, 600),
                "tags": extract_tags(cell, cell_label),
                "type": "code",
                "url": rel_url,
                "anchor": f"#{stufe_id}",
                "code": code_text,
                "lang": extract_lang(code_tag),
                "cell_label": cell_label,
            })

    return entries


def index_quiz_page(soup, chapter, rel_url):
    """Quiz.html — ein Eintrag pro <section id=...> (= Themenblock), plus pro Frage."""
    entries = []
    h1 = page_h1(soup)
    eyebrow = soup.find(class_='eyebrow')
    page_label = clean_text(eyebrow.get_text()) if eyebrow else 'Quiz'

    for section in soup.find_all('section', id=True):
        h2 = section.find('h2')
        sec_title = clean_text(h2.get_text()) if h2 else section['id']
        anchor = f"#{section['id']}"

        for details in section.find_all('details', class_='frage'):
            summary = details.find('summary')
            antwort = details.find(class_='frage-antwort')
            q_num_el = details.find(class_='quiz-q-num')
            q_num = clean_text(q_num_el.get_text()) if q_num_el else ''
            frage_text = clean_text(summary.get_text()) if summary else ''
            antwort_text = clean_text(antwort.get_text()) if antwort else ''
            full_text = clean_text(f"{frage_text} {antwort_text}", 320)
            entries.append({
                "chapter": chapter,
                "page": f"{page_label} — {sec_title}",
                "title": f"{q_num} {frage_text}".strip(),
                "h1": f"🧠 {h1}",
                "text": full_text,
                "tags": extract_tags(details, frage_text),
                "type": "konzept",
                "url": rel_url,
                "anchor": anchor,
            })

    return entries


def index_pruef_page(soup, chapter, rel_url):
    """Pruefung/*.html — ein Eintrag pro Section mit id (.pruef-section / .cheat-section)."""
    entries = []
    h1 = page_h1(soup)

    for section in soup.find_all('section', id=True):
        h2 = section.find(re.compile(r'^h[1-3]$'))
        sec_title = clean_text(h2.get_text()) if h2 else section['id']
        anchor = f"#{section['id']}"

        # Top-Level-Eintrag für die ganze Section (Übersicht)
        entries.append(make_entry(chapter, h1, sec_title, h1, section, rel_url, anchor))

        # Zusätzlich: jede .cmd-card / .cheat-formula / .info-box / .ref / .ref-ex einzeln,
        # damit einzelne Befehle/Formeln gut auffindbar sind.
        for card in section.find_all(class_=re.compile(r'^cmd-card$|cheat-formula|info-box|^ref$|^ref-ex$')):
            head = card.find(class_=re.compile(r'cmd-head|cheat-formula-head|ref-name|ref-sub'))
            card_title = clean_text(head.get_text()) if head else sec_title
            card_text = clean_text(card.get_text())
            if len(card_text) < 15:
                continue
            card_entry = {
                "chapter": chapter,
                "page": h1,
                "title": f"{sec_title} — {card_title}" if head else sec_title,
                "h1": h1,
                "text": card_text,
                "tags": extract_tags(card, card_title),
                "type": detect_type(card),
                "url": rel_url,
                "anchor": anchor,
            }
            attach_code(card_entry, card)
            entries.append(card_entry)

    return entries


def index_overview_page(soup, chapter, rel_url):
    """Kapitel*.html, index.html, Pruefung.html — ein Eintrag für die ganze Seite."""
    h1 = page_h1(soup)
    main = soup.find('main') or soup.find('body')
    return [make_entry(chapter, h1, h1, h1, main, rel_url, "")]


def main():
    index = []

    for kapitel_dir in sorted(ROOT.iterdir()):
        if not kapitel_dir.is_dir():
            continue
        name = kapitel_dir.name
        if not (re.match(r'Kapitel\d', name) or name == 'Pruefung'):
            continue
        chapter = KAPITEL_NAMEN.get(name, name)

        for html_file in sorted(kapitel_dir.glob('*.html')):
            rel_url = f"{name}/{html_file.name}"
            soup = BeautifulSoup(html_file.read_text(encoding='utf-8'), 'html.parser')

            if html_file.name == 'Quiz.html':
                entries = index_quiz_page(soup, chapter, rel_url)
            elif name == 'Pruefung' and html_file.name not in ('Pruefung.html',):
                entries = index_pruef_page(soup, chapter, rel_url)
            elif html_file.name.startswith('T') and re.match(r'T\d', html_file.name):
                entries = index_topic_page(soup, chapter, rel_url)
            else:
                entries = index_overview_page(soup, chapter, rel_url)

            index.extend(entries)
            print(f"  ✓ {rel_url:45} {len(entries):3} Einträge")

    # index.html (Root)
    idx_file = ROOT / 'index.html'
    if idx_file.exists():
        soup = BeautifulSoup(idx_file.read_text(encoding='utf-8'), 'html.parser')
        entries = index_overview_page(soup, 'Start', 'index.html')
        index.extend(entries)
        print(f"  ✓ {'index.html':45} {len(entries):3} Einträge")

    out = ROOT / 'search-index.json'
    out.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"\n✅ {len(index)} Einträge → {out.name} ({out.stat().st_size / 1024:.1f} KB)")

    # search-index.js — für file://-Öffnung (fetch() blockiert auf file://)
    js_out = ROOT / 'search-index.js'
    js_out.write_text(
        'window.__searchIndex__ = ' + json.dumps(index, ensure_ascii=False) + ';',
        encoding='utf-8'
    )
    print(f"✅ search-index.js ({js_out.stat().st_size / 1024:.1f} KB)")


if __name__ == '__main__':
    main()
