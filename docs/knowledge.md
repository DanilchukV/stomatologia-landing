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
`assets/img/logo.svg` in the header (48 px high, 38 px on phones) and `logo-light.svg` in the dark footer
(the same file with the navy text white, the subtitle and the tooth's dark gradient stops light).
The favicon is the tooth alone (`assets/icons/favicon.svg`, square viewBox); the 32 px and
apple-touch PNGs were rendered from it in headless Chrome. The site palette was left as it was: its
accent `#6BAFC6` and ink `#263E49` already sit next to the logo's `#67B0C0` and dark `#233D49` (the
user changed the logo's navy `#01375E` to it on 2026-11-03; the light variant and icons were redone).
**Palette (2026-11-18, user's rule): only five colours, no derived shades** — White `#FFFFFF` (`--bg`, `--white`:
every section and card), Navy `#0C2C47` (`--ink`, `--ink-2`, `--muted`, `--faint`: all text; `--line`, `--line-2`: 1 px
card borders, which replace the old tinted section bands; the dark booking card, footer and the map mock), Yellow
`#F0AA2F` (`--accent`: buttons with Navy text, selected chips, hover borders, input borders, main roads on the map),
Mint `#ABC8C4` (`--tint`: icon circles, soft fills and hovers, tags, inactive carousel dots, the selected tooth fill —
added back because Yellow alone was too much), Orange `#BF512C` (`--accent-ink`: eyebrows and link hovers; errors, the
map pin, the header address pin, list bullets, the quote mark). Text on Navy is White. Alpha only for shadows,
masks and the tooth overlay. The logo (tooth: Navy → Mint), `logo-light.svg`, favicon
and its PNGs (re-rendered from `favicon.svg` in headless Chrome) follow it; `og-image.jpg` still has the old teal logo.
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

Nav "braces" (2026-11-19, user's idea and drawing, `Frame 7.svg` — the links looked like they hung in the air):
on the one-row header the links are chained by a wire at text height, with an orthodontic bracket (a 7-unit
rounded square with four tie-wing dots, drawn at 10 px) just before each label. It is all the link's `::before`,
36 px of wire (shortened 2026-11-19 at the user's request; the first link has a short fixed stub), centred in the
nav. At 1390–1500 px the full header row is tight, so the wire shrinks with `clamp(18px, 12vw − 140px, 36px)`
(the margin covers the scrollbar, which vw counts); without it the phone and CTA wrap to a second row. Mint for
the other links; the current section and hover turn the wire and wing dots Orange (`--accent-ink`),
the square stays Mint, as in the drawing. The bracket is an SVG data URI, so its colours repeat the tokens.
hover also turns the label Orange. Colour only, no movement (the user dislikes hover jumps). Hidden in the burger
menu. "Главная" (`#top`, the hero)
was added as the first link and to scroll-spy.

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

## Picker (tooth → symptom → hint)

- The tooth map is `assets/img/teeth.webp` (1536 × 1024) with 32 buttons positioned in % of that
  size. Each button has `pointer-events: none` and only its SVG outline path takes clicks, so
  neighbouring bounding boxes don't steal clicks.
- Numbering: data uses 1–32 (upper right → upper left → lower left → lower right, as the doctor
  sees the patient); labels show the number within the quadrant (`qn()`, 1–8). Wisdom teeth are
  1, 16, 17, 32 — only for them the "Мешает зуб мудрости" chip appears, and another symptom on a
  wisdom tooth adds a note about the surgeon.
- "Вопрос по всей челюсти" switches to the jaw symptom set (`symptomGroups.jaw`) and tints all teeth.
- The hint lists `recommend[symptom].svcs` (ticking adds them to the cart) and the doctors of
  `recommend[symptom].roles`; the picked doctor is moved to the top of the list.
- On a phone the steps bar shows only the current step's title.
- ≥ 1000 px the hint column is sticky and its card scrolls inside itself.

## About

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

## Services

- The six cards open a panel (the grid is hidden while it is open); the sticky bar switches
  categories. The list shows 6 services with "Показать ещё". The cards have no numbers or chevron
  buttons since 2026-11-18 (user's request).
- Every category head has the same height, so switching doesn't make the photo or "Все разделы" jump:
  the title keeps 2 lines (`min-height: 2.2em`, text at the bottom) and the description 3 lines
  (4 on ≤ 480 px) — the longest texts at each width; a longer text would grow the head again.
  Switching fades the photo, text and list in (`fadeIn`); closing the panel slides the grid back in.
- The panel body is a wizard, one step at a time (user's choice, 2026-11-17 — before it was services
  and doctors side by side, which left an empty column when a category has one doctor):
  1 Услуги (the list in two columns on desktop) → 2 Врач (horizontal doctor cards; a lone one spans
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
- Photos: `assets/img/services/<category>.webp` (1600 px) and `-800.webp`, from the images the user
  supplied on 2026-10-21 (same pictures and crops as the design). Cards: a 176 px strip that bleeds to the
  card edges and fades into the card; the `<img>` is lazy, so the six photos don't load with the page.
  The open category's dark head: the photo covers its right 66 % and fades in from its left edge
  (`--fade`, 24 % for "treat", 48 % for the rest); the per-category crops are in CSS
  (`.svc-panel__photo[data-cat=…]`). On phones the photo becomes a band above the text, which would
  otherwise sit on a bright part of the picture.

## Selected services (cart) and back-to-top

The cart pill appears once something is ticked; it closes its pop-up when the picker section reaches
mid-screen. Both floating buttons switch to a white version over dark backgrounds: `darkUnder()`
reads the background colour under the button's centre on scroll. Back-to-top shows after 900 px and
moves up while the cart is visible.

## Doctors

The VestMedServis staff was removed on 2026-11-03; the section came back the same day for Grevitident:
4 dentists (therapist, surgeon, orthodontist, orthopedist — the 4th was a "Врач-стоматолог" of unknown speciality until 2026-11-17) and
2 nurses, plus 2 administrators (role `admin`, added 2026-11-17; the section title became «Наша команда»). Since 2026-11-17 they have invented names (user's request, placeholders until the real ones)
and short specialities without «Стоматолог-» (`Терапевт`, `Хирург`…). Photos (2026-11-17, from the user, white background): `assets/img/doctors/<id>.webp`,
600×800 (3:4 crop of the source, cwebp -q 80); `mix-blend-mode: multiply` on a light tint box turns the white
background into the box colour, so nothing may be drawn under a photo. Clinic photos in the About collage:
`assets/img/clinic/` (building 1400 px wide with the address chip, reception and cabinet 900 px). Each `doctors` entry in `data.js` has `id` (doctors are picked by it,
since names may change), `name`, `spec`, `role` and `photo` (file in `assets/img/doctors/`, without
`.webp`). While `name` is empty a silhouette and the speciality stand in everywhere; fill the entries and
update the lead text in `index.html`.
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
side by side; under 760 px they stack.

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

## Booking

The summary shows the doctor and the reason (selected services, or tooth + symptom from the
picker). Validation as in the export: name — letters only, at least 2, rejects
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
