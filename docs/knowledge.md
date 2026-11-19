# Knowledge base

How the sections of the site work and why they are built that way: design decisions, browser
quirks, measurements. One section per component, in page order. Not deployed.

## Origin and fidelity

The page was designed in Claude Design and exported as a "bundler" file (commit `ffa5378`): a
template with `{{…}}` bindings, `sc-if`/`sc-for` tags and ~600 inline styles, rendered at runtime
by React from a `DCLogic` component. On 2026-10-20 it was rewritten as static HTML + CSS + JS:

- `index.html` — all static content; dynamic parts have empty containers that `main.js` fills.
- `assets/js/data.js` — the content the logic needs (clinic address, service categories and texts,
  symptoms, recommendations, tooth outlines). Generated from the export's `DCLogic`; edit it by hand now.
- `assets/js/main.js` — one `state` object; `set(patch)` merges and calls `render()`, which updates
  every widget. Clicks are delegated: an element with `data-act="name"` runs `actions.name`.
- `mount(el, key, build)` rebuilds a container's HTML only when its structure key changes, and
  keeps keyboard focus on the element with the same `data-focus`. Everything else (selection,
  open/closed) is synced on existing elements, so CSS transitions and entry animations play like
  in the export instead of restarting on every click.

At 1440 px the default state matches the export pixel for pixel apart from image re-encoding
(screenshot diff 0.02 %, only on photo edges); the picker and services states match too. To
compare again: `git show ffa5378:index.html` into a temp folder with a copy of `tools/shot.html`,
serve it on another port, and run `tools/shot.sh -Port <port>` against both.

Dropped from the export because nothing on the page used them: the clinic pop-up
(`popupOnLoad`, it had no markup), a promo flag, tab-scroll arrows, a doctor "preview", and the
cross-page `localStorage` jump (`vms-goto`) — native anchors do that job.

Small behaviour addition over the export: footer service links open that category's panel.

## Brand

