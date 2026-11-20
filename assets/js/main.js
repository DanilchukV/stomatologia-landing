'use strict';
// Page behaviour: header, the helper dialog (tooth → symptom → which doctor), services panel,
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
  const SPY = ['top', 'calm', 'services', 'doctors', 'clinics'];
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
    hStep: 1, tooth: null, scope: null, skipTooth: false, symptom: null, hDoc: null,
    cat: null, svcOpen: null, svcMore: null, svcAll: false, docsAll: false,
    // cart: ticked services {n, cat (name), cid}; picks: the doctor chosen per section;
    // extra: doctors booked without services {id, cid} (cid: the section's step 2 it came from, else null)
    // notes: what the helper was told {id (doctor), text}, shown in that doctor's group
    svcStep: 1, picks: {}, extra: [], notes: [], cart: [], bkOpen: false,
    docPage: 0, docOpen: null,
    time: 'любое', sent: false
  };
  function set(patch) {
    Object.assign(state, patch);
    if (bookEmpty()) state.bkOpen = false;
    render();
  }

  // a service is one per booking, whichever section it was ticked in («Консультация терапевта» is both in
  // treatment and, as a consultation, in diagnostics)
  const inCart = (n) => state.cart.some((x) => x.n === n);
  const catById = (id) => D.cats.find((c) => c.id === id);
  const currentSymptom = () => D.symptoms.find((x) => x.id === state.symptom) || null;
  // doctors are picked by id: names are empty until the clinic sends them, so the speciality stands in
  const docById = (id) => D.doctors.find((d) => d.id === id);
  const docsFor = (roles) => D.doctors.filter((d) => roles.includes(d.role));
  const docTitle = (d) => d.name || d.spec;
  // photo if there is one, else initials, else a silhouette; the box around it crops it (object-fit)
  const docAvatar = (d, size) => (d.photo ? `<img class="av-img" src="assets/img/doctors/${d.photo}.webp" alt="" loading="lazy">` : d.name ? initials(d.name) : person(size));
  // who sees patients in a category; in diagnostics, whoever does the ticked consultations (also one ticked in
  // treatment: it shows ticked there too)
  const catRoles = (cat, cart) => (cat.id === 'diag' ? cart.filter((x) => CONSULT_ROLE[x.n]).map((x) => CONSULT_ROLE[x.n]) : cat.roles);
  // the doctor picked automatically: the first one found, in the order of the roles
  const autoDoc = (roles) => { for (const r of roles) { const d = D.doctors.find((x) => x.role === r); if (d) return d.id; } return null; };
  // the section's doctor: kept once chosen, else the automatic one
  const withPick = (cid, cart) => ({ ...state.picks, [cid]: state.picks[cid] || autoDoc(catRoles(catById(cid), cart || state.cart)) });

  /* ---------- the booking: every section has its own doctor ---------- */
  // a ticked service goes to its section's doctor; diagnostics without a consultation to nobody
  function itemDoc(x) {
    if (x.cid === 'diag' && !isConsult(x.n)) return null;
    return state.picks[x.cid] || autoDoc(catRoles(catById(x.cid), state.cart));
  }
  // the booking by doctor: each doctor with their services, doctors without services too; diagnostics last
  function visits() {
    const map = new Map();
    const at = (id) => { if (!map.has(id)) map.set(id, []); return map.get(id); };
    state.cart.forEach((x) => at(itemDoc(x) || '').push(x));
    state.extra.forEach((e) => at(e.id));
    return Array.from(map, ([id, items]) => ({ id, doc: id ? docById(id) : null, items })).sort((a, b) => !a.doc - !b.doc);
  }
  const bookEmpty = () => !state.cart.length && !state.extra.length;
  const bookCount = () => visits().reduce((s, v) => s + (v.items.length || 1), 0);
  const inBooking = (id) => visits().some((v) => v.id === id);
  // adds a doctor without services; from a section's step 2 (cid) it replaces that section's earlier one
  function withDoc(id, cid) {
    const rest = state.extra.filter((e) => !(cid && e.cid === cid && e.id !== id));
    return rest.some((e) => e.id === id) ? rest : rest.concat([{ id, cid: cid || null }]);
  }
  // a doctor out of the booking, with their services ('' is the diagnostics group)
  const dropDoc = (id) => set({ cart: state.cart.filter((x) => (itemDoc(x) || '') !== id), extra: state.extra.filter((e) => e.id !== id), notes: state.notes.filter((x) => x.id !== id) });
  const notesOf = (id) => state.notes.filter((x) => x.id === id);
  // structure key for mount(): changes whenever the list would
  const visitsKey = () => visits().map((v) => v.id + ':' + v.items.map((x) => x.cid + '/' + x.n).join(',') + ':' + notesOf(v.id).map((x) => x.text).join(',')).join('|');
  // the same list in step 3 of Services, the booking form and the corner button
  function visitsHTML() {
    return `<ul class="visits">${visits().map((v) => {
      const d = v.doc;
      const who = d ? `<span class="av">${docAvatar(d, 20)}</span><span class="visit__who"><span class="visit__name">${esc(glue(docTitle(d)))}</span>${d.name ? `<span class="visit__spec">${esc(d.spec)}</span>` : ''}</span>`
        : `<span class="av">${icon('i-grid', 18, 2)}</span><span class="visit__who"><span class="visit__name">Диагностика</span><span class="visit__spec">без записи к&nbsp;врачу</span></span>`;
      const notes = notesOf(v.id).map((x) => `<p class="visit__note"><span class="visit__note-t"><b>Повод:</b> ${esc(glue(x.text))}</span><button type="button" class="visit__x" data-act="note-remove" data-id="${v.id}" data-text="${esc(x.text)}" aria-label="Убрать повод: ${esc(x.text)}">${icon('i-close', 12, 2.8)}</button></p>`).join('');
      const svcs = v.items.length
        ? `<ul class="visit__svcs">${v.items.map((x) => `<li class="visit__svc"><span class="visit__svc-n">${esc(glue(x.n))}</span><button type="button" class="visit__x" data-act="cart-remove" data-svc="${esc(x.n)}" data-cid="${x.cid}" aria-label="Убрать: ${esc(x.n)}">${icon('i-close', 12, 2.8)}</button></li>`).join('')}</ul>`
        : notes ? '' : `<p class="visit__none">${glue('Услуги подберёт врач на приёме')}</p>`;
      return `<li class="visit"><div class="visit__head">${who}<button type="button" class="visit__drop" data-act="visit-remove" data-id="${v.id}" aria-label="Убрать из записи: ${esc(d ? docTitle(d) : 'диагностика')}">${icon('i-close', 14, 2.6)}</button></div>${notes}${svcs}</li>`;
    }).join('')}</ul>`;
  }
  const PLUS = icon('i-plus', 16, 2.4);

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
  // after sending: show the confirmation and bring it to the middle of the screen
  function markSent(id) {
    set({ sent: true });
    document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function scrollToId(id) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  /* ---------- header ---------- */
  const hdr = $('#hdr');

  /* ---------- helper dialog: tooth picker ---------- */
  const helper = $('#helper');
  // a click on the dimmed backdrop lands on the <dialog> itself
  helper.addEventListener('click', (e) => { if (e.target === helper) helper.close(); });
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

  // one step at a time; a step opens once the one before it has an answer
  const HSTEPS = [
    ['Выберите зуб', 'Нажмите на зуб, который беспокоит, — он подсветится. Если вопрос не про один зуб, выберите вариант под схемой.'],
    ['Что беспокоит?', 'Выберите один вариант — тот, что ближе всего к вашей ситуации.']
  ];
  const canStep = (k) => k === 1 || (k === 2 ? state.tooth !== null || state.skipTooth : k === 3 && !!currentSymptom());
  const toothShort = () => (state.tooth !== null ? `Зуб ${qn(state.tooth)} · ${D.toothNames[state.tooth]}`
    : state.scope === 'jaw' ? 'Вся челюсть' : state.skipTooth ? 'Не знаю, какой зуб' : '');
  const recRoles = (sym) => { const r = (D.recommend[sym.id] || {}).roles || []; return r.length ? r : ['ther']; };
  const rolesText = (sym) => { const t = recRoles(sym).map((r) => ROLE_NAME[r]).join(' и '); return t[0].toUpperCase() + t.slice(1); };

  function hStep(k) {
    if (!canStep(k)) return;
    set({ hStep: k });
    $('#helper-body').scrollTop = 0;
    $('#helper-h').focus({ preventScroll: true });
  }

  function renderPicker() {
    const s = state;
    const sym = currentSymptom();
    const tooth = s.tooth;
    const step = s.hStep;

    $$('.hpane', helper).forEach((el) => { el.hidden = +el.dataset.step !== step; });
    helper.dataset.step = step;
    $('#helper-k').textContent = `Шаг ${step} из 3`;
    $('#helper-h').textContent = glue(step === 3 ? sym.title : HSTEPS[step - 1][0]);
    $('#helper-lead').textContent = glue(step === 3 ? sym.text : HSTEPS[step - 1][1]);

    // the doctor shows on the left only once step 3 has been opened, not while choosing the symptom
    const vals = [toothShort(), sym ? sym.label : '', sym && step !== 2 ? rolesText(sym) : ''];
    $$('.hstep__row', helper).forEach((b) => {
      const k = +b.dataset.step;
      if (k === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-locked', k !== step && !canStep(k));
      b.parentElement.classList.toggle('is-done', k !== step && canStep(k + 1));
      $('.hstep__v', b).textContent = glue(vals[k - 1]);
    });

    jaw.classList.toggle('is-jaw', s.scope === 'jaw');
    $$('.tooth', jaw).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.tooth === tooth));
    $('#tooth-hint').textContent = glue(tooth !== null
      ? `Выбран зуб ${qn(tooth)} — ${D.toothNames[tooth]}, ${tooth <= 16 ? 'верхняя' : 'нижняя'} челюсть, ${sideOf(tooth) === 'справа' ? 'правая' : 'левая'} сторона`
      : s.scope === 'jaw' ? 'Выбран вопрос по всей челюсти' : 'Нажмите на зуб на схеме');

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

    const html = sym ? hintHTML(sym) : '';
    mount($('#hint'), html, () => html);
    const chosen = helperDoc();
    $$('.hint__doc.is-pick', helper).forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === chosen));

    const next = $('.helper__next', helper);
    next.hidden = step === 3;
    next.disabled = !canStep(step + 1);
    next.firstChild.textContent = step === 1 ? 'Далее' : 'Показать врача';
    $('.helper__back', helper).hidden = step === 1;
    const book = $('.helper__book', helper);
    book.hidden = step !== 3;
    book.disabled = !chosen;
    $('#helper-info').textContent = glue(step === 1 ? (toothShort() || 'Зуб можно не выбирать — есть варианты под схемой')
      : step === 2 ? (sym ? sym.label : 'Выберите один вариант')
        : chosen ? 'Врач: ' + docTitle(docById(chosen)) : 'Выберите врача, чтобы записаться');
  }

  // the doctor booking from the helper goes to: the only one, or the one the visitor picked
  function helperDoc() {
    const sym = currentSymptom();
    if (!sym) return null;
    const list = docsFor(recRoles(sym));
    if (list.length === 1) return list[0].id;
    return list.some((d) => d.id === state.hDoc) ? state.hDoc : null;
  }

  // beside a single doctor's card: what the first visit is like (the clinic's promises), so the box isn't half empty
  const VISIT = `<div class="hint__visit"><span class="caps">Как пройдёт первый приём</span><ul class="bullets bullets--md">${
    ['Осмотр и, если нужно, снимок', 'Врач объяснит, в чём причина и какие есть варианты', 'Письменный план и смета до начала лечения']
      .map((t) => `<li><span>${glue(t)}</span></li>`).join('')}</ul></div>`;

  // the answer: which doctor to see (the therapist when the symptom names none); booking is the bar's button
  function hintHTML(sym) {
    const cat = catById(sym.cat);
    const rec = D.recommend[sym.id] || { svcs: [], roles: [] };
    // the cards can be narrow: non-breaking spaces stay only after numbers ("12 лет"), so "сертификат CAD/CAM" can wrap
    const docList = docsFor(recRoles(sym));
    // two or more doctors: the cards are a choice, and booking waits for it
    const pick = docList.length > 1;
    const docs = docList.map((d) => `<${pick ? `button type="button" class="hint__doc is-pick" data-act="helper-doc" data-id="${d.id}" aria-pressed="false"` : 'div class="hint__doc"'}>
        <span class="hint__doc-ph">${d.photo ? `<img src="assets/img/doctors/${d.photo}.webp" alt="" loading="lazy">` : d.name ? initials(d.name) : person(40)}</span>
        <span class="hint__doc-text"><span class="hint__doc-name">${esc(glue(docTitle(d)))}</span>${d.name ? `<span class="hint__doc-spec">${esc(d.spec)}</span>` : ''}${d.exp ? `<span class="hint__doc-exp">${icon('i-award', 16, 1.8)}${esc(d.exp.replace(/(\D)\s/g, '$1 '))}</span>` : ''}</span>
        ${pick ? `<span class="hint__doc-tick">${icon('i-check', 14, 3)}</span>` : ''}
      </${pick ? 'button' : 'div'}>`).join('');
    const svcs = rec.svcs.length ? `<div class="hint__sec"><span class="caps">Вероятно понадобится</span><ul class="bullets bullets--md">${rec.svcs.map((n) => `<li><span>${esc(glue(n))}</span></li>`).join('')}</ul></div>` : '';
    return `${WISDOM.includes(state.tooth) && sym.id !== 'wisdom' ? `<p class="hint__note">${glue('Это зуб мудрости — возможно, понадобится консультация хирурга.')}</p>` : ''}
      <div class="hint__answer"><span class="caps">Вам к&nbsp;врачу</span><span class="hint__answer-v">${esc(rolesText(sym))}</span>${pick ? '<span class="hint__pick-note">Выберите, к&nbsp;кому записаться</span>' : ''}<div class="hint__docs">${docs}${docList.length === 1 ? VISIT : ''}</div></div>
      <div class="hint__more">
        <div class="hint__row"><span class="hint__k">Направление</span><span class="hint__v">${esc(glue(cat.name))}</span></div>
        ${svcs}
      </div>
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
    if (mount(svcOpenBox, 'open', panelShellHTML)) {
      const svcForm = $('#svc-form');
      window.SiteForm.bind(svcForm, () => markSent('svc-done'));
      copyContacts(form, svcForm);
    }
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
    const roles = catRoles(cat, state.cart);
    const pick = state.picks[cat.id] || null;
    const docs = docsFor(roles);
    // diagnostics without a consultation: no doctor to choose, said the same way as in step 3
    const noDoc = cat.id === 'diag' && !roles.length;
    $('#pick-doctor .panel-h').textContent = noDoc ? 'Врач не нужен' : 'Выберите врача';
    $('#doc-pick-who').textContent = glue(docs.length ? (docs.length === 1 ? 'Принимает ' : 'Принимают ') + docs.map((d) => d.spec.toLowerCase()).join(', ')
      : noDoc ? 'Врач понадобится, только если отметить консультацию' : 'Врача подберём при записи');

    const opts = docs.map((d) => ({ id: d.id, title: docTitle(d), av: docAvatar(d, 40), sub: d.name ? d.spec : 'Фото и имя скоро появятся' }));
    const picked = opts.findIndex((d) => d.id === pick);
    const docsExpanded = state.docsAll || picked >= DOC_LIMIT;
    const grid = $('#doc-pick-grid');
    mount(grid, roles.join() + docsExpanded + noDoc, () => (noDoc
      ? `<div class="doc-card doc-card--none"><span class="doc-card__av">${icon('i-grid', 32, 1.8)}</span><span class="doc-card__text"><span class="doc-card__name">Диагностика</span><span class="doc-card__sub">${glue('Без записи к врачу — снимки и сканирование делают сразу')}</span></span></div>`
      : '') + opts.filter((d, k) => docsExpanded || k < DOC_LIMIT).map((d) => `<button type="button" class="doc-card" aria-pressed="false" data-act="panel-doc" data-id="${d.id}" data-focus="pdoc:${d.id}"><span class="doc-card__av">${d.av}</span><span class="doc-card__text"><span class="doc-card__name">${esc(d.title)}</span>${d.sub ? `<span class="doc-card__sub">${esc(d.sub)}</span>` : ''}</span><span class="doc-card__tick">${icon('i-check', 16, 2.8)}</span></button>`).join(''));
    $$('.doc-card', grid).forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === pick));
    const moreDocs = $('#docs-all');
    moreDocs.hidden = opts.length <= DOC_LIMIT;
    moreDocs.setAttribute('aria-expanded', docsExpanded);
    moreDocs.firstChild.textContent = docsExpanded ? 'Свернуть' : 'Показать ещё ' + (opts.length - DOC_LIMIT);

    // step 3: the whole booking by doctor, services of every section included; one card, a row per part
    const empty = bookEmpty();
    mount($('#svc-sum'), visitsKey(), () => `
      <div class="svc-sum__row"><span class="svc-sum__k">Врачи и&nbsp;услуги</span><div class="svc-sum__v">${empty
        ? `<p class="svc-sum__empty">${glue('Не выбраны — ничего страшного: администратор поможет подобрать по телефону.')}</p>` : visitsHTML()}
        <button type="button" class="add-svc" data-act="add-svc">${PLUS}${empty ? 'Выбрать услугу' : 'Добавить ещё услугу'}</button></div></div>
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
    // the section's ticked rows, counting a service ticked in another section that is also listed here
    const n = cat.items.filter((x) => (x === CONSULT ? CONSULT_SUBS.some(([, cn]) => inCart(cn)) : inCart(x))).length;
    $('#svc-nav-info').textContent = glue(step === 1 ? (n ? 'Выбрано ' + n + ' ' + servicesWord(n) : 'Можно не выбирать — поможем по телефону')
      : step === 2 ? (noDoc ? 'Без записи к врачу' : 'Врач: ' + (pick ? docTitle(docById(pick)) : 'подберём при записи')) : '');
    $('.svc-nav__back', svcOpenBox).hidden = step === 1;
    $('.svc-nav__next', svcOpenBox).hidden = step === 3;
    $('.svc-nav__next', svcOpenBox).firstChild.textContent = step === 1 ? 'Выбрать врача' : 'Далее: запись';
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
            ${STEPS.map((t, k) => `<li class="wiz__item"><button type="button" class="wiz__btn" data-act="svc-step" data-step="${k + 1}"><span class="num"><span class="wiz__n">${k + 1}</span>${icon('i-check', 14, 3)}</span><span class="wiz__t">${t}</span></button></li>`).join('')}
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
                <button type="button" class="btn btn--dark svc-done__again" data-act="book-again" data-from="svc">Записаться ещё раз</button>
              </div>
            </div>
            <p class="svc-consent" id="svc-consent">${glue('Отправляя заявку, вы соглашаетесь на обработку персональных данных.')}</p>
          </div>
          <div class="svc-nav">
            <button type="button" class="btn btn--ghost svc-nav__back" data-act="svc-prev">${icon('i-back', 16, 2.4)}Назад</button>
            <span class="svc-nav__info" id="svc-nav-info"></span>
            <button type="button" class="svc-nav__reset" data-act="cart-reset" hidden>${icon('i-reset', 15, 2.2)}Сбросить всё</button>
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

  /* ---------- doctors carousel ---------- */
  // on a phone all cards are one swipeable row (CSS), so no pages
  const swipeMedia = window.matchMedia('(max-width: 640px)');
  const PERSON = '<svg class="doc__ph" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.8-4.2 3.8-6.5 7.5-6.5s6.7 2.3 7.5 6.5"/></svg>';
  // «Подробнее»: the chosen card is outlined, the others fade a little, and a panel slides open under the row with a
  // big photo and the story (style.css .doc-panel); the cards themselves never change size
  const BIO = [['Образование', 'edu'], ['Опыт работы', 'work'], ['Повышение квалификации', 'courses'], ['Дипломы и сертификаты', 'certs']];
  const hasBio = (d) => BIO.some(([, k]) => d[k] && d[k].length);
  const docPhoto = (d) => (d.photo ? `<img src="assets/img/doctors/${d.photo}.webp" alt="" loading="lazy">` : d.name ? `<span class="doc__ini" aria-hidden="true">${initials(d.name)}</span>` : PERSON);
  const docPanelHTML = (d) => `<div class="doc-panel__card" data-id="${d.id}">
      <div class="doc-panel__photo">${docPhoto(d)}</div>
      <div class="doc-panel__body">
        <div class="doc-panel__head"><h3 class="doc-panel__name">${esc(d.name || d.spec)}</h3><span class="doc-panel__spec">${esc(d.spec)}</span>${d.exp ? `<span class="doc__exp">${icon('i-award', 16, 1.8)}${esc(d.exp)}</span>` : ''}</div>
        <dl class="doc-panel__facts">${BIO.filter(([, k]) => d[k] && d[k].length).map(([label, k]) => `<div class="doc-panel__row"><dt>${label}</dt><dd><ul class="doc-panel__list">${d[k].map((x) => `<li>${esc(glue(x))}</li>`).join('')}</ul></dd></div>`).join('')}</dl>
        <div class="doc-panel__actions">${BOOKABLE.includes(d.role) ? `<a href="#book" class="btn btn--dark doc-panel__btn" data-act="book-doc" data-id="${d.id}">Записаться к&nbsp;врачу</a>` : ''}<button type="button" class="btn btn--ghost doc-panel__btn" data-act="doc-more" data-id="${d.id}">Свернуть</button></div>
      </div>
      <button type="button" class="doc-panel__x" data-act="doc-more" data-id="${d.id}" aria-label="Закрыть">${icon('i-close', 18, 2.4)}</button>
    </div>`;
  // the little caret on top of the panel points at the chosen card
  function docCaret() {
    const panel = $('#doc-panel');
    const card = $('.doc.is-open', $('#doc-track'));
    if (!card) return;
    const c = card.getBoundingClientRect(), p = panel.getBoundingClientRect();
    panel.style.setProperty('--caret-x', Math.max(32, Math.min(p.width - 32, c.left + c.width / 2 - p.left)) + 'px');
  }
  function renderDoctors() {
    const list = D.doctors;
    const pages = Math.max(1, Math.ceil(list.length / DOCS_PER_PAGE));
    const page = Math.min(state.docPage, pages - 1);
    const swipe = swipeMedia.matches;
    const track = $('#doc-track');
    const shown = swipe ? list : list.slice(page * DOCS_PER_PAGE, (page + 1) * DOCS_PER_PAGE);
    // the photo; without it the initials, without a name too a silhouette (the photo is blended, so nothing may sit under it)
    const rebuilt = mount(track, swipe ? 'all' : String(page), () => shown.map((d) => `<article class="doc" data-id="${d.id}">
        <div class="doc__photo">${docPhoto(d)}</div>
        <div class="doc__main">
          <div class="doc__info"><h3 class="doc__name">${esc(d.name || d.spec)}</h3><span class="doc__spec">${d.name ? esc(d.spec) : 'Фото и&nbsp;имя скоро появятся'}${d.exp ? `<span class="doc__exp">${icon('i-award', 16, 1.8)}${esc(d.exp)}</span>` : ''}</span></div>
          <div class="doc__foot">${hasBio(d) ? `<button type="button" class="doc__toggle" data-act="doc-more" data-id="${d.id}" aria-expanded="false" aria-controls="doc-panel"><span>Подробнее</span>${icon('i-chev', 14, 2.6)}</button>` : ''}${BOOKABLE.includes(d.role) ? `<a href="#book" class="doc__book" data-act="book-doc" data-id="${d.id}">Записаться</a>` : ''}</div>
        </div>
      </article>`).join(''));
    if (rebuilt) track.scrollLeft = 0;
    const open = shown.find((d) => d.id === state.docOpen) || null;
    track.classList.toggle('has-open', !!open);
    $$('.doc', track).forEach((el) => {
      const on = !!open && el.dataset.id === open.id;
      el.classList.toggle('is-open', on);
      const b = $('.doc__toggle', el);
      if (b) { b.setAttribute('aria-expanded', on); b.firstChild.textContent = on ? 'Свернуть' : 'Подробнее'; }
    });
    // every story is in the panel at once, stacked (style.css), so the panel has one size for all doctors;
    // it keeps the last one shown while it folds away, so closing doesn't empty it mid-motion
    const panel = $('#doc-panel');
    const panelIn = $('#doc-panel-in');
    mount(panelIn, 'all', () => `<div class="doc-panel__stack">${list.filter(hasBio).map(docPanelHTML).join('')}</div>`);
    if (open) $$('.doc-panel__card', panelIn).forEach((c) => c.classList.toggle('is-cur', c.dataset.id === open.id));
    panel.classList.toggle('is-open', !!open);
    panel.setAttribute('aria-hidden', !open);
    if (open) docCaret();
    const multi = pages > 1;
    $$('.side-arrow').forEach((b) => { b.hidden = !multi; });
    $('#doc-dots-row').hidden = !multi;
    const dots = $('#doc-dots');
    mount(dots, String(pages), () => Array.from({ length: pages }, (_, k) => `<button type="button" class="dot" aria-pressed="false" aria-label="Страница ${k + 1} из ${pages}" data-act="doc-page" data-page="${k}"></button>`).join(''));
    $$('.dot', dots).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.page === page));
  }
  const docPages = () => Math.max(1, Math.ceil(D.doctors.length / DOCS_PER_PAGE));

  /* ---------- «Что мы гарантируем» ---------- */
  // on phones each promise opens with its heading (style.css); wider, the texts always show and the headings are
  // disabled buttons, so they are plain text to keyboards and screen readers
  function syncPromises() {
    $$('.promise__btn').forEach((b) => {
      b.disabled = !swipeMedia.matches;
      if (swipeMedia.matches) b.setAttribute('aria-expanded', b.closest('.promise__item').classList.contains('is-open'));
      else b.removeAttribute('aria-expanded');
    });
  }

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
      // the closed height is the summary plus the item's own borders (.faq is border-box)
      const to = closing ? sum.offsetHeight + el.offsetHeight - el.clientHeight : el.offsetHeight;
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
  window.SiteForm.bind(form, () => markSent('book-done'));
  form.addEventListener('change', (e) => { if (e.target.name === 'time') set({ time: e.target.value }); });
  // Services' step 3 and this form are one booking: the name and phone typed in either show in the other
  const CONTACTS = ['name', 'phone'];
  function copyContacts(from, to) {
    if (from && to) CONTACTS.forEach((k) => { if (from.elements[k] && to.elements[k]) to.elements[k].value = from.elements[k].value; });
  }
  document.addEventListener('input', (e) => {
    const f = e.target.form;
    if (!f || !CONTACTS.includes(e.target.name) || (f.id !== 'book-form' && f.id !== 'svc-form')) return;
    copyContacts(f, f.id === 'book-form' ? $('#svc-form') : form);
  });

  function renderBooking() {
    // the doctors: each tile adds that doctor to the booking or takes them out (with their services)
    const docsBox = $('#book-docs');
    mount(docsBox, 'docs', () => D.doctors.filter((d) => BOOKABLE.includes(d.role))
      .map((d) => `<button type="button" class="book-doc" aria-pressed="false" data-act="book-pick" data-id="${d.id}"><span class="av">${docAvatar(d, 20)}</span><span class="book-doc__text"><span class="book-doc__name">${esc(glue(docTitle(d)))}</span><span class="book-doc__sub">${esc(d.spec)}</span></span></button>`).join(''));
    $$('.book-doc', docsBox).forEach((b) => b.setAttribute('aria-pressed', inBooking(b.dataset.id)));
    // the whole booking by doctor, as in Services' step 3
    mount($('#book-svcs'), visitsKey(), () => (bookEmpty()
      ? `<p class="book__empty">${glue('Не выбраны — администратор поможет подобрать по телефону.')} <a href="#services">${glue('Выбрать в «Услугах»')}</a></p>`
      : visitsHTML() + `<button type="button" class="add-svc" data-act="add-svc">${PLUS}Добавить ещё услугу</button>`));
    $$('[data-act="cart-reset"]').forEach((b) => { b.hidden = bookEmpty(); });
    form.elements.time.value = state.time;
    // the form and the confirmation share one grid cell, so the card keeps its size (see style.css)
    $('.book__card').classList.toggle('is-sent', state.sent);
  }

  /* ---------- the booking in the corner ---------- */
  // «Ваша запись · N» bottom right once something is chosen; opens the same list as step 3, with remove buttons.
  // Hidden while the booking form is on screen (it shows the same) and after sending.
  const bk = $('#bk');
  function bookOnScreen() {
    const r = $('.book__card').getBoundingClientRect();
    return r.top < window.innerHeight - 120 && r.bottom > 120;
  }
  function renderCorner() {
    const n = bookCount();
    const hide = !n || state.sent || bookOnScreen();
    if (hide && state.bkOpen) state.bkOpen = false;
    bk.hidden = hide;
    toTop.classList.toggle('is-raised', !hide);
    if (hide) return;
    mount(bk, 'bk', () => `<div class="bk__pop" id="bk-pop" role="dialog" aria-labelledby="bk-title" hidden>
        <div class="bk__head"><span class="bk__title" id="bk-title">Ваша запись</span>
          <button type="button" class="bk__close" data-act="bk-toggle" aria-label="Свернуть">${icon('i-close', 16, 2.4)}</button></div>
        <div class="bk__list" id="bk-list"></div>
        <div class="bk__foot">
          <p class="bk__note">${glue('Администратор перезвонит, согласует время и подтвердит запись.')}</p>
          <div class="bk__actions"><button type="button" class="btn btn--ghost bk__add" data-act="add-svc">${PLUS}Добавить услугу</button><a href="#book" class="btn btn--dark bk__go" data-act="bk-go">Оформить${icon('i-arrow', 16, 2.4)}</a></div>
        </div>
      </div>
      <button type="button" class="bk__pill" data-act="bk-toggle" aria-expanded="false" aria-controls="bk-pop"><span class="bk__count" id="bk-count"></span><span>Ваша запись</span>${icon('i-chev-up', 16, 2.4)}</button>`);
    $('#bk-pop').hidden = !state.bkOpen;
    mount($('#bk-list'), visitsKey(), visitsHTML);
    $('#bk-count').textContent = n;
    const pill = $('.bk__pill', bk);
    pill.setAttribute('aria-expanded', state.bkOpen);
    pill.classList.toggle('on-dark', !state.bkOpen && darkUnder(pill));
  }

  /* ---------- scroll-driven bits ---------- */
  const toTop = $('#to-top');
  // true when the page under a floating button is dark, so the button switches to its light version
  function darkUnder(node) {
    const r = node.getBoundingClientRect();
    let el = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((n) => !n.closest('.to-top, .bk'));
    while (el && el !== document.documentElement) {
      const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
      if (m && (m[4] === undefined || +m[4] > 0.5)) return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.4;
      el = el.parentElement;
    }
    return false;
  }
  function updateFloating() {
    const y = window.scrollY;
    // a stuck services bar takes over the header's shadow, which would otherwise darken its chips
    const bar = $('.svc-bar');
    // stuck = sitting exactly at its CSS sticky `top`; once Services scrolls away the bar goes up under the header
    // and is no longer stuck, so the header gets its shadow back
    const stuck = !!bar && Math.abs(bar.getBoundingClientRect().top - parseFloat(getComputedStyle(bar).top)) < 1.5;
    if (bar) bar.classList.toggle('is-stuck', stuck);
    hdr.classList.toggle('is-scrolled', y > 8 && !stuck);
    renderCorner();
    toTop.hidden = y <= 900;
    if (!toTop.hidden) toTop.classList.toggle('on-dark', darkUnder(toTop));
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
    set({ cart: inCart(n) ? state.cart.filter((x) => x.n !== n) : state.cart.concat([{ n, cat: cat.name, cid: cat.id }]) });
  }
  function openCat(id) {
    // from the grid: every card flies up into its tab of the sticky bar
    const from = !state.cat && !reduceMotion.matches
      ? $$('.svc-card').map((c) => ({ cat: c.dataset.cat, r: c.getBoundingClientRect(), img: ($('img', c) || {}).currentSrc })) : null;
    set({ cat: id, svcStep: 1, picks: withPick(id), docsAll: false, svcAll: false });
    // the page lines the tab bar up under the header (where it sticks), scrolling while the cards fly
    // (the ghosts measure the tabs first, so the scroll starts after that)
    const shift = Math.max(0, $('.svc-bar').getBoundingClientRect().top - hdr.getBoundingClientRect().bottom - 10);
    const end = from ? flyToTabs(from, id, shift) : 0;
    if (shift > 1) window.scrollTo({ top: window.scrollY + shift, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    if (!from) return;
    // the panel waits until the cards have landed, then fades in where it is, without moving
    // (a script animation, so it wins over the panel's own CSS entrance)
    const REVEAL = 380;
    const wait = end - 80;
    $('#svc-panel').animate([{ opacity: 0, transform: 'none' }, { opacity: 0, transform: 'none', offset: wait / (wait + REVEAL) }, { opacity: 1, transform: 'none' }],
      { duration: wait + REVEAL, easing: 'ease-out' });
  }

  // ghosts from the card rects to the tab rects (where the tabs will be once the page has scrolled by `shift`);
  // the real tabs stay invisible until their ghost lands
  function flyToTabs(from, active, shift) {
    const tabs = $('.svc-bar__tabs');
    tabs.classList.add('is-landing');
    const DUR = 680, STEP = 28;
    from.forEach((f, k) => {
      const tab = $(`.svc-bar__tab[data-cat="${f.cat}"]`, tabs);
      if (!tab) return;
      const r = tab.getBoundingClientRect();
      const t = { left: r.left, top: r.top - shift, width: r.width, height: r.height };
      const g = document.createElement('div');
      g.className = 'svc-fly' + (f.cat === active ? ' is-active' : '');
      g.innerHTML = `${f.img ? `<img src="${f.img}" alt="">` : ''}<span>${tab.textContent}</span>`;
      document.body.appendChild(g);
      const box = (r, radius) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: radius });
      const opt = { duration: DUR, delay: k * STEP, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' };
      g.animate([box(f.r, '24px'), box(t, t.height / 2 + 'px')], opt);
      if (f.img) $('img', g).animate([{ opacity: 1 }, { opacity: 0, offset: .55 }, { opacity: 0 }], opt);
      $('span', g).animate([{ opacity: 0 }, { opacity: 0, offset: .45 }, { opacity: 1 }], opt)
        .finished.then(() => { tab.classList.add('is-landed'); g.remove(); });
    });
    const end = DUR + (from.length - 1) * STEP;
    setTimeout(() => { tabs.classList.remove('is-landing'); $$('.is-landed', tabs).forEach((b) => b.classList.remove('is-landed')); }, end + 50);
    return end;
  }
  // shows step k of the services panel; scrolls back up if the step bar is above the screen
  function goStep(k) {
    if (k < 1 || k > STEPS.length) return;
    const patch = { svcStep: k };
    // on to step 3 from the doctor step with none of the section's services ticked: the doctor alone is booked
    const c = state.cat, id = state.picks[c];
    if (k === 3 && state.svcStep === 2 && id && !state.cart.some((x) => x.cid === c && itemDoc(x))) patch.extra = withDoc(id, c);
    set(patch);
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
    'pick-jaw': () => { if (state.scope !== 'jaw') set({ skipTooth: true, scope: 'jaw', tooth: null, symptom: null }); hStep(2); },
    'skip-tooth': () => { if (state.tooth !== null || !state.skipTooth || state.scope === 'jaw') set({ skipTooth: true, scope: 'tooth', tooth: null, symptom: null }); hStep(2); },
    symptom: (t) => {
      const id = state.symptom === t.dataset.id ? null : t.dataset.id;
      set({ symptom: id });
    },
    'helper-next': () => hStep(state.hStep + 1),
    'helper-back': () => hStep(state.hStep - 1),
    'helper-doc': (t) => set({ hDoc: t.dataset.id }),
    // to the booking form, with the helper's doctor chosen there
    'helper-book': () => {
      const id = helperDoc();
      if (!id) return;
      helper.close();
      // the reason goes with the doctor, so the administrator knows what it is about
      const t = state.tooth;
      const where = t !== null ? `зуб ${qn(t)} ${jawOf(t)} ${sideOf(t)}` : state.scope === 'jaw' ? 'вся челюсть' : '';
      const text = currentSymptom().label + (where ? ' · ' + where : '');
      const notes = state.notes.some((x) => x.id === id && x.text === text) ? state.notes : state.notes.concat([{ id, text }]);
      set({ extra: withDoc(id), notes });
      scrollToId('book');
    },
    'helper-open': () => { helper.showModal(); $('#helper-body').scrollTop = 0; },
    // the finder's «Выбрать зуб»: the helper on its first step, the tooth map
    'finder-open': () => {
      set({ hStep: 1 });
      helper.showModal();
      $('#helper-body').scrollTop = 0;
    },
    'helper-close': () => helper.close(),

    cat: (t, e) => { e.preventDefault(); openCat(t.dataset.cat); },
    'cat-tab': (t) => {
      if (t.dataset.cat === state.cat) return;
      set({ cat: t.dataset.cat, svcStep: 1, picks: withPick(t.dataset.cat), docsAll: false, svcAll: false, svcOpen: null });
      scrollToId('svc-panel');
    },
    // back to the section's title with all the cards under it
    'cat-close': () => { set({ cat: null }); scrollToId('services'); },
    'svc-check': (t) => {
      const n = t.closest('.svc-row').dataset.svc;
      if (n !== CONSULT) { toggleCart(n, catById(state.cat)); return; }
      // a consultation needs a specialist: open the row to pick one, or clear the chosen ones (wherever ticked)
      if (CONSULT_SUBS.some(([, cn]) => inCart(cn))) set({ cart: state.cart.filter((x) => !isConsult(x.n)), picks: { ...state.picks, [state.cat]: null } });
      else set({ svcOpen: n });
    },
    // diagnostics: one consultation at a time here (one ticked in another section stays); pressing a chosen one
    // takes it out, wherever it was ticked; the specialist becomes the section's doctor
    'svc-sub': (t) => {
      const cn = t.dataset.sub;
      const cat = catById(state.cat);
      const rest = state.cart.filter((x) => !(isConsult(x.n) && (x.cid === cat.id || x.n === cn)));
      const cart = inCart(cn) ? rest : rest.concat([{ n: cn, cat: cat.name, cid: cat.id }]);
      set({ cart, picks: { ...state.picks, [cat.id]: autoDoc(catRoles(cat, cart)) }, docsAll: false });
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
    // the section's doctor; if that section's doctor was booked alone (see goStep), the new one takes the place
    'panel-doc': (t) => {
      const c = state.cat;
      const patch = { picks: { ...state.picks, [c]: t.dataset.id } };
      if (state.extra.some((e) => e.cid === c)) patch.extra = withDoc(t.dataset.id, c);
      set(patch);
    },
    'docs-all': (t) => {
      const collapsing = t.getAttribute('aria-expanded') === 'true';
      set({ docsAll: !collapsing });
      if (collapsing) scrollToId('pick-doctor');
    },
    'svc-step': (t) => goStep(+t.dataset.step),
    'svc-prev': () => goStep(state.svcStep - 1),
    'svc-next': () => goStep(state.svcStep + 1),
    'svc-time': (t) => set({ time: t.dataset.time }),
    // a new booking: empty forms, no services, default doctor and time; back to where it was clicked
    'book-again': (t) => {
      form.reset();
      const svcForm = $('#svc-form');
      if (svcForm) svcForm.reset();
      const cat = catById(state.cat);
      set({ sent: false, cart: [], extra: [], notes: [], time: 'любое', svcStep: 1, svcOpen: null, picks: cat ? { [cat.id]: autoDoc(catRoles(cat, [])) } : {} });
      if (t.dataset.from === 'svc') scrollToId('svc-steps');
      else form.elements.name.focus();
    },

    'cart-remove': (t) => set({ cart: state.cart.filter((x) => !(x.n === t.dataset.svc && x.cid === t.dataset.cid)) }),
    'visit-remove': (t) => dropDoc(t.dataset.id),
    'note-remove': (t) => set({ notes: state.notes.filter((x) => !(x.id === t.dataset.id && x.text === t.dataset.text)) }),
    // "Сбросить всё": the picked services and doctors, in Services and the booking form alike (name and phone stay)
    'cart-reset': () => set({ cart: [], extra: [], notes: [], svcOpen: null }),
    'book-pick': (t) => { const id = t.dataset.id; if (inBooking(id)) dropDoc(id); else set({ extra: withDoc(id) }); },
    // the corner button: open or fold the list; «Добавить услугу» goes back to all the sections
    'bk-toggle': () => set({ bkOpen: !state.bkOpen }),
    'bk-go': () => set({ bkOpen: false }),
    'add-svc': () => { set({ bkOpen: false, cat: null }); scrollToId('services'); },

    'doc-more': (t) => {
      const id = state.docOpen === t.dataset.id ? null : t.dataset.id;
      const track = $('#doc-track');
      const panel = $('#doc-panel');
      // where the panel will start once open: its negative margin (closed) goes to 0
      const panelTop = panel.getBoundingClientRect().top - parseFloat(getComputedStyle(panel).marginTop);
      set({ docOpen: id });
      const under = hdr.getBoundingClientRect().bottom;
      const room = window.innerHeight - under;
      if (id) {
        // the story in the middle of the screen under the header, glided along with the panel's opening
        // (its final height is the content's); a story taller than the screen starts just under the header
        const h = $('#doc-panel-in').scrollHeight;
        const dy = h + 32 > room ? panelTop - under - 16 : panelTop + h / 2 - (under + room / 2);
        glideTo(window.scrollY + dy, 700);
      } else {
        // closing while scrolled down into the panel: back to the row
        const row = track.getBoundingClientRect().top - under - 16;
        if (row < 0) glideTo(window.scrollY + row, 700);
      }
    },
    'doc-page': (t) => set({ docPage: +t.dataset.page, docOpen: null }),
    'doc-prev': () => { const p = docPages(); set({ docPage: (Math.min(state.docPage, p - 1) - 1 + p) % p, docOpen: null }); },
    'doc-next': () => { const p = docPages(); set({ docPage: (Math.min(state.docPage, p - 1) + 1) % p, docOpen: null }); },
    'book-doc': (t) => set({ extra: withDoc(t.dataset.id) }),

    promise: (t) => { t.closest('.promise__item').classList.toggle('is-open'); syncPromises(); },

    top: () => scrollToTop(),
    'cookie-ok': () => closeCookie()
  };

  document.addEventListener('click', (e) => {
    // a click anywhere else folds the corner list
    if (state.bkOpen && !e.target.closest('.bk')) set({ bkOpen: false });
    const t = e.target.closest('[data-act]');
    if (t && actions[t.dataset.act]) actions[t.dataset.act](t, e);
  });
  // iOS Safari applies :active (the press-in in style.css) only when the page listens for touches
  document.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !state.bkOpen) return;
    set({ bkOpen: false });
    $('.bk__pill', bk).focus();
  });


  /* ---------- back to top ---------- */
  // the arrow lifts off, then the page glides up: a slow start and a soft landing, longer for a longer way;
  // a wheel turn or a touch stops it
  function scrollToTop() {
    const from = window.scrollY;
    if (!from) return;
    if (!reduceMotion.matches) {
      toTop.classList.remove('is-launch');
      void toTop.offsetWidth; // restarts the CSS animation
      toTop.classList.add('is-launch');
    }
    glideTo(0, Math.min(1200, 500 + from / 8));
  }
  // the page glides to y: a slow start and a soft landing; a wheel turn or a touch stops it
  function glideTo(y, dur) {
    const from = window.scrollY;
    const to = Math.max(0, Math.round(y));
    if (Math.abs(to - from) < 2) return;
    if (reduceMotion.matches) { window.scrollTo(0, to); return; }
    const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let stopped = false;
    const stop = () => { stopped = true; };
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    const t0 = performance.now();
    (function step(now) {
      const p = stopped ? 1 : Math.min(1, (now - t0) / dur);
      if (!stopped) window.scrollTo(0, Math.round(from + (to - from) * ease(p)));
      if (p < 1) { requestAnimationFrame(step); return; }
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    })(t0);
  }

  /* ---------- cookie notice ---------- */
  // shown until the visitor presses "Хорошо"; the answer is kept in localStorage (blocked storage: shown each visit)
  const cookie = $('#cookie');
  const COOKIE_KEY = 'cookie-ok';
  let cookieSeen = false;
  try { cookieSeen = localStorage.getItem(COOKIE_KEY) === '1'; } catch (e) { /* private mode */ }
  // on phones the notice spans the bottom, so the back-to-top button moves up above it
  const liftToTop = () => document.documentElement.style.setProperty('--cookie-h', cookie.hidden ? '0px' : cookie.offsetHeight + 'px');
  if (!cookieSeen) {
    setTimeout(() => { cookie.hidden = false; cookie.classList.add('is-in'); liftToTop(); }, 900);
    window.addEventListener('resize', liftToTop);
  }
  function closeCookie() {
    try { localStorage.setItem(COOKIE_KEY, '1'); } catch (e) { /* private mode */ }
    cookie.classList.replace('is-in', 'is-out');
    setTimeout(() => { cookie.hidden = true; liftToTop(); }, 280);
  }

  /* ---------- start ---------- */
  function render() {
    renderPicker();
    renderServices();
    renderDoctors();
    renderBooking();
    updateFloating();
  }
  buildTeeth();
  render();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  swipeMedia.addEventListener('change', render);
  swipeMedia.addEventListener('change', syncPromises);
  syncPromises();
  // the panel's caret follows its card when the page is resized or the phone row is swiped
  window.addEventListener('resize', docCaret);
  $('#doc-track').addEventListener('scroll', docCaret, { passive: true });
  onScroll();
  // the doctors grid is built by script, so re-apply an anchor from the address once it exists
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView();
})();
