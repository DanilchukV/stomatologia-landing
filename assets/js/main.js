'use strict';
// Page behaviour: header, tooth picker, services panel, selected-services cart,
// doctors and reviews carousels, booking form. Content comes from data.js.
(function () {
  const D = window.SITE_DATA;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- text helpers ---------- */
  // non-breaking space after short words so they never end a line
  const glue = (s) => String(s || '')
    .replace(/(^|[\s(«])(и|в|с|к|о|у|а|из|за|на|по|до|от|для|без|под|над|при|про|или|не|ни|то|что|как|их|его|со|во|об|же|бы) /gi, '$1$2 ')
    .replace(/ (—|–) /g, ' $1 ');
  const nb = (s) => s.replace(/(^|\s)(и|в|с|к|о|у|а|на|по|до|от|для|без|под|или|не|том) /gi, '$1$2 ');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
  const doctorsWord = (n) => plural(n, 'врач', 'врача', 'врачей');
  const servicesWord = (n) => plural(n, 'услуга', 'услуги', 'услуг');
  const initials = (name) => name.split(' ').slice(0, 2).map((w) => w[0]).join('');
  const icon = (id, size, stroke) => `<svg class="ic" width="${size}" height="${size}" stroke-width="${stroke}" aria-hidden="true"><use href="#${id}"/></svg>`;

  /* ---------- constants ---------- */
  const WISDOM = [1, 16, 17, 32];
  const SPY = ['calm', 'services', 'doctors', 'clinics', 'reviews'];
  const SVC_LIMIT = 6;
  const DOC_LIMIT = 3;
  const DOCS_PER_PAGE = 4;
  const CONSULT = 'Консультация специалистов';
  const CONSULT_SUBS = [['Терапевт', 'Консультация терапевта'], ['Ортопед', 'Консультация ортопеда'], ['Хирург', 'Консультация хирурга'], ['Ортодонт', 'Консультация ортодонта']];
  const CONSULT_ROLE = { 'Консультация терапевта': 'ther', 'Консультация ортопеда': 'orth', 'Консультация хирурга': 'surg', 'Консультация ортодонта': 'ortd' };
  const ROLE_PL = { ther: 'терапевты', orth: 'ортопеды', surg: 'хирурги', ortd: 'ортодонт', xray: 'рентгенолаборанты' };
  const BOOKABLE = ['ther', 'orth', 'surg', 'ortd'];

  /* ---------- state ---------- */
  const state = {
    clinic: 0, addrOpen: false,
    tooth: null, scope: null, skipTooth: false, symptom: null, recAll: false,
    cat: null, svcOpen: null, svcMore: null, svcAll: false, docsAll: false,
    docPick: null, cart: [], cartOpen: false,
    docRole: 'all', docPage: 0, revPage: 0,
    sent: false
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
  const docLabel = () => (state.docPick && state.docPick !== 'any' ? state.docPick : 'любой свободный');

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

  /* ---------- header and clinic choice ---------- */
  const hdr = $('#hdr');
  function renderClinic() {
    const c = D.clinics[state.clinic];
    $$('[data-clinic-area]').forEach((el) => { el.textContent = c.area; });
    $$('[data-clinic-name]').forEach((el) => { el.textContent = c.name; });
    $$('[data-act="clinic"]').forEach((b) => {
      const on = +b.dataset.clinic === state.clinic;
      b.setAttribute('aria-pressed', on);
      if (b.classList.contains('clinic__btn')) b.textContent = on ? 'Выбрана' : 'Выбрать эту клинику';
    });
    $$('[data-clinic-card]').forEach((el) => el.classList.toggle('is-sel', +el.dataset.clinicCard === state.clinic));
    const btn = $('.addr__btn');
    btn.setAttribute('aria-expanded', state.addrOpen);
    btn.setAttribute('aria-label', 'Выбрать клинику: сейчас ' + c.area);
    $('#addr-drop').hidden = !state.addrOpen;
  }

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

    $('#tooth-hint').textContent = tooth !== null
      ? `Выбран зуб ${qn(tooth)} — ${D.toothNames[tooth]}, ${tooth <= 16 ? 'верхняя' : 'нижняя'} челюсть, ${sideOf(tooth) === 'справа' ? 'правая' : 'левая'} сторона`
      : s.scope === 'jaw' ? 'Вопрос по всей челюсти — выберите, что беспокоит'
        : s.skipTooth ? 'Зуб не выбран — подскажем по симптому' : 'Нажмите на зуб — он подсветится';
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
        return `<button type="button" class="sym-chip" aria-pressed="false" data-act="symptom" data-id="${id}" data-focus="sym:${id}">${esc(x.label)}</button>`;
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
    const recDocs = D.doctors.filter((d) => rec.roles.includes(d.role));
    const toothLabel = tooth !== null ? `Зуб ${qn(tooth)} · ${D.toothNames[tooth]}, ${sideOf(tooth)} ${jawOf(tooth)}` : 'Зуб не выбран';
    const svcs = rec.svcs.map((n) => `<button type="button" class="check-row" aria-pressed="${inCart(n)}" data-act="rec-svc" data-svc="${esc(n)}" data-focus="rsvc:${esc(n)}"><span class="box">${icon('i-check', 13, 3.2)}</span><span class="check-row__label">${esc(n)}</span></button>`).join('');
    const docs = recDocs.slice().sort((a, b) => (b.name === s.docPick) - (a.name === s.docPick))
      .filter((d, k) => s.recAll || k < 3)
      .map((d) => {
        const sel = s.docPick === d.name;
        return `<button type="button" class="opt-row" aria-pressed="${sel}" data-act="rec-doc" data-name="${esc(d.name)}" data-focus="rdoc:${esc(d.name)}"><span class="av">${initials(d.name)}</span><span class="opt-row__text"><span class="opt-row__name">${esc(d.name)}</span><span class="opt-row__sub">${esc(d.spec + ' · ' + d.cat.toLowerCase())}</span></span>${sel ? icon('i-check', 18, 2.8) : ''}</button>`;
      }).join('');
    const more = recDocs.length > 3 ? `<button type="button" class="link-btn" data-act="rec-more" data-focus="rmore">${s.recAll ? 'Свернуть' : `Показать всех (${recDocs.length})`}</button>` : '';
    return `<div class="hint__tags"><span class="tag">${toothLabel}</span><span class="tag">${esc(sym.label)}</span></div>
      <h4 class="hint__title">${esc(glue(sym.title))}</h4>
      <p class="hint__text">${esc(glue(sym.text))}</p>
      ${WISDOM.includes(tooth) && sym.id !== 'wisdom' ? '<p class="hint__note">Это зуб мудрости — возможно, понадобится консультация хирурга.</p>' : ''}
      <div class="hint__row"><span class="hint__k">Направление</span><span class="hint__v">${esc(cat.name)}</span></div>
      <div class="hint__sec"><span class="caps">Вероятно понадобится</span>${svcs}<span class="hint__small">Отметьте — услуги попадут в запись на приём.</span></div>
      <div class="hint__sec" id="rec-who"><div class="hint__who-head"><span class="caps">Кто примет</span><span class="hint__small">${rec.roles.map((r) => ROLE_PL[r]).join(' и ')} · ${recDocs.length}</span></div>${docs}${more}</div>
      <div class="hint__actions"><a class="btn btn--dark hint__cta" href="#book"><span>Записаться</span><span class="hint__dot" aria-hidden="true"></span><span>${esc(D.clinics[s.clinic].area)}</span></a><a class="btn btn--ghost-dark hint__cat" href="#services" data-act="go-cat">Услуги и врачи направления</a></div>
      <p class="hint__disclaimer">Это подсказка, а не диагноз. Точный план врач составит после осмотра.</p>`;
  }

  /* ---------- services panel ---------- */
  const svcOpenBox = $('#svc-open');
  function renderServices() {
    const cat = catById(state.cat);
    $('#svc-grid').hidden = !!cat;
    svcOpenBox.hidden = !cat;
    if (!cat) { mount(svcOpenBox, '', () => ''); return; }
    mount(svcOpenBox, 'open', panelShellHTML);
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
    const roles = consRoles.length ? consRoles : cat.id === 'diag' ? [] : cat.roles;
    let who = cat.who;
    if (consRoles.length) {
      const w = consRoles.map((r) => ROLE_PL[r]);
      const names = w.length > 1 ? w.slice(0, -1).join(', ') + ' и ' + w[w.length - 1] : w[0];
      who = 'Консультацию ' + (consRoles.length === 1 && consRoles[0] === 'ortd' ? 'проводит ' : 'проводят ') + names;
    } else if (cat.id === 'diag') who = 'Снимки делаются по живой очереди, врача выбирать не нужно';
    $('#doc-pick-who').textContent = who;

    const opts = [{ any: true, name: 'Любой свободный врач', ini: '★', sub: 'подберём по времени' }]
      .concat(D.doctors.filter((d) => roles.includes(d.role)).map((d) => ({ name: d.name, ini: initials(d.name), sub: d.spec + ' · ' + d.cat.toLowerCase() })));
    const picked = state.docPick && state.docPick !== 'any' ? opts.findIndex((d) => d.name === state.docPick) : -1;
    const docsExpanded = state.docsAll || picked >= DOC_LIMIT;
    const grid = $('#doc-pick-grid');
    mount(grid, roles.join() + docsExpanded, () => opts.filter((d, k) => docsExpanded || k < DOC_LIMIT).map((d) => `<button type="button" class="doc-card" aria-pressed="false" data-act="panel-doc" data-name="${d.any ? 'any' : esc(d.name)}" data-focus="pdoc:${esc(d.name)}"><span class="doc-card__av">${d.ini}</span><span class="doc-card__text"><span class="doc-card__name">${esc(d.name)}</span><span class="doc-card__sub">${esc(d.sub)}</span></span><span class="doc-card__tick">${icon('i-check', 16, 2.8)}</span></button>`).join(''));
    $$('.doc-card', grid).forEach((b) => b.setAttribute('aria-pressed', b.dataset.name === state.docPick));
    const moreDocs = $('#docs-all');
    moreDocs.hidden = opts.length <= DOC_LIMIT;
    moreDocs.setAttribute('aria-expanded', docsExpanded);
    moreDocs.firstChild.textContent = docsExpanded ? 'Свернуть' : 'Показать ещё ' + (opts.length - DOC_LIMIT);

    const n = state.cart.filter((x) => x.cat === cat.name).length;
    const parts = [];
    if (n) parts.push('Выбрано ' + n + ' ' + servicesWord(n));
    if (state.docPick) parts.push('врач: ' + docLabel());
    $('#step3-sum').textContent = parts.length ? parts.join(' · ') : 'Можно не выбирать — администратор поможет подобрать услугу и врача по телефону.';
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
          <div class="svc-panel__cols">
            <div class="svc-pick" id="pick-svc">
              <div class="panel-label"><span class="num">1</span><h4 class="panel-h">Отметьте услуги</h4><span class="panel-hint">можно несколько</span></div>
              <div class="svc-list" id="svc-list"></div>
              <button type="button" class="btn btn--ghost more-wide" id="svc-all" data-act="svc-all" aria-expanded="false"><span></span>${icon('i-chev-row', 16, 2.4)}</button>
            </div>
            <div class="doc-pick" id="pick-doctor">
              <div class="panel-label"><span class="num">2</span><h4 class="panel-h">Выберите врача</h4><span class="doc-pick__who" id="doc-pick-who"></span></div>
              <div class="doc-pick__grid" id="doc-pick-grid"></div>
              <button type="button" class="btn btn--ghost more-wide" id="docs-all" data-act="docs-all" aria-expanded="false"><span></span>${icon('i-chev', 16, 2.4)}</button>
            </div>
          </div>
          <div class="step3">
            <div class="step3__main"><span class="num">3</span><div class="step3__text"><h4 class="step3__h">Записаться</h4><span class="step3__sum" id="step3-sum"></span></div></div>
            <a href="#book" class="btn btn--dark step3__btn" data-act="cart-close">Записаться на приём${icon('i-arrow', 16, 2.4)}</a>
          </div>
        </div>
      </div>`;
  }

  function panelHeadHTML(cat) {
    const nd = D.doctors.filter((d) => cat.roles.includes(d.role)).length;
    const meta = cat.items.length + ' ' + servicesWord(cat.items.length) + ' · ' + (cat.id === 'diag' ? 'рентгенолаборанты' : nd + ' ' + doctorsWord(nd));
    return `<div class="svc-panel__intro">
        <button type="button" class="back-link" data-act="cat-close">${icon('i-back', 16, 2.4)}Все разделы</button>
        <h3 class="svc-panel__name">${esc(cat.name)}</h3>
        <p class="svc-panel__desc">${esc(nb(cat.desc))}</p>
      </div>
      <span class="svc-panel__meta">${meta}</span>`;
  }

  function svcRowHTML(n) {
    const subs = n === CONSULT ? `<div class="svc-subs"><span class="caps">Выберите специалиста</span><div class="svc-subs__chips">${
      CONSULT_SUBS.map(([label, cn]) => `<button type="button" class="chip svc-subs__chip" aria-pressed="false" data-act="svc-sub" data-sub="${cn}">${label}</button>`).join('')}</div></div>` : '';
    const m = D.serviceMore[n];
    const reads = D.serviceReads[n] || [];
    const more = m ? `<button type="button" class="more-btn" data-act="svc-more" aria-expanded="false"><span></span>${icon('i-chev', 14, 2.6)}</button>
      <div class="drawer drawer--more"><div><div class="svc-more">
        <p class="svc-more__lead">${esc(glue(m.lead))}</p>
        ${m.sections.map((sc) => `<div class="svc-more__sec"><span class="svc-more__h">${esc(sc.h)}</span>${
          sc.items ? `<ul class="bullets">${sc.items.map((x) => `<li><span>${esc(glue(x))}</span></li>`).join('')}</ul>` : ''}${
          sc.p ? `<p class="svc-more__p">${esc(glue(sc.p))}</p>` : ''}</div>`).join('')}
        ${m.note ? `<p class="svc-more__note">${esc(glue(m.note))}</p>` : ''}
        ${reads.length ? `<div class="reads"><span class="caps">Читать по теме</span>${reads.map((t) => `<a class="read" href="blog.html">${icon('i-article', 16, 2.2)}${esc(t)}</a>`).join('')}</div>` : ''}
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
    $('.svc-row__label', row).textContent = subSel.length ? n + ' · ' + subSel.map(([l]) => l.toLowerCase()).join(', ') : n;
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
    cartBox.hidden = !n;
    if (!n) return;
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
    const items = state.cart.map((x) => `<div class="cart__item"><span class="cart__tick">${icon('i-check', 13, 3.2)}</span><span class="cart__info"><span class="cart__name">${esc(x.n)}</span><span class="cart__cat">${esc(x.cat)}</span></span><button type="button" class="cart__x" data-act="cart-remove" data-svc="${esc(x.n)}" aria-label="Убрать: ${esc(x.n)}">${icon('i-close', 13, 2.8)}</button></div>`).join('');
    mount($('#cart-list'), items, () => items);
    $('#cart-doc').textContent = docLabel();
    $('#cart-count').textContent = n;
    $('#cart-label').textContent = state.cartOpen ? 'Свернуть' : 'Записаться';
    $('.cart__pill').setAttribute('aria-expanded', state.cartOpen);
  }

  /* ---------- doctors carousel ---------- */
  // on a phone the whole tab is one swipeable row (CSS), so no pages
  const swipeMedia = window.matchMedia('(max-width: 640px)');
  function renderDoctors() {
    $$('.doc-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.role === state.docRole));
    const list = D.doctors.filter((d) => state.docRole === 'all' || d.role === state.docRole);
    const pages = Math.max(1, Math.ceil(list.length / DOCS_PER_PAGE));
    const page = Math.min(state.docPage, pages - 1);
    const swipe = swipeMedia.matches;
    const track = $('#doc-track');
    const shown = swipe ? list : list.slice(page * DOCS_PER_PAGE, (page + 1) * DOCS_PER_PAGE);
    const rebuilt = mount(track, state.docRole + (swipe ? 'all' : page), () => shown.map((d) => `<article class="doc">
        <div class="doc__photo"><span class="doc__ini" aria-hidden="true">${initials(d.name)}</span><img src="assets/img/doctors/${d.photo}.webp" alt="" loading="lazy"></div>
        <div class="doc__info"><h3 class="doc__name">${esc(d.name)}</h3><span class="doc__spec">${esc(d.spec)}</span></div>
        <div class="doc__foot">${d.cat ? `<span class="doc__cat">${esc(d.cat)}</span>` : ''}${BOOKABLE.includes(d.role) ? `<a href="#book" class="doc__book" data-act="book-doc" data-name="${esc(d.name)}">Записаться</a>` : ''}</div>
      </article>`).join(''));
    if (rebuilt) track.scrollLeft = 0;
    const multi = pages > 1;
    $$('.side-arrow').forEach((b) => { b.hidden = !multi; });
    $('#doc-dots-row').hidden = !multi;
    const dots = $('#doc-dots');
    mount(dots, state.docRole, () => Array.from({ length: pages }, (_, k) => `<button type="button" class="dot" aria-pressed="false" aria-label="Страница ${k + 1} из ${pages}" data-act="doc-page" data-page="${k}"></button>`).join(''));
    $$('.dot', dots).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.page === page));
  }

  /* ---------- reviews ---------- */
  function renderReviews() {
    $$('[data-rev-page]').forEach((el) => { el.hidden = +el.dataset.revPage !== state.revPage; });
    $$('[data-act="rev-page"]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.page === state.revPage));
  }

  /* ---------- booking ---------- */
  const form = $('#book-form');
  const fields = { name: form.elements.name, phone: form.elements.phone };
  const touched = { name: false, phone: false };
  let tried = false;

  function nameError(v) {
    const s = v.trim();
    if (!s) return 'Укажите имя';
    if (s.length < 2) return 'Имя слишком короткое';
    if (!/^[A-Za-zА-Яа-яЁёІіЎў' -]+$/.test(s)) return 'Только буквы, без цифр и символов';
    if (!/[аеёиоуыэюяіaeiouy]/i.test(s) || /(.)\1\1/i.test(s) || /[бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxz]{4,}/i.test(s)) return 'Проверьте, правильно ли написано имя';
    return '';
  }
  function phoneError(v) {
    const d = v.replace(/\D/g, '');
    if (!d || d === '375') return 'Укажите номер телефона';
    if (d.length < 12) return 'Номер неполный: нужно 9 цифр после +375';
    if (!/^375(25|29|33|44|1\d|2\d)/.test(d)) return 'Проверьте код оператора: 25, 29, 33 или 44';
    return '';
  }
  // +375 (29) 123-45-67; a local 80… prefix becomes 375
  function formatPhone(raw) {
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('80')) d = '375' + d.slice(2);
    else if (d && !d.startsWith('375') && !'375'.startsWith(d)) d = '375' + d;
    d = d.slice(0, 12);
    if (!d) return '';
    let out = '+' + d.slice(0, 3);
    if (d.length > 3) out += ' (' + d.slice(3, 5);
    if (d.length >= 5) out += ')';
    if (d.length > 5) out += ' ' + d.slice(5, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    if (d.length > 10) out += '-' + d.slice(10, 12);
    return out;
  }
  const errorOf = { name: nameError, phone: phoneError };
  function showErrors() {
    Object.keys(fields).forEach((k) => {
      const err = errorOf[k](fields[k].value);
      const show = !!err && (touched[k] || tried);
      fields[k].setAttribute('aria-invalid', show);
      const box = $('#err-' + k);
      box.hidden = !show;
      box.lastElementChild.textContent = err;
    });
  }
  fields.name.addEventListener('input', showErrors);
  fields.phone.addEventListener('input', () => { fields.phone.value = formatPhone(fields.phone.value); showErrors(); });
  Object.keys(fields).forEach((k) => fields[k].addEventListener('blur', () => { if (fields[k].value) touched[k] = true; showErrors(); }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = Object.keys(fields).find((k) => errorOf[k](fields[k].value));
    if (bad) { tried = true; showErrors(); fields[bad].focus(); return; }
    // Requests are not delivered anywhere yet (see docs/knowledge.md, "Booking").
    set({ sent: true });
  });

  function renderBooking() {
    const sym = currentSymptom();
    const tooth = state.tooth;
    let reason = 'Осмотр и консультация';
    if (sym) reason = (state.scope === 'jaw' && tooth === null ? 'Вся челюсть · ' : '') + (tooth !== null ? `Зуб ${qn(tooth)} (${D.toothNames[tooth]}) · ` : '') + sym.label.toLowerCase();
    if (state.cart.length) reason = 'Услуги: ' + state.cart.map((x) => x.n).join(', ');
    $('#book-reason').textContent = reason;
    $('#book-doctor').textContent = docLabel();
    form.hidden = state.sent;
    $('#book-done').hidden = !state.sent;
    $('#book-consent').hidden = state.sent;
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
    toTop.classList.toggle('is-raised', state.cart.length > 0);
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
    set({ cat: id, docPick: null, docsAll: false, svcAll: false });
    scrollToId('svc-panel');
  }
  const actions = {
    'addr-toggle': () => set({ addrOpen: !state.addrOpen }),
    clinic: (t) => set({ clinic: +t.dataset.clinic, addrOpen: false }),
    'clinic-next': () => set({ clinic: (state.clinic + 1) % D.clinics.length }),

    tooth: (t) => {
      const n = +t.dataset.tooth;
      if (state.tooth === n) { set({ tooth: null }); return; }
      const keep = state.scope !== 'jaw' && !(state.symptom === 'wisdom' && !WISDOM.includes(n));
      set({ tooth: n, scope: 'tooth', skipTooth: false, symptom: keep ? state.symptom : null });
    },
    'pick-jaw': () => set({ skipTooth: true, scope: 'jaw', tooth: null, symptom: null }),
    'skip-tooth': () => set({ skipTooth: true, scope: 'tooth', symptom: null }),
    'reset-tooth': () => set({ tooth: null, skipTooth: false, scope: null, symptom: null }),
    symptom: (t) => set({ symptom: state.symptom === t.dataset.id ? null : t.dataset.id }),
    'rec-svc': (t) => toggleCart(t.dataset.svc, catOfService(t.dataset.svc)),
    'rec-doc': (t) => {
      const name = t.dataset.name;
      if (state.docPick === name) { set({ docPick: null }); return; }
      const rec = D.recommend[state.symptom];
      const hiddenNow = state.recAll && D.doctors.filter((d) => rec.roles.includes(d.role)).findIndex((d) => d.name === name) >= 3;
      set(hiddenNow ? { docPick: name, recAll: false } : { docPick: name });
      if (hiddenNow) scrollToId('rec-who');
    },
    'rec-more': () => { const was = state.recAll; set({ recAll: !was }); if (was) scrollToId('rec-who'); },
    'go-cat': (t, e) => {
      e.preventDefault();
      const sym = currentSymptom();
      if (sym) { set({ cat: sym.cat }); scrollToId('svc-panel'); }
    },

    cat: (t, e) => { e.preventDefault(); openCat(t.dataset.cat); },
    'cat-tab': (t) => {
      if (t.dataset.cat === state.cat) return;
      set({ cat: t.dataset.cat, docPick: null, docsAll: false, svcAll: false, svcOpen: null });
      scrollToId('svc-panel');
    },
    'cat-close': () => { set({ cat: null }); scrollToId('services'); },
    'svc-check': (t) => {
      const n = t.closest('.svc-row').dataset.svc;
      if (n !== CONSULT) { toggleCart(n, catById(state.cat).name); return; }
      // a consultation needs a specialist: open the row to pick one, or clear the chosen one
      if (CONSULT_SUBS.some(([, cn]) => inCart(cn))) set({ cart: state.cart.filter((x) => !CONSULT_ROLE[x.n]) });
      else set({ svcOpen: n });
    },
    'svc-sub': (t) => {
      const cn = t.dataset.sub;
      const rest = state.cart.filter((x) => !CONSULT_ROLE[x.n]);
      set({ cart: inCart(cn) ? rest : rest.concat([{ n: cn, cat: catById(state.cat).name }]), docPick: null, docsAll: false });
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
    'panel-doc': (t) => set({ docPick: state.docPick === t.dataset.name ? null : t.dataset.name }),
    'docs-all': (t) => {
      const collapsing = t.getAttribute('aria-expanded') === 'true';
      set({ docsAll: !collapsing });
      if (collapsing) scrollToId('pick-doctor');
    },

    'cart-toggle': () => set({ cartOpen: !state.cartOpen }),
    'cart-close': () => set({ cartOpen: false }),
    'cart-remove': (t) => set({ cart: state.cart.filter((x) => x.n !== t.dataset.svc) }),
    'cart-clear': () => set({ cart: [], cartOpen: false }),

    'doc-filter': (t) => set({ docRole: t.dataset.role, docPage: 0 }),
    'doc-page': (t) => set({ docPage: +t.dataset.page }),
    'doc-prev': () => { const p = docPages(); set({ docPage: (Math.min(state.docPage, p - 1) - 1 + p) % p }); },
    'doc-next': () => { const p = docPages(); set({ docPage: (Math.min(state.docPage, p - 1) + 1) % p }); },
    'book-doc': (t) => set({ docPick: t.dataset.name }),

    'rev-page': (t) => set({ revPage: +t.dataset.page }),
    'rev-prev': () => set({ revPage: (state.revPage + 1) % 2 }),
    'rev-next': () => set({ revPage: (state.revPage + 1) % 2 }),

    top: () => window.scrollTo(0, 0)
  };
  const docPages = () => Math.max(1, Math.ceil(D.doctors.filter((d) => state.docRole === 'all' || d.role === state.docRole).length / DOCS_PER_PAGE));

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    // a click outside closes the clinic drop-down
    const closeAddr = state.addrOpen && !e.target.closest('.addr');
    if (closeAddr) state.addrOpen = false;
    if (t && actions[t.dataset.act]) actions[t.dataset.act](t, e);
    else if (closeAddr) render();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.addrOpen) set({ addrOpen: false });
  });

  /* ---------- start ---------- */
  function render() {
    renderClinic();
    renderPicker();
    renderServices();
    renderCart();
    renderDoctors();
    renderReviews();
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
