# Knowledge base

How the sections of the site work and why they are built that way: design decisions, browser
quirks, measurements. One section per component, in page order. Not deployed.

## Origin and fidelity

The page was designed in Claude Design and exported as a "bundler" file (commit `ffa5378`): a
template with `{{…}}` bindings, `sc-if`/`sc-for` tags and ~600 inline styles, rendered at runtime
by React from a `DCLogic` component. On 2026-10-20 it was rewritten as static HTML + CSS + JS:

- `index.html` — all static content; dynamic parts have empty containers that `main.js` fills.
- `assets/js/data.js` — the content the logic needs (clinics, service categories and texts, staff,
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

Small behaviour additions over the export: "Записаться" on a doctor card also picks that doctor
for the booking summary; footer service links open that category's panel.

## Fonts

Manrope (headings), Onest (text) and Playfair Display italic (only the motto in "О клинике").
Only the cyrillic and latin subsets are self-hosted (plus Onest "symbols" for ★ and ←); each file
is a variable font, so one `@font-face` per subset covers all weights. Licences: `assets/fonts/OFL.txt`.

## Header

Breakpoints, from wide to narrow:
- ≥ 1390 px — the export's layout: logo + clinic, nav, phone with hours, CTA, one row.
- < 1390 — the phone number and hours are visually hidden (still read by screen readers), only
  the round icon stays; that is what lets the row fit down to 1280.
- < 1280 — burger: `.hdr__menu` (nav + contacts) becomes a drop-down panel. On desktop it is
  `display: contents`, so its children stay flex items of the header row.
- < 640 — the clinic selector leaves the header; the menu shows its own clinic choice
  (`.hdr__clinics`).

`--hdr-h` is the header height at each breakpoint (82 / 74 / 70); sticky bars and
`scroll-margin-top` use it. Scroll-spy marks the nav link of the section crossing 140 px from the top.

## Hero

The photo bleeds to the right window edge: `.hero__media` has a negative right margin of
`(1320px − 100vw) / 2 − gutter`, and the image is a fixed 873 px wide, left-aligned, with a 334 px
top-left radius. Under 1128 px text and photo no longer fit side by side; the photo then goes full
width under the text (`object-position: 25%` keeps the doctor in frame; 18 % on phones).

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

The stats row bleeds 28 px to each side so the first number lines up with the text; that only fits
while the 1200 px column has side room, so below 1256 px it is 24 px, and below 900 px the stats are
a 2 × 2 grid.

## Services

- The six cards open a panel (the grid is hidden while it is open); the sticky bar switches
  categories. Lists show 6 services / 3 doctors with "Показать ещё".
- "Консультация специалистов" needs a specialist: its checkbox opens the row to choose one
  (therapist / orthopedist / surgeon / orthodontist), only one at a time. In diagnostics the
  doctor list follows the chosen consultation; without one it is just "Любой свободный врач"
  (X-rays are walk-in).
- Expanding rows animate `grid-template-rows: 0fr → 1fr`; the collapsed content also gets
  `visibility: hidden`, so links and buttons inside it are out of the tab order.
- **Photos are missing.** The export pointed at `/_blob/…` files that live only on Claude Design's
  server. The slots are ready: `.svc-card__photo` (176 px strip, fades into the card) and
  `.svc-panel__photo` (66 % of the dark panel head, needs a left-fading mask). Positions from the
  export for the panel photo: diag 70% 30%, treat 50% 62%, prost 75% 62%, aesthetic 50% 38%,
  surgery 50% 62%, ortho 45% 55%; the mask fade ends at 24 % for "treat", 48 % for the rest. On the
  cards the export forced `center`.

## Selected services (cart) and back-to-top

The cart pill appears once something is ticked; it closes its pop-up when the picker section reaches
mid-screen. Both floating buttons switch to a white version over dark backgrounds: `darkUnder()`
reads the background colour under the button's centre on scroll. Back-to-top shows after 900 px and
moves up while the cart is visible.

## Doctors

40 people from `data.js`; photos are dentall.by originals resized to 600 px WebP
(`assets/img/doctors/<surname>.webp`). Desktop/tablet: 4 per page with arrows and dots. Phone
(≤ 640 px): the whole tab is one horizontal scroll-snap row, no pages, no arrows. Only roles that
see patients (therapist, orthopedist, surgeon, orthodontist) get a "Записаться" link.

## Reviews

The four reviews published on dentall.by/reviews (checked 2026-10-21; there are no more), shortened
the way the design shortened the first three; the design's second page of Google placeholders was
removed (the user chose this). The row is a native scroll-snap strip: 3 cards in view on desktop,
2 below 900 px, one with a peek of the next on phones (swipe). The arrows and dots scroll it by one
card; the number of dots is computed from what fits, so adding a review needs only the HTML.

## Booking

The summary shows the chosen clinic, the reason (selected services, or tooth + symptom from the
picker) and the doctor. Validation as in the export: name — letters only, at least 2, rejects
keyboard mash; phone — Belarus `+375 (XX) XXX-XX-XX`, auto-formatted while typing, a leading 80 becomes
375. Errors show after the field was left or after a submit attempt; submit focuses the first bad field.

**Requests are not delivered anywhere yet** — submit only shows "Заявка отправлена". The delivery
(e.g. Web3Forms, as in Nitowska, or a Telegram bot) goes into the form's submit handler in `main.js`.

## Inner pages

Each page of the design project is exported from Claude Design separately ("html" zip: the
`*.dc.html` page, its runtime and an `assets/` folder with uploaded files). They share the home page's
`style.css`, fonts and icons; the header is the same markup with `hdr--sub` (a thin bottom line instead
of the scroll shadow), the address is a plain link to `index.html#clinics` (no clinic drop-down), and
nav links point to sections of `index.html`. `header.js` (the burger) runs on every page; each page
has its own small script. `tools/shot.sh -Page <file>` screenshots a page other than the home page.

## Documents page

Made from the design's "Документы" export on 2026-10-21; at 1440 px it matches the export except
the file sizes in the cards (the design quoted the 10–15 MB originals) and one line break.
- Cards: "Кратко о документе" opens a summary (one card at a time; closing scrolls the card back into
  view). "Скачать PDF" uses `download` with a readable Russian file name.
- Guarantee terms: four directions, all tables are in the HTML (`hidden` except the current one).
- Visit rules: six cards shown two at a time with dots; without JS all six show.
- The anchors `#doc-contract`, `#doc-rules`, `#doc-guar`, `#doc-comp`, `#guar`, `#rules` can be linked to.

## Blog page

Made from the design's "Блог и акции" export on 2026-10-21; at 1440 px the layout matches it.
- The design reads articles inside the page; here every article is in the HTML (`<article id="post-…"
  hidden>`) and the address hash picks one: `blog.html#klkt`, `#xray`, `#promo-ct`. So articles have
  their own links (the home page's news cards and the services' "Читать по теме" point at them), the
  browser's Back returns to the list, and the tab title becomes the article title.
- Pictures: the export pointed at `/_blob/…` files; they are the same three pictures as the home page's
  news cards (same posts, same crops), so those files are reused, plus 1200 px copies for the article
  image (`srcset`).
- Rubric tabs only list rubrics that have posts, with counts.
- "Статья на сайте клиники" links to the same article on dentall.by.

## Vacancies page

Made from the design's "Вакансии" export on 2026-10-21; at 1440 px it matches it (only the photo
re-encoding differs). The four positions and their terms are the design's text, not the live
vacancies from dentall.by (see open task 1 in `CLAUDE.md`). One position open at a time;
"Откликнуться" fills the position in the form. The CV field shows the chosen file's name.
The form uses the same checks as booking (`form.js`) and is not delivered anywhere yet either.

## Legal documents

`assets/docs/*.pdf` — public contract, internal rules, guarantees, possible complications (footer,
booking consent, documents page). Taken from the clinic's site dentall.by on 2026-10-21; they are
byte-identical to the files in the design's export. The originals are 300 dpi colour scans, ~40 MB in total; they were rebuilt page
by page to 4.6 MB: text pages as 200 dpi black-and-white (CCITT G4), the page with the stamp and
signature as a 150 dpi colour JPEG. If a document changes, take the new PDF from dentall.by and shrink
it the same way (pypdf + Pillow; a one-off script, not kept in the repo).
