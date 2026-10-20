# Stomatologia — landing page

A landing site for a dental clinic. She designs it in her own Claude chat (as an HTML artifact or
a design prototype); this repo turns that prototype into proper static code and publishes it on
GitHub Pages, so the site can be shared by a link. The workflow copies the Nitowska Visual project
(`~/nitowska-landing`) — when in doubt, look at how it is done there.

Talk to the user in Russian.

## Status

The clinic is VestMedServis, a dental clinic in Brest (Belarus); the site is in Russian
(`lang="ru"`). The original Claude Design export is commit `ffa5378`; on 2026-10-20 it was rewritten
as plain HTML/CSS/JS (no React, no CDN) and made responsive — see `docs/knowledge.md`. Some content
from the design is still missing (open task 1).

## Stack

None. A static `index.html` plus the `assets/` folder. No build step, no dependencies, no npm, no
frameworks, no CDNs at runtime (fonts, icons and libraries are self-hosted in `assets/`).

## Git

Repository: private https://github.com/DanilchukV/stomatologia-landing, branch `main`. `gh` is
logged in as DanilchukV. Commits use the GitHub noreply address — never the real email: the
account has email privacy protection and a push with it is rejected (GH007). The global
`user.email` on the Mac is the real address, so this repo has a local
`26150007+DanilchukV@users.noreply.github.com`; don't reset it. Every new clone needs it too (see below).

After every finished change — a commit with a clear message **in English** and `git push`. The
user wants to be able to roll back "N changes", so don't squash changes into one commit.

## Setting up on a new computer

The project is worked on from the Mac and from the Windows PC that also has Nitowska
(`nitowska-landing`); the clone goes into the same parent folder, next to `nitowska-landing`.
On Windows, in PowerShell, from the folder that contains `nitowska-landing`:

```powershell
gh repo clone DanilchukV/stomatologia-landing
cd stomatologia-landing
git config user.name "DanilchukV"
git config user.email "26150007+DanilchukV@users.noreply.github.com"
code .
```

`gh` must be logged in as DanilchukV (the repo is private). Phone preview over Wi-Fi on Windows
needs `tools\lan-setup.ps1` once (asks for admin rights; Nitowska's setup covers port 8080 only).

## Structure

```
index.html                 the page markup
assets/css/style.css       all styles
assets/js/main.js          all behaviour (state → render, click actions via data-act)
assets/js/data.js          content the scripts use: clinics, services, staff, symptoms, tooth map
assets/img/                images (WebP; JPEG only where WebP saves under ~5%); doctors/ — staff photos
assets/fonts/              self-hosted woff2 + OFL.txt (licences, keep with the fonts)
assets/icons/              favicon (svg + 32 px png), apple-touch-icon, og-image (1200×630)
assets/docs/               legal PDFs linked from the footer (shrunk scans from dentall.by)
tools/                     dev scripts: dev, serve, shot (.sh for macOS, .ps1 for Windows), lan-setup.ps1 — NOT DEPLOYED
docs/knowledge.md          knowledge base: how the sections work and why — NOT DEPLOYED
.github/workflows/pages.yml  publishes index.html + assets/ to GitHub Pages
```

**Repository text is English only** — code, comments, tool messages, docs, commit messages. The
site copy is in whatever language the site is in. Only the chat with the user is in Russian.
**CSS is grouped by component** (`/* ===== Name ===== */` sections in page order; inside — base
rules, then media blocks wide → narrow). Put a new rule into its component's section, not at the
end of the file.
**Code comments — short**, and only where something breaks easily without them (a browser-bug
workaround, a "magic" number, non-obvious logic). Design decisions and change history go to
`docs/knowledge.md`, not into the code.

## Rules that are easy to break

**Asset paths are relative** (`assets/img/…`, never `/assets/img/…`). GitHub Pages serves the site
under a subfolder, `https://danilchukv.github.io/stomatologia-landing/`, so a root-absolute path
points to `danilchukv.github.io/assets/…` and 404s — while locally it works, because the local
server serves from the root. Inside `style.css` paths are relative to the CSS file: `../img/…`,
`../fonts/…`. Check before committing:

```bash
grep -rnE '(src|href)="/[^/]|url\(["'\'']?/[^/]' index.html assets/css
```

**Everything the site needs lives in `index.html` and `assets/`.** The Pages workflow copies only
those two; a new top-level file (`robots.txt`, `404.html`, …) must be added to its `cp` line.

## Preview

```bash
tools/dev.sh             # macOS: server + desktop tab + Chrome mobile window (~390 px, iPhone user agent)
tools/dev.sh -NoOpen     # server only
tools/dev.sh -Stop       # stop the server (it has no window, it runs in the background)
```

```powershell
powershell -ExecutionPolicy Bypass -File tools\dev.ps1           # Windows: the same
powershell -ExecutionPolicy Bypass -File tools\dev.ps1 -NoOpen   # server only
powershell -ExecutionPolicy Bypass -File tools\lan-setup.ps1     # once: allow phones on the Wi-Fi (UAC)
```

**"Start the site" / "run the site" / "open the preview"** means `tools/dev.sh` (macOS) or
`tools\dev.ps1` (Windows). The address is `http://127.0.0.1:8081/` (`http://localhost:8081/` on
Windows) — port **8081**, because Nitowska uses 8080 and both may run at once. The server prints the
phone link for the same Wi-Fi. If a server is already running, a second one doesn't start. On
Windows the server runs in a minimised PowerShell window — close it to stop the server.

Opening via `file://` doesn't work for self-hosted fonts (browsers block them from `file://`).

## Checking changes

Claude can't see the site — it checks with screenshots via `tools/shot.sh` (headless Chrome, opens
no windows, starts the server itself):

