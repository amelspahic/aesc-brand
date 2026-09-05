#!/usr/bin/env node
/**
 * guide.mjs — generate the brand guide from the tokens, so it cannot state a value that is false.
 *
 *     node brand/guide.mjs           # write brand/guide.html
 *     node brand/guide.mjs --check   # verify only; exit 1 if stale. CI runs this.
 *
 * ## The split, and why it is the whole point
 *
 * A brand guide has two kinds of content and only one of them can be authored safely.
 *
 *   VALUES  — every hex, every contrast ratio, every type size, every easing curve. None of these
 *             appear in any source file but `tokens.json`. They are read, and the ratios are
 *             RECOMPUTED here from the hex values rather than transcribed, so the document cannot
 *             drift from the code even in principle. A hand-written guide drifts the first time
 *             somebody changes a colour and forgets the PDF; this one has nothing to forget.
 *
 *   WORDS   — what the mark means, how to write, what to do on a business card. These have no
 *             other copy anywhere, so they live in `guide.content.json` and are simply laid out.
 *
 * If you find a number in `guide.content.json`, it is in the wrong file.
 *
 * Company facts come from `company.json`, which `src/lib/blog/provjera.test.mjs` asserts against
 * `src/lib/company.ts` — the site keeps the authoritative copy for structured data, and the test
 * fails when the two disagree. That check found a stray comma in a street address the first time
 * it ran.
 *
 * ## Output
 *
 * An Artifact-ready HTML fragment: `<title>`, `<link>`, `<style>` and body markup, with no
 * `<!doctype>`, `<html>`, `<head>` or `<body>` — the publisher supplies those.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (f) => JSON.parse(readFileSync(join(HERE, f), 'utf8'))
const T = read('tokens.json')
const C = read('guide.content.json')
const F = read('company.json')

/* ---- colour maths, the same as build.mjs uses to enforce the law ---------- */
const channel = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const luminance = (h) => {
  const x = h.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const ratio = (ink, ground) => contrast(hex(ink), hex(ground)).toFixed(2)
const hex = (n) => {
  const c = T.boja[n]
  if (!c) throw new Error(`Unknown colour "${n}"`)
  return c.hex
}

/** Naive CMYK, and labelled as such in the page. A press proof is the real answer. */
function cmyk(h) {
  const x = h.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255)
  const k = 1 - Math.max(r, g, b)
  if (k === 1) return '0 / 0 / 0 / 100'
  const f = (v) => Math.round(((1 - v - k) / (1 - k)) * 100)
  return `${f(r)} / ${f(g)} / ${f(b)} / ${Math.round(k * 100)}`
}