The logo is the user's `logo.svg` (tooth + «Гревитидент» + «стоматологическая клиника», text in outlines):
`assets/img/logo.svg` in the header (48 px high, 38 px on phones) and in the footer. The footer is White with a
1 px Navy line on top (2026-11-19, user's choice); links underline in Orange on hover: it was Navy with `logo-light.svg` and white text, then briefly
Mint; the user disliked two dark blocks in a row (booking card and footer) and then the Mint. `logo-light.svg`
(navy text white, the tooth's dark stops light) is kept, unused, for a dark background.
The favicon is the tooth alone (`assets/icons/favicon.svg`, square viewBox); the 32 px and
apple-touch PNGs were rendered from it in headless Chrome. The site palette was left as it was: its
accent `#6BAFC6` and ink `#263E49` already sit next to the logo's `#67B0C0` and dark `#233D49` (the
user changed the logo's navy `#01375E` to it on 2026-11-03; the light variant and icons were redone).
**Palette (2026-11-18, user's rule): only five colours, no derived shades** — White `#FFFFFF` (`--bg`, `--white`:
every section and card), Navy `#0C2C47` (`--ink`, `--ink-2`, `--muted`, `--faint`: all text; `--line`, `--line-2`: 1 px
card borders, which replace the old tinted section bands; the dark booking card and the map mock), Yellow
`#F0AA2F` (`--accent`: buttons with Navy text, selected chips, hover borders, input borders, main roads on the map),
Mint `#ABC8C4` (`--tint`: icon circles, soft fills and hovers, tags, inactive carousel dots, the selected tooth fill —
added back because Yellow alone was too much), Orange `#BF512C` (`--accent-ink`: eyebrows and link hovers; errors, the
map pin, the header address pin, list bullets, the quote mark). Text on Navy is White. Alpha only for shadows,
masks and the tooth overlay. The logo (tooth: Navy → Mint), `logo-light.svg`, favicon
and its PNGs (re-rendered from `favicon.svg` in headless Chrome) follow it; `og-image.jpg` still has the old teal logo.
The name is set in Arsenal (the user's `Arsenal_vector_text.svg`, outlined paths, 2026-11-19): «Гревитидент» Navy,
«стоматологическая клиника» Orange. The header shows `logo-wordmark.svg` — the name only (no tooth, no divider;
user's request so the header isn't overloaded); the footer's `logo.svg` is the tooth and divider of the old logo
with the Arsenal text beside them (a scaled `<g>`). `logo-light.svg` and `og-image.jpg` still have the old lettering.
Staff photos sit on plain white. Earlier palettes: the original blue (commit `332f29c`), a warm grey (`a75c886`),
seven colours with Mauve, Green and Mint (`4556e29`), four without Mint (`0a844e9`).

The hero photo (AI-generated, from the design) had the VestMedServis logo on the coat; it was painted
out on 2026-11-03 (each column of the patch interpolated between the rows above and below, in a canvas,
re-encoded as WebP). `og-image.jpg` was rebuilt from an HTML layout with the new logo and address.

## Typography (line breaks)

Russian rules, applied on 2026-11-03 to every visible text: short words (prepositions, conjunctions,
pronouns, «не», «что», «как»…) are glued to the next word with `&nbsp;`; «ли», «же», «бы» and a dash
to the previous word; a number to the word after it («6&nbsp;месяцев», «от&nbsp;3 до&nbsp;6»);
«г.&nbsp;Брест», «ул.&nbsp;Липовая,&nbsp;18», «офис&nbsp;4», «Шаг&nbsp;2». In `index.html` these
are literal `&nbsp;`; texts the script renders go through `glue()` in `main.js`, which applies the same
rules (data.js stays plain). Phone numbers never break: `a[href^="tel:"]`, `.tel-text` and `.nowrap` are `nowrap`.
CSS: headings and `summary` use `text-wrap: balance`, paragraphs `pretty`. When adding copy, write
`&nbsp;` the same way (or run it through `glue()` if it is rendered by script).

## Fonts

Manrope (headings), Onest (text) and Playfair Display italic (only the motto in "О клинике").
Only the cyrillic and latin subsets are self-hosted (plus Onest "symbols" for ★ and ←); each file
is a variable font, so one `@font-face` per subset covers all weights. Licences: `assets/fonts/OFL.txt`.

## Header

Breakpoints, from wide to narrow:
- ≥ 1390 px — the export's layout: logo + address, nav, phone with hours, CTA, one row.
- < 1390 — the phone number and hours are visually hidden (still read by screen readers), only
  the round icon stays; that is what lets the row fit down to 1280.
- < 1280 — burger: `.hdr__menu` (nav + contacts) becomes a drop-down panel. On desktop it is
  `display: contents`, so its children stay flex items of the header row.
- < 640 — the address leaves the header (the menu's "Контакты" leads to it).

`--hdr-h` is the header height at each breakpoint (82 / 74 / 70); sticky bars and
`scroll-margin-top` use it. Scroll-spy marks the nav link of the section crossing 140 px from the top.
A nav jump stops with the section title 28 px under the header (user's request, 2026-11-18): sections have
`scroll-margin-top: calc(var(--hdr-h) - var(--sec-y) + 28px)`, a negative-ish margin that skips the top padding.

Nav capsule (2026-11-19). Earlier the same day the links were chained by "braces" (the user's `Frame 7.svg`: a
wire with an orthodontic bracket before each label, in git history); the user then dropped them and asked for the
nav itself to stand out at once. Now the links sit in a soft capsule (Mint mixed 35 % into White) as pills; the
current section is a White pill with a light shadow and Orange text, hover gives a half-white pill and Orange text.
No movement (the user dislikes hover jumps). In the burger menu it is a plain list again. "Главная" (`#top`, the
hero) is the first link and is in scroll-spy.

Phone numbers (2026-11-18, user's request): on a computer a `tel:` link opens Skype or a similar app, so
`header.js` removes the `href` from every `a[href^="tel:"]` unless the pointer is coarse (phones, tablets)
and adds `.tel-text`; such an `<a>` is styled as plain text, and `.hdr__call` (the round phone button of
the burger header) is hidden without its link.

## Hero

The photo's right edge lines up with the header's "Записаться" button (2026-11-19, user's request; before that
it bled to the window edge, which the user disliked): `.hero` is an inline-size container and `.hero__media` gets a
negative right margin of `min(660px, 50cqw − gutter) − min(720px, 50cqw − gutter)` — the header content is
1440 px max, the hero's 1320. Its shape is a "leaf" from the user's `Rectangle 1.png`: big rounding top-left and
bottom-right, square corners elsewhere — `border-radius: 44% 0 / 50% 0`, measured from that picture
(1907 × 1697). The doctor stands at 31 % of the picture's width; `object-position: 0%` brings the doctor nearest the
middle of the leaf. Under 1128 px text and photo no longer fit side by side; the photo then goes full
width under the text (`object-position: 25%`; 12 % on phones centres the doctor), same leaf shape.

The fact cards span the same width as the text column plus the photo: from the text's left edge to the photo's
right edge (the header CTA), with the same `cqw` margins as `.hero__media` (2026-11-19, user's request). On hover
(`@media (hover: hover)` only) only a deeper shadow appears — no colour, which the user reads as an active button,
and no movement. The icon sits beside the title and the text runs the full card width below it (2026-11-19, user:
the braces card wrapped to three lines), so all three texts take two lines at ≥ 1280 px and the cards are level.

## Finder (the helper's mini section)

The user calls the helper the site's signature feature, so on 2026-11-19 its call-out moved out of the Services
head into a section of its own, right before Services. Tried and dropped the same day: a big card with the jaw
photo (too eye-catching), a three-step demo (too tall), a slim band with a breathing, shining Yellow button
(«like a garage advert») and a calm slim band with a Navy button (the user wanted it bigger, Yellow, and to hint
at the teeth). Now: «Помощник», «Не знаете, к какому врачу?», a lead and a Yellow «Подобрать врача» (no effects
but the arrow nudging on hover) on the left; on the right a thin line drawing of the 32 teeth — the helper's own
outlines from `D.teeth` (absolute coordinates in `teeth.webp`, drawn in one SVG cropped to the teeth). A tooth
fills Mint on hover and its name shows under the drawing («Зуб 5 — второй премоляр»). A click only marks it (Yellow,
«Выбран зуб …»; again: unmarks; it is the helper's own `state.tooth`, so both always agree) — the user wanted the
button to stay the way in: «Подобрать врача» (`finder-open`) opens the helper with the marked tooth on «Что беспокоит»,
or from the start when none is marked.
Below 900 px the drawing goes above
the text. The section has no top padding: About's bottom padding is the gap.

**Spacing between sections** (user, 2026-11-19): every gap is the one between the hero's fact cards and About —
`--sec-y` (96 px, 64 on phones). Sections have only top padding (Services lost its bottom one, which made a double
gap before the team); the booking section keeps its bottom padding before the footer.

## Helper (tooth → symptom → which doctor)

Until 2026-11-19 this was a page section, «Подбор врача за минуту», whose hint could tick services into the cart
and book. The user turned it into an optional helper with no booking: a native `<dialog id="helper">`
(`showModal()`, Esc and a click on the backdrop close it) opened by the «Не знаете, к какому врачу?» call-out
in its own mini section, «Finder» (`#finder`, between About and Services; see below). It is deliberately not called
AI: the answer comes from fixed rules in `data.js`.
Booking stays only in the Services panel and the booking form; the helper's choices no longer reach the booking
summary (later the same day step 3 got «Записаться», which only leads to the booking form with the
recommended doctor). Focus goes to the title on open (`autofocus`), not to the close button.

The same day the user asked for it step by step, with nothing on screen that can't be chosen yet (before, the
jaw, a locked symptom block and an empty hint column were all visible at once), and for the scrollbar not to run
outside the dialog's rounded corners:

- Layout: a white column on the left (mint was dropped: the user disliked the coloured strip) with the title and
  the steps (Зуб → Что беспокоит → Какой врач нужен), each
  showing the answer given; on the right only the current step (`state.hStep`), a fixed head («Шаг N из 3»,
  heading, lead), a body that scrolls, and a fixed bar with Назад / Далее («Показать врача» on step 2,
  «Записаться» on step 3). Only the body scrolls, so the scrollbar sits between the head and the bar, clear of the
  corners. Every step has the same size (user's request, after a version whose height followed the step):
  780 px or the screen. Step 3 is one column (doctor, then direction and services), so it fills that height.
- A step opens once the one before it has an answer (`canStep()`); «Далее» is disabled until then; done steps
  in the left column only show progress — moving is by Назад / Далее alone (user's request). Choosing a tooth only selects it; «По всей челюсти» and «Не знаю,
  какой зуб» are answers themselves and go straight to step 2. The doctor shows in the left column only once
  step 3 is open, so it isn't given away while choosing the symptom.
- Step 3: the heading and lead are the symptom's title and text; then «Вам к врачу» — the roles of
  `recommend[symptom].roles` (the therapist when it has none) with those doctors' cards — a 3:4 portrait, name,
  specialty and experience, as in the team section (user's request: a bigger photo to fill the step); with a single
  doctor «Как пройдёт первый приём» (three points from the clinic's promises) fills the right half — and under it the
  direction and `svcs` as a plain list (a link to the category in Services was removed at the user's request).
  With two or more doctors the cards are a choice (user's request): a tick and a Navy outline on the chosen one
  (`state.hDoc`, `helperDoc()`); «Записаться» stays disabled until then, a lone doctor counts as chosen.
  «Записаться» closes the dialog, sets the booking form's doctor to the chosen
  one (`docPick`) and scrolls to the form. The site's scroll uses requestAnimationFrame, which never fires in the
  headless shot harness — to check such a jump there, replace it with a timer in `-Do`.
- The jaw is sized by the dialog's height (`.jaw__frame` max-width from `100dvh`), so step 1 fits without
  scrolling on a laptop; its min-width keeps the side labels inside.
- No step scrolls on a laptop (user, 2026-11-19): below 860 px of height the head, the bar, the jaw and the
  doctor photos get tighter, and below 720 px tighter still (no experience line, a smaller first-visit list);
  checked down to 680 px in all steps. Only shorter screens still scroll the step body.
- Below 900 px the dialog is full-screen, the steps go in a row on top and only the current one keeps its title;
  the disclaimer then moves from the left column into step 3.
- The tooth map is `assets/img/teeth.webp` (1536 × 1024) with 32 buttons positioned in % of that
  size. Each button has `pointer-events: none` and only its SVG outline path takes clicks, so
  neighbouring bounding boxes don't steal clicks.
- Numbering: data uses 1–32 (upper right → upper left → lower left → lower right, as the doctor
  sees the patient); labels show the number within the quadrant (`qn()`, 1–8). Wisdom teeth are
  1, 16, 17, 32 — only for them the "Мешает зуб мудрости" chip appears, and another symptom on a
  wisdom tooth adds a note about the surgeon.
- "По всей челюсти" switches to the jaw symptom set (`symptomGroups.jaw`) and tints all teeth.

## About

The title is three fixed lines, «Лечим так, / чтобы вы понимали / каждый шаг» (2026-11-19, user's request:
it used to break between «чтобы» and «вы»; two lines do not fit the column at the title size).
Two columns from 1000 px: text (title, lead, the three promises in a column, the motto pinned to the
bottom) and a photo collage that stretches to the text's height: one large tile (with the address
chip) and two small ones. Below 1000 px one column: the collage goes between the lead and the
promises, which line up in a row again. The tiles are placeholders («Кабинет», «Холл», «Оборудование»,
"фото скоро появится") until the clinic sends photos: replace a tile's `.about__ph-in` with
`<img src="assets/img/…" alt="…" loading="lazy">`, which covers the tile (WebP, about 1600 px wide for
the large one).

The export had a row of four numbers (years, patients, staff, branches) between the lead and the
promises; they were VestMedServis figures and the row was removed on 2026-11-03 together with its
styles. If the new clinic gives its own figures, the markup and CSS are in git history.
The hero facts, the about lead, the promises and the FAQ were rewritten from what stom-brest.com says
about the clinic (therapy and hygiene, prosthetics, implants, orthodontics with Damon braces).

Gallery photos zoom to 105 % on hover (2026-11-19, user's request), inside their rounded frame; `isolation:
isolate` on `.about__ph` keeps Safari from drawing the zoomed photo past the corners.

## Services

- The six cards open a panel (the grid is hidden while it is open); the sticky bar switches
  categories. The list shows 6 services with "Показать ещё". The cards have no numbers or chevron
  buttons since 2026-11-18 (user's request). Compact since 2026-11-19 (user: all six should fit one screen):
  a 124 px photo strip, 23 px titles, three columns from ~1000 px; the 2-line title reserve that keeps descriptions
  level applies only between 641 and 1279 px, where some titles wrap.
- Opening a category from the grid (2026-11-19, user's request): every card flies up into its tab of the sticky
  bar (`flyToTabs` in `main.js`): a fixed ghost per card animates from the card's rect to the tab's rect with the
  Web Animations API (680 ms, staggered 28 ms), its photo fading out and the tab label fading in; the real tabs stay hidden
  (`.is-landing`) until their ghost lands. The panel is held invisible meanwhile (a script animation, which beats its
  CSS entrance) and then fades in where it is, without moving (the user disliked it rising and the page jumping up):
  the page lines the tab bar up under the header (user: align to the section's navigation), scrolling while the
  cards fly; the ghosts measure the tabs before the scroll starts and aim at where they will be (`shift`).
  Skipped with reduced motion and when
  switching tabs. "Все разделы" scrolls to the Services title (`#services`) with all the
  cards under it. The tab bar is a floating capsule (rounded, 1 px Navy border),
  sticky 10 px under the header (user: the straight full-width bar looked out of place). The tabs grow to fill it
  (`flex: 1 0 auto`), so there is no empty end on the right; where they don't fit they scroll.
  In the shot harness Chrome speeds timers up, so a paused frame shows the tabs already visible — that's the harness.
- Every category head has the same height, so switching doesn't make the photo or "Все разделы" jump:
  the title keeps 2 lines (`min-height: 2.2em`, text at the bottom) and the description 3 lines
  (4 on ≤ 480 px) — the longest texts at each width; a longer text would grow the head again.
  Switching fades the photo, text and list in (`fadeIn`); closing the panel slides the grid back in.
- The panel body is a wizard, one step at a time (user's choice, 2026-11-17 — before it was services
  and doctors side by side, which left an empty column when a category has one doctor):
  1 Услуги (the list in two columns on desktop) → 2 Врач (horizontal doctor cards; a lone one spans
  [the step numbers use the helper's colours since 2026-11-19: current Navy with a Yellow halo, done Navy with a
  tick, ahead an outline; the line between done steps Navy]
  the width) → 3 Проверка (one card with rows, label left / value right: all ticked services, any
  category, with remove buttons; the doctor; the
  preferred time — the same `state.time` as the booking form's radios, so choosing in one updates the other) →
  contacts: name, phone, optional e-mail; "Отправить заявку" (a `form="svc-form"` button in the nav)
  sends from the panel itself, without going to the booking form (user's request, 2026-11-17). Same
  validation as the booking form (`SiteForm.bind`, which also checks an `email` field if the form has one);
  both forms share `state.sent`; once sent, step 3 shows only the confirmation (no entered data,
  heading, consent or buttons). The step was called "Проверка", now "Запись". `state.svcStep`; the step bar on top is clickable,
  "Назад / Далее" below. Opening or switching a category resets it to step 1. Going to another step
  scrolls back to the step bar only if it is above the screen.
- "Консультация специалистов" needs a specialist: its checkbox opens the row to choose one
  (therapist / orthopedist / surgeon / orthodontist), only one at a time.
- Expanding rows animate `grid-template-rows: 0fr → 1fr`; the collapsed content also gets
  `visibility: hidden`, so links and buttons inside it are out of the tab order.
- Photos: `assets/img/services/<category>.webp` (1600 px) and `-800.webp`. Since 2026-11-19 they are the user's
  new pictures (folder «врачи и клиника» on the user's desktop, 1672 × 941 PNG → cwebp -q 80 -m 6 -sharp_yuv, resized;
  the 2026-10-21 ones were the design's). Cards: a 176 px strip that bleeds to the
  card edges and fades into the card; the `<img>` is lazy, so the six photos don't load with the page.
  The open category's dark head: the photo covers its right 66 % and fades in from its left edge
  (`--fade`, 24 % for "treat", 48 % for the rest); the per-category crops (set for the new pictures so faces
  stay in frame) are in CSS
  (`.svc-panel__photo[data-cat=…]`). On phones the photo becomes a band above the text, which would
  otherwise sit on a bright part of the picture.

## Back-to-top

The floating cart pill (selected services, with «Записаться») was removed on 2026-11-19 at the user's request;
the ticked services still show in step 3 of the Services panel and in the booking card. Back-to-top shows
after 900 px and switches to a white version over dark backgrounds: `darkUnder()` reads the background
colour under the button's centre on scroll.

On press (2026-11-19, user's request: "a nice animation") the arrow flies out of the top of the button and comes
back in from below (`.is-launch`, CSS), while `scrollToTop()` glides the page up with an ease-in-out cubic, 500 ms
plus 1 ms per 8 px of distance, at most 1.2 s; a wheel turn or a touch stops it. Reduced motion: an instant jump.

## Cookie notice

Added 2026-11-19 at the user's request: a white card bottom left (across the bottom on phones, where the
back-to-top button moves up by its height via `--cookie-h`), «Мы используем файлы cookie…» and «Хорошо». It slides
in 0.9 s after load and stays away once accepted (`localStorage` `cookie-ok`; if storage is blocked it shows on
every visit). The site itself sets no cookies yet; the notice is there for when analytics or a chat widget arrive.

## Doctors

The VestMedServis staff was removed on 2026-11-03; the section came back the same day for Grevitident:
4 dentists (therapist, surgeon, orthodontist, orthopedist — the 4th was a "Врач-стоматолог" of unknown speciality until 2026-11-17) and
2 nurses, plus 2 administrators (role `admin`, added 2026-11-17; the section title became «Наша команда»). Since 2026-11-17 they have invented names (user's request, placeholders until the real ones)
and short specialities without «Стоматолог-» (`Терапевт`, `Хирург`…). Photos (2026-11-17, from the user, white background): `assets/img/doctors/<id>.webp`,
600×800 (3:4 crop of the source, cwebp -q 80); `mix-blend-mode: multiply` on a light tint box turns the white
background into the box colour, so nothing may be drawn under a photo. Clinic photos in the About collage:
`assets/img/clinic/` (building 1400 px wide with the address chip, reception and cabinet 900 px). Each `doctors` entry in `data.js` has `id` (doctors are picked by it,
since names may change), `name`, `spec`, `role`, `photo` (file in `assets/img/doctors/`, without
`.webp`) and, for the 4 doctors, `exp`. While `name` is empty a silhouette and the speciality stand in everywhere; fill the entries and
check the lead text in `index.html`.
- The lead says only «Опытные специалисты по всем направлениям.» (the staff count was dropped 2026-11-19, user's
  request). Everyone has one invented line under the speciality (`exp`, with an award icon): doctors — years plus
  a certificate or award; nurses — «Первая категория» and years; administrators — years and what they help with.
  The lines are kept short enough for two lines on the narrow 1024 px cards; numbers and «лет», and other key
  word pairs, are glued with no-break spaces. `.doc__spec` reserves room for those two lines, so both pages keep
  the same height when paging.
- Section: no tabs (the user wants one list: doctors, then nurses, then administrators), 4 per page (2 pages) with arrows and dots; phone (≤ 640 px) one scroll-snap row. Every
  doctor (not the nurses or administrators) has "Записаться", which also picks that doctor for the booking summary.
- No "любой свободный врач" option (removed on the user's request, 2026-11-17): a concrete doctor is
  always named. Opening a category, ticking a consultation or picking a symptom selects the doctor of
  the first role in `roles` (`autoDoc`; so the order of `roles` sets the default, e.g. aesthetics →
  therapist); the visitor can switch to another one shown, but not unselect. With nothing picked (a plain
  check-up, diagnostics without a consultation) the booking summary says the therapist.
- Doctor choice: in the services panel (step 2, doctors of `cats[].roles`; in diagnostics, of the
  ticked consultation), in the picker's "Кто примет" (`recommend[symptom].roles`), and as "Врач" in the
  cart and booking summary. Categories or symptoms whose role has nobody say "Врача
  подберём при записи".

## Contacts

One address (the export had two VestMedServis clinics with a switcher in the header, the menu, the
contacts and the booking summary; removed on 2026-11-03). The header address is a plain link to
`#clinics`. The contacts card puts the map (a static picture that opens Google Maps) and the address
side by side; under 760 px they stack. The "Открыть в Google Картах" pill on the map is White with Navy text
and turns Orange with white text on hover (2026-11-19, user's request).

## Reviews

The four VestMedServis reviews (a scroll-snap carousel) were removed on 2026-11-03; the markup, script and
styles are in git history before that date.

## FAQ

Native `<details>`; opening is instant, so a click on `summary` is intercepted and the item's height is
animated (Web Animations, 320 ms) from its current height to the open or closed one; the questions below
slide down instead of jumping. While closing, `.is-closing` turns the icon and shadow back at once and
`open` is cleared when the animation ends; a click mid-way cancels and reverses from the current height.
Skipped with `prefers-reduced-motion`. Note: headless Chrome in `tools/shot` does not advance animations,
so to check end states call `getAnimations()[0].finish()` in `-Do`.
The icon is a down chevron that turns 180° when open (a plus turning into a cross until 2026-11-19; the user
wanted dropdown arrows).
The item is `box-sizing: border-box`: the animation sets `height`, and with content-box the 2 px of borders made
the card jump at both ends; the closed height is the summary plus the borders (fixed 2026-11-19).

## Booking

Redesigned 2026-11-19 (user disliked the Navy card with a static «Повод / Врач / Время» summary; chose «светлая с
выбором врача»). The rows follow the order of Services' step 3 (user): Услуги, Врач, Удобное время, Контакты —
a white card, label on the left, «Отправить заявку» at the bottom right:
- «Врач» — five equal tiles in one row (photo above the name, cropped from the top so the head is whole; a list of
  rows on phones; user disliked one chip
  wrapping alone): «Любой врач» (`docPick` null; chosen, its circle stays white like the photo circles) and the
  four bookable doctors. The choice is the
  same `docPick` as in Services and the helper, so a doctor picked there shows here and the other way round.
- «Услуги» — the services ticked in Services as removable chips; none: a line and a link to «Услуги».
- «Контакты» (name, phone) and «Удобное время». Services' step 3 and this form are one booking: doctor, services
  and time share the state, and the name and phone are mirrored as they are typed (`copyContacts`).
- «Сбросить всё» (top right, and next to «Выбрано N услуг» in the services panel) clears the services and the doctor
  (`cart-reset`; user's choice: name and phone stay); hidden when there is nothing to clear.

The lead is only «Оставьте номер — перезвоним и подберём удобное время.»; the "Или позвоните сами" phones were
dropped 2026-11-19 (user's request; the numbers are in the header, contacts and FAQ).

Validation as in the export: name — letters only, at least 2, rejects
keyboard mash; phone — Belarus `+375 (XX) XXX-XX-XX`, auto-formatted while typing, a leading 80 becomes
375 (also typed digit by digit). Another country (since 2026-11-17, user request): a number starting with
"+" and a code other than 375 is kept as typed (digits and separators, max 15 digits) and needs at least 8
digits; digits typed without "+" are still taken as a Belarusian number. Errors show after the field was left or after a submit attempt; submit focuses the first bad field.
After sending, "Заявка отправлена" takes the form's place in the same grid cell (`.is-sent` on the card,
the hidden part keeps its space via `visibility`), so the card doesn't shrink or jump; the floating cart
button disappears too, and the confirmation (here or in the services panel) is scrolled to the middle
of the screen (`markSent`). Headless Chrome in `tools/shot` neither runs smooth scrolling nor fires
`requestAnimationFrame` reliably — to check, patch `scrollIntoView` to `behavior: 'instant'` in `-Do`.
Both confirmations have "Записаться ещё раз" (`book-again`): it resets both forms (`form.reset()`; `SiteForm`
clears its errors on reset), the services, the time and the doctor, and returns to step 1 of the services
panel or to the booking form's name field.

**Preferred time** (2026-11-17): radio pills `name="time"` — утром / днём / вечером / любое (default),
shown in the summary as "Время". No date and no real slots on purpose: the administrator calls back and
agrees the exact time. Hours are not shown because the clinic's opening hours are still unknown. A real
calendar with free/blocked slots and a doctors' admin panel was discussed and postponed (it needs a
backend such as Supabase, logins and handling of patients' personal data).

**Requests are not delivered anywhere yet** — submit only shows "Заявка отправлена". The delivery
(e.g. Web3Forms, as in Nitowska, or a Telegram bot) goes into the form's submit handler in `main.js`.

## Removed pages

The blog, documents and vacancies pages (with their scripts, the legal PDFs and the news block on the
home page) were built for VestMedServis and removed on 2026-11-03, when the site was switched to the
Grevitident clinic, which has no such content yet. They are in git history (before that date) if the
new clinic needs them back.
