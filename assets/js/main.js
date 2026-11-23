'use strict';
// Page behaviour: header, the helper dialog (tooth → symptom → which doctor), services panel,
// doctors carousel, booking form. Content comes from data.js.
(function () {
  const D = window.SITE_DATA;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- sections coming into view ---------- */
  // .reveal blocks are hidden before the first paint (the head script sets html.reveal-on); each comes up the first
  // time it scrolls into view. Ones already on screen at load (a reload mid-page) only fade in, without the shift.
  // First in the file, so an error further down can't leave the sections hidden
  if (document.documentElement.classList.contains('reveal-on')) {
    let atLoad = true;
    const seen = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        if (atLoad) e.target.classList.add('is-now');
        e.target.classList.add('is-in');
        seen.unobserve(e.target);
      });
      atLoad = false;
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach((el) => seen.observe(el));
  }

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
  // «от 90 руб.» from the price list (data.js prices; nothing for a service without a price). Off for now (user,
  // 2026-11-23: «пока уберем цифры с ценами»): PRICES = true shows them in the rows, the hits and the popular pills
  const PRICES = false;
  const priceHTML = (n, cls) => (PRICES && D.prices[n] ? `<span class="${cls}">от&nbsp;${D.prices[n]}&nbsp;руб.</span>` : '');
  const doctorsWord = (n) => plural(n, 'врач', 'врача', 'врачей');
  const initials = (name) => name.split(' ').slice(0, 2).map((w) => w[0]).join('');
  const person = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.8-4.2 3.8-6.5 7.5-6.5s6.7 2.3 7.5 6.5"/></svg>`;
  const icon = (id, size, stroke) => `<svg class="ic" width="${size}" height="${size}" stroke-width="${stroke}" aria-hidden="true"><use href="#${id}"/></svg>`;

  /* ---------- constants ---------- */
  const WISDOM = [1, 16, 17, 32];
  // section → the menu link lit while it is under the header; blocks without a link of their own light the nearest
  const SPY = [['top', 'top'], ['calm', 'calm'], ['finder', 'calm'], ['services', 'services'], ['doctors', 'doctors'], ['clinics', 'clinics'], ['faq', 'clinics'], ['book', 'clinics']];
  const SVC_LIMIT = 6;
  const DOCS_PER_PAGE = 4;
  const DOC_LIMIT = 3;
  const STEPS = ['Услуги', 'Врач'];
  const CONSULT = 'Консультация специалистов';
  const CONSULT_SUBS = [['Терапевт', 'Консультация терапевта'], ['Ортопед', 'Консультация ортопеда'], ['Хирург', 'Консультация хирурга'], ['Ортодонт', 'Консультация ортодонта']];
  const CONSULT_ROLE = { 'Консультация терапевта': 'ther', 'Консультация ортопеда': 'orth', 'Консультация хирурга': 'surg', 'Консультация ортодонта': 'ortd' };
  const isConsult = (n) => !!CONSULT_ROLE[n];
  const ROLE_NAME = { ther: 'терапевт', orth: 'ортопед', surg: 'хирург', ortd: 'ортодонт' };
  const BOOKABLE = ['ther', 'orth', 'surg', 'ortd'];

  /* ---------- state ---------- */
  const state = {
    hStep: 1, tooth: null, scope: null, skipTooth: false, symptom: null, hDoc: null,
    cat: null, svcOpen: null, svcMore: null, addFor: null, svcsAll: [], svcAll: false, docsAll: false, barOpen: false,
    // cart: ticked services {n, cat (name), cid}; picks: the doctor chosen per section;
    // extra: doctors booked without services {id, cid} (cid: the section's step 2 it came from, else null)
    // notes: what the helper was told {id (doctor), text}, shown in that doctor's group
    svcStep: 1, picks: {}, extra: [], notes: [], cart: [], bkOpen: false,
    docPage: 0, docOpen: null,
    sent: false
  };
  function set(patch) {
    Object.assign(state, patch);
    if (bookEmpty()) state.bkOpen = false;
    // diagnostics' doctor follows the ticked consultations: once theirs is gone (a ✕, «Сбросить всё») so is the doctor
    const dp = state.picks.diag && docById(state.picks.diag);
    if (dp) {
      const roles = catRoles(catById('diag'), state.cart);
      if (!roles.includes(dp.role)) {
        const pick = autoDoc(roles);
        state.picks = { ...state.picks, diag: pick };
        // a doctor booked alone from diagnostics' step 2 (goStep) goes with it
        state.extra = state.extra.filter((x) => x.cid !== 'diag' || x.id === pick);
      }
    }
    render();
  }

  // a service is one per booking, whichever section it was ticked in («Консультация терапевта» is both in
  // treatment and, as a consultation, in diagnostics)
  const inCart = (n) => state.cart.some((x) => x.n === n);
  // a row's box is ticked: for «Консультация специалистов», when any of its specialists is chosen
  const isTicked = (n) => (n === CONSULT ? CONSULT_SUBS.some(([, cn]) => inCart(cn)) : inCart(n));
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
  // a ticked service goes to its section's doctor; diagnostics without a consultation to nobody, and each
  // consultation to a doctor of its speciality (the section's chosen one if they are)
  function itemDoc(x) {
    // a service added from a doctor's own list in the booking stays with that doctor
    if (x.doc && docById(x.doc)) return x.doc;
    if (x.cid === 'diag') {
      if (!isConsult(x.n)) return null;
      const role = CONSULT_ROLE[x.n];
      const p = docById(state.picks.diag);
      return p && p.role === role ? p.id : autoDoc([role]);
    }
    return state.picks[x.cid] || autoDoc(catRoles(catById(x.cid), state.cart));
  }
  // the booking by doctor: each doctor with their services, doctors without services too, in the team's order (the
  // order of the doctor tiles), so a card never jumps when a service is added; diagnostics last
  function visits() {
    const map = new Map();
    const at = (id) => { if (!map.has(id)) map.set(id, []); return map.get(id); };
    state.cart.forEach((x) => at(itemDoc(x) || '').push(x));
    state.extra.forEach((e) => at(e.id));
    const rank = (id) => (id ? D.doctors.findIndex((d) => d.id === id) : D.doctors.length);
    return Array.from(map, ([id, items]) => ({ id, doc: id ? docById(id) : null, items })).sort((a, b) => rank(a.id) - rank(b.id));
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
  const visitsKey = () => visits().map((v) => v.id + ':' + v.items.map((x) => x.cid + '/' + x.n).join(',') + ':' + notesOf(v.id).map((x) => x.text).join(',')).join('|') + '#' + (state.addFor || '') + '#' + state.svcsAll.join();

  // the same list in step 3 of Services and the corner button; the booking form puts the same cards in the doctors' slots
  // o.full: every service in full, names wrapping (Services' step 3, the corner list); o.summary: no «Услуги врача»
  // (the corner list only sums the booking up); the booking form's cards pass neither (two services, «+N», «…»)
  function visitsHTML(o) { return `<ul class="visits">${visits().map((v) => visitHTML(v, o)).join('')}</ul>`; }
  // one doctor's group (or diagnostics', id ''), and right after it that doctor's services list when open
  function visitHTML(v, o = {}) {
    const d = v.doc;
    const who = d ? `<span class="av">${docAvatar(d, 20)}</span><span class="visit__who"><span class="visit__name">${esc(glue(docTitle(d)))}</span>${d.name ? `<span class="visit__spec">${esc(d.spec)}</span>` : ''}</span>`
      : `<span class="av">${icon('i-grid', 18, 2)}</span><span class="visit__who"><span class="visit__name">Диагностика</span><span class="visit__spec">без записи к&nbsp;врачу</span></span>`;
    const notes = notesOf(v.id).map((x) => `<p class="visit__note"><span class="visit__note-t"><b>Повод:</b> ${esc(glue(x.text))}</span><button type="button" class="visit__x" data-act="note-remove" data-id="${v.id}" data-text="${esc(x.text)}" aria-label="Убрать повод: ${esc(x.text)}">${icon('i-close', 12, 2.8)}</button></p>`).join('');
    // two services show; the rest behind a round «+N» with a down arrow at the end of the row (an up arrow folds them
    // again); one line each, a long name cut with «…», whole in its tooltip
    const all = state.svcsAll.includes(v.id);
    const shown = all || o.full ? v.items : v.items.slice(0, SVCS_SHOWN);
    const rest = v.items.length - SVCS_SHOWN;
    const fold = rest > 0 && !o.full ? `<li class="visit__fold"><button type="button" class="visit__all" data-act="visit-all" data-id="${v.id}" data-focus="vall:${v.id}" aria-expanded="${all}" aria-label="${all ? 'Свернуть услуги' : 'Показать ещё ' + rest}">${all ? '' : `<span class="visit__all-n">+${rest}</span>`}${icon(all ? 'i-chev-up' : 'i-chev', 12, 2.8)}</button></li>` : '';
    const svcs = v.items.length
      ? `<ul class="visit__svcs">${shown.map((x) => `<li class="visit__svc${o.full ? ' is-full"' : `" data-tip="${esc(x.n)}"`}><span class="visit__svc-n">${esc(x.n)}</span><button type="button" class="visit__x" data-act="cart-remove" data-svc="${esc(x.n)}" data-cid="${x.cid}" aria-label="Убрать: ${esc(x.n)}">${icon('i-close', 12, 2.8)}</button></li>`).join('')}${fold}</ul>`
      : notes ? '' : `<p class="visit__none">${glue('Услуги подберёт врач на приёме')}</p>`;
    const open = !o.summary && state.addFor === v.id;
    // the list it opens closes with its own ✕ (pickerHTML); the button stays dark while it is open
    const more = d && !o.summary && BOOKABLE.includes(d.role) ? `<button type="button" class="visit__more" data-act="visit-add" data-id="${v.id}" data-focus="va:${v.id}" aria-expanded="${open}">${PLUS}Услуги врача</button>` : '';
    // the open doctor's services come right after the card (in a one-column list that is under it; the booking
    // form's grid moves them under all the cards, style.css), with a caret pointing at the card (placeCarets)
    // the corner summary drops the doctor's ✕ when they have just one service: it would repeat that service's ✕
    const drop = !(o.summary && v.items.length === 1 && !notesOf(v.id).length);
    return `<li class="visit${open ? ' is-picking' : ''}" data-id="${v.id}"><div class="visit__head">${who}${drop ? `<button type="button" class="visit__drop" data-act="visit-remove" data-id="${v.id}" data-focus="slot:${v.id}" aria-label="Убрать из записи: ${esc(d ? docTitle(d) : 'диагностика')}">${icon('i-close', 16, 2.4)}</button>` : ''}</div>${notes}${svcs}${more}</li>${
      open && d ? `<li class="vpick-li">${pickerHTML(d)}</li>` : ''}`;
  }
  const SVCS_SHOWN = 2;
  // true for the render right after a doctor's services list was opened (render() clears it)
  let pickerFresh = false;
  // the caret on top of an open doctor's services points at that doctor's «Услуги врача» button (on a wide card its
  // middle was far from it)
  function placeCarets() {
    $$('.vpick').forEach((p) => {
      const card = p.closest('.visits').querySelector(`li.visit[data-id="${state.addFor}"]`);
      const r = p.getBoundingClientRect();
      if (!card || !r.width) return;
      const c = ($('.visit__more', card) || card).getBoundingClientRect();
      p.style.setProperty('--caret-x', Math.max(28, Math.min(r.width - 28, c.left + c.width / 2 - r.left)) + 'px');
    });
  }
  // the services a doctor does: the sections of their speciality, plus their own consultation (diagnostics lists only
  // «Консультация специалистов», so there each speciality's consultation is offered by its name)
  function docServices(d) {
    const groups = D.cats.filter((c) => c.roles.includes(d.role)).map((c) => ({ cat: c, items: c.items.filter((n) => n !== CONSULT) }));
    const cn = Object.keys(CONSULT_ROLE).find((n) => CONSULT_ROLE[n] === d.role);
    if (cn && !groups.some((g) => g.items.includes(cn))) groups.unshift({ cat: catById('diag'), items: [cn] });
    return groups;
  }
  // «Услуги врача» on a doctor's card opens that doctor's services under the list: a chip adds one to the booking
  // with that doctor (`doc` on the cart item), or takes it out if it is booked already
  function pickerHTML(d) {
    // it fades in when it opens, not again each time a chip is pressed (the list is rebuilt then)
    return `<div class="vpick${pickerFresh ? ' is-in' : ''}" role="group" aria-label="Услуги врача: ${esc(docTitle(d))}"><div class="vpick__head"><span class="vpick__t">Услуги врача · ${esc(glue(docTitle(d)))}</span><span class="vpick__hint">${glue('нажмите, чтобы добавить или убрать')}</span></div><button type="button" class="vpick__x" data-act="visit-add" data-id="${d.id}" data-focus="va:${d.id}" aria-label="Закрыть услуги врача">${icon('i-close', 16, 2.4)}</button>${
      docServices(d).map((g) => `<div class="vpick__grp"><span class="caps">${esc(g.cat.name)}</span><div class="vpick__chips">${
        g.items.map((n) => `<button type="button" class="chip vpick__chip" aria-pressed="${inCart(n)}" data-act="visit-svc" data-id="${d.id}" data-svc="${esc(n)}" data-cid="${g.cat.id}" data-focus="vs:${esc(n)}" data-tip="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>`).join('')}</div>`;
  }
  const PLUS = icon('i-plus', 16, 2.4);

  // Rebuilds el only when its structure key changes; keeps keyboard focus on the same [data-focus] item.
  function mount(el, key, build) {
    if (el.dataset.key === key) return false;
    const a = document.activeElement;
    const f = a && el.contains(a) ? a.dataset.focus : null;
    // a booking group that is still the same keeps its node: rebuilt, its photo reloaded and flashed; a new one fades in
    const oldIds = new Set($$('li.visit', el).map((li) => li.dataset.id));
    const pool = new Map($$('li.visit', el).map((li) => { li.classList.remove('is-new'); return [li.outerHTML, li]; }));
    const tmp = document.createElement('div');
    tmp.innerHTML = build();
    $$('li.visit', tmp).forEach((li) => {
      const old = pool.get(li.outerHTML);
      if (old) { pool.delete(li.outerHTML); li.replaceWith(old); } else if (el.dataset.key !== undefined && !oldIds.has(li.dataset.id)) li.classList.add('is-new');
    });
    el.replaceChildren(...tmp.childNodes);
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
    const box = document.getElementById(id);
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // the pressed button is gone: the focus goes to the confirmation, so a screen reader reads it
    $('[tabindex="-1"]', box).focus({ preventScroll: true });
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
  // phones: the molars (6–8 in a quadrant) are ~22–30 px on the map, so a tap on one zooms into that side first
  // (style.css .is-zoom-r / .is-zoom-l); zoomed, every tap picks a tooth
  const jawZoomed = () => jaw.classList.contains('is-zoom-r') || jaw.classList.contains('is-zoom-l');
  function jawZoom(side) {
    jaw.classList.toggle('is-zoom-r', side === 'r');
    jaw.classList.toggle('is-zoom-l', side === 'l');
    $('.jaw__out').hidden = !side;
  }
  helper.addEventListener('close', () => jawZoom(null));

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
        + `<span class="tooth__n" style="left:${cx}%;top:${cy}%"><span>${qn(n)}</span></span>`;
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

  // desktop: the steps on the left line up with the step on the right — the first circle with the top of its box,
  // the last step with the bottom of the body above the buttons. Measured on opening (step 1) and on resize, not
  // per step: the head on the right changes height between steps, and the steps must not move (style.css .hsteps)
  function alignSteps() {
    const d = helper.getBoundingClientRect();
    const body = $('#helper-body');
    // a short laptop: the right box starts high, so the first step keeps at least 28 px under the title
    const top = Math.max(body.getBoundingClientRect().top + parseFloat(getComputedStyle(body).paddingTop),
      $('.helper__titles').getBoundingClientRect().bottom + 28) - d.top;
    helper.style.setProperty('--steps-top', top + 'px');
    helper.style.setProperty('--steps-bottom', d.bottom - $('.helper__nav').getBoundingClientRect().top + 'px');
  }
  // «Далее» / «Записаться» pressed before the step is answered: what it needs lights up for a moment (the tooth map
  // and its hint, the symptoms, the doctors) and comes into view (user, 2026-11-23: a pale button did nothing)
  function helperNudge() {
    const s = state.hStep;
    const el = s === 1 ? $('#jaw') : s === 2 ? $('#sym-wrap') : $('.hint__docs', helper);
    if (!el) return;
    el.classList.remove('is-nudge');
    void el.offsetWidth; // restarts the CSS animation
    el.classList.add('is-nudge');
    clearTimeout(el.nudgeT);
    el.nudgeT = setTimeout(() => el.classList.remove('is-nudge'), 1000);
    el.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
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
    // not disabled: a press while it can't go on shows what is missing (helperNudge)
    next.setAttribute('aria-disabled', !canStep(step + 1));
    next.firstChild.textContent = step === 1 ? 'Далее' : 'Показать врача';
    $('.helper__back', helper).hidden = step === 1;
    const book = $('.helper__book', helper);
    book.hidden = step !== 3;
    book.setAttribute('aria-disabled', !chosen);
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
  // tablets: the tabs scroll sideways with no scrollbar; the chosen one is scrolled into view, and an edge with more
  // tabs behind it fades (phones list them in a drop-down instead)
  let tabsCat = null;
  function tabsFade() {
    const el = $('#svc-tabs');
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle('fade-l', !swipeMedia.matches && el.scrollLeft > 1);
    el.classList.toggle('fade-r', !swipeMedia.matches && el.scrollLeft < max - 1);
  }
  function showTab() {
    const el = $('#svc-tabs');
    const tab = el && $('[aria-pressed="true"]', el);
    if (tab && !swipeMedia.matches) {
      const t = tab.getBoundingClientRect(), b = el.getBoundingClientRect();
      if (t.left < b.left + 40 || t.right > b.right - 40) el.scrollBy({ left: t.left + t.width / 2 - (b.left + b.width / 2) });
    }
    tabsFade();
  }
  function renderServices() {
    const cat = catById(state.cat);
    $('#svc-grid').hidden = !!cat;
    svcOpenBox.hidden = !cat;
    // the tab bar stays above the grid too, with «Все разделы» chosen; on phones the grid is a list of rows already,
    // so there the bar comes only with an open section
    const barBox = $('#svc-bar-box');
    if (!cat && swipeMedia.matches) { mount(barBox, '', () => ''); tabsCat = null; }
    else {
      if (mount(barBox, 'bar', barHTML)) $('#svc-tabs').addEventListener('scroll', tabsFade, { passive: true });
      $$('.svc-bar__tab', barBox).forEach((b) => b.setAttribute('aria-pressed', !!cat && b.dataset.cat === cat.id));
      $('.svc-bar__all', barBox).setAttribute('aria-pressed', !cat);
      if (tabsCat !== state.cat) { tabsCat = state.cat; requestAnimationFrame(showTab); }
      $('.svc-bar', barBox).classList.toggle('is-open', state.barOpen);
      $('.svc-bar__toggle', barBox).setAttribute('aria-expanded', state.barOpen);
      $('.svc-bar__cur', barBox).textContent = cat ? cat.tab : '';
    }
    if (!cat) { mount(svcOpenBox, '', () => ''); return; }
    mount(svcOpenBox, 'open', panelShellHTML);
    mount($('#svc-head'), cat.id, () => panelHeadHTML(cat));

    // services list
    const hiddenActive = cat.items.some((n, k) => k >= SVC_LIMIT && state.svcOpen === n);
    const expanded = state.svcAll || hiddenActive;
    const list = $('#svc-list');
    // two columns of their own (odd and even rows): an opened row grows only its column; one column, the rows go back
    // to their order (style.css)
    mount(list, cat.id + expanded, () => {
      const rows = cat.items.filter((n, k) => expanded || k < SVC_LIMIT).map(svcRowHTML);
      return `<div class="svc-col">${rows.filter((r, k) => k % 2 === 0).join('')}</div><div class="svc-col">${rows.filter((r, k) => k % 2 === 1).join('')}</div>`;
    });
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

    // which step is shown, and the buttons under it
    const step = state.svcStep;
    $$('.svc-step', svcOpenBox).forEach((el) => { el.hidden = +el.dataset.step !== step; });
    $$('.wiz__btn', svcOpenBox).forEach((b) => {
      const k = +b.dataset.step;
      if (k === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.parentElement.classList.toggle('is-done', k < step);
    });
    // every service chosen, in all sections: counted for this section only, a second one from another section went
    // unseen (user, 2026-11-23: «почему одна, если я выбрала две?»)
    const n = state.cart.length;
    $('#svc-nav-info').textContent = glue(step === 1 ? (n ? 'Выбрано ' + n + ' ' + servicesWord(n) : 'Можно не выбирать — поможем по телефону')
      : noDoc ? 'Без записи к врачу' : 'Врач: ' + (pick ? docTitle(docById(pick)) : 'подберём при записи'));
    $('.svc-nav__back', svcOpenBox).hidden = step === 1;
    // a service ticked: «Выбрать ещё услугу» beside «К записи» opens the sections' menu (user, 2026-11-23)
    $('.svc-nav__more', svcOpenBox).hidden = step !== 1 || !state.cart.length;
    // one doctor (or none) in the section: no doctor step, step 1 goes straight on to the booking form
    $('.svc-nav__next', svcOpenBox).firstChild.textContent = step === 1 && docStep() ? 'Выбрать врача' : 'К записи';
  }

  function barHTML() {
    // phones: the tabs hide behind one button that drops them down (style.css)
    return `<div class="svc-bar"><button type="button" class="svc-bar__toggle" data-act="bar-toggle" aria-expanded="false" aria-controls="svc-tabs">${icon('i-grid', 16, 2.4)}<span class="svc-bar__lbl">Разделы</span><span class="svc-bar__cur"></span>${icon('i-chev', 16, 2.4)}</button><div class="tabs-scroll svc-bar__tabs" id="svc-tabs">
        <button type="button" class="chip svc-bar__all" data-act="cat-close">${icon('i-grid', 15, 2.4)}<span class="svc-bar__t">Все разделы</span></button>
        <span class="svc-bar__sep" aria-hidden="true"></span>
        ${D.cats.map((c) => `<button type="button" class="chip svc-bar__tab" aria-pressed="false" data-act="cat-tab" data-cat="${c.id}"><span class="svc-bar__ph" aria-hidden="true"><img src="assets/img/services/${c.id}-800.webp" alt="" loading="lazy"></span><span class="svc-bar__t">${esc(c.tab)}</span></button>`).join('')}
      </div></div>`;
  }
  function panelShellHTML() {
    return `
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
            ${$('#svc-grid .svc-unsure').outerHTML}
          </div>
          <div class="svc-step" id="pick-doctor" data-step="2">
            <div class="panel-label"><h4 class="panel-h" tabindex="-1">Выберите врача</h4><span class="doc-pick__who" id="doc-pick-who"></span></div>
            <div class="doc-pick__grid" id="doc-pick-grid"></div>
            <button type="button" class="btn btn--ghost more-wide" id="docs-all" data-act="docs-all" aria-expanded="false"><span></span>${icon('i-chev', 16, 2.4)}</button>
          </div>
          <div class="svc-nav">
            <button type="button" class="btn btn--ghost svc-nav__back" data-act="svc-prev">${icon('i-back', 16, 2.4)}Назад</button>
            <span class="svc-nav__info" id="svc-nav-info"></span>
            <button type="button" class="svc-nav__reset" data-act="cart-reset" hidden>${icon('i-reset', 15, 2.2)}Сбросить всё</button>
            <button type="button" class="btn btn--ghost svc-nav__more" data-act="add-svc" hidden>${PLUS}<span class="svc-nav__more-l">Выбрать ещё услугу</span><span class="svc-nav__more-s">Ещё услуга</span></button>
            <button type="button" class="btn btn--dark svc-nav__next" data-act="svc-next"><span></span>${icon('i-arrow', 16, 2.4)}</button>
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
        <h3 class="svc-panel__name" tabindex="-1">${esc(glue(cat.name))}</h3>
        <p class="svc-panel__desc">${esc(glue(cat.desc))}</p>
      </div>
      <span class="svc-panel__meta">${meta}</span>`;
  }

  function svcRowHTML(n, k) {
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
    return `<div class="svc-row" data-svc="${esc(n)}" style="order: ${k}">
      <div class="svc-row__bar">
        <button type="button" class="svc-row__check" data-act="svc-check" aria-pressed="false" data-focus="chk:${esc(n)}"><span class="box box--lg">${icon('i-check', 14, 3.2)}</span></button>
        <button type="button" class="svc-row__toggle" data-act="svc-toggle" aria-expanded="false" data-focus="tgl:${esc(n)}"><span class="svc-row__txt"><span class="svc-row__label"></span>${priceHTML(n, 'svc-row__price')}</span><span class="svc-row__chev">${icon('i-chev-row', 16, 2.4)}</span></button>
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
    $('.svc-row__label', row).textContent = glue(n);
    row.lastElementChild.classList.toggle('is-open', open);
    $$('.svc-subs__chip', row).forEach((b) => b.setAttribute('aria-pressed', inCart(b.dataset.sub)));
    const moreBtn = $('.more-btn', row);
    if (moreBtn) {
      moreBtn.setAttribute('aria-expanded', moreOpen);
      moreBtn.firstChild.textContent = moreOpen ? 'Свернуть' : 'Подробнее об услуге';
      $('.drawer--more', row).classList.toggle('is-open', moreOpen);
    }
  }

  /* ---------- services search and the popular ones ---------- */
  // empty: a row of popular services with their prices; typed: the services whose name, section, description or
  // search words (data.js serviceKeys) hold every word typed (ё = е). A tap opens the section with that service
  // unfolded (svc-go). User, 2026-11-23: people don't know which section a service is in
  const POPULAR = [['Профессиональная гигиена', 'Чистка зубов'], ['Лечение кариеса', 'Лечение кариеса'], ['Имплантация', 'Имплантация'], ['Консультация терапевта', 'Консультация'],
    ['Отбеливание зубов', 'Отбеливание'], ['Простое и сложное удаление', 'Удаление зуба'], ['Брекеты', 'Брекеты'], ['Виниры', 'Виниры']];
  // words match from their start («чистка» isn't found in «очистка»); a hit in the name, then in the search words,
  // ranks before one in the section or the description
  const norm = (s) => ' ' + s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ');
  const catOf = (n) => D.cats.find((c) => c.items.includes(n));
  const SVC_INDEX = D.cats.flatMap((c) => c.items.map((n) => ({ n, c, name: norm(n), keys: norm(D.serviceKeys[n] || ''), hay: norm([n, c.name, D.serviceText[n] || '', D.serviceKeys[n] || ''].join(' ')) })));
  const findBox = $('#svc-found');
  function renderFind() {
    const q = norm($('#svc-q').value).trim();
    if (q.length < 2) {
      findBox.innerHTML = `<div class="svc-pop"><span class="svc-pop__h">Популярное</span>${POPULAR.map(([n, label]) => `<button type="button" class="chip svc-pop__chip" data-act="svc-go" data-svc="${esc(n)}">${esc(label)}${priceHTML(n, 'svc-pop__p')}</button>`).join('')}</div>`;
      return;
    }
    const words = q.split(' ').map((w) => ' ' + w);
    const rank = (x) => (words.every((w) => x.name.includes(w)) ? 0 : words.every((w) => x.keys.includes(w)) ? 1 : 2);
    const hits = SVC_INDEX.filter((x) => words.every((w) => x.hay.includes(w))).sort((a, b) => rank(a) - rank(b)).slice(0, 8);
    findBox.innerHTML = hits.length
      ? `<div class="svc-hits">${hits.map((x, i) => `<button type="button" class="svc-hit" id="svc-hit-${i}" data-act="svc-go" data-svc="${esc(x.n)}"><span class="svc-hit__t"><span class="svc-hit__n">${esc(glue(x.n))}</span><span class="svc-hit__c">${esc(glue(x.c.name))}</span></span>${priceHTML(x.n, 'svc-hit__p')}</button>`).join('')}</div>`
      : `<p class="svc-find__none">${glue('Ничего не нашлось. Попробуйте другое слово или позвоните — подскажем.')}</p>`;
  }
  // the keyboard (user, 2026-11-23): ↓/↑ walk the hits (round), Enter picks the marked one or the first, Esc clears
  let findIdx = -1;
  const findQ = $('#svc-q');
  function markFind() {
    const hits = $$('.svc-hit', findBox);
    hits.forEach((b, i) => b.classList.toggle('is-active', i === findIdx));
    if (hits[findIdx]) { findQ.setAttribute('aria-activedescendant', hits[findIdx].id); hits[findIdx].scrollIntoView({ block: 'nearest' }); }
    else findQ.removeAttribute('aria-activedescendant');
  }
  findQ.addEventListener('input', () => { findIdx = -1; renderFind(); markFind(); });
  findQ.addEventListener('keydown', (e) => {
    const hits = $$('.svc-hit', findBox);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!hits.length) return;
      e.preventDefault();
      const down = e.key === 'ArrowDown';
      findIdx = findIdx < 0 ? (down ? 0 : hits.length - 1) : (findIdx + (down ? 1 : -1) + hits.length) % hits.length;
      markFind();
    } else if (e.key === 'Enter') {
      if (!hits.length) return;
      e.preventDefault();
      hits[Math.max(0, findIdx)].click();
    } else if (e.key === 'Escape' && findQ.value) {
      findQ.value = '';
      findIdx = -1;
      renderFind();
      markFind();
    }
  });
  renderFind();

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
        <div class="doc-panel__actions">${BOOKABLE.includes(d.role) ? `<a href="#book" class="btn btn--dark doc-panel__btn" data-act="book-doc" data-id="${d.id}">Записаться к&nbsp;врачу</a>` : ''}<button type="button" class="btn btn--ghost doc-panel__btn doc-panel__fold" data-act="doc-more" data-id="${d.id}">Свернуть</button></div>
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
    const rebuilt = mount(track, swipe ? 'all' : String(page), () => shown.map((d) => `<article class="doc" data-id="${d.id}"${hasBio(d) ? ' data-act="doc-card"' : ''}>
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
    // on a phone the panel is as tall as the shown story (style.css): switching stories with it open glides the height
    const was = swipe && open && panel.classList.contains('is-open') ? panelIn.offsetHeight : 0;
    if (open) $$('.doc-panel__card', panelIn).forEach((c) => c.classList.toggle('is-cur', c.dataset.id === open.id));
    const now = was ? panelIn.offsetHeight : 0;
    if (was && Math.abs(now - was) > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      panelIn.animate([{ height: was + 'px' }, { height: now + 'px' }], { duration: 400, easing: 'cubic-bezier(.45, 0, .2, 1)' });
    }
    panel.classList.toggle('is-open', !!open);
    panel.setAttribute('aria-hidden', !open);
    // folded, its buttons are out of the Tab order too
    panel.inert = !open;
    if (open) docCaret();
    const multi = pages > 1;
    $$('.side-arrow').forEach((b) => { b.hidden = !multi; });
    // pages on desktop; on a phone one dot per doctor of the swipeable row
    const n = swipe ? swipeStops(track) : pages;
    $('#doc-dots-row').hidden = n < 2;
    const dots = $('#doc-dots');
    mount(dots, (swipe ? 'swipe' : 'pages') + n, () => Array.from({ length: n }, (_, k) => `<button type="button" class="dot" aria-pressed="false" aria-label="${swipe ? 'Врач' : 'Страница'} ${k + 1} из ${n}" data-act="doc-page" data-page="${k}"></button>`).join(''));
    syncDots(swipe ? swipeIndex() : page);
  }
  // the card nearest the row's left edge on a phone (the doctors)
  function swipeIndex(track = $('#doc-track')) {
    const first = track.firstElementChild;
    if (!first) return 0;
    const stops = swipeStops(track);
    const step = first.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
    // the last cards can't reach the left edge: scrolled to the end is the last stop
    if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) return stops - 1;
    return Math.max(0, Math.min(stops - 1, Math.round(track.scrollLeft / step)));
  }
  // scroll positions of a swipeable row: with two cards on screen, one fewer than the cards
  function swipeStops(track) {
    const first = track.firstElementChild;
    if (!first) return 1;
    const cs = getComputedStyle(track);
    const gap = parseFloat(cs.columnGap) || 0;
    const room = track.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const perView = Math.max(1, Math.floor((room + gap + 1) / (first.getBoundingClientRect().width + gap)));
    return Math.max(1, track.children.length - perView + 1);
  }
  function syncDots(cur) { $$('#doc-dots .dot').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.page === cur)); }
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

  function renderBooking() {
    // one row, a slot per doctor in the team's order: a tile to choose them, which becomes their card (services,
    // «Услуги врача», ✕) in the same place once chosen, so a chosen doctor isn't shown twice; diagnostics without a
    // doctor follows as a card of its own
    const svcsBox = $('#book-svcs');
    const h0 = svcsBox.getBoundingClientRect().height;
    const pk0 = $('.vpick', svcsBox);
    const pickTop = pk0 ? pk0.getBoundingClientRect().top : null;
    const vs = visits();
    const slots = D.doctors.filter((d) => BOOKABLE.includes(d.role)).map((d) => {
      const v = vs.find((x) => x.id === d.id);
      return v ? visitHTML(v) : `<li class="visit-slot"><button type="button" class="book-doc" data-act="book-pick" data-id="${d.id}" data-focus="slot:${d.id}"><span class="av">${docAvatar(d, 20)}</span><span class="book-doc__text"><span class="book-doc__name">${esc(glue(docTitle(d)))}</span><span class="book-doc__sub">${esc(d.spec)}</span></span><span class="book-doc__add">${PLUS}Выбрать</span></button></li>`;
    }).join('') + vs.filter((v) => !v.doc || !BOOKABLE.includes(v.doc.role)).map(visitHTML).join('');
    // phones: the doctors as one row of round photos (speciality, surname) above the chosen ones' cards; the tiles
    // in the slots are hidden there (style.css). A tap chooses a doctor or takes them out again. Built once and
    // only re-marked: rebuilt with the list, its photos blinked out on an iPhone at every tap
    let picksBox = $('.book-pick', svcsBox);
    if (!picksBox) {
      svcsBox.innerHTML = `<div class="book-pick" role="group" aria-label="Врачи">${D.doctors.filter((d) => BOOKABLE.includes(d.role)).map((d) => {
        const short = d.name ? d.name.split(' ').slice(1).join(' ') || d.name : '';
        return `<button type="button" class="book-pick__doc" data-act="book-pick" data-id="${d.id}" aria-pressed="false" aria-label="${esc(docTitle(d))}, ${esc(d.spec)}"><span class="book-pick__ph"><span class="av">${docAvatar(d, 20)}</span><span class="book-pick__tick">${icon('i-check', 12, 3)}</span></span><span class="book-pick__spec">${esc(d.spec)}</span>${short ? `<span class="book-pick__name">${esc(glue(short))}</span>` : ''}</button>`;
      }).join('')}</div><div class="book__slots-box"></div>`;
      picksBox = $('.book-pick', svcsBox);
    }
    $$('.book-pick__doc', picksBox).forEach((b) => b.setAttribute('aria-pressed', vs.some((x) => x.id === b.dataset.id)));
    const rebuilt = mount($('.book__slots-box', svcsBox), visitsKey() + '#slots', () => `<ul class="visits book__slots">${slots}</ul>${bookEmpty()
      ? `<p class="book__empty">${glue('Можно не выбирать — администратор поможет подобрать по телефону.')}</p><button type="button" class="add-svc" data-act="add-svc">${PLUS}Добавить услугу</button>`
      : `<div class="book__list-acts"><button type="button" class="add-svc" data-act="add-svc">${PLUS}Добавить ещё услугу</button><button type="button" class="book__reset book__reset--list" data-act="cart-reset">${icon('i-reset', 16, 2.2)}Сбросить всё</button></div>`}`);
    // a doctor coming or going, a services list opening or closing: the form glides, clipped at its growing edge.
    // A service ticked in an open list grows its doctor's card: then the list under the cards slides down with the
    // glide instead of jumping (clipped, it was cut off for a moment)
    const shape = vs.map((v) => v.id).join() + '#' + (state.addFor || '');
    const dy = rebuilt && pickTop !== null && shape === svcsBox.dataset.shape ? pickShift(svcsBox, pickTop) : 0;
    if (dy) slideAfter($('.vpick', svcsBox), svcsBox, h0, dy);
    else if (rebuilt) growTo(svcsBox, h0);
    svcsBox.dataset.shape = shape;
    $$('[data-act="cart-reset"]').forEach((b) => { b.hidden = bookEmpty(); });
    // the form and the confirmation share one grid cell, so the card keeps its size (see style.css)
    $('.book__card').classList.toggle('is-sent', state.sent);
  }

  // how far an open doctor's services list (.vpick) in box moved in a rebuild (0 when none, or under a pixel)
  function pickShift(box, top0) {
    const pk = $('.vpick', box);
    const dy = pk ? pk.getBoundingClientRect().top - top0 : 0;
    return Math.abs(dy) > 1 && !reduceMotion.matches ? dy : 0;
  }
  // A service ticked in an open list grew its doctor's card by dy: the list and everything after it (the cards
  // below it in a one-column list, «Добавить ещё услугу», the rows after the list up to wrap) slide down from where
  // they were while wrap's height glides, unclipped. In the booking form's grid the list is placed after all the cards
  // (`order`), so the cards after it in the markup stand beside the grown card and stay.
  function slideAfter(pk, wrap, h0, dy) {
    if (offScreen(wrap)) return;
    const li = pk.closest('li') || pk;
    const moving = [];
    const gridLast = getComputedStyle(li).order !== '0';
    for (let s = li; s; s = s.nextElementSibling) { moving.push(s); if (gridLast) break; }
    for (let p = li.parentElement; p && p !== wrap; p = p.parentElement) {
      for (let s = p.nextElementSibling; s; s = s.nextElementSibling) moving.push(s);
    }
    growTo(wrap, h0, true);
    moving.filter((el) => getComputedStyle(el).display !== 'contents' && el.getClientRects().length)
      .forEach((el) => el.animate({ transform: [`translateY(${-dy}px)`, 'none'] }, { duration: 420, easing: 'cubic-bezier(.22, .7, .2, 1)' }));
  }
  // a list rebuilt at a new height glides from the old one, so the form grows or shrinks smoothly below it
  // (h0 is the height before the rebuild; a glide under way starts the next one from where it is)
  // slide: the content under the growing part moves along (the services list, translated by the caller), so nothing
  // sticks out and no clipping is needed
  function growTo(el, h0, slide) {
    if (el.glide) { el.glide.cancel(); el.style.clipPath = el.style.boxSizing = ''; }
    const h1 = el.getBoundingClientRect().height;
    if (!h0 || Math.abs(h1 - h0) < 1 || reduceMotion.matches || !el.offsetParent || offScreen(el)) return;
    // clipped only at the bottom (the growing edge): overflow: hidden also cut the cards' outlines and focus rings at
    // the sides; 24 px of room there: an open doctor's card reaches 16 px out, plus its 2 px outline
    if (!slide) el.style.clipPath = 'inset(-24px -24px 0 -24px)';
    el.style.boxSizing = 'border-box';
    // border-box: the heights are measured with the padding, and the keyframes must mean the same (with content-box
    // the 4 px top padding came on top: the rows below jumped 4 px down at the start and 4 px back up at the end)
    el.glide = el.animate({ height: [h0 + 'px', h1 + 'px'] }, { duration: 420, easing: 'cubic-bezier(.22, .7, .2, 1)' });
    el.glide.finished.then(() => { el.style.clipPath = el.style.boxSizing = ''; el.glide = null; }, () => {});
  }
  // an element off the screen changes height at once: animated, the browser's scroll anchoring corrected the scroll
  // every frame in whole pixels against fractional heights, and the form on screen shook (Services at step 3 above
  // it, a service ticked in the booking form)
  function offScreen(el) {
    const r = el.getBoundingClientRect();
    return r.bottom < 0 || r.top > window.innerHeight;
  }

  /* ---------- the booking in the corner ---------- */
  // «Ваша запись · N» bottom right once something is chosen; opens the same list as the booking form, with remove buttons.
  // Hidden while the booking form is on screen (it shows the same) and after sending.
  const bk = $('#bk');
  function bookOnScreen() {
    const r = $('.book__card').getBoundingClientRect();
    return r.top < window.innerHeight - 120 && r.bottom > 120;
  }
  // the open services panel has its buttons at the bottom, which the corner and
  // back-to-top buttons covered on phones
  function panelAtBottom() {
    const p = $('#svc-panel');
    if (!p) return false;
    const r = p.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > window.innerHeight - 140;
  }
  function renderCorner() {
    const n = bookCount();
    const hide = !n || state.sent || bookOnScreen() || panelAtBottom();
    if (hide && state.bkOpen) state.bkOpen = false;
    bk.hidden = false;
    bk.classList.toggle('is-away', hide);
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
    mount($('#bk-list'), visitsKey(), () => visitsHTML({ full: true, summary: true }));
    $('#bk-count').innerHTML = '<span class="bk__n">' + n + '</span>';
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
    toTop.hidden = y <= 900 || panelAtBottom();
    if (!toTop.hidden) toTop.classList.toggle('on-dark', darkUnder(toTop));
  }
  // a link's glide marks its target at once and holds it to the end, so the sections passed on the way don't light up
  // one after another (user, 2026-11-23)
  let spyHold = null;
  function onScroll() {
    let active = spyHold;
    if (active === null) SPY.forEach(([id, link]) => {
      const r = document.getElementById(id).getBoundingClientRect();
      if (r.top <= 140 && r.bottom > 140) active = link;
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
  // the scroll that puts the open section's tab bar where it sticks, 10 px under the header: positive while the
  // section is lower on the page, negative when it is above (a footer link, a card low in a scrolled grid). The bar
  // follows the search under the section's head (the grid hides while a section is open), so it can be measured
  // before it exists. The bar comes under the search, so the sections, not the search, are at the top (user)
  function barShift() {
    const gap = parseFloat(getComputedStyle($('.services__in')).rowGap) || 0;
    return $('.svc-find').getBoundingClientRect().bottom + gap - (hdr.getBoundingClientRect().bottom + 10);
  }
  // phones: the section opens where it is (no jump to line it up); the page glides only when the panel's top is
  // above the screen, so the section starts under the bar, or when the section is off the screen (the footer)
  function revealPanel() {
    const top = $('#svc-panel').getBoundingClientRect().top;
    const gap = top - $('.svc-bar').getBoundingClientRect().bottom - 10;
    if (top < 0 || top > window.innerHeight) glideTo(window.scrollY + barShift(), 700);
    else if (gap < 0) glideTo(window.scrollY + gap, 550);
  }
  // the tab bar stays above the section: opening one puts its panel in the grid's place under the bar, and on
  // desktop the page scrolls so the section's steps come right under the bar stuck under the header
  function openCat(id) {
    set({ cat: id, svcStep: 1, picks: withPick(id), docsAll: false, svcAll: false, svcOpen: null, barOpen: false });
    if (swipeMedia.matches) revealPanel();
    else {
      // the section's steps and services right under the stuck tab bar, its head photo scrolled away above
      // (user, 2026-11-23: «вот так центрируем»)
      const shift = $('#svc-steps').getBoundingClientRect().top - (hdr.getBoundingClientRect().bottom + 10 + $('.svc-bar').offsetHeight + 16);
      if (Math.abs(shift) > 1) window.scrollTo({ top: window.scrollY + shift, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
    $('.svc-panel__name').focus({ preventScroll: true });
  }
  // «Все разделы»: on desktop the bar stays where it is and the cards take the panel's place under it; scrolled down
  // into the (much taller) panel, the page is set back before the first frame, so the grid starts right under the
  // stuck bar instead of what lies below Services showing for a moment. Phones (no bar over the grid) glide to the list of
  // sections, under the search, so the choice is what shows (user, 2026-11-23)
  function closeCat() {
    if (!state.cat) return;
    set({ cat: null, barOpen: false });
    if (swipeMedia.matches) {
      glideTo(window.scrollY + $('#svc-grid').getBoundingClientRect().top - hdr.getBoundingClientRect().bottom - 12, 550);
      return;
    }
    const shift = barShift();
    if (shift < -1) window.scrollBy(0, shift);
    // then the page glides so the bar and the cards stand in the middle of the room under the header (taller than
    // the room: the bar where it sticks); the grid's height is read without its fade-in's offset
    const bar = $('.svc-bar').getBoundingClientRect();
    const under = hdr.getBoundingClientRect().bottom;
    const room = window.innerHeight - under;
    const h = bar.height + (parseFloat(getComputedStyle($('.services__in')).rowGap) || 0) + $('#svc-grid').offsetHeight;
    const want = h < room - 20 ? under + (room - h) / 2 : under + 10;
    glideTo(window.scrollY + bar.top - want, 600);
  }
  // the doctor step is there when the section has a choice of doctors (diagnostics without a consultation, or a
  // section with one doctor, goes from its services straight on to the booking)
  function docStep() {
    const cat = catById(state.cat);
    const roles = catRoles(cat, state.cart);
    return !(cat.id === 'diag' && !roles.length) && docsFor(roles).length > 1;
  }
  // «К записи»: Services has no booking step of its own (user, 2026-11-23: one booking for the page) — the choice is
  // already in the booking form, which the page glides to. A doctor picked with none of the section's services
  // ticked is booked alone (not when diagnostics needs no doctor)
  function toBooking() {
    const c = state.cat, id = state.picks[c];
    const noDoc = c === 'diag' && !catRoles(catById(c), state.cart).length;
    if (id && !noDoc && !state.sent && !state.cart.some((x) => x.cid === c && itemDoc(x))) set({ extra: withDoc(id, c) });
    scrollToId('book');
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
      if (swipeMedia.matches && !jawZoomed() && qn(n) >= 6) { jawZoom(sideOf(n) === 'справа' ? 'r' : 'l'); return; }
      if (state.tooth === n) { set({ tooth: null }); return; }
      const keep = state.scope !== 'jaw' && !(state.symptom === 'wisdom' && !WISDOM.includes(n));
      // a doctor picked for another tooth or symptom isn't a choice made for this one
      set({ tooth: n, scope: 'tooth', skipTooth: false, symptom: keep ? state.symptom : null, hDoc: null });
    },
    'jaw-out': () => jawZoom(null),
    'pick-jaw': () => { if (state.scope !== 'jaw') set({ skipTooth: true, scope: 'jaw', tooth: null, symptom: null, hDoc: null }); hStep(2); },
    'skip-tooth': () => { if (state.tooth !== null || !state.skipTooth || state.scope === 'jaw') set({ skipTooth: true, scope: 'tooth', tooth: null, symptom: null, hDoc: null }); hStep(2); },
    symptom: (t) => {
      const id = state.symptom === t.dataset.id ? null : t.dataset.id;
      set({ symptom: id, hDoc: null });
    },
    'helper-next': () => { if (canStep(state.hStep + 1)) hStep(state.hStep + 1); else helperNudge(); },
    'helper-back': () => hStep(state.hStep - 1),
    'helper-doc': (t) => set({ hDoc: t.dataset.id }),
    // to the booking form, with the helper's doctor chosen there
    'helper-book': () => {
      const id = helperDoc();
      if (!id) { helperNudge(); return; }
      helper.close();
      // the reason goes with the doctor, so the administrator knows what it is about
      // (the symptom only, not the tooth: user, 2026-11-23)
      const text = currentSymptom().label;
      const notes = state.notes.some((x) => x.id === id && x.text === text) ? state.notes : state.notes.concat([{ id, text }]);
      set({ extra: withDoc(id), notes });
      scrollToId('book');
    },
    // the finder's «Выбрать зуб»: the helper from a clean sheet, on its first step, the tooth map
    'finder-open': () => {
      set({ hStep: 1, tooth: null, scope: null, skipTooth: false, symptom: null, hDoc: null });
      helper.showModal();
      alignSteps();
      $('#helper-body').scrollTop = 0;
    },
    'helper-close': () => helper.close(),

    cat: (t, e) => { e.preventDefault(); openCat(t.dataset.cat); },
    'cat-tab': (t) => {
      // the current section again: nothing to open, but the phone's drop-down closes as with any other choice
      if (t.dataset.cat === state.cat) { if (state.barOpen) set({ barOpen: false }); return; }
      openCat(t.dataset.cat);
    },
    // back to the section's title with all the cards under it
    'cat-close': () => {
      if (!state.cat) return;
      closeCat();
      $('#services-title').focus({ preventScroll: true });
    },
    // phones: the button in the sticky bar drops the sections down
    // the list drops down under the bar: a bar not yet stuck is first glided up to where it sticks, or the list
    // opened below the screen (360×640)
    'bar-toggle': () => {
      const shift = barShift();
      if (!state.barOpen && shift > 1) glideTo(window.scrollY + shift, 400);
      set({ barOpen: !state.barOpen });
    },
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
      const adding = !inCart(cn);
      // adding replaces this section's consultation; pressing a chosen one takes out only that one
      const cart = adding ? state.cart.filter((x) => !(isConsult(x.n) && x.cid === cat.id)).concat([{ n: cn, cat: cat.name, cid: cat.id }])
        : state.cart.filter((x) => x.n !== cn);
      set({ cart, picks: { ...state.picks, [cat.id]: autoDoc(adding ? [CONSULT_ROLE[cn]] : catRoles(cat, cart)) }, docsAll: false });
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
    'svc-next': () => { if (state.svcStep === 1 && docStep()) goStep(2); else toBooking(); },
    // a search result or a popular service: its section opens with it unfolded, and the page glides to it (under the
    // header and the stuck tab bar)
    'svc-go': (t) => {
      const n = t.dataset.svc, cat = catOf(n);
      if (!cat) return;
      $('#svc-q').value = '';
      renderFind();
      set({ cat: cat.id, svcStep: 1, picks: withPick(cat.id), docsAll: false, svcAll: cat.items.indexOf(n) >= SVC_LIMIT, svcOpen: n, barOpen: false });
      // the service comes to the middle of the room under the header and the stuck bar, and lights up for a moment
      // (user, 2026-11-23: «пусть подсвечивается и находится нужная опция»)
      const row = $$('.svc-row').find((r) => r.dataset.svc === n);
      if (!row) return;
      const bar = $('.svc-bar');
      const under = hdr.getBoundingClientRect().bottom + (bar ? 10 + bar.offsetHeight : 0);
      const r = row.getBoundingClientRect();
      glideTo(window.scrollY + r.top - Math.max(under + 12, under + (window.innerHeight - under - r.height) / 2), 650);
      row.classList.remove('is-found');
      void row.offsetWidth; // restarts the CSS animation
      row.classList.add('is-found');
      clearTimeout(row.foundT);
      row.foundT = setTimeout(() => row.classList.remove('is-found'), 2400);
    },
    // a new booking: empty forms, no services, default doctor; back to where it was clicked
    'book-again': () => {
      form.reset();
      const cat = catById(state.cat);
      set({ sent: false, cart: [], extra: [], notes: [], svcStep: 1, svcOpen: null, picks: cat ? { [cat.id]: autoDoc(catRoles(cat, [])) } : {} });
      form.elements.name.focus();
    },

    'cart-remove': (t) => set({ cart: state.cart.filter((x) => !(x.n === t.dataset.svc && x.cid === t.dataset.cid)) }),
    'visit-remove': (t) => dropDoc(t.dataset.id),
    'note-remove': (t) => set({ notes: state.notes.filter((x) => !(x.id === t.dataset.id && x.text === t.dataset.text)) }),
    'visit-add': (t) => { const id = state.addFor === t.dataset.id ? null : t.dataset.id; pickerFresh = !!id; set({ addFor: id }); },
    'visit-all': (t) => { const id = t.dataset.id; set({ svcsAll: state.svcsAll.includes(id) ? state.svcsAll.filter((x) => x !== id) : state.svcsAll.concat([id]) }); },
    'visit-svc': (t) => {
      const n = t.dataset.svc;
      if (inCart(n)) { set({ cart: state.cart.filter((x) => x.n !== n) }); return; }
      const c = catById(t.dataset.cid);
      set({ cart: state.cart.concat([{ n, cat: c.name, cid: c.id, doc: t.dataset.id }]) });
    },
    // "Сбросить всё": the picked services and doctors, in Services and the booking form alike (name and phone stay)
    'cart-reset': () => set({ cart: [], extra: [], notes: [], svcOpen: null }),
    'book-pick': (t) => { const id = t.dataset.id; if (inBooking(id)) dropDoc(id); else set({ extra: withDoc(id) }); },
    // the corner button: open or fold the list; «Добавить услугу» goes back to all the sections
    'bk-toggle': () => set({ bkOpen: !state.bkOpen }),
    'bk-go': () => set({ bkOpen: false }),
    // «Добавить услугу» first asks which section (a small menu under the button), then opens that section; the
    // menu keeps people from landing on all the sections with nothing chosen
    'add-svc': (t) => { if (catMenu.hidden || catMenuFor !== t) openCatMenu(t); else closeCatMenu(); },
    'add-cat': (t) => { closeCatMenu(); set({ bkOpen: false }); openCat(t.dataset.cat); },

    // with a story open, a tap on another doctor's card shows theirs (user, 2026-11-23); its own buttons keep theirs
    'doc-card': (t) => { if (state.docOpen && state.docOpen !== t.dataset.id) actions['doc-more'](t); },
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
    'doc-page': (t) => {
      // a phone: the dot scrolls the row to that doctor
      if (swipeMedia.matches) { const c = $('#doc-track').children[+t.dataset.page]; if (c) $('#doc-track').scrollTo({ left: c.offsetLeft - $('#doc-track').firstElementChild.offsetLeft, behavior: reduceMotion.matches ? 'auto' : 'smooth' }); return; }
      set({ docPage: +t.dataset.page, docOpen: null });
    },
    'fact-go': (t) => { const row = $('.hero__facts'); const c = row.children[+t.dataset.i]; if (c) row.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - row.clientWidth / 2, behavior: reduceMotion.matches ? 'auto' : 'smooth' }); },
    'doc-prev': () => { const p = docPages(); set({ docPage: (Math.min(state.docPage, p - 1) - 1 + p) % p, docOpen: null }); },
    'doc-next': () => { const p = docPages(); set({ docPage: (Math.min(state.docPage, p - 1) + 1) % p, docOpen: null }); },
    'book-doc': (t) => set({ extra: withDoc(t.dataset.id) }),

    promise: (t) => { t.closest('.promise__item').classList.toggle('is-open'); syncPromises(); },

    top: () => scrollToTop(),
    'cookie-ok': () => closeCookie()
  };

  document.addEventListener('click', (e) => {
    // a click anywhere else folds the corner list
    if (!catMenu.hidden && !e.target.closest('.cat-menu, [data-act="add-svc"]')) closeCatMenu();
    if (state.bkOpen && !e.target.closest('.bk, .cat-menu')) set({ bkOpen: false });
    if (state.barOpen && !e.target.closest('.svc-bar')) set({ barOpen: false });
    const t = e.target.closest('[data-act]');
    if (!t || !actions[t.dataset.act]) return;
    const act = t.dataset.act;
    // a choice made after sending starts a new booking with just that choice (name and phone stay)
    if (state.sent && NEW_BOOKING.includes(act)) {
      // the sent booking's ticks still show: unticking one of them only clears it (an emptied booking), it doesn't
      // start a new one with that very service
      const unticking = act === 'svc-check' ? isTicked(t.closest('.svc-row').dataset.svc)
        : act === 'svc-sub' ? inCart(t.dataset.sub) : act === 'book-pick' && inBooking(t.dataset.id);
      Object.assign(state, { sent: false, cart: [], extra: [], notes: [] });
      if (unticking) { set({}); return; }
    }
    const list = REMOVE.includes(act) ? t.closest('#book-svcs, #bk-list') : null;
    const btns = () => $$('.visit__drop, .visit__x', list);
    const at = list ? btns().indexOf(t) : -1;
    keepInView(t, () => actions[act](t, e));
    // a ✕ takes its own button away: the focus goes to the one now in its place, else to «Добавить услугу»
    // (visibility is checked on the button, not the list)
    if (list && !t.isConnected && list.isConnected && (!document.activeElement || document.activeElement === document.body)) {
      const bkBox = list.closest('.bk');
      const left = btns();
      const next = left[Math.min(at, left.length - 1)] || $('.add-svc', list) || (bkBox && $('.add-svc', bkBox));
      if (next && next.offsetParent) next.focus({ preventScroll: true });
    }
  });
  // Safari has no scroll anchoring: an action that changed something above the screen (choosing a doctor in the form
  // adds «Врач: …» to Services) moved everything under it, the form jumped (user, 2026-11-23, iPhone). There the
  // tapped element — or its nearest ancestor still in the page after a rebuild — keeps its place for the action and
  // the half second of glides after it; it is held in the document, not on the screen, so the page's own glides
  // still move it. Browsers with scroll anchoring do this themselves.
  const NO_ANCHOR = !(window.CSS && CSS.supports('overflow-anchor', 'auto'));
  function keepInView(t, fn) {
    if (!NO_ANCHOR) { fn(); return; }
    const chain = [];
    for (let el = t; el && el !== document.body; el = el.parentElement) chain.push([el, el.getBoundingClientRect().top + window.scrollY]);
    fn();
    const hit = chain.find(([el]) => el.isConnected && el.getClientRects().length);
    if (!hit) return;
    const [a] = hit;
    let base = hit[1];
    const fix = () => {
      const top = a.getBoundingClientRect().top + window.scrollY;
      if (Math.abs(top - base) >= 1) { window.scrollBy(0, top - base); base = top; }
    };
    fix();
    const end = performance.now() + 500;
    (function loop() { if (performance.now() < end && a.isConnected) { fix(); requestAnimationFrame(loop); } })();
  }
  const NEW_BOOKING = ['svc-check', 'svc-sub', 'panel-doc', 'book-pick', 'book-doc', 'helper-book'];
  const REMOVE = ['cart-remove', 'visit-remove', 'note-remove'];
  // in-page links glide instead of jumping (registered after the actions, which may have handled the click);
  // the skip link keeps its jump, it has to move the focus
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || a.classList.contains('skip') || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const hash = a.getAttribute('href');
    const el = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    // where the browser's jump would stop: the target's scroll-margin-top under the top (#top's 100vh clamps to 0)
    const y = el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    holdSpy(el.id);
    glideTo(y, Math.min(800, 350 + Math.abs(y - window.scrollY) / 12), releaseSpy);
    history.replaceState(null, '', hash);
    // the jump used to take the keyboard focus there too; the next Tab goes on from the target
    if (!el.hasAttribute('tabindex') && !el.matches('a[href], button, input, select, textarea')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });
  // iOS Safari applies :active (the press-in in style.css) only when the page listens for touches
  document.addEventListener('touchstart', () => {}, { passive: true });
  // no page zoom on phones: iOS ignores user-scalable=no and touch-action stops only double-tap zoom, so the pinch is
  // cancelled here (Safari's gesture events, a second finger). A pinch during inertial scrolling can't be cancelled;
  // once zoomed in nothing is blocked (html.zoomed lifts touch-action too), so the visitor can pinch back out
  // zoomed either way: in, or out (iOS lets a page zoom out when something is wider than the screen)
  const zoomedIn = () => !!window.visualViewport && Math.abs(visualViewport.scale - 1) > .01;
  if (window.visualViewport) visualViewport.addEventListener('resize', () => document.documentElement.classList.toggle('zoomed', zoomedIn()));
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, (e) => { if (!zoomedIn()) e.preventDefault(); }, { passive: false }));
  document.addEventListener('touchmove', (e) => { if (!zoomedIn() && (e.touches.length > 1 || (e.scale && e.scale !== 1))) e.preventDefault(); }, { passive: false });
  // a second finger is blocked on touchstart too: once the first one scrolls a row, touchmove can't be cancelled
  document.addEventListener('touchstart', (e) => { if (!zoomedIn() && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // a touchpad pinch comes as ctrl+wheel (the mobile preview window); only on touch screens, so a desktop keeps
  // Ctrl+wheel browser zoom
  const coarse = matchMedia('(pointer: coarse)');
  document.addEventListener('wheel', (e) => { if (e.ctrlKey && coarse.matches && !zoomedIn()) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!catMenu.hidden) { const b = catMenuFor; closeCatMenu(); if (b && b.isConnected) b.focus(); return; }
    if (state.barOpen) { set({ barOpen: false }); $('.svc-bar__toggle').focus(); return; }
    if (!state.bkOpen) return;
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
    holdSpy('top');
    glideTo(0, Math.min(800, 350 + from / 12), releaseSpy);
  }
  // the nav link of a section being glided to (null: not one of the spied sections, nothing held)
  function holdSpy(id) {
    const hit = SPY.find(([s]) => s === id);
    spyHold = hit ? hit[1] : null;
    if (spyHold !== null) onScroll();
  }
  function releaseSpy() { spyHold = null; onScroll(); }
  // the page glides to y: a slow start and a soft landing; a wheel turn or a touch stops it
  // done: called when it ends, also when stopped or not needed
  function glideTo(y, dur, done) {
    const from = window.scrollY;
    const to = Math.max(0, Math.round(y));
    if (Math.abs(to - from) < 2) { if (done) done(); return; }
    if (reduceMotion.matches) { window.scrollTo(0, to); if (done) requestAnimationFrame(done); return; }
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
      if (done) done();
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

  /* ---------- «Добавить услугу»: which section ---------- */
  // one floating menu of the six sections, under the button that opened it (above it when there is no room below);
  // a scroll, a click elsewhere or Escape closes it
  const catMenu = document.createElement('div');
  catMenu.className = 'cat-menu';
  catMenu.setAttribute('role', 'menu');
  catMenu.setAttribute('aria-label', 'Раздел услуг');
  catMenu.hidden = true;
  catMenu.innerHTML = `<span class="cat-menu__h">Выберите раздел</span>${D.cats.map((c) => `<button type="button" class="cat-menu__item" role="menuitem" data-act="add-cat" data-cat="${c.id}"><span class="cat-menu__ph" aria-hidden="true"><img src="assets/img/services/${c.id}-800.webp" alt="" loading="lazy"></span><span>${esc(glue(c.name))}</span></button>`).join('')}`;
  document.body.appendChild(catMenu);
  let catMenuFor = null;
  function openCatMenu(btn) {
    catMenuFor = btn;
    catMenu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect(), m = catMenu.getBoundingClientRect();
    const below = r.bottom + 8 + m.height <= window.innerHeight - 8;
    catMenu.style.left = Math.max(8, Math.min(window.innerWidth - m.width - 8, r.left)) + 'px';
    catMenu.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - 8 - m.height)) + 'px';
    $('.cat-menu__item', catMenu).focus({ preventScroll: true });
  }
  function closeCatMenu() {
    if (catMenuFor) catMenuFor.removeAttribute('aria-expanded');
    catMenuFor = null;
    catMenu.hidden = true;
  }
  window.addEventListener('scroll', () => { if (!catMenu.hidden) closeCatMenu(); }, { passive: true });
  window.addEventListener('resize', () => { if (!catMenu.hidden) closeCatMenu(); });

  /* ---------- tooltips ---------- */
  // a name cut with «…» ([data-tip]) shows whole in a small tooltip in the site's colours (style.css .tip): next to the
  // mouse pointer, following it, so it never covers the name; under the element when it has the keyboard focus. Only
  // when the name is really cut, and not on touch screens (no hover there)
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  let tipFor = null;
  const isCut = (el) => { const box = $('.visit__svc-n', el) || el; return box.scrollWidth > box.clientWidth + 1; };
  // x, y: the point to show it at (below and right of it), kept on the screen
  function placeTip(x, y) {
    const t = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(window.innerWidth - t.width - 8, x)) + 'px';
    tip.style.top = (y + t.height + 8 > window.innerHeight ? y - t.height - 28 : y) + 'px';
  }
  function showTip(el, x, y) {
    if (!isCut(el)) { hideTip(); return; }
    tipFor = el;
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    placeTip(x, y);
  }
  function hideTip() { tipFor = null; tip.hidden = true; }
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-tip]');
    if (!el) { if (tipFor) hideTip(); return; }
    if (el !== tipFor) showTip(el, e.clientX + 12, e.clientY + 18);
    else placeTip(e.clientX + 12, e.clientY + 18);
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && e.target.matches(':focus-visible')) { const r = el.getBoundingClientRect(); showTip(el, r.left, r.bottom + 6); } else if (tipFor) hideTip();
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('pointerleave', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });
  document.addEventListener('click', hideTip, true);

  /* ---------- pictures on a slow connection ---------- */
  // a picture not loaded yet shimmers in its place (style.css img.is-loading); pictures the scripts add later are
  // caught by the observer. A class, not an attribute, and only while loading: a loaded picture has no trace of it,
  // so mount() still finds a rebuilt booking group identical to the old one.
  const watchImg = (img) => { if (!img.complete) img.classList.add('is-loading'); };
  const imgDone = (e) => { if (e.target.tagName === 'IMG') e.target.classList.remove('is-loading'); };
  document.addEventListener('load', imgDone, true);
  document.addEventListener('error', imgDone, true);
  $$('img').forEach(watchImg);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    if (n.tagName === 'IMG') watchImg(n); else $$('img', n).forEach(watchImg);
  }))).observe(document.body, { childList: true, subtree: true });

  /* ---------- start ---------- */
  function render() {
    renderPicker();
    renderServices();
    renderDoctors();
    renderBooking();
    updateFloating();
    placeCarets();
    pickerFresh = false;
  }
  buildTeeth();
  render();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  swipeMedia.addEventListener('change', render);
  swipeMedia.addEventListener('change', syncPromises);
  swipeMedia.addEventListener('change', () => jawZoom(null));
  syncPromises();
  // the panel's caret follows its card when the page is resized or the phone row is swiped
  window.addEventListener('resize', docCaret);
  window.addEventListener('resize', tabsFade);
  window.addEventListener('resize', () => { if (helper.open) alignSteps(); });
  window.addEventListener('resize', placeCarets);
  // the tooth map is lazy inside the closed helper, so it began loading only when the helper opened (an empty box
  // for a second); it starts once the finder is near the screen or its button is pointed at
  const jawImg = $('.jaw__img');
  const warmJaw = () => { jawImg.loading = 'eager'; };
  $('.finder__pick').addEventListener('pointerenter', warmJaw, { once: true });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { warmJaw(); io.disconnect(); } }, { rootMargin: '400px 0px' });
    io.observe($('#finder'));
  }
  $('#doc-track').addEventListener('scroll', docCaret, { passive: true });
  $('#doc-track').addEventListener('scroll', () => { if (swipeMedia.matches) syncDots(swipeIndex()); }, { passive: true });
  // the card nearest the row's middle (the middle one stops centred, the first and last at the edges: style.css)
  const factIndex = (row) => { const mid = row.scrollLeft + row.clientWidth / 2; let best = 0, d = Infinity; Array.from(row.children).forEach((c, i) => { const x = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (x < d) { d = x; best = i; } }); return best; };
  $('.hero__facts').addEventListener('scroll', (e) => { const cur = factIndex(e.currentTarget); $$('#fact-dots .dot').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.i === cur)); }, { passive: true });
  onScroll();
  // the doctors grid is built by script, so re-apply an anchor from the address once it exists
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView();
})();
