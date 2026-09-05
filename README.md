# @aesc/brand

The AESC visual identity as a thing you can install, rather than a PDF somebody has to remember.

Six colours, three typefaces, one mark, and a colour law that **fails the build** when it is broken.
The human-readable guide — what the colours mean, how to set the type, what to do in print and on
signage — lives at the artifact URL in `GUIDE.url`. This package is the machine-readable half.

---

## Install

There is no npm registry involved and there does not need to be. Pin a git tag:

```bash
pnpm add github:<user>/aesc-brand#v1.0.0
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
node build.mjs          # regenerate tokens.css, re-measuring every pairing
node build.mjs --check   # verify only; exits 1 on drift. Put this in CI.
```

Change a brand colour and the build tells you which pairing you broke, by name, with the ratio it
now measures. The forbidden one is **gold on any light ground — 1.60:1**. That covers gold text,
gold hairlines, gold borders and gold focus rings on a pale surface. Gold is a *field* that carries
dark ink, or it is absent.

## Editing

`tokens.json` is the only file you edit by hand. `tokens.css` and `tokens.theme.css` are both
generated from it — a pull request that changes either directly is one that will be overwritten.

The font declarations are written once and work in both kinds of project:
`var(--font-prikaz-face, 'Bricolage Grotesque')` picks up whatever `next/font` injected when the
consumer self-hosts, and falls back to the plain family name when it does not.

The raster icons come from `znak/crtaj-ikonu.py`, which draws them on the same 64-unit grid as
`znak.svg`. If the mark ever changes, change the SVG and re-run the script together:

```bash
OUT=znak python3 znak/crtaj-ikonu.py
```

## Lifting this into its own repo

It is currently a directory inside the website. The moment a second project needs it:

```bash
git subtree split --prefix=brand -b brand-only
cd .. && git clone -b brand-only aesc-website aesc-brand
cd aesc-brand && git tag v1.0.0
```

History for these files comes with it. Then add it back to the website as a dependency, so the site
consumes the same package everything else does and there is exactly one palette.
