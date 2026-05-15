/* =========================================================
   Tau Intelligence — Research / publications loader
   ---------------------------------------------------------
   Reads /content/papers.json and renders publication cards.
   Provides venue filtering and free-text search.

   To add a new paper:
     1. Drop the PDF into /papers/  (optional)
     2. Add an entry to content/papers.json
   Or run scripts/generate_manifest.py to auto-scan.
   ========================================================= */

(function () {
  const grid       = document.getElementById('papers-grid');
  const filterBar  = document.getElementById('filter-bar');
  const searchEl   = document.getElementById('search-input');
  if (!grid) return;

  let papers = [];
  let activeVenue = 'all';
  let activeQuery = '';

  fetch('content/papers.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      papers = (data.papers || []).slice().sort(byYearDesc);
      buildVenueFilters(papers);
      render();
    })
    .catch(err => {
      console.warn('papers.json not found or invalid', err);
      grid.innerHTML = '<div class="empty-state">No publications listed yet. Add entries to <code>content/papers.json</code>.</div>';
    });

  function byYearDesc(a, b) {
    return (b.year || 0) - (a.year || 0);
  }

  function buildVenueFilters(list) {
    const venues = Array.from(new Set(list.map(p => p.venue).filter(Boolean))).sort();
    venues.forEach(v => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.filter = v;
      btn.textContent = v;
      filterBar.appendChild(btn);
    });
    filterBar.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLButtonElement)) return;
      activeVenue = t.dataset.filter;
      filterBar.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === t));
      render();
    });
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        activeQuery = searchEl.value.trim().toLowerCase();
        render();
      });
    }
  }

  function matches(p) {
    if (activeVenue !== 'all' && p.venue !== activeVenue) return false;
    if (!activeQuery) return true;
    const hay = [
      p.title, p.abstract, (p.authors || []).join(' '),
      (p.tags || []).join(' '), p.venue, String(p.year)
    ].join(' ').toLowerCase();
    return hay.includes(activeQuery);
  }

  function render() {
    const visible = papers.filter(matches);
    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state">No matching publications.</div>';
      return;
    }
    grid.innerHTML = visible.map(cardHtml).join('');
  }

  function cardHtml(p) {
    const meta = [];
    if (p.venue) meta.push(`<span>${escapeHtml(p.venue)}</span>`);
    if (p.year)  meta.push(`<span>${escapeHtml(String(p.year))}</span>`);
    (p.tags || []).slice(0, 3).forEach(t => meta.push(`<span class="tag">${escapeHtml(t)}</span>`));

    const links = [];
    const L = p.links || {};
    if (L.pdf)     links.push(linkHtml(L.pdf,     'PDF'));
    if (L.arxiv)   links.push(linkHtml(L.arxiv,   'arXiv'));
    if (L.code)    links.push(linkHtml(L.code,    'Code'));
    if (L.project) links.push(linkHtml(L.project, 'Project page'));
    if (L.bibtex)  links.push(linkHtml(L.bibtex,  'BibTeX'));

    return `
      <article class="card">
        <div class="meta">${meta.join('')}</div>
        <h3>${escapeHtml(p.title || 'Untitled')}</h3>
        ${p.authors ? `<p class="authors">${escapeHtml(p.authors.join(', '))}</p>` : ''}
        ${p.abstract ? `<p class="abstract">${escapeHtml(p.abstract)}</p>` : ''}
        ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
      </article>
    `;
  }

  function linkHtml(href, label) {
    const external = /^https?:/i.test(href);
    return `<a href="${escapeAttr(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(label)} ↗</a>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
