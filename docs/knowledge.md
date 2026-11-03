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
accent `#6BAFC6` and ink `#263E49` already sit next to the logo's `#67B0C0` and navy.

The hero photo (AI-generated, from the design) had the VestMedServis logo on the coat; it was painted
out on 2026-11-03 (each column of the patch interpolated between the rows above and below, in a canvas,
re-encoded as WebP). `og-image.jpg` was rebuilt from an HTML layout with the new logo and address.

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
- The hint lists `recommend[symptom].svcs`; ticking adds them to the cart.
- On a phone the steps bar shows only the current step's title.
- ≥ 1000 px the hint column is sticky and its card scrolls inside itself.

## About

The stats row bleeds 28 px to each side so the first number lines up with the text; that only fits
while the 1200 px column has side room, so below 1256 px it is 24 px, and below 900 px the stats are
a 2 × 2 grid.

## Services

- The six cards open a panel (the grid is hidden while it is open); the sticky bar switches
  categories. The list shows 6 services with "Показать ещё".
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

The staff section, the doctor choice in the services panel and the picker's "Кто примет" list showed
VestMedServis staff and were removed on 2026-11-03 (in git history before that date). To bring them
back for the new clinic: a `doctors` list in `data.js` and roles per category and symptom.

## Contacts

One address (the export had two VestMedServis clinics with a switcher in the header, the menu, the
contacts and the booking summary; removed on 2026-11-03). The header address is a plain link to
`#clinics`. The contacts card puts the map (a static picture that opens Google Maps) and the address
side by side; under 760 px they stack.

## Reviews

The four VestMedServis reviews (a scroll-snap carousel) were removed on 2026-11-03; the markup, script and
styles are in git history before that date.

## Booking

The summary shows the reason (selected services, or tooth + symptom from the
picker). Validation as in the export: name — letters only, at least 2, rejects
keyboard mash; phone — Belarus `+375 (XX) XXX-XX-XX`, auto-formatted while typing, a leading 80 becomes
375. Errors show after the field was left or after a submit attempt; submit focuses the first bad field.

**Requests are not delivered anywhere yet** — submit only shows "Заявка отправлена". The delivery
(e.g. Web3Forms, as in Nitowska, or a Telegram bot) goes into the form's submit handler in `main.js`.

## Removed pages

The blog, documents and vacancies pages (with their scripts, the legal PDFs and the news block on the
home page) were built for VestMedServis and removed on 2026-11-03, when the site was switched to the
Grevitident clinic, which has no such content yet. They are in git history (before that date) if the
new clinic needs them back.
