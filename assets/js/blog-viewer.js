/* =========================================================
   Tau Intelligence — Single-post viewer
   ---------------------------------------------------------
   Reads ?slug=… from the URL, looks the post up in
   content/blogs.json, and renders either:
     - an embedded PDF (object tag)
     - the rendered Markdown, with first-class support for:
         · GitHub-flavoured tables, task lists, autolinks
         · Fenced code blocks with syntax highlighting
         · LaTeX math   $inline$  and  $$display$$
         · Figures with captions  (image title or italic line)
         · Side-by-side figure rows  (:::figures … :::)
         · GitHub-style admonitions (> [!note] | [!tip] | …)
   ========================================================= */

(function () {
  const titleEl = document.getElementById('article-title');
  const metaEl  = document.getElementById('article-meta');
  const bodyEl  = document.getElementById('article-body');
  if (!bodyEl) return;

  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) {
    bodyEl.innerHTML = '<div class="empty-state">No post specified.</div>';
    return;
  }

  fetch('content/blogs.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
      const post = (data.posts || []).find(p => p.slug === slug);
      if (!post) { bodyEl.innerHTML = '<div class="empty-state">Post not found.</div>'; return; }

      titleEl.textContent = post.title;
      const bits = [];
      if (post.date)   bits.push(formatDate(post.date));
      if (post.author) bits.push(post.author);
      if (post.tags && post.tags.length) bits.push(post.tags.join(' · '));
      metaEl.textContent = bits.join('  ·  ');
      document.title = post.title + ' — Tau Intelligence';

      if (post.type === 'pdf')           renderPdf(post);
      else if (post.type === 'markdown') renderMarkdown(post);
      else                                location.href = post.url;
    })
    .catch(err => {
      bodyEl.innerHTML = `<div class="empty-state">Failed to load index: ${escapeHtml(String(err))}</div>`;
    });

  // ----------------------------------------------------------------
  // PDF posts
  // ----------------------------------------------------------------
  function renderPdf(post) {
    bodyEl.innerHTML = `
      <object data="${escapeAttr(post.url)}#view=FitH" type="application/pdf" class="pdf-frame">
        <p style="padding:20px;">Your browser can't display embedded PDFs.
          <a href="${escapeAttr(post.url)}" target="_blank" rel="noopener">Open the PDF in a new tab →</a>
        </p>
      </object>
      <p style="margin-top:14px;"><a href="${escapeAttr(post.url)}" target="_blank" rel="noopener">Download original PDF ↗</a></p>
    `;
  }

  // ----------------------------------------------------------------
  // Markdown posts — full pipeline
  // ----------------------------------------------------------------
  function renderMarkdown(post) {
    loadMarked()
      .then(marked => fetch(post.url).then(r => r.text()).then(text => ({ marked, text })))
      .then(({ marked, text }) => {
        // 0. Parse YAML frontmatter for citation metadata, then strip it.
        const fm = parseFrontmatter(text);
        let src  = text.replace(/^---[\s\S]*?---\s*/m, '');

        // 2. Protect fenced code blocks and inline code from any further
        //    pre-processing — otherwise a custom block written *inside*
        //    a code fence (for documentation) would get rewritten.
        const codeBlocks = [];
        const protect = (re, prefix) => {
          src = src.replace(re, (m) => {
            const idx = codeBlocks.push({ kind: prefix, raw: m }) - 1;
            return `\u0000${prefix}${idx}\u0000`;
          });
        };
        protect(/```[\s\S]*?```/g, 'CODE');     // fenced blocks
        protect(/(?<!`)`[^`\n]+?`(?!`)/g, 'TICK'); // inline code

        // 3. Protect math regions (so `\theta`, `_t`, `\;` survive intact).
        const mathBlocks = [];
        const protectMath = (re) => {
          src = src.replace(re, (m) => {
            const idx = mathBlocks.push(m) - 1;
            return `\u0000MATH${idx}\u0000`;
          });
        };
        protectMath(/\$\$[\s\S]+?\$\$/g);
        protectMath(/(?<!\\)\$(?!\s)[^\n$]+?(?<!\s)\$/g);
        const hasMath = mathBlocks.length > 0;

        // 4. Pre-process custom blocks (callouts + figure rows)
        src = transformCallouts(src);
        src = transformFigureRows(src);

        // 5. Restore code so marked sees the original fences.
        src = src.replace(/\u0000(CODE|TICK)(\d+)\u0000/g, (_, k, i) => codeBlocks[+i].raw);

        // 6. Configure marked (GFM tables, task lists, autolinks)
        marked.setOptions({ gfm: true, breaks: false, mangle: false, headerIds: true });

        // 7. Render
        let html = marked.parse(src);

        // 8. Restore math placeholders (escape only HTML special chars).
        html = html.replace(/\u0000MATH(\d+)\u0000/g, (_, i) =>
          mathBlocks[+i].replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))
        );
        bodyEl.innerHTML = `<div class="md">${html}</div>`;

        // 9. Resolve relative URLs against the post's own directory.
        rewriteRelativeUrls(bodyEl, post.url);

        // 10. Append the auto-generated citation block.
        appendCitation(bodyEl.querySelector('.md'), post, fm);

        // 11. Post-process DOM (figures + code-block language labels)
        wrapFigures(bodyEl);
        labelCodeBlocks(bodyEl);

        // 12. Lazy-load enrichments (only if the post needs them)
        if (bodyEl.querySelector('pre code')) {
          loadHighlight().then(hljs => {
            bodyEl.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
          }).catch(() => {});
        }
        if (hasMath) {
          loadKatex().then(({ renderMathInElement }) => {
            renderMathInElement(bodyEl, {
              delimiters: [
                { left: '$$', right: '$$', display: true  },
                { left: '$',  right: '$',  display: false },
                { left: '\\[', right: '\\]', display: true  },
                { left: '\\(', right: '\\)', display: false },
              ],
              throwOnError: false,
            });
          }).catch(() => {});
        }
      })
      .catch(err => {
        bodyEl.innerHTML = `<div class="empty-state">Failed to load post: ${escapeHtml(String(err))}</div>`;
      });
  }

  // ----------------------------------------------------------------
  // Resolve relative URLs in <img src> and <a href> against the
  // post's own directory. Lets authors write `images/foo.png` next
  // to their markdown file, the way every editor expects.
  // ----------------------------------------------------------------
  function rewriteRelativeUrls(root, postUrl) {
    // Compute the directory that contains the markdown file.
    // postUrl is usually like "blogs/welcome.md".
    const baseDir = postUrl.replace(/[^/]+$/, ''); // -> "blogs/"
    const isAbs = (u) => !u || /^(?:[a-z]+:|\/\/|#|mailto:|data:)/i.test(u) || u.startsWith('/');

    root.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src');
      if (!isAbs(src)) img.setAttribute('src', baseDir + src);
    });
    root.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      // Anchor links (#…) and external/absolute links are left alone.
      // Relative links to other markdown posts: rewrite to blog.html?slug=…
      if (!href || isAbs(href)) return;
      if (/\.md(?:#.*)?$/i.test(href)) {
        const slug = href.replace(/\.md(?:#.*)?$/i, '').replace(/.*\//, '');
        const hash = (href.match(/#.*$/) || [''])[0];
        a.setAttribute('href', `blog.html?slug=${encodeURIComponent(slug)}${hash}`);
      } else {
        a.setAttribute('href', baseDir + href);
      }
    });
  }


  //   > [!note | tip | info | important | warning | danger | caution]
  //   > body…
  // ----------------------------------------------------------------
  const CALLOUT_TYPES = ['note','tip','info','important','warning','danger','caution'];
  const CALLOUT_GLYPH = {
    note: 'i', info: 'i', tip: '✸', important: '★',
    warning: '!', danger: '!', caution: '!',
  };

  function transformCallouts(src) {
    const lines = src.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; ) {
      const m = lines[i].match(/^\s*>\s*\[!(\w+)\]\s*(.*)$/i);
      if (m && CALLOUT_TYPES.includes(m[1].toLowerCase())) {
        const type = m[1].toLowerCase();
        const body = [m[2]];
        i++;
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          body.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        const inner = body.join('\n').trim();
        out.push(
          '',
          `<div class="callout callout-${type}">`,
          `<div class="callout-icon" aria-hidden="true">${CALLOUT_GLYPH[type] || 'i'}</div>`,
          `<div class="callout-body">\n\n${inner}\n\n</div>`,
          `</div>`,
          ''
        );
      } else {
        out.push(lines[i]);
        i++;
      }
    }
    return out.join('\n');
  }

  // ----------------------------------------------------------------
  // Figure rows:
  //   :::figures
  //   ![alt](a.png "Caption A")
  //   ![alt](b.png "Caption B")
  //   :::
  // ----------------------------------------------------------------
  function transformFigureRows(src) {
    return src.replace(/^:::figures\s*\n([\s\S]*?)\n:::\s*$/gm, (_, inner) => {
      // Ensure each non-empty line becomes its own paragraph so marked
      // wraps each image in its own <p> (instead of grouping adjacent
      // image lines into one paragraph).
      const spaced = inner.trim().split('\n').map(l => l.trim()).filter(Boolean).join('\n\n');
      return `\n<div class="figure-row">\n\n${spaced}\n\n</div>\n`;
    });
  }

  // ----------------------------------------------------------------
  // Wrap a lone <img> in <figure>. Caption sources, in priority:
  //   1. The image's title attribute  ![alt](url "Caption")
  //   2. An italic phrase on the line immediately after the image
  //      (works whether marked puts it in the same <p> as the image
  //      or in the next <p>):
  //        ![alt](url)
  //        *Caption text.*
  // ----------------------------------------------------------------
  function wrapFigures(root) {
    root.querySelectorAll('p > img').forEach(img => {
      const p = img.parentElement;
      if (!p) return;

      // Compose-the-caption from the image's title attribute first.
      let caption = img.getAttribute('title') || null;
      let captionHTML = null;
      let consumeNextP = false;

      // Case A: paragraph contains *only* the image
      const onlyChild =
        p.children.length === 1 && p.firstElementChild === img && p.textContent.trim() === '';

      // Case B: paragraph contains image + (optional whitespace/<br>) + <em>caption</em>
      let trailingEm = null;
      if (!onlyChild) {
        // Walk forward from the image: allow whitespace text nodes and <br>,
        // then exactly one <em>, then nothing else.
        let n = img.nextSibling;
        while (n && ((n.nodeType === 3 && !n.textContent.trim()) ||
                     (n.nodeType === 1 && n.tagName === 'BR'))) {
          n = n.nextSibling;
        }
        if (n && n.nodeType === 1 && n.tagName === 'EM') {
          let m = n.nextSibling;
          let trailingClean = true;
          while (m) {
            if (!(m.nodeType === 3 && !m.textContent.trim())) { trailingClean = false; break; }
            m = m.nextSibling;
          }
          if (trailingClean &&
              (img.previousSibling === null ||
               (img.previousSibling.nodeType === 3 && !img.previousSibling.textContent.trim()))) {
            trailingEm = n;
          }
        }
      }

      if (!onlyChild && !trailingEm) return; // not a recognisable figure pattern

      const fig = document.createElement('figure');
      fig.appendChild(img);

      if (caption) {
        img.removeAttribute('title');
        const fc = document.createElement('figcaption');
        fc.textContent = caption;
        fig.appendChild(fc);
      } else if (trailingEm) {
        captionHTML = trailingEm.innerHTML;
      } else {
        // Case A with no title: look at the *next* paragraph for an italic caption.
        const next = p.nextElementSibling;
        if (next && next.tagName === 'P'
            && next.children.length === 1
            && next.firstElementChild.tagName === 'EM'
            && next.textContent.trim() === next.firstElementChild.textContent.trim()) {
          captionHTML = next.firstElementChild.innerHTML;
          consumeNextP = next;
        }
      }

      if (captionHTML !== null) {
        const fc = document.createElement('figcaption');
        fc.innerHTML = captionHTML;
        fig.appendChild(fc);
      }
      p.replaceWith(fig);
      if (consumeNextP) consumeNextP.remove();
    });

    // Inside .figure-row, also unwrap each <p><img></p> into a <figure>
    // so flexbox can lay them out side-by-side.
    root.querySelectorAll('.figure-row > p > img').forEach(img => {
      const p = img.parentElement;
      const fig = document.createElement('figure');
      fig.appendChild(img);
      const titleCaption = img.getAttribute('title');
      if (titleCaption) {
        img.removeAttribute('title');
        const fc = document.createElement('figcaption');
        fc.textContent = titleCaption;
        fig.appendChild(fc);
      }
      p.replaceWith(fig);
    });
  }

  // ----------------------------------------------------------------
  // Add a small language label above each fenced code block.
  // ----------------------------------------------------------------
  function labelCodeBlocks(root) {
    root.querySelectorAll('pre > code[class*="language-"]').forEach(code => {
      const cls = [...code.classList].find(c => c.startsWith('language-'));
      if (!cls) return;
      code.parentElement.setAttribute('data-lang', cls.replace('language-', ''));
    });
  }

  // ----------------------------------------------------------------
  // Lazy CDN loaders (no bundler).
  // ----------------------------------------------------------------
  function loadMarked() {
    return loadScript('https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js')
      .then(() => window.marked);
  }
  function loadHighlight() {
    return Promise.all([
      loadStyle('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-dark.min.css'),
      loadScript('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js'),
    ]).then(() => window.hljs);
  }
  function loadKatex() {
    return Promise.all([
      loadStyle('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css'),
      loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js'),
    ])
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js'))
      .then(() => ({ renderMathInElement: window.renderMathInElement }));
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      if ([...document.scripts].some(s => s.src === src)) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed: ' + src));
      document.head.appendChild(s);
    });
  }
  function loadStyle(href) {
    return new Promise(res => {
      if ([...document.styleSheets].some(s => s.href === href)) return res();
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href; l.onload = res; l.onerror = res;
      document.head.appendChild(l);
    });
  }

  // ----------------------------------------------------------------
  // Citation block — appended to every markdown post.
  //
  // Sources of values, in priority order:
  //   1. Frontmatter `bibtex:` (a fully-formed entry, used verbatim)
  //   2. Frontmatter `bibtex_key:`, `doi:`, `url:` overrides
  //   3. Auto-generated from title / author / date / current page URL
  //
  // Authors who don't want a citation block on a particular post can
  // set `cite: false` in the frontmatter.
  // ----------------------------------------------------------------
  function appendCitation(root, post, fm) {
    if (!root) return;
    if (fm.cite === 'false' || fm.cite === false) return;

    const url   = (fm.url && /^https?:/i.test(fm.url))
                  ? fm.url
                  : (location.origin + location.pathname + '?slug=' + encodeURIComponent(post.slug));
    const date  = post.date || fm.date || '';
    const year  = (date.match(/\d{4}/) || [new Date().getFullYear()])[0];
    const author = post.author || fm.author || 'Tau Intelligence';
    const title  = post.title  || fm.title  || 'Untitled';

    // Plain-text (Chicago-ish, fits a blog).
    const textCite = `${author}. "${title}." Tau Intelligence (blog), ${formatLongDate(date) || year}. ${url}`;

    // BibTeX
    let bib;
    if (fm.bibtex && fm.bibtex.trim()) {
      bib = fm.bibtex.trim();
    } else {
      const key = (fm.bibtex_key || `tauintelligence_${post.slug}_${year}`).replace(/[^A-Za-z0-9_:-]/g, '');
      const fields = [
        `  title    = {${escapeBib(title)}}`,
        `  author   = {${escapeBib(author)}}`,
        `  year     = {${year}}`,
        `  month    = {${monthName(date) || 'jan'}}`,
        `  url      = {${url}}`,
        `  journal  = {Tau Intelligence (blog)}`,
        fm.doi ? `  doi      = {${escapeBib(fm.doi)}}` : null,
      ].filter(Boolean).join(',\n');
      bib = `@misc{${key},\n${fields}\n}`;
    }

    const sec = document.createElement('section');
    sec.className = 'cite';
    sec.setAttribute('aria-label', 'Cite this post');
    sec.innerHTML = `
      <h3 class="cite-title">Cite this post</h3>
      <div class="cite-block">
        <div class="cite-head">
          <span class="cite-label">Plain text</span>
          <button type="button" class="cite-copy" data-target="cite-text">Copy</button>
        </div>
        <p class="cite-text" id="cite-text"></p>
      </div>
      <div class="cite-block">
        <div class="cite-head">
          <span class="cite-label">BibTeX</span>
          <button type="button" class="cite-copy" data-target="cite-bib">Copy</button>
        </div>
        <pre class="cite-bib"><code id="cite-bib"></code></pre>
      </div>
    `;
    sec.querySelector('#cite-text').textContent = textCite;
    sec.querySelector('#cite-bib').textContent  = bib;

    sec.querySelectorAll('.cite-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = sec.querySelector('#' + btn.dataset.target);
        if (!target) return;
        const text = target.textContent;
        const done = () => {
          const original = btn.textContent;
          btn.textContent = 'Copied';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
        } else {
          fallbackCopy(text, done);
        }
      });
    });

    root.appendChild(sec);
  }

  function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta); cb();
  }

  function escapeBib(s) {
    // Minimal BibTeX escaping: keep braces balanced, escape special chars.
    return String(s).replace(/[{}\\]/g, '');
  }
  function monthName(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    return ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][d.getMonth()];
  }
  function formatLongDate(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ----------------------------------------------------------------
  // Tiny YAML frontmatter parser — flat scalars, ints, ISO dates,
  // inline lists `[a, b, c]`, and multi-line block scalars (` |` / ` >`).
  // ----------------------------------------------------------------
  function parseFrontmatter(text) {
    const m = /^---\s*\n([\s\S]*?)\n---/.exec(text);
    if (!m) return {};
    const lines = m[1].split('\n');
    const out = {};
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const km = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
      if (!km) continue;
      const key = km[1];
      let val = km[2];
      // Block scalar: `key: |` or `key: >` collects indented lines.
      if (val === '|' || val === '>') {
        const block = [];
        let j = i + 1;
        while (j < lines.length && (lines[j].startsWith('  ') || lines[j] === '')) {
          block.push(lines[j].replace(/^  /, ''));
          j++;
        }
        out[key] = block.join(val === '>' ? ' ' : '\n').trim();
        i = j - 1;
        continue;
      }
      out[key] = coerceFM(val.trim());
    }
    return out;
  }
  function coerceFM(v) {
    if (!v) return '';
    if (v.startsWith('[') && v.endsWith(']')) {
      const inner = v.slice(1, -1).trim();
      return inner ? inner.split(',').map(s => stripQ(s.trim())) : [];
    }
    return stripQ(v);
  }
  function stripQ(s) {
    if (s.length >= 2 && s[0] === s[s.length-1] && (s[0] === '"' || s[0] === "'")) {
      return s.slice(1, -1);
    }
    return s;
  }

  // ----------------------------------------------------------------
  function formatDate(s) {
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
