'use strict';
// Page behaviour: header, tooth picker, services panel, selected-services cart,
// doctors carousel, booking form. Content comes from data.js.
(function () {
  const D = window.SITE_DATA;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- text helpers ---------- */
  // Russian line breaks: short words stick to the next word, particles and dashes to the previous one,
  // numbers to the word after them; repeated until stable so chains like «и в 6 месяцев» glue whole
  const SHORT = 'и|а|но|да|в|во|с|со|к|ко|о|об|обо|у|из|за|на|по|до|от|для|без|под|над|при|про|изо|или|не|ни|то|что|как|их|его|её|ее|мы|вы|он|она|оно|они|я|это|так|все|всё|вас|вам|нас|нам|раз';
  const SHORT_RE = new RegExp(`(^|[\\s(«"—])(${SHORT}) (?=\\S)`, 'gi');
  const glue = (s) => {
    let t = String(s || '');
    let prev;
    do {
      prev = t;
      t = t.replace(SHORT_RE, '$1$2 ')
        .replace(/(\S) (ли|же|бы|ль)(?=[\s.,!?:;)]|$)/g, '$1 $2')
        .replace(/(\S) ([—–])/g, '$1 $2')
        .replace(/(^|[^\d-])(\d+) (?=[а-яёА-ЯЁ%])/g, '$1$2 ')
        .replace(/(^|[\s(«])(г|ул|д|т|им|см|пр)\. /g, '$1$2. ');
    } while (t !== prev);
    return t;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
  const servicesWord = (n) => plural(n, 'услуга', 'услуги', 'услуг');
  const doctorsWord = (n) => plural(n, 'врач', 'врача', 'врачей');
  const initials = (name) => name.split(' ').slice(0, 2).map((w) => w[0]).join('');
  const person = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.8-4.2 3.8-6.5 7.5-6.5s6.7 2.3 7.5 6.5"/></svg>`;
  const icon = (id, size, stroke) => `<svg class="ic" width="${size}" height="${size}" stroke-width="${stroke}" aria-hidden="true"><use href="#${id}"/></svg>`;

  /* ---------- constants ---------- */
  const WISDOM = [1, 16, 17, 32];
  const SPY = ['calm', 'services', 'doctors', 'clinics'];
  const SVC_LIMIT = 6;
  const DOCS_PER_PAGE = 4;
  const DOC_LIMIT = 3;
  const STEPS = ['Услуги', 'Врач', 'Запись'];
  // the same values as the booking form's time radios in index.html
  const TIMES = [['утром', 'Утром'], ['днём', 'Днём'], ['вечером', 'Вечером'], ['любое', 'Любое']];
  const CONSULT = 'Консультация специалистов';
  const CONSULT_SUBS = [['Терапевт', 'Консультация терапевта'], ['Ортопед', 'Консультация ортопеда'], ['Хирург', 'Консультация хирурга'], ['Ортодонт', 'Консультация ортодонта']];
  const CONSULT_ROLE = { 'Консультация терапевта': 'ther', 'Консультация ортопеда': 'orth', 'Консультация хирурга': 'surg', 'Консультация ортодонта': 'ortd' };
  const isConsult = (n) => !!CONSULT_ROLE[n];
  const ROLE_NAME = { ther: 'терапевт', orth: 'ортопед', surg: 'хирург', ortd: 'ортодонт' };
  const BOOKABLE = ['ther', 'orth', 'surg', 'ortd'];

  /* ---------- state ---------- */
  const state = {
    tooth: null, scope: null, skipTooth: false, symptom: null, recAll: false,
    cat: null, svcOpen: null, svcMore: null, svcAll: false, docsAll: false,
    svcStep: 1, docPick: null, cart: [], cartOpen: false,
    docPage: 0,
    time: 'любое', sent: false
  };
  function set(patch) {
    Object.assign(state, patch);
    if (!state.cart.length) state.cartOpen = false;
    render();
  }

  const inCart = (n) => state.cart.some((x) => x.n === n);
  const catById = (id) => D.cats.find((c) => c.id === id);
  const catOfService = (n) => (D.cats.find((c) => c.items.includes(n)) || { name: '' }).name;
  const currentSymptom = () => D.symptoms.find((x) => x.id === state.symptom) || null;
  // doctors are picked by id: names are empty until the clinic sends them, so the speciality stands in
  const docById = (id) => D.doctors.find((d) => d.id === id);
  const docsFor = (roles) => D.doctors.filter((d) => roles.includes(d.role));
  const docTitle = (d) => d.name || d.spec;
  // with nothing picked (a plain check-up) the booking goes to the therapist
  const docLabel = () => docTitle(docById(state.docPick || 'ther'));
  const docAvatar = (d, size) => (d.name ? initials(d.name) : person(size));
  // who sees patients in a category; in diagnostics, whoever does the ticked consultation
  const catRoles = (cat, cart) => (cat.id === 'diag' ? cart.filter((x) => CONSULT_ROLE[x.n]).map((x) => CONSULT_ROLE[x.n]) : cat.roles);
  // the doctor picked automatically: the first one found, in the order of the roles
  const autoDoc = (roles) => { for (const r of roles) { const d = D.doctors.find((x) => x.role === r); if (d) return d.id; } return null; };

  // Rebuilds el only when its structure key changes; keeps keyboard focus on the same [data-focus] item.
  function mount(el, key, build) {
    if (el.dataset.key === key) return false;
    const a = document.activeElement;
    const f = a && el.contains(a) ? a.dataset.focus : null;
    el.innerHTML = build();
    el.dataset.key = key;
    if (f) {
      const t = $$('[data-focus]', el).find((x) => x.dataset.focus === f);
      if (t) t.focus({ preventScroll: true });
    }
    return true;
  }
  function scrollToId(id) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  /* ---------- header ---------- */
  const hdr = $('#hdr');

  /* ---------- tooth picker ---------- */
  const jaw = $('#jaw');
  const qn = (n) => (n <= 8 ? 9 - n : n <= 16 ? n - 8 : n <= 24 ? 25 - n : n - 24); // number within the quadrant
  const sideOf = (n) => (n <= 8 || n >= 25 ? 'справа' : 'слева');
  const jawOf = (n) => (n <= 16 ? 'сверху' : 'снизу');
  const pct = (v, total) => Math.round(v / total * 10000) / 100;

  function buildTeeth() {
    const map = $('#jaw-map');
    D.teeth.forEach(([n, x, y, w, h, cx, cy, d]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tooth';
      b.dataset.act = 'tooth';
      b.dataset.tooth = n;
      b.setAttribute('aria-label', `Зуб ${qn(n)}, ${D.toothNames[n]}, ${sideOf(n)} ${jawOf(n)}`);
      b.setAttribute('aria-pressed', 'false');
      b.style.cssText = `left:${pct(x, 1536)}%;top:${pct(y, 1024)}%;width:${pct(w, 1536)}%;height:${pct(h, 1024)}%`;
      b.innerHTML = `<svg viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="tooth__shape" d="${d}"/></svg>`
        + `<span class="tooth__n" style="left:${cx}%;top:${cy}%">${qn(n)}</span>`;
      map.appendChild(b);
    });
  }

  function renderPicker() {
    const s = state;
    const stage2 = s.tooth !== null || s.skipTooth;
    const sym = currentSymptom();
    const tooth = s.tooth;
    $$('[data-stage="1"]').forEach((el) => { el.hidden = stage2; });
    $$('[data-stage="2"]').forEach((el) => { el.hidden = !stage2; });
    jaw.classList.toggle('is-compact', stage2);
    jaw.classList.toggle('is-jaw', s.scope === 'jaw');
    $$('.tooth', jaw).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.tooth === tooth));

    $('#tooth-hint').textContent = glue(tooth !== null
      ? `Выбран зуб ${qn(tooth)} — ${D.toothNames[tooth]}, ${tooth <= 16 ? 'верхняя' : 'нижняя'} челюсть, ${sideOf(tooth) === 'справа' ? 'правая' : 'левая'} сторона`
      : s.scope === 'jaw' ? 'Вопрос по всей челюсти — выберите, что беспокоит'
        : s.skipTooth ? 'Зуб не выбран — подскажем по симптому' : 'Нажмите на зуб — он подсветится');
    $('.jaw__reset').textContent = s.scope === 'jaw' ? '← Выбрать один зуб' : '← Выбрать зуб заново';

    const cur = sym ? 3 : stage2 ? 2 : 1;
    $$('.step').forEach((li) => {
      const n = +li.dataset.step;
      li.classList.toggle('is-done', n < cur);
      if (n === cur) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });

    // symptom chips: the set depends on scope, and "wisdom tooth" only shows for a wisdom tooth
    const wrap = $('#sym-wrap');
    const wisdom = WISDOM.includes(tooth);
    const groups = D.symptomGroups[s.scope === 'jaw' ? 'jaw' : 'tooth'];
    mount(wrap, (s.scope === 'jaw' ? 'jaw' : 'tooth') + wisdom, () => groups.map(([title, ids]) => `<div class="sym-group"><span class="caps">${title}</span><div class="sym-group__chips">${
      ids.filter((id) => id !== 'wisdom' || wisdom).map((id) => {
        const x = D.symptoms.find((y) => y.id === id);
        return `<button type="button" class="sym-chip" aria-pressed="false" data-act="symptom" data-id="${id}" data-focus="sym:${id}">${esc(glue(x.label))}</button>`;
      }).join('')}</div></div>`).join(''));
    $$('.sym-chip', wrap).forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === s.symptom));
    wrap.classList.toggle('has-sel', !!sym);

    const hint = $('#hint');
    $('#hint-empty').hidden = !!sym;
    hint.hidden = !sym;
    const html = sym ? hintHTML(sym) : '';
    mount(hint, html, () => html);
  }

  function hintHTML(sym) {
    const s = state;
    const tooth = s.tooth;
    const cat = catById(sym.cat);
    const rec = D.recommend[sym.id] || { svcs: [], roles: [] };
    const recDocs = docsFor(rec.roles);
    const toothLabel = tooth !== null ? `Зуб ${qn(tooth)} · ${D.toothNames[tooth]}, ${sideOf(tooth)} ${jawOf(tooth)}` : 'Зуб не выбран';
    const svcs = rec.svcs.map((n) => `<button type="button" class="check-row" aria-pressed="${inCart(n)}" data-act="rec-svc" data-svc="${esc(n)}" data-focus="rsvc:${esc(n)}"><span class="box">${icon('i-check', 13, 3.2)}</span><span class="check-row__label">${esc(glue(n))}</span></button>`).join('');
    const docs = recDocs.slice().sort((a, b) => (b.id === s.docPick) - (a.id === s.docPick))
      .filter((d, k) => s.recAll || k < 3)
      .map((d) => {
        const sel = s.docPick === d.id;
        return `<button type="button" class="opt-row" aria-pressed="${sel}" data-act="rec-doc" data-id="${d.id}" data-focus="rdoc:${d.id}"><span class="av">${docAvatar(d, 20)}</span><span class="opt-row__text"><span class="opt-row__name">${esc(glue(docTitle(d)))}</span>${d.name ? `<span class="opt-row__sub">${esc(d.spec)}</span>` : ''}</span>${sel ? icon('i-check', 18, 2.8) : ''}</button>`;
      }).join('');
    const more = recDocs.length > 3 ? `<button type="button" class="link-btn" data-act="rec-more" data-focus="rmore">${s.recAll ? 'Свернуть' : `Показать всех (${recDocs.length})`}</button>` : '';
    const who = recDocs.length ? docs + more : '<span class="hint__small">Врача подберём при записи.</span>';
    return `<div class="hint__tags"><span class="tag">${toothLabel}</span><span class="tag">${esc(glue(sym.label))}</span></div>
      <h4 class="hint__title">${esc(glue(sym.title))}</h4>
      <p class="hint__text">${esc(glue(sym.text))}</p>
      ${WISDOM.includes(tooth) && sym.id !== 'wisdom' ? `<p class="hint__note">${glue('Это зуб мудрости — возможно, понадобится консультация хирурга.')}</p>` : ''}
      <div class="hint__row"><span class="hint__k">Направление</span><span class="hint__v">${esc(glue(cat.name))}</span></div>
      <div class="hint__sec"><span class="caps">Вероятно понадобится</span>${svcs}<span class="hint__small">Отметьте — услуги попадут в запись на приём.</span></div>
      <div class="hint__sec" id="rec-who"><div class="hint__who-head"><span class="caps">Кто примет</span><span class="hint__small">${rec.roles.map((r) => ROLE_NAME[r]).join(' и ')}</span></div>${who}</div>
      <div class="hint__actions"><a class="btn btn--dark hint__cta" href="#book"><span>Записаться</span><span class="hint__dot" aria-hidden="true"></span><span>${esc(D.clinic.area)}</span></a><a class="btn btn--ghost-dark hint__cat" href="#services" data-act="go-cat">Услуги и врачи направления</a></div>
      <p class="hint__disclaimer">${glue('Это подсказка, а не диагноз. Точный план врач составит после осмотра.')}</p>`;
  }

  /* ---------- services panel ---------- */
  const svcOpenBox = $('#svc-open');
  function renderServices() {
    const cat = catById(state.cat);
    $('#svc-grid').hidden = !!cat;
    svcOpenBox.hidden = !cat;
    if (!cat) { mount(svcOpenBox, '', () => ''); return; }
    // the shell (and its form) is rebuilt each time the panel opens, so the form is bound again
    if (mount(svcOpenBox, 'open', panelShellHTML)) window.SiteForm.bind($('#svc-form'), () => set({ sent: true }));
    $$('.svc-bar__tab', svcOpenBox).forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === cat.id));
    mount($('#svc-head'), cat.id, () => panelHeadHTML(cat));

    // services list
    const hiddenActive = cat.items.some((n, k) => k >= SVC_LIMIT && state.svcOpen === n);
    const expanded = state.svcAll || hiddenActive;
    const list = $('#svc-list');
    mount(list, cat.id + expanded, () => cat.items.filter((n, k) => expanded || k < SVC_LIMIT).map(svcRowHTML).join(''));
    $$('.svc-row', list).forEach(syncSvcRow);
    const moreSvcs = $('#svc-all');
    moreSvcs.hidden = cat.items.length <= SVC_LIMIT;
    moreSvcs.setAttribute('aria-expanded', expanded);
    moreSvcs.firstChild.textContent = expanded ? 'Свернуть' : 'Показать ещё ' + (cat.items.length - SVC_LIMIT);

    // doctor choice: in diagnostics it follows the chosen consultation
    const consRoles = cat.id === 'diag' ? Object.keys(CONSULT_ROLE).filter(inCart).map((k) => CONSULT_ROLE[k]) : [];
    const roles = catRoles(cat, state.cart);
    const docs = docsFor(roles);
    $('#doc-pick-who').textContent = glue(docs.length ? (docs.length === 1 ? 'Принимает ' : 'Принимают ') + docs.map((d) => d.spec.toLowerCase()).join(', ')
      : cat.id === 'diag' && !consRoles.length ? 'Отметьте консультацию — покажем, кто её проводит' : 'Врача подберём при записи');

    const opts = docs.map((d) => ({ id: d.id, title: docTitle(d), av: docAvatar(d, 40), sub: d.name ? d.spec : 'Фото и имя скоро появятся' }));
    const picked = opts.findIndex((d) => d.id === state.docPick);
    const docsExpanded = state.docsAll || picked >= DOC_LIMIT;
    const grid = $('#doc-pick-grid');
    mount(grid, roles.join() + docsExpanded, () => opts.filter((d, k) => docsExpanded || k < DOC_LIMIT).map((d) => `<button type="button" class="doc-card" aria-pressed="false" data-act="panel-doc" data-id="${d.id}" data-focus="pdoc:${d.id}"><span class="doc-card__av">${d.av}</span><span class="doc-card__text"><span class="doc-card__name">${esc(d.title)}</span>${d.sub ? `<span class="doc-card__sub">${esc(d.sub)}</span>` : ''}</span><span class="doc-card__tick">${icon('i-check', 16, 2.8)}</span></button>`).join(''));
    $$('.doc-card', grid).forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === state.docPick));
    const moreDocs = $('#docs-all');
    moreDocs.hidden = opts.length <= DOC_LIMIT;
    moreDocs.setAttribute('aria-expanded', docsExpanded);
    moreDocs.firstChild.textContent = docsExpanded ? 'Свернуть' : 'Показать ещё ' + (opts.length - DOC_LIMIT);

    // step 3: the whole booking, services of every category included
    const items = state.cart.map((x) => `<li class="svc-sum__item"><span class="svc-sum__tick">${icon('i-check', 13, 3.2)}</span><span class="svc-sum__name">${esc(glue(x.n))}<span class="svc-sum__cat">${esc(glue(x.cat))}</span></span><button type="button" class="svc-sum__x" data-act="cart-remove" data-svc="${esc(x.n)}" aria-label="Убрать: ${esc(x.n)}">${icon('i-close', 13, 2.8)}</button></li>`).join('');
    const doc = docById(state.docPick || 'ther');
    // one card, a row per part: label on the left, value on the right
    mount($('#svc-sum'), state.cart.map((x) => x.n).join('|') + '#' + doc.id, () => `
      <div class="svc-sum__row"><span class="svc-sum__k">Услуги</span><div class="svc-sum__v">${items ? `<ul class="svc-sum__list">${items}</ul>`
        : `<p class="svc-sum__empty">${glue('Не выбраны — ничего страшного: администратор поможет подобрать по телефону.')}</p>`}</div></div>
      <div class="svc-sum__row"><span class="svc-sum__k">Врач</span><div class="svc-sum__v"><div class="svc-sum__doc"><span class="av">${docAvatar(doc, 20)}</span><span class="svc-sum__doc-text"><span class="svc-sum__doc-name">${esc(glue(docTitle(doc)))}</span>${doc.name ? `<span class="svc-sum__cat">${esc(doc.spec)}</span>` : ''}</span></div></div></div>
      <div class="svc-sum__row"><span class="svc-sum__k">Удобное время</span><div class="svc-sum__v">
        <div class="svc-time">${TIMES.map(([v, label]) => `<button type="button" class="chip svc-time__chip" aria-pressed="false" data-act="svc-time" data-time="${v}" data-focus="time:${v}">${label}</button>`).join('')}</div>
        <p class="svc-sum__note">${glue('Точное время администратор согласует по телефону.')}</p></div></div>`);
    $$('.svc-time__chip', svcOpenBox).forEach((b) => b.setAttribute('aria-pressed', b.dataset.time === state.time));

    // which step is shown, and the buttons under it
    const step = state.svcStep;
    $$('.svc-step', svcOpenBox).forEach((el) => { el.hidden = +el.dataset.step !== step; });
    $$('.wiz__btn', svcOpenBox).forEach((b) => {
      const k = +b.dataset.step;
      if (k === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.parentElement.classList.toggle('is-done', k < step);
    });
    const n = state.cart.filter((x) => x.cat === cat.name).length;
    $('#svc-nav-info').textContent = glue(step === 1 ? (n ? 'Выбрано ' + n + ' ' + servicesWord(n) : 'Можно не выбирать — поможем по телефону')
      : step === 2 ? 'Врач: ' + docLabel() : '');
    $('.svc-nav__back', svcOpenBox).hidden = step === 1;
    $('.svc-nav__next', svcOpenBox).hidden = step === 3;
    $('.svc-nav__next', svcOpenBox).firstChild.textContent = step === 1 ? 'Далее: врач' : 'Далее: запись';
    $('.svc-nav__book', svcOpenBox).hidden = step !== 3 || state.sent;
    // once sent, step 3 shows only the confirmation: no entered data, heading, consent or buttons
    const sent = state.sent;
    $('#svc-sum').hidden = sent;
    $('#svc-form').hidden = sent;
    $('#svc-consent').hidden = sent;
    $('#svc-done').hidden = !sent;
    $('#svc-review .panel-label').hidden = sent;
    $('.svc-nav', svcOpenBox).hidden = sent && step === 3;
  }

  // an input with its label and error box, as in the booking form (ids prefixed with svc-)
  function fieldHTML(name, label, type, attrs) {
    return `<label class="field">${label}
      <input class="field__input" type="${type}" name="${name}" ${attrs} aria-describedby="svc-err-${name}">
      <span class="field__err" id="svc-err-${name}" role="alert" hidden>${icon('i-alert', 14, 2.4)}<span></span></span>
    </label>`;
  }

  function panelShellHTML() {
    return `<div class="svc-bar"><div class="tabs-scroll svc-bar__tabs">
        <button type="button" class="chip svc-bar__all" data-act="cat-close">${icon('i-grid', 15, 2.4)}Все разделы</button>
        <span class="svc-bar__sep" aria-hidden="true"></span>
        ${D.cats.map((c) => `<button type="button" class="chip svc-bar__tab" aria-pressed="false" data-act="cat-tab" data-cat="${c.id}">${esc(c.tab)}</button>`).join('')}
      </div></div>
      <div class="svc-panel" id="svc-panel">
        <div class="svc-panel__head" id="svc-head"></div>
        <div class="svc-panel__body">
          <ol class="wiz" id="svc-steps">
            ${STEPS.map((t, k) => `<li class="wiz__item"><button type="button" class="wiz__btn" data-act="svc-step" data-step="${k + 1}"><span class="num">${k + 1}</span><span class="wiz__t">${t}</span></button></li>`).join('')}
          </ol>
          <div class="svc-step" id="pick-svc" data-step="1">
            <div class="panel-label"><h4 class="panel-h" tabindex="-1">Отметьте услуги</h4><span class="panel-hint">можно несколько</span></div>
            <div class="svc-list" id="svc-list"></div>
            <button type="button" class="btn btn--ghost more-wide" id="svc-all" data-act="svc-all" aria-expanded="false"><span></span>${icon('i-chev-row', 16, 2.4)}</button>
          </div>
          <div class="svc-step" id="pick-doctor" data-step="2">
            <div class="panel-label"><h4 class="panel-h" tabindex="-1">Выберите врача</h4><span class="doc-pick__who" id="doc-pick-who"></span></div>
            <div class="doc-pick__grid" id="doc-pick-grid"></div>
            <button type="button" class="btn btn--ghost more-wide" id="docs-all" data-act="docs-all" aria-expanded="false"><span></span>${icon('i-chev', 16, 2.4)}</button>
          </div>
          <div class="svc-step" id="svc-review" data-step="3">
            <div class="panel-label"><h4 class="panel-h" tabindex="-1">Проверьте и отправьте заявку</h4></div>
            <div class="svc-sum">
              <div class="svc-sum__rows" id="svc-sum"></div>
              <form class="svc-sum__row svc-form" id="svc-form" novalidate>
                <span class="svc-sum__k">Контакты</span>
                <div class="svc-sum__v svc-form__fields">
                  ${fieldHTML('name', 'Имя', 'text', 'autocomplete="name" maxlength="40" placeholder="Как к вам обращаться"')}
                  ${fieldHTML('phone', 'Телефон', 'tel', 'autocomplete="tel" inputmode="tel" placeholder="+375 (29) 123-45-67"')}
                  ${fieldHTML('email', 'Эл. почта (необязательно)', 'email', 'autocomplete="email" inputmode="email" maxlength="80" placeholder="name@mail.com"')}
                </div>
              </form>
              <div class="svc-done" id="svc-done" hidden>
                <span class="svc-done__ic">${icon('i-check', 22, 2.6)}</span>
                <div class="svc-done__text"><h5 class="svc-done__title">Заявка отправлена</h5><p class="svc-sum__note">${glue('Администратор перезвонит, согласует время и подтвердит запись.')}</p></div>
              </div>
            </div>
            <p class="svc-consent" id="svc-consent">${glue('Отправляя заявку, вы соглашаетесь на обработку персональных данных.')}</p>
          </div>
          <div class="svc-nav">
            <button type="button" class="btn btn--ghost svc-nav__back" data-act="svc-prev">${icon('i-back', 16, 2.4)}Назад</button>
            <span class="svc-nav__info" id="svc-nav-info"></span>
            <button type="button" class="btn btn--dark svc-nav__next" data-act="svc-next"><span></span>${icon('i-arrow', 16, 2.4)}</button>
            <button type="submit" form="svc-form" class="btn btn--accent svc-nav__book">Отправить заявку${icon('i-arrow', 16, 2.4)}</button>
          </div>
        </div>
      </div>`;
  }

  function panelHeadHTML(cat) {
    const nd = docsFor(cat.roles).length;
    const meta = cat.items.length + ' ' + servicesWord(cat.items.length) + (nd ? ' · ' + nd + ' ' + doctorsWord(nd) : '');
    const img = 'assets/img/services/' + cat.id;
    return `<span class="svc-panel__photo" data-cat="${cat.id}" aria-hidden="true"><img src="${img}.webp" srcset="${img}-800.webp 800w, ${img}.webp 1600w" sizes="(max-width: 1240px) 66vw, 792px" alt=""></span>
      <div class="svc-panel__intro">
        <button type="button" class="back-link" data-act="cat-close">${icon('i-back', 16, 2.4)}Все разделы</button>
        <h3 class="svc-panel__name">${esc(glue(cat.name))}</h3>
        <p class="svc-panel__desc">${esc(glue(cat.desc))}</p>
      </div>
      <span class="svc-panel__meta">${meta}</span>`;
  }

  function svcRowHTML(n) {
    const subs = n === CONSULT ? `<div class="svc-subs"><span class="caps">Выберите специалиста</span><div class="svc-subs__chips">${
      CONSULT_SUBS.map(([label, cn]) => `<button type="button" class="chip svc-subs__chip" aria-pressed="false" data-act="svc-sub" data-sub="${cn}">${label}</button>`).join('')}</div></div>` : '';
    const m = D.serviceMore[n];
    const more = m ? `<button type="button" class="more-btn" data-act="svc-more" aria-expanded="false"><span></span>${icon('i-chev', 14, 2.6)}</button>
      <div class="drawer drawer--more"><div><div class="svc-more">
        <p class="svc-more__lead">${esc(glue(m.lead))}</p>
        ${m.sections.map((sc) => `<div class="svc-more__sec"><span class="svc-more__h">${esc(sc.h)}</span>${
          sc.items ? `<ul class="bullets">${sc.items.map((x) => `<li><span>${esc(glue(x))}</span></li>`).join('')}</ul>` : ''}${
          sc.p ? `<p class="svc-more__p">${esc(glue(sc.p))}</p>` : ''}</div>`).join('')}
        ${m.note ? `<p class="svc-more__note">${esc(glue(m.note))}</p>` : ''}
      </div></div></div>` : '';
    return `<div class="svc-row" data-svc="${esc(n)}">
      <div class="svc-row__bar">
        <button type="button" class="svc-row__check" data-act="svc-check" aria-pressed="false" data-focus="chk:${esc(n)}"><span class="box box--lg">${icon('i-check', 14, 3.2)}</span></button>
        <button type="button" class="svc-row__toggle" data-act="svc-toggle" aria-expanded="false" data-focus="tgl:${esc(n)}"><span class="svc-row__label"></span><span class="svc-row__chev">${icon('i-chev-row', 16, 2.4)}</span></button>
      </div>
      <div class="drawer"><div><div class="svc-row__content">${subs}<p class="svc-row__desc">${esc(glue(D.serviceText[n] || 'Подробности расскажет врач на консультации.'))}</p>${more}</div></div></div>
    </div>`;
  }

  function syncSvcRow(row) {
    const n = row.dataset.svc;
    const subSel = n === CONSULT ? CONSULT_SUBS.filter(([, cn]) => inCart(cn)) : [];
    const sel = n === CONSULT ? subSel.length > 0 : inCart(n);
    const open = state.svcOpen === n;
    const moreOpen = open && state.svcMore === n;
    row.classList.toggle('is-sel', sel);
    row.classList.toggle('is-open', open);
    const check = $('.svc-row__check', row);
    check.setAttribute('aria-pressed', sel);
    check.setAttribute('aria-label', (sel ? 'Убрать из записи: ' : 'Добавить к записи: ') + n);
    const toggle = $('.svc-row__toggle', row);
    toggle.setAttribute('aria-expanded', open);
    $('.svc-row__label', row).textContent = glue(subSel.length ? n + ' · ' + subSel.map(([l]) => l.toLowerCase()).join(', ') : n);
    row.lastElementChild.classList.toggle('is-open', open);
    $$('.svc-subs__chip', row).forEach((b) => b.setAttribute('aria-pressed', inCart(b.dataset.sub)));
    const moreBtn = $('.more-btn', row);
    if (moreBtn) {
      moreBtn.setAttribute('aria-expanded', moreOpen);
      moreBtn.firstChild.textContent = moreOpen ? 'Свернуть' : 'Подробнее об услуге';
      $('.drawer--more', row).classList.toggle('is-open', moreOpen);
    }
  }

  /* ---------- selected services (floating cart) ---------- */
  const cartBox = $('#cart');
  function renderCart() {
    const n = state.cart.length;
    cartBox.hidden = !n || state.sent;
    if (cartBox.hidden) return;
    mount(cartBox, 'cart', () => `<div class="cart__pop" id="cart-pop" role="dialog" aria-label="Выбранные услуги" hidden>
        <div class="cart__head"><div class="cart__titles"><span class="cart__kicker">Запись на приём</span><span class="cart__title" id="cart-title"></span></div>
          <button type="button" class="cart__close" data-act="cart-toggle" aria-label="Свернуть">${icon('i-close', 16, 2.4)}</button></div>
        <div class="cart__list" id="cart-list"></div>
        <div class="cart__foot">
          <span class="cart__doc">Врач: <b id="cart-doc"></b></span>
          <span class="cart__note">Администратор перезвонит, подберёт удобное время и подтвердит запись.</span>
          <div class="cart__actions"><button type="button" class="btn btn--ghost cart__clear" data-act="cart-clear">Очистить</button><a href="#book" class="btn btn--dark cart__book" data-act="cart-close">Записаться${icon('i-arrow', 16, 2.4)}</a></div>
        </div>
      </div>
      <button type="button" class="cart__pill" data-act="cart-toggle" aria-expanded="false" aria-controls="cart-pop"><span class="cart__count" id="cart-count"></span><span id="cart-label"></span>${icon('i-chev-up', 16, 2.4)}</button>`);
    $('#cart-pop').hidden = !state.cartOpen;
    $('#cart-title').textContent = 'Выбрано ' + n + ' ' + servicesWord(n);
    const items = state.cart.map((x) => `<div class="cart__item"><span class="cart__tick">${icon('i-check', 13, 3.2)}</span><span class="cart__info"><span class="cart__name">${esc(glue(x.n))}</span><span class="cart__cat">${esc(glue(x.cat))}</span></span><button type="button" class="cart__x" data-act="cart-remove" data-svc="${esc(x.n)}" aria-label="Убрать: ${esc(x.n)}">${icon('i-close', 13, 2.8)}</button></div>`).join('');
    mount($('#cart-list'), items, () => items);
    $('#cart-doc').textContent = docLabel();
    $('#cart-count').textContent = n;
    $('#cart-label').textContent = state.cartOpen ? 'Свернуть' : 'Записаться';
    $('.cart__pill').setAttribute('aria-expanded', state.cartOpen);
  }

  /* ---------- doctors carousel ---------- */
  // on a phone all cards are one swipeable row (CSS), so no pages
  const swipeMedia = window.matchMedia('(max-width: 640px)');
  const PERSON = '<svg class="doc__ph" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.8-4.2 3.8-6.5 7.5-6.5s6.7 2.3 7.5 6.5"/></svg>';
  function renderDoctors() {
    const list = D.doctors;
    const pages = Math.max(1, Math.ceil(list.length / DOCS_PER_PAGE));
    const page = Math.min(state.docPage, pages - 1);
    const swipe = swipeMedia.matches;
    const track = $('#doc-track');
    const shown = swipe ? list : list.slice(page * DOCS_PER_PAGE, (page + 1) * DOCS_PER_PAGE);
    // until a name and photo arrive, the card shows a silhouette and the speciality as its title
    const rebuilt = mount(track, swipe ? 'all' : String(page), () => shown.map((d) => `<article class="doc">
        <div class="doc__photo">${d.name ? `<span class="doc__ini" aria-hidden="true">${initials(d.name)}</span>` : PERSON}${d.photo ? `<img src="assets/img/doctors/${d.photo}.webp" alt="" loading="lazy">` : ''}</div>
        <div class="doc__info"><h3 class="doc__name">${esc(d.name || d.spec)}</h3><span class="doc__spec">${d.name ? esc(d.spec) : 'Фото и&nbsp;имя скоро появятся'}</span></div>
        <div class="doc__foot">${BOOKABLE.includes(d.role) ? `<a href="#book" class="doc__book" data-act="book-doc" data-id="${d.id}">Записаться</a>` : ''}</div>
      </article>`).join(''));
    if (rebuilt) track.scrollLeft = 0;
    const multi = pages > 1;
    $$('.side-arrow').forEach((b) => { b.hidden = !multi; });
    $('#doc-dots-row').hidden = !multi;
    const dots = $('#doc-dots');
    mount(dots, String(pages), () => Array.from({ length: pages }, (_, k) => `<button type="button" class="dot" aria-pressed="false" aria-label="Страница ${k + 1} из ${pages}" data-act="doc-page" data-page="${k}"></button>`).join(''));
    $$('.dot', dots).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.page === page));
  }
  const docPages = () => Math.max(1, Math.ceil(D.doctors.length / DOCS_PER_PAGE));

  /* ---------- FAQ ---------- */
  // <details> opens instantly; animating its height lets the questions below slide instead of jumping
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  $$('.faq').forEach((el) => {
    const sum = $('summary', el);
    sum.addEventListener('click', (e) => {
      if (reduceMotion.matches) return;
      e.preventDefault();
      const from = el.getBoundingClientRect().height;
      if (el.anim) el.anim.cancel();
      const closing = el.open && !el.classList.contains('is-closing');
      el.classList.toggle('is-closing', closing);
      el.open = true;
      const to = closing ? sum.offsetHeight : el.offsetHeight;
      el.style.overflow = 'hidden';
      const anim = el.animate({ height: [from + 'px', to + 'px'] }, { duration: 320, easing: 'cubic-bezier(.22, .7, .2, 1)' });
      el.anim = anim;
      // a click mid-way cancels this animation (the promise rejects) and starts the next one
      anim.finished.then(() => {
        el.anim = null;
        el.style.overflow = '';
        if (el.classList.contains('is-closing')) { el.open = false; el.classList.remove('is-closing'); }
      }, () => {});
    });
  });

  /* ---------- booking ---------- */
  const form = $('#book-form');
  // Requests are not delivered anywhere yet (see docs/knowledge.md, "Booking").
  window.SiteForm.bind(form, () => set({ sent: true }));
  form.addEventListener('change', (e) => { if (e.target.name === 'time') set({ time: e.target.value }); });

  function renderBooking() {
    const sym = currentSymptom();
    const tooth = state.tooth;
    let reason = 'Осмотр и консультация';
    if (sym) reason = (state.scope === 'jaw' && tooth === null ? 'Вся челюсть · ' : '') + (tooth !== null ? `Зуб ${qn(tooth)} (${D.toothNames[tooth]}) · ` : '') + sym.label.toLowerCase();
    if (state.cart.length) reason = 'Услуги: ' + state.cart.map((x) => x.n).join(', ');
    $('#book-reason').textContent = glue(reason);
    $('#book-doctor').textContent = docLabel();
    form.elements.time.value = state.time;
    $('#book-time').textContent = state.time;
    // the form and the confirmation share one grid cell, so the card keeps its size (see style.css)
    $('.book__card').classList.toggle('is-sent', state.sent);
  }

  /* ---------- scroll-driven bits ---------- */
  const toTop = $('#to-top');
  const pick = $('#pick');
  let inPick = false;
  // true when the page under a floating button is dark, so the button switches to its light version
  function darkUnder(node) {
    const r = node.getBoundingClientRect();
    let el = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((n) => !n.closest('.cart, .to-top'));
    while (el && el !== document.documentElement) {
      const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
      if (m && (m[4] === undefined || +m[4] > 0.5)) return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.4;
      el = el.parentElement;
    }
    return false;
  }
  function updateFloating() {
    const y = window.scrollY;
    hdr.classList.toggle('is-scrolled', y > 8);
    toTop.hidden = y <= 900;
    toTop.classList.toggle('is-raised', !cartBox.hidden);
    if (!toTop.hidden) toTop.classList.toggle('on-dark', darkUnder(toTop));
    const pill = $('.cart__pill');
    if (pill && !cartBox.hidden) pill.classList.toggle('on-dark', darkUnder(pill));
  }
  function onScroll() {
    let active = null;
    SPY.forEach((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      if (r.top <= 140 && r.bottom > 140) active = id;
    });
    $$('.nav__link').forEach((a) => {
      if (a.getAttribute('href') === '#' + active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    const pr = pick.getBoundingClientRect();
    const half = window.innerHeight / 2;
    const now = pr.top < half && pr.bottom > half;
    if (now && !inPick && state.cartOpen) set({ cartOpen: false });
    inPick = now;
    updateFloating();
  }
  let ticking = false;
  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onScroll(); });
  }

  /* ---------- actions ---------- */
  function toggleCart(n, cat) {
    set({ cart: inCart(n) ? state.cart.filter((x) => x.n !== n) : state.cart.concat([{ n, cat }]) });
  }
  function openCat(id) {
    set({ cat: id, svcStep: 1, docPick: autoDoc(catRoles(catById(id), state.cart)), docsAll: false, svcAll: false });
    scrollToId('svc-panel');
  }
  // shows step k of the services panel; scrolls back up if the step bar is above the screen
  function goStep(k) {
    if (k < 1 || k > STEPS.length) return;
    set({ svcStep: k });
    const bar = $('#svc-steps');
    if (bar.getBoundingClientRect().top < $('.svc-bar').getBoundingClientRect().bottom) scrollToId('svc-steps');
    $(`.svc-step[data-step="${k}"] .panel-h`).focus({ preventScroll: true });
  }
  const actions = {
    tooth: (t) => {
      const n = +t.dataset.tooth;
      if (state.tooth === n) { set({ tooth: null }); return; }
      const keep = state.scope !== 'jaw' && !(state.symptom === 'wisdom' && !WISDOM.includes(n));
      set({ tooth: n, scope: 'tooth', skipTooth: false, symptom: keep ? state.symptom : null });
    },
    'pick-jaw': () => set({ skipTooth: true, scope: 'jaw', tooth: null, symptom: null }),
    'skip-tooth': () => set({ skipTooth: true, scope: 'tooth', symptom: null }),
    'reset-tooth': () => set({ tooth: null, skipTooth: false, scope: null, symptom: null }),
    symptom: (t) => {
      const id = state.symptom === t.dataset.id ? null : t.dataset.id;
      set({ symptom: id, docPick: id ? autoDoc((D.recommend[id] || { roles: [] }).roles) : null });
    },
    'rec-svc': (t) => toggleCart(t.dataset.svc, catOfService(t.dataset.svc)),
    'rec-doc': (t) => {
      const id = t.dataset.id;
      if (state.docPick === id) return;
      const rec = D.recommend[state.symptom];
      const hiddenNow = state.recAll && docsFor(rec.roles).findIndex((d) => d.id === id) >= 3;
      set(hiddenNow ? { docPick: id, recAll: false } : { docPick: id });
      if (hiddenNow) scrollToId('rec-who');
    },
    'rec-more': () => { const was = state.recAll; set({ recAll: !was }); if (was) scrollToId('rec-who'); },
    'go-cat': (t, e) => {
      e.preventDefault();
      const sym = currentSymptom();
      if (sym) { set({ cat: sym.cat, svcStep: 1 }); scrollToId('svc-panel'); }
    },

    cat: (t, e) => { e.preventDefault(); openCat(t.dataset.cat); },
    'cat-tab': (t) => {
      if (t.dataset.cat === state.cat) return;
      set({ cat: t.dataset.cat, svcStep: 1, docPick: autoDoc(catRoles(catById(t.dataset.cat), state.cart)), docsAll: false, svcAll: false, svcOpen: null });
      scrollToId('svc-panel');
    },
    'cat-close': () => { set({ cat: null }); scrollToId('services'); },
    'svc-check': (t) => {
      const n = t.closest('.svc-row').dataset.svc;
      if (n !== CONSULT) { toggleCart(n, catById(state.cat).name); return; }
      // a consultation needs a specialist: open the row to pick one, or clear the chosen one
      if (CONSULT_SUBS.some(([, cn]) => inCart(cn))) set({ cart: state.cart.filter((x) => !isConsult(x.n)), docPick: null });
      else set({ svcOpen: n });
    },
    'svc-sub': (t) => {
      const cn = t.dataset.sub;
      const rest = state.cart.filter((x) => !isConsult(x.n));
      const cart = inCart(cn) ? rest : rest.concat([{ n: cn, cat: catById(state.cat).name }]);
      set({ cart, docPick: autoDoc(catRoles(catById(state.cat), cart)), docsAll: false });
    },
    'svc-toggle': (t) => { const n = t.closest('.svc-row').dataset.svc; set({ svcOpen: state.svcOpen === n ? null : n }); },
    'svc-more': (t) => { const n = t.closest('.svc-row').dataset.svc; set({ svcMore: state.svcMore === n ? null : n }); },
    'svc-all': (t) => {
      if (t.getAttribute('aria-expanded') === 'true') {
        const cat = catById(state.cat);
        const hiddenActive = cat.items.some((n, k) => k >= SVC_LIMIT && state.svcOpen === n);
        set({ svcAll: false, svcOpen: hiddenActive ? null : state.svcOpen });
        scrollToId('pick-svc');
      } else set({ svcAll: true });
    },
    'panel-doc': (t) => set({ docPick: t.dataset.id }),
    'docs-all': (t) => {
      const collapsing = t.getAttribute('aria-expanded') === 'true';
      set({ docsAll: !collapsing });
      if (collapsing) scrollToId('pick-doctor');
    },
    'svc-step': (t) => goStep(+t.dataset.step),
    'svc-prev': () => goStep(state.svcStep - 1),
    'svc-next': () => goStep(state.svcStep + 1),
    'svc-time': (t) => set({ time: t.dataset.time }),

    'cart-toggle': () => set({ cartOpen: !state.cartOpen }),
    'cart-close': () => set({ cartOpen: false }),
    'cart-remove': (t) => set({ cart: state.cart.filter((x) => x.n !== t.dataset.svc) }),
    'cart-clear': () => set({ cart: [], cartOpen: false }),

    'doc-page': (t) => set({ docPage: +t.dataset.page }),
    'doc-prev': () => { const p = docPages(); set({ docPage: (Math.min(state.docPage, p - 1) - 1 + p) % p }); },
    'doc-next': () => { const p = docPages(); set({ docPage: (Math.min(state.docPage, p - 1) + 1) % p }); },
    'book-doc': (t) => set({ docPick: t.dataset.id }),

    top: () => window.scrollTo(0, 0)
  };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (t && actions[t.dataset.act]) actions[t.dataset.act](t, e);
  });

  /* ---------- start ---------- */
  function render() {
    renderPicker();
    renderServices();
    renderCart();
    renderDoctors();
    renderBooking();
    updateFloating();
  }
  buildTeeth();
  render();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  swipeMedia.addEventListener('change', render);
  onScroll();
  // the doctors grid is built by script, so re-apply an anchor from the address once it exists
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView();
})();
