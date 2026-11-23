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

The logo was first the user's `logo.svg` (tooth + «Гревитидент» + «стоматологическая клиника», text in outlines);
since 2026-11-20 it is text, see below. The footer is White with a
1 px Navy line on top (2026-11-19, user's choice); links underline in Orange on hover: it was Navy with a light logo and white text, then briefly
Mint; the user disliked two dark blocks in a row (booking card and footer) and then the Mint.
Until 2026-11-20 the favicon was that tooth alone (see "Icons and the link preview" below for the current one).
**Palette (2026-11-18, user's rule): only five colours, no derived shades** — White `#FFFFFF` (`--bg`, `--white`:
every section and card), Navy `#0C2C47` (`--ink`, `--ink-2`, `--muted`, `--faint`: all text; `--line`, `--line-2`: 1 px
card borders, which replace the old tinted section bands; the dark booking card and the map mock), Yellow
`#F0AA2F` (`--accent`: buttons with Navy text, selected chips, hover borders, input borders, main roads on the map),
Mint `#ABC8C4` (`--tint`: icon circles, soft fills and hovers, tags, inactive carousel dots, the selected tooth fill —
added back because Yellow alone was too much), Orange `#BF512C` (`--accent-ink`: eyebrows and link hovers; errors, the
map pin, the header address pin, list bullets, the quote mark). Text on Navy is White. Alpha only for shadows,
masks and the tooth overlay.
**The logo is text** (2026-11-20, user's pick «прописными, с жёлтой точкой» from a comparison of six variants,
after the switch to Nunito made the Arsenal lettering look foreign): `<a class="logo">` with «Гревитидент» in Nunito
900, capitals, letter-spacing .1em, and a Yellow dot after it (`::after`), and «стоматологическая клиника» under it in
Nunito Sans 600 Navy, capitals (the dot is the only colour: the user chose «Спокойный» from a second set of
nine dot variants the same day; first the line was Orange, which with Yellow and Navy looked busy). The two letter-spacings are tuned so both lines are the same width (225 px at the
header's 25 px; everything scales with `--s`: 25 px header, 21 px on phones, footer `min(28px, 11cqi)` so it shrinks
to its grid column, which is 220 px around 1024). No tooth in the header (the user's earlier wish not to overload it).
Before: Arsenal outlined in `logo-wordmark.svg` (header) and `logo.svg` (tooth + name, footer), with `logo-light.svg`
unused — all removed, in git history before this date.
**Icons and the link preview follow the logo** (same day): `favicon.svg` is the logo's dot made big — a Yellow
circle with the old logo's tooth in Navy (its four paths, with a 5-unit Navy stroke so it still reads at 16 px).
The user picked it from six variants; a White «Г» with the dot came first, dropped the same day because «Г.» reads
as an abbreviation («г.» = город, and a rude word). `favicon-32.png` (round, transparent) and
`apple-touch-icon.png` (180 px, full Yellow square — iOS rounds it) were rendered from it at 512 px in headless Chrome
and downscaled with System.Drawing. `og-image.jpg` (1200×630) was rebuilt from an HTML layout: the text logo,
«Стоматология в Бресте», the hero title, the hero photo with a 200 px rounded corner, and the address the site shows
(«Брест, ул. Липовая 18, офис 4»; the old preview still had ул. Воровского). Their URLs carry `?v=N` (icons 3,
preview 2): messengers and
browsers cache icons and previews for a long time — bump it when they change again.
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

Nunito (headings, `--f-head`), Nunito Sans (text, `--f-body`), Amatic SC Bold (`--f-hand`, only the hero motto on
phones, see Hero) and Playfair Display italic (only the motto in
"О клинике"). Chosen 2026-11-20 by the user from a side-by-side comparison of free Cyrillic Google Fonts (Nunito
liked; of «Nunito везде», «Nunito + Golos Text» and «Nunito + Nunito Sans» the last: the same rounded family, but
the small text — service descriptions, stories, the form — stays crisp; Golos is wider and would have broken the
tight line counts). Before: Manrope + Onest (in git history).
Only the cyrillic and latin subsets are self-hosted; each file is a variable font (Nunito 400–900, Nunito Sans
400–700), so one `@font-face` per subset covers all weights. The site's text has no characters outside those
subsets (checked: the only arrow is in code comments). Nunito is lighter than Manrope at the same weight, so the
heading-font rules that were 600 are 700. For a softer look everywhere, set `--f-body` to Nunito too.
Licences: `assets/fonts/OFL.txt`.

**Type scale** (2026-11-23, after a reviewer counted 203 font-size declarations with 19 values, 14/15 and 22/23/24 px
side by side): every size is a `:root` token — `--fs-xs` 12 · `--fs-s` 13 · `--fs-m` 15 · `--fs-l` 17 · `--fs-xl` 20 ·
`--fs-2xl` 24 · `--fs-3xl` 32 · `--fs-4xl` 44 · `--fs-5xl` 78 (the reviewer's 13…78 plus 12 for badges and caps that
don't fit at 13); the fluid headings clamp between tokens. The user asked to keep the look, so each old size went to
the nearest token (11–12 → 12, 14 → 15, 16 → 15 for buttons and UI but 17 for reading text and the form input — iOS
zooms into inputs under 16 px — 18 → 17, 19–21 → 20, 22–28 → 24, 30 → 32), then line wraps were compared before/after
for every text element (page, Services steps 1–3, the helper; 1440 / 1024 / 390) and fixed where the layout depends
on them: the hero lead got 548 px instead of 520 (2 lines as before), the cookie text is 13 px (the banner stays its
size), FAQ answers on phones 15 px. Longer texts in «Подробнее» may take a line more — accepted. Exceptions, named in
the `:root` comment: tooth numbers 10 px (17 px circles), the doctor initials placeholder 56 px, the About title up to
52 px, the finder title up to 40 px (at 44 px «Не знаете, к какому врачу?» wraps). A new rule uses a token.

## Entrance motion

Added 2026-11-23 (user: «плавно появляющиеся по очереди, как будто с левой стороны… плавное появление разделов, но
без фанатизма, профессионально»): on opening the page the three hero cards come in one after another
(`factIn` + `factFade`). First from the left (28 px and a fade, 0.7 s); made slower and softer the same day (user: even
smoother, one after another from the upper left). A first try (1.5 s on a steep `cubic-bezier(.16, 1, .3, 1)` plus a
6 px blur coming into focus) "jumped a lot" in a real browser although the measured path was smooth: an animated blur
is repainted every frame and the text re-rasterises when the layer goes away, and the steep start reads as a lurch. Now:
transform + opacity only, `will-change` keeps the cards on their own layer, 22 px left / 16 px up on an ease-out without a steep
start (`cubic-bezier(.25, .46, .45, .94)`); first 1.2 s, then a little faster at the user's request: 0.9 s, delays
0.15 / 0.3 / 0.45 s. Don't put a filter
into this animation again. On phones the card row clips (it scrolls sideways), so it has 18 px of top padding, taken
back by a negative margin. The sections below the first screen (About, Finder,
Services, Doctors, Contacts, FAQ; not the booking card, see below) come up 18 px with a fade the first time they scroll into view
(`.reveal` → `.is-in`, an IntersectionObserver in `main.js`, 0.8 s). None with reduced motion; without
IntersectionObserver nothing is hidden. `tools/shot.html` forces `.reveal` visible, or shots of lower sections would
come out blank.

Fixed the same day (user: the site jumps on reload): main.js used to add `.reveal` itself, after the first paint, so
sections already visible faded out and slid down 18 px about 0.2 s after load, then came back when observed; on a
reload mid-page the whole screen did it. Now the blocks carry `class="reveal"` in the markup and a one-line script in
the `<head>` sets `html.reveal-on` before the first paint (only with IntersectionObserver and without reduced motion);
the CSS hides `.reveal-on .reveal:not(.is-in)`. The observer runs first in main.js, so an error further down can't
leave the sections hidden. Blocks already on screen at load get `.is-now`: a 0.5 s fade after 0.15 s, no shift (on a
phone the services and doctors still settle by ~50 px while main.js builds them; the delay keeps that invisible).
Found with a CDP trace of a real reload (per-frame positions and opacity), which the harness can't show: it turns
animations off.

The booking card was taken out of it the same day (user: the form shakes when, after choosing services in Services,
you scroll down to it): the whole 1170 px form faded in sliding 18 px while the page was still scrolling, and at that
very moment the corner «Ваша запись» vanished in one frame while back-to-top glided down. The form is a working area,
it just stands; the corner booking now fades out (`.bk.is-away`, 0.2 s) instead of `hidden`.

The FAQ invites a click on hover (mouse only): a closed question gets a Yellow outline and a soft shadow, its text
turns Orange, the circle Yellow and its arrow dips 2 px; nothing moves or changes size (the user dislikes hover jumps).

## Slow connections

A picture still on its way shimmers in its place (2026-11-22, user asked for a skeleton or a tooth spinner; the
skeleton, since the text and buttons are there at once and only pictures lag): `main.js` gives every `<img>` that
isn't `complete` the class `.is-loading` (a MutationObserver catches the ones added later) and takes it off on
`load`/`error` (capture listeners); `img.is-loading` has a Mint gradient moving across (`shimmer`), in the picture's
own box, radius and crop. A class only while loading, so a loaded picture's markup is unchanged and `mount()` still
matches unchanged booking groups. A tooth spinner is kept in mind for «Отправить заявку» once requests are really sent.
Tooltips (2026-11-23, user: «тултип в цвет сайта, как в навигаторе»): a name cut with «…» (`[data-tip]`: the booking's
service chips, the doctor's services list) shows whole in `.tip` — the nav capsule's soft Mint, Navy text, small
(12 px) — next to the mouse pointer and following it (user, the same day: the first version stood over the chip with a
caret and covered the name), or under the element on keyboard focus; only when the name is really cut. It replaced
the browser's grey `title` tooltip; touch screens have none (no hover).

## Touch screens

Phones have no hover — only taps, long presses and swipes (user, 2026-11-20). Every `:hover` rule sits in
`@media (hover: hover)` (on the same line, in its component's place), otherwise a tapped card stays lifted and
outlined until the next tap. Instead, `@media (hover: none)` at the end of "Shared" gives a press-in on `:active`
(`scale: .97`, or `.9` for small round buttons, `opacity .7` for text links; `scale` and not `transform`, because
entrance animations with `fill: both` on `transform` would win), turns off the grey tap flash and keeps a long press
from selecting button text or opening the iOS callout. iOS applies `:active` only when the page has a `touchstart`
listener — `main.js` adds an empty passive one. New hover effects go into `@media (hover: hover)` too; nothing may
be reachable by hover only.


Touch targets (2026-11-22, site review): small controls answer a bigger finger area without changing their look
(`@media (pointer: coarse)`, a transparent `::after` around them or padding offset by a negative margin): the ✕
buttons of the booking lists, a doctor card's «Подробнее» and «Записаться», the footer links.

Landscape on phones: on 2026-11-22 a «Поверните телефон» cover for phones held sideways was added at the user's
Centring in circles (2026-11-23, user: «выровняй все цифры в кружочках», «криво стоят стрелочки», «не ровный крестик»):every number in a circle is centred by its own height, `text-box: trim-both cap alphabetic` on a block around it(the helper's steps, the Services step numbers `.wiz__n`, the corner count `.bk__n`, «+N», the tooth numbers), not bythe font's uneven line box. The down and up chevrons (`i-chev`, `i-chev-row`, `i-chev-up`) are drawn 0.6 units offcentre towards their point, an optical correction: a «v» looks high when centred exactly (`i-prev`/`i-next` alreadyhad one). The ✕ of a doctor card and of the services list are 16 px in their 32 px circles, an offset of 8 that stayson whole pixels at 125 % and 150 % (14 px gave 9, blurred off-centre on Windows at 125 %).
request and removed the same evening («убери функцию ориентации полностью»); it is in git history (`.rotate`).
Round buttons in a rounded corner sit concentric with it (2026-11-22, user: «все элементы в кружочках выравниваем,сейчас криво»): the circle's centre on the corner's arc centre, so the gap to the edge is even all round — offset =inner corner radius − button radius. The doctor panel's ✕: 36 px, 8.5 px in from the 28 px corner (1.5 px border);on phones 32 px, concentric with the photo band's 20 px corner (16 px in). The helper's ✕: 10 px in from the dialog's32 px corner. (At 16 px they ran into the curve.) The icons inside every circle were measured centred (< 0.6 px).

## Keyboard and screen readers (2026-11-22, site review)

- The focus ring is Navy, 3 px, 2 px off the element, with a 2 px white ring under it (`box-shadow`) that keeps it
  visible on Navy too. It was Yellow: 2 : 1 on white and invisible on the Yellow buttons. The carousel's inactive dots
  are white with a Navy outline (Mint on white was 1.8 : 1).
- «Перейти к содержимому» (`.skip`) is the first Tab stop, shown only while focused; it goes to `<main id="main">`.
- When a script takes away the focused button, the focus goes somewhere sensible: opening or switching a section →
  its name (`.svc-panel__name`); «Все разделы» → the «Услуги» title; sending → «Заявка отправлена» (both
  confirmations are `role="status"`); «Записаться ещё раз» → step 1's heading; a ✕ in a booking list → the next ✕,
  else «Добавить услугу». These targets have `tabindex="-1"`, and `[tabindex="-1"]:focus` has no outline.
- The folded doctor panel is `inert`, so Tab no longer lands on its hidden buttons.

## Header

Breakpoints, from wide to narrow:
- ≥ 1390 px — the export's layout: logo + address, nav, phone with hours, CTA, one row.
- < 1390 — the phone number and hours are visually hidden (still read by screen readers), only
  the round icon stays; that is what lets the row fit down to 1280.
- < 1280 — burger: `.hdr__menu` (nav + contacts) becomes a drop-down card (since 2026-11-20, user: «у нас же закругления везде»;
  before, a full-width straight panel with ruled rows): 28 px corners, 8 px under the header, full width minus the
  gutters on phones and 420 px at the right on tablets; the links in the desktop nav's soft capsule, the current one
  a white pill with Orange text. On desktop it is
  `display: contents`, so its children stay flex items of the header row.
- < 640 — the address leaves the header (the menu's "Контакты" leads to it). The burger is 44 px there and the
  logo `--s: 22px` (2026-11-20, user: «выровняй лого и значок бургера» — both were centred, but the 48 px circle
  outweighed the 29 px logo); header padding 13 px keeps `--hdr-h` at 70. Under 360 px the logo is 19 px (at 320 its
  dot and «КЛИНИКА» went under the burger), and in the helper the current step's title ends in «…» instead of running
  under the close button.

`--hdr-h` is the header height at each breakpoint (82 / 74 / 70); sticky bars and
`scroll-margin-top` use it. The desktop nav capsule is 50 px, as the CTA (padding 5 px round links with 7 px of vertical
padding and line-height 1.5; a 3 px padding, used for a day, left the current pill touching the capsule's edge — user:
«разное расстояние между формой и кнопкой»): at 54 px
it made the header 86, so the services bar stuck 6 px under it instead of 10 (fixed 2026-11-22).
Laptops 1280–1389 px with a mouse (2026-11-22, site review): the phone is only its icon there and `header.js` takes
the `tel:` link off, so the icon did nothing; now it is focusable (`tabindex`, set by `header.js` for that range
only) and pointing at it, clicking or Tab drops a card under it with «Запись на приём» and both numbers (the second
number, `.hdr__phone-num--2`, shows only there).
The phone icon circles (`.hdr__phone-ic`, and `.hdr__call` in the burger header) take the nav capsule's soft Mint
(Mint mixed 35 % into White) since 2026-11-22, user's request; before, the full Mint.
The burger menu at 640–1279 px now has the phone and «Записаться» under the links, as on phones (they were hidden
there since the export). Opening the menu moves the focus to its first link (the menu comes before the burger in
the markup, so Tab skipped it); Escape returns the focus to the burger.
Scroll-spy marks the nav link of the section crossing 140 px from the top; blocks with
no link of their own light the nearest one (`SPY` in `main.js`, 2026-11-22): the helper's Finder «О клинике», the FAQ
and the booking form «Контакты».
In-page links glide instead of jumping (2026-11-22, user: «красивый скрол» for the nav): a click on any
`a[href^="#"]` (the nav, the logo, «Записаться», the hero buttons, the footer) runs `glideTo` — the back-to-top ease,
500 ms plus 1 ms per 8 px, at most 1.2 s — to where the browser's jump would stop (the target's `scroll-margin-top`),
after the `data-act` actions, which may have handled the click (the footer's service links). The skip link keeps its
jump (it has to move the focus). Links and images can't be dragged (`dragstart` in `header.js`, user: a button
dragged into another window opened there as a link).
A nav jump stops with the section title 28 px under the header (user's request, 2026-11-18): sections have
`scroll-margin-top: calc(var(--hdr-h) - var(--sec-y) + 28px)`, a negative-ish margin that skips the top padding.

Nav capsule (2026-11-19). Earlier the same day the links were chained by "braces" (the user's `Frame 7.svg`: a
wire with an orthodontic bracket before each label, in git history); the user then dropped them and asked for the
nav itself to stand out at once. Now the links sit in a soft capsule (Mint mixed 35 % into White) as pills; the
current section is a White pill with a light shadow and Orange text, hover gives a half-white pill and Orange text.
No movement (the user dislikes hover jumps). In the burger menu it is a plain list again. "Главная" (`#top`, the
hero) is the first link and is in scroll-spy; it and the logo go to the very top of the page (`#top` has
`scroll-margin-top: 100vh`, which clamps to 0; the shared section margin had stopped it short of the top).

Phone numbers (2026-11-18, user's request): on a computer a `tel:` link opens Skype or a similar app, so
`header.js` removes the `href` from every `a[href^="tel:"]` unless the pointer is coarse (phones, tablets)
and adds `.tel-text`; such an `<a>` is styled as plain text, and `.hdr__call` (the round phone button of
the burger header) is hidden without its link.

## Hero

The photo's right edge lines up with the header's "Записаться" button (2026-11-19, user's request; before that
it bled to the window edge, which the user disliked): `.hero` is an inline-size container and `.hero__media` gets a
negative right margin of `min(660px, 50cqw − gutter) − min(720px, 50cqw − gutter)` — the header content is
1440 px max, the hero's 1320. Above 640 px its shape is a "leaf" from the user's `Rectangle 1.png` (1907 × 1697):
big rounding top-left and bottom-right, 32 px elsewhere (`44% 32px / 50% 32px`). **On phones it is an arch**
(2026-11-20, user: «сделай просто аркой»; on 2026-11-22 the arch was kept for phones only and the leaf returned
above, user: «в вебе верни как прежде»): only the dome, the bottom fades. The dome is `999px 999px 0 0`, which the
browser shrinks to half the width, so it is a true semicircle; the earlier `50% / 46%` made a flattened ellipse on
the wide, short phone photo (user: «не растягивай»). The doctor stands at 31 % of the picture's width; `object-position: 0%` brings the doctor nearest the
middle of the arch. Under 1128 px text and photo no longer fit side by side; the photo then goes full
width under the text (`object-position: 25%`), same leaf. **On phones (≤ 640) the photo comes first** (`order: -1`,
310 px high, `object-position: 0% 18%` keeps the doctor nearest the middle of the dome; 2026-11-20, user: the photo had «улетела вниз» and
the first screen looked empty — now it is the doctor, the title, the lead and both buttons, which share one row
≤ 480 px without the arrow, 15 px text ≤ 374). The three fact cards are one swipeable row there (scroll-snap, 82 %
wide so the next one peeks in, no scrollbar, and no hover shadow: the row clips it into a hard line, seen in the
desktop preview with a mouse) to shorten the page. The same day, so the buttons fit on the first
screen (user: «текст наложим на фото чуть»), the photo's lower part fades to white (a mask: opaque to 45 %, 15 % at
78 %, gone at 92 %) and the text starts 96 px up on it — the eyebrow and title sit on the faded part; buttons end
at ~630 px on a 390 px phone. There the arch keeps only its dome: rounded bottom corners would show through the fade
as a faint line, as the leaf's bottom-right curve did. The text under the arch is centred on its axis (user: «текст по середине
фото»).

The fact cards span the same width as the text column plus the photo: from the text's left edge to the photo's
right edge (the header CTA), with the same `cqw` margins as `.hero__media` (2026-11-19, user's request). On hover
(`@media (hover: hover)` only) only a deeper shadow appears — no colour, which the user reads as an active button,
and no movement. The icon sits beside the title and the text runs the full card width below it (2026-11-19, user:
the braces card wrapped to three lines), so all three texts take two lines at ≥ 1280 px and the cards are level.
At 641–1000 px the three cards are one row (2026-11-22; before, two and one), with the icon above the title:
beside it «Протезирование» didn't fit a third of a tablet.

Hand-lettered motto (2026-11-23, user: «Amatic SC … сбоку фото, не перекрывая лицо девушки … не перегрузить»): up
to 480 px the eyebrow «Здоровые улыбки — счастливые люди» leaves the text column and sits on the photo, on the light
wall right of the doctor's head, over the arch's edge (half on the photo, half on white; user, same day), in Amatic SC Bold (`--f-hand`, self-hosted, bold only), 24 px, four short lines,
Terracotta, tilted −6°, with a soft white halo; it fades in. The title keeps its place (the column's negative margin
is 35 px smaller). From 481 px the photo's crop puts the lamp and instruments there, so the plain eyebrow stays.

## Finder (the helper's mini section)

The user calls the helper the site's signature feature, so on 2026-11-19 its call-out moved out of the Services
head into a section of its own, right before Services. Tried and dropped the same day: a big card with the colour
jaw photo (too eye-catching), a three-step demo (too tall), a slim band with a breathing, shining Yellow button
(«like a garage advert»), a calm slim band with a Navy button, a line drawing of the teeth with clickable teeth
(no clicking on single teeth, user's wish), a «Подобрать врача» button on the left, the button in the gap between
the jaws, and a «Начать →» circle following the pointer.

Now: «Помощник», «Не знаете, к какому врачу?» and a lead on the left; on the right the user's own picture
(«Elegancki uśmiech z naturalnym różem dziąseł», 2026-11-19; before it was the helper's jaw photo clipped to the
teeth in black and white): gums and teeth only, in colour, background cut out to transparency — `assets/img/smile.webp`
(960 px wide, ~40 KB). The cut was a flood fill from the picture's edges over light, unsaturated pixels (the grey
background and the shadow under the jaw); the teeth are white too but sit inside the pink gums, so the fill never
reaches them; the gums' soft edge keeps a partial alpha and the mask got a 2 px blur. It was made once with a
throwaway C# snippet in PowerShell (System.Drawing), then cwebp. On top: the only button, a Yellow 56 px «Выбрать
зуб», in the top right corner, and a pulsing Mint dot with a Navy rim 10 px under its middle (tied to the button,
not a tooth, so it is in the same place at every width; centred under it since the user asked). The whole picture and the button (`finder-open`) open the
helper on its first step, the tooth map. Below 900 px the picture goes above the text. The section has no top
padding: About's bottom padding is the gap.

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
  in the left column only show progress — moving is by Назад / Далее alone (user's request). On desktop (≥ 900) the
  three steps spread down the column (2026-11-22, user: the lower half stood empty; «ничего не скакало»; «выровняй по
  окошку справа»): `alignSteps()` measures the right pane on opening and on resize (not per step, or they would move
  with the head's height) — the first circle's top meets the right box's top (at least 28 px under the title), the last
  step ends 16 px above the buttons' bar; the first two
  take equal shares and the last a fixed 84 px, so an answer appearing under a title moves nothing. The digits are
  centred by their own height (`text-box: trim-both cap alphabetic`), not the font's uneven line box. Choosing a tooth only selects it; «По всей челюсти» and «Не знаю,
  какой зуб» are answers themselves and go straight to step 2. The doctor shows in the left column only once
  step 3 is open, so it isn't given away while choosing the symptom.
- Step 3: the heading and lead are the symptom's title and text; then «Вам к врачу» — the roles of
  `recommend[symptom].roles` (the therapist when it has none) with those doctors' cards — a 3:4 portrait, name,
  specialty and experience, as in the team section (user's request: a bigger photo to fill the step); with a single
  doctor «Как пройдёт первый приём» (three points from the clinic's promises) fills the right half — and under it the
  direction and `svcs` as a plain list (a link to the category in Services was removed at the user's request).
  With two or more doctors the cards are a choice (user's request): a tick and a Navy outline on the chosen one
  (`state.hDoc`, `helperDoc()`); «Записаться» stays disabled until then, a lone doctor counts as chosen.
  «Записаться» closes the dialog, adds the chosen doctor to the booking (without services, see "Booking by
  doctor") and scrolls to the form. The helper always books one doctor. The site's scroll uses requestAnimationFrame, which never fires in the
  headless shot harness — to check such a jump there, replace it with a timer in `-Do`.
- The jaw is sized by the dialog's height (`.jaw__frame` max-width from `100dvh`), so step 1 fits without
  scrolling on a laptop; its min-width keeps the side labels inside.
- No step scrolls on a laptop (user, 2026-11-19): below 860 px of height the head, the bar, the jaw and the
  doctor photos get tighter, and below 720 px tighter still (no experience line, a smaller first-visit list);
  checked down to 680 px in all steps. Only shorter screens still scroll the step body. A wisdom tooth with another
  symptom adds the surgeon note, which overflowed step 3 by up to 63 px (found 2026-11-22); with the note
  (`.hint:has(.hint__note)`, ≥ 900 px wide) the note, the answer, the first-visit list and the photos are tighter
  (64 / 56 / 48 px photos by height), and below 720 px the direction row goes. Checked: every symptom on tooth 1,
  1440 and 1366 wide, 900 / 860 / 768 / 680 high, 0 px of scroll.
- The helper starts from a clean sheet every time it opens (`finder-open`, 2026-11-22: it reopened on step 1 with
  the old answer in the left column). A doctor picked on step 3 is dropped when the tooth or the symptom changes
  (`hDoc`), or another answer came back with that doctor already chosen.
- The tooth map is lazy inside the closed dialog, so the first open showed an empty box for a moment; it starts
  loading (`loading = 'eager'`) once the Finder is within 400 px of the screen or «Выбрать зуб» is pointed at.
- Below 900 px the dialog is full-screen, the steps go in a row on top and only the current one keeps its title;
  the disclaimer then moves from the left column into step 3.
- Phones (≤ 640 px, 2026-11-20, user: «помощник давай попробуем сделать без скрола»): no step scrolls at 390×700
  (an iPhone with Safari's bars) nor at 360×640, checked with the worst case — a wisdom tooth (adds the note) and a
  symptom with two doctors. The dialog title is visually hidden (it still names the dialog and takes the focus), so
  the step row shares the top line with the close button; «Шаг N из 3», the lead of steps 1–2 (`.helper[data-step]`,
  set in `renderPicker`), step 2's title (the step row says it) and the status line above the buttons go; step 1's two
  ways out share a row and the mirror note goes (the side labels say it); smaller chips; on step 3 40 px photos, no
  experience line, the likely services in a run. Back and Next stay in one row. Shorter still (≤ 680 px high) the
  chips lose their group captions and step 3 its direction row and disclaimer.
- The tooth map is `assets/img/teeth.webp` (1536 × 1024) with 32 buttons positioned in % of that
  size. Its gums were recoloured on 2026-11-19 to the softer, warmer pink of the Finder's smile picture (user's
  request): only pink and light pixels (the teeth are not pink, the tongue and mouth are dark) got lighter (HSL L
  +28 % of the way to white), a little more saturated and ~5° warmer; same size and alpha, so the outlines still fit;
  linked as `teeth.webp?v=2` to beat the cache. The original is in git history.
  Each button has `pointer-events: none` and only its SVG outline path takes clicks, so
  neighbouring bounding boxes don't steal clicks.
- Numbering: data uses 1–32 (upper right → upper left → lower left → lower right, as the doctor
  sees the patient); labels show the number within the quadrant (`qn()`, 1–8). Wisdom teeth are
  1, 16, 17, 32 — only for them the "Мешает зуб мудрости" chip appears, and another symptom on a
  wisdom tooth adds a note about the surgeon.
- "По всей челюсти" switches to the jaw symptom set (`symptomGroups.jaw`) and tints all teeth.
- Zoom on phones (2026-11-23, user: «сложно нажать на восьмёрки»): the map is ~332 px wide there and the molars
  are 22–30 px, smaller than a finger. Below 641 px a tap on a molar (6–8 in its quadrant) doesn't pick it: the map
  zooms ×2 into that side (`.is-zoom-r` / `.is-zoom-l`, a transform inside the clipping `.jaw__view`; the middle half
  of the height stays in view, where all the molars are), the molars become 45–80 px, and every tap then picks a
  tooth. «Вся схема» in the sides row (in place of the other side's label; the row is always 30 px tall, so nothing
  moves) zooms out; closing the helper or growing past 640 px resets it. Front teeth are ~40 px and are picked at
  once. Chosen over a loupe under the finger (hold and drag), which the user was also offered.

## About

The title is three fixed lines, «Лечим так, / чтобы вы понимали / каждый шаг» (2026-11-19, user's request:
it used to break between «чтобы» and «вы»; two lines do not fit the column at the title size).
Two columns from 1000 px: text (title, lead, the three promises in a column, the motto pinned to the
bottom) and a photo collage that stretches to the text's height: one large tile (with the address
chip) and two small ones. Below 1000 px one column: the collage goes between the lead and the
promises, which line up in a row again (three in a row at 641–1000 px since 2026-11-22; before, two and one). On phones (≤ 640, 2026-11-20, user: «сокращаем либо делаем кнопки,
чтобы можно было развернуть») only the three headings show, each a button with the FAQ's Mint chevron that opens
its text (grid rows 0fr → 1fr): 450 → 285 px. Wider, `syncPromises()` disables those buttons, so they are plain text
and the texts always show. The tiles are placeholders («Кабинет», «Холл», «Оборудование»,
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
- The tab bar is always there on desktop and tablets (since 2026-11-22, user: «навигацию оставим в услугах, чтобы
  оно нормально функционировало»): it has its own box above the grid (`#svc-bar-box`, `barHTML()`), with «Все разделы»
  chosen while the cards show. Opening a section puts its panel in the grid's place under the bar and lines the bar
  up under the header (`barShift()`); «Все разделы» puts the cards back under the bar, which stays where it is
  (scrolled down into the much taller panel, the page is set back before the first frame, so the grid starts right
  under the stuck bar) and then glides so the bar and the cards stand in the middle of the room under the header
  (user: «центрировать при выходе во все разделы на навигации»; taller than the room, the bar where it sticks).
  History: from 2026-11-19 the cards flew up into the tabs of a bar that existed only with a
  section open, and on 2026-11-22 the tabs flew back into the cards; the user found the way back flickering and
  jumpy, and chose the permanent bar with no flight (in git history: `flyToTabs`, `flyToCards`). Phones keep the bar
  only with a section open (their grid is a list of rows already); there «Все разделы» glides back to the Services
  title. The tab bar is a floating capsule (rounded, 1 px Navy border),
  sticky 10 px under the header (user: the straight full-width bar looked out of place). The tabs grow to fill it
  (`flex: 1 0 auto`), so there is no empty end on the right; where they don't fit they scroll. The scrolling row has
  2 px of room on every side (`padding: 2px; margin: -2px`): on a Windows screen scaled to 125 % the chips' top and
  bottom borders fell a fraction of a pixel outside it and were clipped (user's screenshot, 2026-11-19).
  While the bar is stuck it carries the shadow and the header drops its own (it would darken the capsule).
  «Stuck» means sitting exactly at its CSS sticky `top` (`updateFloating`): until 2026-11-19 it was «above the
  header's bottom + 11 px», which stayed true after Services scrolled away with a section open, so the header lost
  its shadow in every section below (user's report).
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
  the width) → 3 Проверка (one card with rows, label left / value right: «Врачи и услуги» — the whole booking by
  doctor, every section included (see "Booking by doctor"), with «+ Добавить ещё услугу» under it) →
  contacts: name, phone, optional e-mail; "Отправить заявку" (a `form="svc-form"` button in the nav)
  sends from the panel itself, without going to the booking form (user's request, 2026-11-17). Same
  validation as the booking form (`SiteForm.bind`, which also checks an `email` field if the form has one);
  both forms share `state.sent`; once sent, step 3 shows only the confirmation (no entered data,
  heading, consent or buttons). The step was called "Проверка", now "Запись". `state.svcStep`; the step bar on top is clickable,
  "Назад / Далее" below. Opening or switching a category resets it to step 1. Going to another step
  scrolls back to the step bar only if it is above the screen. With anything booked, on steps 1–2 step 3 calls
  (2026-11-23, user: «над 3 шагом пусть мигает и с подписью „ваша запись“»): its circle pulses Yellow and a Yellow
  «Ваша запись» (no number, the user's choice) stands above it, its left edge on the circle's left edge (phones: on
  the item's right edge, aligned with the circle it stuck 37 px out of the steps bar at 390); gone on step 3 and with an empty booking.
- "Консультация специалистов" needs a specialist: its checkbox opens the row to choose one
  (therapist / orthopedist / surgeon / orthodontist), only one at a time. The row's name stays «Консультация
  специалистов» (until 2026-11-22 it added « · ортопед»; user: the chosen chip already says it).
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
- Phones (≤ 640, 2026-11-20, user: «разделы нужно как-то уменьшить, чтобы было удобно выбрать сразу, без скрола»,
  «тексты скрываем»): the six sections are rows — a 76 × 64 photo at the side, the name, a chevron — with the
  descriptions hidden (1660 → 532 px, about one screen). The open section's head is a 150 px photo band with the
  name and the count over its faded part (493 → 218 px); its «Все разделы» and description are hidden (the bar
  above has «Все разделы»). The panel nav puts «Выбрано N» and «Сбросить всё» in one row, the buttons under it.
  While the open panel fills the bottom of the screen the corner «Ваша запись» and back-to-top buttons hide
  (`panelAtBottom()`): on phones they covered «Выбрать врача» / «Далее».
  With a section open, the sections hide behind **one button** on phones (same day: first a side rail of photo
  tiles beside the panel, which the user asked for and then replaced with «кнопку открыть разделы»): the sticky bar
  is `.svc-bar__toggle` «Разделы · <current section>» with a chevron; a tap (`state.barOpen`) drops the list down
  over the panel (fade + 8 px slide; a bar not yet stuck is first glided up to where it sticks, or at 360×640 the list
  opened below the screen): «Все разделы» and the six sections, each with its 44 px photo (`.svc-bar__ph`,
  hidden wider). Choosing one, a tap outside or Esc closes it. The long tab names in `data.js` carry soft hyphens
  (U+00AD, invisible in the editor — added for the rail; harmless in the chips and the list).
  **No jumps** (user: «не очень нравится скакание … не будем централизировать … плавные переходы»): on phones
  opening a section leaves the page where it is (the panel takes the list's place; no flying cards, no lining the
  bar up under the header), and opening or switching glides (`revealPanel()`, `glideTo`) only when the panel's top
  is above the screen, so it starts under the bar; «Все разделы» glides back to the title. Desktop keeps the flying
  tabs and the line-up.
- The footer's service links (2026-11-22, site review): they opened the section 3–4 thousand px up and left the page
  where it was (the line-up only scrolled down, and `preventDefault` stopped the `#services` jump). The line-up is
  now `barShift()`, measured from the services head, which the bar always follows: positive or negative, so the
  page also scrolls up — from the footer, and on desktop when a card low in a scrolled grid hid the section's head
  under the stuck bar. The cards fly only when the grid is on screen. On phones `revealPanel()` glides there too
  when the panel is off the screen.
- Tablets (2026-11-22): the tabs scroll sideways with a hidden scrollbar; the chosen one is scrolled into view
  (`showTab`), and an edge with more tabs behind it fades (`.fade-l` / `.fade-r`, a mask; `tabsFade`).

## Booking by doctor (2026-11-20)

Until then the whole booking had one doctor (`docPick`): ticking caries in «Лечение зубов» and then an extraction in
«Хирургия» silently switched the doctor to the surgeon, so the caries went to the surgeon too. The user chose
«свой врач на раздел»: one request, inside it the services grouped by doctor.
- `state.picks[cat id]` — each section's doctor (step 2; set automatically on opening, kept once chosen). A ticked
  service (`cart` item `{n, cat, cid}`) goes to its section's doctor (`itemDoc`), so changing the doctor in step 2
  moves the section's services with it. Two sections with the same doctor (treatment and aesthetics → therapist)
  make one group. Diagnostics without a consultation have no doctor: a «Диагностика · без записи к врачу» group, last.
  Step 2 of «Диагностика» says the same while no consultation is ticked (user, 2026-11-20): the title «Врач не
  нужен», a dashed card «Диагностика · без записи к врачу» in place of the doctors (not a choice), and a note that a
  doctor is needed only with a consultation.
- A service is one per booking (user, 2026-11-20): `inCart` goes by the name only, so «Консультация терапевта»
  ticked in «Лечение зубов» shows ticked in «Диагностика» (as «Консультация специалистов» with «Терапевт» chosen) and the other way
  round, unticking it in either takes it out, and «Выбрано N» counts it in both. Before, it could be booked twice.
  Diagnostics' step 2 counts a consultation ticked in treatment too (`catRoles`), or it said «Врач не нужен» next to
  a row showing the therapist consultation ticked (found 2026-11-20).
- Each consultation goes to a doctor of its speciality (2026-11-22): diagnostics' doctor is the one picked there if
  the speciality matches, else the first of that role (`itemDoc`). Before, with a therapist consultation ticked in
  treatment, an orthopedist one from diagnostics also went to the therapist. Diagnostics' pick follows its
  consultations (`set()`): when they are gone (a ✕, «Сбросить всё») so is the doctor, and step 3 adds no doctor
  where step 2 said «Врач не нужен».
- After sending (`state.sent`), any new choice — a service, a consultation, a doctor anywhere — starts a new booking
  with just that choice (`NEW_BOOKING` in `main.js`; name and phone stay). Before, the choices joined the sent
  booking, which step 3 couldn't send again.
  Code review (2026-11-22): unticking one of the sent booking's ticks (they still show) only clears it, it doesn't book
  that service anew (`isTicked`); going from step 2 to step 3 after sending adds no doctor to the sent booking.
- A consultation chip pressed in diagnostics takes out only that consultation (it took the section's other one too);
  when diagnostics loses its doctor, a doctor booked alone from its step 2 goes as well (`extra` with `cid: 'diag'`).
- `state.extra` — doctors booked without services: a doctor card's «Записаться», the helper's «Записаться», a tile
  of the booking form, or going from step 2 to step 3 with none of the section's services ticked (then `cid` marks the
  section, and picking another doctor there replaces it instead of adding a second one).
- `visits()` builds the groups; `visitsHTML()` draws them the same in Services' step 3, the booking form and the
  corner list: a Mint card per doctor (photo, name, speciality, ✕ removes the doctor with their services) with the
  services as white chips (✕ each); a doctor without services says «Услуги подберёт врач на приёме».
- `state.notes` — the helper's reason, kept with its doctor (user, 2026-11-20): «Повод: Отёк или флюс · зуб 5 сверху
  справа» (the symptom's label, then the tooth or «вся челюсть»; nothing for «не знаю, какой зуб»), a white strip with
  ✕ above the doctor's services, in place of «Услуги подберёт врач». The helper adds to what is already chosen and
  never clears it; the same doctor again gets a second reason, not a second group. «Повод», not «Жалоба»: some
  answers are wishes («Хочу белее»). The helper's «Вероятно понадобится» services are not added on purpose — a guess
  the visitor didn't choose. When delivery is added, the reasons go into the request.
- «+ Добавить ещё услугу» (step 3, booking form, corner list) first opens a menu of the six sections under the button
  (`openCatMenu`, a floating card with photos; a scroll, a click elsewhere or Escape closes it), and the chosen section
  opens at its step 1 (since 2026-11-23, user: «сначала дадим выбрать категорию, чтобы человек сразу не переносился
  во все разделы»; before, it closed the open section and scrolled to all the sections).
- «Услуги врача» on each doctor's card (2026-11-22, user: add a service of exactly this doctor, e.g. in the booking
  form): it opens that doctor's services under the list (`pickerHTML`, `state.addFor`): the sections of their
  speciality grouped by section, plus their own consultation (`docServices`). A chip adds the service with that doctor
  (`doc` on the cart item, which `itemDoc` honours before the section's pick, so e.g. «Виниры» can go to the
  orthopedist while the rest of «Эстетика» stays with the therapist) or takes out a booked one. In all three lists
  (Services' step 3 and the booking form; the corner list only sums the booking up since 2026-11-23, user: «просто как
  суммирует», `visitsHTML({ full: true, summary: true })`; a doctor with a single service has no ✕ of their own there,
  it would repeat the service's ✕). A group re-rendered for its open/closed button doesn't fade in
  again: `.is-new` is only for a doctor not in the list before (`data-id`).
  Several doctors (2026-11-22, user): the groups keep the team's order (the doctor tiles' order, `visits()` sorts
  by it; before, a doctor jumped to the front when a service was added); in the booking form a card shows two services (three until
  2026-11-23) and a round Navy «+N» with a down arrow, an up arrow folding them again: at the right end of the services,
  in the middle of their height, reaching a little over the chips' ends with a Mint ring (user: «должен находить и быть
  посередине, не сливаться по цвету»; the list keeps 28 px on the right so it never covers a chip's ✕; it was «Ещё N» /
  «Свернуть» for the rest (`state.svcsAll`), every service name on one line with «…» (whole in a tooltip, `data-tip`), the
  picker's chips too; the open doctor's card is outlined and the list of their services carries a caret pointing at it
  (at the card's «Услуги врача» button since 2026-11-23 — on a wide card its middle was far from it); in a one-column
  list (Services' step 3, the form on phones) the open card reaches 16 px further out on each side than the list, so the
  list reads as hanging from it, and the list reaches the card's right edge (user: «чуть меньше, чем форма врача», then
  «по правой до конца дотянуть»; first the list was made narrower, then the user
  asked for the list's width back and the card stretched instead)
  and closes with its own ✕, concentric with its 26 px corner («Услуги врача» stays dark while it is open; until
  2026-11-23 it turned into «Свернуть»)
  (`placeCarets`). The list is rendered right after that card: in a one-column list it is under it, in the booking
  form's grid (≥ 481 px) `order` and a full row put it under all the cards, so no card moves; the cards in a row are
  one height and «Услуги врача» sits at the bottom of each (`margin-top: auto`), so the buttons stand on one line
  (user, the same day; for an hour the cards kept their own heights and the buttons stood at different levels).
  Services' step 3 and the corner list show every service in full, names wrapping, with no «+N» (2026-11-23, user:
  «там пусть пишутся нормально в строку все услуги, скрывать не будем»; `visitsHTML({ full: true })`).

**The corner button** (`#bk`, user's request, replacing the cart pill removed on 2026-11-19): «Ваша запись» with a
Yellow count (services, plus 1 per doctor without services), bottom right, once anything is chosen. It opens a list
above it (the groups, «Добавить услугу», «Оформить» → the booking form); a click outside or Esc folds it. Hidden while
the booking card is on screen (it shows the same) and after sending; the back-to-top button moves up above it
(`.is-raised`). On phones the list spans the width and the button sits above the cookie notice.
On phones (2026-11-22, site review) the list fits between the header and the button, the cookie notice counted
(`max-height` from `100dvh`, `--hdr-h` and `--cookie-h`; 72vh ran under the header at 360×640), and «Оформить» wraps
under «Добавить услугу» when both don't fit (it stuck out of the card at 360 px).

Folded services on phones (2026-11-23, user: «как мы можем скрыть список услуг к врачу … с кружочком как и в веб
версии»): in the booking form's cards up to 640 px, two or more services fold into one white pill «Выбрано услуг: N»
ending in the round Navy «+N ⌄» (half out of the pill, as the «+N» beside the pills on wider screens); the whole
pill opens them, with whole names, and «Свернуть ⌃» of the same shape folds them back. One service shows as before.

## Back-to-top

Back-to-top shows
after 900 px and switches to a white version over dark backgrounds: `darkUnder()` reads the background
colour under the button's centre on scroll.

On press (2026-11-19, user's request: "a nice animation") the arrow flies out of the top of the button and comes
back in from below (`.is-launch`, CSS), while `scrollToTop()` glides the page up with an ease-in-out cubic, 500 ms
plus 1 ms per 8 px of distance, at most 1.2 s; a wheel turn or a touch stops it. Reduced motion: an instant jump.

## Cookie notice

Added 2026-11-19 at the user's request: a white card bottom left (across the bottom up to 760 px — since 2026-11-20, as at 641–708 px the 460 px card ran
into the «Ваша запись» button — where the
back-to-top and corner buttons move up by its height via `--cookie-h`), «Мы используем файлы cookie…» and «Хорошо». It slides
in 0.9 s after load and stays away once accepted (`localStorage` `cookie-ok`; if storage is blocked it shows on
every visit). The site itself sets no cookies yet; the notice is there for when analytics or a chat widget arrive.
On phones (≤ 480, 2026-11-22, site review: 111–150 px, a quarter of a small screen, covering the first screen's
buttons) the notice is two lines: a shorter text, «Мы используем cookie. Продолжая, вы соглашаетесь.»
(`.cookie__short`, the full one is `.cookie__long`), 13 px, and a smaller button.

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
- Section: no tabs (the user wants one list: doctors, then nurses, then administrators), 4 per page (2 pages) with arrows and dots; phone (≤ 640 px) one scroll-snap row with a square photo (a 3:4 one made the card 572 px, too tall for a small screen) and one dot per person under it that follows the swipe (`swipeIndex`, `syncDots`; a dot scrolls to that card), since 2026-11-22. Every
  doctor (not the nurses or administrators) has "Записаться", which also adds that doctor to the booking.
- No "любой свободный врач" option in Services (removed on the user's request, 2026-11-17): a section's doctor is
  always named. Opening a section or ticking a consultation selects the doctor of
  the first role in `roles` (`autoDoc`; so the order of `roles` sets the default, e.g. aesthetics →
  therapist); the visitor can switch to another one shown, but not unselect.
- Doctor choice: in the services panel (step 2, doctors of `cats[].roles`; in diagnostics, of the
  ticked consultation), in the helper (`recommend[symptom].roles`), and the tiles of the booking form.
  Every section has its own doctor — see "Booking by doctor". Categories whose role has nobody say "Врача
  подберём при записи".


**«Подробнее»** (2026-11-19, user's request): every card has a «Подробнее» toggle (`doc-more`, `state.docOpen`). The
cards never change size: the chosen one gets a 1.5 px Navy outline, the others fade to 55 %, and a panel slides open
under the row (`#doc-panel`, grid rows 0fr → 1fr; a −28 px margin cancels the section's flex gap while it is folded,
so it takes no room then). The panel: a big photo on the left, the name, specialty and experience line, and the
story in two columns — «Образование» (`edu`), «Опыт работы» (`work`), «Повышение квалификации» (`courses`, with
years), «Дипломы и сертификаты» (`certs`) from `data.js`; «Записаться к врачу», «Свернуть» and a ✕. A caret on top
points at the chosen card (`docCaret()`, `--caret-x`, kept in place on resize and on swiping the phone row). The
panel keeps its content while it folds away; another doctor swaps it with a fade. Paging closes it, so while it is open the
page dots fade out (user's request, 2026-11-22), keeping their room so nothing below moves.
One size for everyone (2026-11-20, user): all the stories are in the panel at once, stacked in one grid cell
(`.doc-panel__stack`, only `.is-cur` visible), so the panel is as tall as the longest story at the current width and
doesn't change size between doctors; the buttons sit at the bottom of the card.
Motion (2026-11-20, user: smoother, and centre on the story): the height glides in 700 ms with an ease-in-out
(`--glide`), the story fades in a beat later and slides down 16 px; on open the page glides (`glideTo()`, the same
700 ms, shared with back-to-top) so the panel's final box sits in the middle of the screen under the header, or just
under the header when it is taller than the screen (phones); closing while scrolled into the panel glides back to
the row. To check in the shot harness, patch `requestAnimationFrame` to a timer in `-Do` and click after the
harness has scrolled (a `setTimeout`). Under 900 px the story is one column and the photo smaller; on phones the photo is a 4:3 band on top.
641–900 px: two cards per row. `.doc` is content-box, so its paddings and borders (22 px) count on top of the
flex basis: `calc(50% - 8px)` didn't fit two and every card took the full width (fixed 2026-11-22: `50% - 30px`).
History (same day): the opened card first widened in its row with photo-beside-text (the layout snapped mid-motion),
then via a View Transition, then with pinned photo heights; the user disliked all three («скачет», «не красиво»)
and chose the panel under the row. To check the motion in the shot harness, re-enable `transition` in `-Do`, pause
`document.getAnimations()` at set `currentTime`s and measure.
**All the stories are placeholders** written for the invented staff (universities are real, places of work are
generic, courses, years and awards are invented) — replace them with the real ones with the names and photos.

**Phones (2026-11-23, user: «врачи должны быть меньше», «Подробнее слишком большой»):** two 157 px cards on
screen and the edge of a third, a square photo cropped from the top (the 3:4 photos have the head right at the top
edge, so any lower crop cut it), no experience line in the card; the dots count scroll stops (doctors − cards on
screen + 1, `swipeStops()`), not doctors. The panel is ~420 px instead of ~950: a 64 px round photo beside the
name, smaller type, and only education and work — courses and certificates show from 641 px up.

## Contacts

One address (the export had two VestMedServis clinics with a switcher in the header, the menu, the
contacts and the booking summary; removed on 2026-11-03). The header address is a plain link to
`#clinics`.

Redesigned 2026-11-19 (user: «скучный» — it was a dark Navy street picture with a column of text beside it): a
light Mint street map fills the whole card — an inline SVG in `index.html` (blocks, a park, the clinic's block in
White, a Yellow main street, a dotted Orange route whose dashes run towards the pin, a pulsing Orange pin). It is
cropped from the left (`xMaxYMid slice`) so the pin and the route stay in view on narrow screens. The whole map
links to Google Maps; the «Открыть в Google Картах» pill on it is White with Navy text and turns Orange on hover.
Over its left part sits a white card: «Адрес», «ул. Липовая 18, офис 4», «г. Брест», rows with icon circles (the
entrance, the two phones), and «Построить маршрут» (Yellow, Google Maps directions to the address) and «Записаться
на приём». Under 760 px the map is a 260 px band above the card.
The map link's accessible name starts with its visible text, «Открыть в Google Картах — клиника на карте» (2026-11-22,
Lighthouse: voice control finds a link by what it shows).

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
выбором врача»). Rows: Врачи и услуги, Контакты (until 2026-11-22 «Врач» tiles and «Врачи и услуги» cards were two rows,
see below) —
a white card, label on the left, «Отправить заявку» at the bottom right:
- «Врачи и услуги» — the booking by doctor, as in Services' step 3, with «+ Добавить ещё услугу»; none: a line and
  «+ Добавить услугу» (a link until 2026-11-20; the user missed the button there).
  The doctors stand side by side (2026-11-22, user: «в ряд, чтобы не растягивать форму»): a grid of 200 px+ columns,
  four in a row at 1440 under the four doctor tiles, one column on phones.
  When the list is rebuilt at another height (a doctor or a service in or out) it glides from the old height to the
  new one in 420 ms (`growTo` in `main.js`; user: «пусть форма плавно увеличивается снизу»), so the form grows and
  shrinks smoothly instead of jumping — since 2026-11-23 only when a doctor comes or goes or a doctor's services list
  opens or closes (user: «обрезается при добавлении услуг»: a service ticked in that list grows its card, and the glide
  clipped the list below for a moment), clipped only at the growing bottom edge (`clip-path`, not `overflow: hidden`,
  which cut outlines and focus rings at the sides); the services list fades in only as it opens (`pickerFresh`), not on
  every chip. A service ticked in an open list grows its doctor's card (the first two; more go into «+N»): then the
  form glides without clipping and the list slides down along with it (`translateY` from where it was), so nothing
  jumps (user, 2026-11-23: «при выборе услуг у врача первых двух скачет форма»; then «в услугах тоже»): `slideAfter`
  slides the list and everything after it — the cards below it in a one-column list, «Добавить ещё услугу», the rows
  after the list — while the wrapper's height glides; the same in Services' step 3 (`.svc-sum`). The list used to be above the doctor
  tiles, so it pushed the tile just pressed
  down (user: «пусть не скачет форма»); making the page scroll along kept the tile still but moved everything above
  it («скачет вверх и вниз»). Since 2026-11-22 the tiles come first and the list under them, so a tile stays put, the
  page doesn't scroll and the form grows downwards. On phones «Сбросить всё» moved from under the title (appearing with
  the first doctor it pushed the form down) to beside «Добавить ещё услугу» (`.book__reset--list`).
  The glide is border-box (inline `box-sizing` while it runs): measured with the list's 4 px top padding but applied to
  the content box, it first dropped the rows below by 4 px and at the end pulled them 4 px back up (user: «уезжает вниз
  и на пару пикселей вверх»).
  It still flickered: `mount()` rebuilt the whole list, so every doctor's photo reloaded and flashed. Now a group
  whose markup is unchanged keeps its node (matched by `outerHTML`), and a new one fades in (`.visit.is-new`).
  It still shook (2026-11-23, user: a service and doctor chosen in Services, then services added in the form — «форма
  начинает трястись вверх вниз»): with Services left at step 3, its booking list (above the screen) glided to its new
  height too, and Chrome's scroll anchoring corrected the scroll every frame in whole pixels against fractional heights,
  so the form on screen wobbled by ~1 px up and down for 420 ms. `growTo` and `slideAfter` now skip anything off the
  screen (`offScreen()`): it changes height at once and the scroll is corrected once, unseen. Found with a CDP trace of
  that exact sequence; the same ticks with Services closed or at step 2 were smooth.
- One row for the doctors (2026-11-22, user: «зачем нам дублировать врачей, только уже выбранных» — the «Врач» tiles
  and the cards of the chosen doctors showed each chosen doctor twice): a slot per doctor in the team's order; a doctor
  not chosen is a tile (photo above the name, cropped from the top so the head is whole, «+ Выбрать»; a row on
  phones), a chosen one is their card in the same place (`visitHTML`: services, «Услуги врача», ✕ back to the tile),
  outlined in Yellow (2 px, as the chosen doctor in Services' step 2; user, 2026-11-23: «обведём выбранного врача»).
  Diagnostics without a doctor follows as a card of its own. With nothing chosen a line says the administrator will
  help. Before: a separate row of four tiles that toggled. «Любой врач» was dropped on 2026-11-20 with the move to
  several doctors: with none chosen the administrator picks.
- «Контакты» (name, phone). Services' step 3 and this form are one booking: doctors and services
  share the state, and the name and phone are mirrored as they are typed (`copyContacts`).
- «Сбросить всё» (top right, and next to «Выбрано N услуг» in the services panel) clears the services and the doctors
  (`cart-reset`; user's choice: name and phone stay); hidden when there is nothing to clear.

The lead is only «Оставьте номер — перезвоним и подберём удобное время.»; the "Или позвоните сами" phones were
dropped 2026-11-19 (user's request; the numbers are in the header, contacts and FAQ).
The consent line under the form has no width cap since 2026-11-22 (user: one line), so it is one line from ~1000 px;
narrower, with the button beside it or on phones, it still wraps.

Validation as in the export: name — letters only, at least 2, rejects
keyboard mash (4+ consonants, three same letters, no vowel, and since 2026-11-22 a run along a keyboard row —
«йцукен», «фыва», «qwerty»: 5+ keys inside a word or a whole word of 4+, since 4 anywhere would reject real names
such as «Митьков»); phone — Belarus `+375 (XX) XXX-XX-XX`, auto-formatted while typing, a leading 80 becomes
375 and a leading 00 a "+" (also typed digit by digit). Another country (since 2026-11-17, user request): a number starting with
"+" and a code other than 375 is kept as typed (digits and separators, max 15 digits) and needs at least 8
digits; digits typed without "+" are still taken as a Belarusian number. Errors show after the field was left or after a submit attempt; submit focuses the first bad field.
Fixed 2026-11-22 (site review): a lone «3» or «37» typed without "+" stays as typed (it may become 375 or МТС's 33)
— before, it showed «+3», and the next «3» made it French «+33…»; the bracket after the operator code appears with
the next digit, so Backspace no longer gets stuck at «+375 (29)»; the caret keeps its place among the digits after
the reformat (it jumped to the end), and Backspace/Delete on a bracket, space or dash removes the digit next to it
(`reformat` in `form.js`, which reads the value before the keystroke from `beforeinput`).
Code review the same day: the caret moves only for digits the formatter adds or drops in front (`leadDelta`), not for
digits cut off past 12 (or 15 abroad), so typing «56» in the middle of a full number no longer gives «65»; a «+»
deleted with Delete goes alone (it isn't a separator, so the digit after it stays).
After sending, "Заявка отправлена" takes the form's place in the same grid cell (`.is-sent` on the card,
the hidden part keeps its space via `visibility`), so the card doesn't shrink or jump; the corner
button disappears too, and the confirmation (here or in the services panel) is scrolled to the middle
of the screen (`markSent`). Headless Chrome in `tools/shot` neither runs smooth scrolling nor fires
`requestAnimationFrame` reliably — to check, patch `scrollIntoView` to `behavior: 'instant'` in `-Do`.
Both confirmations have "Записаться ещё раз" (`book-again`): it resets both forms (`form.reset()`; `SiteForm`
clears its errors on reset), the services and the doctor, and returns to step 1 of the services
panel or to the booking form's name field.

**Preferred time** — removed 2026-11-22 (user: «удобное время уберем из заявки», everywhere): until then the booking
form had radio pills утром / днём / вечером / любое and Services' step 3 the same chips (`state.time`, in git
history). The administrator agrees the time on the phone call. A real calendar with free/blocked slots and a doctors'
admin panel was discussed and postponed (it needs a backend such as Supabase, logins and patients' personal data).

**Requests are not delivered anywhere yet** — submit only shows "Заявка отправлена". The delivery
(e.g. Web3Forms, as in Nitowska, or a Telegram bot) goes into the form's submit handler in `main.js`.

## Footer

Four columns: the logo with a line about the clinic, «Навигация», «Услуги» (open that section), «Контакты». From
1000 px (2026-11-22, user: «колонку с услугами ближе к навигации, а то будто находит на лого») the two link columns
are as wide as their text and stand side by side in the middle of the page (same day: «выровняем по центру» — the
brand and contacts columns are equal, `1fr` each; first the brand column was `1.3fr`), the contacts keep
220 px for the unwrapped phone numbers. Before, four equal columns put «Навигация» right after the logo. Narrower,
the columns wrap as before (one column on phones). The contacts column's content stands at the right edge of the
content (`justify-self: end`, 2026-11-23, user: «контакты растяни до нашей ширины сайта, чтобы не было лесенки»), so the
footer spans the same width as the sections above. The same day the whole site was briefly made the header's width
(1440); the user preferred it as it was, and that was reverted.

On phones (2026-11-22, site review: 1 100 px long, and the back-to-top button covered «© 2026») «Навигация» and
«Услуги» stand side by side, the logo and the contacts span both, and the footer has 96 px of room at the bottom.

## Removed pages

The blog, documents and vacancies pages (with their scripts, the legal PDFs and the news block on the
home page) were built for VestMedServis and removed on 2026-11-03, when the site was switched to the
Grevitident clinic, which has no such content yet. They are in git history (before that date) if the
new clinic needs them back.
