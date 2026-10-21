'use strict';
// Documents page: document summaries, guarantee tables by direction, visit rules two at a time.
(function () {
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function showRules(page) {
    $$('.rule').forEach((el) => { el.hidden = +el.dataset.page !== page; });
    $$('[data-act="rule-page"]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.page === page));
  }

  const actions = {
    // one summary open at a time; closing scrolls the card back into view
    'doc-toggle': (t) => {
      const card = t.closest('.legal');
      const open = !card.classList.contains('is-open');
      $$('.legal').forEach((c) => {
        const on = open && c === card;
        c.classList.toggle('is-open', on);
        c.querySelector('.drawer').classList.toggle('is-open', on);
        const btn = c.querySelector('[data-act="doc-toggle"]');
        btn.setAttribute('aria-expanded', on);
        btn.textContent = on ? 'Свернуть' : 'Кратко о документе';
      });
      if (!open) requestAnimationFrame(() => requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' })));
    },
    'guar-tab': (t) => {
      $$('[data-act="guar-tab"]').forEach((b) => b.setAttribute('aria-pressed', b === t));
      $$('[data-guar]').forEach((p) => { p.hidden = p.dataset.guar !== t.dataset.tab; });
    },
    'rule-page': (t) => showRules(+t.dataset.page)
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (t && actions[t.dataset.act]) actions[t.dataset.act](t, e);
  });

  showRules(0);
})();
