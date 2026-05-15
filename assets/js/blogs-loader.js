/* =========================================================
   Tau Intelligence — Blog / writings loader
   ---------------------------------------------------------
   Reads /content/blogs.json and renders writing cards.
   Each entry can be a PDF, a Markdown post, or an external
   link. PDFs and Markdown open in /blog.html?slug=…
   To add a new post:
     - Drop a PDF in /blogs/  +  optional sidecar .json
     - Or drop a Markdown file in /blogs/ with YAML frontmatter
     - Then run scripts/generate_manifest.py (or push — the
       GitHub Action does it automatically).
   ========================================================= */

(function () {
  const grid      = document.getElementById('blogs-grid');
  const filterBar = document.getElementById('filter-bar');
  const searchEl  = document.getElementById('search-input');
  if (!grid) return;

  let posts = [];
  let activeTag = 'all';
  let activeQuery = '';

  fetch('content/blogs.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      posts = (data.posts || []).slice().sort(byDateDesc);
      buildTagFilters(posts);
      render();
    })
    .catch(err => {
      console.warn('blogs.json not found or invalid', err);
      grid.innerHTML = '<div class="empty-state">No writings published yet. Drop a PDF or Markdown file in <code>/blogs</code>.</div>';
    });

  function byDateDesc(a, b) {
    return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
  }

  function buildTagFilters(list) {
    const tags = Array.from(new Set(list.flatMap(p => p.tags || []))).sort();
    tags.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.filter = t;
      btn.textContent = t;
      filterBar.appendChild(btn);
    });
    filterBar.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLButtonElement)) return;
      activeTag = t.dataset.filter;
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
    if (activeTag !== 'all' && !(p.tags || []).includes(activeTag)) return false;
    if (!activeQuery) return true;
    const hay = [p.title, p.summary, p.author, (p.tags || []).join(' ')].join(' ').toLowerCase();
    return hay.includes(activeQuery);
  }

  function render() {
    const visible = posts.filter(matches);
    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state">No matching writings.</div>';
      return;
    }
    grid.innerHTML = visible.map(cardHtml).join('');
  }

  function cardHtml(p) {
    const meta = [];
    (p.tags || []).slice(0, 3).forEach(t => meta.push(`<span class="tag">${escapeHtml(t)}</span>`));

    const href = resolveHref(p);
    const external = /^https?:/i.test(href) && p.type !== 'pdf';
    const target = external ? ' target="_blank" rel="noopener"' : '';

    return `
      <article class="card">
        <div class="meta">${meta.join('')}</div>
        <h3><a href="${escapeAttr(href)}"${target} style="color:inherit;">${escapeHtml(p.title || 'Untitled')}</a></h3>
        ${p.summary ? `<p class="abstract">${escapeHtml(p.summary)}</p>` : ''}
        <div class="links">
          <a href="${escapeAttr(href)}"${target}>${labelFor(p)} ↗</a>
          ${p.type === 'pdf' && p.url ? `<a href="${escapeAttr(p.url)}" target="_blank" rel="noopener">Download PDF</a>` : ''}
        </div>
      </article>
    `;
  }

  function resolveHref(p) {
    if (p.type === 'external') return p.url;
    if (p.type === 'pdf' && p.slug)      return `blog.html?slug=${encodeURIComponent(p.slug)}`;
    if (p.type === 'markdown' && p.slug) return `blog.html?slug=${encodeURIComponent(p.slug)}`;
    return p.url || '#';
  }

  function labelFor(p) {
    if (p.type === 'pdf')      return 'Read PDF';
    if (p.type === 'markdown') return 'Read post';
    return 'Read';
  }

  function formatDate(s) {
    const d = new Date(s);
    if (isNaN(d)) return escapeHtml(s);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
