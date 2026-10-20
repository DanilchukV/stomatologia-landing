# Stomatologia — landing page

A landing site for a dental clinic. She designs it in her own Claude chat (as an HTML artifact or
a design prototype); this repo turns that prototype into proper static code and publishes it on
GitHub Pages, so the site can be shared by a link. The workflow copies the Nitowska Visual project
(`~/nitowska-landing`) — when in doubt, look at how it is done there.

Talk to the user in Russian.

## Status

Skeleton only: tools, the Pages workflow, docs and this file. The site isn't imported yet — see
"Open tasks".

## Stack

None. A static `index.html` plus the `assets/` folder. No build step, no dependencies, no npm, no
frameworks, no CDNs at runtime (fonts, icons and libraries are self-hosted in `assets/`).

## Git

Repository: private https://github.com/DanilchukV/stomatologia-landing, branch `main`. `gh` is
logged in as DanilchukV. Commits use the GitHub noreply address — never the real email: the
account has email privacy protection and a push with it is rejected (GH007). The global
`user.email` on the Mac is the real address, so this repo has a local
`26150007+DanilchukV@users.noreply.github.com`; don't reset it.

After every finished change — a commit with a clear message **in English** and `git push`. The
user wants to be able to roll back "N changes", so don't squash changes into one commit.

## Structure

```
index.html                 the page markup
assets/css/style.css       all styles
assets/js/main.js          all scripts
assets/img/                images (WebP; JPEG only where WebP saves under ~5%)
assets/fonts/              self-hosted woff2
assets/icons/              favicon, apple-touch-icon, og-image
tools/                     dev scripts (dev, serve, shot) — NOT DEPLOYED
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
tools/dev.sh             # server + desktop tab + Chrome mobile window (~390 px, iPhone user agent)
tools/dev.sh -NoOpen     # server only
tools/dev.sh -Stop       # stop the server (it has no window, it runs in the background)
```

**"Start the site" / "run the site" / "open the preview"** means `tools/dev.sh`. The address is
`http://127.0.0.1:8081/` — port **8081**, because Nitowska uses 8080 and both may run at once. The
server listens on the whole network; `dev.sh` prints the phone link for the same Wi-Fi. If a server
is already running, a second one doesn't start.

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

### 1. Import the prototype

The user downloads her HTML from the Claude chat into `~/Downloads` and names the file. Then:

1. Look at what it is: a plain HTML page, an HTML with base64-embedded images/fonts, or a
   React/JSX artifact (Babel/React/Tailwind loaded from a CDN in the browser). For React/JSX, tell
   the user what converting it to plain HTML/CSS/JS involves before starting.
2. First commit — the file exactly as downloaded, as `index.html` ("Initial state from the design
   chat"), so there is always the original to compare with and roll back to.
3. Split it into the structure above: CSS to `assets/css/style.css`, JS to `assets/js/main.js`
   (each script starting with `'use strict'`), base64 images and fonts to files in `assets/`,
   external images (Unsplash etc.) downloaded into `assets/img/`, Google Fonts self-hosted as woff2,
   Tailwind CDN classes compiled into real CSS. Images to WebP: `cwebp -q 80 -m 6 -sharp_yuv`
   (installed via Homebrew). Images below the first screen get `loading="lazy"`; the hero image
   doesn't.
4. Compare with the original: screenshots of the downloaded file and of the new site at 1440 and
   390 must match. Fix the phone layout if the prototype has none.
5. Basic head: `<title>`, `description`, Open Graph tags + `og-image` (for a nice link preview in
   messengers), favicon, `<html lang>` matching the site language.
6. Commit in steps (extraction, images, fonts, head…), not as one big commit. Record anything
   non-obvious in `docs/knowledge.md`.

### 2. Go public and switch on Pages

Only when the user says the site is ready to share:

1. The whole git history becomes public — check it for anything private first (personal phone
   numbers or emails, API keys, the clinic's internal notes in comments).
2. `gh repo edit DanilchukV/stomatologia-landing --visibility public --accept-visibility-change-consequences`
3. `gh api -X POST repos/DanilchukV/stomatologia-landing/pages -f build_type=workflow`
4. `gh workflow run pages.yml`, wait for it (`gh run watch`), then open
   https://danilchukv.github.io/stomatologia-landing/ and check it on desktop and phone.
5. Update this file: the repo is public, the site link, "Nothing is live yet" removed.
