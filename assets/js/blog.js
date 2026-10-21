'use strict';
// Blog page: rubric filter, and one article at a time chosen by the address hash (blog.html#klkt).
(function () {
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const baseTitle = document.title;

  function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    const article = id && document.getElementById('post-' + id);
    $$('[data-view="list"]').forEach((el) => { el.hidden = !!article; });
    document.getElementById('read').hidden = !article;
    $$('.article').forEach((a) => { a.hidden = a !== article; });
    document.title = article ? article.dataset.title + ' — ВестМедСервис' : baseTitle;
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act="blog-tab"]');
    if (!t) return;
    $$('[data-act="blog-tab"]').forEach((b) => b.setAttribute('aria-pressed', b === t));
    $$('.post[data-cat]').forEach((p) => { p.hidden = t.dataset.cat !== 'all' && p.dataset.cat !== t.dataset.cat; });
  });
  window.addEventListener('hashchange', route);
  if (location.hash) route();
})();