```bash
tools/shot.sh                                       # 1440 and 390, top of the page
tools/shot.sh -Target "#services" -Width 1440,1024,390
tools/shot.sh -Target ".hero h1" -Width 1440 -Height 200 -Scale 3
tools/shot.sh -Target "#services" -Js "ov('#services .card')" -NoShot
```

`-Target` is a CSS selector: the page scrolls to it (`-Offset`, 100 px from the top by default).
`-Js` is an expression evaluated in the page, with helpers `ov(sel)` (horizontal overflow) and
`box(sel)` (coordinates and size). `-Do` is a JS action before scrolling and the shot (fill fields,
press a button). Screenshots: `$TMPDIR/stomatologia-shots/shot-<width>.png` — view them with Read.
On Windows: `powershell -ExecutionPolicy Bypass -File tools\shot.ps1` with the same parameters;
screenshots go to `%TEMP%\stomatologia-shots\`.
The harness is `tools/shot.html` (index.html in an iframe, animations off). If the page hides
blocks until they scroll into view, add that class to the harness's style override, or shots of
lower sections come out blank.

Order: change → screenshot of **both desktop (1440) and phone (390)** → commit. Small details
(icons, alignment) — with `-Scale 3` and a `box()` measurement; they can't be judged by eye at
scale 1.

**"No check"** (the user writes it in Russian, "bez proverki") — for small changes (colour,
spacing, text): change → commit → push, no screenshots. They look at the open preview themselves.

## Publishing (GitHub Pages)

`.github/workflows/pages.yml` deploys on every push to `main`: it copies `index.html` and `assets/`
into `_site/` and publishes that, so `tools/`, `docs/` and this file never go live. GitHub Free
serves Pages only from **public** repos; the user wants the repo private until the site is ready,
so the job has `if: !github.event.repository.private` — while private, every run is "skipped",
not failed. Nothing is live yet.

## Open tasks

### 1. Missing content from the design

The import is done; these pieces were not in the export and are waiting for the user (asked on
2026-10-20). Where each one plugs in is described in `docs/knowledge.md`.

- **6 service photos** (cards and the open category panel) — they live only on Claude Design's
  server (`/_blob/…`). Put them into `assets/img/services/` as WebP and wire `.svc-card__photo` /
  `.svc-panel__photo`.
- **Pages `blog.html`, `vacancies.html`, `documents.html`** — other pages of the design project;
  export them too or drop the links (user to decide).
- **Reviews page 2** — placeholder cards; real Google reviews, or remove the page.
- **Booking delivery** — the form only shows "Заявка отправлена"; decide where requests go
  (Web3Forms to email as in Nitowska, or Telegram) and add it to the submit handler.

### 2. Go public and switch on Pages

Only when the user says the site is ready to share:

1. The whole git history becomes public — check it for anything private first (personal phone
   numbers or emails, API keys, the clinic's internal notes in comments).
2. `gh repo edit DanilchukV/stomatologia-landing --visibility public --accept-visibility-change-consequences`
3. `gh api -X POST repos/DanilchukV/stomatologia-landing/pages -f build_type=workflow`
4. `gh workflow run pages.yml`, wait for it (`gh run watch`), then open
   https://danilchukv.github.io/stomatologia-landing/ and check it on desktop and phone.
5. Update this file: the repo is public, the site link, "Nothing is live yet" removed.
