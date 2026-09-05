# @aesc/brand

The AESC visual identity as a thing you can install, rather than a PDF somebody has to remember.

Six colours, three typefaces, one mark, and a colour law that **fails the build** when it is broken.
The human-readable guide — what the colours mean, how to set the type, what to do in print and on
signage — lives at the artifact URL in `GUIDE.url`. This package is the machine-readable half.

---

## Install

There is no npm registry involved and there does not need to be. Pin a git tag:

```bash
pnpm add github:amelspahic/aesc-brand#v1.0.1
```

Nothing here has a dependency, a build output, or a runtime. It is CSS, JSON and SVG.

## Use

**CSS variables** — one import, then style through the tokens and never through a literal.

There are two builds of the same values and picking the wrong one fails quietly:

| File | For | What happens if you pick the other one |
|---|---|---|
| `tokens.css` | plain CSS, print templates, decks, anything not Tailwind | — |
| `tokens.theme.css` | **Tailwind 4** | Tailwind makes a utility class from every name inside `@theme`. The same declarations in `:root` give you the values and **no classes** — so `bg-zlato`, `text-hero` and `p-odjeljak` silently stop existing while every colour still resolves, and the page looks nearly right with its grounds and borders gone. |

```css
@import '@aesc/brand/tokens.css';       /* plain */
@import '@aesc/brand/tokens.theme.css'; /* Tailwind 4 */

.hero      { background: var(--color-zlato); color: var(--color-mastilo); }
.figure    { font-family: var(--font-podaci); font-variant-numeric: tabular-nums; }
.section   { padding-block: var(--spacing-odjeljak); }
.prose     { max-width: var(--spacing-mjera); }   /* 34em, ~66 characters */
```

**Fonts** — three families, and `latin-ext` is not optional. Without it `č ć ž š đ` fall back to a
system face mid-word.

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400..700&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=IBM+Plex+Mono:wght@400;500&display=swap">
```

Set `font-optical-sizing: auto` on `<html>` and never name `opsz` in `font-variation-settings` —
naming it switches the automatic behaviour off, and one Bricolage file stops serving both a 92px
hero and a 22px heading.

**The mark** — `currentColor` throughout, so one file is correct on every ground.

| File | Use |
|---|---|
| `znak/znak.svg` | The full mark, 32px / 12mm and up. |
| `znak/znak-mali.svg` | Below that. The ring is removed, not scaled — its stroke goes under 2px and turns to haze. |
| `znak/znak-plocica.svg` | Gold plate, fixed colours. Avatars and app icons, where you get no ground. |
| `znak/favicon.ico` | Five sizes. Google Search does not accept an SVG favicon. |
| `znak/apple-icon.png` | 180×180. `apple-icon` may not be an SVG. |

**Anything else** — read `tokens.json`. It is the source; `tokens.css` is generated from it. Feed it
to Tailwind, to a Figma plugin, to a deck template, to whatever comes next.

## The colour law

Eight pairings are allowed and one is forbidden, and this is enforced rather than described:

```bash
npm run build   # regenerate tokens.css, tokens.theme.css and guide.html
npm run check   # verify all three; exits 1 on drift. Already in CI.
```

Change a brand colour and the build tells you which pairing you broke, by name, with the ratio it
now measures. The forbidden one is **gold on any light ground — 1.60:1**. That covers gold text,
gold hairlines, gold borders and gold focus rings on a pale surface. Gold is a *field* that carries
dark ink, or it is absent.

## Starting a second project with this

Four steps, and none of them is "open the PDF and match the colours by eye".

```bash
# 1. install
pnpm add github:amelspahic/aesc-brand#v1.0.1

# 2. fonts — one link, latin-ext included
#    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400..700&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=IBM+Plex+Mono:wght@400;500&display=swap">

# 3. tokens — pick ONE, see the table above
#    plain CSS:  @import '@aesc/brand/tokens.css';
#    Tailwind 4: @import '@aesc/brand/tokens.theme.css';

# 4. mark + icons
cp node_modules/@aesc/brand/znak/favicon.ico    app/favicon.ico
cp node_modules/@aesc/brand/znak/apple-icon.png app/apple-icon.png
```

Then style through the tokens and never through a literal. That is the whole contract: if a colour
appears in your CSS as `#f6bf1f` rather than `var(--color-zlato)`, the second project has forked the
palette and will drift the first time the first one changes.

**What each consumer needs from this package**

| You are building | Take |
|---|---|
| A Tailwind 4 site | `tokens.theme.css`, the fonts link, `znak/` |
| A plain HTML page or email | `tokens.css`, the fonts link, `znak/znak.svg` |
| A print piece — card, letterhead, invoice | the CMYK table in the guide, `znak/znak.svg`, `company.json` |
| A deck | `tokens.json` for the values, the band rhythm from the guide's §04 |
| Something else entirely | `tokens.json`. It is plain data; feed it to whatever reads JSON. |

**The guide is the thing you send to people who are not you** — a printer, a signwriter, an agency.
`guide.html` is generated from these same files, so it can state the mark's clear space and the
CMYK builds without any chance of contradicting the code.

## Editing

`tokens.json` is the only file you edit by hand. `tokens.css` and `tokens.theme.css` are both
generated from it — a pull request that changes either directly is one that will be overwritten.

The font declarations are written once and work in both kinds of project:
`var(--font-prikaz-face, 'Bricolage Grotesque')` picks up whatever `next/font` injected when the
consumer self-hosts, and falls back to the plain family name when it does not.

`guide.html` is generated too, from `tokens.json` + `guide.content.json` + `company.json`. The split
is strict and it is the point:

* **Every value** in the guide — hex, contrast ratio, type size, CMYK build, easing — is read from
  `tokens.json`, and the ratios are *recomputed* rather than transcribed. Change a colour and the
  document's swatches, its pairing grid, its ratios and its CMYK table all move together.
* **Every word** lives in `guide.content.json`, because prose has no other copy to drift from.

If you find a number in `guide.content.json`, it is in the wrong file. Regenerate with
`node guide.mjs`; CI runs `--check` and fails when the guide is stale.

`company.json` is the firm's facts for surfaces the website does not own. The website keeps the
authoritative copy in `src/lib/company.ts` for its structured data, and
`src/lib/blog/provjera.test.mjs` asserts the two agree — that check caught a stray comma in a street
address the first time it ran.

The raster icons come from `znak/crtaj-ikonu.py`, which draws them on the same 64-unit grid as
`znak.svg`. If the mark ever changes, change the SVG and re-run the script together:

```bash
OUT=znak python3 znak/crtaj-ikonu.py
```

## Where this lives

It is published as its own repository, `aesc-brand`, and authored inside the website at `brand/`.
`git subtree` keeps the two as one history rather than two copies — see `PUBLISHING.md` for the
push and pull commands and for why this is not a submodule.

The website still imports `brand/tokens.theme.css` by relative path, because it is the authoring
home. A *second* project installs the published package instead:

```bash
pnpm add github:amelspahic/aesc-brand#v1.0.1
```