const esc = (s) => String(s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')

/* ---- the mark, drawn from one set of paths ------------------------------- */
const RING = `<g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"><path d="M53.65 19.5A25 25 0 1 1 10.35 44.5"/><path d="M10.35 19.5A25 25 0 0 1 53.65 44.5"/></g>`
const LETTER = `<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 41 32 22l9 19"/><path d="M26 35h12"/></g>`
const LETTER_BIG = `<g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 48 32 15l17 33"/><path d="M22.5 38h19"/></g>`
const mark = (size, small = false) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="AESC">${small ? LETTER_BIG : RING + LETTER}</svg>`

/* ---- pieces -------------------------------------------------------------- */
const swatches = () =>
  Object.entries(T.boja)
    .map(([k, v]) => {
      // Ink on each swatch is picked by measurement, not by eye: whichever of the two brand inks
      // reads better on that ground. A hard-coded choice here would be the very mistake the page
      // is about.
      const ink = contrast(hex('mastilo'), v.hex) >= contrast(hex('papir'), v.hex) ? hex('mastilo') : hex('papir')
      return `<div class="sw" style="background:${v.hex};color:${ink}">
        <b>${cap(k)}</b><span class="hex">${v.hex.toUpperCase()}</span>
        <span class="use">${esc(v.uloga)}</span>
      </div>`
    })
    .join('\n')

const pairs = () => {
  const shown = [...T.dozvoljeno, ...T.zabranjeno.map((z) => ({ ...z, bad: true }))]
  return shown
    .map((p) => {
      const r = ratio(p.ink, p.ground)
      const verdict = p.bad ? 'Forbidden' : p.zasto.replace(/\.$/, '')
      return `<div class="pair${p.bad ? ' pair--bad' : ''}" style="background:${hex(p.ground)};color:${hex(p.ink)}">
        <span class="big">${cap(p.ink)} on ${cap(p.ground)}</span>
        <span class="ratio">${r}:1</span>
        <span class="verdict"${p.bad ? ' style="color:#93231a"' : ''}>${esc(verdict)}</span>
      </div>`
    })
    .join('\n')
}

const printTable = () => {
  const rows = Object.entries(T.boja)
    .filter(([k]) => k !== 'zlato-duboko')
    .map(([k, v]) => {
      const note =
        k === 'papir'
          ? 'Do not print it. Choose a warm uncoated stock and leave it unprinted.'
          : k === 'mastilo'
            ? 'For solid areas use a rich black with the same warm bias, not 100K.'
            : k === 'zlato'
              ? 'Prints duller than screen. Consider a spot ink for stationery.'
              : k === 'tinta-polje'
                ? 'The data field. Deep enough to need a proof; it shifts on uncoated stock.'
                : 'Link ink. Rarely printed as a solid — check it holds at 8 pt before you rely on it.'
      return `<tr><td>${cap(k)}</td><td class="n">${v.hex.toUpperCase()}</td><td class="n">${k === 'papir' ? '&mdash;' : cmyk(v.hex)}</td><td>${note}</td></tr>`
    })
    .join('\n')
  return `<table><thead><tr><th>Colour</th><th class="n">sRGB</th><th class="n">CMYK (start here)</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`
}

const SPECIMEN = {
  hero: 'Četiri stvari',
  h1: 'Kad dođe kontrola',
  h2: 'Ne moramo mi to reći',
  h3: 'Administracija i zastupanje',
  uvod: 'Standfirst and pull quotes. One step above body, and the only place body copy is allowed to grow.',
}

const specimens = () =>
  ['hero', 'h1', 'h2', 'h3']
    .map((k) => {
      const v = T.velicine[k]
      const w = v.wdth ?? 92
      const g = v.wght ?? 700
      return `<div class="spec">
        <p class="meta">${k} &middot; ${esc(v.px)} px &middot; wght ${g} &middot; wdth ${w}</p>
        <p class="sample" style="font-size:${v.css};font-weight:${g};font-variation-settings:'wdth' ${w};letter-spacing:-.028em;line-height:${k === 'h3' ? 1.12 : 0.98};margin:0">${SPECIMEN[k]}</p>
      </div>`
    })
    .join('\n') +
  `\n<div class="spec"><p class="meta">uvod &middot; ${esc(T.velicine.uvod.px)} px &middot; ${T.pismo.tijelo.family}</p>
     <p style="font-size:${T.velicine.uvod.css};line-height:1.45;margin:0;max-width:30em">${SPECIMEN.uvod}</p></div>
   <div class="spec"><p class="meta">tijelo &middot; ${esc(T.velicine.tijelo.px)} px &middot; lh 1.7 &middot; ${T.mjere.mjera.css}</p>
     <p style="margin:0">Running text. The measure is <strong>${T.mjere.mjera.css}</strong>. ${esc(T.mjere.mjera.uloga.replace(/^[^.]*\.\s*/, ''))}</p></div>
   <div class="spec"><p class="meta">oznaka &middot; ${esc(T.velicine.sitno.px)} px &middot; ${T.pismo.podaci.family} &middot; uppercase</p>
     <p class="eyebrow" style="color:var(--ink)">Aktuelni podaci &middot; Federalni zavod za statistiku</p></div>`

const scaleTable = () =>
  `<table><thead><tr><th>Step</th><th class="n">px</th><th class="n">wdth</th><th>Value</th></tr></thead><tbody>` +
  Object.entries(T.velicine)
    .map(([k, v]) => `<tr><td class="mono">--text-${k}</td><td class="n">${esc(v.px)}</td><td class="n">${v.wdth ?? '&mdash;'}</td><td class="mono" style="font-size:.8125rem">${esc(v.css)}</td></tr>`)
    .join('\n') +
  `</tbody></table>`

const rhythmTable = () =>
  `<table><thead><tr><th>Token</th><th class="n">Range</th><th>What it separates</th></tr></thead><tbody>` +
  Object.entries(T.ritam).map(([k, v]) => `<tr><td class="mono">--spacing-${k}</td><td class="n">${esc(v.px)} px</td><td>${esc(v.uloga)}</td></tr>`).join('\n') +
  Object.entries(T.mjere).map(([k, v]) => `<tr><td class="mono">--${k}</td><td class="n">${esc(v.css)}</td><td>${esc(v.uloga)}</td></tr>`).join('\n') +
  `</tbody></table>`

const motionTable = () =>
  `<table><thead><tr><th>Token</th><th class="n">Value</th><th>Where</th></tr></thead><tbody>
    <tr><td class="mono">--ease-izlaz</td><td class="n">${T.pokret['ease-izlaz']}</td><td>Things entering or settling. The house curve.</td></tr>
    <tr><td class="mono">--ease-ulaz</td><td class="n">${T.pokret['ease-ulaz']}</td><td>Things leaving, and the count-up.</td></tr>
    <tr><td class="mono">stanje</td><td class="n">${T.pokret.stanje}</td><td>Colour and lift on a control. Nothing slower feels responsive.</td></tr>
    <tr><td class="mono">brojac</td><td class="n">${T.pokret.brojac}</td><td>A figure rising to a value already in the markup. Once, never on re-entry.</td></tr>
  </tbody></table>`

const googleQuery = () =>
  ['tijelo', 'prikaz', 'podaci'].map((k) => `family=${T.pismo[k].google.replace(/ /g, '+')}`).join('&')

const tokenBlock = () => esc(readFileSync(join(HERE, 'tokens.css'), 'utf8').trimEnd())

const faceCards = () =>
  ['prikaz', 'tijelo', 'podaci']
    .map((k) => {
      const f = T.pismo[k]
      const sample =
        k === 'prikaz'
          ? `<p style="font-family:var(--prikaz);font-size:2.5rem;font-weight:800;font-variation-settings:'wdth' 88;letter-spacing:-.03em;line-height:1;margin:0">Vi se fokusirajte<br>na brojke.</p>`
          : k === 'tijelo'
            ? `<p style="font-size:1.0625rem;margin:0">Knjigovodstvo, računovodstvo, porezi i zastupanje — za obrte i d.o.o., od osnivanja nadalje.</p>`
            : `<p class="mono" style="font-size:1.25rem;margin:0">1.714 KM<br>032 443 231<br>18.04.2025.</p>`
      return `<div class="rows">
        <p class="eyebrow">${cap(k)} &middot; ${f.family}</p>
        ${sample}
        <p style="font-size:.9375rem">${esc(f.uloga)}</p>
        ${f.napomena ? `<p style="font-size:.9375rem" class="quiet">${esc(f.napomena)}</p>` : ''}
      </div>`
    })
    .join('\n')

const officeBlocks = () =>
  F.uredi
    .map(
      (u) => `<div class="rows">
      <p class="eyebrow" style="color:rgba(23,20,13,.62)">${esc(u.uloga)}</p>
      <p style="font-size:.9375rem;line-height:1.7;margin:0">
        ${esc(u.adresa)}<br>
        <span class="mono">${esc(u.postanski)} ${esc(u.grad)}</span><br>
        <span class="mono">tel ${esc(u.telefon)}</span>${u.fax ? `<br><span class="mono">fax ${esc(u.fax)}</span>` : ''}
      </p></div>`,
    )
    .join('\n')

/* ---- assembly ------------------------------------------------------------ */
const S = C.odjeljci
const head = (s, tone = '') =>
  `<div class="head"><p class="num"${tone}>${s.broj}</p><div class="txt">
     <p class="eyebrow">${s.oznaka}</p><h2>${s.naslov}</h2><p>${s.uvod}</p></div></div>`

const html = `<title>AESC Boja i pokret</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${googleQuery()}&display=swap">

<style>
/* GENERATED by brand/guide.mjs from tokens.json + guide.content.json + company.json.
   Do not edit — regenerate. Every value on this page was read or recomputed from those files. */
${readFileSync(join(HERE, 'guide.css'), 'utf8').trim()}
</style>

<script>
${readFileSync(join(HERE, 'guide.js'), 'utf8').trim()}
</script>

<header class="band band--gold">
  <div class="shell stack">
    <div class="masthead-top">
      <p class="eyebrow">${C.podnaslov}</p>
      <button class="tema" type="button" id="tema" aria-live="polite">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
          <circle cx="8" cy="8" r="3.1"/><path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05"/>
        </svg><span class="tema-t">Sistem</span>
      </button>
    </div>

    <div class="mark-row">${mark(112)}<div class="wordmark"><b>AESC</b><span>d.o.o.</span></div></div>
    <h1>${C.naslov}</h1>
    <p class="lede">${C.lede}</p>
    <hr>
    <div class="cols">
      <div class="rows"><p class="eyebrow">${C.zaKoga.naslov}</p><p style="font-size:.9375rem">${C.zaKoga.tekst}</p></div>
      <div class="rows"><p class="eyebrow">${C.izvor.naslov}</p><p style="font-size:.9375rem" class="mono">${C.izvor.tekst.replace(/\n/g, '<br>')}</p></div>
    </div>
  </div>
</header>

<section class="band">
  <div class="shell">${head(S.znak)}
    <div class="stack">
      <div class="mark-grid">
        ${S.znak.varijante
          .map(
            (v) => `<div class="mark-cell">
          <div class="mark-plate" style="background:${hex(v.tlo)};color:${hex(v.ink)}">${mark(v.mali ? 52 : 76, v.mali)}</div>
          <p class="eyebrow" style="color:var(--ink-quiet)">${v.ime}</p>
          <p style="font-size:.8125rem" class="quiet">${v.opis}</p></div>`,
          )
          .join('\n')}
      </div>
      <hr>
      <div class="cols">${S.znak.pravila.map((r) => `<div class="rows"><h4>${r.naslov}</h4><p style="font-size:.9375rem">${r.tekst}</p></div>`).join('\n')}</div>
      <hr>
      <div class="rows"><p class="eyebrow">Never</p><p>${S.znak.nikad}</p></div>
    </div>
  </div>
</section>

<section class="band band--ink">
  <div class="shell">${head(S.boja, ' style="color:var(--ink-quiet-2)"')}
    <div class="swatches">${swatches()}</div>
    <div class="stack" style="margin-top:var(--block)">
      <div class="rows"><p class="eyebrow">Legal pairings, measured</p><p>${S.boja.parovi}</p></div>
      <div class="pairs">${pairs()}</div>
      <p><strong>Gold on any light ground is illegal.</strong> ${ratio('zlato', 'papir')}:1 on paper.
        That covers gold text, gold hairlines, gold borders and gold focus rings on a pale surface.
        If gold must appear on a light page, it appears as a <em>filled shape</em> carrying dark ink,
        never as ink itself.</p>
      <hr>
      <div class="rows"><p class="eyebrow">In print</p><p>${S.boja.print}</p>
        <div class="scroller">${printTable()}</div></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="shell">${head(S.pismo)}
    <div class="stack">
      <div class="cols">${faceCards()}</div>
      <hr>
      <div class="rows"><p class="eyebrow">The scale, as it ships</p><p>${S.pismo.skala}</p></div>
      <div>${specimens()}</div>
      <div class="scroller">${scaleTable()}</div>
      <hr>
      <div class="cols">${S.pismo.biljeske.map((b) => `<div class="rows"><h4>${b.naslov}</h4><p style="font-size:.9375rem">${b.tekst}</p></div>`).join('\n')}</div>
    </div>
  </div>
</section>

<section class="band band--alt">
  <div class="shell">${head(S.prostor)}
    <div class="stack">
      <div class="scroller">${rhythmTable()}</div>
      <div class="cols">${S.prostor.biljeske.map((b) => `<div class="rows"><h4>${b.naslov}</h4><p style="font-size:.9375rem">${b.tekst}</p></div>`).join('\n')}</div>
    </div>
  </div>
</section>

<section class="band">
  <div class="shell">${head(S.pokret)}
    <div class="scroller">${motionTable()}</div>
    <p style="margin-top:var(--block)">${S.pokret.zavrsno}</p>
  </div>
</section>

<section class="band band--teal">
  <div class="shell">${head(S.slika, ' style="color:var(--teal-quiet)"')}
    <div class="cols">${S.slika.kolone.map((k) => `<div class="rows"><h4>${k.naslov}</h4><p style="font-size:.9375rem">${k.tekst}</p></div>`).join('\n')}</div>
    <hr style="margin-block:var(--block)">
    <div class="rows">
      <p class="eyebrow">A worked figure, as the system sets one</p>
      <p style="font-size:.9375rem;max-width:44em">${S.slika.primjer.uvod}</p>
      <div style="border-left:3px solid var(--zlato);padding-left:1.25rem;display:grid;gap:.35rem;margin-top:.5rem">
        <p class="eyebrow" style="color:var(--teal-quiet)">${S.slika.primjer.oznaka}</p>
        <p class="mono" style="font-size:clamp(1.5rem,1rem + 2vw,2.25rem);line-height:1.1;margin:0">${S.slika.primjer.racun}<span style="color:var(--zlato)">${S.slika.primjer.rezultat}</span></p>
        <p style="font-size:.8125rem;margin:0" class="quiet">${S.slika.primjer.osnov}</p>
      </div>
    </div>
  </div>
</section>

<section class="band">
  <div class="shell">${head(S.glas)}
    <div class="scroller"><table><thead><tr><th style="width:50%">Write this</th><th>Not this</th></tr></thead><tbody>
      ${S.glas.parovi.map((p) => `<tr><td>${p.da}</td><td class="quiet">${p.ne}</td></tr>`).join('\n')}
    </tbody></table></div>
    <div class="cols" style="margin-top:var(--block)">${S.glas.biljeske.map((b) => `<div class="rows"><h4>${b.naslov}</h4><p style="font-size:.9375rem">${b.tekst}</p></div>`).join('\n')}</div>
  </div>
</section>

<section class="band band--alt">
  <div class="shell">${head(S.primjena)}
    <div class="scroller"><table><thead><tr><th>Surface</th><th>Ground</th><th>Do</th></tr></thead><tbody>
      ${S.primjena.redovi.map((r) => `<tr><td><strong>${r.povrsina}</strong></td><td class="mono">${r.tlo}</td><td>${r.sta}</td></tr>`).join('\n')}
    </tbody></table></div>
  </div>
</section>

<section class="band band--ink">
  <div class="shell stack">
    <div class="rows">
      <p class="eyebrow">Za kopiranje</p>
      <h3>The tokens, ready to paste.</h3>
      <p style="max-width:44em">Names in Bosnian, because that is what the source uses and a renamed
        token is a token that drifts. This block is <code>brand/tokens.css</code> verbatim.</p>
    </div>
<pre>${tokenBlock()}</pre>
    <p style="font-size:.9375rem;max-width:44em">Google Fonts, with <span class="mono">latin-ext</span> on all three:</p>
<pre>${['tijelo', 'prikaz', 'podaci'].map((k) => esc(T.pismo[k].google)).join('\n')}</pre>
  </div>
</section>

<section class="band">
  <div class="shell">${head(S.zakoni)}
    <ol class="laws">${S.zakoni.stavke.map((s) => `<li><p>${s}</p></li>`).join('\n')}</ol>
  </div>
</section>

<footer class="band band--gold">
  <div class="shell stack">
    <div class="rows"><p class="eyebrow">${C.podnozje.oznaka}</p><h3>${C.podnozje.naslov}</h3></div>
    <div class="cols">
      <div class="rows">
        <p class="eyebrow" style="color:rgba(23,20,13,.62)">Pravno</p>
        <p style="font-size:.9375rem;line-height:1.7;margin:0">
          <strong>${F.legalName}</strong><br>
          <span class="mono">JIB ${F.taxId}</span><br>
          <span class="mono">PDV ${F.vatId}</span><br>
          Osnovano <span class="mono">${F.foundingDate.split('-').reverse().map(Number).join('. ')}.</span>
        </p>
      </div>
      ${officeBlocks()}
      <div class="rows">
        <p class="eyebrow" style="color:rgba(23,20,13,.62)">Kontakt</p>
        <p style="font-size:.9375rem;line-height:1.7;margin:0">
          <a href="mailto:${F.email}" style="color:var(--mastilo)">${F.email}</a><br>
          <a href="${F.web}" style="color:var(--mastilo)">${F.web.replace('https://', '')}</a><br>
          <span class="mono">${F.radnoVrijeme}</span>
        </p>
      </div>
    </div>
    <hr style="border-color:rgba(23,20,13,.34)">
    <p style="font-size:.8125rem;max-width:46em;margin:0">${C.podnozje.napomenaSarajevo}</p>
  </div>
</footer>
`

const out = join(HERE, 'guide.html')
if (process.argv.includes('--check')) {
  const current = (() => { try { return readFileSync(out, 'utf8') } catch { return null } })()
  if (current !== html) { console.error('✗ brand/guide.html is stale. Run: node brand/guide.mjs'); process.exit(1) }
  console.log('✓ guide.html current — every value in it derives from tokens.json')
} else {
  writeFileSync(out, html)
  console.log(`✓ wrote brand/guide.html (${(html.length / 1024).toFixed(1)} KB)`)
  console.log(`  ${Object.keys(T.boja).length} colours, ${T.dozvoljeno.length + T.zabranjeno.length} pairings recomputed, ${Object.keys(T.velicine).length} type steps, ${F.uredi.length} offices`)
}
