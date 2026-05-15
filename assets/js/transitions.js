/* =========================================================
   Tau Intelligence — page transition (slide + fade)
   ---------------------------------------------------------
   Intercepts internal nav clicks, fades + slides the page
   content out, navigates, then fades + slides the new page
   content in.  No Three.js coupling, no warp, just CSS
   transforms.
   ========================================================= */
(function () {
  var NAV_ORDER = ['index.html', 'research.html', 'blogs.html', 'demos.html', 'about.html'];
  var TRANSITION_MS = 420;

  var currentPath = location.pathname.split('/').pop() || 'index.html';
  if (currentPath === 'blog.html') currentPath = 'blogs.html';
  var currentIdx = NAV_ORDER.indexOf(currentPath);
  if (currentIdx === -1) currentIdx = 0;

  // --- Wrap all body content (except canvas + scripts) -----------
  var pageWrap = document.createElement('div');
  pageWrap.className = 'page-transition-wrap';
  var canvasEl = document.getElementById('hero-canvas');
  var ref = canvasEl ? canvasEl.nextSibling : document.body.firstChild;
  document.body.insertBefore(pageWrap, ref);

  var children = Array.from(document.body.children);
  children.forEach(function (child) {
    if (child === canvasEl || child === pageWrap) return;
    if (child.tagName === 'SCRIPT' || child.tagName === 'LINK') return;
    pageWrap.appendChild(child);
  });

  // --- ARRIVAL: fade + slide in ----------------------------------
  var arrival = sessionStorage.getItem('tau-nav-dir');
  sessionStorage.removeItem('tau-nav-dir');

  if (arrival) {
    var fromX = arrival === 'left' ? '40px' : '-40px';
    pageWrap.style.opacity = '0';
    pageWrap.style.transform = 'translateX(' + fromX + ')';
    // Force layout, then transition to final position
    void pageWrap.offsetWidth;
    pageWrap.style.transition = 'opacity .4s ease-out, transform .4s ease-out';
    pageWrap.style.opacity = '1';
    pageWrap.style.transform = 'translateX(0)';
  } else {
    // Normal load (direct visit, refresh) — gentle fade in only
    pageWrap.style.opacity = '0';
    void pageWrap.offsetWidth;
    pageWrap.style.transition = 'opacity .35s ease-out';
    pageWrap.style.opacity = '1';
  }

  // --- DEPARTURE: intercept clicks, fade + slide out, navigate ---
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || /^(https?:|mailto:|#)/.test(href)) return;

    var targetFile = href.split('/').pop().split('?')[0].split('#')[0];
    if (targetFile === currentPath) return;

    var targetIdx = NAV_ORDER.indexOf(targetFile);
    if (targetFile === 'blog.html') targetIdx = NAV_ORDER.indexOf('blogs.html');
    // If the link isn't in NAV_ORDER, still animate but default direction
    if (targetIdx === -1) targetIdx = currentIdx + 1;

    e.preventDefault();

    var direction = (targetIdx >= currentIdx) ? 'left' : 'right';
    sessionStorage.setItem('tau-nav-dir', direction);

    var toX = direction === 'left' ? '-40px' : '40px';
    pageWrap.style.transition = 'opacity .35s ease-in, transform .35s ease-in';
    pageWrap.style.opacity = '0';
    pageWrap.style.transform = 'translateX(' + toX + ')';

    setTimeout(function () {
      location.href = href;
    }, TRANSITION_MS);
  });
})();
