'use strict';
// Vacancies page: filter by direction, one position open at a time, the application form.
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const form = $('#apply-form');

  const actions = {
    'vac-filter': (t) => {
      $$('[data-act="vac-filter"]').forEach((b) => b.setAttribute('aria-pressed', b === t));
      $$('.vac').forEach((v) => { v.hidden = t.dataset.dir !== 'all' && v.dataset.dir !== t.dataset.dir; });
    },
    'vac-toggle': (t) => {
      const card = t.closest('.vac');
      const open = !card.classList.contains('is-open');
      $$('.vac').forEach((v) => {
        const on = open && v === card;
        v.classList.toggle('is-open', on);
        v.querySelector('.drawer').classList.toggle('is-open', on);
        v.querySelector('.vac__toggle').setAttribute('aria-expanded', on);
      });
    },
    // the link itself scrolls to the form
    'vac-apply': (t) => { form.elements.position.value = t.dataset.pos; }
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (t && actions[t.dataset.act]) actions[t.dataset.act](t, e);
  });

  const fileName = $('#file-name');
  const fileHint = fileName.textContent;
  form.elements.cv.addEventListener('change', () => {
    const f = form.elements.cv.files[0];
    fileName.textContent = f ? f.name : fileHint;
  });

  // Applications are not delivered anywhere yet (see docs/knowledge.md, "Booking").
  window.SiteForm.bind(form, () => {
    $('#apply-pos').textContent = form.elements.position.value;
    form.hidden = true;
    $('#apply-done').hidden = false;
  });
})();
